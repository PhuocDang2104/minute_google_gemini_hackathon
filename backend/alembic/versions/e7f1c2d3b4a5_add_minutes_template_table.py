"""Add minutes_template table

Revision ID: e7f1c2d3b4a5
Revises: d9e8f7a6b5c4
Create Date: 2026-02-07 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e7f1c2d3b4a5"
down_revision: Union[str, Sequence[str], None] = "d9e8f7a6b5c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS minutes_template (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL,
            code VARCHAR UNIQUE,
            description TEXT,
            structure JSONB NOT NULL,
            sample_data JSONB,
            meeting_types TEXT[],
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by UUID REFERENCES user_account(id) ON DELETE SET NULL,
            updated_by UUID REFERENCES user_account(id) ON DELETE SET NULL,
            version INTEGER NOT NULL DEFAULT 1,
            parent_template_id UUID REFERENCES minutes_template(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        """
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_minutes_template_active_name ON minutes_template(is_active, name);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_minutes_template_default ON minutes_template(is_default) WHERE is_default = TRUE;"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_minutes_template_code ON minutes_template(code);"
    )

    # Seed one default template so API is usable immediately after migration.
    op.execute(
        """
        INSERT INTO minutes_template (
            id, name, code, description, structure, meeting_types,
            is_default, is_active, version, created_at, updated_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000101',
            'Default Meeting Template',
            'default-meeting',
            'System default fallback template',
            '{
                "sections": [
                    {"id": "summary", "title": "Executive Summary", "order": 1},
                    {"id": "key_points", "title": "Key Points", "order": 2},
                    {"id": "action_items", "title": "Action Items", "order": 3},
                    {"id": "decisions", "title": "Decisions", "order": 4},
                    {"id": "risks", "title": "Risks", "order": 5},
                    {"id": "next_steps", "title": "Next Steps", "order": 6}
                ]
            }'::jsonb,
            NULL,
            TRUE,
            TRUE,
            1,
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_minutes_template_code;")
    op.execute("DROP INDEX IF EXISTS idx_minutes_template_default;")
    op.execute("DROP INDEX IF EXISTS idx_minutes_template_active_name;")
    op.execute("DROP TABLE IF EXISTS minutes_template;")
