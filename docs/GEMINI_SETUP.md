# Hướng dẫn lấy Gemini API Key & Cấu hình cho Minute

Để kích hoạt tính năng AI của Minute (tạo biên bản họp, ghi chú học tập, trích xuất concepts), bạn cần có **Google Gemini API Key**.

## 1. Lấy API Key miễn phí

1.  Truy cập **Google AI Studio**: [https://aistudio.google.com/](https://aistudio.google.com/)
2.  Đăng nhập bằng tài khoản Google của bạn.
3.  Nhấn vào nút **"Get API key"** (ở góc trái hoặc trên thanh menu).
4.  Nhấn **"Create API key"**.
5.  Sao chép chuỗi ký tự API Key vừa tạo (bắt đầu bằng `AIza...`).

## 2. Cấu hình vào Project

### Cách 1: Chạy Local (Development)

Mở file `.env` hoặc tạo file `.env` tại thư mục gốc `backend/` và thêm dòng sau:

```env
GEMINI_API_KEY=AIzaSy...Paste_Key_Cua_Ban_Vao_Day
```

### Cách 2: Deploy lên Cloud (Render/Vercel)

Nếu bạn deploy lên Render:
1.  Vào Dashboard của service Backend.
2.  Chọn **Environment**.
3.  Thêm Environment Variable:
    *   **Key**: `GEMINI_API_KEY`
    *   **Value**: `AIzaSy...Paste_Key_Cua_Ban_Vao_Day`

## 3. Các Model hỗ trợ
Minute được tối ưu cho các model sau của Gemini:
*   **gemini-1.5-flash**: Nhanh, rẻ, phù hợp cho tóm tắt ngắn và chat realtime.
*   **gemini-1.5-pro**: Thông minh hơn, context rộng (1M/2M tokens), phù hợp xử lý video dài và tạo biên bản chi tiết.

Để đổi model, bạn có thể chỉnh biến môi trường (nếu backend hỗ trợ) hoặc trong config code:
```env
GEMINI_MODEL=gemini-1.5-flash
```

---
**Lưu ý:**
*   API Key này là bí mật, không chia sẻ cho người khác.
*   Google AI Studio hiện tại cung cấp Free Tier khá hào phóng cho mục đích hackathon/dev.
