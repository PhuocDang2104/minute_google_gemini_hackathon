from sqlalchemy import Column, String, ForeignKey, Text, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class MeetingSummary(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'meeting_summary'
    
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), nullable=False)
    version = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    summary_type = Column(String, default='full')  # full, executive, takeaways, learning_pack
    artifacts = Column(JSON)  # Extra data potentially
    
    meeting = relationship("Meeting", back_populates="summaries")
