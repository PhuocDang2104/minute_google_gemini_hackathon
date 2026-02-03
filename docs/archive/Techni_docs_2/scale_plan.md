Techni Docs / Scaling Plan
==========================

Current Stack
- Backend FastAPI (Render), Supabase Postgres + Storage, Embedding API (Jina/Groq/HF), Electron frontend.

Pain Points Observed
- DB pool exhaustion / timeouts (Supabase pooler).
- Embedding API 4xx/5xx and latency.
- Storage key issues (InvalidKey), file sanitization.

Near-Term Scale Strategy
1) Database
   - Pool: tune `pool_size`, `max_overflow`, `pool_timeout` (already reduced) + add retry/backoff on connect.
   - Queries: ensure indexes on `knowledge_chunk.embedding` (pgvector ivfflat), `document_id`, project/meeting scopes.
   - Read replicas: plan for read-heavy (RAG queries) to offload from writer.
2) Embeddings
   - External API: add per-call timeout, 429/5xx retry with jitter; circuit-breaker; queue jobs.
   - Worker queue: move auto-embed to async worker (Celery/RQ/Arq) to avoid blocking upload response.
   - Local fallback: optional on-device model if API down (documented separately).
3) Storage
   - Sanitize keys, limit size/type, retry on transient errors.
   - Presigned URLs for access; expire URLs.
4) Caching
   - Cache frequent RAG queries (question → top chunks) with short TTL if acceptable.
   - Cache document presigned URLs per request/short TTL to avoid repeated signing.
5) Concurrency & Reliability
   - Add rate limiting for auth/knowledge endpoints.
   - Health checks for external services; degrade gracefully (return friendly message, not 500).
6) Observability
   - Metrics: request latency, embed duration, pool exhaustion counts.
   - Logs with request_id; alerts on sustained 5xx or timeout spikes.
7) Deployment
   - Use `$PORT` binding early; fast startup (move heavy init to startup hook).
   - Horizontally scale backend (multiple dynos) once DB/queue ready; sessionless design supports it.

Longer-Term
- Separate services: upload/ingest worker, query service, admin API.
- Vector DB alternative (pgvector tuned vs managed vector store) if scale > millions of chunks.
- CDN for static assets/downloaded docs if bandwidth grows.
