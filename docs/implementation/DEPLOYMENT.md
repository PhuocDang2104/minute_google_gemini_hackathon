# 🚀 MeetMate Deployment Guide (Free MVP)

## Tổng quan Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API    │────▶│   PostgreSQL    │
│   (Vercel)      │     │   (Render)       │     │   (Supabase)    │
│   or Electron   │     │   FastAPI        │     │   + pgvector    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   Gemini API     │
                        │   (Google AI)    │
                        └──────────────────┘
```

---

## 📦 Option 1: Supabase + Render (Recommended)

### Tại sao chọn combo này?
- **Supabase**: PostgreSQL miễn phí với pgvector, 500MB storage, API dashboard
- **Render**: Backend Python miễn phí, auto-deploy từ GitHub
- **Tổng chi phí: $0/tháng** cho MVP

---

### 1️⃣ Setup Database: Supabase

#### Bước 1: Tạo project Supabase
1. Đăng ký tại [supabase.com](https://supabase.com)
2. Click **New Project**
3. Điền thông tin:
   - **Name**: `meetmate-db`
   - **Database Password**: Tạo password mạnh (lưu lại!)
   - **Region**: Singapore (gần VN nhất)
4. Click **Create new project** (đợi 2-3 phút)

#### Bước 2: Enable pgvector extension
1. Vào **SQL Editor** trong Supabase Dashboard
2. Chạy:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

#### Bước 3: Import schema
1. Mở file `infra/postgres/init/02_schema.sql`
2. Copy toàn bộ nội dung vào **SQL Editor**
3. Click **Run**

#### Bước 4: Import mock data (optional)
1. Mở file `infra/postgres/init/03_seed_mock.sql`
2. Copy vào **SQL Editor** và **Run**

#### Bước 5: Lấy Connection String
1. Vào **Project Settings** → **Database**
2. Scroll xuống **Connection string** → **URI**
3. Copy và thay `[YOUR-PASSWORD]` bằng password bạn đã tạo:

```
postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

```
postgresql://postgres:Meetmate1234@db.guvhuhegitzeztuoxueb.supabase.co:5432/postgres
```
---

### 2️⃣ Deploy Backend: Render

#### Bước 1: Chuẩn bị files
Tạo các file sau trong thư mục `backend/`:

**`render.yaml`**:
```yaml
services:
  - type: web
    name: meetmate-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: SECRET_KEY
        generateValue: true
    healthCheckPath: /api/v1/health
```

**`requirements.txt`** (trong backend/):
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
email-validator==2.1.0
langchain==0.1.4
langgraph==0.0.20
httpx==0.26.0
passlib[bcrypt]==1.7.4
alembic==1.13.1
python-dotenv==1.0.0
google-generativeai==0.3.2
pgvector==0.2.4
```

#### Bước 2: Deploy trên Render
1. Đăng ký tại [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect GitHub repo: `PhuocDang2104/vnpt_ai_hackathon_meetmate`
4. Cấu hình:
   - **Name**: `meetmate-api`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   GEMINI_API_KEY=your-gemini-api-key
   SECRET_KEY=random-secret-string
   ```

6. Click **Create Web Service**

#### Bước 3: Verify
- Truy cập: `https://meetmate-api.onrender.com/api/v1/health`
- Nếu thấy `{"status": "ok"}` → Thành công!

---

### 3️⃣ Deploy Frontend

#### Option A: Web App (Vercel) - Recommended cho demo

1. Tạo web build từ Electron:

```bash
cd electron
npm run build
```

