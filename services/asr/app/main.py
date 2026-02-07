from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List
from urllib import error as urlerror
from urllib import request as urlrequest

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI(title="Minute ASR Service", version="1.1.0")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "/models/ggml-base.en-q5_1.bin")
WHISPER_BIN = os.getenv("WHISPER_BIN", "whisper-cli")
FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg")
WHISPER_THREADS = os.getenv("WHISPER_THREADS", "1")
SCENE_THRESHOLD = float(os.getenv("SCENE_THRESHOLD", "0.35"))
MAX_KEYFRAMES = int(os.getenv("MAX_KEYFRAMES", "60"))
FALLBACK_FRAME_STEP_SEC = int(os.getenv("FALLBACK_FRAME_STEP_SEC", "5"))
OCR_BIN = os.getenv("OCR_BIN", "tesseract")
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").strip().lower() in {"1", "true", "yes"}
GEMINI_VISION_API_KEY = os.getenv("GEMINI_VISION_API_KEY", "")
GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")


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


def _run_no_raise(cmd: List[str]) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def _parse_pts_times(stderr_text: str) -> List[float]:
    matches = re.findall(r"pts_time:([0-9]+(?:\.[0-9]+)?)", stderr_text or "")
    return [float(v) for v in matches]


def _extract_keyframes(
    input_path: Path,
    frames_dir: Path,
    *,
    scene_threshold: float,
    max_keyframes: int,
) -> List[Dict[str, Any]]:
    frames_dir.mkdir(parents=True, exist_ok=True)

    scene_pattern = str(frames_dir / "key_%05d.jpg")
    scene_filter = f"select='gt(scene,{scene_threshold})',scale=1280:-1,showinfo"
    cmd = [
        FFMPEG_BIN,
        "-hide_banner",
        "-loglevel",
        "info",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        scene_filter,
        "-vsync",
        "vfr",
        "-frames:v",
        str(max_keyframes),
        scene_pattern,
    ]
    code, _out, err = _run_no_raise(cmd)
    if code != 0:
        raise RuntimeError(_tail(err))

    frame_paths = sorted(frames_dir.glob("key_*.jpg"))
    pts_times = _parse_pts_times(err)
    events: List[Dict[str, Any]] = []
    for idx, frame_path in enumerate(frame_paths):
        events.append(
            {
                "frame_path": frame_path,
                "timestamp": round(pts_times[idx] if idx < len(pts_times) else 0.0, 3),
            }
        )

    if events:
        return events

    # fallback path for low-motion video
    fallback_pattern = str(frames_dir / "fallback_%05d.jpg")
    fallback_filter = f"fps=1/{max(1, FALLBACK_FRAME_STEP_SEC)},scale=1280:-1,showinfo"
    cmd = [
        FFMPEG_BIN,
        "-hide_banner",
        "-loglevel",
        "info",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        fallback_filter,
        "-frames:v",
        str(max_keyframes),
        fallback_pattern,
    ]
    code, _out, err = _run_no_raise(cmd)
    if code != 0:
        raise RuntimeError(_tail(err))

    frame_paths = sorted(frames_dir.glob("fallback_*.jpg"))
    pts_times = _parse_pts_times(err)
    for idx, frame_path in enumerate(frame_paths):
        events.append(
            {
                "frame_path": frame_path,
                "timestamp": round(pts_times[idx] if idx < len(pts_times) else float(idx * FALLBACK_FRAME_STEP_SEC), 3),
            }
        )
    return events


def _run_ocr(image_path: Path) -> str:
    if not OCR_ENABLED:
        return ""
    code, out, err = _run_no_raise([
        OCR_BIN,
        str(image_path),
        "stdout",
        "--oem",
        "1",
        "--psm",
        "6",
    ])
    if code != 0:
        return _tail(err, 400)
    return out.strip()


def _call_gemini_vision(image_path: Path, ocr_text: str) -> str:
    if not GEMINI_VISION_API_KEY:
        return ""
    try:
        image_b64 = base64.b64encode(image_path.read_bytes()).decode("utf-8")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_VISION_MODEL}:generateContent?key={GEMINI_VISION_API_KEY}"
        )
        prompt = (
            "Analyze this meeting frame and return one concise sentence about what is shown. "
            "Prioritize slide content, tables, charts, code, or whiteboard. "
            f"OCR hint: {ocr_text[:1000]}"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                    ]
                }
            ]
        }
        req = urlrequest.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlrequest.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8")
        data = json.loads(raw)
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
        return " ".join(texts).strip()
    except (urlerror.URLError, TimeoutError, ValueError, KeyError):
        return ""


