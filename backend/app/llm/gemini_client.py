import asyncio
import json
from typing import Optional, List, Dict, Any

from groq import Groq
from app.core.config import get_settings

settings = get_settings()

try:
    # New Gemini SDK (google-genai)
    from google import genai as genai_client  # type: ignore
    from google.genai import types as genai_types  # type: ignore
    _GENAI_SDK = "google-genai"
except Exception:
    genai_client = None
    genai_types = None
    _GENAI_SDK = None

try:
    # Legacy Gemini SDK (google-generativeai)
    import google.generativeai as genai_legacy  # type: ignore
    _LEGACY_GENAI = True
except Exception:
    genai_legacy = None
    _LEGACY_GENAI = False


def _gemini_sdk_name() -> str:
    if _GENAI_SDK and genai_client:
        return "google-genai"
    if _LEGACY_GENAI and genai_legacy:
        return "google-generativeai"
    return "none"


def configure_genai() -> bool:
    """Configure legacy Google Generative AI if key is present."""
    if settings.gemini_api_key and genai_legacy:
        genai_legacy.configure(api_key=settings.gemini_api_key)
        return True
    return False


def get_groq_client():
    """Return Groq client."""
    if not settings.groq_api_key:
        return None
    return Groq(api_key=settings.groq_api_key)


def _select_provider() -> str:
    if settings.gemini_api_key and (genai_client or genai_legacy):
        return "gemini"
    if settings.groq_api_key:
        return "groq"
    return "mock"


def is_gemini_available() -> bool:
    """Check if Gemini or Groq is configured and usable."""
    provider = _select_provider()
    if provider != "mock":
        return True
    print("[AI] No AI API key configured (Gemini or Groq)")
    return False


def get_llm_status() -> Dict[str, Any]:
    """Return provider + model metadata for UI/health checks."""
    provider = _select_provider()
    if provider == "gemini":
        model = settings.gemini_model
        api_key_set = bool(settings.gemini_api_key and len(settings.gemini_api_key) > 10)
        api_key_preview = (settings.gemini_api_key[:8] + "...") if settings.gemini_api_key else None
    elif provider == "groq":
        model = settings.groq_model
        api_key_set = bool(settings.groq_api_key and len(settings.groq_api_key) > 10)
        api_key_preview = (settings.groq_api_key[:8] + "...") if settings.groq_api_key else None
    else:
        model = None
        api_key_set = False
        api_key_preview = None
    return {
        "provider": provider,
        "status": "ready" if provider != "mock" else "mock_mode",
        "model": model,
        "api_key_set": api_key_set,
        "api_key_preview": api_key_preview,
        "sdk": _gemini_sdk_name(),
    }


def _gemini_generate(
    prompt: str,
    *,
    system_prompt: Optional[str],
    model_name: str,
    temperature: float,
    max_tokens: int,
) -> str:
    if not settings.gemini_api_key:
        return ""
    try:
        if genai_client and genai_types:
            client = genai_client.Client(api_key=settings.gemini_api_key)
            try:
                config = genai_types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    system_instruction=system_prompt or None,
                )
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config,
                )
                return (getattr(response, "text", None) or "").strip()
            except Exception:
                # Fallback: inline system prompt if SDK config signature differs
                merged_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
                response = client.models.generate_content(
                    model=model_name,
                    contents=merged_prompt,
                )
                return (getattr(response, "text", None) or "").strip()
        if genai_legacy:
            genai_legacy.configure(api_key=settings.gemini_api_key)
            model = genai_legacy.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt or None,
            )
            response = model.generate_content(
                prompt,
                generation_config=genai_legacy.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            )
            return (response.text or "").strip()
    except Exception as exc:
        print(f"[gemini] generate error: {exc}")
    return ""


def _groq_generate(
    prompt: str,
    *,
    system_prompt: Optional[str],
    model_name: str,
    temperature: float,
    max_tokens: int,
) -> str:
    client = get_groq_client()
    if not client:
        return ""
    try:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        resp = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        print(f"[groq] generate error: {exc}")
    return ""


