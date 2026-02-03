# MeetMate - Changelog & Development Notes

## Session: 05/12/2024

### 🎯 Tổng quan thay đổi

Phiên làm việc này tập trung vào:
1. Xây dựng Backend API cho Meeting Management
2. Thiết kế Frontend UI với Design System
3. Tích hợp Gemini AI cho Chat & RAG
4. Kết nối Database PostgreSQL

---

## 📦 1. Backend Updates

### 1.1 Database Configuration (`backend/app/core/config.py`)

```python
# Thay đổi chính:
- Database port: 5432 → 5433 (match docker-compose)
- Thêm Gemini API configuration
- Model: gemini-2.5-flash-preview-05-20
```

**Cấu hình hiện tại:**
```python
database_url: str = 'postgresql+psycopg2://meetmate:meetmate@localhost:5433/meetmate'
gemini_api_key: str = ''  # Set via env var GEMINI_API_KEY
gemini_model: str = 'gemini-2.5-flash-preview-05-20'
```

### 1.2 Meeting API (`backend/app/api/v1/endpoints/meetings.py`)

**Endpoints mới:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/meetings/` | List meetings với filters |
| POST | `/meetings/` | Tạo meeting mới |
| GET | `/meetings/{id}` | Chi tiết meeting + participants |
| PUT | `/meetings/{id}` | Cập nhật meeting |
| DELETE | `/meetings/{id}` | Xóa meeting |
| PATCH | `/meetings/{id}/phase` | Đổi phase (pre/in/post) |
| POST | `/meetings/{id}/participants` | Thêm participant |

**Schema (`backend/app/schemas/meeting.py`):**
```python
class MeetingCreate(MeetingBase):
    organizer_id: Optional[str] = None
    participant_ids: Optional[List[str]] = []

class MeetingWithParticipants(Meeting):
    participants: List[Participant] = []
```

### 1.3 Users API (`backend/app/api/v1/endpoints/users.py`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/users/` | List users với search |
| GET | `/users/me` | Current user |
| GET | `/users/departments` | List departments |
| GET | `/users/{id}` | User by ID |

### 1.4 AI/Chat API (`backend/app/api/v1/endpoints/chat_http.py`)

**Endpoints:**

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/chat/status` | Kiểm tra AI status |
| POST | `/chat/message` | Gửi tin nhắn đến AI |
| GET | `/chat/sessions` | List chat sessions |
| POST | `/chat/generate/agenda` | AI tạo agenda |
| POST | `/chat/extract/items` | Trích xuất actions/decisions/risks |
| POST | `/chat/generate/summary` | Tạo tóm tắt cuộc họp |

### 1.5 RAG API (`backend/app/api/v1/endpoints/rag.py`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/rag/query` | Hỏi đáp với knowledge base |
| GET | `/rag/history/{meeting_id}` | Lịch sử Q&A |
| GET | `/rag/knowledge-base` | Info về KB |

### 1.6 Pre-Meeting API (`backend/app/api/v1/endpoints/pre_meeting.py`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/pre-meeting/agenda/generate` | AI tạo agenda |
| POST | `/pre-meeting/agenda/{id}/save` | Lưu agenda |
| POST | `/pre-meeting/documents/suggest` | AI gợi ý tài liệu |
| GET | `/pre-meeting/suggestions/{id}` | Lấy suggestions |

### 1.7 Gemini AI Client (`backend/app/llm/gemini_client.py`)

**Classes:**
- `GeminiChat` - Chat session manager
- `MeetingAIAssistant` - AI assistant với meeting context

**Methods:**
```python
async def chat(message: str, context: str = None) -> str
async def generate_agenda(meeting_type: str) -> str
async def extract_action_items(transcript: str) -> str
async def extract_decisions(transcript: str) -> str
async def extract_risks(transcript: str) -> str
async def generate_summary(transcript: str) -> str
```

---

## 🎨 2. Frontend Updates

### 2.1 Design System (`electron/src/renderer/styles/global.css`)

**Palette:**
```css
--bg-base: #0a0a0a;
--bg-surface: #171717;
--bg-elevated: #262626;
--text-primary: #e5e5e5;
--text-secondary: #a3a3a3;
--accent: #eab308;  /* Yellow-500 */
--border: #404040;
```

**Typography:**
- Heading: Montserrat Alternates (600)
- Body: Be Vietnam Pro (400, 500)

**Components mới:**
- Modal
- FormField, Input, Textarea, Select
- Meeting cards, Participant cards
- AI Chat interface
- Document suggestions

### 2.2 Meeting Detail Page

**File:** `electron/src/renderer/features/meetings/components/MeetingDetail.tsx`

**5 Tabs:**
1. **Tổng quan** - Stats, info, activity
2. **Thành viên** - Quản lý participants
3. **Chương trình** - AI generate agenda
4. **Tài liệu** - AI gợi ý pre-read docs
5. **AI Assistant** - RAG Q&A chat

### 2.3 Components Structure

