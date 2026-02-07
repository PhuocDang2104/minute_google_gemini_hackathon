"""
Meeting Minutes Service
"""
from datetime import datetime
import json
import logging
import math
import re
from typing import Iterable
from typing import List, Optional, Tuple, Dict, Any
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.minutes import (
    MeetingMinutesCreate, MeetingMinutesUpdate,
    MeetingMinutesResponse, MeetingMinutesList,
    DistributionLogCreate, DistributionLogResponse, DistributionLogList,
    GenerateMinutesRequest
)
from app.services import transcript_service, action_item_service
from app.utils.markdown_utils import render_markdown_to_html
from app.services import meeting_service, participant_service
from pathlib import Path
from datetime import timezone

logger = logging.getLogger(__name__)


# Transcript windowing settings (character-based)
MAX_DIRECT_TRANSCRIPT_CHARS = 15000
WINDOW_CHAR_SIZE = 8000
WINDOW_CHAR_OVERLAP = 200
MAX_WINDOWS = 12


def _chunk_text(text: str, max_chars: int, overlap: int) -> Iterable[str]:
    """Chunk text into overlapping windows by character count."""
    if not text:
        return []
    if max_chars <= 0:
        return [text]
    overlap = max(0, min(overlap, max_chars - 1))
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + max_chars)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


async def _summarize_transcript_windows(
    assistant: "MeetingAIAssistant",
    transcript: str,
) -> List[str]:
    """Summarize transcript by windows, then return list of summaries."""
    if not transcript:
        return []

    window_size = WINDOW_CHAR_SIZE
    if len(transcript) > WINDOW_CHAR_SIZE * MAX_WINDOWS:
        window_size = math.ceil(len(transcript) / MAX_WINDOWS)

    chunks = list(_chunk_text(transcript, window_size, WINDOW_CHAR_OVERLAP))
    summaries: List[str] = []
    for idx, chunk in enumerate(chunks, start=1):
        prompt = (
            "Tóm tắt ngắn gọn đoạn transcript sau (3-5 gạch đầu dòng). "
            "Giữ nguyên nội dung, không bịa. "
            "Nếu có thời điểm/nhân vật quan trọng hoặc action/decision/risk thì nêu rõ.\n\n"
            f"ĐOẠN {idx}/{len(chunks)}:\n{chunk}"
        )
        try:
            summary = await assistant.chat.chat(prompt)
        except Exception as exc:
            logger.warning("Failed to summarize transcript window %s: %s", idx, exc)
            summary = ""
        summary = (summary or "").strip()
        if summary:
            summaries.append(summary)
    return summaries


def _hydrate_minutes_html(minutes: MeetingMinutesResponse) -> MeetingMinutesResponse:
    """
    Ensure minutes_html is populated when minutes_markdown exists.
    Useful for older records created before markdown->HTML auto render.
    """
    if minutes.minutes_markdown and (not minutes.minutes_html or _looks_like_markdown(minutes.minutes_html)):
        try:
            minutes.minutes_html = render_markdown_to_html(minutes.minutes_markdown)
        except Exception:
            # Keep silent to avoid breaking response
            pass
    return minutes


def _looks_like_markdown(text: Optional[str]) -> bool:
    if not text:
        return True
    # heuristic: common markdown markers
    return ("| ---" in text) or ("**" in text) or ("##" in text) or ("- " in text and "<" not in text)


def _infer_session_type(meeting_type: Optional[str], request_session_type: Optional[str]) -> str:
    if request_session_type in {"meeting", "course"}:
        return request_session_type
    mt = (meeting_type or "").strip().lower()
    if mt in {"study", "training", "education", "learning", "workshop", "course", "class"}:
        return "course"
    return "meeting"


def _fmt_seconds(value: Optional[float]) -> str:
    if value is None:
        return ""
    total = max(0, int(value))
    mm = total // 60
    ss = total % 60
    return f"{mm:02d}:{ss:02d}"


