from datetime import datetime
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectList,
    ProjectMember,
    ProjectMemberList,
    ProjectMemberCreate,
)


def _table_exists(db: Session, table_name: str) -> bool:
    res = db.execute(text("SELECT to_regclass(:t)"), {"t": f"public.{table_name}"}).scalar()
    return res is not None


def _resolve_document_table(db: Session) -> Optional[str]:
    # Prefer knowledge_document if available, else fall back to document/documents.
    for name in ("knowledge_document", "document", "documents"):
        if _table_exists(db, name):
            return name
    return None


def _row_to_project(row) -> Project:
    return Project(
        id=row.get("id"),
        name=row.get("name"),
        code=row.get("code"),
        description=row.get("description"),
        objective=row.get("objective"),
        status=row.get("status"),
        owner_id=row.get("owner_id"),
        organization_id=row.get("organization_id"),
        department_id=row.get("department_id"),
        meeting_count=row.get("meeting_count"),
        document_count=row.get("document_count"),
        member_count=row.get("member_count"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def list_projects(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    organization_id: Optional[str] = None,
) -> ProjectList:
    doc_table = _resolve_document_table(db)
    has_project_member = _table_exists(db, "project_member")

    conditions = ["1=1"]
    params: dict[str, object] = {"skip": skip, "limit": limit}

    if search:
        conditions.append("(p.name ILIKE :search OR p.code ILIKE :search)")
        params["search"] = f"%{search}%"
    if department_id:
        conditions.append("p.department_id = :department_id")
        params["department_id"] = department_id
    if organization_id:
        conditions.append("p.organization_id = :organization_id")
        params["organization_id"] = organization_id

    where_clause = " AND ".join(conditions)

    doc_join = (
        f"""
        LEFT JOIN (
            SELECT project_id, COUNT(*) AS document_count
            FROM {doc_table}
            WHERE project_id IS NOT NULL
            GROUP BY project_id
        ) k ON k.project_id = p.id
        """
        if doc_table
        else """
        LEFT JOIN (
            SELECT NULL::uuid AS project_id, 0::int AS document_count
        ) k ON k.project_id = p.id
        """
    )

    member_join = (
        """
        LEFT JOIN (
            SELECT project_id, COUNT(*) AS member_count
            FROM project_member
            GROUP BY project_id
        ) pm ON pm.project_id = p.id
        """
        if has_project_member
        else """
        LEFT JOIN (
            SELECT NULL::uuid AS project_id, 0::int AS member_count
        ) pm ON pm.project_id = p.id
        """
    )

    query = text(
        f"""
        SELECT
            p.id::text,
            p.name,
            p.code,
            p.description,
            p.objective,
            p.status,
            p.owner_id::text,
            p.organization_id::text,
            p.department_id::text,
            p.created_at,
            p.updated_at,
            COALESCE(m.meeting_count, 0) AS meeting_count,
            COALESCE(k.document_count, 0) AS document_count,
            COALESCE(pm.member_count, 0) AS member_count
        FROM project p
        LEFT JOIN (
            SELECT project_id, COUNT(*) AS meeting_count
            FROM meeting
            WHERE project_id IS NOT NULL
            GROUP BY project_id
        ) m ON m.project_id = p.id
        {doc_join}
        {member_join}
        WHERE {where_clause}
        ORDER BY p.created_at DESC NULLS LAST
        LIMIT :limit OFFSET :skip
        """
    )

    rows = db.execute(query, params).mappings().all()
    projects = [_row_to_project(row) for row in rows]

    total = db.execute(
        text(f"SELECT COUNT(*) FROM project p WHERE {where_clause}"),
        params,
    ).scalar_one()

    return ProjectList(projects=projects, total=total)


def get_project(db: Session, project_id: str) -> Optional[Project]:
    doc_table = _resolve_document_table(db)
    has_project_member = _table_exists(db, "project_member")

    doc_join = (
        f"""
            LEFT JOIN (
                SELECT project_id, COUNT(*) AS document_count
                FROM {doc_table}
                WHERE project_id IS NOT NULL
                GROUP BY project_id
            ) k ON k.project_id = p.id
        """
        if doc_table
        else """
            LEFT JOIN (
                SELECT NULL::uuid AS project_id, 0::int AS document_count
            ) k ON k.project_id = p.id
        """
    )

    member_join = (
        """
            LEFT JOIN (
                SELECT project_id, COUNT(*) AS member_count
                FROM project_member
                GROUP BY project_id
            ) pm ON pm.project_id = p.id
        """
        if has_project_member
        else """
            LEFT JOIN (
                SELECT NULL::uuid AS project_id, 0::int AS member_count
            ) pm ON pm.project_id = p.id
        """
    )

    row = db.execute(
        text(
            f"""
            SELECT
                p.id::text,
                p.name,
                p.code,
                p.description,
                p.objective,
                p.status,
                p.owner_id::text,
                p.organization_id::text,
                p.department_id::text,
                p.created_at,
                p.updated_at,
                COALESCE(m.meeting_count, 0) AS meeting_count,
                COALESCE(k.document_count, 0) AS document_count,
                COALESCE(pm.member_count, 0) AS member_count
            FROM project p
            LEFT JOIN (
                SELECT project_id, COUNT(*) AS meeting_count
                FROM meeting
                WHERE project_id IS NOT NULL
                GROUP BY project_id
            ) m ON m.project_id = p.id
            {doc_join}
            {member_join}
            WHERE p.id = :project_id
            """
        ),
        {"project_id": project_id},
    ).mappings().first()

    if not row:
        return None
    return _row_to_project(row)


def create_project(db: Session, payload: ProjectCreate) -> Project:
    project_id = str(uuid4())
    now = datetime.utcnow()

    db.execute(
        text(
            """
            INSERT INTO project (
                id, name, code, description, objective, status,
                owner_id, organization_id, department_id,
                created_at, updated_at
            )
            VALUES (
                :id, :name, :code, :description, :objective, :status,
                :owner_id, :organization_id, :department_id,
                :created_at, :updated_at
            )
            """
        ),
        {
            "id": project_id,
            "name": payload.name,
            "code": payload.code,
            "description": payload.description,
            "objective": payload.objective,
            "status": payload.status or "active",
            "owner_id": payload.owner_id,
            "organization_id": payload.organization_id,
            "department_id": payload.department_id,
            "created_at": now,
            "updated_at": now,
        },
    )

    if payload.owner_id:
        db.execute(
            text(
                """
                INSERT INTO project_member (project_id, user_id, role, joined_at)
                VALUES (:project_id, :user_id, 'owner', :joined_at)
                ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner'
                """
            ),
            {"project_id": project_id, "user_id": payload.owner_id, "joined_at": now},
        )

    db.commit()
    created = get_project(db, project_id)
    if created:
        return created
    return Project(
        id=project_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        objective=payload.objective,
        status=payload.status or "active",
        owner_id=payload.owner_id,
        organization_id=payload.organization_id,
        department_id=payload.department_id,
        created_at=now,
        updated_at=now,
    )


def update_project(db: Session, project_id: str, payload: ProjectUpdate) -> Optional[Project]:
    update_fields = []
    params: dict[str, object] = {"project_id": project_id, "updated_at": datetime.utcnow()}

    if payload.name is not None:
        update_fields.append("name = :name")
        params["name"] = payload.name
    if payload.code is not None:
        update_fields.append("code = :code")
        params["code"] = payload.code
    if payload.description is not None:
        update_fields.append("description = :description")
        params["description"] = payload.description
    if payload.objective is not None:
        update_fields.append("objective = :objective")
        params["objective"] = payload.objective
    if payload.status is not None:
        update_fields.append("status = :status")
        params["status"] = payload.status
    if payload.owner_id is not None:
        update_fields.append("owner_id = :owner_id")
        params["owner_id"] = payload.owner_id
    if payload.organization_id is not None:
        update_fields.append("organization_id = :organization_id")
        params["organization_id"] = payload.organization_id
    if payload.department_id is not None:
        update_fields.append("department_id = :department_id")
        params["department_id"] = payload.department_id

    if not update_fields:
        return get_project(db, project_id)

    update_fields.append("updated_at = :updated_at")

    query = text(
        f"""
        UPDATE project
        SET {', '.join(update_fields)}
        WHERE id = :project_id
        """
    )
    db.execute(query, params)
    db.commit()

    if payload.owner_id:
        db.execute(
            text(
                """
                INSERT INTO project_member (project_id, user_id, role, joined_at)
                VALUES (:project_id, :user_id, 'owner', :joined_at)
                ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner'
                """
            ),
            {"project_id": project_id, "user_id": payload.owner_id, "joined_at": datetime.utcnow()},
        )
        db.commit()

    return get_project(db, project_id)


def delete_project(db: Session, project_id: str) -> bool:
    # Unlink related data to avoid FK violations
    db.execute(text("UPDATE meeting SET project_id = NULL WHERE project_id = :project_id"), {"project_id": project_id})
    db.execute(text("UPDATE action_item SET project_id = NULL WHERE project_id = :project_id"), {"project_id": project_id})
    db.execute(text("UPDATE document SET project_id = NULL WHERE project_id = :project_id"), {"project_id": project_id})
    db.execute(text("UPDATE knowledge_document SET project_id = NULL WHERE project_id = :project_id"), {"project_id": project_id})

    result = db.execute(text("DELETE FROM project WHERE id = :project_id RETURNING id"), {"project_id": project_id})
    db.commit()
    return result.fetchone() is not None


def list_members(db: Session, project_id: str) -> ProjectMemberList:
    rows = db.execute(
        text(
            """
            SELECT
                pm.project_id::text,
                pm.user_id::text,
                pm.role,
                pm.joined_at,
                u.display_name,
                u.email
            FROM project_member pm
            LEFT JOIN user_account u ON pm.user_id = u.id
            WHERE pm.project_id = :project_id
            ORDER BY pm.joined_at DESC NULLS LAST
            """
        ),
        {"project_id": project_id},
    ).mappings().all()

    members = [
        ProjectMember(
            project_id=row.get("project_id"),
            user_id=row.get("user_id"),
            role=row.get("role") or "member",
            joined_at=row.get("joined_at"),
            display_name=row.get("display_name"),
            email=row.get("email"),
        )
        for row in rows
    ]
    return ProjectMemberList(members=members, total=len(members))


def add_member(db: Session, project_id: str, payload: ProjectMemberCreate) -> Optional[ProjectMember]:
    now = datetime.utcnow()
    db.execute(
        text(
            """
            INSERT INTO project_member (project_id, user_id, role, joined_at)
            VALUES (:project_id, :user_id, :role, :joined_at)
            ON CONFLICT (project_id, user_id) DO UPDATE
            SET role = :role
            """
        ),
        {
            "project_id": project_id,
            "user_id": payload.user_id,
            "role": payload.role or "member",
            "joined_at": now,
        },
    )
    db.commit()

    row = db.execute(
        text(
            """
            SELECT
                pm.project_id::text,
                pm.user_id::text,
                pm.role,
                pm.joined_at,
                u.display_name,
                u.email
            FROM project_member pm
            LEFT JOIN user_account u ON pm.user_id = u.id
            WHERE pm.project_id = :project_id AND pm.user_id = :user_id
            """
        ),
        {"project_id": project_id, "user_id": payload.user_id},
    ).mappings().first()

    if not row:
        return None

    return ProjectMember(
        project_id=row.get("project_id"),
        user_id=row.get("user_id"),
        role=row.get("role") or "member",
        joined_at=row.get("joined_at"),
        display_name=row.get("display_name"),
        email=row.get("email"),
    )


def remove_member(db: Session, project_id: str, user_id: str) -> bool:
    result = db.execute(
        text("DELETE FROM project_member WHERE project_id = :project_id AND user_id = :user_id RETURNING user_id"),
        {"project_id": project_id, "user_id": user_id},
    )
    db.commit()
    return result.fetchone() is not None
