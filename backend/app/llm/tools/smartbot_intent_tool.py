import json
import re
from typing import Any, Dict, Optional, Tuple

from app.core.config import get_settings
from app.llm.gemini_client import call_llm_sync, is_gemini_available
from app.llm.prompts.in_meeting_prompts import INTENT_PROMPT


INTENT_LABELS = [
    "NO_INTENT",
    "ASK_AI",
    "ACTION_COMMAND",
    "SCHEDULE_COMMAND",
    "DECISION_STATEMENT",
    "RISK_STATEMENT",
]


def _parse_intent_payload(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except Exception:
            return None


def _llm_intent(text: str, lang: str | None) -> Optional[Tuple[str, Dict[str, Any]]]:
    if not is_gemini_available():
        return None
    prompt = INTENT_PROMPT + f"\n\nLanguage: {lang or 'vi'}\nText:\n{text.strip()}"
    try:
        settings = get_settings()
        content = call_llm_sync(
            prompt,
            temperature=0.1,
            max_tokens=min(settings.ai_max_tokens, 128),
        )
        payload = _parse_intent_payload(content)
        if not isinstance(payload, dict):
            return None
        label = str(payload.get("label") or "").strip().upper()
        if label not in INTENT_LABELS:
            return None
        slots = payload.get("slots") if isinstance(payload.get("slots"), dict) else {}
        return label, slots
    except Exception:
        return None


def _heuristic_intent(text: str) -> Tuple[str, Dict[str, Any]]:
    lower = (text or "").lower()
    if "?" in lower or "ai" in lower:
        return "ASK_AI", {"question": text, "source_text": text}
    if any(k in lower for k in ["giao", "assign", "task"]):
        return "ACTION_COMMAND", {"task": text, "source_text": text}
    if any(k in lower for k in ["lịch", "schedule", "meeting"]):
        return "SCHEDULE_COMMAND", {"title": text, "source_text": text}
    if any(k in lower for k in ["quyết định", "decide", "chốt"]):
        return "DECISION_STATEMENT", {"title": text, "source_text": text}
    if any(k in lower for k in ["rủi ro", "risk", "lo ngại"]):
        return "RISK_STATEMENT", {"risk": text, "source_text": text}
    return "NO_INTENT", {}


def predict_intent(text: str, lang: str | None = "vi") -> Tuple[str, Dict[str, Any]]:
    """Fast intent detection via LLM; fallback to heuristics."""
    body = (text or "").strip()
    if not body:
        return "NO_INTENT", {}
    llm_result = _llm_intent(body, lang)
    if llm_result:
        return llm_result
    return _heuristic_intent(body)
