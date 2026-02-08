# MeetMate - Agentic S/CRAG AI Meeting Co-Host for BFSI (VNPT AI Hackathon 2025 | Track 1)

**Desktop app/web + Meetings (VNPT GoMeet | Google Meet) add-in concept | VNPT AI API | S/CRAG | Tool-Calling**

MeetMate chuẩn hóa vòng đời cuộc họp cho doanh nghiệp BFSI/LPBank: thu thập ngữ cảnh trước họp, hỗ trợ realtime trong họp, và phát hành biên bản + action items sau họp - tất cả có trích dẫn, audit và kiểm soát quyền truy cập.

<p align="center">
  <img src="https://img.shields.io/badge/Desktop-Electron%20%2B%20Vite%20%2B%20React-1f6feb" alt="Desktop">
  <img src="https://img.shields.io/badge/Backend-Weebsocket%20%2B%20FastAPI%20%2B%20Postgres-2da44e" alt="Backend">
  <img src="https://img.shields.io/badge/AI-LangGraph%20%2B%20RAG%20%2B%20Tool--Calling-f97316" alt="AI">
  <img src="https://img.shields.io/badge/VNPT-SmartVoice%20%7C%20SmartBot%20%7C%20SmartReader%20%7C%20SmartUX-0ea5e9" alt="VNPT">
</p>

