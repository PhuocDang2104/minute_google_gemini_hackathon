# Hướng dẫn Deploy Ứng dụng Minute

Tài liệu này hướng dẫn chi tiết cách triển khai (deploy) ứng dụng Minute lên các nền tảng cloud miễn phí/phổ biến: **Aiven** (Database), **Render** (Backend), và **Vercel** (Frontend).

---

## 1. Database: Aiven (PostgreSQL)

Chúng ta sử dụng Aiven để tạo cơ sở dữ liệu PostgreSQL.

1.  **Đăng ký/Đăng nhập:** Truy cập [Aiven Console](https://console.aiven.io/) và tạo tài khoản.
2.  **Tạo Service mới:**
    *   Bấm **Create service**.
    *   Chọn **PostgreSQL**.
    *   Chọn **Cloud Provider** (ví dụ: Google Cloud) và **Region** (khuyên dùng Singapore `asia-southeast1` để có độ trễ thấp về Việt Nam).
    *   Chọn gói **Free Plan** (nếu có) hoặc gói thấp nhất để bắt đầu.
    *   Đặt tên service (ví dụ: `minute-db`) và bấm **Create Service**.
3.  **Lấy thông tin kết nối:**
    *   Sau khi service chạy (Status: Operating), tìm mục **Connection information**.
    *   Copy **Service URI** (dạng `postgres://user:password@host:port/defaultdb...`). Đây chính là `DATABASE_URL` sẽ dùng sau này.
4.  **Cài đặt Extension (Quan trọng cho RAG):**
    *   Vào tab **Connect** hoặc dùng tool quản lý DB (như DBeaver/pgAdmin) kết nối vào DB.
    *   Chạy câu lệnh SQL sau để bật extension vector:
        ```sql
        CREATE EXTENSION IF NOT EXISTS vector;
        ```
    *   *Lưu ý: Aiven mặc định hỗ trợ pgvector trên các phiên bản Postgres mới (15+).*

---

## 2. Backend: Render (Python FastAPI)

Chúng ta triển khai Backend API lên Render.

1.  **Đăng ký/Đăng nhập:** Truy cập [Render Dashboard](https://dashboard.render.com/).
2.  **Tạo Web Service:**
    *   Bấm **New +** -> **Web Service**.
    *   Chọn **Build and deploy from a Git repository**.
    *   Kết nối với GitHub repository của bạn (`minute_google_gemini_hackathon`).
3.  **Cấu hình Service:**
    *   **Name:** `minute-api` (hoặc tên tùy thích).
    *   **Region:** Singapore (để gần Database và người dùng).
    *   **Root Directory:** `backend` (Rất quan trọng, vì code backend nằm trong thư mục này).
    *   **Runtime:** Python 3.
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
    *   **Instance Type:** Free.
4.  **Cấu hình Environment Variables:**
    *   Kéo xuống mục **Environment Variables** và bấm **Add Environment Variable**.
    *   Thêm các biến sau:
        *   `DATABASE_URL`: (Paste Service URI từ bước Aiven)
        *   `GEMINI_API_KEY`: (API Key Gemini của bạn)
        *   `SECRET_KEY`: (Tự tạo một chuỗi ngẫu nhiên bảo mật)
        *   `CORS_ORIGINS`: `*` (hoặc domain frontend sau khi có, ví dụ: `https://minute-app.vercel.app`)
        *   `PYTHON_VERSION`: `3.10.0` (khuyên dùng để ổn định tương thích).
5.  **Deploy:**
    *   Bấm **Create Web Service**.
    *   Chờ quá trình build và deploy hoàn tất. Nếu thành công, bạn sẽ thấy trạng thái **Live** và URL của backend (ví dụ: `https://minute-api.onrender.com`).

---

## 3. Frontend: Vercel (React/Vite)

Cuối cùng, triển khai Frontend lên Vercel.

1.  **Đăng ký/Đăng nhập:** Truy cập [Vercel Dashboard](https://vercel.com/).
2.  **Tạo Project mới:**
    *   Bấm **Add New...** -> **Project**.
    *   Import Git Repository của bạn.
3.  **Cấu hình Project:**
    *   **Project Name:** `minute-app`.
    *   **Framework Preset:** Vite (Vercel thường tự nhận diện).
    *   **Root Directory:** Bấm **Edit** và chọn thư mục `frontend`.
4.  **Build & Output Settings:**
    *   Giữ nguyên mặc định (Build Command: `npm run build`, Output Directory: `dist`).
5.  **Environment Variables:**
    *   Mở rộng mục **Environment Variables**.
    *   Thêm biến:
        *   `VITE_API_URL`: (Paste URL backend từ Render, ví dụ `https://minute-api.onrender.com`). **Lưu ý: Không có dấu `/` ở cuối.**
6.  **Deploy:**
    *   Bấm **Deploy**.
    *   Vercel sẽ build và deploy. Sau khoảng 1-2 phút, bạn sẽ nhận được domain (ví dụ: `https://minute-app.vercel.app`) và có thể truy cập ứng dụng ngay lập tức.

---

## 4. Kiểm tra sau khi Deploy

1.  Truy cập URL Frontend (trên Vercel).
2.  Thử đăng nhập/đăng ký (nếu có tính năng này) hoặc tạo một cuộc họp thử.
3.  Nếu gặp lỗi kết nối API, hãy kiểm tra lại:
    *   Biến `VITE_API_URL` ở Vercel đã đúng chưa?
    *   Biến `CORS_ORIGINS` ở Render đã cho phép domain Vercel chưa?
    *   Xem log ở tab **Logs** trên Render Dashboard để debug lỗi Backend.
