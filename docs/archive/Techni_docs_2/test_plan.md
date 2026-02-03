Techni Docs / Test Plan
=======================

Scope
- MVP flows: auth (login/logout), project CRUD, meeting CRUD, upload → embed → query RAG, email notify, admin lists.
- Targets: backend (FastAPI), frontend (Electron/Vite), integrations (Supabase DB/storage, Jina/Groq/HF embedding endpoints, SMTP).

Environments
- Local dev: `make dev` (TODO) or `npm run dev` (electron) + `uvicorn` (backend).
- Staging/Render: use current env vars, Supabase pooler.

Test Types (minimal set to implement now)
1) API smoke (pytest/httpx):
   - `GET /health` (if exists) or root.
   - Auth: login with known admin user, 401 on bad token.
   - Project: create → list → get → update → delete (happy path).
   - Meeting: create with project_id → list → delete.
   - Knowledge: upload (small PDF), query RAG (mock embed if offline), delete document.
   - Admin lists: users, documents, meetings (expect 200 as admin).
2) Embedding pipeline:
   - Unit stub: chunk text → call embed client with fake vector → upsert DB.
   - Integration: call `knowledge/query` with sample vector in DB (seed).
3) UI smoke (Playwright/Cypress later):
   - Login form submit with valid creds (stub backend or use local).
   - Open Projects page, click “Tạo dự án” modal visible; create; see in list.
   - Upload doc in Pre-meet tab (or Knowledge), expect success toast + list entry.
4) Regression for storage:
   - Invalid file key returns graceful error (NoSuchBucket/InvalidKey handled).
5) Email (manual toggle):
   - If SMTP enabled, send test email; otherwise skip and assert “Email not configured”.

Pass Criteria
- All smoke tests green in CI (to add): backend API tests + typecheck frontend.
- Manual run: critical flows pass 3 consecutive runs (create → upload → query RAG).

Execution
- Add `backend/tests/` with pytest + httpx.
- Add `npm run typecheck` gate (already) + optional Playwright later.
- CI (GitHub Actions/Render): run backend tests + `npm run typecheck`.

Data/Fixtures
- Admin token/user seeded.
- Sample PDF (small), sample text chunks for RAG.
- SMTP creds optional; skip if env not set.
