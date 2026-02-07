# RAG System Design (Project/Session/Web)

Mục tiêu: xây dựng RAG theo **từng dự án** và **từng session/meeting**, có thể mở rộng sang **web search**. Tài liệu này mô tả kiến trúc, dữ liệu, pipeline và API gợi ý để dev triển khai.

## 1) Phạm vi dữ liệu & mức ưu tiên
1. **Session/Meeting scope** (ưu tiên cao nhất):
   - Transcript chunks, recap, notes của meeting hiện tại.
   - Dùng cho Q&A in-meeting/post-meeting.
2. **Project scope** (ưu tiên trung bình):
   - Tài liệu dự án (PRD, kế hoạch, meeting minutes cũ, docs kỹ thuật).
   - Dùng để trả lời câu hỏi liên quan bối cảnh dự án.
3. **Global scope** (ưu tiên thấp):
   - Knowledge base chung, handbook, FAQ nội bộ.
4. **Web search scope** (opt-in):
   - Dùng khi thiếu bằng chứng (confidence thấp) hoặc người dùng bật tính năng.

## 2) Data model đề xuất
### 2.1 Tables (gợi ý mở rộng)
- `knowledge_document`
  - `id`, `project_id`, `meeting_id` (nullable), `title`, `file_type`, `storage_key`, `file_url`, `source_type` (upload/manual/web), `created_at`.
- `knowledge_chunk`
  - `id`, `document_id`, `chunk_index`, `content`, `embedding`,
  - `scope_meeting` (meeting_id), `scope_project` (project_id), `source_type`, `metadata` (JSON).
- `meeting_transcript_chunk`
  - Đã có; dùng làm nguồn ingestion cho RAG session.
- `rag_query_history`
  - `id`, `meeting_id`, `project_id`, `query_text`, `answer_text`, `citations` (JSON), `created_at`.

## 3) Ingestion pipeline
### 3.1 Project docs (upload)
1. Upload -> lưu metadata -> lưu file (Supabase/Storage).
2. Extract text -> chunk -> embed -> insert vào `knowledge_chunk`.
3. Mỗi chunk gắn `project_id`.

### 3.2 Meeting/session transcript
1. Sau khi có transcript → chunk theo timestamp.
2. Embed + lưu vào `knowledge_chunk` với `scope_meeting = meeting_id`.

### 3.3 Web search (optional)
1. Query web → fetch top results.
2. Trích text, chunk, embed.
3. Lưu `knowledge_chunk` dạng **ephemeral** (TTL hoặc flag), không cần lưu file gốc.

## 4) Retrieval pipeline
### 4.1 Query flow (pseudo)
```
inputs: query, meeting_id?, project_id?, allow_web?

1) Build filters:
   - meeting_id -> session bucket
   - project_id -> project bucket
   - global bucket

2) Retrieve candidates:
   - Vector search + (optional) keyword score
   - Top-K per bucket

3) Re-rank:
   - Ưu tiên session > project > global
   - Nếu điểm thấp -> fallback web search (nếu allow_web)

4) Assemble citations
```

### 4.2 Cấu hình đề xuất
- `top_k_session = 6`
- `top_k_project = 6`
- `top_k_global = 4`
- `rerank_threshold = 0.35`
- `allow_web = user_setting.web_search`

## 5) API đề xuất
### 5.1 Query RAG
`POST /api/v1/rag/query`
```json
{
  "query": "...",
  "meeting_id": "...",
  "project_id": "...",
  "allow_web": true,
  "max_chunks": 10
}
```

### 5.2 History
`GET /api/v1/rag/history/{meeting_id}`

## 6) Liên hệ code hiện có
- RAG chain: `backend/app/llm/chains/rag_chain.py`
- Light RAG tool: `backend/app/llm/tools/rag_search_tool.py`
- Vector store (stub): `backend/app/vectorstore/*`
- Knowledge docs: `backend/app/services/knowledge_service.py`
- RAG endpoints: `backend/app/api/v1/endpoints/rag.py`

## 7) Roadmap triển khai
1. **Phase 1 (demo/MVP)**
   - Dùng `knowledge_document` + `knowledge_chunk` + pgvector.
   - Scope theo `meeting_id` / `project_id`.
   - UI bật/tắt web search (chưa crawl thật).
2. **Phase 2 (prod)**
   - Web search real + TTL index.
   - Hybrid retrieval (BM25 + vector).
   - Reranker (cross-encoder).