## Mục lục
- **Product**: [Overview](#overview) · [Problem Summary](#problem-summary) · [Solution Overview (Pre/In/Post)](#solution-overview-preinpost) · [Product Goals & Target Users](#product-goals--target-users)
- **Architecture**: [SAAR AI Architecture](#saar-ai-architecture) · [System Architecture (4 Layers)](#system-architecture-4-layers) · [AI Components (VNPT Platform)](#ai-components-vnpt-platform) · [Architecture Diagrams](#architecture-diagrams)
- **Build & Ops**: [Key Capabilities](#key-capabilities) · [Tech Stack](#tech-stack) · [Repository Structure](#repository-structure) · [Quickstart (1 command)](#quickstart-1-command) · [Development](#development) · [Configuration](#configuration) · [API & Realtime](#api--realtime) · [Data Model](#data-model) · [RAG & Knowledge Hub](#rag--knowledge-hub) · [Security & Compliance](#security--compliance) · [Observability & KPIs](#observability--kpis) · [Deployment](#deployment) · [Test Automation Guide](#test-automation-guide)
- **Project**: [Roadmap](#roadmap) · [Docs](#docs) · [Development Team](#development-team) · [Mentor Acknowledgements](#mentor-acknowledgements) · [Contributing](#contributing)

## Overview
- Stage-aware assistant: Pre -> In -> Post meeting với router LangGraph.
- Realtime pipeline: audio WS -> SmartVoice STT -> session bus -> live transcript/recap/ADR trên UI.
- RAG permission-aware: pgvector + metadata filter, "no-source-no-answer".
- Tool-calling: gợi ý tạo task/đặt lịch/tài liệu với human-in-the-loop.
- Audit-ready: structured outputs, citations, log và replay theo `meeting_id`.

## Problem Summary
- Biên bản họp ghi thủ công, phát hành chậm; sai/thiếu ý chính, khó tổng hợp action items.
- Người họp phải vừa lắng nghe vừa ghi chép -> mất tập trung, bỏ sót quyết định.
- Tài liệu rải rác (LOffice, SharePoint/OneDrive, email, wiki) -> khó tra nhanh khi đang họp.
- Sau họp khó theo dõi công việc: ai làm gì, deadline khi nào; cập nhật tiến độ rời rạc.
- Yêu cầu bảo mật và kiểm toán trong môi trường BFSI (LPBank) rất nghiêm ngặt.

## Solution Overview (Pre/In/Post)
| Stage | Mục tiêu | Đầu ra chính | Hệ thống liên quan |
| --- | --- | --- | --- |
| Pre-Meeting | Chuẩn bị agenda và pre-read theo ngữ cảnh | Agenda + pre-read pack + câu hỏi trước họp | RAG, Calendar, Docs |
| In-Meeting | Hỗ trợ realtime | Live transcript, live recap, ADR (Actions/Decisions/Risks), tool suggestions | SmartVoice STT, WS, LangGraph |
| Post-Meeting | Tổng kết và theo dõi | Executive summary, MoM, highlights, sync tasks | LLM strong + RAG long-context |

## Product Goals & Target Users
- Product-ready: MeetMate đã vượt mức MVP, hướng tới sản phẩm hoàn thiện với Pre/In/Post end-to-end, realtime co-host, RAG có trích dẫn, và workflow/action sync.
- Mở rộng: phân tích xu hướng họp theo dự án/đơn vị, trợ lý đa kênh (meetings/desktop/web/room), organizational memory, và compliance archive.
- Đối tượng: doanh nghiệp lớn/BFSI, enterprise PMO, khối công nghệ, vận hành, pháp chế, rủi ro, kinh doanh, và các đơn vị cần audit/tuân thủ cao.

## SAAR AI Architecture
SAAR (Self-aware Adaptive Agentic RAG) là xương sống AI của MeetMate:
- Stage-aware routing: 1 entry graph, điều phối Pre/In/Post theo stage, sensitivity, SLA.
- Shared `MeetingState`: giữ agenda/transcript/ADR/RAG hits nhất quán xuyên suốt.
- RAG-first + graded retrieval: hybrid search, ACL filter, no-source-no-answer.
- Self-reflect/corrective loop: kiểm định và bổ sung context trước khi trả lời.
- Tool-calling là output hạng nhất: schema-based, idempotent, có UI confirm và audit log.

![AI Architecture SAAR](docs/assets/saar-architecture.png)


### Stage-aware Router Policy (recommended)
| Stage | SLA | Model Profile | Tools | Notes |
| --- | --- | --- | --- | --- |
| Pre-Meeting | Near-realtime/BATCH | Strong (long-context) | calendar, rag_search, send_pre_read | History-aware RAG, citations bắt buộc |
| In-Meeting | Realtime | Fast streaming | create_task, schedule, attach_doc, poll_vote | Tick every 30s, rolling 60s window |
| Post-Meeting | Batch | Strong (long-context) | generate_minutes, sync_task, render_highlights | Map-reduce, compliance archive |

## System Architecture (5 Layers)
- Client Layer: Electron desktop, Teams add-in/bot, overlay Live Notes/Ask AI.
- Communication Layer: WebSocket/gRPC cho audio -> ASR; REST cho RAG/summary/task; event bus.
- Backend Core & Data: meeting ingest, transcription, realtime agent, RAG service, minutes/action service, archive.
- AI/ML Layer: ASR (SmartVoice/Whisper), diarization, LLM serving, LangGraph orchestration.
- Cloud, Deployment & Security

![System Architecture Layers](docs/assets/system-architecture-4-layers.png)

## AI Components (VNPT Platform)
- SmartVoice: streaming STT (vi/en), diarization hooks.
- SmartBot (intent + LLM): intent routing, recap, ADR extraction, tool-calling.
- SmartReader: OCR + text extraction, ingest vào Knowledge Hub.
- SmartUX: Collect end-users' UX Metric for frontend / UX improvements.
- Optional: sentiment/insights, voice verification, vnSocial (marketing use case).

## Architecture Diagrams

### System Architecture
![System Architecture](docs/assets/architecture.png)


### Cloud, Deployment & Security Layer
![Deployment Architecture](docs/assets/deployment.png)


## Key Capabilities
- Realtime WS flow: `POST /api/v1/sessions` -> `WS /api/v1/ws/audio` -> `WS /api/v1/ws/frontend`.
- SmartVoice streaming STT (gRPC) với diarization hooks; fallback WS ingest cho dev/test.
- Live recap + topic segmentation + ADR extraction (actions/decisions/risks).
- Knowledge Hub: upload -> chunk -> embed -> pgvector search -> grounded Q&A.
- Tool suggestions: create task/schedule/attach docs; executor + audit layer.
- Compliance-ready: citations, PII masking plan, retention và audit trails.

## Tech Stack
- Client: Electron + Vite + React + TypeScript.
- Backend: FastAPI, Uvicorn, SQLAlchemy, Pydantic, WebSocket.
- AI: LangChain + LangGraph, Gemini client, SmartBot intent stubs, WhisperX (test).
- RAG: pgvector, Jina Embeddings API (optional), metadata filters.
- Infra: Docker Compose (backend + Postgres), seeded SQL init.

## Repository Structure
```
vnpt_ai_hackathon/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/         # REST: meetings, transcripts, knowledge, minutes...
│   │   │       └── websocket/         # realtime WS handlers
│   │   ├── core/                      # settings, security, logging
│   │   ├── llm/                       # LangGraph router, chains, prompts, tools
│   │   ├── services/                  # business logic + realtime pipeline
│   │   ├── vectorstore/               # pgvector + LightRAG retrieval
│   │   ├── models/                    # SQLAlchemy models
│   │   ├── schemas/                   # Pydantic schemas
│   │   └── workers/                   # background tasks
│   ├── alembic/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── electron/
│   ├── src/
│   │   ├── main/                      # Electron main process
│   │   ├── preload/                   # contextBridge
│   │   └── renderer/
│   │       ├── app/                   # routes + layouts
│   │       ├── features/              # domain features (pre/in/post, knowledge)
│   │       ├── components/            # shared UI
│   │       ├── services/              # API clients
│   │       └── store/                 # state
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── infra/
│   ├── docker-compose.yml             # Postgres + backend containers
│   ├── env/                           # env templates
│   └── postgres/init/                 # init SQL + seeds
├── docs/
│   ├── CHANGELOG.md
│   ├── CHANGELOG_history/
│   ├── DEPLOYMENT.md
│   ├── in_meeting_flow.md
│   ├── real_time_transcript.md
│   ├── transcript_ingest_api.md
│   ├── rag_architecture.md
│   ├── MeetMate _ SAAR – Self-aware Adaptive Agentic RAG.md
│   ├── AI architecture/
│   └── round_2/
├── Techni_docs_2/                     # security, test plan, UX metrics
├── scripts/
│   ├── dev_start.sh
│   ├── migrate.sh
│   ├── seed_data.py
│   └── setup_local.sh
├── .gitignore
├── requirements.txt
├── CHANGELOG_20251208.md
└── README.md
```

## Quickstart (1 command)
### Docker (backend + DB, recommended)
Prerequisites: Docker 24+, Docker Compose, ports `8000` (API) và `5433` (Postgres) trống.

```bash
cd infra
docker compose up -d --build
```
- API: `http://localhost:8000`
- DB: `localhost:5433` (user/pass/db: `meetmate`)
- Init SQL: `infra/postgres/init/01_init_extensions.sql`, `02_schema.sql`, `03_seed_mock.sql`

Quick checks:
```bash
curl http://localhost:8000/api/v1/health
# or open http://localhost:8000/docs
```
Logs:
```bash
docker compose logs -f backend
```
Stop/cleanup:
```bash
cd infra && docker compose down
```

### Frontend (Electron)
```powershell
cd electron
npm install
npm run dev
```

## Development
### End-to-end (reviewer quick setup)
1) Tạo env cho backend tại `infra/env/.env.local`:
```bash
cat > infra/env/.env.local <<'EOF'
ENV=development
DATABASE_URL=postgresql+psycopg2://meetmate:meetmate@postgres:5432/meetmate
CORS_ORIGINS=*
OPENAI_API_KEY=
EOF
```
Nếu chạy backend thuần Python (không Docker), đổi host DB thành `localhost:5433`.

2) Khởi chạy Postgres + Backend:
```bash
cd infra
docker compose up -d --build
```
PowerShell:
```powershell
cd infra
docker compose up -d --build
```

3) Chạy Electron UI (dev):
```bash
cd electron
npm ci
VITE_API_URL=http://localhost:8000 npm run dev
```
Electron dev sẽ load `http://localhost:5173`. Nếu cần mở Electron shell: `npx electron .` (yêu cầu đã build main/preload phù hợp).

4) Build gần-production (không tạo installer):
```bash
cd electron
VITE_API_URL=http://localhost:8000 npm run build
NODE_ENV=production npx electron .
```

