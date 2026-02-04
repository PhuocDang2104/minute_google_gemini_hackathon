from sqlalchemy import Column, String, ForeignKey, Text, Float, JSON
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
