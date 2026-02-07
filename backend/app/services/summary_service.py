"""
Meeting Summary persistence service.
Stores generated summaries so refresh/revisit does not lose content.
"""
from __future__ import annotations

from datetime import datetime
import json
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session


def _table_exists(db: Session, table_name: str) -> bool:
    try:
        result = db.execute(
            text("SELECT to_regclass(:table_name)"),
            {"table_name": f"public.{table_name}"},
        ).scalar()
        return bool(result)
    except Exception:
        return False


def ensure_summary_table(db: Session) -> None:
    """
    Safety net for environments with partial migrations.
    """
    try:
        if not _table_exists(db, "meeting_summary"):
            db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS meeting_summary (
                        id UUID PRIMARY KEY,
                        meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
                        version INTEGER NOT NULL DEFAULT 1,
                        content TEXT NOT NULL,
                        summary_type VARCHAR(64) NOT NULL DEFAULT 'full',
                        artifacts JSONB,
                        created_at TIMESTAMPTZ DEFAULT now(),
                        updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
            )
        else:
            db.execute(text("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS version INTEGER;"))
            db.execute(text("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS summary_type VARCHAR(64);"))
            db.execute(text("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS artifacts JSONB;"))
            db.execute(text("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();"))
            db.execute(text("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();"))
            db.execute(text("UPDATE meeting_summary SET version = 1 WHERE version IS NULL;"))
            db.execute(text("UPDATE meeting_summary SET summary_type = 'full' WHERE summary_type IS NULL OR summary_type = '';"))
            db.execute(text("ALTER TABLE meeting_summary ALTER COLUMN version SET DEFAULT 1;"))
            db.execute(text("ALTER TABLE meeting_summary ALTER COLUMN summary_type SET DEFAULT 'full';"))
            db.execute(text("ALTER TABLE meeting_summary ALTER COLUMN version SET NOT NULL;"))
            db.execute(text("ALTER TABLE meeting_summary ALTER COLUMN summary_type SET NOT NULL;"))
            db.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'meeting_summary'
                              AND column_name = 'artifacts'
                              AND udt_name = 'json'
                        ) THEN
                            ALTER TABLE meeting_summary
                            ALTER COLUMN artifacts TYPE JSONB
                            USING artifacts::jsonb;
                        END IF;
                    END $$;
                    """
                )
            )

        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_meeting_summary_meeting_created ON meeting_summary(meeting_id, created_at DESC);"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_meeting_summary_meeting_type_version ON meeting_summary(meeting_id, summary_type, version DESC);"
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise


def create_summary(
    db: Session,
    *,
    meeting_id: str,
    content: str,
    summary_type: str = "full",
    artifacts: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    ensure_summary_table(db)

    clean_content = (content or "").strip()
    if not clean_content:
        raise ValueError("summary content must not be empty")

    version = db.execute(
        text(
            """
            SELECT COALESCE(MAX(version), 0) + 1
            FROM meeting_summary
            WHERE meeting_id = :meeting_id
              AND summary_type = :summary_type
            """
        ),
        {"meeting_id": meeting_id, "summary_type": summary_type},
    ).scalar_one()

    summary_id = str(uuid4())
    now = datetime.utcnow()
    artifacts_json = json.dumps(artifacts) if artifacts is not None else None

    row = db.execute(
        text(
            """
            INSERT INTO meeting_summary (
                id, meeting_id, version, content, summary_type, artifacts, created_at, updated_at
            )
            VALUES (
                :id, :meeting_id, :version, :content, :summary_type,
                CAST(:artifacts AS JSON), :created_at, :updated_at
            )
            RETURNING id::text, version, summary_type, content, artifacts, created_at
            """
        ),
        {
            "id": summary_id,
            "meeting_id": meeting_id,
            "version": version,
            "content": clean_content,
            "summary_type": summary_type,
            "artifacts": artifacts_json,
            "created_at": now,
            "updated_at": now,
        },
    ).mappings().first()
    db.commit()
    return {
        "id": row["id"],
        "meeting_id": meeting_id,
        "version": row["version"],
        "summary_type": row["summary_type"],
        "content": row["content"],
        "artifacts": row["artifacts"],
        "created_at": row["created_at"],
    }


def get_latest_summary(
    db: Session,
    *,
    meeting_id: str,
    summary_type: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    ensure_summary_table(db)

    conditions = ["meeting_id = :meeting_id"]
    params: dict[str, Any] = {"meeting_id": meeting_id}
    if summary_type:
        conditions.append("summary_type = :summary_type")
        params["summary_type"] = summary_type

    where_clause = " AND ".join(conditions)
    row = db.execute(
        text(
            f"""
            SELECT id::text, meeting_id::text, version, content, summary_type, artifacts, created_at, updated_at
            FROM meeting_summary
            WHERE {where_clause}
            ORDER BY created_at DESC, version DESC
            LIMIT 1
            """
        ),
        params,
    ).mappings().first()
    if not row:
        return None
    return {
        "id": row["id"],
        "meeting_id": row["meeting_id"],
        "version": row["version"],
        "content": row["content"],
        "summary_type": row["summary_type"],
        "artifacts": row["artifacts"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
