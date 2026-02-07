# Session RAG + MoM Generation

Tài liệu này mô tả phần backend cho:
- Chatbot RAG theo tài liệu upload của từng session/project.
- Tạo Minutes of Meeting (MoM) theo 2 prompt strategy.
- Data model timeline theo timecode (transcript + visual objects).

## 1) Luồng MoM

File chính: `backend/app/services/minutes_service.py`

`POST /api/v1/minutes/generate` hỗ trợ:
- `prompt_strategy`: `context_json` | `structured_json`
- `session_type`: `meeting` | `course` (auto infer nếu bỏ trống)
- `include_topic_tracker`, `include_ai_filters`, `include_quiz`, `include_knowledge_table`

### Strategy
- `context_json`:
  - Dùng payload context (meeting + transcript + action/decision/risk + docs + topic).
  - Gọi `MeetingAIAssistant.generate_summary_with_context`.
  - Với `course`: gọi thêm `extract_concepts` và `generate_quiz`.
- `structured_json`:
  - Gọi `MeetingAIAssistant.generate_minutes_json`.
  - Parse structured fields: `executive_summary`, `action_items`, `decisions`, `risks`, `next_steps`, `study_pack`.

### Output format
- `meeting`:
  - Decision table
  - Action table
  - Risk table
  - AI filters
  - Topic tracker
- `course`:
  - Table of knowledge
  - Quiz
  - Topic tracker

## 2) Session RAG cho Chatbot

File chính: `backend/app/llm/tools/rag_search_tool.py`

Retriever chạy theo bucket:
1. `meeting`
2. `project`
3. `global`

Nguồn dữ liệu:
- `knowledge_document`
- `knowledge_chunk`

Ưu tiên vector search nếu có `JINA_API_KEY`, fallback text search nếu không có.
Nếu DB/vector chưa sẵn sàng thì fallback về retriever mock `light_rag`.

## 3) Data model timeline

### Có sẵn
- `transcript_chunk` (speech theo timecode)
- `visual_event` (frame/screen event theo timecode)

### Mới
- `visual_object_event` (object detection theo timecode)
  - `meeting_id`, `visual_event_id`
  - `timestamp`, `time_end`
  - `object_label`, `object_type`
  - `bbox`, `confidence`, `attributes`
  - `ocr_text`, `frame_url`, `source`

Model:
- `backend/app/models/timeline.py`
- `backend/app/models/meeting.py`

Migration:
- `backend/alembic/versions/d9e8f7a6b5c4_add_visual_object_event_and_ensure_knowledge_chunk.py`

Migration này cũng có phần `ensure` để tạo/chuẩn hóa `knowledge_chunk` + vector index trong môi trường đã stamp sai trước đó.

## 4) Cách thêm Jina key

Thiết lập biến môi trường backend:
```bash
JINA_API_KEY=your_jina_key
JINA_EMBED_MODEL=jina-embeddings-v3
JINA_EMBED_TASK=text-matching
JINA_EMBED_DIMENSIONS=1024
```

Lưu ý:
- `JINA_API_KEY` là bắt buộc để bật vector embedding.
- `JINA_EMBED_DIMENSIONS` nên là `1024` để khớp schema `vector(1024)`.

## 5) Lệnh migrate

Từ thư mục `backend/`:
```bash
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. alembic heads
```

Head hiện tại:
- `d9e8f7a6b5c4`
