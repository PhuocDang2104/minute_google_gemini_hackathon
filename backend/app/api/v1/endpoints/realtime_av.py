from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.db.session import SessionLocal
from app.schemas.realtime_av import RoiBox, SessionSnapshot
from app.services.realtime_av_service import Roi, realtime_av_service

router = APIRouter()


@router.get("/sessions/{session_id}/snapshot", response_model=SessionSnapshot)
async def get_snapshot(session_id: str) -> SessionSnapshot:
    snapshot = realtime_av_service.get_snapshot(session_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return snapshot


@router.put("/sessions/{session_id}/roi")
async def upsert_roi(session_id: str, roi: RoiBox) -> Dict[str, Any]:
    return await realtime_av_service.set_roi(
        session_id,
        Roi(x=roi.x, y=roi.y, w=roi.w, h=roi.h),
    )


@router.post("/sessions/{session_id}/flush")
async def flush_session(session_id: str) -> Dict[str, Any]:
    return await realtime_av_service.flush_session(session_id)


@router.get("/sessions/{session_id}/captures")
async def list_captures(session_id: str, limit: int = Query(default=50, ge=1, le=500)) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT frame_id, ts_ms, uri, roi, diff_score, capture_reason, created_at
                FROM captured_frame
                WHERE session_id = :session_id
                ORDER BY ts_ms DESC
                LIMIT :limit
                """
            ),
            {"session_id": session_id, "limit": limit},
        ).fetchall()
    except Exception:
        rows = []
    finally:
        db.close()

    captures: List[Dict[str, Any]] = []
    for row in rows:
        captures.append(
            {
                "frame_id": row[0],
                "ts_ms": row[1],
                "uri": row[2],
                "roi": row[3],
                "diff_score": row[4],
                "capture_reason": row[5],
                "created_at": row[6],
            }
        )
    return {"captures": captures, "total": len(captures)}


@router.get("/sessions/{session_id}/windows")
async def list_windows(session_id: str, limit: int = Query(default=50, ge=1, le=500)) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT window_id, start_ts_ms, end_ts_ms, revision, recap, topics, cheatsheet, citations, created_at
                FROM recap_window
                WHERE session_id = :session_id
                ORDER BY start_ts_ms DESC, revision DESC
                LIMIT :limit
                """
            ),
            {"session_id": session_id, "limit": limit},
        ).fetchall()
    except Exception:
        rows = []
    finally:
        db.close()

    windows: List[Dict[str, Any]] = []
    for row in rows:
        windows.append(
            {
                "window_id": row[0],
                "start_ts_ms": row[1],
                "end_ts_ms": row[2],
                "revision": row[3],
                "recap": row[4],
                "topics": row[5],
                "cheatsheet": row[6],
                "citations": row[7],
                "created_at": row[8],
            }
        )
    return {"windows": windows, "total": len(windows)}
