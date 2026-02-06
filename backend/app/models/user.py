import uuid
from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'organization'
    
    name = Column(String, nullable=False)
    
    # Relationships
    users = relationship("UserAccount", back_populates="organization")
    projects = relationship("Project", back_populates="organization")
    departments = relationship("Department", back_populates="organization")


class Department(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'department'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organization.id'))
    name = Column(String, nullable=False)
    
    organization = relationship("Organization", back_populates="departments")
    users = relationship("UserAccount", back_populates="department")
    projects = relationship("Project", back_populates="department")


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'project'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organization.id'))
    department_id = Column(UUID(as_uuid=True), ForeignKey('department.id'))
    owner_id = Column(UUID(as_uuid=True), ForeignKey('user_account.id'))
    name = Column(String, nullable=False)
    code = Column(String)
    description = Column(Text)  # Project description
    objective = Column(Text)  # Project objectives/goals
    status = Column(String, default='active')
    
    organization = relationship("Organization", back_populates="projects")
    department = relationship("Department", back_populates="projects")
    owner = relationship("UserAccount", foreign_keys=[owner_id], back_populates="owned_projects")
    meetings = relationship("Meeting", back_populates="project")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = 'project_member'

    project_id = Column(UUID(as_uuid=True), ForeignKey('project.id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('user_account.id', ondelete='CASCADE'), primary_key=True)
    role = Column(String, default='member')  # owner / member / guest
    joined_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="members")
    user = relationship("UserAccount", back_populates="project_memberships")


class UserAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'user_account'
    
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String)
    password_hash = Column(Text)
    role = Column(String, default='user')  # user / chair / PMO / admin
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organization.id'))
    department_id = Column(UUID(as_uuid=True), ForeignKey('department.id'))
    avatar_url = Column(String)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))
    preferences = Column(JSON, default={})  # { "model": "gemini", "tone": "formal", "custom_instructions": "..." }
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    department = relationship("Department", back_populates="users")
    organized_meetings = relationship("Meeting", back_populates="organizer")
    participations = relationship("MeetingParticipant", back_populates="user")
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
