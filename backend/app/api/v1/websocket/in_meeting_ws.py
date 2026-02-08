import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import text

from app.core.realtime_security import verify_audio_ingest_token
from app.db.session import SessionLocal
from app.llm.chains.in_meeting_chain import summarize_and_classify
from app.schemas.realtime import AudioStartMessage
from app.services.realtime_bus import session_bus
from app.services.realtime_ingest import ingestTranscript
from app.services.realtime_av_service import realtime_av_service
from app.services.realtime_session_store import FinalTranscriptChunk, session_store

router = APIRouter()
stream_workers: Dict[str, asyncio.Task] = {}
logger = logging.getLogger(__name__)

RECAP_WINDOW_SEC = 60.0
ROLLING_RETENTION_SEC = 120.0
RECAP_TICK_SEC = 30.0
RECAP_WINDOW_MIN = 30.0


def _format_chunk_line(chunk: FinalTranscriptChunk) -> str:
    return f"[{chunk.speaker} {chunk.time_start:.2f}-{chunk.time_end:.2f}] {chunk.text}".strip()


def _build_window_text(chunks: List[FinalTranscriptChunk]) -> str:
    return "\n".join(_format_chunk_line(chunk) for chunk in chunks if chunk.text)


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)



def _match_speaker_by_time(segments, t_start: float, t_end: float):
    best = None
    best_overlap = 0.0

    for seg in segments:
        overlap = min(t_end, seg["end"]) - max(t_start, seg["start"])
        if overlap > best_overlap:
            best_overlap = overlap
            best = seg

    if best_overlap <= 0:
        return None

    return best

def _compute_tick_anchor(stream_state) -> float:
    anchor = stream_state.max_seen_time_end or 0.0
    if stream_state.last_partial_chunk:
        anchor = max(anchor, stream_state.last_partial_chunk.time_end)
    return anchor



def _prune_stream_state(stream_state) -> None:
    cutoff = stream_state.max_seen_time_end - ROLLING_RETENTION_SEC
    if cutoff <= 0:
        return
    kept = [chunk for chunk in stream_state.rolling_window if chunk.time_end >= cutoff]
    stream_state.rolling_window.clear()
    stream_state.rolling_window.extend(kept)
    keep_seqs = {chunk.seq for chunk in kept}
    for seq in list(stream_state.final_by_seq.keys()):
        if seq not in keep_seqs:
            stream_state.final_by_seq.pop(seq, None)


def _append_final_chunk(stream_state, chunk: FinalTranscriptChunk, now: float) -> None:
    stream_state.final_stream.append(chunk)
    stream_state.final_by_seq[chunk.seq] = chunk
    stream_state.rolling_window.append(chunk)
    stream_state.last_final_seq = max(stream_state.last_final_seq, chunk.seq)
    if chunk.time_end > stream_state.max_seen_time_end:
        stream_state.max_seen_time_end = chunk.time_end
    if stream_state.last_recap_tick_at <= 0.0:
        stream_state.last_recap_tick_at = now
    _prune_stream_state(stream_state)


def _update_last_transcript(stream_state, chunk: FinalTranscriptChunk, seq: int, is_final: bool, now: float) -> None:
    stream_state.last_transcript_seq = max(stream_state.last_transcript_seq, seq)
    stream_state.last_transcript_chunk = chunk
    stream_state.last_transcript_is_final = is_final
    if not is_final:
        stream_state.last_partial_seq = seq
        stream_state.last_partial_chunk = chunk
    if stream_state.last_recap_tick_at <= 0.0:
        stream_state.last_recap_tick_at = now


def _select_window_chunks(stream_state, window_sec: float, include_partial: bool = False) -> List[FinalTranscriptChunk]:
    if not stream_state.rolling_window and not (include_partial and stream_state.last_partial_chunk):
        return []
    anchor = stream_state.max_seen_time_end or 0.0
    if stream_state.rolling_window:
        anchor = max(anchor, stream_state.rolling_window[-1].time_end)
    if include_partial and stream_state.last_partial_chunk:
        anchor = max(anchor, stream_state.last_partial_chunk.time_end)
    cutoff = anchor - window_sec
    chunks = [chunk for chunk in stream_state.rolling_window if chunk.time_end >= cutoff]
    if include_partial and stream_state.last_partial_chunk:
        partial = stream_state.last_partial_chunk
        if partial.time_end >= cutoff:
            if not chunks or (
                partial.time_end != chunks[-1].time_end
                or partial.text != chunks[-1].text
                or partial.speaker != chunks[-1].speaker
            ):
                chunks.append(partial)
    chunks.sort(key=lambda chunk: (chunk.time_end, chunk.seq))
    return chunks


