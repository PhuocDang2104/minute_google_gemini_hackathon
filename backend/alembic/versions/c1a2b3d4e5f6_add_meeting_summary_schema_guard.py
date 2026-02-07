"""Add/normalize meeting_summary schema for persistent summaries

Revision ID: c1a2b3d4e5f6
Revises: f0e1d2c3b4a6
Create Date: 2026-02-07 22:30:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f0e1d2c3b4a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
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

    op.execute("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS version INTEGER;")
    op.execute("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS summary_type VARCHAR(64);")
    op.execute("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS artifacts JSONB;")
    op.execute("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();")
    op.execute("ALTER TABLE meeting_summary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();")

    op.execute("UPDATE meeting_summary SET version = 1 WHERE version IS NULL;")
    op.execute("UPDATE meeting_summary SET summary_type = 'full' WHERE summary_type IS NULL OR summary_type = '';")
    op.execute("ALTER TABLE meeting_summary ALTER COLUMN version SET DEFAULT 1;")
    op.execute("ALTER TABLE meeting_summary ALTER COLUMN summary_type SET DEFAULT 'full';")
    op.execute("ALTER TABLE meeting_summary ALTER COLUMN version SET NOT NULL;")
    op.execute("ALTER TABLE meeting_summary ALTER COLUMN summary_type SET NOT NULL;")

    op.execute(
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

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_meeting_summary_meeting_created ON meeting_summary(meeting_id, created_at DESC);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_meeting_summary_meeting_type_version ON meeting_summary(meeting_id, summary_type, version DESC);"
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.meeting_minutes') IS NOT NULL THEN
                INSERT INTO meeting_summary (
                    id, meeting_id, version, content, summary_type, artifacts, created_at, updated_at
                )
                SELECT
                    mm.id,
                    mm.meeting_id,
                    COALESCE(mm.version, 1),
                    mm.executive_summary,
                    'minutes_executive',
                    jsonb_build_object(
                        'source', 'meeting_minutes_backfill',
                        'minutes_version', COALESCE(mm.version, 1),
                        'minutes_generated_at', mm.generated_at
                    ),
                    COALESCE(mm.generated_at, now()),
                    now()
                FROM meeting_minutes mm
                WHERE mm.executive_summary IS NOT NULL
                  AND btrim(mm.executive_summary) <> ''
                  AND NOT EXISTS (
                      SELECT 1
                      FROM meeting_summary ms
                      WHERE ms.meeting_id = mm.meeting_id
                        AND ms.summary_type = 'minutes_executive'
                        AND ms.version = COALESCE(mm.version, 1)
                  );
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_meeting_summary_meeting_type_version;")
    op.execute("DROP INDEX IF EXISTS idx_meeting_summary_meeting_created;")
