### Thiết kế tính năng upload tài liệu (real file)

#### 1) Mục tiêu
- Cho phép admin tải file thực lên server, lưu trữ và đăng ký metadata để dùng cho quản trị/RAG/meeting.
- Giữ tương thích mock cũ, nhưng có đường dẫn tĩnh để truy cập file (`/files/{id.ext}`).

#### 2) Luồng backend
- Endpoint mới: `POST /api/v1/documents/upload-file` (multipart/form-data).
  - Trường: `file` (bắt buộc), `meeting_id` (UUID, optional), `uploaded_by` (UUID, optional), `description` (optional).
  - Validate meeting_id/uploaded_by nếu có.
  - Lưu file vào thư mục `backend/app/uploaded_files/` với tên `{uuid}.{ext}`; ghi nhận `file_url = /files/{uuid}.{ext}`.
  - Trả `DocumentUploadResponse { id, title, file_url, message }`.
- Static files: FastAPI mount `/files` trỏ tới `backend/app/uploaded_files`.
- Metadata tạm thời vẫn lưu in-memory dictionary `_mock_documents` (Document model Pydantic), để list được qua admin/documents hoặc meeting docs (mock). Cần migration + DB/storage thực nếu triển khai production.

#### 3) Thay đổi code chính (đã áp dụng)
- `backend/app/api/v1/endpoints/documents.py`: thêm `upload-file` (multipart), parse form, gọi service.
- `backend/app/services/document_service.py`: hàm `upload_document_file` lưu file xuống đĩa, tạo metadata vào `_mock_documents`.
- `backend/app/main.py`: mount static `/files`, tạo thư mục nếu chưa có.
- `backend/app/schemas/document.py`: `meeting_id` optional trong `DocumentCreate`.

#### 4) Frontend integration (Electron)
- API client `lib/api/documents.ts` thêm `uploadFile(formData)`; dùng FormData, không cần header thủ công.
- Trang admin (`app/routes/AdminConsole.tsx`):
  - Form upload: meeting_id (optional), description (optional), chọn file → gọi `uploadFile`.
  - Reload danh sách tài liệu sau khi upload; hiển thị file size/type/meeting.

#### 5) Giới hạn hiện tại / rủi ro
- Metadata chưa lưu DB; restart backend sẽ mất danh sách (file vẫn trên đĩa). Cần bổ sung lưu vào Postgres và/hoặc object storage (S3/MinIO) cho production.
- Chưa có kiểm tra kích thước/loại file; cần thêm allowlist mime/size, quét virus nếu có.
- Chưa có pre-signed URL hay ACL; `/files` phục vụ trực tiếp. Production nên dùng storage riêng với URL ký và kiểm soát quyền.
- Chưa có pipeline index RAG tự động; cần job ingest sau upload (đẩy vào hàng đợi).

#### 6) Đề xuất nâng cấp
- Lưu metadata vào bảng `document` (id, meeting_id, name, mime, size, owner, visibility/labels/tags, status).
- Tách lưu file sang object storage; `/files` chỉ dùng cho dev.
- Thêm hook enqueue indexing (meeting scope/global) sau upload thành công.
- Thêm kiểm soát quyền: chỉ admin/staff có quyền upload; filter danh sách theo role/meeting_id.
- Thêm HEAD/GET metadata endpoint và delete thực sự (xóa storage + metadata).