def _should_recap_tick(stream_state, now: float) -> bool:
    if stream_state.last_transcript_seq <= stream_state.recap_cursor_seq:
        return False
    anchor = _compute_tick_anchor(stream_state)
    return (anchor - stream_state.last_recap_tick_anchor) >= RECAP_TICK_SEC


def _run_recap_tick(session_id: str, stream_state, now: float) -> Optional[Dict[str, Any]]:
    cursor_before = stream_state.recap_cursor_seq
    anchor = _compute_tick_anchor(stream_state)
    include_partial = stream_state.last_partial_chunk is not None and stream_state.last_partial_seq >= stream_state.last_final_seq
    window_chunks = _select_window_chunks(stream_state, RECAP_WINDOW_SEC, include_partial=include_partial)
    window_text = _build_window_text(window_chunks)
    window_start = window_chunks[0].time_start if window_chunks else 0.0
    window_end = window_chunks[-1].time_end if window_chunks else 0.0
    window_duration = max(0.0, window_end - window_start)
    if not window_text or window_duration < RECAP_WINDOW_MIN:
        stream_state.recap_cursor_seq = stream_state.last_transcript_seq
        stream_state.last_recap_tick_at = now
        stream_state.last_recap_tick_anchor = anchor
        logger.info(
            "recap_tick_skip session_id=%s cursor=%s->%s window=%.2f-%.2f duration=%.2fs anchor=%.2f",
            session_id,
            cursor_before,
            stream_state.recap_cursor_seq,
            window_start,
            window_end,
            window_duration,
            anchor,
        )
        return None

    meta = {
        "current_topic_id": stream_state.current_topic_id,
        "current_topic": stream_state.last_topic_payload,
        "window_start": window_start,
        "window_end": window_end,
    }
    llm_start = time.time()
    result = summarize_and_classify(window_text, meta=meta)
    llm_latency_ms = int((time.time() - llm_start) * 1000)
    parse_ok = bool(meta.get("parse_ok"))

    recap = result.get("recap") or ""
    topic_payload = result.get("topic") or {}
    intent_payload = result.get("intent") or {}

    topic_id = topic_payload.get("topic_id") if isinstance(topic_payload.get("topic_id"), str) else None
    if not topic_id:
        topic_id = stream_state.current_topic_id or "T0"
    topic_title = topic_payload.get("title") if isinstance(topic_payload.get("title"), str) else "General"
    topic_start = _coerce_float(topic_payload.get("start_t"), window_start)
    topic_end = _coerce_float(topic_payload.get("end_t"), window_end)
    if topic_end < topic_start:
        topic_end = topic_start

    if topic_payload.get("new_topic") or not stream_state.topic_segments:
        stream_state.topic_segments.append({
            "topic_id": topic_id,
            "title": topic_title,
            "start_t": topic_start,
            "end_t": topic_end,
        })
    stream_state.current_topic_id = topic_id
    stream_state.last_topic_payload = topic_payload
    stream_state.last_intent_payload = intent_payload
    stream_state.semantic_intent_label = intent_payload.get("label") or "NO_INTENT"
    stream_state.semantic_intent_slots = intent_payload.get("slots") or {}
    stream_state.last_live_recap = recap
    stream_state.last_recap = recap

    stream_state.recap_cursor_seq = stream_state.last_transcript_seq
    stream_state.last_recap_tick_at = now
    stream_state.last_recap_tick_anchor = anchor
    _prune_stream_state(stream_state)

    logger.info(
        "recap_tick session_id=%s cursor=%s->%s window=%.2f-%.2f duration=%.2fs anchor=%.2f chunks=%s llm_ms=%s parse_ok=%s include_partial=%s",
        session_id,
        cursor_before,
        stream_state.recap_cursor_seq,
        window_start,
        window_end,
        window_duration,
        anchor,
        len(window_chunks),
        llm_latency_ms,
        parse_ok,
        include_partial,
    )

    return {
        "meeting_id": session_id,
        "stage": "in",
        "intent": "tick",
        "sla": "near_realtime",
        "live_recap": recap,
        "recap": recap,
        "topic": topic_payload,
        "intent_payload": intent_payload,
        "transcript_window": window_text,
        "semantic_intent_label": stream_state.semantic_intent_label,
        "semantic_intent_slots": stream_state.semantic_intent_slots,
        "topic_segments": stream_state.topic_segments,
        "current_topic_id": stream_state.current_topic_id,
        # Deprecated: ADR extraction removed; keep empty lists for compatibility.
        "actions": stream_state.actions,
        "decisions": stream_state.decisions,
        "risks": stream_state.risks,
        # Deprecated in realtime tick; kept for backward-compatible payload shape.
        "tool_suggestions": [],
        "debug_info": {
            "recap_cursor_before": cursor_before,
            "recap_cursor_seq": stream_state.recap_cursor_seq,
            "window_sec": RECAP_WINDOW_SEC,
            "window_start": window_start,
            "window_end": window_end,
            "window_duration": window_duration,
            "window_chunks": len(window_chunks),
            "include_partial": include_partial,
            "llm_latency_ms": llm_latency_ms,
            "parse_ok": parse_ok,
            "raw_len": meta.get("raw_len"),
            "last_recap_tick_anchor": stream_state.last_recap_tick_anchor,
            "last_final_seq": stream_state.last_final_seq,
            "last_transcript_seq": stream_state.last_transcript_seq,
        },
    }


