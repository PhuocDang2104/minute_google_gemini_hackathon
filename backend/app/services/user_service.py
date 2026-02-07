from typing import Optional, List, Tuple, Dict, Any
import json
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.schemas.user import User, UserList, Department
from app.schemas.llm_settings import LlmSettings, LlmSettingsUpdate
from app.core.config import get_settings
from app.utils.crypto import encrypt_secret, decrypt_secret

settings = get_settings()

_DEMO_LLM_USER_ID = "00000000-0000-0000-0000-000000000001"


def _resolve_llm_user_id(user_id: str) -> Tuple[str, bool]:
    try:
        uuid.UUID(str(user_id))
        return str(user_id), False
    except (ValueError, TypeError):
        return _DEMO_LLM_USER_ID, True


def _ensure_demo_user(db: Session, user_id: str) -> None:
    demo_email = f"demo-llm-{user_id[:8]}@minute.local"
    insert_query = text(
        """
        INSERT INTO user_account (id, email, display_name, role, is_active, created_at, updated_at)
        VALUES (:id, :email, :display_name, 'user', true, now(), now())
        ON CONFLICT (id) DO NOTHING
        """
    )
    db.execute(
        insert_query,
        {"id": user_id, "email": demo_email, "display_name": "Demo LLM"},
    )
    db.commit()


def get_user_stub() -> User:
    """Stub user for testing"""
    return User(
        id='u0000001-0000-0000-0000-000000000001',
        email='nguyenvana@lpbank.vn',
        display_name='Nguyễn Văn A',
        role='PMO',
        department_name='PMO'
    )


def list_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    department_id: Optional[str] = None
) -> Tuple[List[User], int]:
    """List all users with optional filters"""
    
    query = """
        SELECT 
            u.id::text, u.email, u.display_name, u.role,
            u.department_id::text, u.avatar_url,
            u.organization_id::text, u.created_at,
            u.last_login_at, u.is_active,
            d.name as department_name
        FROM user_account u
        LEFT JOIN department d ON u.department_id = d.id
        WHERE 1=1
    """
    count_query = "SELECT COUNT(*) FROM user_account u WHERE 1=1"
    params = {}
    
    if search:
        query += " AND (u.display_name ILIKE :search OR u.email ILIKE :search)"
        count_query += " AND (u.display_name ILIKE :search OR u.email ILIKE :search)"
        params['search'] = f'%{search}%'
    
    if department_id:
        query += " AND u.department_id = :department_id"
        count_query += " AND u.department_id = :department_id"
        params['department_id'] = department_id
    
    query += " ORDER BY u.display_name LIMIT :limit OFFSET :skip"
    params['limit'] = limit
    params['skip'] = skip
    
    result = db.execute(text(query), params)
    rows = result.fetchall()
    
    count_result = db.execute(text(count_query), {k: v for k, v in params.items() if k not in ['limit', 'skip']})
    total = count_result.scalar()
    
    users = []
    for row in rows:
        users.append(User(
            id=row[0],
            email=row[1],
            display_name=row[2],
            role=row[3] or 'user',
            department_id=row[4],
            avatar_url=row[5],
            organization_id=row[6],
            created_at=row[7],
            last_login_at=row[8],
            is_active=row[9] if row[9] is not None else True,
            department_name=row[10]
        ))
    
    return users, total


def get_user(db: Session, user_id: str) -> Optional[User]:
    """Get a user by ID"""
    query = text("""
        SELECT 
            u.id::text, u.email, u.display_name, u.role,
            u.department_id::text, u.avatar_url,
            u.organization_id::text, u.created_at,
            u.last_login_at, u.is_active,
            d.name as department_name
        FROM user_account u
        LEFT JOIN department d ON u.department_id = d.id
        WHERE u.id = :user_id
    """)
    
    result = db.execute(query, {'user_id': user_id})
    row = result.fetchone()
    
    if not row:
        return None
    
    return User(
        id=row[0],
        email=row[1],
        display_name=row[2],
        role=row[3] or 'user',
        department_id=row[4],
        avatar_url=row[5],
        organization_id=row[6],
        created_at=row[7],
        last_login_at=row[8],
        is_active=row[9] if row[9] is not None else True,
        department_name=row[10]
    )


def update_user_role(db: Session, user_id: str, new_role: str) -> Optional[User]:
    """Update user role and return updated user"""
    update_query = text("""
        UPDATE user_account
        SET role = :role, updated_at = now()
        WHERE id = :user_id
        RETURNING id::text
    """)
    result = db.execute(update_query, {'role': new_role, 'user_id': user_id})
    row = result.fetchone()
    if not row:
        db.rollback()
        return None
    db.commit()
    return get_user(db, user_id)


