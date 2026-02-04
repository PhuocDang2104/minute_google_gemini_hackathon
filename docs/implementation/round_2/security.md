### Thiết kế bảo mật (ứng dụng MeetMate)

#### 1) Mục tiêu
- Bảo vệ danh tính người dùng, kiểm soát truy cập tài nguyên (meeting, tài liệu, RAG).
- Hạn chế rủi ro lộ token/mật khẩu; hỗ trợ mở rộng cho audit và SSO.

#### 2) Thành phần hiện tại
- Xác thực: JWT HS256, access token TTL 60 phút, refresh token TTL 7 ngày (`backend/app/core/security.py`).
- Lưu mật khẩu: bcrypt qua Passlib.
- Roles: `admin | PMO | chair | user`; guard bằng dependency `require_role`.
- Frontend: Electron/React, lưu token localStorage; backend kiểm tra Bearer token.

#### 3) Luồng chính
- Đăng nhập: verify mật khẩu bcrypt → phát access + refresh JWT (claims: `sub`, `email`, `role`, `type`, `exp`, `iat`).
- Refresh: kiểm tra `type=refresh` + `exp` → phát cặp token mới.
- Bảo vệ API: `OAuth2PasswordBearer` đọc Bearer; `get_current_user` giải mã + kiểm tra exp/type; `require_role` chặn 403 khi thiếu quyền.

#### 4) Cấu hình & bí mật
- `settings.secret_key` phải cấp qua env ở production; không dùng mặc định.
- Cho phép đổi thuật toán lên HS512 nếu cần (đang HS256).
- CORS cấu hình qua `settings.cors_origins`; cần khóa phù hợp khi public.

#### 5) TTL & phiên
- Access: 60 phút để giảm rủi ro lộ token.
- Refresh: 7 ngày; phù hợp cho phiên dài hơn trên desktop.
- Gợi ý nâng cấp: rotation refresh + blacklist khi logout hoặc khi bị lộ.

#### 6) Quản lý người dùng
- Trường `is_active` cho phép khóa tài khoản; `last_login_at` phục vụ audit nhẹ.
- Đăng ký kiểm tra email trùng → trả 409.
- Đề xuất thêm rate-limit login và reset password qua email/PAT.

#### 7) Lưu trữ & truyền dữ liệu
- Token chỉ truyền qua HTTPS; không ghi token vào log.
- Mật khẩu không lưu plain; luôn bcrypt.
- Tài liệu/tệp: phục vụ qua URL ký (pre-signed) để tránh lộ trực tiếp.

#### 8) Kiểm soát truy cập tài liệu/RAG (định hướng)
- Metadata tài liệu: owner, labels, visibility (global/meeting/share list), allowed_roles/users.
- Bộ lọc bắt buộc ở query RAG: khớp user_id/role/meeting_id với metadata.

#### 9) Rủi ro & giảm thiểu
- Lộ secret_key → phải rotation token và thay secret; khuyến nghị quản lý bằng vault.
- Token bị đánh cắp → TTL ngắn, refresh rotation, blacklist.
- Brute-force login → thêm rate-limit + captcha (nếu mở web).
- XSS trên client → tránh chèn token vào DOM; xem xét chuyển sang storage an toàn hơn nếu lên web.

#### 10) Mở rộng đề xuất
- SSO OIDC/SAML; map claim email → user_account; fallback local.
- Audit trail chi tiết (login success/fail, đổi mật khẩu, chia sẻ tài liệu).
- Chính sách mật khẩu mạnh + kiểm tra reuse.

#### 11) Triển khai/ops
- Thiết lập env prod: `SECRET_KEY`, `CORS_ORIGINS`, `DATABASE_URL`, khóa email SMTP nếu bật reset.
- Backup và migration DB (các cột `password_hash`, `is_active`, `last_login_at`) trên server trước khi deploy.
- Giám sát log auth (401/403) để phát hiện bất thường.

