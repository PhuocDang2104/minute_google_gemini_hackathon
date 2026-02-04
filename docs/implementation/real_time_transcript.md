# Realtime transcript (In-meeting) — cách tích hợp & cách test

Tài liệu này hướng dẫn **test nhanh** pipeline realtime của MeetMate theo spec:
- Production: **Raw audio ingress** → **SmartVoice STT** → **bus** → **frontend**
- Dev/Test: **bơm transcript** vào `WS /ws/in-meeting` để test UI/bus/LangGraph mà không cần audio/STT

Chi tiết flow xem thêm: `docs/in_meeting_flow.md`.

---

## 1) UI flow (Electron) — tab “Trong họp”
1. Mở `Meeting detail` → tab **Trong họp** → bấm **Tham gia cuộc họp**.
2. Nhập link (GoMeet/Google Meet) và giữ **Session ID = meeting.id** (khuyến nghị để persist transcript vào DB theo meeting).
3. Bấm **Áp dụng**:
   - UI gọi `POST /api/v1/sessions` để khởi tạo realtime session.
   - UI tự kết nối `WS /api/v1/ws/frontend/{session_id}` để nhận realtime feed.
4. (Tuỳ chọn) Bấm **Lấy audio_ingest_token** để phát token cho Bridge đẩy audio vào `WS /ws/audio`.
5. (Tuỳ chọn) Bật **test ingest** và bơm transcript test để kiểm UI/bus/LangGraph ngay trong app.

---

## 2) Các endpoint chính

### 2.1 REST: tạo session
`POST /api/v1/sessions`

Gợi ý request (dùng `session_id = meeting.id`):
```json
{
  "session_id": "<meeting.id>",
  "language_code": "vi-VN",
  "target_sample_rate_hz": 16000,
  "audio_encoding": "PCM_S16LE",
  "channels": 1,
  "realtime": true,
  "interim_results": true,
  "enable_word_time_offsets": true
}
```

### 2.2 REST: lấy audio_ingest_token cho Bridge
`POST /api/v1/sessions/{session_id}/sources?platform=vnpt_gomeet`

Nếu bạn tích hợp GoMeet theo mô hình “MeetMate push” (MeetMate gọi GoMeet control API để bật bridge), xem thêm: `docs/gomeet_control_api_spec.md`.

### 2.3 WS: frontend nhận realtime (1 WS duy nhất)
`wss://<host>/api/v1/ws/frontend/{session_id}`
- Nhận `transcript_event` + `state` (payload theo `docs/in_meeting_flow.md`).

### 2.4 WS: transcript test ingest (dev/test)
`wss://<host>/api/v1/ws/in-meeting/{session_id}`

Payload:
```json
{
  "meeting_id": "<session_id>",
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

### 2.5 WS: raw audio ingest (production)
`wss://<host>/api/v1/ws/audio/{session_id}?token={audio_ingest_token}`
- Gửi `start` JSON, sau đó stream **binary PCM frames** (S16LE mono 16kHz).

---

## 3) Test nhanh bằng script (không cần UI)

### 3.0 Kiểm tra backend đã deploy đúng phiên bản (Render)
Nếu bạn test vào Render mà bị `404 /api/v1/sessions` thì gần như chắc chắn backend trên Render **chưa được redeploy** với code realtime mới.

Cách check nhanh:
- Mở `https://<host>/openapi.json` và tìm path `/api/v1/sessions`
- Hoặc chạy (PowerShell):
```powershell
python -c "import requests; o=requests.get('https://<host>/openapi.json', timeout=20).json(); print('/api/v1/sessions' in (o.get('paths') or {}))"
```

Nếu in ra `False` → cần redeploy backend mới (root directory đúng là `vnpt_ai_hackathon/backend`) rồi mới test được `WS /api/v1/ws/audio/...`.

### 3.1 Bơm transcript (dev/test)
Chạy script: `backend/tests/test_ingest_ws.py` (chỉnh `WS_URL` và `session_id` theo môi trường).

### 3.2 Stream audio (production)
Bạn có thể dùng bridge (GoMeet/Google Meet) hoặc chạy script mẫu:
- `backend/tests/test_audio_ws.py` (end-to-end: mở `WS /ws/frontend` để in ra `transcript_event/state`)
- `backend/tests/test_audio_ingest_ws.py` (quick check: chỉ test `WS /ws/audio` và log `audio_start_ack`/error)
Script đọc WAV PCM 16kHz mono và stream vào `WS /ws/audio`, đồng thời mở `WS /ws/frontend` để in ra event.

Gợi ý dùng file mẫu sẵn có:
- `backend/tests/resources/eLabs-1.wav` (mono 16-bit, 44.1kHz). Script sẽ **tự resample về 16kHz** trước khi stream.

Ví dụ chạy nhanh để chỉ test “API có hứng audio hay chưa” (không cần SmartVoice):
```powershell
cd vnpt_ai_hackathon/backend/tests
$env:MEETMATE_HTTP_BASE = "https://<host>"
python .\\test_audio_ingest_ws.py
```

Kỳ vọng log:
- Có `audio_start_ack` → backend accept start + format
- Có `audio_ingest_ok` → backend confirm đã nhận được ít nhất 1 frame audio

---

## 4) SmartVoice credentials (env placeholders)
Backend chừa sẵn biến môi trường (xem `backend/env.example.txt`):
- `SMARTVOICE_GRPC_ENDPOINT`
- `SMARTVOICE_ACCESS_TOKEN` (ưu tiên)
- hoặc `SMARTVOICE_AUTH_URL` + `SMARTVOICE_TOKEN_ID` + `SMARTVOICE_TOKEN_KEY`

Khi bạn cung cấp key trong env, backend sẽ dùng SmartVoice để tạo transcript realtime từ audio ingress.
