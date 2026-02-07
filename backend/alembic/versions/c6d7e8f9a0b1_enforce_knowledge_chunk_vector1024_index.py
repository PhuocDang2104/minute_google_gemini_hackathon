"""Enforce knowledge_chunk embedding type and vector index

Revision ID: c6d7e8f9a0b1
Revises: b3f4e5a6c7d8
Create Date: 2026-02-07 13:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, Sequence[str], None] = 'b3f4e5a6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Ensure fixed dimension so ANN indexes are supported and consistent.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'knowledge_chunk' AND column_name = 'embedding'
            ) THEN
                BEGIN
                    ALTER TABLE knowledge_chunk
                    ALTER COLUMN embedding TYPE vector(1024)
                    USING embedding::vector(1024);
                EXCEPTION WHEN OTHERS THEN
                    RAISE EXCEPTION 'Cannot cast existing embeddings to vector(1024): %', SQLERRM;
                END;
            END IF;
        END
        $$;
        """
    )

    # Create ANN index (HNSW preferred, IVFFLAT fallback).
    op.execute(
        """
        DO $$
        BEGIN
            BEGIN
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embedding_hnsw
                ON knowledge_chunk
                USING hnsw (embedding vector_cosine_ops);
            EXCEPTION WHEN undefined_object OR feature_not_supported OR invalid_parameter_value THEN
                CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embedding_ivfflat
                ON knowledge_chunk
                USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
            END;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_embedding_ivfflat;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunk_embedding_hnsw;")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'knowledge_chunk' AND column_name = 'embedding'
            ) THEN
                ALTER TABLE knowledge_chunk
                ALTER COLUMN embedding TYPE vector
                USING embedding::vector;
            END IF;
        END
        $$;
        """
    )
