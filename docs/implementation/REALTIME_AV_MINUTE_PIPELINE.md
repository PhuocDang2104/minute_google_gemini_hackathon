# MINUTE Realtime Audio + Video Pipeline (MVP)

## 1) Muc tieu
- Batch ASR theo record 30 giay.
- Phat hien global slide/screen change bang dHash 64-bit + SSIM.
- Capture frame theo timecode khi change duoc confirm.
- Recap moi 2 phut, co revision khi du lieu den tre.
- Push WebSocket event theo contract de frontend consume.

Pipeline moi duoc them theo huong additive, khong thay the luong WS realtime cu (`/api/v1/ws/audio`, `/api/v1/ws/frontend`, `/api/v1/ws/in-meeting`).

## 2) Thanh phan da duoc bo sung

### 2.1 Data model (DB)
SQL init moi:
- `infra/postgres/init/11_realtime_av_pipeline.sql`

Bang moi:
- `session_roi`
- `audio_record`
- `transcript_segment`
- `captured_frame`
- `recap_window`
- `tool_call_proposal`
- `qna_event_log`

Model ORM moi:
- `backend/app/models/realtime_av.py`

### 2.2 Service pipeline
- `backend/app/services/realtime_av_service.py`

Service nay quan ly state theo `session_id`:
- batch recorder (30s) + batch ASR + timestamp normalize.
- detector lane (ROI -> detect frame -> dHash -> SSIM -> cooldown).
- capture-on-change + upload storage/local fallback.
- window builder 2 phut + overlap + revision.
- in-session Q&A tier0/tier1 + tier2 tool approval.

### 2.3 API/WS wiring
REST:
- `backend/app/api/v1/endpoints/realtime_av.py`
  - `GET /api/v1/realtime-av/sessions/{session_id}/snapshot`
  - `PUT /api/v1/realtime-av/sessions/{session_id}/roi`
  - `POST /api/v1/realtime-av/sessions/{session_id}/flush`
  - `GET /api/v1/realtime-av/sessions/{session_id}/captures`
  - `GET /api/v1/realtime-av/sessions/{session_id}/windows`

WebSocket:
- `backend/app/api/v1/websocket/realtime_av_ws.py`
  - `WS /api/v1/ws/realtime-av/{session_id}`

Main app wiring:
- `backend/app/main.py`

### 2.4 Config them moi
- `backend/app/core/config.py`
  - `REALTIME_AV_RECORD_MS` (default 30000)
  - `REALTIME_AV_WINDOW_MS` (default 120000)
  - `REALTIME_AV_WINDOW_OVERLAP_MS` (default 15000)
  - `REALTIME_AV_VIDEO_SAMPLE_MS` (default 1000)
  - `REALTIME_AV_DHASH_THRESHOLD` (default 16)
  - `REALTIME_AV_CANDIDATE_TICKS` (default 2)
  - `REALTIME_AV_SSIM_THRESHOLD` (default 0.90)
  - `REALTIME_AV_COOLDOWN_MS` (default 2000)
  - `REALTIME_AV_CAPTURE_WIDTH`/`HEIGHT`
  - `REALTIME_AV_DETECTION_WIDTH`/`HEIGHT`

### 2.5 Dependency
- Bo sung `Pillow` trong:
  - `backend/requirements.txt`
  - `requirements.txt`

## 3) Flow runtime

## 3.1 Session clock
- Moi event duoc gan `ts_ms` theo server (`now_ms()`), khong tin clock client.
- `session_id` la key scope cho audio/video/window merge.

## 3.2 Audio lane (30 giay)
1. Client gui `audio_chunk`.
2. Server gom PCM vao batch recorder.
3. Den bien 30s -> tao `AudioRecord`.
4. Goi batch ASR.
5. Normalize segment:
   - offset `mm:ss` -> `start_ts_ms = record_start_ts_ms + offset_ms`.
6. Persist `audio_record` + `transcript_segment` (+ best effort `transcript_chunk` cho compatibility).
7. Publish:
   - `transcript_record_ready`.

## 3.3 Video lane (1 fps sampling)
1. Client gui `video_frame_meta` kem `image_b64`.
2. Server apply ROI.
3. Sampling 1 fps.
4. Detection frame: resize + grayscale + blur.
5. Compare `dHash` voi reference:
   - candidate neu `hash_dist > threshold`.
6. Confirm neu:
   - candidate lien tiep `N` tick.
   - `SSIM < threshold`.
   - qua cooldown.
7. Khi confirm:
   - publish `slide_change_event`.
   - capture frame goc ROI.
   - upload storage (hoac local fallback).
   - persist `captured_frame`.
   - publish `captured_frame_ready`.

## 3.4 Merge lane (window 2 phut)
1. Trigger theo session clock, stride = `window_ms - overlap_ms`.
2. Query transcript segments tu DB (`transcript_segment`) theo `start_ts_ms` trong window.
3. Query captured frames tu DB (`captured_frame`) theo `ts_ms` trong window.
4. Tao payload:
   - `recap` (bullet list)
   - `topics` + `topic` hien hanh (de fill topic placeholder tren recap UI)
   - `cheatsheet`
   - `citations` (seg_id/frame_id + ts_ms)
5. Persist `recap_window`.
6. Publish `recap_window_ready`.

### Late arrivals + revision
- Khi segment/frame den tre ma thuoc window da emit:
  - tao `revision` moi (window_id giu nguyen, revision + 1).
  - frontend replace theo revision moi nhat.

