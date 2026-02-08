import json
import re
from typing import Any, Dict, List
from app.llm.prompts.in_meeting_prompts import (
    RECW_PROMPT,
    ADR_PROMPT,
    QA_PROMPT,
    TOPIC_SEGMENT_PROMPT,
    RECAP_TOPIC_INTENT_PROMPT,
)
from app.llm.gemini_client import call_llm_sync, get_llm_status
from app.core.config import get_settings


def _call_gemini(prompt: str) -> str:
    """Low-latency LLM call (Gemini-first, Groq fallback)."""
    try:
        settings = get_settings()
        return call_llm_sync(
            prompt,
            temperature=settings.ai_temperature,
            max_tokens=min(settings.ai_max_tokens, 512),
        )
    except Exception as e:
        print(f"[LLM] error in _call_gemini: {e}")
        return ""


def summarize_transcript(transcript_window: str, topic: str | None, intent: str | None) -> str:
    """Use LLM if available; fallback to stub."""
    body = (transcript_window or "").strip()
    prompt = RECW_PROMPT + f"\n\nTranscript window:\n{body}\n\nTopic: {topic or 'N/A'}\nIntent: {intent or 'N/A'}"
    summary = _call_gemini(prompt)
    if summary:
        return summary.strip()
    # Fallback stub
    parts = []
    if topic:
        parts.append(f"[Topic {topic}]")
    if intent:
        parts.append(f"[Intent {intent}]")
    if len(body) > 200:
        body = body[:200] + "..."
    parts.append(body or "No transcript in window")
    return " ".join(parts)


def extract_adr(transcript_window: str, topic_id: str | None) -> Dict[str, List[Dict[str, Any]]]:
    """ADR extraction via Gemini if available, else stub JSON."""
    window = (transcript_window or "").strip()
    base: Dict[str, List[Dict[str, Any]]] = {
        "actions": [],
        "decisions": [],
        "risks": [],
    }
    if not window:
        return base

    prompt = ADR_PROMPT + f"\n\nTranscript window:\n{window}\n\nTopic: {topic_id or 'N/A'}"
    text = _call_gemini(prompt)
    if text:
        # Cheap parse attempt for demo; production should parse JSON strictly.
        # Assume model returns JSON block.
        try:
            import json
            parsed = json.loads(text)
            for k in base:
                if k in parsed and isinstance(parsed[k], list):
                    base[k] = parsed[k]
            return base
        except Exception:
            pass

    # Stub fallback
    base["actions"] = [{
        "task": "Follow up on discussed item",
        "owner": None,
        "due_date": None,
        "priority": "medium",
        "topic_id": topic_id,
    }]
    base["decisions"] = [{
        "title": "Decision noted from transcript window",
        "rationale": None,
        "impact": None,
    }]
    base["risks"] = [{
        "desc": "Potential risk identified in conversation",
        "severity": "medium",
        "mitigation": None,
        "owner": None,
    }]
    return base


def answer_question(question: str, rag_docs: list, transcript_window: str) -> Dict[str, Any]:
    """Q&A combining transcript + RAG snippets."""
    snippet = (transcript_window or "").strip()
    if len(snippet) > 160:
        snippet = snippet[:160] + "..."
    prompt = QA_PROMPT + f"\n\nQuestion: {question}\n\nTranscript window:\n{snippet}\n\nRAG snippets:\n{rag_docs}"
    content = _call_gemini(prompt)
    if not content:
        content = f"[Stub] {question} — Context: {snippet or 'no transcript'}"
    return {"answer": content, "citations": rag_docs or []}


def segment_topic(transcript_window: str, current_topic_id: str | None) -> Dict[str, Any]:
    payload = {
        "new_topic": False,
        "topic_id": current_topic_id or "T0",
        "title": "General",
        "start_t": 0.0,
        "end_t": 0.0,
    }
    body = (transcript_window or "").strip()
    if not body:
        return payload

    prompt = TOPIC_SEGMENT_PROMPT + f"\n\nTranscript window:\n{body}\n\nCurrent topic: {current_topic_id or 'T0'}"
    text = _call_gemini(prompt)
    if text:
        try:
            import json

            parsed = json.loads(text)
            payload.update(parsed)
            return payload
        except Exception:
            pass

    # Heuristic fallback: if window is long, propose a new topic with first 6 words.
    if len(body) > 400:
        tokens = body.split()
        title = " ".join(tokens[:6]) if tokens else "New topic"
        payload.update({"new_topic": True, "topic_id": f"T{abs(hash(title)) % 100}", "title": title})
    return payload


