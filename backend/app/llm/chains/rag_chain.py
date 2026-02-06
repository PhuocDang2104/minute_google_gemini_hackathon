from typing import Any
from app.vectorstore.retrieval import simple_retrieval
from app.llm.gemini_client import call_llm_sync, is_gemini_available


def run_rag(query: str, meeting_id: str | None = None) -> dict[str, Any]:
    docs = simple_retrieval(query, meeting_id)
    if not is_gemini_available():
        return {"answer": "Chưa cấu hình LLM. Vui lòng thiết lập Gemini/Groq API key.", "citations": docs}
    context = "\n".join(str(doc) for doc in docs) if docs else "Không có tài liệu liên quan."
    prompt = f"""Câu hỏi: {query}

Context:
{context}

Yêu cầu:
- Trả lời ngắn gọn bằng tiếng Việt.
- Chỉ dùng thông tin trong Context.
- Nếu không đủ thông tin, nói rõ "Chưa đủ dữ liệu"."""
    answer = call_llm_sync(prompt)
    return {"answer": answer, "citations": docs}
