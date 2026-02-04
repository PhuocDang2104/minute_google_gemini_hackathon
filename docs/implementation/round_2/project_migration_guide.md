### Hướng dẫn migration Project/Meeting/Document/Action Item

#### 1) Nội dung migration
- Thêm bảng `project`, `project_member`.
- Thêm cột liên kết project cho meeting, action_item, document; thêm metadata tài liệu (visibility, owner_id, tags).
- File SQL: `infra/postgres/init/06_project_schema.sql`.

#### 2) Thực thi trên database cloud (Postgres)
**Cách A: psql trực tiếp**
1) Tải file lên máy có psql hoặc SSH vào host có psql.  
2) Chạy:
```bash
psql "$DATABASE_URL" -f infra/postgres/init/06_project_schema.sql
```
Trong đó `DATABASE_URL` có dạng: `postgresql://user:password@host:port/dbname`.

**Cách B: psql inline (không cần file)**
```bash
psql "$DATABASE_URL" <<'SQL'
-- dán nội dung 06_project_schema.sql ở đây
SQL
```

**Cách C: Alembic (nếu áp dụng)**
- Tạo revision mới, copy nội dung lệnh `ALTER/CREATE` vào `upgrade()`, và rollback tương ứng vào `downgrade()`.
- Chạy: `alembic upgrade head`.

#### 3) Lưu ý an toàn
- Sao lưu trước khi chạy (pg_dump).  
- Kiểm tra quyền user có thể CREATE TABLE / ALTER TABLE.  
- Chạy ngoài giờ cao điểm; các lệnh này DDL nhưng nhanh, ít lock dài.
- Nếu đang dùng dịch vụ managed (RDS/Cloud SQL): đảm bảo mở kết nối IP của bạn hoặc dùng bastion/SSH.

#### 4) Kiểm tra sau migration
- `\d project`, `\d project_member`, `\d meeting` để thấy cột `project_id`.  
- Xác minh indexes: `idx_meeting_project`, `idx_document_project`, …  
- Chạy thử insert mẫu:
```sql
INSERT INTO project (name, code) VALUES ('Demo Project', 'DEMO1');
```

#### 5) Tác động ứng dụng
- Backend cần cập nhật service/endpoint để set/get `project_id` và filter theo project.
- Tài liệu cũ sẽ có `project_id NULL`; meeting/doc/action_item cũ cần gán project nếu muốn quản trị theo project.
- Frontend cần bổ sung UI Project và bộ lọc project.