### Backend (local venv)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r ..\requirements.txt
copy ..\infra\env\.env.local.example .\.env.local
rem If running without Docker, set DATABASE_URL to localhost:5433
uvicorn app.main:app --reload --port 8000
```

### Quick helper scripts (optional)
- `scripts/dev_start.sh`: boot infra + backend (macOS/Linux).
- `scripts/setup_local.sh`: full local setup (macOS/Linux).

### Seed data (optional)
```powershell
cd scripts
python seed_data.py
```

### Realtime dev/test
- WS ingest (no audio): `backend/tests/test_ingest_ws.py`
- Audio ingest: `backend/tests/test_audio_ingest_ws.py`, `backend/tests/test_audio_ws.py`
- WhisperX diarization demo: `backend/tests/selfhost_whisperx_diarize.py`

### Demo data & login
DB đã seed kịch bản PMO LPBank. Tất cả user seed dùng mật khẩu `demo123`:
- Head of PMO: `nguyenvana@lpbank.vn / demo123`
- Senior PM: `tranthib@lpbank.vn / demo123`
- CTO (admin): `phamvand@lpbank.vn / demo123`

## Configuration
Env is loaded from `backend/.env.local` or `infra/env/.env.local` (if present).

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- Optional AI keys: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`
- `JINA_API_KEY`, `JINA_EMBED_MODEL`, `JINA_EMBED_DIMENSIONS`
- `SMARTVOICE_GRPC_ENDPOINT`, `SMARTVOICE_ACCESS_TOKEN`, `SMARTVOICE_TOKEN_ID`, `SMARTVOICE_TOKEN_KEY`
- `GOMEET_API_BASE_URL`, `GOMEET_PARTNER_TOKEN`
- `SUPABASE_S3_*` - object storage (optional)
- `SMTP_*`, `EMAIL_ENABLED` - email distribution (optional)
- `CORS_ORIGINS`, `SECRET_KEY`

