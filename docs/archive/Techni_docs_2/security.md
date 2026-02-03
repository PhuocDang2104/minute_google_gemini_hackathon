Techni Docs / Security & Data Protection
========================================

Scope
- Backend FastAPI, Supabase Postgres/Storage, embedding services (Jina/Groq/HF), SMTP.

Principles
- Least privilege, no secrets in repo, validate input, sanitize uploads, log minimal PII.

Identity & Access
- Auth: stick to one model (current backend JWT) or Supabase Auth later; avoid mixed modes.
- Roles: `admin` vs `user`; enforce on admin endpoints (`/api/v1/admin/*`, projects CRUD).
- Tokens: read from `Authorization: Bearer`, reject missing/invalid; short expiry recommended.
- RLS (if using Supabase Auth): enable on `profiles/knowledge_*` tables.

Data & Storage
- File upload: sanitize file name (strip control chars, limit length), restrict mime/size (<=10MB suggested), store under scoped prefix `knowledge/{uuid}/...`.
- S3/Supabase Storage keys: avoid user-supplied key; generate server-side.
- Database: use parameterized SQL (already in code), avoid inline string concat; pool sizing to prevent exhaustion.
- Backups: rely on Supabase automatic backups; document restore procedure (TODO).

Network & Secrets
- Secrets via env only: DB URL, STORAGE KEYS, EMBED API KEYS, SMTP creds.
- Do not log secrets or raw embeddings; mask tokens in logs.
- Outbound calls (Jina/Groq/HF): add timeout, retry with backoff, handle 4xx/5xx gracefully.

Upload & Content Safety
- PDF/text extraction: strip NUL bytes, reject if extraction fails.
- Virus/malware scanning: currently absent — add note to integrate (e.g., ClamAV or provider scan) before production.

Logging & Monitoring
- Log auth failures (no tokens), 5xx errors, storage failures; keep PII minimal.
- Add request ID per request (TODO); trace embedding calls for latency metrics.
- Rate limit: not implemented — add per-IP/token basic throttle for auth/knowledge query in prod.

Email
- SMTP creds stored in env; enforce UTF-8 (already in code), strip non-ASCII icons from subject/body.
- Validate recipient emails; provide opt-out footer (TODO).

Deployment Hardening
- Force HTTPS in production; set CORS to trusted origins.
- Supabase DB: restrict to pooler endpoint, rotate keys periodically.
- Rotate signing keys for JWT periodically; document key rotation steps.

Open Items (to close)
- Add basic rate limiting.
- Add malware scan on upload (or rely on provider).
- Add monitoring/alerting for DB pool exhaustion/timeouts.
- Document backup/restore and incident response steps.
