from datetime import datetime
from typing import Optional, List, Tuple
from uuid import uuid4
import logging
from pathlib import Path

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
from app.services.storage_client import delete_object, is_storage_configured


logger = logging.getLogger(__name__)


def _table_exists(db: Session, table_name: str) -> bool:
    res = db.execute(text("SELECT to_regclass(:t)"), {"t": f"public.{table_name}"}).scalar()
    return res is not None


def _table_has_column(db: Session, table_name: str, column_name: str) -> bool:
    try:
        result = db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
                LIMIT 1
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        ).fetchone()
        return bool(result)
    except Exception:
        return False


def _collect_assets_by_scope(db: Session, table_name: str, scope_column: str, scope_value: str) -> list[dict]:
    if not _table_exists(db, table_name) or not _table_has_column(db, table_name, scope_column):
        return []
    fields: list[str] = []
    for col in ("storage_key", "file_url", "provider"):
        if _table_has_column(db, table_name, col):
            fields.append(col)
    if not fields:
        return []
    rows = db.execute(
        text(f"SELECT {', '.join(fields)} FROM {table_name} WHERE {scope_column} = :scope_value"),
        {"scope_value": scope_value},
    ).mappings().all()
    return [
        {
            "storage_key": row.get("storage_key"),
            "file_url": row.get("file_url"),
            "provider": row.get("provider"),
        }
        for row in rows
    ]


def _delete_rows_by_scope(db: Session, table_name: str, scope_column: str, scope_value: str) -> None:
    if not _table_exists(db, table_name) or not _table_has_column(db, table_name, scope_column):
        return
    db.execute(
        text(f"DELETE FROM {table_name} WHERE {scope_column} = :scope_value"),
        {"scope_value": scope_value},
    )


def _delete_file_assets(assets: list[dict]) -> None:
    backend_root = Path(__file__).resolve().parents[2]
    seen: set[tuple[str, str]] = set()
    for asset in assets:
        storage_key = str(asset.get("storage_key") or "").strip()
        file_url = str(asset.get("file_url") or "").strip()
        provider = str(asset.get("provider") or "").strip().lower()
        key = (storage_key, file_url)
        if key in seen:
            continue
        seen.add(key)
        if storage_key and (provider == "supabase" or is_storage_configured()):
            try:
                delete_object(storage_key)
            except Exception as exc:
                logger.warning("Failed to delete storage object %s: %s", storage_key, exc)
        if file_url and file_url.startswith("/files/"):
            relative = file_url[len("/files/"):].lstrip("/")
            candidates = [
                backend_root / "uploaded_files" / relative,
                backend_root / file_url.lstrip("/"),
                Path("/app/uploaded_files") / relative,
                Path("/app") / file_url.lstrip("/"),
            ]
            for path in candidates:
                try:
                    if path.exists() and path.is_file():
                        path.unlink()
                        break
                except Exception as exc:
                    logger.warning("Failed to delete local file %s: %s", path, exc)


def _remove_mock_docs_for_project(project_id: str) -> None:
    try:
        from app.services import knowledge_service
        keys = [
            key
            for key, doc in getattr(knowledge_service, "_mock_knowledge_docs", {}).items()
            if str(getattr(doc, "project_id", "")) == str(project_id)
        ]
        for key in keys:
            knowledge_service._mock_knowledge_docs.pop(key, None)
    except Exception:
        pass
    try:
        from app.services import document_service
        keys = [
            key
            for key, doc in getattr(document_service, "_mock_documents", {}).items()
            if str(getattr(doc, "project_id", "")) == str(project_id)
        ]
        for key in keys:
            document_service._mock_documents.pop(key, None)
    except Exception:
        pass


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
    # 1) Delete all sessions/meetings under this project (deep cleanup).
    try:
        from app.services import meeting_service
        meeting_rows = db.execute(
            text("SELECT id::text FROM meeting WHERE project_id = :project_id"),
            {"project_id": project_id},
        ).fetchall()
        meeting_ids = [row[0] for row in meeting_rows if row and row[0]]
    except Exception as exc:
        db.rollback()
        logger.error("Failed to load meetings for project delete %s: %s", project_id, exc, exc_info=True)
        return False

    for meeting_id in meeting_ids:
        ok = meeting_service.delete_meeting(db, meeting_id)
        if not ok:
            logger.warning("Meeting %s could not be deleted while deleting project %s", meeting_id, project_id)

    # 2) Delete project-scoped docs/assets that are not tied to a deleted meeting.
    assets: list[dict] = []
    try:
        assets.extend(_collect_assets_by_scope(db, "knowledge_document", "project_id", project_id))
        assets.extend(_collect_assets_by_scope(db, "document", "project_id", project_id))
        assets.extend(_collect_assets_by_scope(db, "documents", "project_id", project_id))
    except Exception as exc:
        logger.warning("Failed to collect project assets before delete %s: %s", project_id, exc)

    try:
        # Chunks scoped by project (legacy/project-only chunks).
        _delete_rows_by_scope(db, "knowledge_chunk", "scope_project", project_id)

        # Project-only metadata/history rows.
        _delete_rows_by_scope(db, "action_item", "project_id", project_id)
        _delete_rows_by_scope(db, "knowledge_document", "project_id", project_id)
        _delete_rows_by_scope(db, "document", "project_id", project_id)
        _delete_rows_by_scope(db, "documents", "project_id", project_id)
        _delete_rows_by_scope(db, "project_member", "project_id", project_id)

        # Safety: remove any meeting that still references this project.
        leftover_meetings = db.execute(
            text("SELECT id::text FROM meeting WHERE project_id = :project_id"),
            {"project_id": project_id},
        ).fetchall()
        for row in leftover_meetings:
            if row and row[0]:
                from app.services import meeting_service
                meeting_service.delete_meeting(db, row[0])

        result = db.execute(
            text("DELETE FROM project WHERE id = :project_id RETURNING id"),
            {"project_id": project_id},
        )
        row = result.fetchone()
        if not row:
            db.rollback()
            return False
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete project %s: %s", project_id, exc, exc_info=True)
        return False

    _delete_file_assets(assets)
    _remove_mock_docs_for_project(project_id)
    return True


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
