# Hướng dẫn Quản lý Database Migration (Alembic)

Tài liệu này hướng dẫn cách thay đổi cấu trúc Database (thêm bảng, sửa cột, thêm cột...) một cách an toàn và đồng bộ code bằng **Alembic**.

## 1. Quy trình 3 bước chuẩn

Mỗi khi bạn muốn thay đổi Database, hãy tuân thủ 3 bước sau:

### Bước 1: Sửa Python Model
Mở file model tương ứng trong `backend/app/models/` và thực hiện thay đổi.

**Ví dụ:** Thêm cột `phone_number` vào bảng `UserAccount`.
Mở `backend/app/models/user.py`:
```python
class UserAccount(Base):
    # ... các cột cũ ...
    phone_number = Column(String, nullable=True)  # <--- Thêm dòng này
```

### Bước 2: Sinh file Migration (Auto-generate)
Chạy lệnh sau để Alembic tự động so sánh code Python hiện tại và Database thực tế để sinh ra file script thay đổi.

**Lưu ý:** Cần đứng ở thư mục gốc của dự án hoặc thư mục `backend`. Nếu chạy từ root:

```bash
cd backend
# Cần set PYTHONPATH để Alembic tìm thấy module app
export PYTHONPATH=. 
alembic revision --autogenerate -m "Add phone number to user table"
```

*   `-m "..."`: Mô tả ngắn gọn về thay đổi.
*   Sau khi chạy, một file mới sẽ xuất hiện trong `backend/alembic/versions/`, ví dụ: `1a2b3c4d5e6f_add_phone_number_to_user_table.py`.
*   **QUAN TRỌNG:** Hãy mở file này lên kiểm tra xem nó có sinh đúng ý bạn không (trong hàm `upgrade()` và `downgrade()`).

### Bước 3: Apply thay đổi vào Database
Chạy lệnh sau để thực thi file migration vừa tạo lên Database (Update DB).

```bash
alembic upgrade head
```
*   `head`: Có nghĩa là update đến version mới nhất.

---

## 2. Các lệnh thường dùng khác

| Mục đích | Lệnh (trong thư mục backend) |
| :--- | :--- |
| **Xem lịch sử migration** | `alembic history` |
| **Xem version hiện tại của DB** | `alembic current` |
| **Rollback 1 bước (Undo)** | `alembic downgrade -1` |
| **Rollback về gốc (Xóa hết bảng)**| `alembic downgrade base` |
| **Apply data mẫu (Seed)** | `python3 seed_demo.py` |

---

## 3. Cấu hình Môi trường (Troubleshooting)

### Lỗi: `ImportError` hoặc `ModuleNotFoundError`
Nguyên nhân: Python không tìm thấy module `app`.
**Khắc phục:** Luôn đảm bảo `PYTHONPATH` trỏ tới thư mục chứa code backend.
```bash
export PYTHONPATH=.
```

### Lỗi: `Target database is not up to date`
Nguyên nhân: Database thực tế đang ở version cũ hơn so với code migration hiện có (có thể do bạn pull code mới về mà chưa chạy upgrade).
**Khắc phục:** Chạy `alembic upgrade head` để đồng bộ.

### Lỗi kết nối Database sai
Alembic sẽ đọc biến môi trường `DATABASE_URL` từ file `.env` hoặc `.env.local` theo thứ tự ưu tiên.
*   Kiểm tra file `backend/.env.local` xem đúng DB chưa.
*   Nếu dùng Cloud DB (Aiven/Supabase), đảm bảo URL bắt đầu bằng `postgresql://` (không phải `postgres://`).

---

## 4. Ví dụ Full Flow: Thêm bảng mới `Feedback`

1.  **Tạo Model**: Tạo file `backend/app/models/feedback.py`
    ```python
    from sqlalchemy import Column, String, Text
    from app.models.base import Base, UUIDMixin, TimestampMixin

    class Feedback(Base, UUIDMixin, TimestampMixin):
        __tablename__ = "feedback"
        content = Column(Text, nullable=False)
        user_email = Column(String)
    ```

2.  **Đăng ký Model**: Import model mới vào `backend/app/models/__init__.py` để Alembic nhận diện.
    ```python
    # ...
    from .feedback import Feedback
    
    __all__ = [..., 'Feedback']
    ```

3.  **Sinh Migration**:
    ```bash
    cd backend
    export PYTHONPATH=.
    alembic revision --autogenerate -m "Add feedback table"
    ```

4.  **Apply**:
    ```bash
    alembic upgrade head
    ```

Vậy là xong! Table `feedback` đã được tạo trong Database.
