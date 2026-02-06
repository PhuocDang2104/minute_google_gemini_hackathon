from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class ParticipantBase(BaseModel):
    user_id: str
    role: str = 'attendee'  # organizer / required / optional / attendee
    response_status: str = 'pending'  # accepted / declined / tentative / pending


class ParticipantCreate(ParticipantBase):
    pass


class Participant(ParticipantBase):
    email: Optional[str] = None
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meeting_type: str = 'weekly_status'  # steering / weekly_status / risk_review / workshop / daily
    project_id: Optional[str] = None
    department_id: Optional[str] = None
    location: Optional[str] = None
    teams_link: Optional[str] = None


class MeetingCreate(MeetingBase):
    organizer_id: Optional[str] = None
    participant_ids: Optional[List[str]] = []


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meeting_type: Optional[str] = None
    phase: Optional[str] = None
    project_id: Optional[str] = None
    location: Optional[str] = None
    teams_link: Optional[str] = None
    recording_url: Optional[str] = None


class Meeting(MeetingBase):
    id: str
    organizer_id: Optional[str] = None
    phase: str = 'pre'  # pre / in / post
    recording_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingWithParticipants(Meeting):
    participants: List[Participant] = []
    organizer: Optional[Participant] = None


class MeetingList(BaseModel):
    meetings: List[Meeting]
    total: int


class MeetingNotifyRecipient(BaseModel):
    email: str
    name: Optional[str] = None
    role: Optional[str] = None


class MeetingNotifyRequest(BaseModel):
    recipients: List[MeetingNotifyRecipient]
    include_agenda: bool = True
    include_documents: bool = True
    include_notes: bool = False
    custom_message: Optional[str] = None