def _groq_chat(
    messages: List[Dict[str, str]],
    *,
    model_name: str,
    temperature: float,
    max_tokens: int,
) -> str:
    client = get_groq_client()
    if not client:
        return ""
    resp = client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


def call_llm_sync(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    model_name: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> str:
    """Sync LLM call used by low-latency / sync code paths."""
    provider = _select_provider()
    temperature = settings.ai_temperature if temperature is None else temperature
    max_tokens = settings.ai_max_tokens if max_tokens is None else max_tokens
    if provider == "gemini":
        return _gemini_generate(
            prompt,
            system_prompt=system_prompt,
            model_name=model_name or settings.gemini_model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    if provider == "groq":
        return _groq_generate(
            prompt,
            system_prompt=system_prompt,
            model_name=model_name or settings.groq_model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    return ""

class GeminiChat:
    """Chat wrapper supporting Google Gemini and Groq."""
    
    def __init__(self, system_prompt: Optional[str] = None, mock_response: Optional[str] = None):
        self.system_prompt = system_prompt or self._default_system_prompt()
        self.mock_response = mock_response or "AI đang ở chế độ mock (chưa cấu hình API Key)."
        self.history: List[Dict[str, str]] = []
        
        # Determine provider
        self.provider = _select_provider()
        self.model_name = settings.gemini_model if self.provider == "gemini" else settings.groq_model
    
    def _default_system_prompt(self) -> str:
        return """Bạn là MINUTE AI Assistant — trợ lý thông minh cho meetings & study sessions.

Sứ mệnh:
1) Pre-meeting: gợi ý agenda, pre-read, tài liệu liên quan.
2) In-meeting: recap theo mốc thời gian, nhận diện action/decision/risk.
3) Post-meeting: tạo biên bản, summary, notes, next steps.
4) Study mode: trích xuất khái niệm, ví dụ, tạo quiz ôn tập.
5) Q&A: trả lời theo ngữ cảnh dựa trên transcript/summary/tài liệu.
6) Multimodal: nếu có "visual_context"/ghi chú khung hình, hãy dùng để giải thích đúng ngữ cảnh.

Nguyên tắc bắt buộc:
- Chỉ dùng dữ liệu được cung cấp (context/transcript/doc). Nếu thiếu dữ liệu, nói rõ “Chưa đủ thông tin”.
- Không bịa, không suy đoán ngoài ngữ cảnh. Ưu tiên câu trả lời ngắn gọn, rõ ràng.
- Nếu cần xác nhận hoặc hành động (tool-calling), luôn hỏi lại trước khi thực hiện (human-in-the-loop).
- Trả lời tiếng Việt, giọng chuyên nghiệp nhưng thân thiện.
"""

    async def chat(self, message: str, context: Optional[str] = None) -> str:
        if self.provider == "mock":
            return self._mock_response(message)
            
        try:
            full_prompt = message
            if context:
                full_prompt = f"Context:\n{context}\n\nUser Question: {message}"

            if self.provider == "gemini":
                response_text = await asyncio.to_thread(
                    _gemini_generate,
                    full_prompt,
                    system_prompt=self.system_prompt,
                    model_name=self.model_name or settings.gemini_model,
                    temperature=settings.ai_temperature,
                    max_tokens=settings.ai_max_tokens,
                )
                return self._clean_markdown(response_text)
            elif self.provider == "groq":
                # Groq
                messages = []
                if self.system_prompt:
                    messages.append({"role": "system", "content": self.system_prompt})
                # Check history (simplified)
                for h in self.history[-5:]:
                    messages.append({"role": "user", "content": h["user"]})
                    messages.append({"role": "assistant", "content": h["assistant"]})
                
                messages.append({"role": "user", "content": full_prompt})

                assistant_message = await asyncio.to_thread(
                    _groq_chat,
                    messages,
                    model_name=self.model_name or settings.groq_model,
                    temperature=settings.ai_temperature,
                    max_tokens=settings.ai_max_tokens,
                )
                self.history.append({"user": full_prompt, "assistant": assistant_message})
                return self._clean_markdown(assistant_message)
                
        except Exception as e:
            import traceback
            print(f"[{self.provider}] Chat error: {e}")
            print(traceback.format_exc())
            return self._mock_response(message)
    
    def _clean_markdown(self, text: str) -> str:
        return (text or "").strip()
    
    def _mock_response(self, message: str) -> str:
        return self.mock_response


class MeetingAIAssistant:
    """AI Assistant specifically for meeting context"""
    
    def __init__(self, meeting_id: str, meeting_context: Optional[Dict[str, Any]] = None):
        self.meeting_id = meeting_id
        self.meeting_context = meeting_context or {}
        self.chat = GeminiChat()
    
    def _build_context(self) -> str:
        """Build context string from meeting data"""
        ctx_parts = []
        
        if self.meeting_context.get('title'):
            ctx_parts.append(f"Cuộc họp: {self.meeting_context['title']}")
        
        if self.meeting_context.get('type'):
            ctx_parts.append(f"Loại: {self.meeting_context['type']}")
        
        if self.meeting_context.get('project'):
            ctx_parts.append(f"Dự án: {self.meeting_context['project']}")
        
        if self.meeting_context.get('agenda'):
            ctx_parts.append(f"Agenda: {self.meeting_context['agenda']}")

        if self.meeting_context.get('visual_context'):
            ctx_parts.append(f"Visual context: {self.meeting_context['visual_context']}")

        if self.meeting_context.get('timeline_highlights'):
            ctx_parts.append(f"Timeline highlights: {self.meeting_context['timeline_highlights']}")
        
        if self.meeting_context.get('transcript'):
            ctx_parts.append(f"Transcript (trích): {self.meeting_context['transcript'][:15000]}...")
        
        return "\n".join(ctx_parts)
    
    async def ask(self, question: str) -> str:
        """Ask a question with meeting context"""
        context = self._build_context()
        return await self.chat.chat(question, context)
    
    async def generate_agenda(self, meeting_type: str) -> str:
        """Generate agenda based on meeting type"""
        prompt = f"""Tạo chương trình cuộc họp chi tiết cho loại: {meeting_type}

Yêu cầu:
- Mỗi mục có: số thứ tự, tiêu đề, thời lượng (phút), người trình bày
- Tổng thời gian khoảng 60 phút
- Format: JSON array với fields: order, title, duration_minutes, presenter"""
        
        return await self.chat.chat(prompt)
    
    async def extract_action_items(self, transcript: str) -> str:
        """Extract action items from transcript"""
        prompt = f"""Phân tích transcript sau và trích xuất các Action Items:

{transcript[:15000]}

Format output JSON:
[
  {{
    "description": "Mô tả task",
    "owner": "Tên người được giao (nếu có)",
    "deadline": "Deadline (nếu được đề cập)",
    "priority": "high/medium/low",
    "topic_id": "topic_related",
    "source_text": "Câu gốc trong transcript nếu có"
  }}
]"""
        
        return await self.chat.chat(prompt)
    
    async def extract_decisions(self, transcript: str) -> str:
        """Extract decisions from transcript"""
        prompt = f"""Phân tích transcript sau và trích xuất các Quyết định (Decisions):

{transcript[:15000]}

Format output JSON:
[
  {{
    "description": "Nội dung quyết định",
    "rationale": "Lý do (nếu có)",
    "confirmed_by": "Người xác nhận",
    "source_text": "Câu gốc trong transcript nếu có"
  }}
]"""
        
        return await self.chat.chat(prompt)
    
    async def extract_risks(self, transcript: str) -> str:
        """Extract risks from transcript"""
        prompt = f"""Phân tích transcript sau và trích xuất các Rủi ro (Risks):

{transcript[:15000]}

Format output JSON:
[
  {{
    "description": "Mô tả rủi ro",
    "severity": "critical/high/medium/low",
    "mitigation": "Biện pháp giảm thiểu (nếu có)",
    "source_text": "Câu gốc trong transcript nếu có"
  }}
]"""
        
        return await self.chat.chat(prompt)

    # ================= STUDY MODE METHODS =================

    async def extract_concepts(self, transcript: str) -> str:
        """Extract key concepts and terms from a study session transcript."""
        prompt = f"""Phân tích transcript buổi học/nghiên cứu sau để trích xuất các KHÁI NIỆM quan trọng (Concepts):

{transcript[:15000]}

Yêu cầu:
- Xác định các định nghĩa, thuật ngữ chuyên ngành, hoặc ý tưởng cốt lõi.
- Giải thích ngắn gọn dễ hiểu.

Format output JSON:
[
  {{
    "term": "Tên khái niệm/thuật ngữ",
    "definition": "Định nghĩa hoặc giải thích ngắn gọn",
    "example": "Ví dụ minh hoạ (nếu có trong bài)"
  }}
]"""
        return await self.chat.chat(prompt)

    async def generate_quiz(self, transcript: str) -> str:
        """Generate a quiz based on the transcript."""
        prompt = f"""Dựa trên nội dung buổi học sau, hãy tạo bộ câu hỏi trắc nghiệm (Quiz) để ôn tập:

{transcript[:15000]}

Yêu cầu:
- 5 câu hỏi trắc nghiệm.
- Mỗi câu có 4 lựa chọn (options).
- Chỉ định rõ đáp án đúng và giải thích tại sao.

Format output JSON:
[
  {{
    "question": "Nội dung câu hỏi",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correct_answer_index": 0, // 0=A, 1=B, 2=C, 3=D
    "explanation": "Giải thích chi tiết tại sao đáp án này đúng"
  }}
]"""
        return await self.chat.chat(prompt)

    # ================= SUMMARY GENERATION =================

    async def generate_summary_with_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate meeting summary with full context and strict guardrails."""
        prompt = f"""Bạn là trợ lý MINUTE tạo biên bản cuộc họp/học.
Hãy tóm tắt dựa trên dữ liệu JSON bên dưới và KHÔNG bịa thông tin.

Quy tắc:
- Chỉ dùng dữ liệu đã cung cấp.
- Nếu transcript, description, actions, decisions, risks, documents đều rỗng:
  - Nếu title đủ cụ thể thì cho phép suy đoán 1-2 câu, bắt đầu bằng "Ước đoán: ".
  - Nếu title quá chung chung (vd: "Meeting", "Cuộc họp", "Sync", "Họp nhanh") thì trả về summary rỗng.
- Nếu có dữ liệu, tóm tắt 2-5 câu, ngắn gọn.
- key_points: 3-5 gạch đầu dòng rút từ transcript hoặc actions/decisions/risks; nếu có visual_context/timeline_highlights thì ưu tiên.
- Không dùng markdown.

Dữ liệu:
{json.dumps(context, ensure_ascii=False)}

Trả về đúng JSON, không kèm text khác:
{{"summary": "...", "key_points": ["...", "..."]}}"""
        response = await self.chat.chat(prompt)
        result: Dict[str, Any] = {}
        try:
            result = json.loads(response)
        except Exception:
            import re
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group(0))
                except Exception:
                    result = {}

        summary = ""
        key_points: List[str] = []
        if isinstance(result, dict):
            summary = str(result.get("summary", "") or "")
            raw_points = result.get("key_points", [])
            if isinstance(raw_points, list):
                key_points = [str(item) for item in raw_points if str(item).strip()]
            elif raw_points:
                key_points = [str(raw_points)]
        if not summary and not key_points:
            summary = response.strip()
        return {"summary": summary, "key_points": key_points}
    
    async def generate_minutes_json(self, transcript: str) -> Dict[str, Any]:
        """Generate comprehensive minutes in strict JSON format with rich content"""
        prompt = f"""Bạn là trợ lý MINUTE chuyên nghiệp tạo biên bản cuộc họp cho doanh nghiệp.
Phân tích nội dung cuộc họp (transcript) bên dưới và tạo biên bản chi tiết.

TRANSCRIPT CUỘC HỌP:
{transcript[:20000]}

YÊU CẦU OUTPUT (JSON Strict Mode):
Trả về MỘT JSON Object duy nhất (KHÔNG kèm markdown block ```json```) với cấu trúc:

{{
    "executive_summary": "Tóm tắt điều hành 2-4 đoạn văn. Bắt đầu bằng mục đích cuộc họp, các nội dung chính đã thảo luận, kết quả đạt được và những điều cần theo dõi.",
    
    "key_points": [
        "Điểm thảo luận quan trọng 1 - mô tả ngắn gọn nội dung và ai đề cập",
        "Điểm thảo luận quan trọng 2 - kết quả hoặc kết luận",
        "Điểm thảo luận quan trọng 3"
    ],
    
    "action_items": [
        {{
            "description": "Mô tả chi tiết công việc cần thực hiện",
            "owner": "Tên người được giao (trích từ transcript, nếu không rõ ghi 'Chưa phân công')",
            "deadline": "YYYY-MM-DD nếu đề cập, hoặc 'Sớm nhất có thể' nếu urgent, hoặc null",
            "priority": "high/medium/low - dựa vào mức độ nhấn mạnh trong cuộc họp",
            "created_by": "Tên người tạo ra yêu cầu này trong cuộc họp"
        }}
    ],
    
    "decisions": [
        {{
            "description": "Nội dung quyết định rõ ràng, cụ thể",
            "rationale": "Lý do dẫn đến quyết định này (tóm tắt thảo luận)",
            "decided_by": "Tên người chốt quyết định cuối cùng",
            "approved_by": "Những người đồng ý/phê duyệt (nếu có)"
        }}
    ],
    
    "risks": [
        {{
            "description": "Mô tả rủi ro hoặc vấn đề tiềm ẩn được nêu ra",
            "severity": "critical/high/medium/low",
            "mitigation": "Biện pháp giảm thiểu đã thảo luận",
            "raised_by": "Người nêu ra rủi ro này"
        }}
    ],
    
    "next_steps": [
        "Bước tiếp theo 1 cần thực hiện sau cuộc họp",
        "Bước tiếp theo 2"
    ],
    
    "attendees_mentioned": [
        "Tên người tham gia được nhắc đến trong transcript"
    ],

    "study_pack": {{
        "concepts": [
             {{ "term": "...", "definition": "...", "example": "..." }}
        ],
        "quiz": [
             {{ "question": "...", "options": ["..."], "correct_answer_index": 0, "explanation": "..." }}
        ]
    }}
}}

LƯU Ý QUAN TRỌNG:
- Trích xuất TẤT CẢ thông tin có trong transcript, không bỏ sót
- Với mỗi action/decision/risk, PHẢI ghi rõ ai là người tạo/đề xuất/quyết định
- Nếu không xác định được người, ghi "Không rõ" thay vì bỏ trống
- Priority: high = được nhấn mạnh nhiều lần, medium = đề cập bình thường, low = đề cập qua
- executive_summary phải viết như văn bản chuyên nghiệp, có đầu có đuôi
- NẾU đây là buổi học/training: hãy điền đầy đủ thông tin vào "study_pack".
- NẾU đây là cuộc họp dự án/công việc: "study_pack" có thể để rỗng hoặc null.
- Nếu transcript có dấu hiệu visual context (ví dụ [VISUAL]/[SCREEN]) hãy nhắc trong executive_summary/key_points.
"""
        
        response = await self.chat.chat(prompt)
        
        # Robust JSON extraction
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            import re
            # Try to find JSON block match
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except:
                    pass
            
            # Extract markdown code block if present  
            code_block = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
            if code_block:
                try:
                    return json.loads(code_block.group(1))
                except:
                    pass
            
            # Fallback structure with raw response as summary
            print(f"[AI] Failed to parse JSON minutes, using fallback")
            return {
                "executive_summary": response[:1000],
                "key_points": [],
                "action_items": [],
                "decisions": [],
                "risks": [],
                "next_steps": [],
                "attendees_mentioned": [],
                "study_pack": None
            }
    
    async def generate_summary(self, transcript: str) -> str:
        """Generate meeting summary"""
        prompt = f"""Tạo tóm tắt cuộc họp dựa trên transcript sau, không bịa thông tin.
Nếu transcript trống hoặc không đủ dữ liệu thì trả về chuỗi rỗng.

{transcript[:3000]}

Format:
## Tóm tắt cuộc họp

### Các điểm chính
- ...

### Quyết định
- ...

### Action Items
- ...

### Rủi ro được đề cập
- ...

### Bước tiếp theo
- ..."""
        
        return await self.chat.chat(prompt)
