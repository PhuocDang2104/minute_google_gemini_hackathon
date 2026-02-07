"""Merge heads + add knowledge_document table

Revision ID: a8c1d2e3f4b5
Revises: 9c3a2f8b5d1e, f1a9b7c3d2e1
Create Date: 2026-02-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a8c1d2e3f4b5'
down_revision: Union[str, Sequence[str], None] = ('9c3a2f8b5d1e', 'f1a9b7c3d2e1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_document (
            id UUID PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            source TEXT,
            category TEXT,
            tags TEXT[],
            file_type TEXT,
            file_size BIGINT,
            storage_key TEXT,
            file_url TEXT,
            org_id UUID,
            project_id UUID,
            meeting_id UUID,
            visibility TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_document_project ON knowledge_document(project_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_document_meeting ON knowledge_document(meeting_id);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_knowledge_document_meeting;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_document_project;")
    op.execute("DROP TABLE IF EXISTS knowledge_document;")
