# Hướng dẫn ingest transcript (để team khác set up)

Tài liệu này tổng hợp các bảng Postgres và API REST/WS sẵn có để bơm transcript vào hệ thống MeetMate. Mục tiêu: team tích hợp STT chỉ cần đẩy transcript là có thể dùng lại toàn bộ tính năng AI (recap, ADR, minutes).

## 1) Bảng liên quan

- `transcript_chunk` (chính để lưu transcript)
  - `id` (uuid, PK)
  - `meeting_id` (uuid, FK meeting.id)
  - `chunk_index` (int, thứ tự hiển thị/ghép)
  - `start_time` / `end_time` (float, giây; optional)
  - `speaker` (string, optional) / `speaker_user_id` (uuid, optional)
  - `text` (text, bắt buộc)
  - `confidence` (float, optional)
  - `language` (string, mặc định `vi`)
  - `created_at` (timestamp)

- `live_recap_snapshot` (snapshot tóm tắt theo thời gian, ghi tự động bởi AI endpoint)
  - `id`, `meeting_id`, `snapshot_time`, `summary`, `key_points`, `created_at`

> Các service dùng bảng này: `app/services/transcript_service.py`, `app/services/minutes_service.py`.

## 2) REST API (prefix mặc định: `/api/v1/transcripts`)

Nguồn: `backend/app/api/v1/endpoints/transcripts.py`.

- `POST /{meeting_id}/chunks`
  - Body (JSON):
    ```json
    {
      "chunk_index": 1,
      "start_time": 0.0,
      "end_time": 2.5,
      "speaker": "Speaker A",
      "text": "Xin chào mọi người",
      "confidence": 0.98,
      "language": "vi",
      "speaker_user_id": null
    }
    ```
  - Lưu 1 chunk; `meeting_id` lấy từ path.

- `POST /{meeting_id}/chunks/batch`
  - Body: mảng các object cùng schema như trên.
  - Dùng khi muốn đẩy cả đoạn transcript đã có sẵn.

- `GET /{meeting_id}?from_index=&to_index=&limit=100`
  - Trả về danh sách chunk (có `speaker_name` nếu map được với user).

- `GET /{meeting_id}/full`
  - Ghép tất cả chunk theo `chunk_index` → string transcript đầy đủ.

- `PUT /chunks/{chunk_id}`
  - Cập nhật `text`/`speaker`/`speaker_user_id`.

- `DELETE /{meeting_id}`
  - Xóa toàn bộ transcript của meeting.

- AI từ transcript (tuỳ chọn):
  - `POST /{meeting_id}/recap/generate` → tạo `live_recap_snapshot`.
  - `POST /{meeting_id}/extract/actions`
  - `POST /{meeting_id}/extract/decisions`
  - `POST /{meeting_id}/extract/risks`

### cURL mẫu (đẩy nhanh một chunk)
```bash
curl -X POST https://<host>/api/v1/transcripts/<meeting_id>/chunks \
  -H "Content-Type: application/json" \
  -d '{
    "chunk_index": 1,
    "start_time": 0.0,
    "end_time": 3.2,
    "speaker": "Agent",
    "text": "Chào cả nhà, hôm nay mình review sprint.",
    "confidence": 0.97,
    "language": "vi"
  }'
```

## 3) WebSocket ingest (realtime)

Nếu muốn đẩy realtime (thay vì REST), dùng WS đã có: `/api/v1/ws/in-meeting/{session_id}`. Xem chi tiết thêm ở `docs/real_time_transcript.md`.

Payload gửi vào WS:
```json
{
  "meeting_id": "<session_id>",
  "chunk": "Đây là câu nói realtime",
  "speaker": "SPEAKER_01",
  "time_start": 0.0,
  "time_end": 2.5,
  "is_final": true,
  "confidence": 0.99,
  "lang": "vi"
}
```
WS trả `{"event": "ingest_ack", "seq": <number>}`. Backend tự persist vào `transcript_chunk` và broadcast ra frontend.

## 4) Dòng chảy tiêu thụ transcript

- Minutes: `minutes_service.generate_minutes_with_ai` gọi `transcript_service.get_full_transcript(meeting_id)` khi `include_transcript=true`.
- ADR & recap: Graph in-meeting cập nhật `transcript_window` và có thể tạo `live_recap_snapshot`/ADR, nhưng đầu vào vẫn là các chunk đã ingest.

## 5) Checklist cho team tích hợp

1) Có `meeting_id` (UUID) đã tồn tại trong bảng `meeting`.  
2) Bơm transcript qua REST `POST /{meeting_id}/chunks` hoặc WS `/ws/in-meeting/{session_id}` (ưu tiên giữ `chunk_index` tăng dần).  
3) Kiểm tra `GET /{meeting_id}/full` để chắc dữ liệu đã lưu.  
4) (Tuỳ chọn) Gọi `POST /minutes/generate` với `include_transcript=true` để tạo biên bản.  
5) (Tuỳ chọn) Gọi các endpoint extract/recap nếu cần snapshot nhanh.
