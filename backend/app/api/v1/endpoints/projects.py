from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectList,
    ProjectMember,
    ProjectMemberList,
    ProjectMemberCreate,
)
from app.services import project_service

router = APIRouter()


@router.get("/", response_model=ProjectList)
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = None,
    department_id: str | None = None,
    organization_id: str | None = None,
    db: Session = Depends(get_db),
):
    return project_service.list_projects(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        department_id=department_id,
        organization_id=organization_id,
    )


@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
):
    return project_service.create_project(db=db, payload=payload)


@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    project = project_service.get_project(db=db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=Project)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = project_service.update_project(db=db, project_id=project_id, payload=payload)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    ok = project_service.delete_project(db=db, project_id=project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return None


# ============================================
# Project Members
# ============================================


@router.get("/{project_id}/members", response_model=ProjectMemberList)
def list_project_members(
    project_id: str,
    db: Session = Depends(get_db),
):
    return project_service.list_members(db=db, project_id=project_id)


@router.post("/{project_id}/members", response_model=ProjectMember)
def add_project_member(
    project_id: str,
    payload: ProjectMemberCreate,
    db: Session = Depends(get_db),
):
    member = project_service.add_member(db=db, project_id=project_id, payload=payload)
    if not member:
        raise HTTPException(status_code=400, detail="Failed to add project member")
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
):
    ok = project_service.remove_member(db=db, project_id=project_id, user_id=user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project member not found")
    return None
