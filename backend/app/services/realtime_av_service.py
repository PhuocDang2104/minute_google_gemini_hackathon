from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import logging
import math
import re
import threading
import time
import uuid
import wave
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.llm.chains.in_meeting_chain import answer_question, summarize_and_classify
from app.llm.tools.rag_search_tool import rag_retrieve
from app.llm.tools.search_tool import search as web_search
from app.schemas.realtime_av import RoiBox, SessionSnapshot
from app.services.in_meeting_persistence import persist_context_window, persist_transcript
from app.services.realtime_bus import session_bus
from app.services.storage_client import (
    build_object_key,
    generate_presigned_get_url,
    is_storage_configured,
    upload_bytes_to_storage,
)

logger = logging.getLogger(__name__)
settings = get_settings()

try:  # pragma: no cover - import validated by runtime + integration
    from PIL import Image, ImageFilter, UnidentifiedImageError
except Exception:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    ImageFilter = None  # type: ignore[assignment]
    UnidentifiedImageError = Exception  # type: ignore[assignment]


def now_ms() -> int:
    return int(time.time() * 1000)


def normalize_b64_payload(payload: str) -> str:
    value = (payload or "").strip()
    if "," in value and value.lower().startswith("data:"):
        return value.split(",", 1)[1].strip()
    return value


def parse_mmss_to_ms(raw: str) -> Optional[int]:
    value = (raw or "").strip()
    if not value:
        return None
    m = re.fullmatch(r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})|(\d{1,2}):(\d{2})", value)
    if m:
        if m.group(4) is not None and m.group(5) is not None:
            minutes = int(m.group(4))
            seconds = int(m.group(5))
            return (minutes * 60 + seconds) * 1000
        hours = int(m.group(1) or 0)
        minutes = int(m.group(2) or 0)
        seconds = int(m.group(3) or 0)
        return (hours * 3600 + minutes * 60 + seconds) * 1000
    if re.fullmatch(r"\d{1,6}", value):
        seconds = int(value)
        return seconds * 1000
    return None