2. Deploy lên Vercel:
   - Đăng ký [vercel.com](https://vercel.com)
   - Import GitHub repo
   - Root Directory: `electron`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. Environment Variables:
   ```
   VITE_API_URL=https://meetmate-api.onrender.com
   ```

#### Option B: Electron Desktop App

1. Build cho các platform:

```bash
cd electron
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

2. File output trong `electron/dist/`
3. Chia sẻ file `.exe` / `.dmg` / `.AppImage` cho người dùng

---

## 📦 Option 2: Railway (All-in-one)

Railway cho phép deploy cả Backend + Database trong 1 platform.

### Free Tier
- **$5 credit miễn phí/tháng** (đủ cho MVP)
- PostgreSQL với pgvector
- Auto-deploy từ GitHub

### Bước 1: Setup

1. Đăng ký [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Chọn repo `vnpt_ai_hackathon_meetmate`

### Bước 2: Add PostgreSQL

1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Click vào PostgreSQL service → **Connect**
3. Chạy SQL để enable extensions:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

4. Import schema từ `02_schema.sql`

### Bước 3: Configure Backend

1. Click vào Backend service
2. Settings → **Root Directory**: `backend`
3. Variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   GEMINI_API_KEY=your-key
   ```

---

## 📦 Option 3: Neon + Fly.io

### Neon (Database)
- PostgreSQL serverless miễn phí
- 3GB storage, pgvector support
- [neon.tech](https://neon.tech)

### Fly.io (Backend)
- Free tier: 3 shared VMs
- [fly.io](https://fly.io)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
cd backend
fly launch
fly secrets set DATABASE_URL="postgres://..."
fly secrets set GEMINI_API_KEY="..."
fly deploy
```

---

## 🔧 Cấu hình Environment Variables

### Backend (.env.production)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# Security
SECRET_KEY=your-secret-key-min-32-chars
CORS_ORIGINS=https://your-frontend-domain.vercel.app

# Optional
DEBUG=false
LOG_LEVEL=INFO
```

### Frontend (.env.production)

```env
VITE_API_URL=https://meetmate-api.onrender.com
VITE_USE_API=true
```

---

## 📋 Checklist Deploy

### Pre-deploy
- [ ] Gemini API key đã setup
- [ ] Database schema đã import
- [ ] Mock data đã seed (optional)
- [ ] Environment variables đã cấu hình

### Post-deploy
- [ ] Health check endpoint hoạt động
- [ ] CORS đã cấu hình đúng domain frontend
- [ ] API endpoints hoạt động
- [ ] AI chat respond được
- [ ] Database connection stable

---

## 🆘 Troubleshooting

### Lỗi "Connection refused" database
```
Kiểm tra:
1. DATABASE_URL đúng format
2. Password không có ký tự đặc biệt cần escape
3. Supabase: Dùng Pooler connection (port 6543)
```

### Lỗi CORS
```python
# Trong app/main.py, thêm domain frontend:
origins = [
    "https://your-app.vercel.app",
    "http://localhost:5173",
]
```

### Render spin down (cold start)
- Free tier Render spin down sau 15 phút inactive
- First request mất ~30s để wake up
- Upgrade lên $7/mo để always-on

### Supabase connection limit
- Free tier: 60 concurrent connections
- Dùng connection pooling (PgBouncer đã built-in)

---

## 💰 Chi phí ước tính

| Service | Free Tier | Paid (nếu scale) |
|---------|-----------|------------------|
| Supabase | 500MB, 2 projects | $25/mo (8GB) |
| Render | 750 hours/mo | $7/mo (always-on) |
| Vercel | 100GB bandwidth | $20/mo |
| Gemini API | 60 req/min | Pay-as-you-go |
| **Total MVP** | **$0** | $52/mo |

---

## 🚀 Quick Deploy Commands

```bash
# 1. Clone và setup
git clone https://github.com/PhuocDang2104/vnpt_ai_hackathon_meetmate.git
cd vnpt_ai_hackathon_meetmate

# 2. Setup Supabase (manual via dashboard)
# - Create project
# - Run 02_schema.sql
# - Run 03_seed_mock.sql

# 3. Deploy backend to Render
# - Connect GitHub
# - Set environment variables
# - Deploy

# 4. Build frontend
cd electron
npm install
npm run build

# 5. Deploy to Vercel
npx vercel --prod
```

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **Gemini API**: https://ai.google.dev/docs
- **FastAPI Deploy**: https://fastapi.tiangolo.com/deployment/

---

*Last updated: December 2024*

