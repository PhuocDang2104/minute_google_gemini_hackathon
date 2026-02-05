# MINUTE ASR (whisper.cpp) - Docker Integration

## Mục tiêu
Triển khai ASR dạng batch (CPU-only) bằng whisper.cpp trong một container riêng, phục vụ backend qua HTTP. Luồng này dùng cho video đã upload, không phải realtime streaming.

## Kiến trúc tổng quan
- `asr` service: FastAPI + whisper.cpp + ffmpeg, xử lý audio và trả JSON transcript.
- `backend` service: gọi ASR nội bộ qua `ASR_URL`, lưu transcript vào bảng `transcript_chunk`.
- `postgres`: lưu transcript và metadata.

Luồng chính:
1. UI upload video -> backend lưu file (S3 hoặc local `/files/...`).
2. UI trigger inference -> backend tải video, tách audio bằng ffmpeg.
3. Backend gọi `asr` -> nhận JSON -> parse segments -> ghi transcript chunks.
4. UI đọc transcript từ API và hiển thị.

## Thành phần chính
- Dockerfile: `services/asr/Dockerfile` (multi-stage build whisper.cpp).
- App: `services/asr/app/main.py` (FastAPI `/health`, `/transcribe`).
- Compose: `infra/docker-compose.yml` (service `asr` + `ASR_URL` cho backend).
- Backend integration:
  - `backend/app/services/asr_service.py`
  - `backend/app/services/video_inference_service.py`
  - `backend/app/services/transcript_service.py`

## Endpoint ASR
- `GET /health` -> `{ "ok": true }`
- `POST /transcribe` (multipart `file`) -> JSON output của whisper.cpp

## Cấu hình
Biến môi trường quan trọng:
- `ASR_URL`: URL nội bộ của ASR (mặc định `http://asr:9000` trong compose).
- `WHISPER_MODEL`: đường dẫn model trong container (mặc định `/models/ggml-tiny.en-q5_1.bin`).
- `WHISPER_THREADS`: số luồng chạy whisper (mặc định `1`).

## Setup local
Chạy toàn bộ stack:
```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Kiểm tra ASR:
```bash
curl http://localhost:9000/health
```

Test transcribe nhanh:
```bash
curl -X POST "http://localhost:9000/transcribe" -F "file=@/path/to/audio.mp3"
```

Trigger inference từ backend:
```bash
curl -X POST "http://localhost:8000/api/v1/meetings/<meeting_id>/trigger-inference"
```

## Mở rộng và production
- Tách ASR thành service độc lập (Render, ECS, VM), chỉ cần set `ASR_URL`.
- Dùng model lớn hơn: build lại image hoặc mount `/models` từ volume.
- Dùng queue cho video dài: tách job nền, tránh giữ HTTP request lâu.
- Có thể scale nhiều instance ASR (CPU), backend gọi qua load balancer.

## Troubleshooting
- **Video file not found**: kiểm tra `recording_url` và file thực tế trong `backend/uploaded_files/videos`.
- **0 transcript chunks**: kiểm tra ASR JSON có `transcription` hoặc `segments`.
- **DB lỗi cột start_time**: DB đang schema cũ (`time_start/time_end/lang`), dùng code compatibility trong `transcript_service.py`.
- **ASR 500**: kiểm tra log `minute_asr`, verify `WHISPER_MODEL` tồn tại và ffmpeg chạy được.