def parse_hhmmss_ms_to_ms(raw: str) -> Optional[int]:
    value = (raw or "").strip()
    if not value:
        return None
    m = re.fullmatch(r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?", value)
    if not m:
        return None
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    millis = int((m.group(4) or "0").ljust(3, "0"))
    return ((hours * 3600 + minutes * 60 + seconds) * 1000) + millis


def format_mmss_from_ms(value_ms: int) -> str:
    total_sec = max(0, int(value_ms // 1000))
    minutes = total_sec // 60
    seconds = total_sec % 60
    return f"{minutes:02d}:{seconds:02d}"


def coerce_seconds_or_ms(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        parsed = parse_mmss_to_ms(value)
        if parsed is not None:
            return parsed
        try:
            value = float(value)
        except ValueError:
            return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric < 0:
            return None
        if isinstance(value, float):
            return int(numeric * 1000.0)
        if numeric >= 1000:
            return int(numeric)
        return int(numeric * 1000.0)
    return None


def ensure_uuid_or_none(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except Exception:
        return None


def roi_dict(box: Optional["Roi"]) -> Optional[Dict[str, int]]:
    if not box:
        return None
    return {"x": box.x, "y": box.y, "w": box.w, "h": box.h}


def parse_roi(value: Any) -> Optional["Roi"]:
    if value is None:
        return None
    try:
        if isinstance(value, Roi):
            return value
        if isinstance(value, RoiBox):
            return Roi(x=value.x, y=value.y, w=value.w, h=value.h)
        if isinstance(value, dict):
            return Roi(
                x=max(0, int(value.get("x", 0))),
                y=max(0, int(value.get("y", 0))),
                w=max(1, int(value.get("w", 1))),
                h=max(1, int(value.get("h", 1))),
            )
    except Exception:
        return None
    return None


def _cleanup_text(value: Any) -> str:
    text_value = str(value or "").strip()
    return re.sub(r"\s+", " ", text_value).strip()


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


@dataclass(frozen=True)
class Roi:
    x: int
    y: int
    w: int
    h: int


@dataclass
class AudioRecordBlob:
    record_id: int
    start_ts_ms: int
    end_ts_ms: int
    pcm_bytes: bytes


@dataclass(frozen=True)
class TranscriptSeg:
    seg_id: str
    speaker: str
    offset: str
    start_ts_ms: int
    end_ts_ms: Optional[int]
    text: str
    confidence: float
    record_id: int


@dataclass(frozen=True)
class CapturedFrameMeta:
    frame_id: str
    ts_ms: int
    roi: Roi
    checksum: str
    uri: str
    diff_score: Dict[str, float]


@dataclass
class AudioRecorderState:
    record_id: int = 1
    record_start_ts_ms: int = 0
    pcm_buffer: bytearray = field(default_factory=bytearray)
    processed_records: Set[int] = field(default_factory=set)
    inflight_records: Set[int] = field(default_factory=set)


@dataclass
class VideoDetectorState:
    last_sample_ts_ms: int = 0
    ref_hash: Optional[int] = None
    ref_small_bytes: Optional[bytes] = None
    candidate_count: int = 0
    last_confirm_ts_ms: int = 0


@dataclass
class WindowMeta:
    window_id: str
    start_ts_ms: int
    end_ts_ms: int
    revision: int = 0
    segment_ids: Set[str] = field(default_factory=set)
    frame_ids: Set[str] = field(default_factory=set)


@dataclass
class PendingToolCall:
    proposal_id: str
    query_id: str
    query_text: str
    scope: Dict[str, Any]
    created_ts_ms: int


@dataclass
class SessionRealtimeAV:
    session_id: str
    meeting_id: str
    started_ts_ms: int
    meeting_type: str = "project_meeting"
    session_kind: str = "meeting"
    paused: bool = False
    audio: AudioRecorderState = field(default_factory=AudioRecorderState)
    video: VideoDetectorState = field(default_factory=VideoDetectorState)
    roi: Optional[Roi] = None
    next_window_start_ts_ms: int = 0
    next_transcript_index: int = 1
    transcript_segments: Dict[str, TranscriptSeg] = field(default_factory=dict)
    captured_frames: Dict[str, CapturedFrameMeta] = field(default_factory=dict)
    windows: Dict[str, WindowMeta] = field(default_factory=dict)
    pending_tool_calls: Dict[str, PendingToolCall] = field(default_factory=dict)


class RealtimeAVService:
    def __init__(self) -> None:
        self._sessions: Dict[str, SessionRealtimeAV] = {}
        self._lock = threading.Lock()
        self._schema_lock = threading.Lock()
        self._schema_ensured = False
        self.record_ms = max(1000, int(getattr(settings, "realtime_av_record_ms", 30_000)))
        self.window_ms = max(10_000, int(getattr(settings, "realtime_av_window_ms", 120_000)))
        self.window_overlap_ms = max(0, int(getattr(settings, "realtime_av_window_overlap_ms", 15_000)))
        self.window_stride_ms = max(1_000, self.window_ms - self.window_overlap_ms)
        self.video_sample_ms = max(200, int(getattr(settings, "realtime_av_video_sample_ms", 1_000)))
        self.dhash_threshold = max(1, int(getattr(settings, "realtime_av_dhash_threshold", 16)))
        self.candidate_ticks = max(1, int(getattr(settings, "realtime_av_candidate_ticks", 2)))
        self.ssim_threshold = float(getattr(settings, "realtime_av_ssim_threshold", 0.90))
        self.cooldown_ms = max(0, int(getattr(settings, "realtime_av_cooldown_ms", 2_000)))
        self.capture_width = max(160, int(getattr(settings, "realtime_av_capture_width", 960)))
        self.capture_height = max(90, int(getattr(settings, "realtime_av_capture_height", 540)))
        self.detect_width = max(64, int(getattr(settings, "realtime_av_detection_width", 320)))
        self.detect_height = max(36, int(getattr(settings, "realtime_av_detection_height", 180)))

    def _ensure_realtime_schema(self) -> None:
        if self._schema_ensured:
            return
        with self._schema_lock:
            if self._schema_ensured:
                return
            db = SessionLocal()
            try:
                statements = [
                    """
                    CREATE TABLE IF NOT EXISTS session_roi (
                        session_id TEXT PRIMARY KEY,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        x INT NOT NULL,
                        y INT NOT NULL,
                        w INT NOT NULL,
                        h INT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_session_roi_meeting ON session_roi(meeting_id);",
                    """
                    CREATE TABLE IF NOT EXISTS audio_record (
                        id UUID PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        record_id BIGINT NOT NULL,
                        start_ts_ms BIGINT NOT NULL,
                        end_ts_ms BIGINT NOT NULL,
                        uri TEXT,
                        format TEXT DEFAULT 'wav_pcm_s16le_16k_mono',
                        checksum TEXT,
                        status TEXT DEFAULT 'ready',
                        asr_payload JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(session_id, record_id)
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_audio_record_session ON audio_record(session_id, record_id);",
                    "CREATE INDEX IF NOT EXISTS idx_audio_record_meeting ON audio_record(meeting_id, start_ts_ms);",
                    """
                    CREATE TABLE IF NOT EXISTS transcript_segment (
                        seg_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        record_id BIGINT,
                        speaker TEXT NOT NULL DEFAULT 'SPEAKER_01',
                        "offset" TEXT,
                        start_ts_ms BIGINT NOT NULL,
                        end_ts_ms BIGINT,
                        text TEXT NOT NULL,
                        confidence FLOAT DEFAULT 1.0,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_transcript_segment_session_time ON transcript_segment(session_id, start_ts_ms);",
                    "CREATE INDEX IF NOT EXISTS idx_transcript_segment_meeting_time ON transcript_segment(meeting_id, start_ts_ms);",
                    "CREATE INDEX IF NOT EXISTS idx_transcript_segment_record ON transcript_segment(session_id, record_id);",
                    """
                    CREATE TABLE IF NOT EXISTS captured_frame (
                        frame_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        ts_ms BIGINT NOT NULL,
                        roi JSONB NOT NULL,
                        checksum TEXT,
                        uri TEXT NOT NULL,
                        diff_score JSONB,
                        capture_reason TEXT DEFAULT 'change_confirmed',
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_captured_frame_session_time ON captured_frame(session_id, ts_ms);",
                    "CREATE INDEX IF NOT EXISTS idx_captured_frame_meeting_time ON captured_frame(meeting_id, ts_ms);",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_captured_frame_session_checksum ON captured_frame(session_id, checksum) WHERE checksum IS NOT NULL;",
                    """
                    CREATE TABLE IF NOT EXISTS recap_window (
                        id UUID PRIMARY KEY,
                        window_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        start_ts_ms BIGINT NOT NULL,
                        end_ts_ms BIGINT NOT NULL,
                        revision INT NOT NULL DEFAULT 1,
                        recap JSONB NOT NULL DEFAULT '[]'::jsonb,
                        topics JSONB NOT NULL DEFAULT '[]'::jsonb,
                        cheatsheet JSONB NOT NULL DEFAULT '[]'::jsonb,
                        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
                        status TEXT DEFAULT 'ready',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(window_id, revision)
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_recap_window_session_time ON recap_window(session_id, start_ts_ms);",
                    "CREATE INDEX IF NOT EXISTS idx_recap_window_meeting_time ON recap_window(meeting_id, start_ts_ms);",
                    """
                    CREATE TABLE IF NOT EXISTS tool_call_proposal (
                        proposal_id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        query_id TEXT,
                        reason TEXT,
                        suggested_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
                        risk TEXT,
                        approved BOOLEAN,
                        constraints JSONB,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_tool_call_proposal_session ON tool_call_proposal(session_id, created_at DESC);",
                    """
                    CREATE TABLE IF NOT EXISTS qna_event_log (
                        id UUID PRIMARY KEY,
                        query_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
                        question TEXT NOT NULL,
                        answer TEXT,
                        tier_used TEXT,
                        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_qna_event_log_session ON qna_event_log(session_id, created_at DESC);",
                    "CREATE INDEX IF NOT EXISTS idx_qna_event_log_meeting ON qna_event_log(meeting_id, created_at DESC);",
                ]
                for stmt in statements:
                    db.execute(text(stmt))
                db.commit()
                self._schema_ensured = True
            except Exception:
                db.rollback()
                logger.warning("realtime_av_schema_ensure_failed", exc_info=True)
            finally:
                db.close()

    @staticmethod
    def _decode_json_value(value: Any) -> Any:
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return value
        return value

    def _load_window_segments_from_db(
        self,
        session_id: str,
        start_ts_ms: int,
        end_ts_ms: int,
    ) -> Optional[List[TranscriptSeg]]:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            rows = db.execute(
                text(
                    """
                    SELECT seg_id, speaker, "offset", start_ts_ms, end_ts_ms, text, confidence, record_id
                    FROM transcript_segment
                    WHERE session_id = :session_id
                      AND start_ts_ms BETWEEN :start_ts_ms AND :end_ts_ms
                    ORDER BY start_ts_ms ASC, seg_id ASC
                    """
                ),
                {
                    "session_id": session_id,
                    "start_ts_ms": int(start_ts_ms),
                    "end_ts_ms": int(end_ts_ms),
                },
            ).fetchall()
        except Exception:
            db.rollback()
            logger.debug("realtime_av_window_segments_db_load_failed session_id=%s", session_id, exc_info=True)
            return None
        finally:
            db.close()

        segments: List[TranscriptSeg] = []
        for row in rows:
            try:
                start_value = int(row[3])
            except (TypeError, ValueError):
                continue
            try:
                end_value = int(row[4]) if row[4] is not None else None
            except (TypeError, ValueError):
                end_value = None
            try:
                record_id = int(row[7]) if row[7] is not None else 0
            except (TypeError, ValueError):
                record_id = 0
            try:
                confidence = float(row[6]) if row[6] is not None else 1.0
            except (TypeError, ValueError):
                confidence = 1.0
            text_value = _cleanup_text(row[5])
            if not text_value:
                continue
            segments.append(
                TranscriptSeg(
                    seg_id=str(row[0]),
                    speaker=_cleanup_text(row[1] or "SPEAKER_01") or "SPEAKER_01",
                    offset=_cleanup_text(row[2] or format_mmss_from_ms(max(0, start_value - start_ts_ms))),
                    start_ts_ms=start_value,
                    end_ts_ms=end_value,
                    text=text_value,
                    confidence=max(0.0, min(confidence, 1.0)),
                    record_id=record_id,
                )
            )
        return segments

    def _load_window_frames_from_db(
        self,
        session_id: str,
        start_ts_ms: int,
        end_ts_ms: int,
    ) -> Optional[List[CapturedFrameMeta]]:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            rows = db.execute(
                text(
                    """
                    SELECT frame_id, ts_ms, roi, checksum, uri, diff_score
                    FROM captured_frame
                    WHERE session_id = :session_id
                      AND ts_ms BETWEEN :start_ts_ms AND :end_ts_ms
                    ORDER BY ts_ms ASC, frame_id ASC
                    """
                ),
                {
                    "session_id": session_id,
                    "start_ts_ms": int(start_ts_ms),
                    "end_ts_ms": int(end_ts_ms),
                },
            ).fetchall()
        except Exception:
            db.rollback()
            logger.debug("realtime_av_window_frames_db_load_failed session_id=%s", session_id, exc_info=True)
            return None
        finally:
            db.close()

        frames: List[CapturedFrameMeta] = []
        for row in rows:
            try:
                ts_value = int(row[1])
            except (TypeError, ValueError):
                continue
            roi_value = parse_roi(self._decode_json_value(row[2])) or Roi(x=0, y=0, w=1, h=1)
            diff_score_raw = self._decode_json_value(row[5])
            diff_score: Dict[str, float] = {}
            if isinstance(diff_score_raw, dict):
                for key in ("hash_dist", "ssim"):
                    if key in diff_score_raw:
                        diff_score[key] = _coerce_float(diff_score_raw.get(key), 0.0)
            frames.append(
                CapturedFrameMeta(
                    frame_id=str(row[0]),
                    ts_ms=ts_value,
                    roi=roi_value,
                    checksum=_cleanup_text(row[3]),
                    uri=str(row[4] or ""),
                    diff_score=diff_score,
                )
            )
        return frames

    def _load_topic_context_from_db(self, session_id: str, start_ts_ms: int) -> Optional[Dict[str, Any]]:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT topics
                    FROM recap_window
                    WHERE session_id = :session_id
                      AND start_ts_ms < :start_ts_ms
                    ORDER BY start_ts_ms DESC, revision DESC
                    LIMIT 1
                    """
                ),
                {
                    "session_id": session_id,
                    "start_ts_ms": int(start_ts_ms),
                },
            ).fetchone()
        except Exception:
            db.rollback()
            logger.debug("realtime_av_topic_context_db_load_failed session_id=%s", session_id, exc_info=True)
            return None
        finally:
            db.close()

        if not row:
            return None
        topics = self._decode_json_value(row[0])
        if not isinstance(topics, list):
            return None
        for item in topics:
            if not isinstance(item, dict):
                continue
            topic_id = _cleanup_text(item.get("topic_id") or "")
            if not topic_id:
                continue
            title = _cleanup_text(item.get("title") or topic_id) or topic_id
            start_t = _coerce_float(item.get("start_t"), 0.0)
            end_t = _coerce_float(item.get("end_t"), start_t)
            if end_t < start_t:
                end_t = start_t
            return {
                "topic_id": topic_id,
                "title": title,
                "start_t": start_t,
                "end_t": end_t,
            }
        return None

    @staticmethod
    def _meeting_type_to_session_kind(meeting_type: str) -> str:
        value = _cleanup_text(meeting_type).lower()
        if value in {"study_session", "course", "learning", "lesson", "class"}:
            return "course"
        return "meeting"

    def _load_meeting_type(self, meeting_id: str) -> Optional[str]:
        meeting_uuid = ensure_uuid_or_none(meeting_id)
        if not meeting_uuid:
            return None
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT meeting_type
                    FROM meeting
                    WHERE id = :meeting_id
                    LIMIT 1
                    """
                ),
                {"meeting_id": meeting_uuid},
            ).fetchone()
            if not row:
                return None
            return _cleanup_text(row[0]) or None
        except Exception:
            db.rollback()
            logger.debug("realtime_av_load_meeting_type_failed meeting_id=%s", meeting_uuid, exc_info=True)
            return None
        finally:
            db.close()

    def ensure_session(self, session_id: str, meeting_id: Optional[str] = None) -> SessionRealtimeAV:
        created = False
        should_refresh_meeting = False
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                started = now_ms()
                sess = SessionRealtimeAV(
                    session_id=session_id,
                    meeting_id=meeting_id or session_id,
                    started_ts_ms=started,
                )
                sess.audio.record_start_ts_ms = started
                sess.next_window_start_ts_ms = started
                self._sessions[session_id] = sess
                created = True
                should_refresh_meeting = bool(sess.meeting_id)
            elif meeting_id:
                if sess.meeting_id != meeting_id:
                    should_refresh_meeting = True
                sess.meeting_id = meeting_id

        if should_refresh_meeting:
            meeting_type = self._load_meeting_type(sess.meeting_id)
            if meeting_type:
                with self._lock:
                    sess.meeting_type = meeting_type
                    sess.session_kind = self._meeting_type_to_session_kind(meeting_type)
        if created:
            logger.info(
                "realtime_av_session_created session_id=%s meeting_id=%s meeting_type=%s session_kind=%s",
                session_id,
                sess.meeting_id,
                sess.meeting_type,
                sess.session_kind,
            )
        return sess

    def get_snapshot(self, session_id: str) -> Optional[SessionSnapshot]:
        with self._lock:
            sess = self._sessions.get(session_id)
            if not sess:
                return None
            roi = RoiBox(**roi_dict(sess.roi)) if sess.roi else None
            return SessionSnapshot(
                session_id=sess.session_id,
                meeting_id=sess.meeting_id,
                started_ts_ms=sess.started_ts_ms,
                paused=sess.paused,
                current_record_id=sess.audio.record_id,
                next_window_start_ts_ms=sess.next_window_start_ts_ms,
                transcript_segments=len(sess.transcript_segments),
                captured_frames=len(sess.captured_frames),
                emitted_windows=len(sess.windows),
                pending_tool_calls=len(sess.pending_tool_calls),
                roi=roi,
            )

    async def handle_session_control(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        action = str(payload.get("action") or "").strip().lower()
        if action not in {"start", "pause", "stop"}:
            raise ValueError("session_control.action must be start/pause/stop")

        meeting_id = str(payload.get("meeting_id") or session_id)
        sess = self.ensure_session(session_id, meeting_id=meeting_id)
        roi = parse_roi(payload.get("roi"))
        flush_record: Optional[AudioRecordBlob] = None
        with self._lock:
            if action == "start":
                sess.paused = False
                if roi:
                    self._set_roi_locked(sess, roi)
            elif action == "pause":
                sess.paused = True
            elif action == "stop":
                sess.paused = True
                flush_record = self._finalize_current_record_locked(sess, now_ms(), force=True)

        await session_bus.publish(
            session_id,
            {
                "event": "session_control_ack",
                "payload": {
                    "session_id": session_id,
                    "action": action,
                    "meeting_id": sess.meeting_id,
                    "roi": roi_dict(sess.roi),
                },
            },
        )

        if flush_record is not None:
            asyncio.create_task(self._process_audio_record(session_id, flush_record))

        if action == "stop":
            await self._emit_due_windows(session_id, force=True)

        return {
            "session_id": session_id,
            "action": action,
            "meeting_id": sess.meeting_id,
            "roi": roi_dict(sess.roi),
        }

    async def set_roi(self, session_id: str, roi: Roi) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        with self._lock:
            self._set_roi_locked(sess, roi)
        await self._persist_session_roi(sess)
        await session_bus.publish(
            session_id,
            {
                "event": "roi_updated",
                "payload": {
                    "session_id": session_id,
                    "roi": roi_dict(roi),
                },
            },
        )
        return {"session_id": session_id, "roi": roi_dict(roi)}

    async def flush_session(self, session_id: str) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        with self._lock:
            record = self._finalize_current_record_locked(sess, now_ms(), force=True)
        if record is not None:
            asyncio.create_task(self._process_audio_record(session_id, record))
        await self._emit_due_windows(session_id, force=True)
        return {"session_id": session_id, "flushed": True}

    async def handle_audio_chunk(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        if sess.paused:
            return {"accepted": False, "reason": "session_paused"}

        raw_b64 = payload.get("payload")
        if not isinstance(raw_b64, str) or not raw_b64.strip():
            raise ValueError("audio_chunk.payload must be non-empty base64")
        b64_value = normalize_b64_payload(raw_b64)
        try:
            chunk_bytes = base64.b64decode(b64_value, validate=False)
        except Exception as exc:
            raise ValueError(f"invalid audio_chunk.payload base64: {exc}") from exc
        return await self.handle_audio_chunk_bytes(session_id, chunk_bytes)

    async def handle_audio_chunk_bytes(self, session_id: str, chunk_bytes: bytes) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        if sess.paused:
            return {"accepted": False, "reason": "session_paused"}
        if not chunk_bytes:
            raise ValueError("audio chunk bytes are empty")

        ts_current = now_ms()
        finalized_records: List[AudioRecordBlob] = []
        with self._lock:
            sess.audio.pcm_buffer.extend(chunk_bytes)
            due = self._rotate_records_if_due_locked(sess, ts_current)
            finalized_records.extend(due)

        for record in finalized_records:
            asyncio.create_task(self._process_audio_record(session_id, record))

        await self._emit_due_windows(session_id, force=False)

        return {
            "accepted": True,
            "bytes": len(chunk_bytes),
            "record_id": sess.audio.record_id,
            "pending_records": len(finalized_records),
        }

    async def handle_video_frame(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if Image is None:
            raise RuntimeError("Pillow is required for video_frame_meta handling")
        sess = self.ensure_session(session_id)
        if sess.paused:
            return {"accepted": False, "reason": "session_paused"}

        frame_id = str(payload.get("frame_id") or f"{session_id}-frame-{now_ms()}")
        image_b64 = payload.get("image_b64")
        if not isinstance(image_b64, str) or not image_b64.strip():
            raise ValueError("video_frame_meta.image_b64 is required in MVP mode")

        try:
            image_bytes = base64.b64decode(normalize_b64_payload(image_b64), validate=False)
            raw_image = Image.open(io.BytesIO(image_bytes))
            raw_image.load()
            raw_image = raw_image.convert("RGB")
        except (UnidentifiedImageError, ValueError, OSError) as exc:
            raise ValueError(f"cannot decode video frame: {exc}") from exc

        ts_current = now_ms()
        incoming_roi = parse_roi(payload.get("roi"))
        with self._lock:
            if incoming_roi:
                self._set_roi_locked(sess, incoming_roi)
            roi = self._effective_roi_locked(sess, raw_image.size[0], raw_image.size[1])
            if ts_current - sess.video.last_sample_ts_ms < self.video_sample_ms:
                return {"accepted": True, "sampled": False}
            sess.video.last_sample_ts_ms = ts_current

        cropped = self._crop_roi(raw_image, roi)
        detect_frame = self._build_detection_frame(cropped)
        curr_hash = self._dhash64(detect_frame)

        confirm_change = False
        hash_dist = 0
        ssim_value = 1.0
        with self._lock:
            if sess.video.ref_hash is None or sess.video.ref_small_bytes is None:
                sess.video.ref_hash = curr_hash
                sess.video.ref_small_bytes = detect_frame.tobytes()
                sess.video.candidate_count = 0
                return {"accepted": True, "sampled": True, "initialized": True}

            hash_dist = self._hamming_distance(curr_hash, sess.video.ref_hash)
            in_cooldown = (ts_current - sess.video.last_confirm_ts_ms) < self.cooldown_ms
            if hash_dist > self.dhash_threshold and not in_cooldown:
                sess.video.candidate_count += 1
            else:
                sess.video.candidate_count = 0

            if sess.video.candidate_count >= self.candidate_ticks:
                ref_image = self._bytes_to_gray_image(
                    sess.video.ref_small_bytes,
                    self.detect_width,
                    self.detect_height,
                )
                ssim_value = self._ssim(ref_image, detect_frame)
                if ssim_value < self.ssim_threshold:
                    confirm_change = True
                    sess.video.last_confirm_ts_ms = ts_current
                    sess.video.ref_hash = curr_hash
                    sess.video.ref_small_bytes = detect_frame.tobytes()
                sess.video.candidate_count = 0

        if not confirm_change:
            return {
                "accepted": True,
                "sampled": True,
                "candidate": hash_dist > self.dhash_threshold,
                "hash_dist": hash_dist,
                "ssim": ssim_value,
            }

        confidence = max(
            0.0,
            min(1.0, ((float(hash_dist) / 32.0) + max(0.0, 1.0 - ssim_value)) / 2.0),
        )
        diff_score = {"hash_dist": float(hash_dist), "ssim": float(ssim_value)}
        await session_bus.publish(
            session_id,
            {
                "event": "slide_change_event",
                "payload": {
                    "ts_ms": ts_current,
                    "frame_id": frame_id,
                    "confidence": confidence,
                    "diff_score": diff_score,
                    "roi": roi_dict(roi),
                },
            },
        )

        capture = await self._capture_frame(session_id, sess, frame_id, ts_current, cropped, roi, diff_score)
        await session_bus.publish(
            session_id,
            {
                "event": "captured_frame_ready",
                "payload": {
                    "ts_ms": capture.ts_ms,
                    "frame_id": capture.frame_id,
                    "uri": capture.uri,
                    "roi": roi_dict(capture.roi),
                    "reason": "change_confirmed",
                },
            },
        )

        await self._emit_due_windows(session_id, force=False)
        await self._emit_revisions_for_late_data(session_id, segment_ids=set(), frame_ids={capture.frame_id})

        return {
            "accepted": True,
            "sampled": True,
            "confirmed": True,
            "frame_id": frame_id,
            "uri": capture.uri,
        }

    async def handle_user_query(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        query = _cleanup_text(payload.get("text"))
        if not query:
            raise ValueError("user_query.text is required")

        query_id = str(payload.get("query_id") or uuid.uuid4())
        scope = payload.get("scope") or {}
        if not isinstance(scope, dict):
            scope = {}
        allow_web = bool(scope.get("web_allowed", False))

        tier0_hits, transcript_window = self._search_tier0(sess, query)
        tier1_hits = self._search_tier1(sess, query)
        citations = list(tier0_hits) + list(tier1_hits)

        if not citations and not allow_web:
            proposal_id = str(uuid.uuid4())
            with self._lock:
                sess.pending_tool_calls[proposal_id] = PendingToolCall(
                    proposal_id=proposal_id,
                    query_id=query_id,
                    query_text=query,
                    scope=scope,
                    created_ts_ms=now_ms(),
                )
            await self._persist_tool_call_proposal(sess, proposal_id, query_id, query)
            await session_bus.publish(
                session_id,
                {
                    "event": "tool_call_proposal",
                    "payload": {
                        "proposal_id": proposal_id,
                        "reason": "No enough in-session evidence. Tier-2 web search requires approval.",
                        "suggested_queries": [query],
                        "risk": "medium",
                    },
                },
            )
            return {"query_id": query_id, "status": "proposal_emitted", "proposal_id": proposal_id}

        tier_used = "tier0_session"
        rag_docs = []
        if tier1_hits:
            tier_used = "tier1_docs"
            rag_docs = tier1_hits
        if allow_web and not citations:
            web_hits = [{"source": "web", "snippet": item} for item in web_search(query)]
            citations.extend(web_hits)
            tier_used = "tier2_web"
            rag_docs = web_hits

        qa = answer_question(query, rag_docs=rag_docs, transcript_window=transcript_window)
        answer_text = _cleanup_text(qa.get("answer"))
        if not answer_text:
            answer_text = "I could not produce an answer with the available evidence."

        await self._persist_qna_event(sess, query_id, query, answer_text, tier_used, citations)
        await session_bus.publish(
            session_id,
            {
                "event": "qna_answer",
                "payload": {
                    "query_id": query_id,
                    "answer": answer_text,
                    "citations": citations,
                    "tier_used": tier_used,
                },
            },
        )
        return {"query_id": query_id, "status": "answered", "tier_used": tier_used}

    async def handle_tool_approval(self, session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        sess = self.ensure_session(session_id)
        proposal_id = str(payload.get("proposal_id") or "").strip()
        if not proposal_id:
            raise ValueError("approve_tool_call.proposal_id is required")
        approved = bool(payload.get("approved", False))
        constraints = payload.get("constraints") or {}
        if not isinstance(constraints, dict):
            constraints = {}

        with self._lock:
            proposal = sess.pending_tool_calls.pop(proposal_id, None)
        if proposal is None:
            raise ValueError("proposal_id not found")

        await self._update_tool_call_proposal(sess, proposal_id, approved, constraints)
        if not approved:
            answer_text = "Web search was not approved. Answer remains constrained to session evidence."
            await self._persist_qna_event(
                sess,
                proposal.query_id,
                proposal.query_text,
                answer_text,
                "blocked",
                [],
            )
            await session_bus.publish(
                session_id,
                {
                    "event": "qna_answer",
                    "payload": {
                        "query_id": proposal.query_id,
                        "answer": answer_text,
                        "citations": [],
                        "tier_used": "blocked",
                    },
                },
            )
            return {"proposal_id": proposal_id, "status": "rejected"}

        web_results = web_search(proposal.query_text)
        citations = [{"source": "web", "snippet": item} for item in web_results]
        answer_text = (
            "Web tier executed after approval. "
            + ("; ".join(web_results[:3]) if web_results else "No external result.")
        ).strip()
        await self._persist_qna_event(
            sess,
            proposal.query_id,
            proposal.query_text,
            answer_text,
            "tier2_web",
            citations,
        )
        await session_bus.publish(
            session_id,
            {
                "event": "qna_answer",
                "payload": {
                    "query_id": proposal.query_id,
                    "answer": answer_text,
                    "citations": citations,
                    "tier_used": "tier2_web",
                },
            },
        )
        return {"proposal_id": proposal_id, "status": "approved_executed"}

    def _set_roi_locked(self, sess: SessionRealtimeAV, roi: Roi) -> None:
        if sess.roi != roi:
            sess.roi = roi
            sess.video.ref_hash = None
            sess.video.ref_small_bytes = None
            sess.video.candidate_count = 0

    def _effective_roi_locked(self, sess: SessionRealtimeAV, img_w: int, img_h: int) -> Roi:
        if sess.roi is None:
            return Roi(x=0, y=0, w=img_w, h=img_h)
        x = min(max(0, sess.roi.x), max(0, img_w - 1))
        y = min(max(0, sess.roi.y), max(0, img_h - 1))
        w = min(max(1, sess.roi.w), max(1, img_w - x))
        h = min(max(1, sess.roi.h), max(1, img_h - y))
        return Roi(x=x, y=y, w=w, h=h)

    def _rotate_records_if_due_locked(self, sess: SessionRealtimeAV, ts_current: int) -> List[AudioRecordBlob]:
        finalized: List[AudioRecordBlob] = []
        if sess.audio.record_start_ts_ms <= 0:
            sess.audio.record_start_ts_ms = ts_current

        while (ts_current - sess.audio.record_start_ts_ms) >= self.record_ms:
            record = self._finalize_current_record_locked(sess, sess.audio.record_start_ts_ms + self.record_ms, force=False)
            if record is None:
                break
            finalized.append(record)

        return finalized

    def _finalize_current_record_locked(self, sess: SessionRealtimeAV, end_ts_ms: int, force: bool) -> Optional[AudioRecordBlob]:
        start_ts = int(sess.audio.record_start_ts_ms or end_ts_ms)
        if end_ts_ms <= start_ts:
            end_ts_ms = start_ts + 1
        pcm_bytes = bytes(sess.audio.pcm_buffer)
        if not pcm_bytes and not force:
            return None

        record = AudioRecordBlob(
            record_id=sess.audio.record_id,
            start_ts_ms=start_ts,
            end_ts_ms=int(end_ts_ms),
            pcm_bytes=pcm_bytes,
        )
        sess.audio.record_id += 1
        sess.audio.record_start_ts_ms = int(end_ts_ms)
        sess.audio.pcm_buffer = bytearray()
        return record

    async def _process_audio_record(self, session_id: str, record: AudioRecordBlob) -> None:
        sess = self.ensure_session(session_id)
        temp_wav: Optional[Path] = None
        with self._lock:
            if record.record_id in sess.audio.processed_records or record.record_id in sess.audio.inflight_records:
                return
            sess.audio.inflight_records.add(record.record_id)
        try:
            meeting_uuid = ensure_uuid_or_none(sess.meeting_id)
            asr_payload, temp_wav = await self._run_batch_asr(record, session_id)
            asr_error = _cleanup_text(asr_payload.get("error"))
            segments = self._normalize_asr_segments(session_id, record, asr_payload)

            fallback_text = self._extract_asr_text(asr_payload if isinstance(asr_payload, dict) else {})
            if not segments and fallback_text:
                segments = [
                    TranscriptSeg(
                        seg_id=f"{session_id}:r{record.record_id}:s000",
                        speaker="SPEAKER_01",
                        offset="00:00",
                        start_ts_ms=record.start_ts_ms,
                        end_ts_ms=record.end_ts_ms,
                        text=fallback_text,
                        confidence=1.0,
                        record_id=record.record_id,
                    )
                ]

            if segments:
                with self._lock:
                    for seg in segments:
                        sess.transcript_segments[seg.seg_id] = seg
                await self._persist_transcript_segments(sess, segments, meeting_uuid)
                await self._emit_revisions_for_late_data(session_id, segment_ids={s.seg_id for s in segments}, frame_ids=set())

            record_uri = await self._persist_audio_record_metadata(
                sess=sess,
                record=record,
                meeting_uuid=meeting_uuid,
                asr_payload=asr_payload if isinstance(asr_payload, dict) else {},
                asr_error=asr_error or None,
            )

            payload_segments = [
                {
                    "seg_id": seg.seg_id,
                    "speaker": seg.speaker,
                    "offset": seg.offset,
                    "start_ts_ms": seg.start_ts_ms,
                    "end_ts_ms": seg.end_ts_ms,
                    "text": seg.text,
                    "confidence": seg.confidence,
                }
                for seg in segments
            ]

            await session_bus.publish(
                session_id,
                {
                    "event": "transcript_record_ready",
                    "payload": {
                        "record_id": record.record_id,
                        "record_start_ts_ms": record.start_ts_ms,
                        "record_end_ts_ms": record.end_ts_ms,
                        "uri": record_uri,
                        "segments": payload_segments,
                        "asr_error": asr_error or None,
                    },
                },
            )
            if asr_error:
                await session_bus.publish(
                    session_id,
                    {
                        "event": "error",
                        "payload": {
                            "code": "batch_asr_failed",
                            "message": asr_error,
                            "record_id": record.record_id,
                        },
                    },
                )
            await self._emit_due_windows(session_id, force=False)
            with self._lock:
                sess.audio.processed_records.add(record.record_id)
        except Exception as exc:
            logger.exception("realtime_av_audio_record_failed session_id=%s record_id=%s", session_id, record.record_id)
            await session_bus.publish(
                session_id,
                {
                    "event": "error",
                    "payload": {
                        "code": "audio_record_failed",
                        "message": str(exc),
                    },
                },
            )
        finally:
            if temp_wav is not None:
                self._cleanup_temp_audio_file(temp_wav)
            with self._lock:
                sess.audio.inflight_records.discard(record.record_id)

    async def _run_batch_asr(self, record: AudioRecordBlob, session_id: str) -> Tuple[Dict[str, Any], Path]:
        from app.services.asr_service import AsrServiceError, transcribe_audio_file

        tmp_wav = self._write_wav_file(session_id, record.record_id, record.pcm_bytes)
        logger.info(
            "batch_asr_request session_id=%s record_id=%s bytes=%s",
            session_id,
            record.record_id,
            len(record.pcm_bytes),
        )
        try:
            payload = await transcribe_audio_file(tmp_wav)
        except AsrServiceError as exc:
            logger.warning("batch_asr_failed session_id=%s record_id=%s err=%s", session_id, record.record_id, exc)
            payload = {"error": str(exc), "segments": []}
        segments_count = len(self._extract_asr_segments(payload if isinstance(payload, dict) else {}))
        logger.info(
            "batch_asr_response session_id=%s record_id=%s segments=%s has_error=%s",
            session_id,
            record.record_id,
            segments_count,
            bool(isinstance(payload, dict) and payload.get("error")),
        )
        normalized = payload if isinstance(payload, dict) else {"segments": [], "raw": payload}
        return normalized, tmp_wav

    def _write_wav_file(self, session_id: str, record_id: int, pcm_bytes: bytes) -> Path:
        base_dir = Path(__file__).resolve().parents[2] / "uploaded_files" / "realtime_audio" / session_id
        base_dir.mkdir(parents=True, exist_ok=True)
        path = base_dir / f"record_{record_id:06d}.wav"
        with wave.open(str(path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(pcm_bytes)
        return path

    def _cleanup_temp_audio_file(self, wav_path: Path) -> None:
        try:
            if wav_path.exists():
                wav_path.unlink()
        except Exception:
            logger.debug("temp_audio_file_cleanup_failed path=%s", wav_path, exc_info=True)
        try:
            parent = wav_path.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
        except Exception:
            logger.debug("temp_audio_dir_cleanup_failed path=%s", wav_path.parent, exc_info=True)

    async def _persist_audio_record_metadata(
        self,
        sess: SessionRealtimeAV,
        record: AudioRecordBlob,
        meeting_uuid: Optional[str],
        asr_payload: Dict[str, Any],
        asr_error: Optional[str],
    ) -> Optional[str]:
        checksum = hashlib.sha256(record.pcm_bytes).hexdigest() if record.pcm_bytes else None
        format_name = "wav_pcm_s16le_16k_mono"
        status = "processed_temp_deleted" if not asr_error else "processed_temp_deleted_with_error"
        payload_json = "{}"
        try:
            payload_json = json.dumps(asr_payload or {})
        except Exception:
            payload_json = json.dumps(
                {
                    "error": asr_error,
                    "segments_count": len(self._extract_asr_segments(asr_payload if isinstance(asr_payload, dict) else {})),
                    "persisted_at": datetime.utcnow().isoformat(),
                }
            )

        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO audio_record (
                        id, session_id, meeting_id, record_id, start_ts_ms, end_ts_ms, uri,
                        format, checksum, status, asr_payload, created_at
                    )
                    VALUES (
                        :id, :session_id, :meeting_id, :record_id, :start_ts_ms, :end_ts_ms, :uri,
                        :format, :checksum, :status, :asr_payload::jsonb, NOW()
                    )
                    ON CONFLICT (session_id, record_id)
                    DO UPDATE SET
                        uri = EXCLUDED.uri,
                        checksum = EXCLUDED.checksum,
                        status = EXCLUDED.status,
                        asr_payload = EXCLUDED.asr_payload
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "session_id": sess.session_id,
                    "meeting_id": meeting_uuid,
                    "record_id": record.record_id,
                    "start_ts_ms": record.start_ts_ms,
                    "end_ts_ms": record.end_ts_ms,
                    "uri": None,
                    "format": format_name,
                    "checksum": checksum,
                    "status": status,
                    "asr_payload": payload_json,
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.debug("audio_record_persist_skipped (table may not exist yet)", exc_info=True)
        finally:
            db.close()
        return None

    def _extract_asr_segments(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        # 1) Generic providers (explicit segments)
        value = payload.get("segments")
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        data = payload.get("data")
        if isinstance(data, dict):
            value = data.get("segments")
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        result = payload.get("result")
        if isinstance(result, dict):
            value = result.get("segments")
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]

        # 2) whisper.cpp JSON shape: transcription[].offsets/timestamps/text
        for container in (payload, data if isinstance(data, dict) else None, result if isinstance(result, dict) else None):
            if not isinstance(container, dict):
                continue
            transcription = container.get("transcription")
            if not isinstance(transcription, list):
                continue
            converted: List[Dict[str, Any]] = []
            for item in transcription:
                if not isinstance(item, dict):
                    continue
                text_value = _cleanup_text(item.get("text"))
                if not text_value:
                    continue
                seg: Dict[str, Any] = {"text": text_value, "speaker": "SPEAKER_01"}
                offsets = item.get("offsets")
                if isinstance(offsets, dict):
                    if offsets.get("from") is not None:
                        seg["start"] = offsets.get("from")
                    if offsets.get("to") is not None:
                        seg["end"] = offsets.get("to")
                timestamps = item.get("timestamps")
                if isinstance(timestamps, dict):
                    if seg.get("start") is None and isinstance(timestamps.get("from"), str):
                        parsed = parse_hhmmss_ms_to_ms(str(timestamps.get("from")))
                        if parsed is not None:
                            seg["start"] = parsed
                    if seg.get("end") is None and isinstance(timestamps.get("to"), str):
                        parsed = parse_hhmmss_ms_to_ms(str(timestamps.get("to")))
                        if parsed is not None:
                            seg["end"] = parsed
                converted.append(seg)
            if converted:
                return converted
        return []

    def _extract_asr_text(self, payload: Dict[str, Any]) -> str:
        for key in ("text", "transcript"):
            value = payload.get(key)
            if isinstance(value, str) and _cleanup_text(value):
                return _cleanup_text(value)

        result = payload.get("result")
        if isinstance(result, str) and _cleanup_text(result):
            return _cleanup_text(result)
        if isinstance(result, dict):
            for key in ("text", "transcript"):
                value = result.get(key)
                if isinstance(value, str) and _cleanup_text(value):
                    return _cleanup_text(value)

        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("text", "transcript", "result"):
                value = data.get(key)
                if isinstance(value, str) and _cleanup_text(value):
                    return _cleanup_text(value)

        return ""

    def _normalize_asr_segments(self, session_id: str, record: AudioRecordBlob, payload: Dict[str, Any]) -> List[TranscriptSeg]:
        raw_segments = self._extract_asr_segments(payload)
        normalized: List[TranscriptSeg] = []
        for idx, seg in enumerate(raw_segments):
            text_value = _cleanup_text(seg.get("text") or seg.get("transcript") or seg.get("sentence"))
            if not text_value:
                continue

            speaker = _cleanup_text(seg.get("speaker") or seg.get("speaker_label") or seg.get("spk") or "SPEAKER_01")
            confidence = seg.get("confidence")
            try:
                confidence_value = float(confidence if confidence is not None else 1.0)
            except (TypeError, ValueError):
                confidence_value = 1.0

            offset_ms = parse_mmss_to_ms(str(seg.get("offset") or ""))
            start_ms_rel = offset_ms
            if start_ms_rel is None:
                start_ms_rel = coerce_seconds_or_ms(
                    seg.get("start")
                    if seg.get("start") is not None
                    else seg.get("start_time")
                    if seg.get("start_time") is not None
                    else seg.get("time_start")
                )
            if start_ms_rel is None:
                start_ms_rel = 0

            end_ms_rel = coerce_seconds_or_ms(
                seg.get("end")
                if seg.get("end") is not None
                else seg.get("end_time")
                if seg.get("end_time") is not None
                else seg.get("time_end")
            )
            start_ts = int(record.start_ts_ms + start_ms_rel)
            end_ts = int(record.start_ts_ms + end_ms_rel) if end_ms_rel is not None else None
            if end_ts is not None and end_ts < start_ts:
                end_ts = start_ts

            offset_text = format_mmss_from_ms(int(start_ms_rel))
            seg_id = f"{session_id}:r{record.record_id}:s{idx:03d}"
            normalized.append(
                TranscriptSeg(
                    seg_id=seg_id,
                    speaker=speaker or "SPEAKER_01",
                    offset=offset_text,
                    start_ts_ms=start_ts,
                    end_ts_ms=end_ts,
                    text=text_value,
                    confidence=max(0.0, min(confidence_value, 1.0)),
                    record_id=record.record_id,
                )
            )
        normalized.sort(key=lambda item: (item.start_ts_ms, item.seg_id))
        return normalized

    async def _persist_transcript_segments(
        self,
        sess: SessionRealtimeAV,
        segments: List[TranscriptSeg],
        meeting_uuid: Optional[str],
    ) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            for seg in segments:
                db.execute(
                    text(
                        """
                        INSERT INTO transcript_segment (
                            seg_id, session_id, meeting_id, record_id, speaker, "offset",
                            start_ts_ms, end_ts_ms, text, confidence, created_at
                        )
                        VALUES (
                            :seg_id, :session_id, :meeting_id, :record_id, :speaker, :offset,
                            :start_ts_ms, :end_ts_ms, :text, :confidence, NOW()
                        )
                        ON CONFLICT (seg_id) DO NOTHING
                        """
                    ),
                    {
                        "seg_id": seg.seg_id,
                        "session_id": sess.session_id,
                        "meeting_id": meeting_uuid,
                        "record_id": seg.record_id,
                        "speaker": seg.speaker,
                        "offset": seg.offset,
                        "start_ts_ms": seg.start_ts_ms,
                        "end_ts_ms": seg.end_ts_ms,
                        "text": seg.text,
                        "confidence": seg.confidence,
                    },
                )

                if meeting_uuid:
                    persist_transcript(
                        db,
                        meeting_uuid,
                        {
                            "seq": sess.next_transcript_index,
                            "speaker": seg.speaker,
                            "text": seg.text,
                            "time_start": max(0.0, (seg.start_ts_ms - sess.started_ts_ms) / 1000.0),
                            "time_end": max(
                                0.0,
                                ((seg.end_ts_ms if seg.end_ts_ms is not None else seg.start_ts_ms) - sess.started_ts_ms)
                                / 1000.0,
                            ),
                            "is_final": True,
                            "lang": "vi",
                            "confidence": seg.confidence,
                        },
                    )
                    sess.next_transcript_index += 1

            db.commit()
        except Exception:
            db.rollback()
            logger.debug("transcript_segment_persist_partial_or_skipped", exc_info=True)
        finally:
            db.close()

    async def _capture_frame(
        self,
        session_id: str,
        sess: SessionRealtimeAV,
        frame_id: str,
        ts_ms: int,
        cropped_image: Any,
        roi: Roi,
        diff_score: Dict[str, float],
    ) -> CapturedFrameMeta:
        if Image is None:
            raise RuntimeError("Pillow is required for frame capture")

        resized = cropped_image.resize((self.capture_width, self.capture_height))
        buf = io.BytesIO()
        format_name = "WEBP"
        try:
            resized.save(buf, format=format_name, quality=85)
        except Exception:
            buf = io.BytesIO()
            format_name = "JPEG"
            resized.save(buf, format=format_name, quality=90)
        image_bytes = buf.getvalue()
        checksum = hashlib.sha256(image_bytes).hexdigest()
        ext = "webp" if format_name == "WEBP" else "jpg"

        uri = f"/files/realtime_captures/{session_id}/{frame_id}.{ext}"
        if is_storage_configured():
            object_key = build_object_key(f"{frame_id}.{ext}", prefix=f"realtime/captures/{session_id}")
            try:
                uploaded_key = upload_bytes_to_storage(
                    image_bytes,
                    object_key,
                    content_type="image/webp" if ext == "webp" else "image/jpeg",
                )
                if uploaded_key:
                    uri = generate_presigned_get_url(uploaded_key, expires_in=86_400) or uri
            except Exception:
                logger.warning("capture_storage_upload_failed session_id=%s frame_id=%s", session_id, frame_id, exc_info=True)
                uri = self._write_local_capture(session_id, frame_id, ext, image_bytes)
        else:
            uri = self._write_local_capture(session_id, frame_id, ext, image_bytes)

        capture_meta = CapturedFrameMeta(
            frame_id=frame_id,
            ts_ms=ts_ms,
            roi=roi,
            checksum=checksum,
            uri=uri,
            diff_score=diff_score,
        )

        with self._lock:
            sess.captured_frames[frame_id] = capture_meta

        await self._persist_captured_frame(sess, capture_meta)
        return capture_meta

    def _write_local_capture(self, session_id: str, frame_id: str, ext: str, image_bytes: bytes) -> str:
        out_dir = Path(__file__).resolve().parents[2] / "uploaded_files" / "realtime_captures" / session_id
        out_dir.mkdir(parents=True, exist_ok=True)
        file_path = out_dir / f"{frame_id}.{ext}"
        file_path.write_bytes(image_bytes)
        return f"/files/realtime_captures/{session_id}/{frame_id}.{ext}"

    async def _persist_session_roi(self, sess: SessionRealtimeAV) -> None:
        if not sess.roi:
            return
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO session_roi (session_id, meeting_id, x, y, w, h, created_at, updated_at)
                    VALUES (:session_id, :meeting_id, :x, :y, :w, :h, NOW(), NOW())
                    ON CONFLICT (session_id)
                    DO UPDATE SET
                        meeting_id = EXCLUDED.meeting_id,
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        w = EXCLUDED.w,
                        h = EXCLUDED.h,
                        updated_at = NOW()
                    """
                ),
                {
                    "session_id": sess.session_id,
                    "meeting_id": ensure_uuid_or_none(sess.meeting_id),
                    "x": sess.roi.x,
                    "y": sess.roi.y,
                    "w": sess.roi.w,
                    "h": sess.roi.h,
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.debug("session_roi_persist_skipped", exc_info=True)
        finally:
            db.close()

    async def _persist_captured_frame(self, sess: SessionRealtimeAV, frame: CapturedFrameMeta) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO captured_frame (
                        frame_id, session_id, meeting_id, ts_ms, roi, checksum, uri, diff_score, capture_reason, created_at
                    )
                    VALUES (
                        :frame_id, :session_id, :meeting_id, :ts_ms, :roi::jsonb, :checksum, :uri, :diff_score::jsonb, 'change_confirmed', NOW()
                    )
                    ON CONFLICT (frame_id) DO NOTHING
                    """
                ),
                {
                    "frame_id": frame.frame_id,
                    "session_id": sess.session_id,
                    "meeting_id": ensure_uuid_or_none(sess.meeting_id),
                    "ts_ms": frame.ts_ms,
                    "roi": json.dumps(roi_dict(frame.roi)),
                    "checksum": frame.checksum,
                    "uri": frame.uri,
                    "diff_score": json.dumps(frame.diff_score),
                },
            )

            meeting_uuid = ensure_uuid_or_none(sess.meeting_id)
            if meeting_uuid:
                db.execute(
                    text(
                        """
                        INSERT INTO visual_event (
                            id, meeting_id, timestamp, image_url, description, event_type, created_at, updated_at
                        )
                        VALUES (
                            :id, :meeting_id, :timestamp, :image_url, :description, :event_type, NOW(), NOW()
                        )
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "meeting_id": meeting_uuid,
                        "timestamp": float((frame.ts_ms - sess.started_ts_ms) / 1000.0),
                        "image_url": frame.uri,
                        "description": "slide/global change confirmed",
                        "event_type": "slide_change",
                    },
                )

            db.commit()
        except Exception:
            db.rollback()
            logger.debug("captured_frame_persist_skipped", exc_info=True)
        finally:
            db.close()

    async def _emit_due_windows(self, session_id: str, force: bool) -> None:
        sess = self.ensure_session(session_id)
        ts_current = now_ms()
        windows_to_emit: List[Tuple[int, int]] = []
        with self._lock:
            limit = ts_current
            if force:
                limit = max(ts_current, sess.audio.record_start_ts_ms)
            while (sess.next_window_start_ts_ms + self.window_ms) <= limit:
                start = sess.next_window_start_ts_ms
                end = start + self.window_ms
                windows_to_emit.append((start, end))
                sess.next_window_start_ts_ms += self.window_stride_ms

        for start, end in windows_to_emit:
            await self._emit_window_payload(session_id, start, end, reason="schedule")

    async def _emit_revisions_for_late_data(self, session_id: str, segment_ids: Set[str], frame_ids: Set[str]) -> None:
        if not segment_ids and not frame_ids:
            return
        sess = self.ensure_session(session_id)
        affected: Set[str] = set()
        with self._lock:
            for window_id, meta in sess.windows.items():
                if segment_ids:
                    for seg_id in segment_ids:
                        seg = sess.transcript_segments.get(seg_id)
                        if seg and meta.start_ts_ms <= seg.start_ts_ms <= meta.end_ts_ms and seg_id not in meta.segment_ids:
                            affected.add(window_id)
                if frame_ids:
                    for frame_id in frame_ids:
                        frame = sess.captured_frames.get(frame_id)
                        if frame and meta.start_ts_ms <= frame.ts_ms <= meta.end_ts_ms and frame_id not in meta.frame_ids:
                            affected.add(window_id)

        for window_id in sorted(affected):
            meta = sess.windows.get(window_id)
            if meta:
                await self._emit_window_payload(session_id, meta.start_ts_ms, meta.end_ts_ms, reason="late_arrival")

    async def _emit_window_payload(self, session_id: str, start_ts_ms: int, end_ts_ms: int, reason: str) -> None:
        sess = self.ensure_session(session_id)
        window_id = f"{session_id}:{start_ts_ms}:{end_ts_ms}"

        db_segments = self._load_window_segments_from_db(session_id, start_ts_ms, end_ts_ms)
        db_frames = self._load_window_frames_from_db(session_id, start_ts_ms, end_ts_ms)
        used_db = db_segments is not None and db_frames is not None

        if used_db:
            segments = db_segments or []
            frames = db_frames or []
        else:
            with self._lock:
                segments = [
                    seg
                    for seg in sess.transcript_segments.values()
                    if start_ts_ms <= seg.start_ts_ms <= end_ts_ms
                ]
                segments.sort(key=lambda item: (item.start_ts_ms, item.seg_id))
                frames = [
                    frame
                    for frame in sess.captured_frames.values()
                    if start_ts_ms <= frame.ts_ms <= end_ts_ms
                ]
                frames.sort(key=lambda item: (item.ts_ms, item.frame_id))

        new_seg_ids = {seg.seg_id for seg in segments}
        new_frame_ids = {frame.frame_id for frame in frames}
        with self._lock:
            prev_meta = sess.windows.get(window_id)
            if prev_meta and prev_meta.segment_ids == new_seg_ids and prev_meta.frame_ids == new_frame_ids:
                return
            revision = (prev_meta.revision + 1) if prev_meta else 1

        topic_context = self._load_topic_context_from_db(session_id, start_ts_ms) or {
            "topic_id": "T0",
            "title": "General",
            "start_t": 0.0,
            "end_t": 0.0,
        }
        payload = self._build_window_payload(
            sess,
            window_id,
            start_ts_ms,
            end_ts_ms,
            revision,
            segments,
            frames,
            topic_context=topic_context,
        )

        with self._lock:
            sess.windows[window_id] = WindowMeta(
                window_id=window_id,
                start_ts_ms=start_ts_ms,
                end_ts_ms=end_ts_ms,
                revision=revision,
                segment_ids={seg.seg_id for seg in segments},
                frame_ids={frame.frame_id for frame in frames},
            )

        await self._persist_window_payload(sess, payload)
        await session_bus.publish(
            session_id,
            {
                "event": "recap_window_ready",
                "payload": payload,
            },
        )
        logger.info(
            "realtime_av_window_emitted session_id=%s window_id=%s revision=%s reason=%s segments=%s frames=%s source=%s",
            session_id,
            window_id,
            revision,
            reason,
            len(segments),
            len(frames),
            "db" if used_db else "memory_fallback",
        )

    def _build_window_payload(
        self,
        sess: SessionRealtimeAV,
        window_id: str,
        start_ts_ms: int,
        end_ts_ms: int,
        revision: int,
        segments: List[TranscriptSeg],
        frames: List[CapturedFrameMeta],
        topic_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        window_start_sec = max(0.0, (start_ts_ms - sess.started_ts_ms) / 1000.0)
        window_end_sec = max(0.0, (end_ts_ms - sess.started_ts_ms) / 1000.0)
        session_kind = "course" if _cleanup_text(sess.session_kind).lower() == "course" else "meeting"
        transcript_excerpt = "\n".join(
            f"{seg.speaker}: {_cleanup_text(seg.text)}"
            for seg in segments
        )

        current_topic_id = _cleanup_text((topic_context or {}).get("topic_id") or "T0") or "T0"
        current_topic_title = _cleanup_text((topic_context or {}).get("title") or current_topic_id or "General")
        if not current_topic_title:
            current_topic_title = "General"
        meta = {
            "current_topic_id": current_topic_id,
            "current_topic": {
                "topic_id": current_topic_id,
                "title": current_topic_title,
                "start_t": _coerce_float((topic_context or {}).get("start_t"), window_start_sec),
                "end_t": _coerce_float((topic_context or {}).get("end_t"), window_end_sec),
            },
            "window_start": window_start_sec,
            "window_end": window_end_sec,
            "session_kind": session_kind,
        }
        summary = summarize_and_classify(transcript_excerpt, meta=meta)

        recap_lines: List[str] = []
        summary_recap_lines = summary.get("recap_lines")
        if isinstance(summary_recap_lines, list):
            for line in summary_recap_lines:
                clean = _cleanup_text(line)
                if clean:
                    recap_lines.append(clean)
        if not recap_lines:
            recap_text = _cleanup_text(summary.get("recap"))
            if recap_text:
                recap_lines = [line.strip(" -") for line in re.split(r"[.\n]+", recap_text) if line.strip(" -")]
        if not recap_lines:
            recap_lines = ["No transcript available for this window."]
        recap_lines = recap_lines[:6]

        base_citations = self._build_citation_bundle(segments, frames)

        topic_payload = summary.get("topic") if isinstance(summary.get("topic"), dict) else {}
        topic_id = _cleanup_text(topic_payload.get("topic_id") or current_topic_id) or "T0"
        topic_title = _cleanup_text(topic_payload.get("title") or current_topic_title or topic_id) or topic_id
        topic_start = _coerce_float(topic_payload.get("start_t"), window_start_sec)
        topic_end = _coerce_float(topic_payload.get("end_t"), window_end_sec)
        topic_start = min(max(topic_start, window_start_sec), window_end_sec)
        topic_end = min(max(topic_end, topic_start), window_end_sec)
        canonical_topic = {
            "new_topic": bool(topic_payload.get("new_topic", False)),
            "topic_id": topic_id,
            "title": topic_title,
            "start_t": topic_start,
            "end_t": topic_end,
        }

        recap_items = [
            {
                "id": f"{window_id}:recap:{idx}",
                "text": line,
                "topic_id": topic_id,
                "topic": topic_title,
                "citations": base_citations[:2] if base_citations else [],
            }
            for idx, line in enumerate(recap_lines)
        ]

        topics: List[Dict[str, Any]] = []
        summary_topics = summary.get("topics") if isinstance(summary.get("topics"), list) else []
        for item in summary_topics:
            if not isinstance(item, dict):
                continue
            t_id = _cleanup_text(item.get("topic_id")) or topic_id
            t_title = _cleanup_text(item.get("title")) or topic_title
            t_desc = _cleanup_text(item.get("description")) or recap_lines[0]
            t_start = _coerce_float(item.get("start_t"), topic_start)
            t_end = _coerce_float(item.get("end_t"), topic_end)
            t_start = min(max(t_start, window_start_sec), window_end_sec)
            t_end = min(max(t_end, t_start), window_end_sec)
            topics.append(
                {
                    "topic_id": t_id,
                    "title": t_title,
                    "description": t_desc,
                    "start_t": t_start,
                    "end_t": t_end,
                    "citations": base_citations[:2] if base_citations else [],
                }
            )
        if not topics:
            topics = [
                {
                    "topic_id": topic_id,
                    "title": topic_title,
                    "description": recap_lines[0] if recap_lines else "Summary topic",
                    "start_t": topic_start,
                    "end_t": topic_end,
                    "citations": base_citations[:2] if base_citations else [],
                }
            ]
        topics = topics[:5]

        cheatsheet: List[Dict[str, Any]] = []
        summary_cheatsheet = summary.get("cheatsheet") if isinstance(summary.get("cheatsheet"), list) else []
        for item in summary_cheatsheet:
            if not isinstance(item, dict):
                continue
            term = _cleanup_text(item.get("term"))
            definition = _cleanup_text(item.get("definition"))
            if not term or not definition:
                continue
            cheatsheet.append(
                {
                    "term": term,
                    "definition": definition,
                    "citations": base_citations[:1] if base_citations else [],
                }
            )
        if not cheatsheet:
            term_candidates = self._extract_terms(segments)
            cheatsheet = [
                {
                    "term": term,
                    "definition": f"Mentioned concept in window {format_mmss_from_ms(max(0, start_ts_ms - sess.started_ts_ms))}-{format_mmss_from_ms(max(0, end_ts_ms - sess.started_ts_ms))}.",
                    "citations": base_citations[:1] if base_citations else [],
                }
                for term in term_candidates[:5]
            ]

        adr_raw = summary.get("adr") if isinstance(summary.get("adr"), dict) else {}
        actions: List[Dict[str, Any]] = []
        decisions: List[Dict[str, Any]] = []
        risks: List[Dict[str, Any]] = []
        for item in adr_raw.get("actions", []) if isinstance(adr_raw.get("actions"), list) else []:
            if not isinstance(item, dict):
                continue
            task = _cleanup_text(item.get("task") or item.get("description"))
            if not task:
                continue
            actions.append(
                {
                    "id": f"{window_id}:a:{len(actions)}",
                    "task": task,
                    "owner": _cleanup_text(item.get("owner")),
                    "due_date": _cleanup_text(item.get("due_date") or item.get("deadline")),
                    "priority": _cleanup_text(item.get("priority")) or "medium",
                    "source_text": _cleanup_text(item.get("source_text")),
                }
            )
        for item in adr_raw.get("decisions", []) if isinstance(adr_raw.get("decisions"), list) else []:
            if not isinstance(item, dict):
                continue
            title = _cleanup_text(item.get("title") or item.get("description"))
            if not title:
                continue
            decisions.append(
                {
                    "id": f"{window_id}:d:{len(decisions)}",
                    "title": title,
                    "rationale": _cleanup_text(item.get("rationale")),
                    "impact": _cleanup_text(item.get("impact")),
                    "source_text": _cleanup_text(item.get("source_text")),
                }
            )
        for item in adr_raw.get("risks", []) if isinstance(adr_raw.get("risks"), list) else []:
            if not isinstance(item, dict):
                continue
            desc = _cleanup_text(item.get("desc") or item.get("description"))
            if not desc:
                continue
            severity = _cleanup_text(item.get("severity")).lower() or "medium"
            if severity not in {"low", "medium", "high"}:
                severity = "medium"
            risks.append(
                {
                    "id": f"{window_id}:r:{len(risks)}",
                    "desc": desc,
                    "severity": severity,
                    "mitigation": _cleanup_text(item.get("mitigation")),
                    "owner": _cleanup_text(item.get("owner")),
                    "source_text": _cleanup_text(item.get("source_text")),
                }
            )

        course_highlights: List[Dict[str, Any]] = []
        summary_highlights = summary.get("course_highlights") if isinstance(summary.get("course_highlights"), list) else []
        for item in summary_highlights:
            if not isinstance(item, dict):
                continue
            kind = _cleanup_text(item.get("kind")).lower() or "concept"
            if kind not in {"concept", "formula", "example", "note"}:
                kind = "concept"
            title = _cleanup_text(item.get("title"))
            bullet = _cleanup_text(item.get("bullet"))
            formula = _cleanup_text(item.get("formula"))
            if not title and not bullet:
                continue
            course_highlights.append(
                {
                    "id": f"{window_id}:h:{len(course_highlights)}",
                    "kind": kind,
                    "title": title or bullet,
                    "bullet": bullet or title,
                    "formula": formula,
                    "citations": base_citations[:2] if base_citations else [],
                }
            )

        if session_kind == "course":
            actions = []
            decisions = []
            risks = []
            if not course_highlights:
                for item in cheatsheet[:5]:
                    course_highlights.append(
                        {
                            "id": f"{window_id}:h:{len(course_highlights)}",
                            "kind": "concept",
                            "title": _cleanup_text(item.get("term")),
                            "bullet": _cleanup_text(item.get("definition")),
                            "formula": "",
                            "citations": item.get("citations", []),
                        }
                    )
        else:
            course_highlights = []

        model_name = (
            _cleanup_text(summary.get("model_name"))
            or _cleanup_text(settings.gemini_model)
            or _cleanup_text(settings.groq_model)
            or "LLM"
        )

        return {
            "window_id": window_id,
            "start_ts_ms": start_ts_ms,
            "end_ts_ms": end_ts_ms,
            "revision": revision,
            "session_kind": session_kind,
            "meeting_type": _cleanup_text(sess.meeting_type) or "project_meeting",
            "model_name": model_name,
            "recap": recap_items,
            "topic": canonical_topic,
            "topics": topics,
            "cheatsheet": cheatsheet,
            "citations": base_citations,
            "actions": actions,
            "decisions": decisions,
            "risks": risks,
            "course_highlights": course_highlights,
            "intent_payload": summary.get("intent") if isinstance(summary.get("intent"), dict) else {"label": "NO_INTENT", "slots": {}},
        }

    def _build_citation_bundle(self, segments: List[TranscriptSeg], frames: List[CapturedFrameMeta]) -> List[Dict[str, Any]]:
        citations: List[Dict[str, Any]] = []
        for seg in segments[:8]:
            citations.append(
                {
                    "type": "transcript",
                    "seg_id": seg.seg_id,
                    "ts_ms": seg.start_ts_ms,
                    "speaker": seg.speaker,
                }
            )
        for frame in frames[:4]:
            citations.append(
                {
                    "type": "image",
                    "frame_id": frame.frame_id,
                    "ts_ms": frame.ts_ms,
                    "uri": frame.uri,
                }
            )
        return citations

    def _extract_terms(self, segments: List[TranscriptSeg]) -> List[str]:
        freq: Dict[str, int] = {}
        stopwords = {
            "the",
            "and",
            "for",
            "that",
            "this",
            "with",
            "from",
            "have",
            "được",
            "các",
            "những",
            "trong",
            "khi",
            "với",
            "cho",
            "một",
        }
        for seg in segments:
            for token in re.findall(r"[A-Za-zÀ-ỹ0-9_]{4,}", seg.text):
                word = token.strip().lower()
                if word in stopwords:
                    continue
                freq[word] = freq.get(word, 0) + 1
        return [term for term, _ in sorted(freq.items(), key=lambda item: (-item[1], item[0]))[:10]]

    async def _persist_window_payload(self, sess: SessionRealtimeAV, payload: Dict[str, Any]) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO recap_window (
                        id, window_id, session_id, meeting_id, start_ts_ms, end_ts_ms, revision,
                        recap, topics, cheatsheet, citations, status, created_at, updated_at
                    )
                    VALUES (
                        :id, :window_id, :session_id, :meeting_id, :start_ts_ms, :end_ts_ms, :revision,
                        :recap::jsonb, :topics::jsonb, :cheatsheet::jsonb, :citations::jsonb, 'ready', NOW(), NOW()
                    )
                    ON CONFLICT (window_id, revision) DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "window_id": payload["window_id"],
                    "session_id": sess.session_id,
                    "meeting_id": ensure_uuid_or_none(sess.meeting_id),
                    "start_ts_ms": payload["start_ts_ms"],
                    "end_ts_ms": payload["end_ts_ms"],
                    "revision": payload["revision"],
                    "recap": json.dumps(payload.get("recap", [])),
                    "topics": json.dumps(payload.get("topics", [])),
                    "cheatsheet": json.dumps(payload.get("cheatsheet", [])),
                    "citations": json.dumps(payload.get("citations", [])),
                },
            )

            meeting_uuid = ensure_uuid_or_none(sess.meeting_id)
            if meeting_uuid:
                transcript_text = "\n".join(
                    item.get("text", "") for item in payload.get("recap", []) if isinstance(item, dict)
                )
                persist_context_window(
                    db,
                    meeting_uuid,
                    {
                        "start_time": max(0.0, (payload["start_ts_ms"] - sess.started_ts_ms) / 1000.0),
                        "end_time": max(0.0, (payload["end_ts_ms"] - sess.started_ts_ms) / 1000.0),
                        "transcript_text": transcript_text,
                        "visual_context": payload.get("citations", []),
                        "citations": payload.get("citations", []),
                        "window_index": int((payload["start_ts_ms"] - sess.started_ts_ms) / self.window_stride_ms),
                    },
                )

            db.commit()
        except Exception:
            db.rollback()
            logger.debug("recap_window_persist_skipped", exc_info=True)
        finally:
            db.close()

    async def _persist_tool_call_proposal(self, sess: SessionRealtimeAV, proposal_id: str, query_id: str, query: str) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO tool_call_proposal (
                        proposal_id, session_id, meeting_id, query_id, reason, suggested_queries, risk,
                        status, created_at, updated_at
                    )
                    VALUES (
                        :proposal_id, :session_id, :meeting_id, :query_id, :reason, :suggested_queries::jsonb, :risk,
                        'pending', NOW(), NOW()
                    )
                    ON CONFLICT (proposal_id) DO NOTHING
                    """
                ),
                {
                    "proposal_id": proposal_id,
                    "session_id": sess.session_id,
                    "meeting_id": ensure_uuid_or_none(sess.meeting_id),
                    "query_id": query_id,
                    "reason": "Tier-2 web search approval required",
                    "suggested_queries": json.dumps([query]),
                    "risk": "medium",
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.debug("tool_call_proposal_persist_skipped", exc_info=True)
        finally:
            db.close()

    async def _update_tool_call_proposal(
        self,
        sess: SessionRealtimeAV,
        proposal_id: str,
        approved: bool,
        constraints: Dict[str, Any],
    ) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    UPDATE tool_call_proposal
                    SET approved = :approved,
                        constraints = :constraints::jsonb,
                        status = :status,
                        updated_at = NOW()
                    WHERE proposal_id = :proposal_id
                    """
                ),
                {
                    "proposal_id": proposal_id,
                    "approved": approved,
                    "constraints": json.dumps(constraints or {}),
                    "status": "approved" if approved else "rejected",
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.debug("tool_call_proposal_update_skipped", exc_info=True)
        finally:
            db.close()

    async def _persist_qna_event(
        self,
        sess: SessionRealtimeAV,
        query_id: str,
        question: str,
        answer: str,
        tier_used: str,
        citations: List[Dict[str, Any]],
    ) -> None:
        self._ensure_realtime_schema()
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    INSERT INTO qna_event_log (
                        id, query_id, session_id, meeting_id, question, answer, tier_used, citations, created_at
                    )
                    VALUES (
                        :id, :query_id, :session_id, :meeting_id, :question, :answer, :tier_used, :citations::jsonb, NOW()
                    )
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "query_id": query_id,
                    "session_id": sess.session_id,
                    "meeting_id": ensure_uuid_or_none(sess.meeting_id),
                    "question": question,
                    "answer": answer,
                    "tier_used": tier_used,
                    "citations": json.dumps(citations),
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.debug("qna_event_log_persist_skipped", exc_info=True)
        finally:
            db.close()

    def _search_tier0(self, sess: SessionRealtimeAV, query: str) -> Tuple[List[Dict[str, Any]], str]:
        query_tokens = [token for token in re.findall(r"[A-Za-zÀ-ỹ0-9_]{2,}", query.lower()) if token]
        segments_sorted = sorted(sess.transcript_segments.values(), key=lambda item: (item.start_ts_ms, item.seg_id))
        matches: List[TranscriptSeg] = []

        for seg in segments_sorted:
            haystack = seg.text.lower()
            if query_tokens and any(token in haystack for token in query_tokens):
                matches.append(seg)

        if not matches:
            matches = segments_sorted[-10:]

        transcript_window = "\n".join(
            f"[{seg.speaker} {format_mmss_from_ms(max(0, seg.start_ts_ms - sess.started_ts_ms))}] {seg.text}"
            for seg in matches
        )
        citations = [
            {
                "type": "transcript",
                "seg_id": seg.seg_id,
                "ts_ms": seg.start_ts_ms,
                "speaker": seg.speaker,
            }
            for seg in matches[:8]
        ]

        for frame in sorted(sess.captured_frames.values(), key=lambda item: item.ts_ms)[-3:]:
            citations.append(
                {
                    "type": "image",
                    "frame_id": frame.frame_id,
                    "ts_ms": frame.ts_ms,
                    "uri": frame.uri,
                }
            )
        return citations, transcript_window

    def _search_tier1(self, sess: SessionRealtimeAV, query: str) -> List[Dict[str, Any]]:
        try:
            hits = rag_retrieve(question=query, meeting_id=sess.meeting_id)
        except Exception:
            logger.debug("tier1_rag_retrieve_failed", exc_info=True)
            return []
        normalized: List[Dict[str, Any]] = []
        for hit in hits[:5]:
            if not isinstance(hit, dict):
                continue
            normalized.append(
                {
                    "type": "document",
                    "source": str(hit.get("source") or hit.get("id") or "rag"),
                    "snippet": _cleanup_text(hit.get("snippet") or hit.get("text") or ""),
                }
            )
        return normalized

    def _crop_roi(self, image: Any, roi: Roi) -> Any:
        x1 = max(0, roi.x)
        y1 = max(0, roi.y)
        x2 = max(x1 + 1, roi.x + roi.w)
        y2 = max(y1 + 1, roi.y + roi.h)
        return image.crop((x1, y1, x2, y2))

    def _build_detection_frame(self, image: Any) -> Any:
        gray = image.convert("L").resize((self.detect_width, self.detect_height))
        if ImageFilter is not None:
            gray = gray.filter(ImageFilter.GaussianBlur(radius=1))
        return gray

    def _dhash64(self, gray_image: Any) -> int:
        small = gray_image.resize((9, 8))
        pixels = list(small.getdata())
        value = 0
        for row in range(8):
            row_offset = row * 9
            for col in range(8):
                left = pixels[row_offset + col]
                right = pixels[row_offset + col + 1]
                value = (value << 1) | (1 if left > right else 0)
        return value

    def _hamming_distance(self, lhs: int, rhs: int) -> int:
        return int((lhs ^ rhs).bit_count())

    def _bytes_to_gray_image(self, payload: bytes, width: int, height: int) -> Any:
        if Image is None:
            raise RuntimeError("Pillow is required")
        return Image.frombytes("L", (width, height), payload)

    def _ssim(self, img_a: Any, img_b: Any) -> float:
        a = list(img_a.getdata())
        b = list(img_b.getdata())
        n = min(len(a), len(b))
        if n <= 1:
            return 1.0
        a = a[:n]
        b = b[:n]

        mean_a = sum(a) / n
        mean_b = sum(b) / n

        var_a = 0.0
        var_b = 0.0
        cov_ab = 0.0
        for idx in range(n):
            da = a[idx] - mean_a
            db = b[idx] - mean_b
            var_a += da * da
            var_b += db * db
            cov_ab += da * db

        denom = max(1, n - 1)
        var_a /= denom
        var_b /= denom
        cov_ab /= denom

        c1 = (0.01 * 255) ** 2
        c2 = (0.03 * 255) ** 2
        numerator = (2 * mean_a * mean_b + c1) * (2 * cov_ab + c2)
        denominator = (mean_a * mean_a + mean_b * mean_b + c1) * (var_a + var_b + c2)
        if denominator == 0:
            return 1.0
        score = numerator / denominator
        if math.isnan(score):
            return 0.0
        return max(0.0, min(float(score), 1.0))


realtime_av_service = RealtimeAVService()

