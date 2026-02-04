# Hướng Dẫn Khởi Động Môi Trường Local

## Yêu Cầu

- **Docker Desktop** (đang chạy)
- **Node.js 18+**
- **Python 3.11+** (nếu chạy backend ngoài Docker)

---

## 🚀 Khởi Động Nhanh

### Bước 1: Khởi động Database (PostgreSQL)

```bash
cd infra
docker compose up -d postgres
```

Đợi ~10 giây để database sẵn sàng.

### Bước 2: Khởi động Backend (FastAPI)

```bash
cd infra
docker compose up -d backend
```

### Bước 3: Khởi động Frontend (Vite)

```bash
cd frontend
npm install   # Chỉ cần lần đầu
npm run dev
```

---

## 🔗 Địa Chỉ Truy Cập

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8000 |
| **Swagger Docs** | http://localhost:8000/docs |
| **Database** | `localhost:5433` |

---

## 🔧 Kiểm Tra Services

```bash
# Kiểm tra database
docker ps | grep minute_db

# Kiểm tra backend
curl http://localhost:8000/
# Output: {"message":"Minute API v2 running"}

# Kiểm tra frontend
# Mở http://localhost:5173 trong browser
```

---

## ⏹️ Dừng Services

```bash
cd infra
docker compose down
```

---

## 📋 Thông tin Database

```
Host: localhost
Port: 5433
User: minute
Password: minute
Database: minute
```

**Connection URL:**
```
postgresql://minute:minute@localhost:5433/minute
```

---

## ⚠️ Lưu Ý

1. **Lần đầu chạy**: `npm install` ở folder `frontend/`
2. **GEMINI_API_KEY**: Set biến môi trường nếu cần dùng AI features
   ```bash
   export GEMINI_API_KEY=your-api-key
   ```
3. **Logs backend**: `docker logs minute_backend -f`
