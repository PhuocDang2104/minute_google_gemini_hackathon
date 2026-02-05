# API Contracts (MeetMate)

## Realtime (In-meeting)

### REST
- `POST /api/v1/sessions` – tạo realtime session, trả WS URLs + ingest policy.
- `POST /api/v1/sessions/{session_id}/sources?platform=google_meet_tab` – cấp `source_id` + `audio_ingest_token` cho client stream audio tab.

### WebSockets
- `WS /api/v1/ws/audio/{session_id}?token=...` – raw audio ingress (production).
  - JSON `start` → stream binary PCM frames (PCM S16LE mono 16kHz).
  - Server có thể gửi `{ "event": "throttle", ... }` để backpressure.
- `WS /api/v1/ws/in-meeting/{session_id}` – transcript test ingest (dev/test).
  - Client gửi JSON transcript chunk → server ACK `{ "event": "ingest_ack", "seq": ... }`.
- `WS /api/v1/ws/frontend/{session_id}` – frontend egress (1 WS duy nhất).
  - Server push `transcript_event` + `state` (ordered by `seq`).

## Other APIs (existing)
- `POST /api/v1/auth/login` – obtain access token.
- `GET /api/v1/health` – liveness/readiness.
- `GET /api/v1/meetings` / `POST /api/v1/meetings` – meetings.
- `POST /api/v1/rag/query` – RAG query.
