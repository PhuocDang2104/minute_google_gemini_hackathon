"""
Meeting Minutes Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MeetingMinutesBase(BaseModel):
    version: int = 1
    minutes_text: Optional[str] = None
    minutes_html: Optional[str] = None
    minutes_markdown: Optional[str] = None
    executive_summary: Optional[str] = None
    status: str = "draft"  # draft / reviewed / approved / distributed


class MeetingMinutesCreate(MeetingMinutesBase):
    meeting_id: str


class MeetingMinutesUpdate(BaseModel):
    minutes_text: Optional[str] = None
    minutes_html: Optional[str] = None
    minutes_markdown: Optional[str] = None
    executive_summary: Optional[str] = None
    status: Optional[str] = None


class MeetingMinutesResponse(MeetingMinutesBase):
    id: str
    meeting_id: str
    minutes_doc_url: Optional[str] = None
    generated_at: datetime
    edited_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingMinutesList(BaseModel):
    minutes: List[MeetingMinutesResponse]
    total: int


# ============================================
# Distribution Log Schemas
# ============================================

class DistributionLogBase(BaseModel):
    channel: str  # email / teams / sharepoint
    recipient_email: Optional[str] = None
    status: str = "sent"  # sent / delivered / read / failed


class DistributionLogCreate(DistributionLogBase):
    minutes_id: str
    meeting_id: str
    user_id: Optional[str] = None


class DistributionLogResponse(DistributionLogBase):
    id: str
    minutes_id: str
    meeting_id: str
    user_id: Optional[str] = None
    sent_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class DistributionLogList(BaseModel):
    logs: List[DistributionLogResponse]
    total: int


# ============================================
# Generate Minutes Request
# ============================================

class GenerateMinutesRequest(BaseModel):
    meeting_id: str
    template_id: Optional[str] = None  # Template ID to use for generation
    include_transcript: bool = True
    include_actions: bool = True
    include_decisions: bool = True
    include_risks: bool = True
    prompt_strategy: str = "context_json"  # context_json / structured_json
    session_type: Optional[str] = None  # meeting / course (auto-infer if None)
    include_topic_tracker: bool = True
    include_ai_filters: bool = True
    include_quiz: bool = True
    include_knowledge_table: bool = True
    format: str = "markdown"  # markdown / html / text


class DistributeMinutesRequest(BaseModel):
    minutes_id: str
    meeting_id: str
    channels: List[str] = ["email"]  # email / teams / sharepoint
    recipients: Optional[List[str]] = None  # user_ids, None = all participants
