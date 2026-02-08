from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class SessionRoi(Base):
    __tablename__ = "session_roi"

    session_id = Column(String, primary_key=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    w = Column(Integer, nullable=False)
    h = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AudioRecord(Base, UUIDMixin):
    __tablename__ = "audio_record"

    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    record_id = Column(BigInteger, nullable=False)
    start_ts_ms = Column(BigInteger, nullable=False)
    end_ts_ms = Column(BigInteger, nullable=False)
    uri = Column(Text)
    format = Column(String, default="wav_pcm_s16le_16k_mono")
    checksum = Column(String)
    status = Column(String, default="ready")
    asr_payload = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segment"

    seg_id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    record_id = Column(BigInteger, nullable=True)
    speaker = Column(String, nullable=False, default="SPEAKER_01")
    offset = Column(String)
    start_ts_ms = Column(BigInteger, nullable=False)
    end_ts_ms = Column(BigInteger)
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CapturedFrame(Base):
    __tablename__ = "captured_frame"

    frame_id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    ts_ms = Column(BigInteger, nullable=False)
    roi = Column(JSONB, nullable=False)
    checksum = Column(String)
    uri = Column(Text, nullable=False)
    diff_score = Column(JSONB)
    capture_reason = Column(String, default="change_confirmed")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class RecapWindow(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "recap_window"

    window_id = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    start_ts_ms = Column(BigInteger, nullable=False)
    end_ts_ms = Column(BigInteger, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    recap = Column(JSONB, nullable=False, default=list)
    topics = Column(JSONB, nullable=False, default=list)
    cheatsheet = Column(JSONB, nullable=False, default=list)
    citations = Column(JSONB, nullable=False, default=list)
    status = Column(String, default="ready")


class ToolCallProposal(Base):
    __tablename__ = "tool_call_proposal"

    proposal_id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    query_id = Column(String)
    reason = Column(Text)
    suggested_queries = Column(JSONB, nullable=False, default=list)
    risk = Column(String)
    approved = Column(Boolean)
    constraints = Column(JSONB)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class QnaEventLog(Base, UUIDMixin):
    __tablename__ = "qna_event_log"

    query_id = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text)
    tier_used = Column(String)
    citations = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
