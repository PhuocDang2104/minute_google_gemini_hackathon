"""Add realtime AV pipeline tables and merge alembic heads.

Revision ID: a1d4f6b9c2e7
Revises: f1a9b7c3d2e1, 9c3a2f8b5d1e
Create Date: 2026-02-07 16:45:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1d4f6b9c2e7"
down_revision: Union[str, Sequence[str], None] = ("f1a9b7c3d2e1", "9c3a2f8b5d1e")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure UUID generators exist in managed Postgres environments.
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS session_roi (
            session_id TEXT PRIMARY KEY,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            x INT NOT NULL,
            y INT NOT NULL,
            w INT NOT NULL,
            h INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_session_roi_meeting ON session_roi(meeting_id);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS audio_record (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            record_id BIGINT NOT NULL,
            start_ts_ms BIGINT NOT NULL,
            end_ts_ms BIGINT NOT NULL,
            uri TEXT,
            format TEXT DEFAULT 'wav_pcm_s16le_16k_mono',
            checksum TEXT,
            status TEXT DEFAULT 'ready',
            asr_payload JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(session_id, record_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_audio_record_session ON audio_record(session_id, record_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audio_record_meeting ON audio_record(meeting_id, start_ts_ms);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS transcript_segment (
            seg_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            record_id BIGINT,
            speaker TEXT NOT NULL DEFAULT 'SPEAKER_01',
            "offset" TEXT,
            start_ts_ms BIGINT NOT NULL,
            end_ts_ms BIGINT,
            text TEXT NOT NULL,
            confidence FLOAT DEFAULT 1.0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_transcript_segment_session_time ON transcript_segment(session_id, start_ts_ms);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_transcript_segment_meeting_time ON transcript_segment(meeting_id, start_ts_ms);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_transcript_segment_record ON transcript_segment(session_id, record_id);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS captured_frame (
            frame_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            ts_ms BIGINT NOT NULL,
            roi JSONB NOT NULL,
            checksum TEXT,
            uri TEXT NOT NULL,
            diff_score JSONB,
            capture_reason TEXT DEFAULT 'change_confirmed',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_captured_frame_session_time ON captured_frame(session_id, ts_ms);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_captured_frame_meeting_time ON captured_frame(meeting_id, ts_ms);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_captured_frame_session_checksum ON captured_frame(session_id, checksum) WHERE checksum IS NOT NULL;")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS recap_window (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            window_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            start_ts_ms BIGINT NOT NULL,
            end_ts_ms BIGINT NOT NULL,
            revision INT NOT NULL DEFAULT 1,
            recap JSONB NOT NULL DEFAULT '[]'::jsonb,
            topics JSONB NOT NULL DEFAULT '[]'::jsonb,
            cheatsheet JSONB NOT NULL DEFAULT '[]'::jsonb,
            citations JSONB NOT NULL DEFAULT '[]'::jsonb,
            status TEXT DEFAULT 'ready',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(window_id, revision)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_recap_window_session_time ON recap_window(session_id, start_ts_ms);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_recap_window_meeting_time ON recap_window(meeting_id, start_ts_ms);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tool_call_proposal (
            proposal_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            query_id TEXT,
            reason TEXT,
            suggested_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
            risk TEXT,
            approved BOOLEAN,
            constraints JSONB,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_tool_call_proposal_session ON tool_call_proposal(session_id, created_at DESC);")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS qna_event_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            query_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
            question TEXT NOT NULL,
            answer TEXT,
            tier_used TEXT,
            citations JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_qna_event_log_session ON qna_event_log(session_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qna_event_log_meeting ON qna_event_log(meeting_id, created_at DESC);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_qna_event_log_meeting;")
    op.execute("DROP INDEX IF EXISTS idx_qna_event_log_session;")
    op.execute("DROP TABLE IF EXISTS qna_event_log;")

    op.execute("DROP INDEX IF EXISTS idx_tool_call_proposal_session;")
    op.execute("DROP TABLE IF EXISTS tool_call_proposal;")

    op.execute("DROP INDEX IF EXISTS idx_recap_window_meeting_time;")
    op.execute("DROP INDEX IF EXISTS idx_recap_window_session_time;")
    op.execute("DROP TABLE IF EXISTS recap_window;")

    op.execute("DROP INDEX IF EXISTS uq_captured_frame_session_checksum;")
    op.execute("DROP INDEX IF EXISTS idx_captured_frame_meeting_time;")
    op.execute("DROP INDEX IF EXISTS idx_captured_frame_session_time;")
    op.execute("DROP TABLE IF EXISTS captured_frame;")

    op.execute("DROP INDEX IF EXISTS idx_transcript_segment_record;")
    op.execute("DROP INDEX IF EXISTS idx_transcript_segment_meeting_time;")
    op.execute("DROP INDEX IF EXISTS idx_transcript_segment_session_time;")
    op.execute("DROP TABLE IF EXISTS transcript_segment;")

    op.execute("DROP INDEX IF EXISTS idx_audio_record_meeting;")
    op.execute("DROP INDEX IF EXISTS idx_audio_record_session;")
    op.execute("DROP TABLE IF EXISTS audio_record;")

    op.execute("DROP INDEX IF EXISTS idx_session_roi_meeting;")
    op.execute("DROP TABLE IF EXISTS session_roi;")
