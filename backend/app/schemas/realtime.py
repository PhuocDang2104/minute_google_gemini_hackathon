from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AudioFormat(BaseModel):
    codec: Literal["PCM_S16LE"] = "PCM_S16LE"
    sample_rate_hz: int = 16000
    channels: int = 1


class IngestPolicy(BaseModel):
    expected_audio: AudioFormat
    recommended_frame_ms: int = 250
    max_frame_ms: int = 1000


class SessionCreateRequest(BaseModel):
    session_id: Optional[str] = None
    language_code: str = "vi-VN"
    target_sample_rate_hz: int = 16000
    audio_encoding: Literal["PCM_S16LE"] = "PCM_S16LE"
    channels: int = 1
    realtime: bool = True
    interim_results: bool = True
    enable_word_time_offsets: bool = True


class SessionCreateResponse(BaseModel):
    session_id: str
    audio_ws_url: str
    frontend_ws_url: str
    transcript_test_ws_url: str
    ingest_policy: IngestPolicy


class SourceRegisterResponse(BaseModel):
    session_id: str
    source_id: str | None = None
    platform: str | None = None
    audio_ingest_token: str
    token_ttl_seconds: int = 1800


class AudioStartMessage(BaseModel):
    type: Literal["start"] = "start"
    platform: str = Field(default="google_meet_tab")
    platform_meeting_ref: Optional[str] = None
    audio: AudioFormat = Field(default_factory=AudioFormat)
    language_code: Optional[str] = None
    frame_ms: int = 250
    stream_id: Optional[str] = None
    client_ts_ms: Optional[int] = None


class TranscriptIngestPayload(BaseModel):
    meeting_id: str
    chunk: str
    speaker: str
    time_start: float
    time_end: float
    is_final: bool
    confidence: float = 1.0
    lang: str = "vi"
    question: Optional[bool] = None
