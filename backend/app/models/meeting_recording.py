from sqlalchemy import Column, String, Text, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MeetingRecording(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "meeting_recording"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(Text, nullable=True)
    storage_key = Column(String, nullable=True)
    provider = Column(String, nullable=True)  # supabase / local / other
    original_filename = Column(String, nullable=True)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    duration_sec = Column(Float, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=True)
    status = Column(String, default="uploaded")

    meeting = relationship("Meeting", back_populates="recordings")
