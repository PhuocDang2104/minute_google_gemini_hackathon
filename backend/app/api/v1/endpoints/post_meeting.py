from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.minutes import GenerateMinutesRequest, DistributeMinutesRequest
from app.services import minutes_service, action_item_service, participant_service, summary_service

router = APIRouter()


@router.get('/summary', response_model=dict)
def post_summary():
    return {"status": "pending", "note": "Post-meeting generation queued"}


@router.get('/summary/{meeting_id}', response_model=dict)
def get_meeting_summary(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get executive summary for a meeting"""
    minutes = minutes_service.get_latest_minutes(db, meeting_id)
    if not minutes:
        cached = summary_service.get_latest_summary(
            db,
            meeting_id=meeting_id,
            summary_type="minutes_executive",
        )
        if cached:
            return {
                "meeting_id": meeting_id,
                "summary": cached.get("content"),
                "status": "cached",
                "version": cached.get("version"),
                "summary_type": cached.get("summary_type"),
                "generated_at": cached.get("created_at").isoformat() if cached.get("created_at") else None,
            }
        return {
            "meeting_id": meeting_id,
            "summary": None,
            "status": "not_generated",
            "message": "No minutes generated yet"
        }
    
    return {
        "meeting_id": meeting_id,
        "summary": minutes.executive_summary,
        "status": minutes.status,
        "version": minutes.version,
        "generated_at": minutes.generated_at.isoformat() if minutes.generated_at else None
    }


@router.get('/minutes/{meeting_id}', response_model=dict)
def get_meeting_minutes(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get full meeting minutes"""
    minutes = minutes_service.get_latest_minutes(db, meeting_id)
    if not minutes:
        return {
            "meeting_id": meeting_id,
            "minutes": None,
            "message": "No minutes generated yet"
        }
    
    return minutes.model_dump()


@router.post('/minutes/generate', response_model=dict)
async def generate_meeting_minutes(
    request: GenerateMinutesRequest,
    db: Session = Depends(get_db)
):
    """Generate meeting minutes using AI"""
    try:
        minutes = await minutes_service.generate_minutes_with_ai(db, request)
        return {
            "status": "success",
            "minutes": minutes.model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate minutes: {str(e)}")


@router.get('/actions/{meeting_id}', response_model=dict)
def get_action_items(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get action items for post-meeting review"""
    items = action_item_service.list_action_items(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "actions": [item.model_dump() for item in items.items],
        "total": items.total,
        "confirmed": len([i for i in items.items if i.status == 'confirmed']),
        "pending": len([i for i in items.items if i.status == 'proposed'])
    }


@router.get('/decisions/{meeting_id}', response_model=dict)
def get_decisions(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get decisions for post-meeting review"""
    items = action_item_service.list_decision_items(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "decisions": [item.model_dump() for item in items.items],
        "total": items.total,
        "confirmed": len([i for i in items.items if i.status == 'confirmed'])
    }


@router.get('/risks/{meeting_id}', response_model=dict)
def get_risks(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get risks for post-meeting review"""
    items = action_item_service.list_risk_items(db, meeting_id)
    
    # Group by severity
    by_severity = {
        'critical': [],
        'high': [],
        'medium': [],
        'low': []
    }
    for item in items.items:
        by_severity.get(item.severity, by_severity['medium']).append(item.model_dump())
    
    return {
        "meeting_id": meeting_id,
        "risks": [item.model_dump() for item in items.items],
        "total": items.total,
        "by_severity": by_severity
    }


@router.get('/distribution/{meeting_id}', response_model=dict)
def get_distribution_log(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get distribution log for a meeting"""
    logs = minutes_service.list_distribution_logs(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "logs": [log.model_dump() for log in logs.logs],
        "total": logs.total
    }


@router.post('/distribute', response_model=dict)
async def distribute_minutes(
    request: DistributeMinutesRequest,
    db: Session = Depends(get_db)
):
    """Distribute meeting minutes to participants"""
    from app.schemas.minutes import DistributionLogCreate
    
    # Get participants if no specific recipients
    recipients = request.recipients
    if not recipients:
        participants = participant_service.list_participants(db, request.meeting_id)
        recipients = [p.user_id for p in participants.participants]
    
    results = []
    for channel in request.channels:
        for user_id in recipients:
            log = minutes_service.create_distribution_log(db, DistributionLogCreate(
                minutes_id=request.minutes_id,
                meeting_id=request.meeting_id,
                user_id=user_id,
                channel=channel,
                status='sent'
            ))
            results.append(log.model_dump())
    
    return {
        'status': 'success',
        'distributed_to': len(recipients),
        'channels': request.channels,
        'logs': results
    }


@router.get('/attendance/{meeting_id}', response_model=dict)
def get_attendance_report(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get attendance report for a meeting"""
    participants = participant_service.list_participants(db, meeting_id)
    
    attended = [p for p in participants.participants if p.attended]
    not_attended = [p for p in participants.participants if not p.attended]
    
    return {
        "meeting_id": meeting_id,
        "total_invited": participants.total,
        "attended": len(attended),
        "not_attended": len(not_attended),
        "attendance_rate": round(len(attended) / max(participants.total, 1) * 100, 1),
        "attendees": [
            {
                "user_id": p.user_id,
                "name": p.user_name,
                "role": p.role,
                "joined_at": p.joined_at.isoformat() if p.joined_at else None,
                "left_at": p.left_at.isoformat() if p.left_at else None
            }
            for p in attended
        ],
        "absent": [
            {
                "user_id": p.user_id,
                "name": p.user_name,
                "role": p.role,
                "response_status": p.response_status
            }
            for p in not_attended
        ]
    }
