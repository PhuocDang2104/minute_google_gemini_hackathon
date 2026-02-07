from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import UserDefinedType

from app.models.base import Base, TimestampMixin, UUIDMixin


class Vector1024(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kwargs):
        return "vector(1024)"


class KnowledgeDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_document"

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    source = Column(Text, nullable=True)
    category = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=True)
    file_type = Column(Text, nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_key = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organization.id"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("project.id"), nullable=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="CASCADE"), nullable=True)
    visibility = Column(Text, nullable=True)

    meeting = relationship("Meeting", back_populates="knowledge_documents")
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_chunk"

    document_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_document.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    embedding = Column(Vector1024(), nullable=True)
    scope_meeting = Column(UUID(as_uuid=True), ForeignKey("meeting.id", ondelete="SET NULL"), nullable=True)
    scope_project = Column(UUID(as_uuid=True), ForeignKey("project.id", ondelete="SET NULL"), nullable=True)

    document = relationship("KnowledgeDocument", back_populates="chunks")
