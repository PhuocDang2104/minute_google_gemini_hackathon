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


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'project'
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organization.id'))
    name = Column(String, nullable=False)
    code = Column(String)
    description = Column(Text)  # Project description
    objective = Column(Text)  # Project objectives/goals
    
    organization = relationship("Organization", back_populates="projects")
    meetings = relationship("Meeting", back_populates="project")


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