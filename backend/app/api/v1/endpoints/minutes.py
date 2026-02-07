"""
Meeting Minutes API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from app.db.session import get_db
from app.schemas.minutes import (
    MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingMinutesResponse, MeetingMinutesList,
    DistributionLogList,
    GenerateMinutesRequest, DistributeMinutesRequest
)
from app.services import minutes_service, participant_service

router = APIRouter()
logger = logging.getLogger(__name__)


class TestEmailRequest(BaseModel):
    to_email: str
    

@router.get('/email/status')
def get_email_status():
    """Check if email sending is configured"""
    from app.services.email_service import is_email_enabled
    from app.core.config import get_settings
    settings = get_settings()
    
    return {
        'email_enabled': is_email_enabled(),
        'smtp_host': settings.smtp_host,
        'smtp_port': settings.smtp_port,
        'smtp_user_configured': bool(settings.smtp_user),
        'smtp_password_configured': bool(settings.smtp_password),
    }


@router.post('/email/test')
async def send_test_email(request: TestEmailRequest):
    """Send a test email to verify configuration"""
    from app.services.email_service import send_email, is_email_enabled
    
    if not is_email_enabled():
        return {
            'success': False,
            'message': 'Email not configured. Set SMTP_USER, SMTP_PASSWORD, EMAIL_ENABLED=true in environment variables.',
            'help': 'For Gmail: Use App Password from https://myaccount.google.com/apppasswords'
        }
    
    result = send_email(
        to_emails=[request.to_email],
        subject='[MeetMate] Test Email - Cấu hình thành công!',
        body_text='''Xin chào!

Email này xác nhận rằng cấu hình gửi email của MeetMate đã hoạt động.

Bạn có thể sử dụng tính năng gửi biên bản họp qua email.

Trân trọng,
MeetMate AI Assistant
''',
        body_html='''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: 0 auto; background: #f5f5f5; padding: 20px; border-radius: 10px;">
        <h2 style="color: #5b5fc7;">✅ Cấu hình Email Thành Công!</h2>
        <p>Email này xác nhận rằng cấu hình gửi email của MeetMate đã hoạt động.</p>
        <p>Bạn có thể sử dụng tính năng gửi biên bản họp qua email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">MeetMate AI Assistant</p>
    </div>
</body>
</html>
'''
    )
    
    return result


@router.get('/{meeting_id}', response_model=MeetingMinutesList)
def list_minutes(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """List all minutes versions for a meeting"""
    return minutes_service.list_minutes(db, meeting_id)


@router.get('/{meeting_id}/latest', response_model=dict)
def get_latest_minutes(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get the latest minutes for a meeting"""
    minutes = minutes_service.get_latest_minutes(db, meeting_id)
    if not minutes:
        return {'meeting_id': meeting_id, 'minutes': None, 'message': 'No minutes available'}
    return minutes.model_dump()


@router.post('/', response_model=MeetingMinutesResponse)
def create_minutes(
    data: MeetingMinutesCreate,
    db: Session = Depends(get_db)
):
    """Create new meeting minutes"""
    return minutes_service.create_minutes(db, data)


