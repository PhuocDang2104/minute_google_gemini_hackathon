"""
Video Inference Service
Process video: extract audio -> transcribe -> create transcript -> generate minutes -> PDF
"""
import logging
import tempfile
import httpx
from pathlib import Path
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.services import audio_processing, transcript_service, asr_service
from app.services import minutes_service
from app.schemas.transcript import TranscriptChunkCreate

logger = logging.getLogger(__name__)


async def process_meeting_video(
    db: Session,
    meeting_id: str,
    video_url: str,
    template_id: Optional[str] = None,
) -> dict:
    """
    Process video file through full pipeline:
    1. Download video (if URL)
    2. Extract audio
    3. Transcribe with ASR service (whisper.cpp)
    4. Create transcript chunks
    6. Generate meeting minutes
    7. Export PDF (optional)
    
    Args:
        db: Database session
        meeting_id: Meeting ID
        video_url: URL or local path to video file
        template_id: Optional template ID for minutes generation
        
    Returns:
        dict with status, transcript_count, minutes_id, pdf_url (if generated)
    """
    video_path = None
    audio_path = None
    
    try:
        # Step 1: Download video if it's a URL
        if video_url.startswith("http://") or video_url.startswith("https://"):
            logger.info(f"Downloading video from {video_url}")
            video_path = await _download_video(video_url, meeting_id)
        elif video_url.startswith("/files/"):
            # Local file path served by StaticFiles -> /files maps to /app/uploaded_files
            base_dir = Path(__file__).parent.parent.parent
            upload_dir = base_dir / "uploaded_files"
            relative_path = video_url[len("/files/"):]
            video_path = upload_dir / relative_path
            if not video_path.exists():
                # Backward-compat fallback if stored under /app/files
                legacy_path = base_dir / video_url.lstrip("/")
                if legacy_path.exists():
                    video_path = legacy_path
                else:
                    raise FileNotFoundError(f"Video file not found: {video_path}")
        else:
            video_path = Path(video_url)
            if not video_path.exists():
                raise FileNotFoundError(f"Video file not found: {video_path}")
        
        logger.info(f"Processing video: {video_path}")
        
        # Step 2: Extract audio
        logger.info("Extracting audio from video...")
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = Path(temp_dir) / f"audio_{meeting_id}.wav"
            audio_path = audio_processing.extract_audio_from_video(
                video_path,
                output_path=audio_path,
                sample_rate=16000,
                channels=1,
            )
            logger.info(f"Audio extracted: {audio_path}")
            
            # Step 3: Transcribe with ASR service (whisper.cpp)
            logger.info("Transcribing audio with ASR service...")
            asr_result = await asr_service.transcribe_audio_file(audio_path)
            segments = _extract_whisper_segments(asr_result)
            language = (
                asr_result.get("language")
                or (asr_result.get("result") or {}).get("language")
                or (asr_result.get("params") or {}).get("language")
                or "en"
            )
            logger.info(f"Transcription completed: {len(segments)} segments")
            
            # Step 6: Create transcript chunks in database
            logger.info("Saving transcript chunks to database...")
            chunks_to_create = []
            for idx, seg in enumerate(segments, start=1):
                chunks_to_create.append(TranscriptChunkCreate(
                    meeting_id=meeting_id,
                    chunk_index=idx,
                    start_time=seg["start_time"],
                    end_time=seg["end_time"],
                    speaker=seg.get("speaker", "SPEAKER_01"),
                    text=seg["text"],
                    confidence=seg.get("confidence", 1.0),
                    language=language,
                ))
            
            result = transcript_service.create_batch_transcript_chunks(
                db=db,
                meeting_id=meeting_id,
                chunks=chunks_to_create,
            )
            logger.info(f"Saved {result.total} transcript chunks")
            
            # Step 7: Generate meeting minutes
            minutes_id = None
            pdf_url = None
            if template_id:
                logger.info(f"Generating meeting minutes with template {template_id}...")
                try:
                    from app.schemas.minutes import GenerateMinutesRequest
                    minutes_result = await minutes_service.generate_minutes_with_ai(
                        db=db,
                        request=GenerateMinutesRequest(
                            meeting_id=meeting_id,
                            template_id=template_id,
                            include_transcript=True,
                            include_actions=True,
                            include_decisions=True,
                            include_risks=True,
                            format="markdown",
                        ),
                    )
                    minutes_id = minutes_result.id if hasattr(minutes_result, 'id') else None
                    logger.info(f"Minutes generated: {minutes_id}")
                    
                    # TODO: Generate PDF export
                    # pdf_url = await _generate_pdf(minutes_result, meeting_id)
                    
                except Exception as e:
                    logger.error(f"Failed to generate minutes: {e}", exc_info=True)
                    # Don't fail the whole process if minutes generation fails
            
            return {
                "status": "completed",
                "transcript_count": result.total,
                "minutes_id": minutes_id,
                "pdf_url": pdf_url,
            }
            
    except Exception as e:
        logger.error(f"Video processing failed: {e}", exc_info=True)
        raise
    finally:
        # Cleanup temporary files
        if video_path and video_path != Path(video_url) and video_path.exists():
            try:
                if video_path.parent.name.startswith("tmp"):
                    video_path.unlink()
            except Exception:
                pass


async def _download_video(url: str, meeting_id: str) -> Path:
    """Download video file from URL to temporary location"""
    temp_dir = Path(tempfile.gettempdir())
    video_path = temp_dir / f"video_{meeting_id}_{Path(url).stem}.mp4"
    
    async with httpx.AsyncClient(timeout=300.0) as client:  # 5 minute timeout
        response = await client.get(url)
        response.raise_for_status()
        video_path.write_bytes(response.content)
    
    logger.info(f"Video downloaded to {video_path}")
    return video_path


def _extract_whisper_segments(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    # whisper.cpp JSON variants:
    # - segments: [{start, end, text}] or [{t0, t1, text}]
    # - transcription: [{offsets: {from, to}, text}] (whisper-cli -oj)
    segments = payload.get("segments") or []
    if not segments:
        transcription = payload.get("transcription") or []
        if transcription:
            normalized: List[Dict[str, Any]] = []
            for item in transcription:
                offsets = item.get("offsets") or {}
                start_ms = offsets.get("from")
                end_ms = offsets.get("to")
                text = (item.get("text") or "").strip()
                if not text:
                    continue
                start_time = float(start_ms) / 1000.0 if start_ms is not None else 0.0
                end_time = float(end_ms) / 1000.0 if end_ms is not None else start_time
                normalized.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "text": text,
                    "speaker": "SPEAKER_01",
                    "confidence": 1.0,
                })
            return normalized

        text = (payload.get("text") or "").strip()
        if not text:
            return []
        return [{
            "start_time": 0.0,
            "end_time": 0.0,
            "text": text,
            "speaker": "SPEAKER_01",
            "confidence": 1.0,
        }]

    normalized: List[Dict[str, Any]] = []
    for seg in segments:
        start = seg.get("start")
        end = seg.get("end")
        if start is None and seg.get("t0") is not None:
            start = float(seg.get("t0", 0)) / 100.0
        if end is None and seg.get("t1") is not None:
            end = float(seg.get("t1", 0)) / 100.0
        if start is None:
            start = 0.0
        if end is None:
            end = float(start)
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        normalized.append({
            "start_time": float(start),
            "end_time": float(end),
            "text": text,
            "speaker": "SPEAKER_01",
            "confidence": 1.0,
        })
    return normalized

