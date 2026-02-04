Techni Docs / UX Metrics & Optimization Plan
============================================

Purpose
- Track if the product is usable, reliable, and valuable for target users (PM/PO/Tech leads).

Core Metrics (Phase 1)
- Task Success:
  - Upload → embed success rate (% no error).
  - RAG answer availability (% queries returning context, not “không đủ dữ liệu”).
- Latency:
  - RAG response p95 (query → answer).
  - Upload-to-embed time p95 (file upload → embeddings stored).
- Reliability:
  - Error rate 5xx on API (% of requests).
  - DB connection pool exhaustion count.
- Engagement/Adoption:
  - Projects created per week, docs uploaded per project.
  - Queries per active user.

Secondary Metrics (Phase 2)
- Email delivery success rate.
- Time to first meaningful answer (TTFMA) for new users.
- UI stability: frontend type/lint errors in CI (0 allowed).

Instrumentation Plan
- Add request_id to backend logs; log latency for `/knowledge/query`, upload flow.
- Log outcome for embed pipeline (success/fail, provider, duration).
- Frontend: basic event log (upload_clicked, upload_success, rag_query, rag_no_context).
- Store aggregated metrics in simple DB table or external APM (later).

Targets (initial)
- Upload success ≥ 95%.
- RAG response p95 < 6s (with external embedding), < 3s if cached/local.
- API 5xx < 1%.
- “No context” responses < 20% of queries (excluding smalltalk).

Optimization Loop
1) Collect weekly metrics.
2) Identify top failures (upload error, DB timeout, embed 4xx/5xx).
3) Ship fixes (pool tuning, fallback, better chunking).
4) Re-run smoke tests and compare metrics.
5) Update targets quarterly as traffic grows.
