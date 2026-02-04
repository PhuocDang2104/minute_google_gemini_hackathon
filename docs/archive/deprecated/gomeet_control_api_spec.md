# MeetMate ↔ GoMeet: Control API Spec (để GoMeet build)

Tài liệu này mô tả **Control Plane** giữa MeetMate và VNPT GoMeet để GoMeet team implement “bridge service”:
- Khi user bấm **Join** trên extension/UI:
  - MeetMate tạo `session_id`
  - MeetMate cấp `audio_ingest_token`
  - MeetMate gọi **GoMeet Control API** để yêu cầu GoMeet **join room + stream PCM** về MeetMate qua WebSocket

> Phân biệt rõ:
> - **Control Plane**: HTTP API giữa MeetMate ↔ GoMeet để *điều khiển* (start/stop/status/reconnect).
> - **Data Plane**: WebSocket audio `wss://<meetmate>/api/v1/ws/audio/{session_id}?token=...` để *đẩy raw audio*.

---

## 1) Actors & Trust Boundaries

**MeetMate Backend**
- Tạo realtime `session_id`
- Cấp `audio_ingest_token` (JWT) scoped theo `session_id`
- Expose WS audio ingest để GoMeet bridge đẩy PCM vào

**GoMeet Bridge Service (do GoMeet triển khai)**
- Join phòng GoMeet (bằng token GoMeet)
- Capture audio track
- Convert audio về chuẩn MeetMate
- Connect WS MeetMate và stream PCM frames

**MeetMate UI / Extension**
- Trigger “Join”
- Gửi meeting ref/join token về MeetMate backend (tuỳ kiến trúc)

---

## 2) Security / Tokens (BẮT BUỘC phân biệt)

### 2.1 GoMeet partner token (GoMeet cấp cho MeetMate)
- Dùng để MeetMate gọi **GoMeet Control API**
- Đề xuất truyền qua header:
  - `Authorization: Bearer <gomeet_partner_token>`

### 2.2 MeetMate audio ingest token (MeetMate cấp cho Bridge)
- Dùng để GoMeet Bridge connect vào **WS ingest** của MeetMate
- Là JWT scoped theo `session_id`, TTL (mặc định 1800s)
- Dùng như query param:
  - `wss://<meetmate>/api/v1/ws/audio/{session_id}?token=<audio_ingest_token>`

> Lưu ý quan trọng cho GoMeet team:
> - `gomeet_join_token` (hệ GoMeet) ≠ `audio_ingest_token` (hệ MeetMate).
> - GoMeet Bridge phải dùng **audio_ingest_token** khi connect sang MeetMate WS.

---

## 3) Flow chuẩn (3 bước bắt buộc)

### B1 — MeetMate tạo session
`POST /api/v1/sessions` (MeetMate)

Response trả:
- `session_id`
- `audio_ws_url` (không kèm token)
- `ingest_policy` (PCM_S16LE/16k/mono, frame ms khuyến nghị)

### B2 — MeetMate cấp quyền ingest cho GoMeet bridge
`POST /api/v1/sessions/{session_id}/sources?platform=vnpt_gomeet` (MeetMate)

Response trả:
- `source_id` (UUID)
- `audio_ingest_token` (JWT TTL, scope theo `session_id`)
- `token_ttl_seconds`

### B3 — MeetMate “push” sang GoMeet để họ bắt đầu stream
MeetMate gọi GoMeet Control API `streams:start` (bên dưới).

---

## 4) GoMeet Control API (GoMeet MUST implement)

Base path đề xuất: `https://<gomeet-api>/integrations/meetmate/v1`

### 4.1 Start streaming to MeetMate (REQUIRED)
**POST** `/streams:start`

**Auth**
- `Authorization: Bearer <gomeet_partner_token>`

**Idempotency**
- Header: `Idempotency-Key: <uuid>`
- GoMeet MUST đảm bảo:
  - Gọi lại với cùng `Idempotency-Key` trong cửa sổ ~5-15 phút → trả **cùng** `gomeet_stream_id` và không tạo duplicate bot/stream.

**Request body**
```json
{
  "platform_meeting_ref": "gomeet:room_987_or_join_url",
  "gomeet_join_token": "<token_goMeet_cap>",
  "meetmate": {
    "session_id": "sess_abc123",
    "audio_ws_url": "wss://<meetmate>/api/v1/ws/audio/sess_abc123",
    "audio_ingest_token": "<jwt_from_B2>",
    "start_payload": {
      "type": "start",
      "platform": "vnpt_gomeet",
      "platform_meeting_ref": "gomeet:room_987",
      "audio": { "codec": "PCM_S16LE", "sample_rate_hz": 16000, "channels": 1 },
      "language_code": "vi-VN",
      "frame_ms": 250,
      "stream_id": "aud_01",
      "client_ts_ms": 1730000000000
    },
    "ingest_policy": {
      "recommended_frame_ms": 250,
      "max_frame_ms": 1000
    }
  }
}
```

