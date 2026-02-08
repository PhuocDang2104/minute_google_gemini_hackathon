from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class RoiBox(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: int = Field(gt=0)
    h: int = Field(gt=0)


class SessionControlPayload(BaseModel):
    action: Literal["start", "pause", "stop"]
    meeting_id: Optional[str] = None
    roi: Optional[RoiBox] = None
    audio_format: str = "pcm_s16le_16k_mono"


class AudioChunkPayload(BaseModel):
    seq: int = Field(ge=0)
    payload: str = Field(description="Base64 PCM_S16LE mono 16k audio bytes")
    ts_hint: Optional[int] = None


class VideoFrameMetaPayload(BaseModel):
    frame_id: str
    checksum: Optional[str] = None
    roi: Optional[RoiBox] = None
    image_b64: Optional[str] = Field(default=None, description="Base64 encoded image frame")
    ts_hint: Optional[int] = None


class UserQueryPayload(BaseModel):
    query_id: Optional[str] = None
    text: str
    scope: Dict[str, Any] = Field(default_factory=dict)


class ApproveToolCallPayload(BaseModel):
    proposal_id: str
    approved: bool
    constraints: Dict[str, Any] = Field(default_factory=dict)


class TranscriptSegmentOut(BaseModel):
    seg_id: str
    speaker: str
    offset: Optional[str] = None
    start_ts_ms: int
    end_ts_ms: Optional[int] = None
    text: str
    confidence: float = 1.0


class TranscriptRecordReadyPayload(BaseModel):
    record_id: int
    record_start_ts_ms: int
    record_end_ts_ms: int
    uri: Optional[str] = None
    segments: List[TranscriptSegmentOut] = Field(default_factory=list)


class SlideChangeEventPayload(BaseModel):
    ts_ms: int
    frame_id: str
    confidence: float
    diff_score: Dict[str, float]
    roi: RoiBox


class CapturedFrameReadyPayload(BaseModel):
    ts_ms: int
    frame_id: str
    uri: str
    roi: RoiBox
    reason: str = "change_confirmed"


class RecapWindowPayload(BaseModel):
    window_id: str
    start_ts_ms: int
    end_ts_ms: int
    revision: int
    recap: List[Dict[str, Any]] = Field(default_factory=list)
    topics: List[Dict[str, Any]] = Field(default_factory=list)
    cheatsheet: List[Dict[str, Any]] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)


class QnaAnswerPayload(BaseModel):
    query_id: str
    answer: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    tier_used: str


class ToolCallProposalPayload(BaseModel):
    proposal_id: str
    reason: str
    suggested_queries: List[str] = Field(default_factory=list)
    risk: str = "medium"


class SessionSnapshot(BaseModel):
    session_id: str
    meeting_id: Optional[str] = None
    started_ts_ms: int
    paused: bool
    current_record_id: int
    next_window_start_ts_ms: int
    transcript_segments: int
    captured_frames: int
    emitted_windows: int
    pending_tool_calls: int
    roi: Optional[RoiBox] = None
