from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI(title="Minute ASR Service", version="1.0.0")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "/models/ggml-base.en-q5_1.bin")
WHISPER_BIN = os.getenv("WHISPER_BIN", "whisper-cli")
FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg")
WHISPER_THREADS = os.getenv("WHISPER_THREADS", "1")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


def _tail(text: str, max_chars: int = 2000) -> str:
    if not text:
        return ""
    return text[-max_chars:]


def _run(cmd: List[str]) -> tuple[str, str]:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(_tail(proc.stderr))
    return proc.stdout, proc.stderr


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> JSONResponse:
    # TODO: For very long audio, move this to async job queue and return job_id.
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="file is required")

    model_path = Path(WHISPER_MODEL)
    if not model_path.exists():
        raise HTTPException(status_code=500, detail=f"model not found: {model_path}")

    with tempfile.TemporaryDirectory(prefix="asr_") as tmpdir:
        tmp_path = Path(tmpdir)
        input_path = tmp_path / "input"
        wav_path = tmp_path / "audio.wav"
        output_base = tmp_path / "whisper_out"
        output_json = Path(f"{output_base}.json")

        with input_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            _run([
                FFMPEG_BIN,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(input_path),
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "wav",
                str(wav_path),
            ])
        except Exception as exc:
            raise HTTPException(status_code=500, detail={"stage": "ffmpeg", "error": str(exc)}) from exc

        try:
            _run([
                WHISPER_BIN,
                "-m",
                str(model_path),
                "-f",
                str(wav_path),
                "-of",
                str(output_base),
                "-oj",
                "-t",
                str(WHISPER_THREADS),
            ])
        except Exception as exc:
            raise HTTPException(status_code=500, detail={"stage": "whisper", "error": str(exc)}) from exc

        if not output_json.exists():
            raise HTTPException(status_code=500, detail="whisper output json not found")

        try:
            with output_json.open("r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"failed to parse whisper json: {exc}") from exc

        return JSONResponse(content=payload)
