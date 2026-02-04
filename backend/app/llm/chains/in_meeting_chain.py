import json
from typing import Any, Dict, List
from app.llm.prompts.in_meeting_prompts import (
    RECW_PROMPT,
    ADR_PROMPT,
    QA_PROMPT,
    TOPIC_SEGMENT_PROMPT,
    RECAP_TOPIC_INTENT_PROMPT,
)
from app.llm.gemini_client import GeminiChat, get_groq_client
from app.core.config import get_settings


def _call_gemini(prompt: str) -> str:
    client = get_groq_client()
    if not client:
        return ""
    try:
        settings = get_settings()
        resp = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=settings.ai_temperature,
            max_tokens=min(settings.ai_max_tokens, 512),
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        print(f"[Groq] error in _call_gemini: {e}")
        return ""


def summarize_transcript(transcript_window: str, topic: str | None, intent: str | None) -> str:
    """Use Gemini if available; fallback to stub."""
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
    body = (transcript_window or "").strip()
    if len(body) > 200:
        body = body[:200] + "..."
    return f"Status: {body or 'No transcript in window'}"


def _coerce_topic_payload(
    raw_topic: Dict[str, Any],
    current_topic_id: str,
    current_title: str,
    window_start: float,
    window_end: float,
) -> Dict[str, Any]:
    new_topic = raw_topic.get("new_topic")
    if not isinstance(new_topic, bool):
        new_topic = False
    topic_id = raw_topic.get("topic_id")
    if not isinstance(topic_id, str) or not topic_id.strip():
        topic_id = current_topic_id
    title = raw_topic.get("title")
    if not isinstance(title, str) or not title.strip():
        title = current_title or "General"
    start_t = _as_float(raw_topic.get("start_t"), window_start)
    end_t = _as_float(raw_topic.get("end_t"), window_end)
    if end_t < start_t:
        end_t = start_t
    return {
        "new_topic": new_topic,
        "topic_id": topic_id,
        "title": title,
        "start_t": start_t,
        "end_t": end_t,
    }


def _coerce_intent_payload(raw_intent: Dict[str, Any]) -> Dict[str, Any]:
    allowed_labels = {
        "NO_INTENT",
        "ACTION_COMMAND",
        "SCHEDULE_COMMAND",
        "DECISION_STATEMENT",
        "RISK_STATEMENT",
    }
    label = raw_intent.get("label")
    if not isinstance(label, str) or label not in allowed_labels:
        label = "NO_INTENT"
    slots = raw_intent.get("slots")
    if not isinstance(slots, dict):
        slots = {}
    if label == "NO_INTENT":
        slots = {}
    return {"label": label, "slots": slots}


def summarize_and_classify(transcript_window: str, meta: Dict[str, Any] | None = None) -> Dict[str, Any]:
    meta = meta or {}
    body = (transcript_window or "").strip()
    current_topic = meta.get("current_topic") or {}
    current_topic_id = meta.get("current_topic_id") or current_topic.get("topic_id") or "T0"
    current_title = current_topic.get("title") or "General"
    window_start = _as_float(meta.get("window_start"), 0.0)
    window_end = _as_float(meta.get("window_end"), 0.0)

    prompt = (
        RECAP_TOPIC_INTENT_PROMPT
        + f"\n\nCurrent topic: {current_topic_id}\nWindow: {window_start:.2f}-{window_end:.2f}\nTranscript window:\n{body}"
    )
    raw = _call_gemini(prompt)

    parse_ok = False
    recap = ""
    topic_payload = _coerce_topic_payload({}, current_topic_id, current_title, window_start, window_end)
    intent_payload = {"label": "NO_INTENT", "slots": {}}

    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                recap_value = parsed.get("recap")
                if isinstance(recap_value, str):
                    recap = recap_value.strip()
                raw_topic = parsed.get("topic")
                if isinstance(raw_topic, dict):
                    topic_payload = _coerce_topic_payload(
                        raw_topic,
                        current_topic_id,
                        current_title,
                        window_start,
                        window_end,
                    )
                raw_intent = parsed.get("intent")
                if isinstance(raw_intent, dict):
                    intent_payload = _coerce_intent_payload(raw_intent)
                parse_ok = True
        except Exception:
            parse_ok = False

    if not recap:
        recap = _fallback_recap(body)
    if not parse_ok:
        topic_payload = _coerce_topic_payload({}, current_topic_id, current_title, window_start, window_end)
        intent_payload = {"label": "NO_INTENT", "slots": {}}

    meta["parse_ok"] = parse_ok
    meta["raw_len"] = len(raw or "")
    return {"recap": recap, "topic": topic_payload, "intent": intent_payload}
