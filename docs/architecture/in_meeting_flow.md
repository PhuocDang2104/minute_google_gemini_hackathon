# In-meeting realtime flow (MeetMate) — Spec-aligned

Tài liệu này mô tả **luồng realtime chuẩn** của MeetMate theo spec:
**Raw Audio Ingest (Google Meet / VNPT GoMeet) → SmartVoice STT (streaming) → Session Bus → Frontend**.

Mục tiêu: Frontend chỉ cần mở **1 WebSocket** để nhận:
- `transcript_event` (caption, partial/final)
- `state` (recap/ADR/QA/tools/topics)

---

## 1) Data path (2 luồng)

### 1.1. Production (audio → STT → bus → frontend)
1) **Tạo session**
   - `POST /api/v1/sessions` → trả `session_id`, `audio_ws_url`, `frontend_ws_url`, `transcript_test_ws_url`.
2) **Bridge đăng ký nguồn & lấy token**
   - `POST /api/v1/sessions/{session_id}/sources?platform=vnpt_gomeet` → nhận `source_id` + `audio_ingest_token` (JWT) để đẩy audio vào MeetMate.
3) **Raw audio ingress vào MeetMate**
   - Bridge mở `WS /api/v1/ws/audio/{session_id}?token=...`
   - Gửi `start` (JSON) → sau đó stream **binary PCM frames** (PCM S16LE, mono, 16kHz).
4) **Backend gọi SmartVoice STT streaming**
   - Backend forward audio frames sang SmartVoice.
   - Nhận kết quả STT (partial/final).
5) **Backend chuẩn hoá & ingest nội bộ (SSOT)**
   - Map STT → payload transcript chuẩn MeetMate.
   - Gọi `ingestTranscript(session_id, payload, source="smartvoice_stt")`:
     - validate bắt buộc
     - persist DB best-effort
     - cấp `seq` tăng dần theo session
     - publish `transcript_event` vào bus
6) **Session Bus fan-out**
   - Consumer A: Frontend distributor → WS `/api/v1/ws/frontend/{session_id}`
   - Consumer B: LangGraph worker → chạy graph theo scheduler và publish `state` vào bus
7) **Frontend nhận realtime**
   - Frontend mở `WS /api/v1/ws/frontend/{session_id}` và nhận `transcript_event` + `state`.

#### 1.1.1 Ai “kích hoạt session” và ai chủ động stream audio?
Trong spec này, **MeetMate không gọi ngược sang GoMeet** để “bảo GoMeet bắt đầu stream”.

Thành phần chủ động stream audio luôn là **GoMeet Bridge** (bot/service) - nó join phòng GoMeet, lấy audio track và **đẩy audio sang MeetMate** qua `WS /api/v1/ws/audio/...`.

Có 2 cách để GoMeet Bridge nhận được `session_id` + `audio_ws_url` + `audio_ingest_token`:
1) **Bridge pull (khuyến nghị nếu GoMeet Bridge đứng độc lập)**:
   - Bridge tự gọi:
     - `POST /api/v1/sessions` (có thể set `session_id = meeting.id` nếu muốn gắn vào DB meeting)
     - `POST /api/v1/sessions/{session_id}/sources` để lấy `audio_ingest_token`
   - Sau đó Bridge mở `WS /api/v1/ws/audio/{session_id}?token=...`, gửi `start`, chờ `audio_start_ack` rồi stream PCM frames.
2) **MeetMate push (nếu GoMeet có “control API” để bật bot)**:
   - MeetMate (UI hoặc backend orchestrator) gọi 2 REST endpoints của MeetMate để tạo session + token.
   - Sau đó MeetMate **gọi control API của GoMeet Bridge** (do phía GoMeet cung cấp) để truyền vào:
     - `session_id`
     - `audio_ws_url`
     - `audio_ingest_token`
     - `language_code`, `frame_ms`, `audio format` (PCM_S16LE mono 16kHz)
     - `platform_meeting_ref` + GoMeet join token (thuộc hệ GoMeet)
   - GoMeet Bridge nhận config và bắt đầu stream sang MeetMate.

Tham khảo spec chi tiết để gửi GoMeet team: `docs/gomeet_control_api_spec.md`.

Điểm “handshake” để Bridge biết session sẵn sàng:
- Sau khi Bridge connect WS và gửi `start`, MeetMate trả `audio_start_ack` (accept start + format).
- Sau khi Bridge gửi frame audio đầu tiên, backend sẽ trả thêm event `audio_ingest_ok` (xác nhận API đã nhận được audio frame).

### 1.2. Dev/Test (bơm transcript tuỳ chọn)
Không cần audio/STT:
- Client mở `WS /api/v1/ws/in-meeting/{session_id}`
- Gửi transcript chunk JSON → backend gọi `ingestTranscript(..., source="transcript_test_ws")`
- Dữ liệu chạy qua bus và ra frontend **y hệt production**.

---

## 2) API bề mặt chính thức

### 2.1 REST — Tạo session
`POST /api/v1/sessions`

Request (theo spec, backend có thêm `session_id` optional để bạn set bằng `meeting.id`):
```json
{
  "session_id": "OPTIONAL_UUID_MEETING_ID",
  "language_code": "vi-VN",
  "target_sample_rate_hz": 16000,
  "audio_encoding": "PCM_S16LE",
  "channels": 1,
  "realtime": true,
  "interim_results": true,
  "enable_word_time_offsets": true
}
```