def update_user_status(db: Session, user_id: str, is_active: bool) -> Optional[User]:
    """Activate/deactivate user"""
    update_query = text("""
        UPDATE user_account
        SET is_active = :is_active, updated_at = now()
        WHERE id = :user_id
        RETURNING id::text
    """)
    result = db.execute(update_query, {'is_active': is_active, 'user_id': user_id})
    row = result.fetchone()
    if not row:
        db.rollback()
        return None
    db.commit()
    return get_user(db, user_id)


def list_departments(db: Session) -> Tuple[List[Department], int]:
    """List all departments"""
    query = text("""
        SELECT id::text, name, organization_id::text
        FROM department
        ORDER BY name
    """)
    
    result = db.execute(query)
    rows = result.fetchall()
    
    departments = [
        Department(id=row[0], name=row[1], organization_id=row[2])
        for row in rows
    ]
    
    return departments, len(departments)


def _normalize_llm_settings(raw_llm: Dict[str, Any]) -> LlmSettings:
    provider = raw_llm.get("provider") or "gemini"
    if provider not in ("gemini", "groq"):
        provider = "gemini"
    default_model = settings.gemini_model if provider == "gemini" else settings.groq_model
    model = raw_llm.get("model") or default_model
    api_key_encrypted = raw_llm.get("api_key") or ""
    api_key_last4 = raw_llm.get("api_key_last4")
    api_key_set = bool(api_key_encrypted)
    if api_key_set and not api_key_last4:
        plain = decrypt_secret(api_key_encrypted)
        if plain:
            api_key_last4 = plain[-4:]
    return LlmSettings(
        provider=provider,
        model=model,
        api_key_set=api_key_set,
        api_key_last4=api_key_last4,
    )


def get_llm_settings(db: Session, user_id: str) -> Optional[LlmSettings]:
    resolved_id, is_demo = _resolve_llm_user_id(user_id)
    if is_demo:
        _ensure_demo_user(db, resolved_id)
    query = text("SELECT preferences FROM user_account WHERE id = :user_id")
    result = db.execute(query, {"user_id": resolved_id})
    row = result.fetchone()
    if not row:
        if is_demo:
            return _normalize_llm_settings({})
        return None
    prefs = row[0] or {}
    if not isinstance(prefs, dict):
        prefs = {}
    llm = prefs.get("llm") or {}
    if not isinstance(llm, dict):
        llm = {}
    return _normalize_llm_settings(llm)


def update_llm_settings(
    db: Session, user_id: str, payload: LlmSettingsUpdate
) -> Optional[LlmSettings]:
    resolved_id, is_demo = _resolve_llm_user_id(user_id)
    if is_demo:
        _ensure_demo_user(db, resolved_id)
    query = text("SELECT preferences FROM user_account WHERE id = :user_id")
    result = db.execute(query, {"user_id": resolved_id})
    row = result.fetchone()
    if not row:
        if is_demo:
            prefs = {}
        else:
            return None
    else:
        prefs = row[0] or {}
    if not isinstance(prefs, dict):
        prefs = {}
    llm = prefs.get("llm") or {}
    if not isinstance(llm, dict):
        llm = {}
    llm["provider"] = payload.provider
    llm["model"] = payload.model
    if payload.clear_api_key:
        llm.pop("api_key", None)
        llm.pop("api_key_last4", None)
    elif payload.api_key is not None:
        llm["api_key"] = encrypt_secret(payload.api_key)
        llm["api_key_last4"] = payload.api_key[-4:]
    prefs["llm"] = llm
    update_query = text(
        """
        UPDATE user_account
        SET preferences = CAST(:preferences AS jsonb), updated_at = now()
        WHERE id = :user_id
        RETURNING id::text
        """
    )
    result = db.execute(
        update_query,
        {"preferences": json.dumps(prefs), "user_id": resolved_id},
    )
    row = result.fetchone()
    if not row:
        db.rollback()
        if is_demo:
            return _normalize_llm_settings(llm)
        return None
    db.commit()
    return _normalize_llm_settings(llm)


def get_user_llm_override(db: Session, user_id: str) -> Optional[Dict[str, str]]:
    def _fetch_override(target_user_id: str) -> Optional[Dict[str, str]]:
        query = text("SELECT preferences FROM user_account WHERE id = :user_id")
        result = db.execute(query, {"user_id": target_user_id})
        row = result.fetchone()
        if not row:
            return None
        prefs = row[0] or {}
        if not isinstance(prefs, dict):
            return None
        llm = prefs.get("llm") or {}
        if not isinstance(llm, dict):
            return None
        provider = llm.get("provider") or ""
        model = llm.get("model") or ""
        api_key = decrypt_secret(llm.get("api_key") or "")
        if not (provider and model and api_key):
            return None
        if provider not in ("gemini", "groq"):
            return None
        return {"provider": provider, "model": model, "api_key": api_key}

    try:
        uuid.UUID(str(user_id))
        override = _fetch_override(str(user_id))
    except (ValueError, TypeError):
        override = None

    if override:
        return override

    demo_id = _DEMO_LLM_USER_ID
    if user_id == demo_id:
        return None
    return _fetch_override(demo_id)
