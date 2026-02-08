from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.schemas.realtime_av import (
    ApproveToolCallPayload,
    AudioChunkPayload,
    SessionControlPayload,
    UserQueryPayload,
    VideoFrameMetaPayload,
)
from app.services.realtime_av_service import realtime_av_service
from app.services.realtime_bus import session_bus

router = APIRouter()
logger = logging.getLogger(__name__)


async def _safe_send_json(websocket: WebSocket, lock: asyncio.Lock, payload: Dict[str, Any]) -> None:
    async with lock:
        await websocket.send_json(payload)


def _extract_payload(message_obj: Dict[str, Any]) -> Dict[str, Any]:
    payload = message_obj.get("payload")
    if isinstance(payload, dict):
        return payload
    return message_obj


@router.websocket("/realtime-av/{session_id}")
async def realtime_av_ingest(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    realtime_av_service.ensure_session(session_id)
    queue = session_bus.subscribe(session_id)
    send_lock = asyncio.Lock()
    stop_event = asyncio.Event()

    await websocket.send_json({"event": "connected", "channel": "realtime-av", "session_id": session_id})

    async def _forward_bus_events() -> None:
        try:
            while not stop_event.is_set():
                event = await queue.get()
                await _safe_send_json(websocket, send_lock, event)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("realtime_av_forward_failed session_id=%s", session_id)

    forward_task = asyncio.create_task(_forward_bus_events())

    try:
        while True:
            message = await websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                break

            if message.get("bytes") is not None:
                # Optional raw binary mode: treat as audio_chunk payload.
                chunk = message.get("bytes") or b""
                if not chunk:
                    continue
                result = await realtime_av_service.handle_audio_chunk_bytes(session_id, chunk)
                await _safe_send_json(
                    websocket,
                    send_lock,
                    {
                        "event": "audio_chunk_ack",
                        "session_id": session_id,
                        "payload": result,
                    },
                )
                continue

            text_payload = message.get("text")
            if text_payload is None:
                continue

            try:
                obj = json.loads(text_payload)
                if not isinstance(obj, dict):
                    raise ValueError("message must be a JSON object")
            except Exception as exc:
                await _safe_send_json(
                    websocket,
                    send_lock,
                    {
                        "event": "error",
                        "payload": {
                            "code": "invalid_json",
                            "message": str(exc),
                        },
                    },
                )
                continue

            event_name = str(obj.get("event") or "").strip()
            payload = _extract_payload(obj)
            try:
                if event_name == "audio_chunk":
                    data = AudioChunkPayload.model_validate(payload)
                    result = await realtime_av_service.handle_audio_chunk(
                        session_id,
                        data.model_dump(),
                    )
                    await _safe_send_json(
                        websocket,
                        send_lock,
                        {
                            "event": "audio_chunk_ack",
                            "session_id": session_id,
                            "payload": result,
                        },
                    )
                    continue

                if event_name == "video_frame_meta":
                    data = VideoFrameMetaPayload.model_validate(payload)
                    result = await realtime_av_service.handle_video_frame(
                        session_id,
                        data.model_dump(),
                    )
                    await _safe_send_json(
                        websocket,
                        send_lock,
                        {
                            "event": "video_frame_ack",
                            "session_id": session_id,
                            "payload": result,
                        },
                    )
                    continue

                if event_name == "session_control":
                    data = SessionControlPayload.model_validate(payload)
                    result = await realtime_av_service.handle_session_control(
                        session_id,
                        data.model_dump(),
                    )
                    await _safe_send_json(
                        websocket,
                        send_lock,
                        {
                            "event": "session_control_received",
                            "session_id": session_id,
                            "payload": result,
                        },
                    )
                    continue

                if event_name == "user_query":
                    data = UserQueryPayload.model_validate(payload)
                    result = await realtime_av_service.handle_user_query(
                        session_id,
                        data.model_dump(),
                    )
                    await _safe_send_json(
                        websocket,
                        send_lock,
                        {
                            "event": "user_query_ack",
                            "session_id": session_id,
                            "payload": result,
                        },
                    )
                    continue

                if event_name == "approve_tool_call":
                    data = ApproveToolCallPayload.model_validate(payload)
                    result = await realtime_av_service.handle_tool_approval(
                        session_id,
                        data.model_dump(),
                    )
                    await _safe_send_json(
                        websocket,
                        send_lock,
                        {
                            "event": "approve_tool_call_ack",
                            "session_id": session_id,
                            "payload": result,
                        },
                    )
                    continue

                await _safe_send_json(
                    websocket,
                    send_lock,
                    {
                        "event": "error",
                        "payload": {
                            "code": "unsupported_event",
                            "message": f"Unsupported event: {event_name or '<empty>'}",
                        },
                    },
                )
            except ValidationError as exc:
                await _safe_send_json(
                    websocket,
                    send_lock,
                    {
                        "event": "error",
                        "payload": {
                            "code": "validation_error",
                            "message": str(exc),
                        },
                    },
                )
            except Exception as exc:
                logger.exception("realtime_av_event_failed session_id=%s event=%s", session_id, event_name)
                await _safe_send_json(
                    websocket,
                    send_lock,
                    {
                        "event": "error",
                        "payload": {
                            "code": "server_error",
                            "message": str(exc),
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()
        forward_task.cancel()
        session_bus.unsubscribe(session_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
