from __future__ import annotations

import logging
from typing import Any, Dict

from pydantic import ValidationError

from app.db.session import SessionLocal
from app.schemas.realtime import TranscriptIngestPayload
from app.services.realtime_bus import session_bus
from app.services.in_meeting_persistence import persist_transcript
from app.services.realtime_session_store import session_store

logger = logging.getLogger(__name__)


def _validate_required(payload: TranscriptIngestPayload) -> None:
    if not payload.chunk or not payload.chunk.strip():
        raise ValueError("chunk must be non-empty")
    if payload.time_end < payload.time_start:
        raise ValueError("time_end must be >= time_start")


async def ingestTranscript(session_id: str, payload: Dict[str, Any], source: str) -> int:
    """
    SSOT for transcript ingestion (SmartVoice STT or dev/test WS).

    MUST:
    - validate required fields
    - allocate seq (monotonic per session)
    - publish transcript_event onto the session bus
    - return seq
    """
    try:
        seg = TranscriptIngestPayload.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(str(exc)) from exc

    _validate_required(seg)

    session_store.ensure(session_id)
    transcript_window = session_store.append_transcript(session_id, seg.chunk, max_chars=4000)

    event_payload: Dict[str, Any] = {
        "meeting_id": seg.meeting_id,
        "chunk": seg.chunk,
        "speaker": seg.speaker,
        "time_start": seg.time_start,
        "time_end": seg.time_end,
        "is_final": seg.is_final,
        "confidence": seg.confidence,
        "lang": seg.lang,
        # internal-only helpers (frontend distributor may strip)
        "question": seg.question,
        "transcript_window": transcript_window,
        "source": source,
    }

    envelope = await session_bus.publish(
        session_id,
        {
            "event": "transcript_event",
            "payload": event_payload,
        },
    )
    seq = int(envelope.get("seq") or 0)

    if seg.is_final:
        _persist_final_chunk(seg, seq)

    return seq


def _persist_final_chunk(seg: TranscriptIngestPayload, seq: int) -> None:
    meeting_id = seg.meeting_id
    if not meeting_id:
        return
    db = SessionLocal()
    try:
        persist_transcript(
            db,
            meeting_id,
            {
                "seq": seq,
                "speaker": seg.speaker,
                "text": seg.chunk,
                "time_start": seg.time_start,
                "time_end": seg.time_end,
                "is_final": True,
                "lang": seg.lang,
                "confidence": seg.confidence,
            },
        )
    except Exception:
        logger.warning("persist_final_transcript_failed meeting_id=%s seq=%s", meeting_id, seq, exc_info=True)
    finally:
        db.close()


async def publish_state(session_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    envelope = await session_bus.publish(
        session_id,
        {
            "event": "state",
            "payload": state,
        },
    )
    return envelope

