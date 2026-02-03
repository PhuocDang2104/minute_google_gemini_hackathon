### Kiến trúc trang quản trị (admin console)

#### 1) Mục tiêu & phạm vi
- Cho phép admin quản lý người dùng, tài liệu, cuộc họp, cấu hình hệ thống trong một console hợp nhất.
- Đảm bảo minh bạch quyền truy cập, truy vết hành động (audit), và chuẩn hóa dữ liệu để phục vụ RAG/analytics.

#### 2) Vai trò & giả định
- Persona: `admin` (có thể mở rộng `PMO` với quyền giới hạn).
- Backend đã có auth JWT + RBAC; API prefix `/api/v1`.
- Dữ liệu lõi: Postgres (user, meeting, document metadata), pgvector (embeddings), object storage (file).

#### 3) Kiến trúc tổng thể (logic view)
- **UI Admin Console** (Electron/React):
  - Module User: CRUD user, gán/đổi role, khóa/mở `is_active`, reset mật khẩu (trigger flow).
  - Module Document: danh sách, upload, gán label/tag, thiết lập visibility (global/meeting/share), xem trạng thái index.
  - Module Meeting: danh sách, chi tiết, người tham dự, tài liệu gắn với meeting, trạng thái pre/in/post.
  - Module System: cấu hình CORS, secret, email SMTP flag, AI model chọn, quota, log/traces view.
  - Audit panel: hiển thị log hành động quan trọng (create user, change role, share doc).
- **Backend Admin APIs** (FastAPI):
  - `/users/*`: CRUD, khóa/mở, gán role, liệt kê theo org/dept.
  - `/documents/*`: upload (trả URL/file_id), set metadata/labels/visibility, list/filter, archive.
  - `/meetings/*`: list, attach documents, manage participants, phases.
  - `/system/*`: đọc/cập nhật config an toàn (chỉ cho admin), health, metrics.
  - Auth guard: `require_admin` hoặc `require_role([...])` trên từng endpoint.
- **Data Layer**:
  - Postgres: `user_account (is_active, role, org/dept, last_login_at)`, `document` (labels, visibility, owner, meeting_id), `meeting`, `meeting_participant`.
  - Object storage: file binary, phục vụ bằng pre-signed URL.
  - Vector store: embeddings theo scope (global vs meeting), metadata `allowed_roles/users/meeting_id`.
- **Observability & Audit**:
  - Log API (success/fail) + hành động admin; lưu vào bảng audit hoặc log sink.
  - Metrics: số user active, số doc indexed, thời gian index, lỗi upload.

#### 4) Phân hệ chi tiết
- **User Management**
  - Tác vụ: tạo user, đổi role, khóa/mở, reset mật khẩu.
  - Quyền: chỉ `admin`; hiển thị role hiện tại, `is_active`, last_login_at.
  - Dữ liệu trao đổi: user_id/email/display_name/role/org/dept/is_active.
  - Ràng buộc: email duy nhất; trả 409 khi trùng; chặn thao tác nếu `is_active = false` trừ khi unlock.
- **Document Management**
  - Tác vụ: upload, gán label (tổng/meeting), tags (Phát triển/Kinh doanh/Quản lý), thiết lập visibility (global/meeting/share list), archive/unarchive.
  - Quyền: admin (toàn cục); có thể ủy quyền staff theo role sau này.
  - Dòng dữ liệu: upload -> lưu object storage -> ghi metadata Postgres -> gửi job index -> vector store.
  - Chọn tài liệu cho meeting (pre-meet): gắn `meeting_id` + tag/label; lưu bảng liên kết `meeting_documents`.
- **Meeting Management**
  - Tác vụ: tạo/sửa meeting, quản lý participants, gắn tài liệu, xem trạng thái pre/in/post.
  - Quyền: admin/PMO/chair (theo policy); admin thấy tất cả, chair thấy meeting mình tổ chức.
  - Dữ liệu: meeting core + participants + linked documents.
- **System Management**
  - Tác vụ: đọc health, cấu hình CORS, email (SMTP), AI model, quota; xem metrics/log.
  - Quyền: chỉ admin; thay đổi cấu hình yêu cầu xác thực mạnh (có thể thêm re-auth).

#### 5) Integration flow (tóm tắt)
- UI gửi Bearer token; backend guard bằng `require_admin`/`require_role`.
- Upload tài liệu: UI -> `/documents/upload` -> trả file_id + pre-signed URL (hoặc upload trực tiếp), sau đó `/documents/{id}/metadata` để set label/visibility/tags.
- Chọn tài liệu cho meeting: UI -> `/meetings/{id}/documents` (POST/PUT) với danh sách doc_id; backend cập nhật mapping và lên hàng đợi index meeting-scope nếu cần.
- RAG query (admin xem/debug): UI -> `/rag/query` với scope; backend filter theo metadata + quyền.
- Audit: mỗi hành động quản trị ghi log (ai, khi nào, hành động, target_id).

#### 6) Lý do tồn tại & quyết định chính
- Hợp nhất quản trị giúp giảm sai sót phân tán (user, doc, meeting) và tạo nguồn sự thật chung cho RAG.
- Dùng RBAC sẵn có (`require_role`) để giảm thay đổi code; admin làm siêu quyền.
- Phân tách metadata doc/meeting ở Postgres và nội dung ở object storage giúp mở rộng dung lượng và giảm rủi ro lộ dữ liệu.
- Dùng pre-signed URL để phục vụ file thay vì lộ đường dẫn tĩnh; vector store giữ metadata quyền để filter kết quả RAG.
- TTL access token ngắn (60 phút) giảm rủi ro lộ token; refresh 7 ngày cho desktop tiện dụng.

#### 7) Dữ liệu & chuẩn hóa
- User: email unique, role string, `is_active`, org/dept, last_login_at.
- Document: id, name, labels (tổng/meeting), tags (Phát triển/Kinh doanh/Quản lý), visibility (global/meeting/share list), owner_id, meeting_id?, status (active/archived).
- Meeting: id, organizer_id, participants, phase, linked docs.
- Audit: actor_id, action, target_type/id, timestamp, status.

#### 8) Rủi ro & giảm thiểu
- Sai phân quyền: backend bắt buộc guard; UI chỉ hỗ trợ ẩn/hiển.
- Lộ token: HTTPS bắt buộc; TTL ngắn; cân nhắc refresh rotation/blacklist.
- Upload độc hại: giới hạn mime/size; quét virus (nếu có); lưu audit.
- RAG trả kết quả vượt quyền: filter chặt bằng metadata allowed_roles/users/meeting_id trước khi query/return.

#### 9) Rollout & vận hành
- Yêu cầu DB có các cột user (`password_hash`, `is_active`, `last_login_at`) và metadata tài liệu/meeting.
- Khi bật admin console: kiểm tra CORS, SECRET_KEY, SMTP (nếu dùng reset), quyền object storage.
- Giám sát log 401/403 và lỗi upload/index; kiểm tra định kỳ audit trail.

