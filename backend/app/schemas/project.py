from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None  # Project objectives/goals
    status: Optional[str] = None  # active / archived
    owner_id: Optional[str] = None
    organization_id: Optional[str] = None
    department_id: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None  # Project objectives/goals
    status: Optional[str] = None  # active / archived
    owner_id: Optional[str] = None
    organization_id: Optional[str] = None
    department_id: Optional[str] = None


class Project(ProjectBase):
    id: str
    owner_id: Optional[str] = None
    meeting_count: Optional[int] = None
    document_count: Optional[int] = None
    member_count: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    projects: List[Project]
    total: int


class ProjectMember(BaseModel):
    project_id: str
    user_id: str
    role: str = Field(default='member')
    joined_at: Optional[datetime] = None
    display_name: Optional[str] = None
    email: Optional[str] = None


class ProjectMemberCreate(BaseModel):
    user_id: str
    role: Optional[str] = Field(default='member')


class ProjectMemberList(BaseModel):
    members: List[ProjectMember]
    total: int

