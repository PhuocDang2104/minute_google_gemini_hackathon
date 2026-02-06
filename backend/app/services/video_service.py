"""
Video Service
Handle video upload and processing for meetings
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.storage_client import (
    is_storage_configured,
    build_object_key,
    upload_bytes_to_storage,
    generate_presigned_get_url,
)
from app.services import meeting_service
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Allowed video formats
ALLOWED_VIDEO_TYPES = {
    'video/mp4',
    'video/quicktime',  # MOV
    'video/x-msvideo',  # AVI
    'video/webm',
    'video/x-matroska',  # MKV
}

# Max file size: configurable via settings (default 100MB for Supabase free tier)
MAX_FILE_SIZE = settings.max_video_file_size_mb * 1024 * 1024


async def upload_meeting_video(
    db: Session,
    meeting_id: str,
    file: UploadFile,
    uploaded_by: Optional[UUID] = None,
) -> dict:
    """
    Upload a video file for a meeting.
    
    Args:
        db: Database session
        meeting_id: Meeting ID
        file: Video file to upload
        uploaded_by: User ID who uploaded the video
        
    Returns:
        dict with recording_url and message
        
    Raises:
        HTTPException if meeting not found, invalid file, or upload fails
    """
    # Validate meeting exists
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Validate file type
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}"
        )
    
    # Get file size first (if available from headers)
    file_size = 0
    content_length = file.headers.get("content-length")
    if content_length:
        try:
            file_size = int(content_length)
            # Validate file size early (before reading)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size ({file_size / (1024*1024):.2f}MB) exceeds maximum allowed size ({MAX_FILE_SIZE / (1024*1024):.0f}MB)"
                )
        except (ValueError, TypeError):
            pass
    
    # Read file content
    try:
        content = await file.read()
        file_size = len(content)
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        raise HTTPException(status_code=400, detail="Failed to read file")
    
    # Validate file size after reading
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({file_size / (1024*1024):.2f}MB) exceeds maximum allowed size ({MAX_FILE_SIZE / (1024*1024):.0f}MB)"
        )
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # Get file extension
    filename = file.filename or "video.mp4"
    file_ext = filename.split('.')[-1] if '.' in filename else 'mp4'
    
    # Build storage key
    # Pattern: videos/{meeting_id}/{uuid}_{safe_filename}.{ext}
    storage_key = build_object_key(
        filename=f"{meeting_id}_{filename}",
        prefix=f"videos/{meeting_id}"
    )
    
    # Upload to storage
    file_url = None
    recording_storage_key = None
    provider = None
    try:
        if is_storage_configured():
            # Upload to Supabase S3
            uploaded_key = upload_bytes_to_storage(
                content,
                storage_key,
                content_type=file.content_type
            )
            if uploaded_key:
                # Generate presigned URL (24 hours expiration)
                file_url = generate_presigned_get_url(uploaded_key, expires_in=86400)
                recording_storage_key = uploaded_key
                provider = "supabase"
                logger.info(f"Video uploaded to storage: {storage_key}")
            else:
                logger.warning("Storage upload returned None, falling back to local")
        else:
            logger.warning("Storage not configured, falling back to local")
    except Exception as e:
        logger.error(f"Storage upload failed: {e}", exc_info=True)
        error_msg = str(e)
        # Provide helpful error message for size limits
        if "EntityTooLarge" in error_msg or "too large" in error_msg.lower():
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Video file is too large for storage. "
                    f"File size: {file_size / (1024*1024):.2f}MB. "
                    f"Supabase Storage may have file size limits (typically 50-100MB for free tier). "
                    f"Please compress the video or use a smaller file."
                )
            )
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")
    
    # Fallback to local storage if S3 not configured or failed
    if not file_url:
        from pathlib import Path
        
        upload_dir = Path(__file__).parent.parent.parent / "uploaded_files" / "videos"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        stored_name = f"{uuid4()}.{file_ext}"
        stored_path = upload_dir / stored_name
        
        try:
            stored_path.write_bytes(content)
            file_url = f"/files/videos/{stored_name}"
            recording_storage_key = f"videos/{stored_name}"
            provider = "local"
            logger.info(f"Video saved locally: {stored_path}")
        except Exception as e:
            logger.error(f"Local save failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save video file")
    
    # Persist recording metadata and update meeting.recording_url
    try:
        recording_id = str(uuid4())
        now = datetime.utcnow()
        db.execute(
            text("""
                INSERT INTO meeting_recording (
                    id, meeting_id, file_url, storage_key, provider,
                    original_filename, content_type, size_bytes,
                    duration_sec, uploaded_by, status, created_at, updated_at
                )
                VALUES (
                    :id, :meeting_id, :file_url, :storage_key, :provider,
                    :original_filename, :content_type, :size_bytes,
                    :duration_sec, :uploaded_by, :status, :created_at, :updated_at
                )
            """),
            {
                "id": recording_id,
                "meeting_id": meeting_id,
                "file_url": file_url,
                "storage_key": recording_storage_key,
                "provider": provider,
                "original_filename": filename,
                "content_type": file.content_type,
                "size_bytes": file_size,
                "duration_sec": None,
                "uploaded_by": uploaded_by,
                "status": "uploaded",
                "created_at": now,
                "updated_at": now,
            },
        )
        result = db.execute(
            text("""
                UPDATE meeting
                SET recording_url = :recording_url
                WHERE id = :meeting_id
                RETURNING id
            """),
            {
                "recording_url": file_url,
                "meeting_id": meeting_id,
            },
        )
        if not result.fetchone():
            raise HTTPException(status_code=500, detail="Failed to update meeting")

        db.commit()
        logger.info(f"Meeting {meeting_id} updated with recording_url: {file_url}")

        return {
            "recording_id": recording_id,
            "recording_url": file_url,
            "message": "Video uploaded successfully",
            "file_size": file_size,
            "storage_key": recording_storage_key,
            "provider": provider,
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update meeting: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save video metadata")


async def get_video_url(db: Session, meeting_id: str) -> Optional[str]:
    """
    Get video URL for a meeting.
    
    Args:
        db: Database session
        meeting_id: Meeting ID
        
    Returns:
        Video URL or None if not found
    """
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        return None
    
    return meeting.recording_url


async def delete_meeting_video(db: Session, meeting_id: str) -> bool:
    """
    Delete video recording for a meeting and all related metadata.
    
    This includes:
    - Video file (local or from storage)
    - Transcript chunks (created from video processing)
    - Meeting minutes (generated from video transcript)
    
    Args:
        db: Database session
        meeting_id: Meeting ID
        
    Returns:
        True if deleted successfully, False otherwise
    """
    from sqlalchemy import text
    
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting or not meeting.recording_url:
        return False
    
    recording_url = meeting.recording_url
    
    try:
        # 1. Delete video file from storage or local filesystem
        try:
            # Prefer deleting from meeting_recording metadata if available
            recordings = db.execute(
                text("""
                    SELECT id::text, file_url, storage_key, provider
                    FROM meeting_recording
                    WHERE meeting_id = :meeting_id
                """),
                {"meeting_id": meeting_id},
            ).fetchall()

            for row in recordings:
                file_url = row[1]
                storage_key = row[2]
                provider = (row[3] or "").lower()

                if provider == "supabase" and storage_key:
                    from app.services.storage_client import delete_object
                    deleted = delete_object(storage_key)
                    if deleted:
                        logger.info(f"Deleted storage object: {storage_key}")
                elif file_url and file_url.startswith("/files/"):
                    from pathlib import Path
                    local_path = Path(__file__).parent.parent.parent / file_url.lstrip("/")
                    if local_path.exists():
                        local_path.unlink()
                        logger.info(f"Deleted local video file: {local_path}")

            # Fallback: if no recording rows and local file path, try deleting by recording_url
            if not recordings and recording_url.startswith("/files/"):
                from pathlib import Path
                local_path = Path(__file__).parent.parent.parent / recording_url.lstrip("/")
                if local_path.exists():
                    local_path.unlink()
                    logger.info(f"Deleted local video file: {local_path}")
            
        except Exception as e:
            logger.warning(f"Failed to delete video file (continuing to clear metadata): {e}", exc_info=True)
        
        # 2. Delete transcript chunks (created from video processing)
        try:
            result = db.execute(
                text("DELETE FROM transcript_chunk WHERE meeting_id = :meeting_id"),
                {'meeting_id': meeting_id}
            )
            deleted_chunks = result.rowcount
            logger.info(f"Deleted {deleted_chunks} transcript chunks for meeting {meeting_id}")
        except Exception as e:
            logger.warning(f"Failed to delete transcript chunks: {e}", exc_info=True)
        
        # 3. Delete meeting minutes (generated from video transcript)
        try:
            result = db.execute(
                text("DELETE FROM meeting_minutes WHERE meeting_id = :meeting_id"),
                {'meeting_id': meeting_id}
            )
            deleted_minutes = result.rowcount
            logger.info(f"Deleted {deleted_minutes} meeting minutes for meeting {meeting_id}")
        except Exception as e:
            logger.warning(f"Failed to delete meeting minutes: {e}", exc_info=True)
        
        # 4. Delete recording metadata rows
        try:
            db.execute(
                text("DELETE FROM meeting_recording WHERE meeting_id = :meeting_id"),
                {'meeting_id': meeting_id}
            )
        except Exception as e:
            logger.warning(f"Failed to delete meeting_recording rows: {e}", exc_info=True)

        # 5. Clear recording_url from database using direct SQL (MeetingUpdate skips None values)
        try:
            db.execute(
                text("UPDATE meeting SET recording_url = NULL WHERE id = :meeting_id"),
                {'meeting_id': meeting_id}
            )
            db.commit()
            logger.info(f"Successfully deleted video and cleared metadata for meeting {meeting_id}")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to clear recording_url: {e}", exc_info=True)
            return False
            
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete video and metadata: {e}", exc_info=True)
        return False