async def _publish_state_event(session_id: str, state: Dict[str, Any]) -> None:
    version = session_store.next_state_version(session_id)
    await session_bus.publish(
        session_id,
        {
            "event": "state",
            "version": version,
            "payload": state,
        },
    )


async def _stream_consumer(session_id: str, queue: asyncio.Queue) -> None:
    session = session_store.ensure(session_id)
    stream_state = session.stream_state
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=900)
            except asyncio.TimeoutError:
                break
            if event.get("event") != "transcript_event":
                continue
            payload = event.get("payload") or {}
            is_final = bool(payload.get("is_final", True))

            try:
                seq = int(event.get("seq") or 0)
            except (TypeError, ValueError):
                seq = 0

            confidence = payload.get("confidence")
            time_start = float(payload.get("time_start") or 0.0)
            time_end = float(payload.get("time_end") or 0.0)
            speaker = payload.get("speaker") or "SPEAKER_01"

            chunk = FinalTranscriptChunk(
                seq=seq,
                time_start=time_start,
                time_end=time_end,
                speaker=speaker,
                lang=payload.get("lang") or "vi",
                confidence=float(1.0 if confidence is None else confidence),
                text=payload.get("chunk") or payload.get("text") or "",
            )
            now = time.time()
            _update_last_transcript(stream_state, chunk, seq, is_final, now)
            if is_final:
                _append_final_chunk(stream_state, chunk, now)

            recap_due = _should_recap_tick(stream_state, now)

            if recap_due:
                try:
                    recap_state = _run_recap_tick(session_id, stream_state, now)
                    if recap_state:
                        await _publish_state_event(session_id, recap_state)
                except Exception:
                    pass
    except asyncio.CancelledError:
        pass
    finally:
        session_bus.unsubscribe(session_id, queue)
        stream_workers.pop(session_id, None)


def _ensure_stream_worker(session_id: str) -> None:
    task = stream_workers.get(session_id)
    if task and not task.done():
        return
    queue = session_bus.subscribe(session_id)
    stream_workers[session_id] = asyncio.create_task(_stream_consumer(session_id, queue))


async def _safe_send_json(websocket: WebSocket, lock: asyncio.Lock, payload: Dict[str, Any]) -> None:
    async with lock:
        await websocket.send_json(payload)


