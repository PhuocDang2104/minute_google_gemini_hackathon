from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.realtime_security import verify_audio_ingest_token
from app.schemas.gomeet import GoMeetJoinUrlRequest, GoMeetJoinUrlResponse
from app.schemas.in_meeting import TranscriptEvent, ActionEvent
from app.llm.graphs.router import build_router_graph
from app.llm.graphs.state import MeetingState
from app.services import transcript_service, action_item_service, gomeet_service

router = APIRouter()
router_graph = build_router_graph(default_stage="in")


def _run_graph(state: MeetingState) -> MeetingState:
    if hasattr(router_graph, "invoke"):
        return router_graph.invoke(state)
    return state


@router.get('/recap', response_model=dict)
def live_recap():
    result = _run_graph({"stage": "in", "transcript_window": "Stub transcript from API"})
    recap = result.get("debug_info", {}).get("recap", "No transcript received")
    return {"summary": recap}


@router.get('/recap/{meeting_id}', response_model=dict)
def get_meeting_recap(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get live recap for a specific meeting"""
    recap = transcript_service.get_live_recap(db, meeting_id)
    if recap:
        return recap.model_dump()
    return {"meeting_id": meeting_id, "summary": None, "message": "No recap available"}


@router.get('/actions', response_model=list[ActionEvent])
def live_actions():
    result = _run_graph({"stage": "in", "transcript_window": ""})
    actions = result.get("actions") or []
    return [ActionEvent(task=a.get("task", ""), owner=a.get("owner"), due_date=None, confidence=0.82) for a in actions]


@router.get('/actions/{meeting_id}', response_model=dict)
def get_meeting_actions(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get detected action items for a meeting"""
    items = action_item_service.list_action_items(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "actions": [item.model_dump() for item in items.items],
        "total": items.total
    }


@router.get('/decisions/{meeting_id}', response_model=dict)
def get_meeting_decisions(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get detected decisions for a meeting"""
    items = action_item_service.list_decision_items(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "decisions": [item.model_dump() for item in items.items],
        "total": items.total
    }


@router.get('/risks/{meeting_id}', response_model=dict)
def get_meeting_risks(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get detected risks for a meeting"""
    items = action_item_service.list_risk_items(db, meeting_id)
    return {
        "meeting_id": meeting_id,
        "risks": [item.model_dump() for item in items.items],
        "total": items.total
    }


@router.get('/transcript', response_model=list[TranscriptEvent])
def transcript():
    return [TranscriptEvent(speaker='PMO', text='We need to accelerate API A', timestamp=0.0)]


@router.post('/gomeet/join-url', response_model=GoMeetJoinUrlResponse, deprecated=True)
async def build_gomeet_join_url(payload: GoMeetJoinUrlRequest) -> GoMeetJoinUrlResponse:
    """Deprecated: GoMeet integration removed. Keep for backward compatibility."""
    token_payload = verify_audio_ingest_token(payload.audio_ingest_token, expected_session_id=payload.session_id)
    if not token_payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid audio_ingest_token")

    meeting_secret_key = payload.meeting_secret_key
    access_code = payload.access_code
    start_raw = None
    host_join_url = None

    if not meeting_secret_key or not access_code:
        try:
            start_result = await gomeet_service.start_new_meeting(idempotency_key=payload.idempotency_key)
        except gomeet_service.GoMeetConfigError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        except gomeet_service.GoMeetRequestError as exc:
            detail = {"message": str(exc), "upstream": exc.payload}
            raise HTTPException(status_code=exc.status_code or status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except gomeet_service.GoMeetResponseError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        meeting_secret_key = start_result.meeting_secret_key
        access_code = start_result.access_code
        host_join_url = start_result.host_join_url
        start_raw = start_result.raw

    if not meeting_secret_key or not access_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="meeting_secret_key and access_code required")

    try:
        join_result = await gomeet_service.join_meeting(
            meeting_secret_key=meeting_secret_key,
            access_code=access_code,
            idempotency_key=payload.idempotency_key,
        )
    except gomeet_service.GoMeetConfigError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except gomeet_service.GoMeetRequestError as exc:
        detail = {"message": str(exc), "upstream": exc.payload}
        raise HTTPException(status_code=exc.status_code or status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
    except gomeet_service.GoMeetResponseError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    full_join_url = gomeet_service.build_full_join_url(
        join_result.join_url,
        payload.session_id,
        payload.audio_ingest_token,
    )

    return GoMeetJoinUrlResponse(
        join_url=join_result.join_url,
        full_join_url=full_join_url,
        host_join_url=host_join_url,
        start_raw=start_raw,
        join_raw=join_result.raw,
    )


@router.get('/transcript/{meeting_id}', response_model=dict)
def get_meeting_transcript(
    meeting_id: str,
    from_index: int = None,
    to_index: int = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get transcript chunks for a meeting"""
    chunks = transcript_service.list_transcript_chunks(db, meeting_id, from_index, to_index, limit)
    return {
        "meeting_id": meeting_id,
        "chunks": [chunk.model_dump() for chunk in chunks.chunks],
        "total": chunks.total
    }