Env templates: `infra/env/.env.*.example`.

## API & Realtime
Core endpoints:
- `POST /api/v1/sessions` - create realtime session (returns WS URLs)
- `POST /api/v1/sessions/{id}/sources` - get `audio_ingest_token` for bridge
- `WS /api/v1/ws/audio/{id}?token=...` - raw audio ingress (PCM S16LE 16kHz)
- `WS /api/v1/ws/in-meeting/{id}` - dev/test transcript ingest
- `WS /api/v1/ws/frontend/{id}` - live transcript + state for UI
- `WS /api/v1/ws/realtime-av/{id}` - unified realtime AV ingest (audio_chunk + video_frame_meta + recap/Q&A events)
- `GET /api/v1/realtime-av/sessions/{id}/snapshot` - realtime AV session state snapshot
- `PUT /api/v1/realtime-av/sessions/{id}/roi` - update ROI for slide-change detection
- `POST /api/v1/rag/query` / `POST /api/v1/knowledge/query` - RAG Q&A
- `POST /api/v1/transcripts/{meeting_id}/chunks` - ingest transcript chunks
- `POST /api/v1/minutes/generate` - minutes generation

Target APIs (spec-level, see docs):
- `POST /meetings/{id}/join`
- `WS /meetings/{id}/audio`
- `GET /meetings/{id}/recap/live`
- `POST /actions`
- `GET /meetings/{id}/minutes`
- `POST /highlights/{id}/render`