def _load_topic_tracker(db: Session, meeting_id: str) -> List[Dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT topic_id, title, start_t, end_t
            FROM topic_segment
            WHERE meeting_id = :meeting_id
            ORDER BY start_t ASC NULLS LAST, created_at ASC
            """
        ),
        {"meeting_id": meeting_id},
    ).fetchall()
    topics: List[Dict[str, Any]] = []
    for row in rows:
        start_t = float(row[2]) if row[2] is not None else None
        end_t = float(row[3]) if row[3] is not None else None
        duration = None
        if start_t is not None and end_t is not None and end_t >= start_t:
            duration = round(end_t - start_t, 2)
        topics.append(
            {
                "topic_id": row[0],
                "title": row[1],
                "start_time": start_t,
                "end_time": end_t,
                "duration_seconds": duration,
            }
        )
    return topics


def _safe_json_list(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _build_ai_filters(
    action_rows: List[Dict[str, Any]],
    decision_rows: List[Dict[str, Any]],
    risk_rows: List[Dict[str, Any]],
    topic_rows: List[Dict[str, Any]],
) -> List[str]:
    filters: List[str] = []

    if action_rows:
        filters.append(f"action:all ({len(action_rows)})")
        high_count = sum(
            1
            for row in action_rows
            if str(row.get("priority", "")).lower() in {"high", "critical"}
        )
        if high_count:
            filters.append(f"action:high_priority ({high_count})")
        unassigned_count = sum(
            1 for row in action_rows if not str(row.get("owner") or "").strip()
        )
        if unassigned_count:
            filters.append(f"action:unassigned ({unassigned_count})")

    if decision_rows:
        filters.append(f"decision:all ({len(decision_rows)})")
        pending_decisions = sum(
            1
            for row in decision_rows
            if str(row.get("status", "")).lower() in {"", "proposed", "draft"}
        )
        if pending_decisions:
            filters.append(f"decision:pending_confirmation ({pending_decisions})")

    if risk_rows:
        filters.append(f"risk:all ({len(risk_rows)})")
        high_risks = sum(
            1
            for row in risk_rows
            if str(row.get("severity", "")).lower() in {"high", "critical"}
        )
        if high_risks:
            filters.append(f"risk:high_or_critical ({high_risks})")

    if topic_rows:
        filters.append(f"topic:tracked ({len(topic_rows)})")

    return filters



def list_minutes(db: Session, meeting_id: str) -> MeetingMinutesList:
    """List all minutes versions for a meeting"""
    query = text("""
        SELECT 
            id::text, meeting_id::text, version, minutes_text,
            minutes_html, minutes_markdown, minutes_doc_url,
            executive_summary, generated_at, edited_by::text,
            edited_at, status, approved_by::text, approved_at
        FROM meeting_minutes
        WHERE meeting_id = :meeting_id
        ORDER BY version DESC
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    rows = result.fetchall()
    
    minutes_list = []
    for row in rows:
        minutes_list.append(_hydrate_minutes_html(MeetingMinutesResponse(
            id=row[0],
            meeting_id=row[1],
            version=row[2],
            minutes_text=row[3],
            minutes_html=row[4],
            minutes_markdown=row[5],
            minutes_doc_url=row[6],
            executive_summary=row[7],
            generated_at=row[8],
            edited_by=row[9],
            edited_at=row[10],
            status=row[11],
            approved_by=row[12],
            approved_at=row[13]
        )))
    
    return MeetingMinutesList(minutes=minutes_list, total=len(minutes_list))


def get_latest_minutes(db: Session, meeting_id: str) -> Optional[MeetingMinutesResponse]:
    """Get the latest minutes for a meeting"""
    query = text("""
        SELECT 
            id::text, meeting_id::text, version, minutes_text,
            minutes_html, minutes_markdown, minutes_doc_url,
            executive_summary, generated_at, edited_by::text,
            edited_at, status, approved_by::text, approved_at
        FROM meeting_minutes
        WHERE meeting_id = :meeting_id
        ORDER BY version DESC
        LIMIT 1
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    row = result.fetchone()
    
    if not row:
        return None
    
    return _hydrate_minutes_html(MeetingMinutesResponse(
        id=row[0],
        meeting_id=row[1],
        version=row[2],
        minutes_text=row[3],
        minutes_html=row[4],
        minutes_markdown=row[5],
        minutes_doc_url=row[6],
        executive_summary=row[7],
        generated_at=row[8],
        edited_by=row[9],
        edited_at=row[10],
        status=row[11],
        approved_by=row[12],
        approved_at=row[13]
    ))


def get_minutes_by_id(db: Session, minutes_id: str) -> Optional[MeetingMinutesResponse]:
    """Get minutes by ID (hydrated with rendered HTML if only markdown exists)."""
    query = text("""
        SELECT 
            id::text, meeting_id::text, version, minutes_text,
            minutes_html, minutes_markdown, minutes_doc_url,
            executive_summary, generated_at, edited_by::text,
            edited_at, status, approved_by::text, approved_at
        FROM meeting_minutes
        WHERE id = :minutes_id
        LIMIT 1
    """)
    row = db.execute(query, {'minutes_id': minutes_id}).fetchone()
    if not row:
        return None

    return _hydrate_minutes_html(MeetingMinutesResponse(
        id=row[0],
        meeting_id=row[1],
        version=row[2],
        minutes_text=row[3],
        minutes_html=row[4],
        minutes_markdown=row[5],
        minutes_doc_url=row[6],
        executive_summary=row[7],
        generated_at=row[8],
        edited_by=row[9],
        edited_at=row[10],
        status=row[11],
        approved_by=row[12],
        approved_at=row[13]
    ))


def render_minutes_html_content(minutes: MeetingMinutesResponse) -> str:
    """
    Render minutes into HTML for export/viewing, preferring stored HTML,
    otherwise converting markdown, otherwise wrapping plain text.
    """
    if minutes.minutes_html and not _looks_like_markdown(minutes.minutes_html):
        return minutes.minutes_html

    # Prefer markdown if available
    source_md = minutes.minutes_markdown or (minutes.minutes_html if _looks_like_markdown(minutes.minutes_html) else None)
    if source_md:
        return render_markdown_to_html(source_md)
    if minutes.minutes_text:
        from html import escape
        return f"<pre style=\"white-space: pre-wrap; font-family: sans-serif;\">{escape(minutes.minutes_text)}</pre>"
    return "<p>Chưa có nội dung biên bản.</p>"


def render_minutes_full_page(db: Session, minutes_id: str) -> str:
    """
    Build a styled HTML page for export/print, including meta info.
    """
    minutes = get_minutes_by_id(db, minutes_id)
    if not minutes:
        raise ValueError("Minutes not found")

    meeting = meeting_service.get_meeting(db, minutes.meeting_id)
    participants = participant_service.list_participants(db, minutes.meeting_id) if meeting else None

    title = meeting.title if meeting else "Biên bản cuộc họp"
    start = getattr(meeting, "start_time", None)
    end = getattr(meeting, "end_time", None)
    def _fmt_time(dt):
        if not dt:
            return ""
        if isinstance(dt, str):
            try:
                from datetime import datetime
                return datetime.fromisoformat(dt.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
            except Exception:
                return dt
        if getattr(dt, "tzinfo", None) is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%d/%m/%Y %H:%M")

    date_str = _fmt_time(start).split(" ")[0] if start else ""
    time_str = ""
    if start and end:
        time_str = f"{_fmt_time(start).split(' ')[1]} - {_fmt_time(end).split(' ')[1]}"
    elif start:
        time_str = _fmt_time(start)

    participants_names = ""
    if participants and participants.participants:
        names = []
        for p in participants.participants:
            name = p.display_name or p.email or "Thành viên"
            names.append(name)
        participants_names = ", ".join(names)

    template_path = Path(__file__).parent.parent / "templates" / "minutes_export.html"
    template_html = template_path.read_text(encoding="utf-8")

    content_html = render_minutes_html_content(minutes)
    exec_summary_html = minutes.executive_summary or "<p>Chưa có tóm tắt.</p>"

    filled = (
        template_html
        .replace("{{title}}", title)
        .replace("{{date}}", date_str or "N/A")
        .replace("{{time}}", time_str or "N/A")
        .replace("{{type}}", getattr(meeting, "meeting_type", "") if meeting else "")
        .replace("{{participants}}", participants_names or "N/A")
        .replace("{{executive_summary}}", exec_summary_html if exec_summary_html.startswith("<") else f"<p>{exec_summary_html}</p>")
        .replace("{{minutes_content}}", content_html)
    )
    return filled


def create_minutes(db: Session, data: MeetingMinutesCreate) -> MeetingMinutesResponse:
    """Create new meeting minutes"""
    minutes_id = str(uuid4())
    now = datetime.utcnow()
    rendered_html = None
    if data.minutes_markdown and not data.minutes_html:
        rendered_html = render_markdown_to_html(data.minutes_markdown)
    
    # Get next version number
    version_query = text("""
        SELECT COALESCE(MAX(version), 0) + 1
        FROM meeting_minutes
        WHERE meeting_id = :meeting_id
    """)
    version_result = db.execute(version_query, {'meeting_id': data.meeting_id})
    version = version_result.fetchone()[0]
    
    query = text("""
        INSERT INTO meeting_minutes (
            id, meeting_id, version, minutes_text, minutes_html,
            minutes_markdown, executive_summary, status, generated_at
        )
        VALUES (
            :id, :meeting_id, :version, :minutes_text, :minutes_html,
            :minutes_markdown, :executive_summary, :status, :generated_at
        )
        RETURNING id::text
    """)
    
    db.execute(query, {
        'id': minutes_id,
        'meeting_id': data.meeting_id,
        'version': version,
        'minutes_text': data.minutes_text,
        'minutes_html': data.minutes_html or rendered_html,
        'minutes_markdown': data.minutes_markdown,
        'executive_summary': data.executive_summary,
        'status': data.status,
        'generated_at': now
    })
    db.commit()
    
    return MeetingMinutesResponse(
        id=minutes_id,
        meeting_id=data.meeting_id,
        version=version,
        minutes_text=data.minutes_text,
        minutes_html=data.minutes_html or rendered_html,
        minutes_markdown=data.minutes_markdown,
        executive_summary=data.executive_summary,
        status=data.status,
        generated_at=now
    )


def update_minutes(
    db: Session, 
    minutes_id: str, 
    data: MeetingMinutesUpdate,
    edited_by: Optional[str] = None
) -> Optional[MeetingMinutesResponse]:
    """Update meeting minutes"""
    updates = ["edited_at = :edited_at"]
    params = {'minutes_id': minutes_id, 'edited_at': datetime.utcnow()}
    rendered_html = None
    if data.minutes_markdown is not None:
        rendered_html = render_markdown_to_html(data.minutes_markdown)
    
    if edited_by:
        updates.append("edited_by = :edited_by")
        params['edited_by'] = edited_by
    
    if data.minutes_text is not None:
        updates.append("minutes_text = :minutes_text")
        params['minutes_text'] = data.minutes_text
    if data.minutes_html is not None:
        updates.append("minutes_html = :minutes_html")
        params['minutes_html'] = data.minutes_html
    elif rendered_html is not None:
        updates.append("minutes_html = :minutes_html")
        params['minutes_html'] = rendered_html
    if data.minutes_markdown is not None:
        updates.append("minutes_markdown = :minutes_markdown")
        params['minutes_markdown'] = data.minutes_markdown
    if data.executive_summary is not None:
        updates.append("executive_summary = :executive_summary")
        params['executive_summary'] = data.executive_summary
    if data.status is not None:
        updates.append("status = :status")
        params['status'] = data.status
    
    query = text(f"""
        UPDATE meeting_minutes
        SET {', '.join(updates)}
        WHERE id = :minutes_id
        RETURNING id::text, meeting_id::text
    """)
    
    result = db.execute(query, params)
    db.commit()
    row = result.fetchone()
    
    if not row:
        return None
    
    return get_latest_minutes(db, row[1])


def approve_minutes(
    db: Session, 
    minutes_id: str, 
    approved_by: str
) -> Optional[MeetingMinutesResponse]:
    """Approve meeting minutes"""
    now = datetime.utcnow()
    
    query = text("""
        UPDATE meeting_minutes
        SET status = 'approved', approved_by = :approved_by, approved_at = :approved_at
        WHERE id = :minutes_id
        RETURNING id::text, meeting_id::text
    """)
    
    result = db.execute(query, {
        'minutes_id': minutes_id,
        'approved_by': approved_by,
        'approved_at': now
    })
    db.commit()
    row = result.fetchone()
    
    if not row:
        return None
    
    return get_latest_minutes(db, row[1])


# ============================================
# AI-Powered Minutes Generation
# ============================================

async def generate_minutes_with_ai(
    db: Session,
    request: GenerateMinutesRequest
) -> MeetingMinutesResponse:
    """Generate minutes with two prompt strategies and feature-specific sections."""
    from app.llm.gemini_client import MeetingAIAssistant
    from app.services import template_formatter

    meeting_id = request.meeting_id

    meeting_query = text(
        """
        SELECT title, meeting_type, description, start_time, end_time, organizer_id
        FROM meeting WHERE id = :meeting_id
        """
    )
    meeting_result = db.execute(meeting_query, {"meeting_id": meeting_id})
    meeting_row = meeting_result.fetchone()

    if not meeting_row:
        raise ValueError(f"Meeting {meeting_id} not found")

    meeting_title = meeting_row[0]
    meeting_type = meeting_row[1]
    meeting_desc = meeting_row[2]
    start_time = meeting_row[3]
    end_time = meeting_row[4]
    organizer_id = meeting_row[5]

    prompt_strategy = (request.prompt_strategy or "context_json").strip().lower()
    if prompt_strategy not in {"context_json", "structured_json"}:
        prompt_strategy = "context_json"
    session_type = _infer_session_type(meeting_type, request.session_type)

    transcript = ""
    if request.include_transcript:
        try:
            transcript = transcript_service.get_full_transcript(db, meeting_id)
        except Exception as exc:
            logger.warning("Failed to fetch transcript for meeting %s: %s", meeting_id, exc)
            db.rollback()
            transcript = ""

    action_rows: List[Dict[str, Any]] = []
    if request.include_actions:
        try:
            action_list = action_item_service.list_action_items(db, meeting_id)
            for item in action_list.items:
                deadline = item.deadline.isoformat() if item.deadline else ""
                action_rows.append(
                    {
                        "description": (item.description or "").strip(),
                        "owner": (item.owner_name or item.owner_user_id or "").strip(),
                        "deadline": deadline,
                        "priority": (item.priority or "").strip(),
                        "status": (item.status or "").strip(),
                    }
                )
        except Exception as exc:
            logger.warning("Failed to fetch action items for meeting %s: %s", meeting_id, exc)
            db.rollback()
            action_rows = []

    decision_rows: List[Dict[str, Any]] = []
    if request.include_decisions:
        try:
            decision_list = action_item_service.list_decision_items(db, meeting_id)
            for item in decision_list.items:
                confirmed_by = item.confirmed_by or ""
                decision_rows.append(
                    {
                        "description": (item.description or "").strip(),
                        "rationale": (item.rationale or "").strip(),
                        "status": (item.status or "").strip(),
                        "confirmed_by": str(confirmed_by).strip(),
                    }
                )
        except Exception as exc:
            logger.warning("Failed to fetch decisions for meeting %s: %s", meeting_id, exc)
            db.rollback()
            decision_rows = []

    risk_rows: List[Dict[str, Any]] = []
    if request.include_risks:
        try:
            risk_list = action_item_service.list_risk_items(db, meeting_id)
            for item in risk_list.items:
                risk_rows.append(
                    {
                        "description": (item.description or "").strip(),
                        "severity": (item.severity or "").strip(),
                        "mitigation": (item.mitigation or "").strip(),
                        "status": (item.status or "").strip(),
                        "owner": (item.owner_name or item.owner_user_id or "").strip(),
                    }
                )
        except Exception as exc:
            logger.warning("Failed to fetch risks for meeting %s: %s", meeting_id, exc)
            db.rollback()
            risk_rows = []

    actions = [row.get("description", "") for row in action_rows if row.get("description")]
    decisions = [row.get("description", "") for row in decision_rows if row.get("description")]
    risks = [
        f"{row.get('description', '')} (Severity: {row.get('severity') or 'unknown'})"
        for row in risk_rows
        if row.get("description")
    ]

    related_docs: List[str] = []
    try:
        doc_rows = db.execute(
            text(
                """
                SELECT title, description, file_type
                FROM knowledge_document
                WHERE meeting_id = :meeting_id
                ORDER BY created_at DESC
                LIMIT 10
                """
            ),
            {"meeting_id": meeting_id},
        ).fetchall()
        related_docs = [f"{r[0]} ({r[2]}) - {r[1] or ''}".strip() for r in doc_rows]
    except Exception as exc:
        logger.warning("Failed to fetch related documents for meeting %s: %s", meeting_id, exc)
        db.rollback()
        related_docs = []

    topic_tracker: List[Dict[str, Any]] = []
    if request.include_topic_tracker:
        try:
            topic_tracker = _load_topic_tracker(db, meeting_id)
        except Exception as exc:
            logger.warning("Failed to fetch topic tracker for meeting %s: %s", meeting_id, exc)
            db.rollback()
            topic_tracker = []

    transcript_for_llm = transcript or ""
    if transcript_for_llm and len(transcript_for_llm) > MAX_DIRECT_TRANSCRIPT_CHARS:
        llm_fallback_transcript = transcript_for_llm[:MAX_DIRECT_TRANSCRIPT_CHARS]
    else:
        llm_fallback_transcript = transcript_for_llm

    context_payload = {
        "title": meeting_title,
        "type": meeting_type,
        "description": meeting_desc,
        "time": f"{start_time} - {end_time}",
        "transcript": llm_fallback_transcript,
        "actions": actions,
        "decisions": decisions,
        "risks": risks,
        "documents": related_docs,
        "study_pack": None,
        "topic_tracker": topic_tracker,
        "session_type": session_type,
    }

    llm_config = None
    if organizer_id:
        try:
            from app.services import user_service
            from app.llm.gemini_client import LLMConfig
            override = user_service.get_user_llm_override(db, str(organizer_id))
            if override:
                llm_config = LLMConfig(**override)
        except Exception as exc:
            logger.warning("Failed to load LLM settings for organizer %s: %s", organizer_id, exc)
            db.rollback()

    assistant = MeetingAIAssistant(
        meeting_id,
        {
            'title': meeting_title,
            'type': meeting_type,
            'description': meeting_desc
        },
        llm_config=llm_config,
    )

    summary_result: Dict[str, Any] = {"summary": "", "key_points": []}
    study_pack: Optional[Dict[str, Any]] = None
    next_steps: List[str] = []
    structured_payload: Dict[str, Any] = {}

    def _parse_json_fragment(raw_text: str, expect_array: bool = False):
        try:
            parsed = json.loads(raw_text)
            if expect_array and isinstance(parsed, list):
                return parsed
            if not expect_array and isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        pattern = r"\[[\s\S]*\]" if expect_array else r"\{[\s\S]*\}"
        match = re.search(pattern, raw_text or "")
        if not match:
            return [] if expect_array else {}
        try:
            parsed = json.loads(match.group(0))
            if expect_array and isinstance(parsed, list):
                return parsed
            if not expect_array and isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        return [] if expect_array else {}

    def _normalize_rows_from_llm(raw_rows: Any, row_type: str) -> List[Dict[str, Any]]:
        rows = _safe_json_list(raw_rows)
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            if row_type == "action":
                normalized.append(
                    {
                        "description": str(row.get("description") or row.get("task") or "").strip(),
                        "owner": str(row.get("owner") or row.get("created_by") or "Unassigned").strip(),
                        "deadline": str(row.get("deadline") or "").strip(),
                        "priority": str(row.get("priority") or "medium").strip(),
                        "status": str(row.get("status") or "proposed").strip(),
                    }
                )
            elif row_type == "decision":
                normalized.append(
                    {
                        "description": str(row.get("description") or row.get("title") or "").strip(),
                        "rationale": str(row.get("rationale") or "").strip(),
                        "status": str(row.get("status") or "proposed").strip(),
                        "confirmed_by": str(row.get("approved_by") or row.get("decided_by") or "").strip(),
                    }
                )
            elif row_type == "risk":
                normalized.append(
                    {
                        "description": str(row.get("description") or row.get("risk") or "").strip(),
                        "severity": str(row.get("severity") or "medium").strip(),
                        "mitigation": str(row.get("mitigation") or "").strip(),
                        "status": str(row.get("status") or "proposed").strip(),
                        "owner": str(row.get("raised_by") or row.get("owner") or "").strip(),
                    }
                )
        return [r for r in normalized if r.get("description")]

    def _normalize_study_pack(raw_study: Any) -> Optional[Dict[str, Any]]:
        if isinstance(raw_study, str):
            raw_study = _parse_json_fragment(raw_study, expect_array=False)
        if not isinstance(raw_study, dict):
            return None
        concepts = _safe_json_list(raw_study.get("concepts"))
        quiz = _safe_json_list(raw_study.get("quiz"))
        return {"concepts": concepts, "quiz": quiz}

    if transcript_for_llm and len(transcript_for_llm) > MAX_DIRECT_TRANSCRIPT_CHARS:
        window_summaries = await _summarize_transcript_windows(assistant, transcript_for_llm)
        if window_summaries:
            context_payload["transcript"] = "\n\n".join(
                [f"[Window {idx + 1}] {entry}" for idx, entry in enumerate(window_summaries)]
            )

    try:
        if prompt_strategy == "structured_json" and transcript:
            structured_payload = await assistant.generate_minutes_json(transcript)
            summary_result = {
                "summary": str(structured_payload.get("executive_summary") or "").strip(),
                "key_points": structured_payload.get("key_points") or [],
            }
            if request.include_actions and not action_rows:
                action_rows = _normalize_rows_from_llm(structured_payload.get("action_items"), "action")
            if request.include_decisions and not decision_rows:
                decision_rows = _normalize_rows_from_llm(structured_payload.get("decisions"), "decision")
            if request.include_risks and not risk_rows:
                risk_rows = _normalize_rows_from_llm(structured_payload.get("risks"), "risk")
            if isinstance(structured_payload.get("next_steps"), list):
                next_steps = [str(item).strip() for item in structured_payload.get("next_steps", []) if str(item).strip()]
            if session_type == "course":
                study_pack = _normalize_study_pack(structured_payload.get("study_pack"))
        else:
            summary_result = await assistant.generate_summary_with_context(context_payload)
            if session_type == "course" and transcript:
                concepts: List[Dict[str, Any]] = []
                quiz: List[Dict[str, Any]] = []
                if request.include_knowledge_table:
                    concepts_raw = await assistant.extract_concepts(transcript)
                    concepts = _safe_json_list(_parse_json_fragment(concepts_raw, expect_array=True))
                if request.include_quiz:
                    quiz_raw = await assistant.generate_quiz(transcript)
                    quiz = _safe_json_list(_parse_json_fragment(quiz_raw, expect_array=True))
                if concepts or quiz:
                    study_pack = {"concepts": concepts, "quiz": quiz}
    except Exception as exc:
        logger.warning("AI summary generation failed for meeting %s: %s", meeting_id, exc)
        fallback_summary = meeting_desc or "Chưa có mô tả cuộc họp. Vui lòng cập nhật."
        summary_result = {
            "summary": fallback_summary,
            "key_points": actions[:3] if actions else decisions[:3],
        }

    if isinstance(summary_result, str):
        summary_result = {"summary": summary_result, "key_points": []}
    elif not isinstance(summary_result, dict):
        summary_result = {"summary": str(summary_result), "key_points": []}
    else:
        summary_result = {
            "summary": summary_result.get("summary", ""),
            "key_points": summary_result.get("key_points", []),
        }
        if not isinstance(summary_result["key_points"], list):
            summary_result["key_points"] = [str(summary_result["key_points"])]
    summary_result["summary"] = str(summary_result.get("summary", "") or "").strip()
    summary_result["key_points"] = [
        str(item).strip()
        for item in (summary_result.get("key_points") or [])
        if str(item).strip()
    ]

    actions = [row.get("description", "") for row in action_rows if row.get("description")]
    decisions = [row.get("description", "") for row in decision_rows if row.get("description")]
    risks = [
        f"{row.get('description', '')} (Severity: {row.get('severity') or 'unknown'})"
        for row in risk_rows
        if row.get("description")
    ]

    if not next_steps:
        next_steps = actions[:3]

    if session_type == "course" and not study_pack:
        study_pack = {"concepts": [], "quiz": []}

    ai_filters: List[str] = []
    if request.include_ai_filters and session_type == "meeting":
        ai_filters = _build_ai_filters(action_rows, decision_rows, risk_rows, topic_tracker)

    if request.template_id:
        context_payload["summary"] = summary_result.get("summary", "")
        context_payload["key_points"] = summary_result.get("key_points", [])
        context_payload["session_type"] = session_type
        context_payload["action_items"] = action_rows
        context_payload["decision_items"] = decision_rows
        context_payload["risk_items"] = risk_rows
        context_payload["next_steps"] = next_steps
        context_payload["topic_tracker"] = topic_tracker
        context_payload["ai_filters"] = ai_filters
        context_payload["study_pack"] = study_pack
        context_payload["prompt_strategy"] = prompt_strategy
        minutes_content = template_formatter.format_minutes_with_template(
            db=db,
            template_id=request.template_id,
            meeting_id=meeting_id,
            context=context_payload,
            format_type=request.format,
        )
    else:
        minutes_content = format_minutes(
            meeting_title=meeting_title,
            meeting_type=meeting_type,
            start_time=start_time,
            end_time=end_time,
            summary=summary_result.get("summary", ""),
            key_points=summary_result.get("key_points", []),
            session_type=session_type,
            actions=actions,
            decisions=decisions,
            risks=risks,
            action_rows=action_rows,
            decision_rows=decision_rows,
            risk_rows=risk_rows,
            next_steps=next_steps,
            study_pack=study_pack,
            topic_tracker=topic_tracker if request.include_topic_tracker else [],
            ai_filters=ai_filters if request.include_ai_filters else [],
            include_topic_tracker=request.include_topic_tracker,
            include_ai_filters=request.include_ai_filters,
            include_quiz=request.include_quiz,
            include_knowledge_table=request.include_knowledge_table,
            format_type=request.format,
        )

    minutes_html_value = minutes_content if request.format == "html" else None
    if request.format == "markdown":
        minutes_html_value = render_markdown_to_html(minutes_content)

    minutes_data = MeetingMinutesCreate(
        meeting_id=meeting_id,
        minutes_text=minutes_content if request.format == "text" else None,
        minutes_markdown=minutes_content if request.format == "markdown" else None,
        minutes_html=minutes_html_value,
        executive_summary=summary_result.get("summary", ""),
        status="draft",
    )

    return create_minutes(db, minutes_data)


def format_minutes(
    meeting_title: str,
    meeting_type: str,
    start_time,
    end_time,
    summary: str,
    key_points: List[str],
    session_type: str,
    actions: List[str],
    decisions: List[str],
    risks: List[str],
    action_rows: Optional[List[Dict[str, Any]]] = None,
    decision_rows: Optional[List[Dict[str, Any]]] = None,
    risk_rows: Optional[List[Dict[str, Any]]] = None,
    next_steps: Optional[List[str]] = None,
    study_pack: Optional[Dict[str, Any]] = None,
    topic_tracker: Optional[List[Dict[str, Any]]] = None,
    ai_filters: Optional[List[str]] = None,
    include_topic_tracker: bool = True,
    include_ai_filters: bool = True,
    include_quiz: bool = True,
    include_knowledge_table: bool = True,
    format_type: str = "markdown",
) -> str:
    """Format session minutes as markdown-friendly text."""

    def _fmt_dt(value) -> str:
        if not value:
            return "N/A"
        if isinstance(value, str):
            return value
        if hasattr(value, "strftime"):
            return value.strftime("%d/%m/%Y %H:%M")
        return str(value)

    def _md_cell(value: Any) -> str:
        text_val = str(value or "").replace("|", "\\|").replace("\n", " ").strip()
        return text_val or "-"

    lines: List[str] = []
    lines.append(f"# Minutes: {meeting_title}")
    lines.append("")
    lines.append(f"**Meeting Type:** {meeting_type or 'N/A'}")
    lines.append(f"**Session Mode:** {session_type.title()}")
    lines.append(f"**Time:** {_fmt_dt(start_time)} - {_fmt_dt(end_time)}")
    lines.append("")

    lines.append("## Executive Summary")
    lines.append(summary or "No summary available.")
    lines.append("")

    if key_points:
        lines.append("## Key Points")
        for point in key_points:
            lines.append(f"- {point}")
        lines.append("")

    action_rows = action_rows or []
    decision_rows = decision_rows or []
    risk_rows = risk_rows or []
    topic_tracker = topic_tracker or []
    ai_filters = ai_filters or []
    next_steps = next_steps or []
    study_pack = study_pack or {}

    if session_type == "meeting":
        if decision_rows:
            lines.append("## Decision Table")
            lines.append("| Decision | Rationale | Status | Confirmed By |")
            lines.append("| --- | --- | --- | --- |")
            for row in decision_rows:
                lines.append(
                    "| "
                    + " | ".join(
                        [
                            _md_cell(row.get("description")),
                            _md_cell(row.get("rationale")),
                            _md_cell(row.get("status")),
                            _md_cell(row.get("confirmed_by")),
                        ]
                    )
                    + " |"
                )
            lines.append("")
        elif decisions:
            lines.append("## Decisions")
            for idx, item in enumerate(decisions, start=1):
                lines.append(f"{idx}. {item}")
            lines.append("")

        if action_rows:
            lines.append("## Action Table")
            lines.append("| Owner | Deadline | Priority | Status | Action |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in action_rows:
                lines.append(
                    "| "
                    + " | ".join(
                        [
                            _md_cell(row.get("owner")),
                            _md_cell(row.get("deadline")),
                            _md_cell(row.get("priority")),
                            _md_cell(row.get("status")),
                            _md_cell(row.get("description")),
                        ]
                    )
                    + " |"
                )
            lines.append("")
        elif actions:
            lines.append("## Action Items")
            for idx, item in enumerate(actions, start=1):
                lines.append(f"{idx}. {item}")
            lines.append("")

        if risk_rows:
            lines.append("## Risk Table")
            lines.append("| Risk | Severity | Mitigation | Owner | Status |")
            lines.append("| --- | --- | --- | --- | --- |")
            for row in risk_rows:
                lines.append(
                    "| "
                    + " | ".join(
                        [
                            _md_cell(row.get("description")),
                            _md_cell(row.get("severity")),
                            _md_cell(row.get("mitigation")),
                            _md_cell(row.get("owner")),
                            _md_cell(row.get("status")),
                        ]
                    )
                    + " |"
                )
            lines.append("")
        elif risks:
            lines.append("## Risks")
            for item in risks:
                lines.append(f"- {item}")
            lines.append("")

        if include_ai_filters and ai_filters:
            lines.append("## AI Filters")
            for flt in ai_filters:
                lines.append(f"- {flt}")
            lines.append("")

    if session_type == "course":
        concepts = _safe_json_list(study_pack.get("concepts"))
        quiz = _safe_json_list(study_pack.get("quiz"))

        if include_knowledge_table and concepts:
            lines.append("## Table Of Knowledge")
            lines.append("| Term | Definition | Example |")
            lines.append("| --- | --- | --- |")
            for row in concepts:
                lines.append(
                    "| "
                    + " | ".join(
                        [
                            _md_cell(row.get("term")),
                            _md_cell(row.get("definition")),
                            _md_cell(row.get("example")),
                        ]
                    )
                    + " |"
                )
            lines.append("")

        if include_quiz and quiz:
            lines.append("## Quiz")
            for idx, row in enumerate(quiz, start=1):
                lines.append(f"**Q{idx}. {_md_cell(row.get('question'))}**")
                options = row.get("options") if isinstance(row.get("options"), list) else []
                correct_idx = int(row.get("correct_answer_index") or 0)
                for option_idx, option in enumerate(options):
                    prefix = "(correct) " if option_idx == correct_idx else ""
                    lines.append(f"- {prefix}{_md_cell(option)}")
                if row.get("explanation"):
                    lines.append(f"Answer note: {_md_cell(row.get('explanation'))}")
                lines.append("")

    if include_topic_tracker and topic_tracker:
        lines.append("## Topic Tracker")
        lines.append("| Topic | Start | End | Duration (s) |")
        lines.append("| --- | --- | --- | --- |")
        for row in topic_tracker:
            lines.append(
                "| "
                + " | ".join(
                    [
                        _md_cell(row.get("title")),
                        _md_cell(_fmt_seconds(row.get("start_time"))),
                        _md_cell(_fmt_seconds(row.get("end_time"))),
                        _md_cell(row.get("duration_seconds")),
                    ]
                )
                + " |"
            )
        lines.append("")

    if next_steps:
        lines.append("## Next Steps")
        for idx, step in enumerate(next_steps, start=1):
            lines.append(f"{idx}. {step}")
        lines.append("")

    return "\n".join(lines)


# ============================================
# Distribution
# ============================================

def list_distribution_logs(db: Session, meeting_id: str) -> DistributionLogList:
    """List distribution logs for a meeting"""
    query = text("""
        SELECT 
            id::text, minutes_id::text, meeting_id::text,
            user_id::text, channel, recipient_email,
            sent_at, status, error_message
        FROM minutes_distribution_log
        WHERE meeting_id = :meeting_id
        ORDER BY sent_at DESC
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    rows = result.fetchall()
    
    logs = []
    for row in rows:
        logs.append(DistributionLogResponse(
            id=row[0],
            minutes_id=row[1],
            meeting_id=row[2],
            user_id=row[3],
            channel=row[4],
            recipient_email=row[5],
            sent_at=row[6],
            status=row[7],
            error_message=row[8]
        ))
    
    return DistributionLogList(logs=logs, total=len(logs))


def create_distribution_log(db: Session, data: DistributionLogCreate) -> DistributionLogResponse:
    """Create a distribution log entry"""
    log_id = str(uuid4())
    now = datetime.utcnow()
    
    query = text("""
        INSERT INTO minutes_distribution_log (
            id, minutes_id, meeting_id, user_id, channel,
            recipient_email, sent_at, status
        )
        VALUES (
            :id, :minutes_id, :meeting_id, :user_id, :channel,
            :recipient_email, :sent_at, :status
        )
        RETURNING id::text
    """)
    
    db.execute(query, {
        'id': log_id,
        'minutes_id': data.minutes_id,
        'meeting_id': data.meeting_id,
        'user_id': data.user_id,
        'channel': data.channel,
        'recipient_email': data.recipient_email,
        'sent_at': now,
        'status': data.status
    })
    db.commit()
    
    return DistributionLogResponse(
        id=log_id,
        minutes_id=data.minutes_id,
        meeting_id=data.meeting_id,
        user_id=data.user_id,
        channel=data.channel,
        recipient_email=data.recipient_email,
        sent_at=now,
        status=data.status
    )
