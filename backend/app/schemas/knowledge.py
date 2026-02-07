"""
Knowledge Hub schemas
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


class KnowledgeDocumentBase(BaseModel):
    """Base knowledge document schema"""
    title: str
    description: Optional[str] = None
    document_type: str = Field(description="regulation, policy, technical, template, meeting_minutes, etc.")
    source: str = Field(description="SharePoint, Wiki, LOffice, Uploaded, etc.")
    tags: Optional[List[str]] = []
    category: Optional[str] = None  # Compliance, Technical, Project, etc.


class KnowledgeDocumentCreate(KnowledgeDocumentBase):
    """Create knowledge document request"""
    file_type: str = Field(description="pdf, docx, xlsx, pptx, etc.")
    file_size: Optional[int] = None
    uploaded_by: Optional[UUID] = None
    meeting_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    # For mock: we won't actually store file, just metadata
    file_url: Optional[str] = None
    content_text: Optional[str] = None  # Extracted text for search


class KnowledgeDocumentUpdate(BaseModel):
    """Update knowledge document request"""
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    meeting_id: Optional[UUID] = None
    project_id: Optional[UUID] = None


class KnowledgeDocument(KnowledgeDocumentBase):
    """Knowledge document response"""
    id: UUID
    meeting_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    file_type: str
    file_size: Optional[int] = None
    file_url: Optional[str] = None
    storage_key: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime
    view_count: int = 0
    last_accessed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class KnowledgeDocumentList(BaseModel):
    """List of knowledge documents response"""
    documents: List[KnowledgeDocument]
    total: int


class KnowledgeDocumentUploadResponse(BaseModel):
    """Response after uploading a document"""
    id: UUID
    title: str
    file_url: str
    message: str = "Tài liệu đã được tải lên thành công"


class KnowledgeSearchRequest(BaseModel):
    """Search request for knowledge documents"""
    query: str
    document_type: Optional[str] = None
    source: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    meeting_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    limit: int = 20
    offset: int = 0


class KnowledgeSearchResponse(BaseModel):
    """Search response"""
    documents: List[KnowledgeDocument]
    total: int
    query: str


class KnowledgeQueryRequest(BaseModel):
    """AI query request for knowledge base"""
    query: str
    include_documents: bool = True
    include_meetings: bool = True
    limit: int = 5
    meeting_id: Optional[UUID] = None
    project_id: Optional[UUID] = None


class KnowledgeQueryResponse(BaseModel):
    """AI query response"""
    answer: str
    relevant_documents: List[KnowledgeDocument]
    confidence: float = 0.85
    citations: Optional[List[str]] = []