def _as_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _fallback_recap(transcript_window: str) -> str:
    body = _sanitize_transcript_for_recap(transcript_window)
    if not body:
        return "Status: No transcript in window"
    # Keep fallback short and semantic, never echo raw tagged transcript.
    sentence = re.split(r"[.!?]\s+", body, maxsplit=1)[0].strip()
    if len(sentence) > 180:
        sentence = sentence[:180].rstrip() + "..."
    return f"Status: {sentence or 'No transcript in window'}"


def _as_text(value: Any) -> str:
    return str(value or "").strip()


_TRANSCRIPT_TAG_RE = re.compile(r"\[[^\]]*\d{1,2}:\d{2}(?::\d{2})?[^\]]*\]")


def _sanitize_transcript_for_recap(text: str) -> str:
    body = _as_text(text)
    if not body:
        return ""
    body = _TRANSCRIPT_TAG_RE.sub(" ", body)
    body = re.sub(r"\bSPEAKER[_\s-]*\d+\s*:", " ", body, flags=re.IGNORECASE)
    body = re.sub(r"\s+", " ", body).strip()
    return body


def _sanitize_recap_line(line: str) -> str:
    value = _as_text(line)
    if not value:
        return ""
    value = _TRANSCRIPT_TAG_RE.sub(" ", value)
    value = re.sub(r"\bSPEAKER[_\s-]*\d+\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) > 420:
        value = value[:420].rstrip() + "..."
    return value


def _normalize_session_kind(value: Any) -> str:
    raw = _as_text(value).lower()
    if raw in {"course", "study_session", "study", "learning", "lesson", "class"}:
        return "course"
    return "meeting"


def _active_model_name() -> str:
    try:
        status = get_llm_status()
        model = _as_text(status.get("model"))
        if model:
            return model
    except Exception:
        pass
    settings = get_settings()
    return _as_text(settings.gemini_model) or _as_text(settings.groq_model) or "LLM"


def _clamp_window(start_t: Any, end_t: Any, window_start: float, window_end: float) -> tuple[float, float]:
    start_value = min(max(_as_float(start_t, window_start), window_start), window_end)
    end_value = min(max(_as_float(end_t, start_value), start_value), window_end)
    return start_value, end_value


def _coerce_recap_lines(raw: Any, transcript_window: str) -> List[str]:
    lines: List[str] = []
    if isinstance(raw, list):
        lines = [_sanitize_recap_line(_as_text(item)) for item in raw if _as_text(item)]
    elif isinstance(raw, str):
        lines = [_sanitize_recap_line(_as_text(part)) for part in raw.splitlines() if _as_text(part)]

    lines = [line for line in lines if line]

    if not lines:
        fallback = _fallback_recap(transcript_window)
        lines = [_sanitize_recap_line(_as_text(part)) for part in fallback.splitlines() if _as_text(part)]
        lines = [line for line in lines if line]
    if not lines:
        lines = ["No transcript available for this window."]
    return lines[:6]


def _coerce_topics(
    raw_topics: Any,
    current_topic_id: str,
    current_title: str,
    window_start: float,
    window_end: float,
) -> List[Dict[str, Any]]:
    topics: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    if isinstance(raw_topics, dict):
        candidates = [raw_topics]
    elif isinstance(raw_topics, list):
        candidates = [item for item in raw_topics if isinstance(item, dict)]

    for idx, item in enumerate(candidates):
        topic_id = _as_text(item.get("topic_id")) or (current_topic_id if idx == 0 else f"T{idx + 1}")
        title = _as_text(item.get("title")) or (current_title if idx == 0 else topic_id)
        desc = _as_text(item.get("description")) or title
        start_t, end_t = _clamp_window(item.get("start_t"), item.get("end_t"), window_start, window_end)
        topics.append(
            {
                "topic_id": topic_id,
                "title": title,
                "description": desc,
                "start_t": start_t,
                "end_t": end_t,
            }
        )

    if not topics:
        topics = [
            {
                "topic_id": current_topic_id,
                "title": current_title,
                "description": current_title,
                "start_t": window_start,
                "end_t": window_end,
            }
        ]
    return topics[:5]


def _coerce_cheatsheet(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    items: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        term = _as_text(item.get("term"))
        definition = _as_text(item.get("definition"))
        if not term or not definition:
            continue
        items.append({"term": term, "definition": definition})
    return items[:8]


def _normalize_adr_list(raw: Any, kind: str) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        if kind == "actions":
            task = _as_text(item.get("task") or item.get("description"))
            if not task:
                continue
            normalized.append(
                {
                    "task": task,
                    "owner": _as_text(item.get("owner")),
                    "due_date": _as_text(item.get("due_date") or item.get("deadline")),
                    "priority": _as_text(item.get("priority")) or "medium",
                    "source_text": _as_text(item.get("source_text")),
                }
            )
        elif kind == "decisions":
            title = _as_text(item.get("title") or item.get("description"))
            if not title:
                continue
            normalized.append(
                {
                    "title": title,
                    "rationale": _as_text(item.get("rationale")),
                    "impact": _as_text(item.get("impact")),
                    "source_text": _as_text(item.get("source_text")),
                }
            )
        else:
            desc = _as_text(item.get("desc") or item.get("description"))
            if not desc:
                continue
            severity = _as_text(item.get("severity")).lower() or "medium"
            if severity not in {"low", "medium", "high"}:
                severity = "medium"
            normalized.append(
                {
                    "desc": desc,
                    "severity": severity,
                    "mitigation": _as_text(item.get("mitigation")),
                    "owner": _as_text(item.get("owner")),
                    "source_text": _as_text(item.get("source_text")),
                }
            )
    return normalized[:8]


def _coerce_adr(raw: Any) -> Dict[str, List[Dict[str, Any]]]:
    payload = raw if isinstance(raw, dict) else {}
    return {
        "actions": _normalize_adr_list(payload.get("actions"), "actions"),
        "decisions": _normalize_adr_list(payload.get("decisions"), "decisions"),
        "risks": _normalize_adr_list(payload.get("risks"), "risks"),
    }


def _coerce_course_highlights(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    items: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        kind = _as_text(item.get("kind")).lower() or "concept"
        if kind not in {"concept", "formula", "example", "note"}:
            kind = "concept"
        title = _as_text(item.get("title"))
        bullet = _as_text(item.get("bullet"))
        formula = _as_text(item.get("formula"))
        if not title and not bullet:
            continue
        items.append(
            {
                "kind": kind,
                "title": title or bullet,
                "bullet": bullet or title,
                "formula": formula,
            }
        )
    return items[:10]


def summarize_and_classify(transcript_window: str, meta: Dict[str, Any] | None = None) -> Dict[str, Any]:
    meta = meta or {}
    body = (transcript_window or "").strip()
    current_topic = meta.get("current_topic") or {}
    current_topic_id = _as_text(meta.get("current_topic_id") or current_topic.get("topic_id") or "T0") or "T0"
    current_title = _as_text(current_topic.get("title") or "General") or "General"
    window_start = _as_float(meta.get("window_start"), 0.0)
    window_end = _as_float(meta.get("window_end"), 0.0)
    session_kind = _normalize_session_kind(meta.get("session_kind"))

    prompt = (
        RECAP_TOPIC_INTENT_PROMPT
        + (
            f"\n\nsession_kind: {session_kind}\n"
            f"current_topic_id: {current_topic_id}\n"
            f"window_start: {window_start:.2f}\n"
            f"window_end: {window_end:.2f}\n"
            f"Transcript window:\n{body}"
        )
    )
    raw = _call_gemini(prompt)

    parse_ok = False
    parsed: Dict[str, Any] = {}

    if raw:
        try:
            maybe = json.loads(raw)
            if isinstance(maybe, dict):
                parsed = maybe
                parse_ok = True
        except Exception:
            parse_ok = False

    raw_topics = parsed.get("topics")
    if not raw_topics and isinstance(parsed.get("topic"), dict):
        raw_topics = [parsed.get("topic")]
    topics = _coerce_topics(raw_topics, current_topic_id, current_title, window_start, window_end)
    primary = topics[0]
    primary_topic = {
        "new_topic": bool(primary.get("topic_id") != current_topic_id),
        "topic_id": _as_text(primary.get("topic_id")) or current_topic_id,
        "title": _as_text(primary.get("title")) or current_title,
        "start_t": _as_float(primary.get("start_t"), window_start),
        "end_t": _as_float(primary.get("end_t"), window_end),
    }

    recap_lines = _coerce_recap_lines(parsed.get("recap_lines") or parsed.get("recap"), body)
    cheatsheet = _coerce_cheatsheet(parsed.get("cheatsheet"))
    adr = _coerce_adr(parsed.get("adr"))
    course_highlights = _coerce_course_highlights(parsed.get("course_highlights"))

    if session_kind == "course":
        adr = {"actions": [], "decisions": [], "risks": []}
        if not course_highlights:
            course_highlights = [
                {
                    "kind": "concept",
                    "title": item["term"],
                    "bullet": item["definition"],
                    "formula": "",
                }
                for item in cheatsheet
            ]
    else:
        course_highlights = []

    recap = "\n".join(recap_lines)

    meta["parse_ok"] = parse_ok
    meta["raw_len"] = len(raw or "")
    return {
        "recap": recap,
        "recap_lines": recap_lines,
        "topic": primary_topic,
        "topics": topics,
        "cheatsheet": cheatsheet,
        "adr": adr,
        "course_highlights": course_highlights,
        # Legacy field kept for compatibility with older frontend consumers.
        "intent": {"label": "NO_INTENT", "slots": {}},
        "session_kind": session_kind,
        "model_name": _active_model_name(),
    }
