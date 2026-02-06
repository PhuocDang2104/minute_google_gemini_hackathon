import uuid
from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, Float, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class TranscriptChunk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transcript_chunk"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    speaker = Column(String)
    text = Column(Text, nullable=False)
    time_start = Column(Float)
    time_end = Column(Float)
    is_final = Column(Boolean, default=True)
    lang = Column(String, default="vi")
    confidence = Column(Float, default=1.0)

    meeting = relationship("Meeting", back_populates="transcript_chunks")


class TopicSegment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "topic_segment"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    start_t = Column(Float, default=0.0)
    end_t = Column(Float, default=0.0)

    meeting = relationship("Meeting", back_populates="topic_segments")


class ActionItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "action_item"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("project.id"), nullable=True)
    description = Column(Text, nullable=False)
    # New schema
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    deadline = Column(DateTime(timezone=True))
    priority = Column(String)
    status = Column(String)
    source_chunk_id = Column(UUID(as_uuid=True), nullable=True)
    topic_id = Column(String)
    source_timecode = Column(Float)
    source_text = Column(Text)
    external_task_link = Column(Text)
    external_task_id = Column(String)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True))

    # Legacy fields (kept for backward compatibility)
    owner = Column(String)
    due_date = Column(DateTime(timezone=True))
    external_id = Column(String)
    confirmed = Column(Boolean, default=False)

    meeting = relationship("Meeting", back_populates="action_items")


class DecisionItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "decision_item"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    # New schema
    description = Column(Text)
    status = Column(String)
    source_chunk_id = Column(UUID(as_uuid=True), nullable=True)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True))

    # Legacy fields
    title = Column(String, nullable=False)
    rationale = Column(Text)
    impact = Column(Text)
    topic_id = Column(String)
    source_timecode = Column(Float)
    source_text = Column(Text)

    meeting = relationship("Meeting", back_populates="decision_items")


class RiskItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "risk_item"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String)
    mitigation = Column(Text)
    # New schema
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    status = Column(String)
    source_chunk_id = Column(UUID(as_uuid=True), nullable=True)

    # Legacy fields
    owner = Column(String)
    topic_id = Column(String)
    source_timecode = Column(Float)
    source_text = Column(Text)

    meeting = relationship("Meeting", back_populates="risk_items")


class AdrHistory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "adr_history"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String)  # action/decision/risk
    payload = Column(JSON, nullable=False)
    operation = Column(String, default="add")  # add/update/delete


class AiEventLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_event_log"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    semantic_intent_label = Column(String)
    latency_ms_total = Column(Float)
    token_usage_estimate = Column(Float)
    debug_info = Column(JSON)


class ToolSuggestion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tool_suggestion"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    suggestion_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # task/schedule/doc/other
    action_hash = Column(String)
    payload = Column(JSON)
    executed = Column(Boolean, default=False)
    execution_result = Column(JSON)