Specs: `docs/api_contracts.md`, `docs/in_meeting_flow.md`, `docs/real_time_transcript.md`.

## Data Model
Core entities:
- `Meeting` - metadata, participants, schedule.
- `TranscriptChunk` - time-coded transcript by speaker.
- `ActionItem` - task/owner/deadline/priority.
- `Decision` - decision title/rationale/impact.
- `Risk` - risk/mitigation/owner/severity.
- `Citation` - doc/timecode evidence.

## RAG & Knowledge Hub
- Ingest: upload -> extract text -> chunk -> embed (Jina) -> pgvector.
- Search: hybrid vector + metadata filter (meeting/project scope).
- Answering: grounded prompts, citations; no-source-no-answer.
- Details: `docs/rag_architecture.md`, `docs/knowledge_vector_search.md`.

## Security & Compliance
- PII masking + tokenization trước khi gọi external provider (policy-driven).
- Private link / VPC peering cho endpoint LLM bên ngoài.
- RBAC/ABAC theo phòng ban/dự án; ACL chặt cho RAG.
- Audit logs cho tool calls, LLM/RAG queries, và state transitions.

## Observability & KPIs
- Latency: realtime recap, WS tick scheduling, STT WER.
- Quality: precision/recall action items; ADR consistency.
- Usage: Ask-AI per meeting, highlight views, post-meeting Q&A.
- Cost: token budget per meeting; cached glossary/FAQ.

## Deployment
- Local dev: Docker Compose (`infra/docker-compose.yml`).
- MVP cloud: Supabase + Render + Vercel (see `docs/DEPLOYMENT.md`).
- Production: private VPC/on-prem, WORM storage, audit + retention.

### Hướng dẫn đóng gói & khởi chạy (end-to-end)
Tóm tắt nhanh cho reviewer dựng lại toàn bộ sản phẩm (Postgres + FastAPI + Electron):
1) Clone repo và vào thư mục dự án:
   `git clone <repo-url>` -> `cd vnpt_ai_hackathon_meetmate`
2) Yêu cầu tối thiểu: Docker 24+, Node 18+ + npm 9+, Python 3.11+ (nếu chạy backend thuần Python).
3) Tạo `infra/env/.env.local` (xem mẫu ở mục Development).
4) Khởi chạy Postgres + Backend: `cd infra && docker compose up -d --build`.
5) Kiểm tra API: `curl http://localhost:8000/api/v1/health`.
6) Chạy UI: `cd electron && VITE_API_URL=http://localhost:8000 npm run dev` (PowerShell: set `$env:VITE_API_URL` trước khi chạy).
7) Dừng/dọn: `cd infra && docker compose down` (thêm `-v` nếu muốn reset seed).

## Test Automation Guide
**Tiêu chí**: có script tự động, ổn định, chạy lặp 3 lần. Repo đã có `scripts/run_tests.sh` để chạy toàn bộ test backend (unit + integration) 3 lần liên tiếp.

### Phạm vi
- Backend unit tests: `backend/tests/unit`
- Backend integration tests (FastAPI TestClient, không cần DB ngoài): `backend/tests/integration`
- Bỏ qua các test audio/WS thủ công: `backend/tests/test_audio_ws.py`, `backend/tests/test_audio_ingest_ws.py`, `backend/tests/test_ingest_ws.py`

### Yêu cầu môi trường
- Python 3.11+
- `pip install -r requirements.txt`
- Không cần Postgres/Supabase (test dùng in-memory/mock)