Response:
```json
{
  "session_id": "sess_or_uuid",
  "audio_ws_url": "wss://<host>/api/v1/ws/audio/<session_id>",
  "frontend_ws_url": "wss://<host>/api/v1/ws/frontend/<session_id>",
  "transcript_test_ws_url": "wss://<host>/api/v1/ws/in-meeting/<session_id>",
  "ingest_policy": {
    "expected_audio": { "codec": "PCM_S16LE", "sample_rate_hz": 16000, "channels": 1 },
    "recommended_frame_ms": 250,
    "max_frame_ms": 1000
  }
}
```

### 2.2 REST — Bridge đăng ký nguồn & lấy token
`POST /api/v1/sessions/{session_id}/sources?platform=vnpt_gomeet`

Response:
```json
{
  "session_id": "sess_or_uuid",
  "source_id": "src_..._uuid",
  "platform": "vnpt_gomeet",
  "audio_ingest_token": "<jwt_scope_audio_session>",
  "token_ttl_seconds": 1800
}
```

---

## 3) WebSocket contracts

### 3.1 WS Raw Audio Ingress (Production)
Endpoint: `wss://<host>/api/v1/ws/audio/{session_id}?token={audio_ingest_token}`

**Start (JSON)**
```json
{
  "type": "start",
  "platform": "vnpt_gomeet",
  "platform_meeting_ref": "gomeet:room_987",
  "audio": { "codec": "PCM_S16LE", "sample_rate_hz": 16000, "channels": 1 },
  "language_code": "vi-VN",
  "frame_ms": 250,
  "stream_id": "aud_01",
  "client_ts_ms": 1730000000000
}
```

**Start ACK**
```json
{
  "event": "audio_start_ack",
  "session_id": "sess_or_uuid",
  "accepted_audio": { "codec": "PCM_S16LE", "sample_rate_hz": 16000, "channels": 1 }
}
```

**Audio frames**
- Binary frames: raw PCM S16LE mono 16kHz theo cadence `frame_ms`.

**Backpressure (optional)**
```json
{ "event": "throttle", "reason": "stt_backpressure", "suggested_frame_ms": 500 }
```

### 3.2 WS Transcript Test Ingest (Dev/Test)
Endpoint: `wss://<host>/api/v1/ws/in-meeting/{session_id}`

Payload:
```json
{
  "meeting_id": "sess_or_uuid",
  "chunk": "Đây là transcript test do tôi tự bơm.",
  "speaker": "SPEAKER_01",
  "time_start": 0.0,
  "time_end": 2.5,
  "is_final": true,
  "confidence": 0.99,
  "lang": "vi",
  "question": false
}
```

ACK:
```json
{ "event": "ingest_ack", "seq": 101 }
```

### 3.3 WS Frontend Egress (Frontend nhận realtime 1 WS)
Endpoint: `wss://<host>/api/v1/ws/frontend/{session_id}`

`transcript_event`
```json
{
  "event": "transcript_event",
  "session_id": "sess_or_uuid",
  "seq": 101,
  "payload": {
    "meeting_id": "sess_or_uuid",
    "chunk": "Speaker text ...",
    "speaker": "SPEAKER_01",
    "time_start": 12.3,
    "time_end": 15.8,
    "is_final": true,
    "confidence": 0.91,
    "lang": "vi"
  }
}
```

`state`
```json
{
  "event": "state",
  "session_id": "sess_or_uuid",
  "seq": 132,
  "version": 7,
  "payload": {
    "recap": "Short recap ...",
    "live_recap": "Short recap ...",
    "topic": { "new_topic": false, "topic_id": "T1", "title": "...", "start_t": 0.0, "end_t": 0.0 },
    "intent_payload": { "label": "NO_INTENT", "slots": {} },
    "transcript_window": "[SPEAKER_01 0.00-12.30] ...",
    "actions": [],
    "new_actions": [],
    "decisions": [],
    "risks": [],
    "tool_suggestions": [],
    "topic_segments": [],
    "last_qa_answer": null
  }
}
```

---

## 4) SmartVoice STT → transcript payload (Backend mapping)
SmartVoice trả kết quả partial/final. Backend map về schema MeetMate:
- `chunk`: transcript string.
- `is_final`: from STT result.
- `confidence`: from STT alternative (nếu có).
- `time_start/time_end`: ưu tiên word offsets; nếu không có thì dùng audio clock backend.
- `speaker`: `SPEAKER_01` nếu diarization chưa có.

Minimal RecognitionConfig (tham khảo):
```json
{
  "language_code": "vi-VN",
  "sample_rate_hertz": 16000,
  "encoding": "LINEAR16",
  "model": "fast_streaming",
  "enable_word_time_offsets": true
}
```

---

## 5) Operational notes
- **Partial vs Final**: UI hiển thị `is_final=false` dạng typing; `is_final=true` commit timeline. LangGraph worker ưu tiên tick trên final (và question-trigger).
- **Transcript window**: backend giữ buffer ~4000 ký tự/session cho graph context.
- **Realtime tick**: 30s/tick, dùng rolling window 60s (có thể include partial mới nhất nếu chưa final).
- **Persistence**: best-effort; để persist vào DB đầy đủ, khuyến nghị dùng `session_id = meeting.id` (UUID có Meeting record).
