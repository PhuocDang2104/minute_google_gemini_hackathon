from sqlalchemy import Column, String, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class ChatSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'chat_session'

    meeting_id = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete='CASCADE'), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('user_account.id', ondelete='CASCADE'), nullable=True)
    title = Column(String) # Optional title for the chat
    
    # Relationships
    meeting = relationship("Meeting", back_populates="chat_sessions") # Assuming we add this to Meeting
    user = relationship("UserAccount")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'chat_message'
    
    session_id = Column(UUID(as_uuid=True), ForeignKey('chat_session.id', ondelete='CASCADE'), nullable=False)
    role = Column(String, nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    citations = Column(JSON) # List of citations {source_id, page, text}
    
    session = relationship("ChatSession", back_populates="messages")