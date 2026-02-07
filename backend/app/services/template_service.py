"""
Minutes Template Service
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.minutes_template import (
    MinutesTemplateCreate,
    MinutesTemplateUpdate,
    MinutesTemplateResponse,
    MinutesTemplateList,
)


DEFAULT_TEMPLATE_ID = "00000000-0000-0000-0000-000000000101"
DEFAULT_TEMPLATE_CODE = "default-meeting"
DEFAULT_TEMPLATE_STRUCTURE = {
    "sections": [
        {"id": "summary", "title": "Executive Summary", "order": 1},
        {"id": "key_points", "title": "Key Points", "order": 2},
        {"id": "action_items", "title": "Action Items", "order": 3},
        {"id": "decisions", "title": "Decisions", "order": 4},
        {"id": "risks", "title": "Risks", "order": 5},
        {"id": "next_steps", "title": "Next Steps", "order": 6},
    ]
}


def _minutes_template_table_exists(db: Session) -> bool:
    result = db.execute(
        text("SELECT to_regclass('public.minutes_template')")
    ).scalar()
    return bool(result)


def _default_template() -> MinutesTemplateResponse:
    now = datetime.utcnow()
    return MinutesTemplateResponse(
        id=DEFAULT_TEMPLATE_ID,
        name="Default Meeting Template",
        code=DEFAULT_TEMPLATE_CODE,
        description="Fallback template when minutes_template table is unavailable.",
        structure=DEFAULT_TEMPLATE_STRUCTURE,
        sample_data=None,
        meeting_types=None,
        is_default=True,
        is_active=True,
        version=1,
        created_by=None,
        created_at=now,
        updated_by=None,
        updated_at=now,
        parent_template_id=None,
    )


def _fallback_templates(
    meeting_type: Optional[str],
    is_active: Optional[bool],
    skip: int,
    limit: int,
) -> MinutesTemplateList:
    template = _default_template()
    templates: List[MinutesTemplateResponse] = []

    if is_active is False:
        return MinutesTemplateList(templates=[], total=0)

    if meeting_type and template.meeting_types:
        if meeting_type not in template.meeting_types:
            return MinutesTemplateList(templates=[], total=0)

    templates.append(template)
    sliced = templates[skip : skip + limit]
    return MinutesTemplateList(templates=sliced, total=len(templates))


def _require_minutes_template_table(db: Session) -> None:
    if not _minutes_template_table_exists(db):
        raise RuntimeError(
            "minutes_template table does not exist. Run migration: `cd backend && PYTHONPATH=. alembic upgrade head`"
        )


def list_templates(
    db: Session,
    meeting_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    skip: int = 0,
    limit: int = 100,
) -> MinutesTemplateList:
    """List all templates"""
    if not _minutes_template_table_exists(db):
        return _fallback_templates(meeting_type, is_active, skip, limit)

    query = """
        SELECT 
            id::text, name, code, description, structure, sample_data,
            meeting_types, is_default, is_active, version,
            created_by::text, created_at, updated_by::text, updated_at,
            parent_template_id::text
        FROM minutes_template
        WHERE 1=1
    """
    params = {}
    
    if is_active is not None:
        query += " AND is_active = :is_active"
        params['is_active'] = is_active
    
    if meeting_type:
        query += " AND (:meeting_type = ANY(meeting_types) OR meeting_types IS NULL)"
        params['meeting_type'] = meeting_type
    
    query += " ORDER BY is_default DESC, name ASC"
    query += " LIMIT :limit OFFSET :skip"
    params['limit'] = limit
    params['skip'] = skip
    
    try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
    except Exception:
        db.rollback()
        return _fallback_templates(meeting_type, is_active, skip, limit)
    
    templates = []
    for row in rows:
        templates.append(MinutesTemplateResponse(
            id=row[0],
            name=row[1],
            code=row[2] if row[2] else None,
            description=row[3] if row[3] else None,
            structure=row[4] if row[4] else {},
            sample_data=row[5] if row[5] else None,
            meeting_types=row[6] if row[6] else None,
            is_default=row[7] if row[7] is not None else False,
            is_active=row[8] if row[8] is not None else True,
            version=row[9] if row[9] is not None else 1,
            created_by=row[10] if row[10] else None,
            created_at=row[11],
            updated_by=row[12] if row[12] else None,
            updated_at=row[13],
            parent_template_id=row[14] if row[14] else None,
        ))
    
    # Get total count
    count_query = "SELECT COUNT(*) FROM minutes_template WHERE 1=1"
    count_params = {}
    if is_active is not None:
        count_query += " AND is_active = :is_active"
        count_params['is_active'] = is_active
    if meeting_type:
        count_query += " AND (:meeting_type = ANY(meeting_types) OR meeting_types IS NULL)"
        count_params['meeting_type'] = meeting_type
    
    try:
        total = db.execute(text(count_query), count_params).scalar()
    except Exception:
        db.rollback()
        return _fallback_templates(meeting_type, is_active, skip, limit)
    
    return MinutesTemplateList(templates=templates, total=total)


def get_template(db: Session, template_id: str) -> Optional[MinutesTemplateResponse]:
    """Get a single template by ID"""
    if not _minutes_template_table_exists(db):
        default_tpl = _default_template()
        if template_id in {DEFAULT_TEMPLATE_ID, DEFAULT_TEMPLATE_CODE}:
            return default_tpl
        return None

    query = text("""
        SELECT 
            id::text, name, code, description, structure, sample_data,
            meeting_types, is_default, is_active, version,
            created_by::text, created_at, updated_by::text, updated_at,
            parent_template_id::text
        FROM minutes_template
        WHERE id = :template_id
    """)
    
    result = db.execute(query, {'template_id': template_id})
    row = result.fetchone()
    
    if not row:
        return None
    
    return MinutesTemplateResponse(
        id=row[0],
        name=row[1],
        code=row[2] if row[2] else None,
        description=row[3] if row[3] else None,
        structure=row[4] if row[4] else {},
        sample_data=row[5] if row[5] else None,
        meeting_types=row[6] if row[6] else None,
        is_default=row[7] if row[7] is not None else False,
        is_active=row[8] if row[8] is not None else True,
        version=row[9] if row[9] is not None else 1,
        created_by=row[10] if row[10] else None,
        created_at=row[11],
        updated_by=row[12] if row[12] else None,
        updated_at=row[13],
        parent_template_id=row[14] if row[14] else None,
    )


def get_template_by_code(db: Session, code: str) -> Optional[MinutesTemplateResponse]:
    """Get template by code"""
    if not _minutes_template_table_exists(db):
        default_tpl = _default_template()
        if code == default_tpl.code:
            return default_tpl
        return None

    query = text("""
        SELECT 
            id::text, name, code, description, structure, sample_data,
            meeting_types, is_default, is_active, version,
            created_by::text, created_at, updated_by::text, updated_at,
            parent_template_id::text
        FROM minutes_template
        WHERE code = :code
    """)
    
    result = db.execute(query, {'code': code})
    row = result.fetchone()
    
    if not row:
        return None
    
    return MinutesTemplateResponse(
        id=row[0],
        name=row[1],
        code=row[2] if row[2] else None,
        description=row[3] if row[3] else None,
        structure=row[4] if row[4] else {},
        sample_data=row[5] if row[5] else None,
        meeting_types=row[6] if row[6] else None,
        is_default=row[7] if row[7] is not None else False,
        is_active=row[8] if row[8] is not None else True,
        version=row[9] if row[9] is not None else 1,
        created_by=row[10] if row[10] else None,
        created_at=row[11],
        updated_by=row[12] if row[12] else None,
        updated_at=row[13],
        parent_template_id=row[14] if row[14] else None,
    )


def get_default_template(db: Session) -> Optional[MinutesTemplateResponse]:
    """Get the default template"""
    if not _minutes_template_table_exists(db):
        return _default_template()

    query = text("""
        SELECT 
            id::text, name, code, description, structure, sample_data,
            meeting_types, is_default, is_active, version,
            created_by::text, created_at, updated_by::text, updated_at,
            parent_template_id::text
        FROM minutes_template
        WHERE is_default = TRUE AND is_active = TRUE
        LIMIT 1
    """)
    
    result = db.execute(query)
    row = result.fetchone()
    
    if not row:
        return None
    
    return MinutesTemplateResponse(
        id=row[0],
        name=row[1],
        code=row[2] if row[2] else None,
        description=row[3] if row[3] else None,
        structure=row[4] if row[4] else {},
        sample_data=row[5] if row[5] else None,
        meeting_types=row[6] if row[6] else None,
        is_default=row[7] if row[7] is not None else False,
        is_active=row[8] if row[8] is not None else True,
        version=row[9] if row[9] is not None else 1,
        created_by=row[10] if row[10] else None,
        created_at=row[11],
        updated_by=row[12] if row[12] else None,
        updated_at=row[13],
        parent_template_id=row[14] if row[14] else None,
    )


def create_template(db: Session, data: MinutesTemplateCreate) -> MinutesTemplateResponse:
    """Create a new template"""
    from uuid import uuid4
    from datetime import datetime
    import json
    
    _require_minutes_template_table(db)

    template_id = str(uuid4())
    now = datetime.utcnow()
    
    # If setting as default, unset other defaults
    if data.is_default:
        db.execute(
            text("UPDATE minutes_template SET is_default = FALSE WHERE is_default = TRUE")
        )
    
    query = text("""
        INSERT INTO minutes_template (
            id, name, code, description, structure, sample_data,
            meeting_types, is_default, is_active, version,
            created_by, created_at, updated_at
        )
        VALUES (
            :id, :name, :code, :description, :structure, :sample_data,
            :meeting_types, :is_default, :is_active, :version,
            :created_by, :created_at, :updated_at
        )
        RETURNING id::text
    """)
    
    db.execute(query, {
        'id': template_id,
        'name': data.name,
        'code': data.code,
        'description': data.description,
        'structure': json.dumps(data.structure),
        'sample_data': json.dumps(data.sample_data) if data.sample_data else None,
        'meeting_types': data.meeting_types,
        'is_default': data.is_default,
        'is_active': data.is_active,
        'version': 1,
        'created_by': UUID(data.created_by) if data.created_by else None,
        'created_at': now,
        'updated_at': now,
    })
    db.commit()
    
    return get_template(db, template_id)


def update_template(
    db: Session,
    template_id: str,
    data: MinutesTemplateUpdate,
) -> Optional[MinutesTemplateResponse]:
    """Update a template"""
    from datetime import datetime
    import json
    
    _require_minutes_template_table(db)

    update_fields = []
    params = {'template_id': template_id, 'updated_at': datetime.utcnow()}
    
    if data.name is not None:
        update_fields.append("name = :name")
        params['name'] = data.name
    
    if data.code is not None:
        update_fields.append("code = :code")
        params['code'] = data.code
    
    if data.description is not None:
        update_fields.append("description = :description")
        params['description'] = data.description
    
    if data.structure is not None:
        update_fields.append("structure = :structure")
        params['structure'] = json.dumps(data.structure)
    
    if data.sample_data is not None:
        update_fields.append("sample_data = :sample_data")
        params['sample_data'] = json.dumps(data.sample_data)
    
    if data.meeting_types is not None:
        update_fields.append("meeting_types = :meeting_types")
        params['meeting_types'] = data.meeting_types
    
    if data.is_default is not None:
        # If setting as default, unset other defaults
        if data.is_default:
            db.execute(
                text("UPDATE minutes_template SET is_default = FALSE WHERE is_default = TRUE AND id != :template_id"),
                {'template_id': template_id}
            )
        update_fields.append("is_default = :is_default")
        params['is_default'] = data.is_default
    
    if data.is_active is not None:
        update_fields.append("is_active = :is_active")
        params['is_active'] = data.is_active
    
    if data.updated_by is not None:
        update_fields.append("updated_by = :updated_by")
        params['updated_by'] = UUID(data.updated_by)
    
    if not update_fields:
        return get_template(db, template_id)
    
    update_fields.append("updated_at = :updated_at")
    
    query = text(f"""
        UPDATE minutes_template
        SET {', '.join(update_fields)}
        WHERE id = :template_id
    """)
    
    db.execute(query, params)
    db.commit()
    
    return get_template(db, template_id)


def delete_template(db: Session, template_id: str) -> bool:
    """Delete a template"""
    _require_minutes_template_table(db)

    query = text("DELETE FROM minutes_template WHERE id = :template_id")
    result = db.execute(query, {'template_id': template_id})
    db.commit()
    
    return result.rowcount > 0


def set_default_template(db: Session, template_id: str) -> Optional[MinutesTemplateResponse]:
    """Set a template as default"""
    _require_minutes_template_table(db)

    # Unset other defaults
    db.execute(text("UPDATE minutes_template SET is_default = FALSE WHERE is_default = TRUE"))
    
    # Set this as default
    query = text("""
        UPDATE minutes_template
        SET is_default = TRUE, updated_at = NOW()
        WHERE id = :template_id
    """)
    result = db.execute(query, {'template_id': template_id})
    db.commit()
    
    if result.rowcount == 0:
        return None
    
    return get_template(db, template_id)
