"""
ASR Service Client (whisper.cpp microservice)
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AsrServiceError(RuntimeError):
    pass


async def transcribe_audio_file(audio_path: str | Path) -> Dict[str, Any]:
    """
    Send audio file to ASR microservice and return whisper.cpp JSON.
    """
    asr_url = (settings.asr_url or "").strip().rstrip("/")
    if not asr_url:
        raise AsrServiceError("ASR_URL not configured")

    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    url = f"{asr_url}/transcribe"
    timeout = httpx.Timeout(connect=10.0, read=1800.0, write=1800.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            with path.open("rb") as f:
                files = {"file": (path.name, f, "audio/wav")}
                resp = await client.post(url, files=files)
    except httpx.HTTPError as exc:
        raise AsrServiceError(f"ASR request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text
        if resp.headers.get("content-type", "").startswith("application/json"):
            try:
                detail = resp.json()
            except Exception:
                pass
        raise AsrServiceError(f"ASR error {resp.status_code}: {detail}")

    try:
        return resp.json()
    except Exception as exc:
        raise AsrServiceError(f"Invalid ASR JSON response: {exc}") from exc
