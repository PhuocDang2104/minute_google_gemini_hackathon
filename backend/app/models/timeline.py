from sqlalchemy import Column, String, ForeignKey, Text, Float, JSON
from sqlalchemy import Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class RecapSegment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'recap_segment'
    
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    summary_text = Column(Text)
    visual_snapshot = Column(JSON)  # Snapshot of visual state during this window
    
    meeting = relationship("Meeting", back_populates="recap_segments")

class VisualEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'visual_event'
    
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), nullable=False)
    timestamp = Column(Float, nullable=False)
    image_url = Column(String)  # Path to image/frame
    description = Column(Text)  # Caption/Description of the visual
    ocr_text = Column(Text)  # Text extracted from image
    event_type = Column(String)  # slide_change, screen_share, whiteboard, code
    
    meeting = relationship("Meeting", back_populates="visual_events")
    objects = relationship("VisualObjectEvent", back_populates="visual_event", cascade="all, delete-orphan")


class VisualObjectEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "visual_object_event"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    visual_event_id = Column(UUID(as_uuid=True), ForeignKey("visual_event.id", ondelete="SET NULL"), nullable=True)
    timestamp = Column(Float, nullable=False)
    time_end = Column(Float, nullable=True)
    object_label = Column(String, nullable=False)
    object_type = Column(String, nullable=True)
    bbox = Column(JSON, nullable=True)  # {"x":0.1,"y":0.2,"w":0.3,"h":0.4}
    confidence = Column(Float, nullable=True)
    attributes = Column(JSON, nullable=True)  # detector-specific metadata
    ocr_text = Column(Text, nullable=True)
    frame_url = Column(String, nullable=True)
    source = Column(String, nullable=True)  # detector name / model

    meeting = relationship("Meeting", back_populates="visual_object_events")
    visual_event = relationship("VisualEvent", back_populates="objects")


class ContextWindow(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'context_window'

    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    transcript_text = Column(Text)
    visual_context = Column(JSON)  # Visual highlights or aligned events for the window
    citations = Column(JSON)
    window_index = Column(Integer)

    meeting = relationship("Meeting", back_populates="context_windows")
