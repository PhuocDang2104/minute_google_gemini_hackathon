

### 0) Bối cảnh & giả định
- Ứng dụng Electron/React gọi backend FastAPI qua REST (`/api/v1`).
- DB: Postgres; auth dùng bảng `user_account` hiện hữu, chưa có bảng token.
- Môi trường: dev có secret tạm; production phải cấp secret qua env.
- Không có thiết kế UI; chỉ đặc tả kỹ thuật và integration.

### 1) Mục tiêu & Phạm vi
- Chuẩn hóa xác thực người dùng (email/password) và quản lý phiên cho desktop app.
- RBAC đơn giản cho giai đoạn MVP, tích hợp vào các API hiện có (meeting, document, RAG).
- An toàn cơ bản (JWT, băm mật khẩu), có lộ trình nâng cao (token rotation, reset mật khẩu qua email, blacklist).
- Đặc tả backend + contract + tích hợp frontend đã có.

### 2) Bối cảnh hiện tại (tóm tắt từ code)
- Backend: FastAPI, JWT HS256, token sống 24h, refresh 7 ngày; OAuth2PasswordBearer.  
- Password: bcrypt via Passlib.  
- Bảng `user_account`: có `email`, `display_name`, `role` (user/chair/PMO/admin), liên kết org/department.  
- Auth API: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/change-password`, `/auth/logout`, `/auth/verify`.  
- Ràng buộc role: helper `require_role` với các preset `require_admin`, `require_pmo`, `require_chair`.  
- Frontend: lưu token ở `localStorage`, thêm `Authorization: Bearer` qua `apiClient`; context `AuthProvider` kiểm tra token, gọi `/auth/me`, điều hướng về `/login` nếu chưa đăng nhập.
- Lỗ hổng demo: cho phép login nếu không có `password_hash` hoặc dùng mật khẩu chung `"demo123"`.

Mã tham chiếu:
```
19:55:backend/app/models/user.py
class UserAccount(...):
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String)
    role = Column(String, default='user')  # user / chair / PMO / admin
```
```
20:85:backend/app/core/security.py
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
def create_access_token(data, expires_delta=None):
    ...
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
```
```
189:210:backend/app/services/auth_service.py
def authenticate_user(...):
    ...
    if not password_hash:
        # DEMO MODE: ... allow any password
    if password == "demo123":
        ...  # demo bypass
    if not verify_password(password, user['password_hash']):
        return None
