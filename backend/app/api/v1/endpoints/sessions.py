from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from app.core.realtime_security import create_audio_ingest_token
from app.schemas.realtime import (
    AudioFormat,
    IngestPolicy,
    SessionCreateRequest,
    SessionCreateResponse,
    SourceRegisterResponse,
)
from app.services.realtime_session_store import ExpectedAudio, RealtimeSessionConfig, session_store


router = APIRouter()


def _ws_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    scheme = (forwarded_proto or request.url.scheme or "http").lower()
    ws_scheme = "wss" if scheme == "https" else "ws"
    host = request.headers.get("host") or request.url.netloc
    return f"{ws_scheme}://{host}".rstrip("/")


@router.post("", response_model=SessionCreateResponse)
async def create_session(payload: SessionCreateRequest, request: Request) -> SessionCreateResponse:
    config = RealtimeSessionConfig(
        language_code=payload.language_code,
        expected_audio=ExpectedAudio(
            codec=payload.audio_encoding,
            sample_rate_hz=payload.target_sample_rate_hz,
            channels=payload.channels,
        ),
        interim_results=payload.interim_results,
        enable_word_time_offsets=payload.enable_word_time_offsets,
    )
    session = session_store.create_with_id(payload.session_id, config) if payload.session_id else session_store.create(config)

    ws_base = _ws_base_url(request)
    ingest_policy = IngestPolicy(
        expected_audio=AudioFormat(
            codec=config.expected_audio.codec,  # type: ignore[arg-type]
            sample_rate_hz=config.expected_audio.sample_rate_hz,
            channels=config.expected_audio.channels,
        ),
        recommended_frame_ms=config.recommended_frame_ms,
        max_frame_ms=config.max_frame_ms,
    )

    return SessionCreateResponse(
        session_id=session.session_id,
        audio_ws_url=f"{ws_base}/api/v1/ws/audio/{session.session_id}",
        frontend_ws_url=f"{ws_base}/api/v1/ws/frontend/{session.session_id}",
        transcript_test_ws_url=f"{ws_base}/api/v1/ws/in-meeting/{session.session_id}",
        ingest_policy=ingest_policy,
    )


@router.post("/{session_id}/sources", response_model=SourceRegisterResponse)
async def register_source(session_id: str, platform: str | None = None) -> SourceRegisterResponse:
    # Keep source registration resilient across backend restarts.
    session_store.ensure(session_id)

    token_ttl_seconds = 1800
    token = create_audio_ingest_token(session_id=session_id, ttl_seconds=token_ttl_seconds)
    return SourceRegisterResponse(
        session_id=session_id,
        source_id=str(uuid.uuid4()),
        platform=platform.strip() if platform else None,
        audio_ingest_token=token,
        token_ttl_seconds=token_ttl_seconds,
    )
