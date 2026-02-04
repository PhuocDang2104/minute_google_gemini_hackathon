# Kiến trúc tìm kiếm tài liệu (Knowledge) dùng vector embedding

## Mục tiêu
- Lưu và truy vấn tài liệu (Knowledge Hub) bằng RAG: chunk văn bản, embed, lưu pgvector, tìm kiếm theo cosine similarity.
- Kết hợp filter theo phạm vi (org/project/meeting) và metadata (source/category).

## Cấu trúc dữ liệu (Postgres + pgvector)
- Bảng `knowledge_document`: metadata tài liệu (id, title, description, source, category, tags, file_type, file_size, storage_key, file_url, org_id, project_id, meeting_id, visibility, created_at).
- Bảng `knowledge_chunk`: các chunk văn bản + embedding (`vector(384)` nếu dùng all-MiniLM-L6-v2/gte-small).
- Index: `ivfflat` trên embedding, index scope (org/project/meeting).
- Schema mẫu: `infra/postgres/init/04_knowledge_rag.sql`.

## Pipeline ingest
1) Upload file → lưu vào Supabase Storage (storage_key) + ghi metadata `knowledge_document` (đã tự động khi upload).
2) Extract text (PDF/DOCX/PPTX/CSV → text). Với local POC dùng file .txt.
3) Chunk: 400–800 tokens (hoặc ~1200 chars) overlap 50–100.
4) Embed chunk bằng model CPU nhỏ (all-MiniLM-L6-v2 / gte-small, 384 dims) hoặc dịch vụ (OpenAI/Groq nếu có).
5) Insert `knowledge_chunk(document_id, chunk_index, content, embedding, scope_org/project/meeting)`.

## Query (search)
- Embed câu hỏi cùng model → vector q.
- SQL:
```sql
SET LOCAL ivfflat.probes = 10;
SELECT id, document_id, content, embedding <=> :qvec AS distance
FROM knowledge_chunk
WHERE (scope_org IS NULL OR scope_org = :org)
  AND (scope_project IS NULL OR scope_project = :project)
  AND (scope_meeting IS NULL OR scope_meeting = :meeting)
ORDER BY embedding <=> :qvec
LIMIT 10;
```
- Kết quả re-rank nhẹ (optional) và gom context → LLM trả lời, trích dẫn doc.

## Tích hợp backend (FastAPI)
- Upload: `POST /api/v1/knowledge/documents/upload` → lưu metadata + file.
- Ingest (hiện tại stub): cần nâng cấp:
  - Tải file theo `storage_key`.
  - Extract text, chunk, embed, insert `knowledge_chunk`.
- Search API: đã có `/api/v1/knowledge/search` (text search). Cần bổ sung vector search:
  - Embed query → truy vấn `knowledge_chunk` như trên → trả danh sách chunk/doc kèm distance.
  - Optional: trả citations (document_id, title).

## Model embedding (POC local)
- Dùng `sentence-transformers/all-MiniLM-L6-v2` (384 dims) với HF token.
- Đã có script `backend/local_embeddings/ingest_local.py` để ingest file .txt vào DB.
- Server embedding local: `backend/local_embeddings/server.py` (FastAPI `/embed`) để backend gọi HTTP.

## Hướng dẫn nhanh chạy POC local
1) Cài deps: `torch`, `sentence-transformers`, `psycopg2-binary`.
2) Đặt `DATABASE_URL`; đảm bảo schema `knowledge_chunk` vector(384) (chạy `infra/postgres/init/04_knowledge_rag.sql`).
3) Tải model:
   ```bash
   export HF_TOKEN=<token_if_needed>
   python - <<'PY'
   from sentence_transformers import SentenceTransformer
   SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
   PY
   ```
4) Ingest file text:
   ```bash
   python backend/local_embeddings/ingest_local.py --file /path/to/doc.txt --title "Demo"
   ```
5) Query thủ công: embed câu hỏi → `ORDER BY embedding <=> :qvec LIMIT 5`.

## Mở rộng
- Thay model/dimension: chỉnh `knowledge_chunk.embedding` và index.
- Kết hợp BM25 (tsvector) để rerank hybrid.
- Thêm RLS/visibility theo org/project/meeting khi expose API.
