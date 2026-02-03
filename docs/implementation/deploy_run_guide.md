# Hướng dẫn đóng gói & khởi chạy MeetMate (end-to-end)

Tài liệu này giúp reviewer dựng lại toàn bộ sản phẩm (Postgres + FastAPI + Electron) từ máy trống tới lúc demo UI.

## 1) Thành phần & yêu cầu
- Backend: FastAPI + LangChain, kết nối Postgres/pgvector.
- Frontend: Electron + React (Vite).
- Hạ tầng: Docker + Docker Compose (đã cấu hình build backend, seed DB).
- Yêu cầu tối thiểu: Docker 24+ & Docker Compose, Node.js 18+ + npm 9+, Python 3.11+ (nếu muốn chạy backend thuần Python), các cổng `8000` (API) và `5433` (Postgres) trống.

## 2) Chuẩn bị mã nguồn & biến môi trường
1. Clone repo và vào thư mục dự án:
   ```bash
   git clone <repo-url>
   cd vnpt_ai_hackathon_meetmate
   ```
2. Tạo file môi trường cho backend tại `infra/env/.env.local` (backend tự đọc file này khi chạy):
   ```bash
   cat > infra/env/.env.local <<'EOF'
   ENV=development
   DATABASE_URL=postgresql+psycopg2://meetmate:meetmate@postgres:5432/meetmate
   CORS_ORIGINS=*
   GEMINI_API_KEY=your_gemini_key_here    # bắt buộc để AI trả lời thật
   OPENAI_API_KEY=                        # tùy chọn (nếu dùng OpenAI/Groq)
   EOF
   ```
   - Nếu chạy backend thuần Python (không Docker), đổi host DB thành `localhost:5433`.
   - Các khóa SmartVoice/GoMeet khác có thể để trống khi demo.

## 3) Đóng gói & khởi chạy Postgres + Backend (khuyến nghị)
```bash
cd infra
GEMINI_API_KEY=your_gemini_key_here docker compose up -d --build
```
- Compose sẽ build backend (từ `backend/Dockerfile`), khởi tạo Postgres với seed dữ liệu demo (`infra/postgres/init/*.sql`), mở port API `http://localhost:8000` và DB `localhost:5433`.
- Kiểm tra nhanh:
  ```bash
  curl http://localhost:8000/api/v1/health
  # hoặc mở http://localhost:8000/docs
  ```
- Theo dõi log: `docker compose logs -f backend`.
- Dừng/dọn dẹp: `docker compose down` (thêm `-v` nếu muốn xóa dữ liệu seed và chạy lại từ đầu).

## 4) (Tùy chọn) Chạy backend thuần Python
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r ../requirements.txt
cp ../infra/env/.env.local .env.local
export PYTHONPATH=.
uvicorn app.main:app --reload --port 8000
```
- Đảm bảo Postgres đã chạy (từ bước 3) hoặc trỏ `DATABASE_URL` đến DB khác.

## 5) Đóng gói & chạy Electron (UI)
```bash
cd electron
npm ci  # hoặc npm install
```
- **Chạy dev (dùng backend local hoặc Render)**  
  Terminal 1:
  ```bash
  VITE_API_URL=http://localhost:8000 npm run dev   # Vite dev server tại 5173
  ```
  Terminal 2 (sau khi Vite chạy):
  ```bash
  npx electron .
  ```
  Electron ở chế độ dev sẽ tự load `http://localhost:5173`.
- **Build gần-production (không tạo installer):**
  ```bash
  VITE_API_URL=http://localhost:8000 npm run build  # build renderer + main vào dist/
  NODE_ENV=production npx electron .
  ```
  - Để trỏ đến backend đã deploy (ví dụ Render), set `VITE_API_URL=https://<backend-host>` trước khi build.
  - Nếu cần gói installer, thêm tool như electron-builder sau (chưa cấu hình trong repo).

## 6) Dữ liệu mẫu & đăng nhập
- DB đã seed kịch bản PMO LPBank, có sẵn meeting, dự án, transcript mẫu.
- Tất cả user seed dùng mật khẩu `demo123`. Ví dụ:
  - Head of PMO: `nguyenvana@lpbank.vn / demo123`
  - Senior PM: `tranthib@lpbank.vn / demo123`
  - CTO (admin): `phamvand@lpbank.vn / demo123`

## 7) Kiểm thử nhanh trước bàn giao
- Smoke test backend: `curl http://localhost:8000/api/v1/health`.
- Chạy bộ test backend lặp 3 vòng: `bash scripts/run_tests.sh` (không cần DB thật).

Hoàn thành các bước trên sẽ có: Postgres + FastAPI chạy ở `localhost:8000`, Electron app hiển thị UI và truy cập API, dữ liệu demo đã sẵn sàng để demo/đánh giá.