```
electron/src/renderer/
├── features/
│   └── meetings/
│       ├── components/
│       │   ├── MeetingDetail.tsx
│       │   ├── CreateMeetingForm.tsx
│       │   ├── ParticipantsPanel.tsx
│       │   ├── AgendaPanel.tsx
│       │   ├── DocumentsPanel.tsx
│       │   └── AIAssistantPanel.tsx
│       └── index.ts
├── components/
│   └── ui/
│       ├── Modal.tsx
│       ├── FormField.tsx
│       └── index.ts
├── lib/
│   ├── apiClient.ts
│   └── api/
│       ├── meetings.ts
│       ├── users.ts
│       ├── ai.ts
│       └── index.ts
└── shared/
    └── dto/
        ├── meeting.ts
        ├── user.ts
        └── ai.ts
```

### 2.4 Router Updates (`electron/src/renderer/app/router/index.tsx`)

**Routes mới:**
```typescript
{ path: 'meetings/:meetingId/detail', element: <MeetingDetail /> }
{ path: 'live/:meetingId', element: <LiveMeeting /> }
```

---

## 🤖 3. AI Integration

### 3.1 Gemini Configuration

**Model:** `gemini-2.5-flash-preview-05-20`

**Setup:**
```bash
# 1. Set environment variable
export GEMINI_API_KEY="your_api_key"

# 2. Hoặc tạo file .env.local
# infra/env/.env.local
GEMINI_API_KEY=your_api_key
```

### 3.2 System Prompt

AI được cấu hình với context PMO/Banking:
- Hỗ trợ Pre/In/Post meeting
- Kiến thức về NHNN regulations
- Tích hợp với Jira/Planner
- Trả lời tiếng Việt

### 3.3 Knowledge Base

Built-in knowledge về:
- Thông tư 09/2020/TT-NHNN
- LPBank Security Policy v3.0
- Dự án: Core Banking, Mobile Banking, LOS, KYC

---

## 🛠️ 4. Setup Instructions

### 4.1 Database

```bash
# Start PostgreSQL
cd infra
docker compose up -d

# Check status
docker compose ps
```

### 4.2 Backend

```bash
cd backend

# Create venv
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install google-generativeai pydantic-settings psycopg2-binary

# Set API key
export GEMINI_API_KEY="your_key"

# Run
python -m uvicorn app.main:app --reload --port 8000
```

### 4.3 Frontend

```bash
cd electron

# Install
npm install

# Run
npm run dev
```

### 4.4 Test APIs

```bash
# Health check
curl http://localhost:8000/api/v1/health/

# AI Status
curl http://localhost:8000/api/v1/chat/status

# Chat with AI
curl -X POST http://localhost:8000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Xin chào!"}'

# List meetings
curl http://localhost:8000/api/v1/meetings/

# Create meeting
curl -X POST http://localhost:8000/api/v1/meetings/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting", "meeting_type": "weekly_status"}'
```

---

## 📁 5. Files Changed

### Backend
```
backend/app/
├── core/
│   └── config.py                    # Updated - Gemini config
├── api/v1/endpoints/
│   ├── meetings.py                  # Updated - Full CRUD
│   ├── users.py                     # Updated - List/search
│   ├── chat_http.py                 # Updated - AI chat
│   ├── rag.py                       # Updated - RAG Q&A
│   └── pre_meeting.py               # Updated - AI suggestions
├── schemas/
│   ├── meeting.py                   # Updated - Full schemas
│   ├── user.py                      # New
│   ├── chat.py                      # New
│   └── ai.py                        # New
├── services/
│   ├── meeting_service.py           # Updated - DB operations
│   ├── user_service.py              # Updated
│   └── ai_service.py                # New - Mock AI
├── llm/
│   └── gemini_client.py             # New - Gemini integration
└── db/
    └── session.py                   # New - DB session
```

### Frontend
```
electron/src/renderer/
├── features/meetings/components/
│   ├── MeetingDetail.tsx            # New
│   ├── CreateMeetingForm.tsx        # New
│   ├── ParticipantsPanel.tsx        # New
│   ├── AgendaPanel.tsx              # New
│   ├── DocumentsPanel.tsx           # New
│   └── AIAssistantPanel.tsx         # New
├── components/ui/
│   ├── Modal.tsx                    # New
│   └── FormField.tsx                # New
├── lib/
│   ├── apiClient.ts                 # Updated
│   └── api/
│       ├── meetings.ts              # New
│       ├── users.ts                 # New
│       └── ai.ts                    # New
├── shared/dto/
│   ├── meeting.ts                   # New
│   ├── user.ts                      # New
│   └── ai.ts                        # New
├── styles/
│   └── global.css                   # Updated - New components
└── app/
    ├── router/index.tsx             # Updated - New routes
    └── routes/Meetings/index.tsx    # Updated - API integration
```

---

## 🔜 Next Steps

1. **WebSocket** cho real-time transcript
2. **Vector DB** với pgvector cho RAG
3. **Authentication** với OAuth/Teams
4. **File Upload** cho documents
5. **Export** Minutes to PDF/Word

---

*Last updated: 05/12/2024*

