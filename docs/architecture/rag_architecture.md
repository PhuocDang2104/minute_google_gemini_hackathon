# RAG Architecture (MeetMate)

Tài liệu mô tả kiến trúc RAG hiện tại, luồng ingest → search → chat, cùng giải thích prompt để người dùng dễ hiểu và vận hành.

## Thành phần chính
- **Vector DB (pgvector)**: bảng `knowledge_chunk.embedding` (vector(1024) cho Jina `jina-embeddings-v3`).
- **Metadata DB**: bảng `knowledge_document` (title, description, source, category, tags, file_url, meeting_id/project_id scope).
- **Storage**: Supabase S3 (đã slugify key để tránh ký tự lạ).
- **Embeddings**: Jina Inference API `jina-embeddings-v3` (task `text-matching`, dim 1024).
- **LLM**: Groq (model `llama-3.3-70b-versatile` theo config).
- **Extractor**: `pdfplumber` cho PDF text-based (chưa OCR; file scan cần OCR bổ sung).

## Luồng ingest tài liệu
1) **Upload**: `POST /api/v1/knowledge/documents/upload` nhận file + metadata (meeting_id/project_id tùy chọn).
2) **Lưu metadata**: ghi vào `knowledge_document` (db) và mock cache.
3) **Extract text**: PDF → pdfplumber; định dạng khác → decode utf-8; fallback title/description nếu rỗng.
4) **Chunk**: greedy 1200 chars, overlap 200; bỏ chunk trống; sanitize NUL.
5) **Embed**: gọi Jina, nhận vector 1024-d; lưu `knowledge_chunk` với `scope_meeting/scope_project`.
6) **Index**: ivfflat trên embedding (cosine); lists=100 (điều chỉnh khi dữ liệu lớn).

## Luồng truy vấn / search
### `/knowledge/search`
- Embed query (Jina) → vector search pgvector (filter theo meeting_id/project_id/source/category/tags).
- Dedup theo document (lấy best distance), trả danh sách docs + total.
- Fallback text search nếu vector lỗi.

### `/knowledge/query` (AI chat)
- Chặn small-talk/ngắn vô nghĩa → trả lời thân thiện, không chạy RAG.
- Embed query → lấy top chunks (k≈12-15) theo cosine + scope filter.
- Nếu không có context: trả lời “chưa thấy tài liệu”, nếu Groq sẵn sàng sẽ gợi ý chung (có cảnh báo thiếu dữ liệu).
- Prompt LLM:
  - System: “Bạn là trợ lý RAG. Trả lời ngắn gọn tiếng Việt. Chỉ dùng Context. Nếu thiếu, nói rõ.”
  - User: câu hỏi + Context (danh sách chunk kèm score).
  - Yêu cầu: trả lời ngắn, không markdown, cite tên tài liệu trong ngoặc [] khi dùng.
- Confidence: 1 - distance (giới hạn 0.5–0.98) khi có vector; else mặc định 0.6–0.9.

## Prompt giải thích (dễ hiểu)
- **System (RAG)**: “Chỉ dùng thông tin trong Context; không bịa; trả lời ngắn; báo thiếu dữ liệu nếu không đủ.”
- **Fallback generic**: Nếu không có context, system “trợ lý thân thiện, không bịa quá đà; nếu không chắc, nói rõ.” rồi gợi ý chung.
- **Small-talk guard**: Nếu câu hỏi kiểu “hi/hello/cái gì?” → trả lời mời mô tả rõ hơn.

## Phân quyền / scope
- Mọi truy vấn vector áp dụng filter `meeting_id/project_id` nếu có (COALESCE với scope chunk) để chỉ trả tài liệu cùng cuộc họp/dự án.
- Có thể thêm `visibility`/RLS sau; hiện kiểm soát ở lớp ứng dụng.

## Lưu ý vận hành
- **Schema dim**: đảm bảo `knowledge_chunk.embedding` = `vector(1024)`. Nếu đổi model (512), phải alter schema + config Jina dimensions.
- **Env bắt buộc**: `JINA_API_KEY`, `GROQ_API_KEY`, `SUPABASE_S3_*`, DB URL, `SUPABASE_JWT_SECRET` (auth).
- **PDF scan**: chưa OCR, chunk có thể rỗng → báo lỗi “No valid text chunks” hoặc không có context. Cần thêm OCR nếu gặp file ảnh.
- **Upload fallback**: nếu S3 lỗi, lưu local `/files/<name>`; file_url có thể là local path.
- **Retry**: chưa có queue retry embed; nên thêm nếu upload khối lượng lớn.

## Kiểm thử nhanh
1) Upload: `POST /api/v1/knowledge/documents/upload` với file PDF text → kiểm DB `knowledge_document` và `knowledge_chunk` có record, embedding dim 1024.
2) Search: `POST /api/v1/knowledge/search` body `{ "query": "..." }` → nhận danh sách docs.
3) Query AI: `POST /api/v1/knowledge/query` body `{ "query": "..." }` → nhận answer + citations; nếu không có context, câu trả lời phải báo thiếu dữ liệu.
4) Scope: upload với meeting_id, query cùng meeting_id thấy kết quả; khác meeting_id thì không.