def _build_transcript_event_compat_from_record(
    session_id: str,
    event: Dict[str, Any],
    timeline_origin_ms: Optional[int],
) -> Tuple[Optional[int], List[Dict[str, Any]]]:
    payload = event.get("payload") or {}
    record_start_ts_ms = payload.get("record_start_ts_ms")
    try:
        record_start_ts_ms = int(record_start_ts_ms) if record_start_ts_ms is not None else None
    except (TypeError, ValueError):
        record_start_ts_ms = None

    if record_start_ts_ms is not None:
        timeline_origin_ms = (
            record_start_ts_ms
            if timeline_origin_ms is None
            else min(timeline_origin_ms, record_start_ts_ms)
        )
    if timeline_origin_ms is None:
        timeline_origin_ms = int(time.time() * 1000)

    bus_seq = int(event.get("seq") or 0)
    compat_events: List[Dict[str, Any]] = []
    for idx, seg in enumerate(payload.get("segments") or []):
        if not isinstance(seg, dict):
            continue
        try:
            start_ts_ms = int(seg.get("start_ts_ms")) if seg.get("start_ts_ms") is not None else None
        except (TypeError, ValueError):
            start_ts_ms = None
        try:
            end_ts_ms = int(seg.get("end_ts_ms")) if seg.get("end_ts_ms") is not None else None
        except (TypeError, ValueError):
            end_ts_ms = None

        text_value = str(seg.get("text") or "").strip()
        if not text_value:
            continue
        time_start = max(0.0, float((start_ts_ms or timeline_origin_ms) - timeline_origin_ms) / 1000.0)
        time_end = max(0.0, float((end_ts_ms or start_ts_ms or timeline_origin_ms) - timeline_origin_ms) / 1000.0)
        compat_events.append(
            {
                "event": "transcript_event",
                "seq": bus_seq * 1000 + idx,
                "payload": {
                    "meeting_id": session_id,
                    "chunk": text_value,
                    "speaker": str(seg.get("speaker") or "SPEAKER_01"),
                    "time_start": time_start,
                    "time_end": time_end,
                    "is_final": True,
                    "confidence": float(seg.get("confidence") or 1.0),
                    "lang": "vi",
                },
            }
        )
    return timeline_origin_ms, compat_events


def _build_state_event_compat_from_window(event: Dict[str, Any]) -> Dict[str, Any]:
    payload = event.get("payload") or {}
    recap_items = payload.get("recap") or []
    recap_text = " ".join(
        str(item.get("text") or "").strip()
        for item in recap_items
        if isinstance(item, dict) and str(item.get("text") or "").strip()
    ).strip()
    topics = payload.get("topics") or []
    first_topic = topics[0] if topics and isinstance(topics[0], dict) else {}
    topic_id = str(first_topic.get("topic_id") or "T0")
    topic_title = str(first_topic.get("title") or topic_id)
    return {
        "event": "state",
        "payload": {
            "stage": "in",
            "intent": "tick",
            "live_recap": recap_text,
            "recap": recap_text,
            "current_topic_id": topic_id,
            "topic": {"topic_id": topic_id, "title": topic_title},
            "topic_segments": [
                {
                    "topic_id": topic_id,
                    "title": topic_title,
                    "start_t": 0.0,
                    "end_t": 0.0,
                }
            ],
            "actions": [],
            "decisions": [],
            "risks": [],
            "debug_info": {
                "window_id": payload.get("window_id"),
                "revision": payload.get("revision"),
            },
        },
    }


def _parse_record_id_from_seg_id(seg_id: str) -> Optional[int]:
    if not seg_id:
        return None
    parts = str(seg_id).split(":")
    for part in parts:
        if part.startswith("r") and part[1:].isdigit():
            try:
                return int(part[1:])
            except (TypeError, ValueError):
                return None
    return None


