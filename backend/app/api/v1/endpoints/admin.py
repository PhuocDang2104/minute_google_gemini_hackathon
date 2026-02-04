from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.user import User, UserList
from app.schemas.admin import (
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AdminCreateUser,
)
from app.schemas.auth import UserRegisterResponse, UserRegister
from app.schemas.document import DocumentList, Document, DocumentUpdate
from app.schemas.meeting import Meeting, MeetingUpdate, MeetingWithParticipants
from app.schemas.action_item import ActionItemList, ActionItemResponse, ActionItemUpdate
from app.schemas.action_item import ActionItemCreate
from app.services import (
    user_service,
    document_service,
    meeting_service,
    action_item_service,
)


router = APIRouter(dependencies=[Depends(require_admin)], tags=["admin"])


@router.get('/users', response_model=UserList)
def admin_list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: str | None = None,
    department_id: str | None = None,
    db: Session = Depends(get_db)
):
    """Admin: list users with filters"""
    users, total = user_service.list_users(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        department_id=department_id
    )
    return UserList(users=users, total=total)


@router.get('/users/{user_id}', response_model=User)
def admin_get_user(user_id: str, db: Session = Depends(get_db)):
    """Admin: get user by ID"""
    user = user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch('/users/{user_id}/role', response_model=User)
def admin_update_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    db: Session = Depends(get_db)
):
    """Admin: update user role"""
    updated = user_service.update_user_role(db, user_id, payload.role)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.patch('/users/{user_id}/status', response_model=User)
def admin_update_status(
    user_id: str,
    payload: AdminUserStatusUpdate,
    db: Session = Depends(get_db)
):
    """Admin: activate/deactivate user"""
    updated = user_service.update_user_status(db, user_id, payload.is_active)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.post('/users', response_model=User, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: AdminCreateUser,
    db: Session = Depends(get_db)
):
    """Admin: create a new user"""
    user = user_service.create_user(
        db=db,
        email=payload.email,
        display_name=payload.display_name,
        department_id=payload.department_id,
        organization_id=payload.organization_id,
        role=payload.role or 'user',
    )
    return user


# ============================================
# Documents (admin)
# ============================================

@router.get('/documents', response_model=DocumentList)
async def admin_list_documents(
    meeting_id: str | None = None,
    project_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Admin: list all documents (mock storage)"""
    meeting_uuid = None
    project_uuid = None
    if meeting_id:
        try:
            from uuid import UUID
            meeting_uuid = UUID(meeting_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting_id")
    if project_id:
        try:
            from uuid import UUID
            project_uuid = UUID(project_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id")
    return await document_service.list_all_documents(db, meeting_uuid, project_uuid, skip, limit)


@router.get('/documents/{document_id}', response_model=Document)
async def admin_get_document(document_id: str, db: Session = Depends(get_db)):
    """Admin: get document by ID"""
    from uuid import UUID
    doc = await document_service.get_document(db, UUID(document_id))
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.patch('/documents/{document_id}', response_model=Document)
async def admin_update_document(
    document_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """Admin: update document metadata (mock)"""
    from uuid import UUID
    doc = await document_service.update_document(db, UUID(document_id), payload)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.delete('/documents/{document_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_document(document_id: str, db: Session = Depends(get_db)):
    """Admin: delete document (mock)"""
    from uuid import UUID
    ok = await document_service.delete_document(db, UUID(document_id))
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return None


# ============================================
# Meetings (admin)
# ============================================

@router.get('/meetings', response_model=list[Meeting])
def admin_list_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    phase: str | None = None,
    meeting_type: str | None = None,
    project_id: str | None = None,
    db: Session = Depends(get_db)
):
    """Admin: list meetings with filters"""
    meetings, _ = meeting_service.list_meetings(
        db=db,
        skip=skip,
        limit=limit,
        phase=phase,
        meeting_type=meeting_type,
        project_id=project_id
    )
    return meetings


@router.get('/meetings/{meeting_id}', response_model=MeetingWithParticipants)
def admin_get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Admin: get meeting detail with participants"""
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


@router.patch('/meetings/{meeting_id}', response_model=Meeting)
def admin_update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Admin: update meeting metadata"""
    updated = meeting_service.update_meeting(db, meeting_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return updated


@router.delete('/meetings/{meeting_id}', status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Admin: delete meeting"""
    ok = meeting_service.delete_meeting(db, meeting_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return None


# ============================================
# Action Items (admin)
# ============================================

@router.get('/action-items', response_model=ActionItemList)
def admin_list_action_items(
    status: str | None = None,
    priority: str | None = None,
    owner_user_id: str | None = None,
    overdue_only: bool = False,
    project_id: str | None = None,
    db: Session = Depends(get_db)
):
    """Admin: list all action items with filters"""
    return action_item_service.list_all_action_items(
        db=db,
        status=status,
        priority=priority,
        owner_user_id=owner_user_id,
        overdue_only=overdue_only,
        project_id=project_id,
    )


@router.get('/action-items/{item_id}', response_model=ActionItemResponse)
def admin_get_action_item(item_id: str, db: Session = Depends(get_db)):
    item = action_item_service.get_action_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")
    return item


@router.patch('/action-items/{item_id}', response_model=ActionItemResponse)
def admin_update_action_item(
    item_id: str,
    payload: ActionItemUpdate,
    db: Session = Depends(get_db)
):
    updated = action_item_service.update_action_item(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")
    return updated


@router.delete('/action-items/{item_id}', status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_action_item(item_id: str, db: Session = Depends(get_db)):
    ok = action_item_service.delete_action_item(db, item_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")
    return None