### Cách chạy
Từ root repo:
```bash
bash scripts/run_tests.sh
```
Script sẽ:
- Thiết lập `PYTHONPATH` để backend import được.
- Chạy `pytest -q backend/tests/unit backend/tests/integration` 3 vòng liên tiếp.
- Dừng ngay nếu có lỗi.

### Ghi chú ổn định
- Chạy một vòng: `PYTHONPATH=backend pytest -q backend/tests/unit backend/tests/integration`
- Nếu thêm test mới cần network hoặc DB thật, cập nhật script hoặc đánh dấu skip để giữ bộ smoke này ổn định.

## Roadmap
- GĐ0: join meeting + realtime ASR + live recap + post summary.
- GĐ1: action/decision extractor + task sync + RAG internal.
- GĐ2: guardrails/compliance archive + quality dashboard + highlights.
- GĐ3: org-level analytics + multi-channel assistant.

## Docs
- SAAR spec: `docs/MeetMate _ SAAR – Self-aware Adaptive Agentic RAG.md`
- Realtime flow: `docs/in_meeting_flow.md`, `docs/real_time_transcript.md`
- Realtime AV (minute ASR + slide detection + capture + recap windows): `docs/implementation/REALTIME_AV_MINUTE_PIPELINE.md`
- API contracts: `docs/api_contracts.md`, `docs/gomeet_control_api_spec.md`
- Transcript ingest: `docs/transcript_ingest_api.md`
- RAG architecture: `docs/rag_architecture.md`, `docs/knowledge_vector_search.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- AI architecture deep dive: `docs/AI architecture/`
- Data engineer guide: `docs/data_engineer_guide.md`
- Security/test/UX plans: `Techni_docs_2/`

## Development Team
**SAVINAI** - Saigon Vietnam AI
- **Đặng Như Phước (Leader)**: Software Engineer, AI Engineer, Backend Engineer. Kiến trúc backend FastAPI, realtime WS pipeline (audio -> STT -> bus), LangGraph routing, RAG/ADR flow, tool-calling, và Docker/dev infra.
- **Thái Hoài An**: Data Engineer, Software Engineer, AI Engineer. Mô hình dữ liệu + schema, pgvector/embeddings, ingest tài liệu (OCR/SmartReader), seed/demo data, và tối ưu truy vấn RAG.
- **Trương Minh Đạt**: BA, GTM Analyst. Thu thập yêu cầu nghiệp vụ BFSI, chuẩn hóa use-case Pre/In/Post, KPIs, và định hướng go-to-market/documentation.
- **Hoàng Minh Quân**: End-user Analyst, Product Deployment, BA. UX research, test/validation, kế hoạch triển khai, và hỗ trợ rollout/training.

## Mentor Acknowledgements
Xin chân thành cảm ơn các mentor đã đồng hành cùng đội thi trong Vòng 2 - Track 1: The Dreamer, hỗ trợ định hướng công nghệ, kiến trúc giải pháp và tính khả thi triển khai:
- **Hồ Minh Nghĩa (@nghiahm1989)**: Tiến sỹ Khoa học máy tính (Học viện FSO - Liên bang Nga), chuyên gia mật mã và ứng dụng AI/GenAI trong tự động hóa; từng là Phó phòng Phát triển phần mềm Ban Cơ yếu Chính phủ, tư vấn chuyển đổi số TPBank; hiện là chuyên gia phụ trách mảng AI tại LPBank.
- **Nguyễn Phan Khoa Đức (@dukeng96)**: Giám đốc phát triển công nghệ, sản phẩm và giải pháp AI tại VNPT AI; từng học tập tại Đại học Sydney (USYD) và làm việc tại Úc.
- **Lâm Vũ Dương**: Giám đốc VNPT, hỗ trợ kết nối và định hướng chung cho chương trình.
- **Thành Đạt**: VNPT GoMeet Software Engineer, hỗ trợ nền tảng họp và tích hợp kỹ thuật.

## Contributing
Internal hackathon repo. Open an issue or PR; keep API contracts + docs updated.
