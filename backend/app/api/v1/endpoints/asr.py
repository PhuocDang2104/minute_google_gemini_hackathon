from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
import httpx

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post('/transcribe')
async def transcribe(file: UploadFile = File(...)):
    if not settings.asr_url:
        raise HTTPException(status_code=503, detail="ASR_URL not configured")

    await file.seek(0)
    files = {
        'file': (
            file.filename or 'audio',
            file.file,
            file.content_type or 'application/octet-stream',
        )
    }

    # TODO: For long-running jobs, move to async queue and return job_id.
    timeout = httpx.Timeout(connect=10.0, read=900.0, write=900.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{settings.asr_url.rstrip('/')}/transcribe", files=files)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"ASR request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = None
        if resp.headers.get('content-type', '').startswith('application/json'):
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
        else:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=detail)

    if resp.headers.get('content-type', '').startswith('application/json'):
        return resp.json()
    return resp.text
