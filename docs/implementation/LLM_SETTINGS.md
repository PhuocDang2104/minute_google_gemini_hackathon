# LLM Settings (Split Text LLM vs Visual Model)

Tài liệu này mô tả các file và luồng xử lý liên quan đến chức năng **tách cấu hình model thành 2 nhóm**:
- Text LLM (chat/summarization)
- Visual model (video/frame caption cho RAG)

## Mục tiêu tính năng
- Người dùng chọn **LLM provider/model/key** cho chat và summary.
- Người dùng chọn **Visual provider/model/key** riêng cho video/frame understanding.
- Người dùng cấu hình **hành vi phản hồi** (`note_style`, `tone`, `cite_evidence`, persona ngắn).
- Người dùng nhập **master prompt** để điều chỉnh system behavior.
- **Bảo mật key**: không lưu localStorage, chỉ lưu trên server (mã hoá), frontend chỉ nhận trạng thái key.

## Tổng quan luồng
1. **Frontend Settings load**
   - Gọi `GET /api/v1/users/{user_id}/llm-settings`.
   - Server trả về cả 2 nhóm: text (`provider/model/api_key_*`) và visual (`visual_provider/visual_model/visual_api_key_*`).
2. **User chỉnh & lưu**
   - `PUT /api/v1/users/{user_id}/llm-settings` với:
   - text: `provider`, `model`, `api_key|clear_api_key`
   - visual: `visual_provider`, `visual_model`, `visual_api_key|clear_visual_api_key`
   - prompt/behavior: `master_prompt`, `behavior`
   - Server mã hoá key và lưu vào `user_account.preferences.llm`.
3. **Sử dụng key khi gọi LLM**
   - Khi tạo minutes/chat, backend dùng nhóm text config.
   - Khi ingest visual từ video, backend dùng nhóm visual config.
   - Runtime ghép prompt theo thứ tự: `default system prompt` + `behavior settings` + `master prompt`.
   - Nếu không có key riêng, fallback về key môi trường (`GEMINI_API_KEY` / `GROQ_API_KEY`).

## Backend: File chính

### 1) `backend/app/schemas/llm_settings.py`
Định nghĩa schema cho API settings.
- `LlmBehaviorSettings`: nickname/about/future_focus/role/note_style/tone/cite_evidence.
- `LlmSettings`: text + visual + master prompt + behavior.
- `LlmSettingsUpdate`: payload cập nhật cho cả 2 nhóm text/visual.

### 2) `backend/app/utils/crypto.py`
Mã hoá/giải mã API key.
- Sử dụng `cryptography.Fernet` với key dẫn xuất từ `settings.secret_key`.
- Mã hoá lưu dưới dạng `v1:<token>`.
- Nếu đổi `SECRET_KEY` sẽ **không giải mã được key cũ**.

### 3) `backend/app/services/user_service.py`
Xử lý đọc/ghi `preferences.llm`:
- `get_llm_settings(db, user_id)` -> trả về LlmSettings (không trả key).
- `update_llm_settings(db, user_id, payload)` -> mã hoá key, lưu JSON.
- `get_user_llm_override(db, user_id)` -> override cho text LLM.
- `get_user_visual_override(db, user_id)` -> override cho visual model.

### 4) `backend/app/api/v1/endpoints/users.py`
API endpoints:
- `GET /users/{user_id}/llm-settings`
- `PUT /users/{user_id}/llm-settings`

### 5) `backend/app/llm/gemini_client.py`
Cấp hỗ trợ **override provider/model/api_key** cho LLM:
- `LLMConfig` dataclass
- `call_llm_sync(..., llm_config=...)`
- `GeminiChat(..., llm_config=...)`
- `MeetingAIAssistant(..., llm_config=...)`
- Có thêm bước `compose system prompt` để áp dụng behavior + master prompt từ user settings.

### 6) `backend/app/services/minutes_service.py`
Khi generate minutes:
- Lấy `organizer_id` từ bảng `meeting`.
- Gọi `user_service.get_user_llm_override`.
- Nếu có override -> truyền `LLMConfig` vào `MeetingAIAssistant`.

