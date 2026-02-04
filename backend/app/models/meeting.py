import uuid
from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.adr import ActionItem, DecisionItem, RiskItem, TranscriptChunk, TopicSegment


class Meeting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'meeting'
    
    external_event_id = Column(String)  # sync từ Outlook/Teams
    title = Column(String, nullable=False)
    description = Column(Text)
    organizer_id = Column(UUID(as_uuid=True), ForeignKey('user_account.id'))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    meeting_type = Column(String)  # project_meeting, study_session, etc.
    phase = Column(String, default='pre')  # pre / in / post
    project_id = Column(UUID(as_uuid=True), ForeignKey('project.id'))
    department_id = Column(UUID(as_uuid=True), ForeignKey('department.id'))
    location = Column(String)
    teams_link = Column(String)
    recording_url = Column(String)
    
    # Relationships
    organizer = relationship("UserAccount", back_populates="organized_meetings")
    project = relationship("Project", back_populates="meetings")
    participants = relationship("MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")
    transcript_chunks = relationship(TranscriptChunk, back_populates="meeting", cascade="all, delete-orphan")
    topic_segments = relationship(TopicSegment, back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship(ActionItem, back_populates="meeting", cascade="all, delete-orphan")
    decision_items = relationship(DecisionItem, back_populates="meeting", cascade="all, delete-orphan")
    risk_items = relationship(RiskItem, back_populates="meeting", cascade="all, delete-orphan")
    
    # Study Relationships
    note_items = relationship("app.models.study.NoteItem", back_populates="meeting", cascade="all, delete-orphan")
    quiz_items = relationship("app.models.study.QuizItem", back_populates="meeting", cascade="all, delete-orphan")
    
    # New Relationships
    recap_segments = relationship("app.models.timeline.RecapSegment", back_populates="meeting", cascade="all, delete-orphan")
    visual_events = relationship("app.models.timeline.VisualEvent", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("app.models.summary.MeetingSummary", back_populates="meeting", cascade="all, delete-orphan")
    chat_sessions = relationship("app.models.chat_session.ChatSession", back_populates="meeting", cascade="all, delete-orphan")


class MeetingParticipant(Base):
    __tablename__ = 'meeting_participant'
    
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('user_account.id', ondelete='CASCADE'), primary_key=True)
    role = Column(String, default='attendee')  # organizer / required / optional / attendee
    response_status = Column(String, default='pending')  # accepted / declined / tentative
    attended = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True))
    left_at = Column(DateTime(timezone=True))
    
    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("UserAccount", back_populates="participations")
