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


async def analyze_video_file(
    video_path: str | Path,
    *,
    meeting_id: str | None = None,
    scene_threshold: float = 0.35,
    max_keyframes: int = 60,
    run_ocr: bool = True,
    run_caption: bool = False,
    vision_provider: str | None = None,
    vision_model: str | None = None,
    vision_api_key: str | None = None,
) -> Dict[str, Any]:
    """
    Send video file to ASR visual-ingest endpoint and return keyframe/ocr payload.
    """
    asr_url = (settings.asr_url or "").strip().rstrip("/")
    if not asr_url:
        raise AsrServiceError("ASR_URL not configured")

    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {path}")

    url = f"{asr_url}/visual-ingest"
    timeout = httpx.Timeout(connect=10.0, read=1800.0, write=1800.0, pool=10.0)

    data = {
        "scene_threshold": str(scene_threshold),
        "max_keyframes": str(max_keyframes),
        "run_ocr": "true" if run_ocr else "false",
        "run_caption": "true" if run_caption else "false",
    }
    if meeting_id:
        data["meeting_id"] = meeting_id
    if vision_provider:
        data["vision_provider"] = vision_provider
    if vision_model:
        data["vision_model"] = vision_model
    if vision_api_key:
        data["vision_api_key"] = vision_api_key

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            with path.open("rb") as f:
                files = {"file": (path.name, f, "video/mp4")}
                resp = await client.post(url, data=data, files=files)
    except httpx.HTTPError as exc:
        raise AsrServiceError(f"ASR visual request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text
        if resp.headers.get("content-type", "").startswith("application/json"):
            try:
                detail = resp.json()
            except Exception:
                pass
        raise AsrServiceError(f"ASR visual error {resp.status_code}: {detail}")

    try:
        return resp.json()
    except Exception as exc:
        raise AsrServiceError(f"Invalid ASR visual JSON response: {exc}") from exc