def _load_transcript_record_replay_events(session_id: str) -> List[Dict[str, Any]]:
    """Replay-safe transcript hydration for frontend reconnects/page reloads."""
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    seg_id, speaker, "offset", start_ts_ms, end_ts_ms, text, confidence, record_id
                FROM transcript_segment
                WHERE session_id = :session_id
                ORDER BY start_ts_ms ASC, seg_id ASC
                """
            ),
            {"session_id": session_id},
        ).fetchall()
    except Exception:
        db.rollback()
        logger.debug("transcript_replay_load_failed session_id=%s", session_id, exc_info=True)
        return []
    finally:
        db.close()

    if not rows:
        return []

    grouped: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    bounds: Dict[int, Tuple[int, int]] = {}
    for row in rows:
        seg_id = str(row[0] or "")
        speaker = str(row[1] or "SPEAKER_01")
        offset = str(row[2] or "00:00")
        try:
            start_ts_ms = int(row[3]) if row[3] is not None else 0
        except (TypeError, ValueError):
            start_ts_ms = 0
        try:
            end_ts_ms = int(row[4]) if row[4] is not None else None
        except (TypeError, ValueError):
            end_ts_ms = None
        text_value = str(row[5] or "").strip()
        if not text_value:
            continue
        try:
            confidence = float(row[6]) if row[6] is not None else 1.0
        except (TypeError, ValueError):
            confidence = 1.0
        rid_raw = row[7]
        try:
            record_id = int(rid_raw) if rid_raw is not None else None
        except (TypeError, ValueError):
            record_id = None
        if record_id is None:
            record_id = _parse_record_id_from_seg_id(seg_id)
        if record_id is None:
            record_id = 0

        grouped[record_id].append(
            {
                "seg_id": seg_id,
                "speaker": speaker,
                "offset": offset,
                "start_ts_ms": start_ts_ms,
                "end_ts_ms": end_ts_ms,
                "text": text_value,
                "confidence": max(0.0, min(confidence, 1.0)),
            }
        )
        seg_end = end_ts_ms if end_ts_ms is not None else start_ts_ms
        if record_id in bounds:
            current_start, current_end = bounds[record_id]
            bounds[record_id] = (min(current_start, start_ts_ms), max(current_end, seg_end))
        else:
            bounds[record_id] = (start_ts_ms, seg_end)

    replay_events: List[Dict[str, Any]] = []
    for record_id in sorted(grouped.keys()):
        segments = grouped.get(record_id) or []
        if not segments:
            continue
        record_start_ts_ms, record_end_ts_ms = bounds.get(record_id, (segments[0]["start_ts_ms"], segments[-1]["start_ts_ms"]))
        replay_events.append(
            {
                "event": "transcript_record_ready",
                "payload": {
                    "record_id": record_id,
                    "record_start_ts_ms": int(record_start_ts_ms),
                    "record_end_ts_ms": int(max(record_end_ts_ms, record_start_ts_ms)),
                    "uri": None,
                    "segments": segments,
                    "asr_error": None,
                    "replay": True,
                },
            }
        )
    return replay_events


@router.websocket("/audio/{session_id}")
async def audio_ingest(websocket: WebSocket, session_id: str):
    token = websocket.query_params.get("token")
    if not token or not verify_audio_ingest_token(token, expected_session_id=session_id):
        await websocket.close(code=1008)
        return

    # Keep ingest resilient across backend restarts: recreate in-memory session on demand.
    session = session_store.ensure(session_id)

    await websocket.accept()
    await websocket.send_json({"event": "connected", "channel": "audio", "session_id": session_id})
    send_lock = asyncio.Lock()
    realtime_av_service.ensure_session(session_id, meeting_id=session_id)
    _ensure_stream_worker(session_id)

    try:
        raw = await websocket.receive_text()
        start_msg = AudioStartMessage.model_validate(json.loads(raw))
    except Exception as exc:
        await _safe_send_json(
            websocket,
            send_lock,
            {"event": "error", "session_id": session_id, "message": f"invalid_start: {exc}"},
        )
        await websocket.close(code=1003)
        return

    expected = session.config.expected_audio
    if (
        start_msg.audio.codec != expected.codec
        or start_msg.audio.sample_rate_hz != expected.sample_rate_hz
        or start_msg.audio.channels != expected.channels
    ):
        await _safe_send_json(
            websocket,
            send_lock,
            {
                "event": "error",
                "session_id": session_id,
                "message": "audio_format_mismatch",
                "expected_audio": {
                    "codec": expected.codec,
                    "sample_rate_hz": expected.sample_rate_hz,
                    "channels": expected.channels,
                },
            },
        )
        await websocket.close(code=1003)
        return

    await _safe_send_json(
        websocket,
        send_lock,
        {
            "event": "audio_start_ack",
            "session_id": session_id,
            "accepted_audio": {
                "codec": expected.codec,
                "sample_rate_hz": expected.sample_rate_hz,
                "channels": expected.channels,
            },
            "stt_enabled": True,
            "stt_mode": "batch_asr_record",
            "record_ms": int(realtime_av_service.record_ms),
        },
    )

    ingest_ok_sent = False
    received_bytes = 0
    received_frames = 0
    stop_requested = False
    last_status_push_ms = 0

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            if message.get("bytes") is not None:
                chunk = message["bytes"]
                if chunk:
                    received_bytes += len(chunk)
                    received_frames += 1
                    if not ingest_ok_sent:
                        ingest_ok_sent = True
                        await _safe_send_json(
                            websocket,
                            send_lock,
                            {
                                "event": "audio_ingest_ok",
                                "session_id": session_id,
                                "received_bytes": received_bytes,
                                "received_frames": received_frames,
                            },
                        )
                    try:
                        result = await realtime_av_service.handle_audio_chunk_bytes(session_id, chunk)
                    except Exception as exc:
                        await _safe_send_json(
                            websocket,
                            send_lock,
                            {
                                "event": "error",
                                "session_id": session_id,
                                "message": f"audio_chunk_failed: {exc}",
                            },
                        )
                        continue

                    if not bool(result.get("accepted", True)):
                        await _safe_send_json(
                            websocket,
                            send_lock,
                            {
                                "event": "error",
                                "session_id": session_id,
                                "message": f"audio_chunk_rejected: {result.get('reason') or 'unknown'}",
                            },
                        )
                    ts_ms = int(time.time() * 1000)
                    if received_frames == 1 or (ts_ms - last_status_push_ms) >= 1000:
                        last_status_push_ms = ts_ms
                        await session_bus.publish(
                            session_id,
                            {
                                "event": "audio_ingest_status",
                                "payload": {
                                    "session_id": session_id,
                                    "ts_ms": ts_ms,
                                    "received_bytes": received_bytes,
                                    "received_frames": received_frames,
                                    "accepted": bool(result.get("accepted", True)),
                                    "reason": result.get("reason"),
                                },
                            },
                        )
                    session_store.touch(session_id)
                continue

            if message.get("text") is not None:
                try:
                    obj = json.loads(message["text"])
                    if obj.get("type") == "stop":
                        stop_requested = True
                        break
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        if stop_requested or received_frames > 0:
            try:
                await realtime_av_service.flush_session(session_id)
            except Exception:
                logger.warning("audio_flush_failed session_id=%s", session_id, exc_info=True)
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/in-meeting/{session_id}")
async def in_meeting_ingest(websocket: WebSocket, session_id: str):
    await websocket.accept()
    await websocket.send_json({"event": "connected", "channel": "ingest", "session_id": session_id})
    session_store.ensure(session_id)
    _ensure_stream_worker(session_id)
    try:
        while True:
            try:
                payload = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception as exc:
                await websocket.send_json({"event": "error", "session_id": session_id, "message": str(exc)})
                continue

            meeting_id = payload.get("meeting_id") or session_id
            chunk_text = payload.get("chunk") or payload.get("text") or ""
            transcript_payload: Dict[str, Any] = {
                "meeting_id": meeting_id,
                "chunk": chunk_text,
                "speaker": payload.get("speaker", "SPEAKER_01"),
                "time_start": payload.get("time_start", 0.0),
                "time_end": payload.get("time_end", 0.0),
                "is_final": payload.get("is_final", True),
                "confidence": payload.get("confidence", 1.0),
                "lang": payload.get("lang", "vi"),
                "question": payload.get("question"),
            }
            try:
                seq = await ingestTranscript(session_id, transcript_payload, source="transcript_test_ws")
                await websocket.send_json({"event": "ingest_ack", "session_id": session_id, "seq": seq})
            except Exception as exc:
                await websocket.send_json({"event": "error", "session_id": session_id, "message": str(exc)})
            _ensure_stream_worker(session_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/frontend/{session_id}")
async def in_meeting_frontend(websocket: WebSocket, session_id: str):
    await websocket.accept()
    queue = session_bus.subscribe(session_id)
    await websocket.send_json({"event": "connected", "channel": "frontend", "session_id": session_id})
    timeline_origin_ms: Optional[int] = None
    replay_events = _load_transcript_record_replay_events(session_id)
    if replay_events:
        logger.info("frontend_transcript_replay session_id=%s records=%s", session_id, len(replay_events))
    for replay_event in replay_events:
        await websocket.send_json(replay_event)
        timeline_origin_ms, compat_events = _build_transcript_event_compat_from_record(
            session_id=session_id,
            event=replay_event,
            timeline_origin_ms=timeline_origin_ms,
        )
        for compat_event in compat_events:
            await websocket.send_json(compat_event)
    try:
        while True:
            try:
                event = await queue.get()
            except asyncio.CancelledError:
                break
            if event.get("event") == "transcript_event":
                # Keep frontend contract minimal; strip internal-only fields.
                payload = dict(event.get("payload") or {})
                payload.pop("transcript_window", None)
                payload.pop("source", None)
                payload.pop("question", None)
                cleaned = dict(event)
                cleaned["payload"] = payload
                await websocket.send_json(cleaned)
            elif event.get("event") == "transcript_record_ready":
                # Keep new contract and emit compatibility transcript_event entries.
                await websocket.send_json(event)
                timeline_origin_ms, compat_events = _build_transcript_event_compat_from_record(
                    session_id=session_id,
                    event=event,
                    timeline_origin_ms=timeline_origin_ms,
                )
                for compat_event in compat_events:
                    await websocket.send_json(compat_event)
            elif event.get("event") == "recap_window_ready":
                # Keep new contract and emit compatibility state update.
                await websocket.send_json(event)
                await websocket.send_json(_build_state_event_compat_from_window(event))
            else:
                await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        session_bus.unsubscribe(session_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