```
```
45:100:electron/src/renderer/lib/apiClient.ts
if (!skipAuth) ... headers['Authorization'] = `Bearer ${token}`;
...
return fetch(`${API_BASE_URL}/api/v1${endpoint}`, ...)
```
```
38:70:electron/src/renderer/context/AuthContext.tsx
initAuth -> dùng token trong localStorage, gọi getCurrentUser(); logout gọi API /auth/logout và clear localStorage
```

### 3) Yêu cầu chức năng
- Đăng ký (email duy nhất, mật khẩu >=6 ký tự, display_name), có thể gán org/department nếu có.
- Đăng nhập trả về access + refresh token; lưu role và user info để guard UI.
- Làm mới token bằng refresh token hợp lệ.
- Đổi mật khẩu sau khi đăng nhập.
- Lấy thông tin người dùng hiện tại `/auth/me`.
- Logout (client xóa token; server có hook để blacklist nếu cần).
- RBAC tối thiểu: role `admin | PMO | chair | user` (khớp code hiện có), cho phép mở rộng sau.
- Bảo vệ API: dependency kiểm tra JWT + role trước khi vào handler.

### 4) Yêu cầu phi chức năng
- Bảo mật: bỏ cơ chế demo password, bắt buộc verify mật khẩu; secret key cấu hình qua env; hạn chế TTL hợp lý; log tối thiểu PII.
- Khả dụng: endpoint đơn giản, idempotent cho refresh/logout; không yêu cầu session server-side.
- Mở rộng: cho phép thêm provider SSO sau (OIDC/SAML) mà không thay đổi contract chính.
- Tuân thủ: hash bằng bcrypt, JWT chuẩn.

### 5) Kiến trúc đề xuất (logic)
- **Auth Layer (FastAPI)**
  - Token service: tạo/giải mã JWT HS256 (HS512 optional), `exp/iat/type` (access|refresh).
  - Password service: bcrypt; không còn chế độ “demo”.
  - Role guard: dependency `require_role([...])` dùng trong router khác (meetings, docs, RAG).
  - (Tuỳ chọn) Token store/blacklist: bảng `revoked_tokens` hoặc cache để hỗ trợ logout toàn cục và rotation.
- **Data Model**
  - `user_account`: thêm trường `password_hash` (đã có), `last_login_at`, `is_active` (đề xuất).
  - `role` dạng string hiện hữu; có thể chuẩn hóa sang enum/lookup bảng `roles` + bảng `user_roles` nếu cần đa role.
- **API Contract (giữ prefix `/api/v1/auth`)**
  - `POST /auth/register` -> `UserRegisterResponse`.
  - `POST /auth/login` -> `Token`; body `email`, `password`.
  - `POST /auth/refresh` -> `Token`; body `{ refresh_token }`.
  - `GET /auth/me` -> `CurrentUser`.
  - `POST /auth/change-password` -> body `current_password`, `new_password`.
  - `POST /auth/logout` -> 204/200; client xóa token; (option) server lưu blacklist.
  - `GET /auth/verify` -> `{ valid, user_id, email, role }`.
- **Frontend Integration (Electron/React)**
  - Lưu token trong `localStorage` (tạm thời); `apiClient` chèn `Authorization` header.
  - `AuthContext` quản lý `user`, `isAuthenticated`, `isLoading`; redirect `/login` khi thiếu token.
  - Đề xuất: bổ sung interceptor tự refresh khi 401 bằng refresh token, và auto-logout nếu refresh fail.
- **RBAC Mapping (hiện tại)**
  - `admin`: toàn quyền, quản lý user/org.
  - `PMO`: điều hành meeting, tài liệu meeting.
  - `chair`: chủ trì meeting, truy cập tài liệu meeting mình tổ chức.
  - `user`: tham gia meeting được mời, xem tài liệu được chia sẻ.
  - Các router khác dùng `require_admin/require_pmo/require_chair` tương ứng.

### 6) Quy trình chính (sequence tóm tắt)
- **Đăng ký**: nhận payload -> kiểm tra email tồn tại -> hash mật khẩu -> insert `user_account` (role mặc định `user`) -> trả `UserRegisterResponse`. (Hiện tại insert qua SQL text).
- **Đăng nhập**: lấy user theo email -> verify mật khẩu -> tạo access+refresh JWT chứa `sub/email/role` -> trả `Token`. Cần loại bỏ nhánh demo cho production.
- **Làm mới token**: verify refresh token (`type=refresh`, `exp`) -> load user -> phát hành cặp mới.
- **Đổi mật khẩu**: yêu cầu đăng nhập; verify mật khẩu hiện tại (nếu có) -> ghi hash mới.
- **Bảo vệ route**: middleware `oauth2_scheme` + `get_current_user` -> check role bằng `require_role`.
- **Logout**: client xóa token; lộ trình nâng cấp: add blacklist cho refresh token hoặc rotation một lần.

### 7) Điểm yếu hiện tại & hành động bắt buộc trước khi go-live
- Bỏ hoàn toàn bypass đăng nhập (“demo mode” với `demo123` hoặc user không có `password_hash`).  
- Cấu hình `secret_key` qua env trong production; không dùng mặc định.  
- Thêm `is_active` kiểm tra trước khi phát token; hỗ trợ khóa user.  
- Giới hạn TTL: access 30–60 phút; refresh 7–14 ngày.  
- Bổ sung rate-limit với login endpoint; log cảnh báo khi login thất bại.  
- (Tùy chọn) Thêm CSRF bảo vệ cho client web nếu mở rộng ngoài Electron.

### 8) Mở rộng ngắn hạn
- **Forgot/Reset Password**: phát token reset, gửi email (SMTP đã có config placeholder), TTL 15–30 phút, one-time use.
- **Token Rotation**: refresh token một lần, lưu `token_family_id`, revoke cũ khi phát mới.
- **SSO**: thêm OIDC (Azure AD/Google) flow song song, map email -> user_account, fallback local password.
- **Org/Dept Claim**: gắn `organization_id/department_id` vào token để filter tài nguyên đa tenant.

### 9) Bảo mật & Tuân thủ
- Băm bcrypt với salt nội tại; không ghi plain.  
- JWT HS256/HS512 với secret đủ dài; clock skew ±1-2 phút.  
- Không log mật khẩu/refresh token; chỉ log user_id/email khi cần audit.  
- Pre-signed URL khi phục vụ file (tài liệu) để tránh lộ bucket key (liên quan tới authorization tài liệu).  
- Kiểm tra quyền ở backend trước khi truy vấn dữ liệu/vector store.

### 10) Kiểm thử
- Unit: hash/verify, tạo/giải mã token, guard role.  
- Integration: đăng ký + đăng nhập + me + refresh + change-password; 401/403 cases.  
- Frontend E2E: login flow, redirect guard, refresh khi 401, logout xóa token.

### 11) Open Questions
- Có cần đa role/user-group không hay giữ single role string?  
- Chính sách TTL và rotation do ai quyết (bảo mật hay product)?  
- Có triển khai blacklist/allowlist token ngay hay sau MVP?  
- Kênh email/SMS cho reset password đã sẵn sàng chưa?

### 12) Lý do thiết kế chính
- JWT stateless giảm phụ thuộc session store, phù hợp Electron offline tạm thời.
- Bcrypt là chuẩn an toàn và đã có trong code, tránh lệ thuộc custom crypto.
- RBAC vai trò đơn giản khớp với logic hiện hữu (`require_role`), dễ mở rộng sang ACL khi cần.
- Phân tách access/refresh cho phép TTL ngắn cho access, hạn chế rủi ro lộ token.
- Token prefix `/api/v1/auth` giữ tương thích API đã dùng ở frontend.

### 13) Lộ trình triển khai (ưu tiên)
1) Xóa bypass demo, bắt buộc verify mật khẩu; cập nhật secret từ env production.
2) Thêm trường `is_active`, `last_login_at`; chặn login nếu `is_active = false`.
3) Điều chỉnh TTL: access 30–60 phút; refresh 7–14 ngày; log failed login + rate-limit.
4) Bổ sung refresh-interceptor ở frontend; auto-logout khi refresh fail.
5) (Tùy chọn) Thêm reset password qua email + token one-time.
6) (Tùy chọn) Token rotation + blacklist refresh.
7) (Tùy chọn) SSO OIDC; map email -> user_account, fallback local.

### 14) Hướng dẫn cập nhật DB trên server (khi DB deploy bên ngoài)
- Sao lưu trước khi thay đổi (pg_dump).
- Thực thi các lệnh SQL sau (nếu chưa có cột):
  ```
  ALTER TABLE user_account ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE user_account ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  ALTER TABLE user_account ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ```
- Kiểm tra dữ liệu: đặt `is_active = TRUE` cho user hợp lệ; đặt password_hash cho tài khoản cần dùng (qua flow reset/đặt mật khẩu).
- Không cần downtime dài; chạy ngoài giờ cao điểm. Sau khi chạy, deploy backend mới để code sử dụng trường mới.
- Nếu dùng Alembic: tạo revision tương ứng và apply trên server thay vì chạy file init.

Nếu cần thêm: sequence detail, cấu trúc JWT, migration SQL, và flow refresh/rotation.