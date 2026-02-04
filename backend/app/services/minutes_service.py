"""
Meeting Minutes Service
"""
from datetime import datetime
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
    """Generate meeting minutes using AI (with meeting fields + transcript + actions/decisions/risks + related docs)."""
    from app.llm.gemini_client import MeetingAIAssistant
    from app.services import template_service, template_formatter

    meeting_id = request.meeting_id
    
    # Get meeting info
    meeting_query = text("""
        SELECT title, meeting_type, description, start_time, end_time
        FROM meeting WHERE id = :meeting_id
    """)
    meeting_result = db.execute(meeting_query, {'meeting_id': meeting_id})
    meeting_row = meeting_result.fetchone()
    
    if not meeting_row:
        raise ValueError(f"Meeting {meeting_id} not found")
    
    meeting_title = meeting_row[0]
    meeting_type = meeting_row[1]
    meeting_desc = meeting_row[2]
    start_time = meeting_row[3]
    end_time = meeting_row[4]
    
    # Get transcript
    transcript = ""
    if request.include_transcript:
        transcript = transcript_service.get_full_transcript(db, meeting_id)
    
    # Get action items
    actions = []
    if request.include_actions:
        action_list = action_item_service.list_action_items(db, meeting_id)
        actions = [item.description for item in action_list.items]
    
    # Get decisions
    decisions = []
    if request.include_decisions:
        decision_list = action_item_service.list_decision_items(db, meeting_id)
        decisions = [item.description for item in decision_list.items]
    
    # Get risks
    risks = []
    if request.include_risks:
        risk_list = action_item_service.list_risk_items(db, meeting_id)
        risks = [f"{item.description} (Severity: {item.severity})" for item in risk_list.items]
    
    # Get related documents (titles/descriptions) linked to meeting
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
        {'meeting_id': meeting_id},
    ).fetchall()
    related_docs = [f"{r[0]} ({r[2]}) - {r[1] or ''}".strip() for r in doc_rows]

    # Build context payload for LLM
    context_payload = {
        "title": meeting_title,
        "type": meeting_type,
        "description": meeting_desc,
        "time": f"{start_time} - {end_time}",
        "transcript": transcript or "",
        "actions": actions,
        "decisions": decisions,
        "risks": risks,
        "documents": related_docs,
        "study_pack": None
    }

    summary_result = {"summary": "", "key_points": []}
    minutes_content = ""
    assistant = MeetingAIAssistant(meeting_id, {
        'title': meeting_title,
        'type': meeting_type,
        'description': meeting_desc
    })

    # STUDY MODE DETECTION
    is_study_session = meeting_type and meeting_type.lower() in ['study', 'training', 'education', 'learning', 'workshop']
    study_pack = None

    try:
        # 1. Generate core summary
        if hasattr(assistant, "generate_summary_with_context"):
            summary_result = await assistant.generate_summary_with_context(context_payload)
        else:
            summary_result = await assistant.generate_summary(transcript or "No transcript available")

        # 2. If Study Session, generate specialized content
        if is_study_session and transcript:
            import json
            concepts_json = await assistant.extract_concepts(transcript)
            quiz_json = await assistant.generate_quiz(transcript)
            
            try:
                # Attempt to parse json responses
                def parse_json_safe(text):
                    try: 
                        return json.loads(text)
                    except:
                        import re
                        match = re.search(r'\[.*\]', text, re.DOTALL)
                        return json.loads(match.group(0)) if match else []

                study_pack = {
                    "concepts": parse_json_safe(concepts_json),
                    "quiz": parse_json_safe(quiz_json)
                }
                context_payload['study_pack'] = study_pack
            except Exception as e:
                print(f"Error parsing study pack: {e}")

    except Exception:
        # If AI fails, fall back to simple templated summary to avoid 500
        fallback_summary = meeting_desc or "Chưa có mô tả cuộc họp. Vui lòng cập nhật."
        summary_result = {
            "summary": fallback_summary,
            "key_points": actions[:3] if actions else decisions[:3]
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

    # Format minutes with template if provided, otherwise use default format
    if request.template_id:
        # Use template-based formatting
        context_payload['summary'] = summary_result.get('summary', '')
        context_payload['key_points'] = summary_result.get('key_points', [])
        minutes_content = template_formatter.format_minutes_with_template(
            db=db,
            template_id=request.template_id,
            meeting_id=meeting_id,
            context=context_payload,
            format_type=request.format
        )
    else:
        # Use default formatting
        minutes_content = format_minutes(
            meeting_title=meeting_title,
            meeting_type=meeting_type,
            start_time=start_time,
            end_time=end_time,
            summary=summary_result.get('summary', ''),
            key_points=summary_result.get('key_points', []),
            actions=actions,
            decisions=decisions,
            risks=risks,
            study_pack=study_pack,
            format_type=request.format
        )
    
    # Create minutes record
    minutes_html_value = minutes_content if request.format == 'html' else None
    if request.format == 'markdown':
        minutes_html_value = render_markdown_to_html(minutes_content)

    minutes_data = MeetingMinutesCreate(
        meeting_id=meeting_id,
        minutes_text=minutes_content if request.format == 'text' else None,
        minutes_markdown=minutes_content if request.format == 'markdown' else None,
        minutes_html=minutes_html_value,
        executive_summary=summary_result.get('summary', ''),
        status='draft'
    )
    
    return create_minutes(db, minutes_data)


def format_minutes(
    meeting_title: str,
    meeting_type: str,
    start_time,
    end_time,
    summary: str,
    key_points: List[str],
    actions: List[str],
    decisions: List[str],
    risks: List[str],
    study_pack: Optional[Dict[str, Any]] = None,
    format_type: str = 'markdown'
) -> str:
    """Format meeting minutes"""
    
    lines = []
    
    # Header
    lines.append(f"# Biên bản cuộc họp: {meeting_title}")
    lines.append("")
    lines.append(f"**Loại cuộc họp:** {meeting_type}")
    if start_time:
        lines.append(f"**Thời gian:** {start_time.strftime('%d/%m/%Y %H:%M') if start_time else 'N/A'} - {end_time.strftime('%H:%M') if end_time else 'N/A'}")
    lines.append("")
    
    # Executive Summary
    lines.append("## Tóm tắt điều hành")
    lines.append(summary)
    lines.append("")
    
    # Key Points
    if key_points:
        lines.append("## Điểm chính")
        for point in key_points:
            lines.append(f"- {point}")
        lines.append("")
        
    # STUDY PACK SECTIONS
    if study_pack:
        if study_pack.get("concepts"):
            lines.append("## 🧠 Khái niệm & Thuật ngữ quan trọng")
            for item in study_pack["concepts"]:
                term = item.get("term", "")
                defn = item.get("definition", "")
                ex = item.get("example", "")
                lines.append(f"### {term}")
                lines.append(f"- **Định nghĩa:** {defn}")
                if ex:
                    lines.append(f"- *Ví dụ:* {ex}")
                lines.append("")
        
        if study_pack.get("quiz"):
            lines.append("## 📝 Quiz Ôn tập")
            for i, q in enumerate(study_pack["quiz"], 1):
                question = q.get("question", "")
                options = q.get("options", [])
                ans_idx = q.get("correct_answer_index", 0)
                expl = q.get("explanation", "")
                
                lines.append(f"**Câu {i}: {question}**")
                for j, opt in enumerate(options):
                    is_correct = "✅" if j == ans_idx else ""
                    lines.append(f"- [{'x' if j == ans_idx else ' '}] {opt} {is_correct}")
                lines.append(f"> *Giải thích: {expl}*")
                lines.append("")
    
    # Decisions
    if decisions:
        lines.append("## Các quyết định")
        for i, decision in enumerate(decisions, 1):
            lines.append(f"{i}. {decision}")
        lines.append("")
    
    # Action Items
    if actions:
        lines.append("## Action Items")
        for i, action in enumerate(actions, 1):
            lines.append(f"{i}. {action}")
        lines.append("")
    
    # Risks
    if risks:
        lines.append("## Rủi ro đã nhận diện")
        for risk in risks:
            lines.append(f"- {risk}")
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