**Response**
```json
{
  "gomeet_stream_id": "gm_stream_001",
  "status": "STARTING",
  "expires_at_ms": 1730001800000
}
```

**GoMeet MUST do sau khi nhận request**
1) Join meeting bằng `gomeet_join_token`
2) Lấy audio track nội bộ
3) Convert audio → **PCM S16LE, mono, 16kHz**
4) Connect WS sang MeetMate:
   - `wss://<meetmate>/api/v1/ws/audio/{session_id}?token=<audio_ingest_token>`
5) Send `start_payload` (JSON) → chờ `audio_start_ack`
6) Stream binary PCM frames theo cadence `frame_ms`

**Backpressure**
- MeetMate có thể gửi `{ "event": "throttle", ... }` → GoMeet bridge nên tăng `frame_ms` theo `suggested_frame_ms`.

---

### 4.2 Stop streaming (REQUIRED)
**POST** `/streams/{gomeet_stream_id}:stop`

**Response**
```json
{ "status": "STOPPED" }
```

**GoMeet MUST**
- Stop pushing audio sang MeetMate WS
- Thoát bot khỏi meeting (best-effort)

---

### 4.3 Get streaming status (RECOMMENDED)
**GET** `/streams/{gomeet_stream_id}`

**Response example**
```json
{
  "status": "STREAMING",
  "last_audio_push_ms": 1730000000456,
  "error": null
}
```

**Status enum gợi ý**
- `STARTING` (đang join room / chuẩn bị)
- `CONNECTING_WS` (đang connect WS MeetMate)
- `STREAMING` (đang push audio frames)
- `STOPPING` / `STOPPED`
- `ERROR` (kèm error)

---

### 4.4 Reconnect / Update MeetMate target (RECOMMENDED)  ← control_plane bổ sung
Mục tiêu: Cho phép MeetMate **ra lệnh GoMeet reconnect** sang MeetMate WS khi:
- WS bị drop (network/redeploy)
- MeetMate rotate `audio_ingest_token`
- Cần đổi `frame_ms` / `language_code` / `start_payload`

**POST** `/streams/{gomeet_stream_id}:reconnect`

**Auth**
- `Authorization: Bearer <gomeet_partner_token>`

**Request body**
```json
{
  "meetmate": {
    "session_id": "sess_abc123",
    "audio_ws_url": "wss://<meetmate>/api/v1/ws/audio/sess_abc123",
    "audio_ingest_token": "<new_jwt>",
    "start_payload": {
      "type": "start",
      "platform": "vnpt_gomeet",
      "platform_meeting_ref": "gomeet:room_987",
      "audio": { "codec": "PCM_S16LE", "sample_rate_hz": 16000, "channels": 1 },
      "language_code": "vi-VN",
      "frame_ms": 500,
      "stream_id": "aud_01",
      "client_ts_ms": 1730000000000
    }
  }
}
```

**Response**
```json
{ "status": "RECONNECTING" }
```

**GoMeet MUST**
- Giữ nguyên trạng thái join meeting (không tạo bot mới nếu không cần)
- Close WS cũ (nếu còn) và connect WS mới theo `audio_ws_url + audio_ingest_token`
- Resend `start_payload`, chờ `audio_start_ack`, rồi stream tiếp

---

## 5) MeetMate WS Audio Ingest handshake (để GoMeet implement đúng)

Endpoint:
`wss://<meetmate>/api/v1/ws/audio/{session_id}?token=<audio_ingest_token>`

Trình tự:
1) Connect WS
2) Send JSON `start_payload`
3) Nhận `audio_start_ack`
4) Stream binary PCM frames

MeetMate có thể trả thêm:
- `error` (format mismatch / invalid start)
- `throttle` (backpressure)
- `audio_ingest_ok` (confirm đã nhận frame đầu tiên)

---

## 6) Failure modes & retry (khuyến nghị)

- Nếu `streams:start` timeout/5xx:
  - Retry với **cùng** `Idempotency-Key` (tránh tạo duplicate stream).
- Nếu GoMeet bridge connect WS MeetMate fail:
  - GoMeet set stream status = `ERROR`, expose `error`
  - MeetMate có thể gọi `streams/{id}:reconnect`
- Nếu MeetMate redeploy làm WS drop:
  - GoMeet nên auto-reconnect (internal retry) hoặc chờ MeetMate gọi `:reconnect` (tuỳ thỏa thuận).

