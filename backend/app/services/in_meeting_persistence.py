from datetime import datetime, date
import uuid
from typing import Optional, Dict, Any, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    TranscriptChunk,
    TopicSegment,
    AdrHistory,
    ToolSuggestion,
    ContextWindow,
)


def _coerce_uuid(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except Exception:
        return None


def _coerce_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None
    return None


def persist_transcript(db: Session, meeting_id: str, seg: Dict[str, Any]) -> Optional[TranscriptChunk]:
    try:
        chunk_index = seg.get("chunk_index")
        if chunk_index is None:
            chunk_index = seg.get("seq")
        try:
            chunk_index = int(chunk_index)
        except (TypeError, ValueError):
            chunk_index = 0
        chunk = TranscriptChunk(
            meeting_id=meeting_id,
            chunk_index=chunk_index,
            speaker=seg.get("speaker"),
            text=seg.get("text", ""),
            time_start=seg.get("time_start", seg.get("start_time", 0.0)),
            time_end=seg.get("time_end", seg.get("end_time", 0.0)),
            is_final=seg.get("is_final", True),
            lang=seg.get("lang", "vi"),
            confidence=seg.get("confidence", 1.0),
        )
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        return chunk
    except Exception as e:
        db.rollback()
        print(f"[persist_transcript] error: {e}")
        return None


def persist_topic_segment(db: Session, meeting_id: str, segment: Dict[str, Any]) -> Optional[TopicSegment]:
    try:
        row = TopicSegment(
            meeting_id=meeting_id,
            topic_id=segment.get("topic_id"),
            title=segment.get("title"),
            start_t=segment.get("start_t", 0.0),
            end_t=segment.get("end_t", 0.0),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception as e:
        db.rollback()
        print(f"[persist_topic_segment] error: {e}")
        return None


def persist_context_window(db: Session, meeting_id: str, window: Dict[str, Any]) -> Optional[ContextWindow]:
    try:
        row = ContextWindow(
            meeting_id=meeting_id,
            start_time=window.get("start_time", 0.0),
            end_time=window.get("end_time", 0.0),
            transcript_text=window.get("transcript_text"),
            visual_context=window.get("visual_context"),
            citations=window.get("citations"),
            window_index=window.get("window_index"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    except Exception as e:
        db.rollback()
        print(f"[persist_context_window] error: {e}")
        return None


def persist_adr(db: Session, meeting_id: str, actions: List[Dict[str, Any]], decisions: List[Dict[str, Any]], risks: List[Dict[str, Any]]) -> None:
    action_query = text("""
        INSERT INTO action_item (
            meeting_id, owner_user_id, description, deadline, priority,
            status, source_text, external_task_link, external_task_id
        )
        VALUES (
            :meeting_id, :owner_user_id, :description, :deadline, :priority,
            :status, :source_text, :external_task_link, :external_task_id
        )
    """)
    decision_query = text("""
        INSERT INTO decision_item (
            meeting_id, description, rationale, source_text, status
        )
        VALUES (
            :meeting_id, :description, :rationale, :source_text, :status
        )
    """)
    risk_query = text("""
        INSERT INTO risk_item (
            meeting_id, description, severity, mitigation,
            source_text, status, owner_user_id
        )
        VALUES (
            :meeting_id, :description, :severity, :mitigation,
            :source_text, :status, :owner_user_id
        )
    """)
    try:
        for a in actions or []:
            description = a.get("task") or a.get("description")
            if not description:
                continue
            db.execute(action_query, {
                "meeting_id": meeting_id,
                "owner_user_id": _coerce_uuid(a.get("owner") or a.get("owner_user_id")),
                "description": description,
                "deadline": _coerce_date(a.get("due_date") or a.get("deadline")),
                "priority": a.get("priority") or "medium",
                "status": a.get("status") or "proposed",
                "source_text": a.get("source_text"),
                "external_task_link": a.get("external_task_link"),
                "external_task_id": a.get("external_task_id") or a.get("external_id"),
            })
            db.add(AdrHistory(meeting_id=meeting_id, item_type="action", payload=a, operation="add"))

        for d in decisions or []:
            description = d.get("title") or d.get("description")
            if not description:
                continue
            rationale = d.get("rationale")
            impact = d.get("impact")
            if impact:
                impact_note = f"Impact: {impact}"
                rationale = f"{rationale}\n{impact_note}" if rationale else impact_note
            db.execute(decision_query, {
                "meeting_id": meeting_id,
                "description": description,
                "rationale": rationale,
                "source_text": d.get("source_text"),
                "status": d.get("status") or "proposed",
            })
            db.add(AdrHistory(meeting_id=meeting_id, item_type="decision", payload=d, operation="add"))

        for r in risks or []:
            description = r.get("desc") or r.get("description")
            if not description:
                continue
            db.execute(risk_query, {
                "meeting_id": meeting_id,
                "description": description,
                "severity": r.get("severity") or "medium",
                "mitigation": r.get("mitigation"),
                "source_text": r.get("source_text"),
                "status": r.get("status") or "proposed",
                "owner_user_id": _coerce_uuid(r.get("owner") or r.get("owner_user_id")),
            })
            db.add(AdrHistory(meeting_id=meeting_id, item_type="risk", payload=r, operation="add"))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[persist_adr] error: {e}")


def persist_tool_suggestions(db: Session, meeting_id: str, suggestions: List[Dict[str, Any]]) -> None:
    try:
        for s in suggestions or []:
            row = ToolSuggestion(
                meeting_id=meeting_id,
                suggestion_id=s.get("suggestion_id"),
                type=s.get("type"),
                action_hash=s.get("action_hash"),
                payload=s.get("payload"),
            )
            db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[persist_tool_suggestions] error: {e}")
