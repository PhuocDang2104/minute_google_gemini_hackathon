from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin

class NoteItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "note_item"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    term = Column(String, nullable=True)  # Concept/Key term
    definition = Column(Text, nullable=False)
    example = Column(Text, nullable=True)
    source_timecode = Column(Float)
    
    meeting = relationship("Meeting", back_populates="note_items")

class QuizItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quiz_item"

    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # List of 4 strings
    correct_answer_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    user_answer_index = Column(Integer, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    
    meeting = relationship("Meeting", back_populates="quiz_items")
