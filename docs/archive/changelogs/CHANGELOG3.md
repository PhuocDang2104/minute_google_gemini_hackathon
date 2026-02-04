# Changelog

## [v0.3.0] - 2024-12-06

### 🚀 Backend APIs - Meeting Management Complete

Xây dựng đầy đủ backend APIs cho 3 tab: Pre-meet, In-meet, Post-meet.

#### ✨ New Features

**Action Items API** (`/api/v1/items/actions`)
- `GET /actions/{meeting_id}` - Danh sách action items
- `GET /actions/item/{item_id}` - Chi tiết action item
- `POST /actions` - Tạo action item mới
- `PUT /actions/{item_id}` - Cập nhật action item
- `POST /actions/{item_id}/confirm` - Xác nhận action item
- `DELETE /actions/{item_id}` - Xóa action item

**Decisions API** (`/api/v1/items/decisions`)
- `GET /decisions/{meeting_id}` - Danh sách decisions
- `POST /decisions` - Tạo decision mới
- `PUT /decisions/{item_id}` - Cập nhật decision
- `DELETE /decisions/{item_id}` - Xóa decision

**Risks API** (`/api/v1/items/risks`)
- `GET /risks/{meeting_id}` - Danh sách risks (sorted by severity)
- `POST /risks` - Tạo risk mới
- `PUT /risks/{item_id}` - Cập nhật risk
- `DELETE /risks/{item_id}` - Xóa risk

**Transcripts API** (`/api/v1/transcripts`)
- `GET /{meeting_id}` - Danh sách transcript chunks
- `GET /{meeting_id}/full` - Full transcript text
- `POST /{meeting_id}/chunks` - Thêm transcript chunk
- `POST /{meeting_id}/chunks/batch` - Batch upload chunks
- `GET /{meeting_id}/recap` - Get live recap
- `POST /{meeting_id}/recap/generate` - AI generate recap
- `POST /{meeting_id}/extract/actions` - AI extract actions
- `POST /{meeting_id}/extract/decisions` - AI extract decisions
- `POST /{meeting_id}/extract/risks` - AI extract risks

**Participants API** (`/api/v1/participants`)
- `GET /{meeting_id}` - Danh sách participants
- `POST /{meeting_id}` - Thêm participant
- `PUT /{meeting_id}/user/{user_id}` - Cập nhật participant
- `DELETE /{meeting_id}/user/{user_id}` - Xóa participant
- `POST /{meeting_id}/user/{user_id}/join` - Mark joined
- `POST /{meeting_id}/user/{user_id}/leave` - Mark left
- `POST /{meeting_id}/user/{user_id}/attendance` - Mark attendance

**Minutes API** (`/api/v1/minutes`)
- `GET /{meeting_id}` - Danh sách versions biên bản
- `GET /{meeting_id}/latest` - Biên bản mới nhất
- `POST /` - Tạo biên bản mới
- `PUT /{minutes_id}` - Cập nhật biên bản
- `POST /{minutes_id}/approve` - Phê duyệt biên bản
- `POST /generate` - AI generate biên bản
- `GET /{meeting_id}/distribution` - Distribution logs
- `POST /distribute` - Distribute biên bản

**Post-meeting API** (enhanced `/api/v1/post-meeting`)
- `GET /summary/{meeting_id}` - Executive summary
- `GET /minutes/{meeting_id}` - Full meeting minutes
- `POST /minutes/generate` - AI generate minutes
- `GET /actions/{meeting_id}` - Actions with stats
- `GET /decisions/{meeting_id}` - Decisions with stats
- `GET /risks/{meeting_id}` - Risks by severity
- `GET /attendance/{meeting_id}` - Attendance report
- `GET /distribution/{meeting_id}` - Distribution log

**In-meeting API** (enhanced `/api/v1/in-meeting`)
- `GET /recap/{meeting_id}` - Live recap for meeting
- `GET /actions/{meeting_id}` - Detected actions
- `GET /decisions/{meeting_id}` - Detected decisions
- `GET /risks/{meeting_id}` - Detected risks
- `GET /transcript/{meeting_id}` - Transcript chunks

#### 📁 New Files

**Schemas:**
- `backend/app/schemas/action_item.py` - ActionItem, Decision, Risk schemas
- `backend/app/schemas/transcript.py` - Transcript, LiveRecap schemas
- `backend/app/schemas/participant.py` - Participant schemas
- `backend/app/schemas/minutes.py` - MeetingMinutes, Distribution schemas

**Services:**
- `backend/app/services/action_item_service.py` - CRUD for actions, decisions, risks
- `backend/app/services/transcript_service.py` - Transcript management
- `backend/app/services/participant_service.py` - Participant management
- `backend/app/services/minutes_service.py` - Minutes generation & distribution

**Endpoints:**
- `backend/app/api/v1/endpoints/action_items.py` - Items API
- `backend/app/api/v1/endpoints/transcripts.py` - Transcripts API
- `backend/app/api/v1/endpoints/participants.py` - Participants API
- `backend/app/api/v1/endpoints/minutes.py` - Minutes API

#### 🔧 Updated Files
- `backend/app/main.py` - Register new routers
- `backend/app/services/__init__.py` - Export new services
- `backend/app/api/v1/endpoints/in_meeting.py` - Enhanced with DB integration
- `backend/app/api/v1/endpoints/post_meeting.py` - Full post-meeting features

---

## [v0.2.0] - 2024-12-06

### 🎨 Frontend 3-Tab Meeting Detail

Redesign trang quản lý cuộc họp thành 3 tabs: Pre-meet, In-meet, Post-meet.

#### ✨ Features
- **PreMeetTab**: Agenda, Documents, AI Assistant panels
- **InMeetTab**: Live Transcript, Actions, Decisions, Risks detection
- **PostMeetTab**: Executive Summary, Action Items, Decisions, Risks, Distribution Log

#### 📁 New Files
- `electron/src/renderer/features/meetings/components/tabs/PreMeetTab.tsx`
- `electron/src/renderer/features/meetings/components/tabs/InMeetTab.tsx`
- `electron/src/renderer/features/meetings/components/tabs/PostMeetTab.tsx`
- `electron/src/renderer/features/meetings/components/tabs/index.ts`

#### 🔧 Updated Files
- `electron/src/renderer/features/meetings/components/MeetingDetail.tsx`
- `electron/src/renderer/styles/global.css`

---

## [v0.1.0] - 2024-12-05

### 🚀 Initial Setup & AI Integration

- Project scaffold với FastAPI + React/Electron
- Database schema với PostgreSQL + pgvector
- Gemini AI integration cho chat & generation
- Mock data cho demo PMO use case
- Deployment setup cho Supabase + Render

#### Features
- Meeting CRUD operations
- AI Chat with Gemini API
- RAG Q&A system
- User & Department management
- Pre-meeting agenda generation
- Document suggestions

---

## API Documentation

Sau khi chạy backend, truy cập:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

