"""Add knowledge_chunk table and vector indexes

Revision ID: b3f4e5a6c7d8
Revises: a8c1d2e3f4b5
Create Date: 2026-02-07 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b3f4e5a6c7d8'
down_revision: Union[str, Sequence[str], None] = 'a8c1d2e3f4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector extension exists before creating vector column/index.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_chunk (
            id UUID PRIMARY KEY,
            document_id UUID NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL DEFAULT 0,
            content TEXT NOT NULL,
            embedding vector,
            scope_meeting UUID REFERENCES meeting(id) ON DELETE SET NULL,
            scope_project UUID REFERENCES project(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        """
    )

    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_chunk_doc_idx ON knowledge_chunk(document_id, chunk_index);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_scope_meeting ON knowledge_chunk(scope_meeting);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_scope_project ON knowledge_chunk(scope_project);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_created_at ON knowledge_chunk(created_at DESC);"
    )

    # Try HNSW first (better recall/latency on newer pgvector), fallback to IVFFLAT.
    op.execute(
        """
        DO $$
        BEGIN
            BEGIN
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embedding_hnsw
                ON knowledge_chunk
                USING hnsw (embedding vector_cosine_ops);
            EXCEPTION WHEN undefined_object OR feature_not_supported OR invalid_parameter_value THEN
                BEGIN
                    CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embedding_ivfflat
                    ON knowledge_chunk
                    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Could not create vector ANN index: %', SQLERRM;
                END;
            END;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_embedding_ivfflat;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_created_at;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_scope_project;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_scope_meeting;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_doc_idx;")
    op.execute("DROP TABLE IF EXISTS knowledge_chunk;")