## 3.5 In-session Q&A lane
1. Client gui `user_query`.
2. Tier 0: transcript/capture trong session.
3. Tier 1: RAG docs (`rag_retrieve` meeting scope).
4. Neu van thieu evidence va web chua duoc phep:
   - publish `tool_call_proposal`.
5. Client gui `approve_tool_call`.
6. Neu approved:
   - tier2 web search (stub tool) -> `qna_answer`.
7. Persist log vao `qna_event_log`.

## 4) WebSocket contract

Client -> Server (`WS /api/v1/ws/realtime-av/{session_id}`):
- `audio_chunk`
  - payload: `{seq, payload(base64 PCM), ts_hint?}`
- `video_frame_meta`
  - payload: `{frame_id, image_b64, checksum?, roi?, ts_hint?}`
- `session_control`
  - payload: `{action: start|pause|stop, meeting_id?, roi?}`
- `user_query`
  - payload: `{query_id?, text, scope}`
- `approve_tool_call`
  - payload: `{proposal_id, approved, constraints}`

Server -> Client:
- `transcript_record_ready`
- `slide_change_event`
- `captured_frame_ready`
- `recap_window_ready`
- `tool_call_proposal`
- `qna_answer`
- `error`

Luu y:
- Event cung duoc publish len `session_bus`, nen frontend co the tiep tuc nghe qua `/api/v1/ws/frontend/{session_id}` de nhan event moi.

## 5) Cach tich hop frontend

## 5.1 Session init
1. Goi `POST /api/v1/sessions` (co the set `session_id = meeting.id`).
2. Mo WS ingest moi:
   - `wss://<host>/api/v1/ws/realtime-av/{session_id}`
3. Co the tiep tuc mo WS feed cu:
   - `wss://<host>/api/v1/ws/frontend/{session_id}`
   - de render event fan-out tap trung.

## 5.2 Gui audio/video event
- Gui `audio_chunk` deu 20-60ms (base64 PCM).
- Gui `video_frame_meta` 1 fps (frame PNG/JPEG base64), kem `frame_id`.

## 5.3 Render event
- `transcript_record_ready`: render block transcript 30s theo speaker + time.
- `slide_change_event`: update timeline marker.
- `captured_frame_ready`: append gallery/timeline image.
- `recap_window_ready`: replace theo `(window_id, revision)` moi nhat.
- `tool_call_proposal` -> UI approval modal.
- `qna_answer` -> panel tra loi + citations.

## 6) Chay local

## 6.1 Migrate DB (moi truong local)
Neu khoi tao DB moi bang init scripts:
- file `11_realtime_av_pipeline.sql` se duoc load cung schema.

Neu DB da ton tai, chay tay:
```sql
\i infra/postgres/init/11_realtime_av_pipeline.sql
```

## 6.2 Start backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 6.3 Smoke test nhanh
1. Connect:
- `WS /api/v1/ws/realtime-av/{session_id}`
2. Send:
- `session_control(start)`
- `audio_chunk`
- `video_frame_meta`
3. Check event:
- `transcript_record_ready` (sau 30s va ASR xong)
- `slide_change_event` + `captured_frame_ready`
- `recap_window_ready` (moi 2 phut)

## 7) Deploy backend len Render

## 7.1 Build/Start command
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## 7.2 Env can set
Bat buoc:
- `DATABASE_URL`
- `CORS_ORIGINS`

Cho audio batch ASR:
- `ASR_URL`

Cho object storage (neu muon upload capture/audio):
- `SUPABASE_S3_ENDPOINT`
- `SUPABASE_S3_REGION`
- `SUPABASE_S3_BUCKET`
- `SUPABASE_S3_ACCESS_KEY`
- `SUPABASE_S3_SECRET_KEY`

Tuning pipeline:
- `REALTIME_AV_RECORD_MS`
- `REALTIME_AV_WINDOW_MS`
- `REALTIME_AV_WINDOW_OVERLAP_MS`
- `REALTIME_AV_VIDEO_SAMPLE_MS`
- `REALTIME_AV_DHASH_THRESHOLD`
- `REALTIME_AV_CANDIDATE_TICKS`
- `REALTIME_AV_SSIM_THRESHOLD`
- `REALTIME_AV_COOLDOWN_MS`

## 7.3 Post-deploy checklist
1. Chay SQL migration `11_realtime_av_pipeline.sql` tren production DB.
2. Verify endpoint:
- `GET /api/v1/realtime-av/sessions/{id}/snapshot`
3. Verify WS:
- connect `/api/v1/ws/realtime-av/{id}`
4. Verify storage:
- co `captured_frame_ready.uri` truy cap duoc.
5. Verify recap revision:
- cung `window_id` co revision tang khi transcript den tre.

## 8) KPI demo acceptance mapping
- Video latency: confirm change sau ~1-2s (sampling + candidate ticks).
- False-positive: giam nho ROI + threshold + cooldown.
- Audio: moi 30s co `transcript_record_ready`.
- Recap: moi 120s co `recap_window_ready`.
- Citations: co `seg_id/ts_ms` va `frame_id/ts_ms`.

## 9) Backward compatibility
- Khong thay doi contract core cua:
  - `/api/v1/ws/audio/{session_id}`
  - `/api/v1/ws/in-meeting/{session_id}`
  - `/api/v1/ws/frontend/{session_id}`
- Pipeline moi chay song song qua endpoint moi:
  - `/api/v1/ws/realtime-av/{session_id}`.
