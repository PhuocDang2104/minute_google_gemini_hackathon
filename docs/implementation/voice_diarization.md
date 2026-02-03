2. Kiến trúc chuẩn cho Realtime Voice Diarization (Production-grade)
Tổng quan luồng dữ liệu

```
[Client Mic]
    ↓ (audio frames, 20–40ms)
[WebSocket / WebRTC]
    ↓
[Audio Buffer + Chunker]
    ↓ (5–10s WAV chunk)
[Speaker Diarization Engine (pyannote)]
    ↓
[Speaker Timeline Aggregator]
    ↓
[Realtime UI / Transcript / Analytics]
```
3.2 Backend – Audio Buffer & Chunker (CỰC KỲ QUAN TRỌNG)
Không bao giờ feed frame trực tiếp vào pyannote

Thay vào đó:

Buffer audio liên tục

Cắt thành sliding window chunks

Cấu hình khuyến nghị
Tham số	Giá trị
Chunk size	8–10 giây
Overlap	2–3 giây
Step	5–7 giây
Sample rate	16000
Channels	1

Ví dụ:

Chunk 1: 0s → 10s
Chunk 2: 7s → 17s
Chunk 3: 14s → 24s


👉 Overlap giúp giữ continuity speaker

3.3 Speaker Diarization Engine
Cách gọi pyannote đúng trong streaming

❌ Sai:

pipeline("frame.wav")


✅ Đúng:

pipeline({
    "waveform": waveform_tensor,
    "sample_rate": 16000
})

Ví dụ code (simplified)
from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization",
    use_auth_token=HF_TOKEN
)

def diarize_chunk(waveform):
    return pipeline({
        "waveform": waveform,
        "sample_rate": 16000
    })


3.4 Speaker Identity Stabilization (PHẦN KHÓ NHẤT)
Vấn đề

Mỗi chunk → pyannote gán:

SPEAKER_00, SPEAKER_01


Nhưng:

SPEAKER_00 ở chunk A ≠ SPEAKER_00 ở chunk B

👉 CẦN layer mapping speaker toàn cục

Cách làm chuẩn (industry practice)

Trích speaker embedding cho mỗi segment

So sánh embedding với speaker registry

Gán ID ổn định:

USER_1, USER_2, USER_3

Pseudocode
for segment in diarization:
    embedding = extract_embedding(segment)
    speaker_id = match_or_create_speaker(embedding)


Khoảng cách:

Cosine similarity

Threshold ~ 0.7–0.8