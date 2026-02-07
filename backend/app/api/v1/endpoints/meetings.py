from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import Optional, List
from sqlalchemy.orm import Session
from app.schemas.meeting import (
    Meeting, 
    MeetingCreate, 
    MeetingUpdate, 
    MeetingWithParticipants,
    MeetingList,
    MeetingNotifyRequest,
)
from app.db.session import get_db
from app.services import meeting_service
from app.services import participant_service, agenda_service
from app.services import email_service, knowledge_service
from app.services import video_service
from app.services.storage_client import generate_presigned_get_url
from app.schemas.knowledge import KnowledgeDocument
from datetime import datetime

router = APIRouter()


@router.get('/', response_model=MeetingList)
def list_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=400),
    phase: Optional[str] = None,
    meeting_type: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all meetings with optional filters"""
    meetings, total = meeting_service.list_meetings(
        db=db,
        skip=skip,
        limit=limit,
        phase=phase,
        meeting_type=meeting_type,
        project_id=project_id
    )
    return MeetingList(meetings=meetings, total=total)


@router.post('/', response_model=Meeting, status_code=201)
def create_meeting(
    payload: MeetingCreate,
    db: Session = Depends(get_db)
):
    """Create a new meeting"""
    return meeting_service.create_meeting(db=db, payload=payload)


@router.post('/quick', response_model=Meeting, status_code=201)
def quick_create_meeting(
    db: Session = Depends(get_db)
):
    """
    Quick-create a new meeting with auto-generated title.
    Title format: "Untitled YYYY-MM-DD HH:MM"
    """
    now = datetime.now()
    title = f"Untitled {now.strftime('%Y-%m-%d %H:%M')}"
    payload = MeetingCreate(title=title)
    return meeting_service.create_meeting(db=db, payload=payload)


@router.get('/{meeting_id}', response_model=MeetingWithParticipants)
def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get a single meeting by ID with participants"""
    meeting = meeting_service.get_meeting(db=db, meeting_id=meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.put('/{meeting_id}', response_model=Meeting)
def update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Update a meeting"""
    meeting = meeting_service.update_meeting(db=db, meeting_id=meeting_id, payload=payload)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.delete('/{meeting_id}', status_code=204)
def delete_meeting(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Delete a meeting"""
    success = meeting_service.delete_meeting(db=db, meeting_id=meeting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return None


@router.post('/{meeting_id}/notify')
async def notify_meeting(
    meeting_id: str,
    payload: MeetingNotifyRequest,
    db: Session = Depends(get_db)
):
    """Send meeting notification email to selected recipients."""
    meeting = meeting_service.get_meeting(db=db, meeting_id=meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Build sections
    agenda_items = []
    if payload.include_agenda:
        try:
            agenda_items = agenda_service.list_items(db, meeting_id)
        except Exception:
            agenda_items = []

    documents: List[KnowledgeDocument] = []
    if payload.include_documents:
        try:
            doc_list = await knowledge_service.list_documents(db, meeting_id=meeting_id, limit=50, skip=0, document_type=None, source=None, category=None, project_id=None)
            documents = doc_list.documents if hasattr(doc_list, "documents") else []
        except Exception:
            documents = []

    # Build HTML body (simple template)
    def fmt_datetime(dt):
        if not dt:
            return ""
        dt_obj = datetime.fromisoformat(str(dt).replace('Z', '+00:00'))
        return dt_obj.strftime("%H:%M %d/%m/%Y")

    agenda_html = ""
    if agenda_items:
        agenda_html = "<ul>" + "".join([f"<li>{i.order or idx+1}. {i.title or ''} ({i.duration_minutes or 0} phút) - {i.presenter or ''}</li>" for idx, i in enumerate(agenda_items)]) + "</ul>"
    docs_html = ""
    if documents:
        docs_html = "<ul>" + "".join([
            f"<li>{d.title} ({d.file_type})"
            + (f" - <a href='{d.file_url}' target='_blank' rel='noreferrer'>Tải/đọc</a>" if getattr(d, 'file_url', None) else "")
            + "</li>"
            for d in documents
        ]) + "</ul>"

    body_html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h3>Thông báo cuộc họp: {meeting.title}</h3>
      <p><b>Thời gian:</b> {fmt_datetime(meeting.start_time)} - {fmt_datetime(meeting.end_time)}</p>
      <p><b>Hình thức:</b> {meeting.location or 'Online'} {(' - ' + meeting.teams_link) if meeting.teams_link else ''}</p>
      {"<h4>Chương trình họp</h4>" + agenda_html if agenda_html else ""}
      {"<h4>Tài liệu</h4>" + docs_html if docs_html else ""}
      {"<h4>Ghi chú</h4><p>" + (payload.custom_message or '') + "</p>" if payload.custom_message else ""}
      <p style="color:#666;">Được gửi từ MeetMate.</p>
    </div>
    """
    body_text = (
        f"Thông báo cuộc họp: {meeting.title}\n"
        f"Thời gian: {fmt_datetime(meeting.start_time)} - {fmt_datetime(meeting.end_time)}\n"
        f"Địa điểm: {meeting.location or 'Online'}\n"
    )
    if agenda_items:
        body_text += "\nChương trình:\n" + "\n".join(
            [f"- {i.order or idx+1}. {i.title or ''} ({i.duration_minutes or 0}p) - {i.presenter or ''}" for idx, i in enumerate(agenda_items)]
        )
    if documents:
        body_text += "\nTài liệu:\n" + "\n".join(
            [f"- {d.title} ({d.file_type}){(' - ' + d.file_url) if getattr(d, 'file_url', None) else ''}" for d in documents]
        )
    if payload.custom_message:
        body_text += f"\nGhi chú: {payload.custom_message}\n"

    to_emails = [r.email for r in payload.recipients if r.email]
    if not to_emails:
        raise HTTPException(status_code=400, detail="No recipients provided")

    if not email_service.is_email_enabled():
        return {"success": False, "error": "Email not configured", "sent_to": [], "failed": to_emails}

    result = email_service.send_email(
        to_emails=to_emails,
        subject=f"[MeetMate] Thông báo cuộc họp: {meeting.title}",
        body_text=body_text,
        body_html=body_html,
    )
    return result


@router.post('/{meeting_id}/participants', response_model=Meeting)
def add_participant(
    meeting_id: str,
    user_id: str,
    role: str = 'attendee',
    db: Session = Depends(get_db)
):
    """Add a participant to a meeting"""
    meeting = meeting_service.add_participant(
        db=db, 
        meeting_id=meeting_id, 
        user_id=user_id, 
        role=role
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.patch('/{meeting_id}/phase', response_model=Meeting)
def update_meeting_phase(
    meeting_id: str,
    body: dict,
    db: Session = Depends(get_db)
):
    """Update meeting phase (pre -> in -> post)"""
    phase = body.get('phase')
    if phase not in ['pre', 'in', 'post']:
        raise HTTPException(status_code=400, detail="Invalid phase. Must be: pre, in, post")
    
    meeting = meeting_service.update_phase(db=db, meeting_id=meeting_id, phase=phase)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # When ending meeting (phase -> 'post'), save transcript from session store to database
    if phase == 'post':
        from app.services.realtime_session_store import session_store
        from app.services import transcript_service
        from app.schemas.transcript import TranscriptChunkCreate
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Try to get session by meeting_id (session_id might be same as meeting_id)
        session = session_store.get(meeting_id)
        if session and session.stream_state and session.stream_state.final_stream:
            try:
                # Check if transcript already exists in database
                existing_chunks = transcript_service.list_transcript_chunks(
                    db=db,
                    meeting_id=meeting_id,
                    limit=1
                )
                
                # Only save if no transcript exists yet (avoid duplicates)
                if existing_chunks.total == 0:
                    # Convert FinalTranscriptChunk to TranscriptChunkCreate
                    chunks_to_save = []
                    for idx, chunk in enumerate(session.stream_state.final_stream, start=1):
                        chunks_to_save.append(TranscriptChunkCreate(
                            chunk_index=idx,
                            start_time=chunk.time_start,
                            end_time=chunk.time_end,
                            speaker=chunk.speaker,
                            text=chunk.text,
                            confidence=chunk.confidence,
                            language=chunk.lang,
                            meeting_id=meeting_id
                        ))
                    
                    if chunks_to_save:
                        # Save all transcript chunks to database
                        result = transcript_service.create_batch_transcript_chunks(
                            db=db,
                            meeting_id=meeting_id,
                            chunks=chunks_to_save
                        )
                        logger.info(f"Saved {result.total} transcript chunks for meeting {meeting_id}")
                else:
                    logger.info(f"Transcript already exists for meeting {meeting_id}, skipping save")
            except Exception as e:
                # Log error but don't fail the phase update
                logger.error(f"Failed to save transcript when ending meeting {meeting_id}: {e}", exc_info=True)
    
    return meeting


@router.post('/{meeting_id}/upload-video')
async def upload_meeting_video(
    meeting_id: str,
    video: UploadFile = File(..., description="Video file to upload"),
    uploaded_by: Optional[str] = Form(None, description="User ID who uploaded the video"),
    db: Session = Depends(get_db)
):
    """
    Upload a video recording for a meeting.
    
    Accepts video files (MP4, MOV, AVI, WebM, MKV).
    Max file size: Configurable via MAX_VIDEO_FILE_SIZE_MB (default: 100MB for Supabase free tier).
    Uploads to Supabase S3 storage (or local fallback) and updates meeting.recording_url.
    
    Note: Supabase Storage free tier typically has a 50-100MB limit per file.
    For larger files, consider upgrading your Supabase plan or compressing videos.
    """
    from uuid import UUID as UUIDType
    
    uploaded_by_uuid = None
    if uploaded_by:
        try:
            uploaded_by_uuid = UUIDType(uploaded_by)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid uploaded_by UUID format")
    
    try:
        result = await video_service.upload_meeting_video(
            db=db,
            meeting_id=meeting_id,
            file=video,
            uploaded_by=uploaded_by_uuid,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger = __import__('logging').getLogger(__name__)
        logger.error(f"Unexpected error uploading video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete('/{meeting_id}/video')
async def delete_meeting_video(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete video recording for a meeting.
    
    Removes the video file from storage and clears the recording_url from the meeting.
    """
    from app.services import video_service
    
    # Check meeting exists
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting has recording_url
    if not meeting.recording_url:
        raise HTTPException(status_code=404, detail="Meeting does not have a video recording")
    
    try:
        success = await video_service.delete_meeting_video(db, meeting_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete video")
        
        return {
            "status": "success",
            "message": "Video deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger = __import__('logging').getLogger(__name__)
        logger.error(f"Failed to delete video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


@router.post('/{meeting_id}/trigger-inference')
async def trigger_inference(
    meeting_id: str,
    template_id: Optional[str] = Query(None, description="Template ID for minutes generation"),
    db: Session = Depends(get_db)
):
    """
    Trigger AI inference (transcription + diarization) from video recording.
    
    Process flow:
    1. Extract audio from video (ffmpeg)
    2. Transcribe with VNPT STT API
    3. Diarize speakers with external API
    4. Create transcript chunks in database
    5. Generate meeting minutes with selected template
    6. Export PDF (optional)
    
    Args:
        meeting_id: Meeting ID
        template_id: Optional template ID for minutes generation
    """
    from app.services import video_inference_service
    
    # Check meeting exists
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting has recording_url
    if not meeting.recording_url:
        raise HTTPException(status_code=400, detail="Meeting does not have a video recording")
    
    try:
        # Process video (sync for demo). TODO: move to background job/queue for long videos.
        result = await video_inference_service.process_meeting_video(
            db=db,
            meeting_id=meeting_id,
            video_url=meeting.recording_url,
            template_id=template_id,
        )
        
        return {
            "status": "completed",
            "message": "Video processing completed successfully",
            "transcript_count": result.get("transcript_count", 0),
            "visual_event_count": result.get("visual_event_count", 0),
            "visual_object_count": result.get("visual_object_count", 0),
            "minutes_id": result.get("minutes_id"),
            "pdf_url": result.get("pdf_url"),
        }
        
    except Exception as e:
        logger = __import__('logging').getLogger(__name__)
        logger.error(f"Video inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Video processing failed: {str(e)}")
