"""Add visual_object_event and ensure knowledge_chunk vector indexes

Revision ID: d9e8f7a6b5c4
Revises: c6d7e8f9a0b1
Create Date: 2026-02-07 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d9e8f7a6b5c4"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector before touching vector columns/indexes.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Timeline object detections aligned to meeting timecode.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS visual_object_event (
            id UUID PRIMARY KEY,
            meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
            visual_event_id UUID REFERENCES visual_event(id) ON DELETE SET NULL,
            timestamp DOUBLE PRECISION NOT NULL,
            time_end DOUBLE PRECISION,
            object_label TEXT NOT NULL,
            object_type TEXT,
            bbox JSONB,
            confidence DOUBLE PRECISION,
            attributes JSONB,
            ocr_text TEXT,
            frame_url TEXT,
            source TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_visual_object_event_meeting_time ON visual_object_event(meeting_id, timestamp);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_visual_object_event_meeting_label ON visual_object_event(meeting_id, object_label);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_visual_object_event_visual_event ON visual_object_event(visual_event_id);"
    )

    # Safety net for environments stamped incorrectly: ensure knowledge_chunk exists and indexed.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_chunk (
            id UUID PRIMARY KEY,
            document_id UUID NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL DEFAULT 0,
            content TEXT NOT NULL,
            embedding vector(1024),
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
                    RAISE NOTICE 'Skipping embedding cast to vector(1024): %', SQLERRM;
                END;
            END IF;
        END
        $$;
        """
    )
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
    op.execute("DROP INDEX IF EXISTS idx_visual_object_event_visual_event;")
    op.execute("DROP INDEX IF EXISTS idx_visual_object_event_meeting_label;")
    op.execute("DROP INDEX IF EXISTS idx_visual_object_event_meeting_time;")
    op.execute("DROP TABLE IF EXISTS visual_object_event;")
