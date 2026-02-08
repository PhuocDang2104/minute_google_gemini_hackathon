-- ============================================
-- REALTIME AUDIO + VIDEO PIPELINE (MVP)
-- Minute recorder (60s), capture-on-change, recap window (120s)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Session ROI configuration (set at session start / update)
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

CREATE INDEX IF NOT EXISTS idx_session_roi_meeting ON session_roi(meeting_id);

-- 60-second audio record unit (idempotent by session_id + record_id)
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
    status TEXT DEFAULT 'ready', -- ready / processing / failed
    asr_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_audio_record_session ON audio_record(session_id, record_id);
CREATE INDEX IF NOT EXISTS idx_audio_record_meeting ON audio_record(meeting_id, start_ts_ms);

-- ASR-normalized transcript segments with absolute session clock timestamps
CREATE TABLE IF NOT EXISTS transcript_segment (
    seg_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
    record_id BIGINT,
    speaker TEXT NOT NULL DEFAULT 'SPEAKER_01',
    "offset" TEXT, -- mm:ss in record scope (optional if ASR returns absolute ms)
    start_ts_ms BIGINT NOT NULL,
    end_ts_ms BIGINT,
    text TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segment_session_time ON transcript_segment(session_id, start_ts_ms);
CREATE INDEX IF NOT EXISTS idx_transcript_segment_meeting_time ON transcript_segment(meeting_id, start_ts_ms);
CREATE INDEX IF NOT EXISTS idx_transcript_segment_record ON transcript_segment(session_id, record_id);

-- Frame captured when a global change is confirmed
CREATE TABLE IF NOT EXISTS captured_frame (
    frame_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
    ts_ms BIGINT NOT NULL,
    roi JSONB NOT NULL,
    checksum TEXT,
    uri TEXT NOT NULL,
    diff_score JSONB, -- {hash_dist, ssim}
    capture_reason TEXT DEFAULT 'change_confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_captured_frame_session_time ON captured_frame(session_id, ts_ms);
CREATE INDEX IF NOT EXISTS idx_captured_frame_meeting_time ON captured_frame(meeting_id, ts_ms);
CREATE UNIQUE INDEX IF NOT EXISTS uq_captured_frame_session_checksum ON captured_frame(session_id, checksum) WHERE checksum IS NOT NULL;

-- 2-minute recap output. Same window_id can have revisions (late arrivals)
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

CREATE INDEX IF NOT EXISTS idx_recap_window_session_time ON recap_window(session_id, start_ts_ms);
CREATE INDEX IF NOT EXISTS idx_recap_window_meeting_time ON recap_window(meeting_id, start_ts_ms);

-- Human-in-the-loop tool call proposals (e.g. web search escalation)
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
    status TEXT DEFAULT 'pending', -- pending / approved / rejected / executed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_call_proposal_session ON tool_call_proposal(session_id, created_at DESC);

-- Q&A event log for realtime in-session assistant
CREATE TABLE IF NOT EXISTS qna_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    meeting_id UUID REFERENCES meeting(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT,
    tier_used TEXT, -- tier0_session / tier1_docs / tier2_web / blocked / none
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qna_event_log_session ON qna_event_log(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qna_event_log_meeting ON qna_event_log(meeting_id, created_at DESC);