@router.put('/{minutes_id}', response_model=MeetingMinutesResponse)
def update_minutes(
    minutes_id: str,
    data: MeetingMinutesUpdate,
    edited_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update meeting minutes"""
    minutes = minutes_service.update_minutes(db, minutes_id, data, edited_by)
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")
    return minutes


@router.post('/{minutes_id}/approve', response_model=MeetingMinutesResponse)
def approve_minutes(
    minutes_id: str,
    approved_by: str,
    db: Session = Depends(get_db)
):
    """Approve meeting minutes"""
    minutes = minutes_service.approve_minutes(db, minutes_id, approved_by)
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")
    return minutes


@router.get('/render/{minutes_id}', response_class=HTMLResponse)
def render_minutes_html(
    minutes_id: str,
    db: Session = Depends(get_db)
):
    """Render minutes content as HTML (markdown-aware) for export/view."""
    minutes = minutes_service.get_minutes_by_id(db, minutes_id)
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")

    html = minutes_service.render_minutes_html_content(minutes)
    return HTMLResponse(content=html, status_code=200)


@router.get('/render-full/{minutes_id}', response_class=HTMLResponse)
def render_minutes_full_page(
    minutes_id: str,
    db: Session = Depends(get_db)
):
    """
    Render a styled full-page HTML for print/export (includes meeting metadata).
    """
    try:
        html = minutes_service.render_minutes_full_page(db, minutes_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Minutes not found")
    return HTMLResponse(content=html, status_code=200)


# ============================================
# AI-Powered Generation
# ============================================

@router.post('/generate', response_model=MeetingMinutesResponse)
async def generate_minutes(
    request: GenerateMinutesRequest,
    db: Session = Depends(get_db)
):
    """Generate meeting minutes using AI"""
    try:
        minutes = await minutes_service.generate_minutes_with_ai(db, request)
        return minutes
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(
            "generate_minutes failed meeting_id=%s template_id=%s format=%s: %s",
            request.meeting_id,
            request.template_id,
            request.format,
            e,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Failed to generate minutes: {str(e)}")


# ============================================
# Distribution
# ============================================

@router.get('/{meeting_id}/distribution', response_model=DistributionLogList)
def list_distribution_logs(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """List distribution logs for a meeting"""
    return minutes_service.list_distribution_logs(db, meeting_id)


@router.post('/distribute')
async def distribute_minutes(
    request: DistributeMinutesRequest,
    db: Session = Depends(get_db)
):
    """Distribute meeting minutes to participants via email"""
    from app.schemas.minutes import DistributionLogCreate
    from app.services.email_service import send_meeting_minutes_email, is_email_enabled
    from app.services import meeting_service, user_service
    
    # Get meeting info
    meeting = meeting_service.get_meeting(db, request.meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get minutes
    minutes = minutes_service.get_minutes_by_id(db, request.minutes_id)
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")
    
    # Get participants if no specific recipients
    recipients = request.recipients
    if not recipients:
        participants = participant_service.list_participants(db, request.meeting_id)
        recipients = [p.user_id for p in participants.participants]
    
    # Collect email addresses
    emails_to_send = []
    user_email_map = {}
    for user_id in recipients:
        try:
            user = user_service.get_user(db, user_id)
            if user and user.email:
                emails_to_send.append(user.email)
                user_email_map[user_id] = user.email
        except:
            # Try using user_id as email directly
            if '@' in str(user_id):
                emails_to_send.append(user_id)
                user_email_map[user_id] = user_id
    
    email_result = {'success': False, 'sent_to': [], 'failed': emails_to_send}
    
    # Send actual email if configured
    if 'email' in request.channels and emails_to_send:
        if is_email_enabled():
            from datetime import datetime
            start_time = datetime.fromisoformat(str(meeting.start_time).replace('Z', '+00:00')) if meeting.start_time else datetime.now()
            
            email_result = send_meeting_minutes_email(
                to_emails=emails_to_send,
                meeting_title=meeting.title,
                meeting_date=start_time.strftime('%d/%m/%Y'),
                meeting_time=start_time.strftime('%H:%M'),
                meeting_location=meeting.location or 'Online',
                executive_summary=minutes.executive_summary or 'Chưa có tóm tắt.',
                minutes_content=minutes.minutes_html or minutes.minutes_markdown or minutes.minutes_text
            )
        else:
            # Demo mode - just log
            email_result = {'success': True, 'sent_to': emails_to_send, 'failed': [], 'demo_mode': True}
    
    # Log distribution for each recipient
    results = []
    for channel in request.channels:
        for user_id in recipients:
            email = user_email_map.get(user_id, user_id if '@' in str(user_id) else None)
            status = 'sent' if email in email_result.get('sent_to', []) else 'failed'
            
            log = minutes_service.create_distribution_log(db, DistributionLogCreate(
                minutes_id=request.minutes_id,
                meeting_id=request.meeting_id,
                user_id=user_id,
                channel=channel,
                recipient_email=email,
                status=status,
                error_message=email_result.get('error') if status == 'failed' else None
            ))
            results.append(log.model_dump())
    
    return {
        'status': 'success' if email_result.get('success') else 'partial',
        'distributed_to': len(email_result.get('sent_to', [])),
        'failed': len(email_result.get('failed', [])),
        'channels': request.channels,
        'logs': results,
        'email_enabled': is_email_enabled(),
        'demo_mode': email_result.get('demo_mode', False)
    }