## Frontend: File chính

### 1) `frontend/src/renderer/app/routes/Settings.tsx`
UI Settings:
- Khối `LLM model`: provider/model/key.
- Khối `Visual model`: provider/model/key.
- Nút xoá key (clear), hiển thị trạng thái lưu (last4).
- Textarea `Master prompt`.
- Các trường personalization được sync vào `behavior` trong backend settings.
- Không lưu key vào localStorage.

### 2) `frontend/src/renderer/lib/api/users.ts`
- `getLlmSettings(id)`
- `updateLlmSettings(id, payload)`

### 3) `frontend/src/renderer/shared/dto/user.ts`
Khai báo types:
- `LlmProvider`, `LlmSettings`, `LlmSettingsUpdate`.

## Data model lưu trữ
`user_account.preferences` (JSONB)
```json
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "api_key": "v1:<encrypted>",
    "api_key_last4": "1234",
    "visual_provider": "gemini",
    "visual_model": "gemini-1.5-flash",
    "visual_api_key": "v1:<encrypted>",
    "visual_api_key_last4": "5678",
    "master_prompt": "Always answer in concise bullets...",
    "behavior": {
      "note_style": "Ngắn gọn",
      "tone": "Chuyên nghiệp",
      "cite_evidence": true,
      "nickname": "Anh Phuoc",
      "role": "PM",
      "about": "Thich bullet ro rang",
      "future_focus": "Improve leadership in 6 months"
    }
  }
}
```

## API payload mẫu

### GET
`/api/v1/users/{user_id}/llm-settings`
```json
{
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "api_key_set": true,
  "api_key_last4": "1234",
  "visual_provider": "gemini",
  "visual_model": "gemini-1.5-flash",
  "visual_api_key_set": true,
  "visual_api_key_last4": "5678",
  "master_prompt": "Always show actionable next steps.",
  "behavior": {
    "note_style": "Ngắn gọn",
    "tone": "Chuyên nghiệp",
    "cite_evidence": true
  }
}
```

### PUT
```json
{
  "provider": "groq",
  "model": "meta-llama/llama-4-scout-17b-16e-instruct",
  "api_key": "gsk_xxx...",
  "visual_provider": "gemini",
  "visual_model": "gemini-1.5-flash",
  "visual_api_key": "AIza....",
  "master_prompt": "Prioritize action items with owner + deadline.",
  "behavior": {
    "note_style": "Chi tiết",
    "tone": "Thẳng vào vấn đề",
    "cite_evidence": true
  }
}
```
Hoặc xoá key:
```json
{
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "clear_api_key": true,
  "clear_visual_api_key": true
}
```

## Bảo mật & lưu ý vận hành
- **Không lưu key ở client**. Frontend chỉ giữ tạm trong state.
- **Server lưu key mã hoá** bằng `SECRET_KEY`. Cần set `SECRET_KEY` ổn định ở môi trường production.
- Nếu đổi `SECRET_KEY` -> key cũ không giải mã được.
- Biến model Groq cho chatbot đã đổi tên sang `LLM_GROQ_CHAT_MODEL`.
- Có thể khai báo thêm `LLM_GROQ_VISION_MODEL` nếu tách model vision riêng.
- Alias cũ vẫn hỗ trợ: `LLM_GROQ_MODEL`, `GROQ_MODEL`.

## Điểm mở rộng
- Hiện tại **minutes generation** dùng override theo organizer. Có thể mở rộng sang:
  - RAG (`backend/app/llm/chains/rag_chain.py`)
  - Chat (`backend/app/llm/gemini_client.py` khi xử lý chat)
  - Agenda, Knowledge, In-meeting.
- Nếu muốn nhiều profile LLM theo project/meeting, có thể chuyển lưu vào `meeting` hoặc `project` thay vì `user_account.preferences`.

## Troubleshooting
- `404 user not found` -> user_id frontend không tồn tại trong DB.
- `api_key_set=false` dù đã lưu -> kiểm tra `SECRET_KEY` và payload.
- Visual caption không chạy -> kiểm tra `visual_api_key_set=true` và pipeline có `run_caption=true`.
