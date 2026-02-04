Dưới đây là tài liệu kỹ thuật cho thực thể Project và liên quan (chưa implement).

---

## 1) Mục tiêu
- Thêm thực thể Project để gom nhóm cuộc họp, tài liệu, action items, thành viên.
- Cho phép quản lý thành viên cố định của Project; Meeting có thể gắn Project và mời thêm người ngoài.
- Chuẩn hóa metadata để lọc/phan quyền, phục vụ RAG/analytics.

## 2) Mô hình dữ liệu (đề xuất)
- `project`
  - `id` (UUID PK)
  - `name` (text, not null)
  - `code` (text, unique optional)
  - `description` (text, optional)
  - `organization_id` (UUID, FK organization)
  - `department_id` (UUID, FK department)
  - `created_at`, `updated_at`
  - (tùy chọn) `owner_id` (UUID user_account)
- `project_member`
  - `project_id` (UUID FK project)
  - `user_id` (UUID FK user_account)
  - `role` (text: owner/member/guest)
  - `joined_at`
  - PK (project_id, user_id)
- Mở rộng bảng hiện hữu:
  - `meeting`: thêm `project_id` (FK project, nullable).
  - `action_item`: thêm `project_id` (FK project, nullable; set theo meeting).
  - `document`: thêm `project_id`, `visibility` (project|meeting|private|share), `owner_id`, `tags` (text[]).

## 3) API (phác thảo)
- Project
  - `POST /api/v1/projects` (admin/PMO): body `{name, code?, description?, organization_id?, department_id?, owner_id?}`.
  - `GET /api/v1/projects` (filter org/dept/search, paging).
  - `GET /api/v1/projects/{id}`
  - `PATCH /api/v1/projects/{id}` (name/description/code).
  - `DELETE /api/v1/projects/{id}` (tùy chính sách).
- Project members
  - `GET /api/v1/projects/{id}/members`
  - `POST /api/v1/projects/{id}/members` body `{user_id, role}`
  - `DELETE /api/v1/projects/{id}/members/{user_id}`
  - (tùy chọn) `PATCH /api/v1/projects/{id}/members/{user_id}` role
- Meetings theo Project
  - `GET /api/v1/projects/{id}/meetings`
  - Khi tạo/patch meeting, nhận `project_id`.
- Documents theo Project
  - `GET /api/v1/projects/{id}/documents` (filter tags/visibility)
  - `POST /api/v1/projects/{id}/documents` (upload/metadata) → set `project_id`, `visibility=project`.
- Action items theo Project
  - `GET /api/v1/projects/{id}/action-items` (filter status/priority/owner)
  - Khi tạo action item từ meeting: service tự gán `project_id` từ meeting nếu có.

## 4) Quyền truy cập (high-level)
- Admin: full access.
- Project member: xem tài liệu/action items/meetings của project; tùy role để tạo/sửa.
- Meeting participant ngoài project: chỉ xem meeting-level docs/action items của meeting đó (nếu visibility cho phép); không thấy tài liệu project nếu không là member.
- Kiểm quyền: API filter theo (project_member OR meeting_participant) và visibility.

## 5) Schema/migration tối thiểu (SQL gợi ý)
```sql
CREATE TABLE project (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  organization_id UUID REFERENCES organization(id),
  department_id UUID REFERENCES department(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_member (
  project_id UUID REFERENCES project(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_account(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE meeting ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);
ALTER TABLE action_item ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);
ALTER TABLE document ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);
ALTER TABLE document ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'project';
ALTER TABLE document ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_account(id);
ALTER TABLE document ADD COLUMN IF NOT EXISTS tags TEXT[];
```

## 6) Service/logic chính
- Khi tạo meeting có `project_id`: validate project tồn tại; participant có thể gồm cả user ngoài project.
- Khi tạo action item cho meeting: set `project_id` = meeting.project_id (nếu có) để truy vấn theo project.
- Upload tài liệu project: set `project_id`, `visibility=project`; tài liệu meeting: set `meeting_id`, `visibility=meeting`.
- Filter API list theo project_id; action items list project dùng join meeting nếu cần.

## 7) RAG/metadata
- Embedding metadata bổ sung: `project_id`, `meeting_id`, `visibility`, `allowed_roles/users`.
- Query filter bắt buộc theo user context (project membership hoặc meeting participant).

## 8) Rủi ro & lưu ý
- Rò rỉ tài liệu cross-project: bắt buộc lọc `project_id` + visibility trên backend, không chỉ frontend.
- Đồng bộ member/project với meeting participant: không bắt buộc đồng bộ; nhưng cần đảm bảo participant ngoài project không thấy tài liệu project-level.
- Migrate dữ liệu cũ: set `project_id=NULL` cho meeting/doc/action_item hiện có.

## 9) Kế hoạch triển khai ngắn gọn
1) Tạo migration các bảng/cột mới.
2) Cập nhật service/endpoint meeting, action_item, document để gán/đọc `project_id`.
3) Thêm endpoint project + project_member.
4) Bổ sung kiểm quyền (require_member/require_admin).
5) Cập nhật frontend (admin/project detail, filters).