def _infer_event_type(ocr_text: str, caption: str) -> str:
    combined = f"{ocr_text} {caption}".lower()
    if any(token in combined for token in ["whiteboard", "bảng trắng", "sketch"]):
        return "whiteboard"
    if any(token in combined for token in ["code", "function", "class", "import", "def "]):
        return "code"
    if any(token in combined for token in ["chart", "graph", "kpi", "biểu đồ"]):
        return "chart"
    if any(token in combined for token in ["slide", "agenda", "deck", "bullet"]):
        return "slide_change"
    return "screen_share"


def _extract_pseudo_objects(ocr_text: str, caption: str, timestamp: float) -> List[Dict[str, Any]]:
    source = f"{ocr_text} {caption}".lower()
    catalog = [
        ("table", ["table", "bảng", "rows", "columns"]),
        ("chart", ["chart", "graph", "biểu đồ"]),
        ("code", ["code", "function", "class", "import", "def "]),
        ("agenda", ["agenda", "timeline", "milestone"]),
        ("kpi", ["kpi", "metric", "target"]),
    ]
    objects: List[Dict[str, Any]] = []
    for label, keys in catalog:
        if any(key in source for key in keys):
            objects.append(
                {
                    "timestamp": timestamp,
                    "object_label": label,
                    "confidence": 0.6,
                    "ocr_text": ocr_text[:500] if ocr_text else "",
                    "source": "heuristic",
                }
            )
    return objects


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


@app.post("/visual-ingest")
async def visual_ingest(
    file: UploadFile = File(...),
    meeting_id: str | None = Form(default=None),
    scene_threshold: float = Form(default=SCENE_THRESHOLD),
    max_keyframes: int = Form(default=MAX_KEYFRAMES),
    run_ocr: bool = Form(default=True),
    run_caption: bool = Form(default=False),
) -> JSONResponse:
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="file is required")
    if scene_threshold <= 0.0 or scene_threshold >= 1.0:
        raise HTTPException(status_code=400, detail="scene_threshold must be in (0, 1)")

    max_keyframes = max(1, min(max_keyframes, 200))

    with tempfile.TemporaryDirectory(prefix="visual_") as tmpdir:
        tmp_path = Path(tmpdir)
        input_path = tmp_path / "input_video"
        frames_dir = tmp_path / "frames"

        with input_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            raw_events = _extract_keyframes(
                input_path=input_path,
                frames_dir=frames_dir,
                scene_threshold=scene_threshold,
                max_keyframes=max_keyframes,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail={"stage": "ffmpeg", "error": str(exc)}) from exc

        visual_events: List[Dict[str, Any]] = []
        visual_objects: List[Dict[str, Any]] = []

        for idx, item in enumerate(raw_events, start=1):
            frame_path = item["frame_path"]
            timestamp = float(item["timestamp"])
            ocr_text = _run_ocr(frame_path) if run_ocr else ""
            caption = _call_gemini_vision(frame_path, ocr_text) if run_caption else ""
            event_type = _infer_event_type(ocr_text, caption)

            visual_events.append(
                {
                    "frame_index": idx,
                    "timestamp": round(timestamp, 3),
                    "event_type": event_type,
                    "description": caption,
                    "ocr_text": ocr_text[:4000],
                    "image_name": frame_path.name,
                }
            )
            visual_objects.extend(_extract_pseudo_objects(ocr_text, caption, timestamp))

        payload = {
            "meeting_id": meeting_id,
            "total_keyframes": len(visual_events),
            "settings": {
                "scene_threshold": scene_threshold,
                "max_keyframes": max_keyframes,
                "run_ocr": run_ocr,
                "run_caption": run_caption and bool(GEMINI_VISION_API_KEY),
            },
            "visual_events": visual_events,
            "visual_objects": visual_objects,
        }
        return JSONResponse(content=payload)
