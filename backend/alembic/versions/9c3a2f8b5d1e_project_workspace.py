"""Project workspace (folder grouping)

Revision ID: 9c3a2f8b5d1e
Revises: 7f2a3d9c1b52
Create Date: 2026-02-06 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9c3a2f8b5d1e'
down_revision: Union[str, None] = '7f2a3d9c1b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Project metadata
    op.execute(
        """
        ALTER TABLE IF EXISTS project
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS objective TEXT,
            ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(id),
            ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_account(id),
            ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
        """
    )

    # Ensure defaults if column already existed
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'project' AND column_name = 'updated_at'
            ) THEN
                EXECUTE 'ALTER TABLE project ALTER COLUMN updated_at SET DEFAULT now()';
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'project' AND column_name = 'status'
            ) THEN
                EXECUTE 'ALTER TABLE project ALTER COLUMN status SET DEFAULT ''active''';
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_code_unique
        ON project(code)
        WHERE code IS NOT NULL;
        """
    )

    # Project membership table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS project_member (
            project_id UUID REFERENCES project(id) ON DELETE CASCADE,
            user_id UUID REFERENCES user_account(id) ON DELETE CASCADE,
            role TEXT DEFAULT 'member',
            joined_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (project_id, user_id)
        );
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS idx_project_member_user ON project_member(user_id);")

    # Link project_id to related tables (guarded)
    op.execute("ALTER TABLE IF EXISTS meeting ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);")
    op.execute("ALTER TABLE IF EXISTS action_item ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);")
    op.execute("ALTER TABLE IF EXISTS document ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);")
    op.execute("ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);")
    op.execute("ALTER TABLE IF EXISTS knowledge_document ADD COLUMN IF NOT EXISTS project_id UUID;")

    # Indexes (guarded)
    op.execute("CREATE INDEX IF NOT EXISTS idx_project_owner ON project(owner_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_project_department ON project(department_id);")

    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.meeting') IS NOT NULL THEN
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_meeting_project ON meeting(project_id)';
            END IF;
            IF to_regclass('public.action_item') IS NOT NULL THEN
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_action_item_project ON action_item(project_id)';
            END IF;
            IF to_regclass('public.document') IS NOT NULL THEN
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_project ON document(project_id)';
            END IF;
            IF to_regclass('public.documents') IS NOT NULL THEN
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)';
            END IF;
            IF to_regclass('public.knowledge_document') IS NOT NULL THEN
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_document_project ON knowledge_document(project_id)';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Drop indexes (guarded)
    op.execute("DROP INDEX IF EXISTS idx_knowledge_document_project;")
    op.execute("DROP INDEX IF EXISTS idx_document_project;")
    op.execute("DROP INDEX IF EXISTS idx_documents_project;")
    op.execute("DROP INDEX IF EXISTS idx_action_item_project;")
    op.execute("DROP INDEX IF EXISTS idx_meeting_project;")
    op.execute("DROP INDEX IF EXISTS idx_project_department;")
    op.execute("DROP INDEX IF EXISTS idx_project_owner;")
    op.execute("DROP INDEX IF EXISTS idx_project_member_user;")
    op.execute("DROP INDEX IF EXISTS idx_project_code_unique;")

    # Drop columns (guarded)
    op.execute("ALTER TABLE IF EXISTS knowledge_document DROP COLUMN IF EXISTS project_id;")
    op.execute("ALTER TABLE IF EXISTS document DROP COLUMN IF EXISTS project_id;")
    op.execute("ALTER TABLE IF EXISTS documents DROP COLUMN IF EXISTS project_id;")
    op.execute("ALTER TABLE IF EXISTS action_item DROP COLUMN IF EXISTS project_id;")
    op.execute("ALTER TABLE IF EXISTS meeting DROP COLUMN IF EXISTS project_id;")

    # Drop project member table
    op.execute("DROP TABLE IF EXISTS project_member;")

    # Drop project extra columns (guarded)
    op.execute("ALTER TABLE IF EXISTS project DROP COLUMN IF EXISTS status;")
    op.execute("ALTER TABLE IF EXISTS project DROP COLUMN IF EXISTS owner_id;")
    op.execute("ALTER TABLE IF EXISTS project DROP COLUMN IF EXISTS department_id;")
    op.execute("ALTER TABLE IF EXISTS project DROP COLUMN IF EXISTS objective;")
    op.execute("ALTER TABLE IF EXISTS project DROP COLUMN IF EXISTS description;")
