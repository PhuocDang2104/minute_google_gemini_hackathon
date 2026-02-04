# 🎥 Video Upload Backend Implementation

## ✅ Implementation Completed

### **Files Created/Modified:**

1. ✅ **`backend/app/services/video_service.py`** - Video upload service
2. ✅ **`backend/app/api/v1/endpoints/meetings.py`** - Added 2 endpoints
3. ✅ **`backend/app/schemas/meeting.py`** - Added `recording_url` to `MeetingUpdate`
4. ✅ **`backend/app/services/meeting_service.py`** - Added `recording_url` update support
5. ✅ **`backend/app/services/__init__.py`** - Added `video_service` import
6. ✅ **`docs/VIDEO_STORAGE_DESIGN.md`** - Database design documentation

---

## 📋 API Endpoints

### **1. Upload Video**

```http
POST /api/v1/meetings/{meeting_id}/upload-video
Content-Type: multipart/form-data

Form Data:
  - video: File (required)
  - uploaded_by: string (optional)
```

**Response:**
```json
{
  "recording_url": "https://...",
  "message": "Video uploaded successfully",
  "file_size": 12345678,
  "storage_key": "videos/{meeting_id}/{uuid}.mp4"
}
```

**Validation:**
- ✅ File type: MP4, MOV, AVI, WebM, MKV
- ✅ Max size: 500MB
- ✅ Meeting must exist

---

### **2. Trigger Inference**

```http
POST /api/v1/meetings/{meeting_id}/trigger-inference
```

**Response:**
```json
{
  "job_id": "uuid",
  "message": "Inference job started. Processing will begin shortly.",
  "status": "queued"
}
```

**Requirements:**
- ✅ Meeting must exist
- ✅ Meeting must have `recording_url`

**Note:** Currently returns mock `job_id`. Background job processing needs to be implemented.

---

## 🔧 Implementation Details

### **Video Service (`video_service.py`)**

#### **Functions:**

1. **`upload_meeting_video()`**
   - Validates file type and size
   - Uploads to Supabase S3 (or local fallback)
   - Updates `meeting.recording_url`
   - Returns video URL

2. **`get_video_url()`**
   - Gets video URL for a meeting
   - Returns `None` if not found

3. **`delete_meeting_video()`**
   - Clears `recording_url` from meeting
   - TODO: Delete from storage

---

### **Storage Flow**

```
1. File uploaded via API
   ↓
2. Validate file (type, size)
   ↓
3. Build storage key: videos/{meeting_id}/{uuid}.mp4
   ↓
4. Upload to Supabase S3 (or local fallback)
   ↓
5. Generate presigned URL (24h expiration)
   ↓
6. Update meeting.recording_url
   ↓
7. Return URL to frontend
```

---

## 🗄️ Database Design

### **Option 1: Simple (Current Implementation)**

Uses existing `recording_url` field in `meeting` table:

```sql
CREATE TABLE meeting (
    ...
    recording_url TEXT,  -- Video URL
    ...
);
```

**Pros:**
- ✅ No migration needed
- ✅ Simple, fast
- ✅ Sufficient for MVP

**Cons:**
- ❌ No metadata (duration, size, format)
- ❌ No processing status tracking

---

### **Option 2: Advanced (Future)**

Create `video_recording` table for metadata:

```sql
CREATE TABLE video_recording (
    id UUID PRIMARY KEY,
    meeting_id UUID UNIQUE REFERENCES meeting(id),
    storage_key TEXT NOT NULL,
    file_url TEXT,
    file_size BIGINT,
    file_format TEXT,
    duration_seconds INTEGER,
    processing_status TEXT DEFAULT 'pending',
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    ...
);
```

See `VIDEO_STORAGE_DESIGN.md` for full schema.

---

## 🧪 Testing

### **1. Test Upload Video**

```bash
# Using curl
curl -X POST "http://localhost:8000/api/v1/meetings/{meeting_id}/upload-video" \
  -H "Authorization: Bearer {token}" \
  -F "video=@/path/to/video.mp4" \
  -F "uploaded_by={user_id}"
```

### **2. Test Trigger Inference**

```bash
curl -X POST "http://localhost:8000/api/v1/meetings/{meeting_id}/trigger-inference" \
  -H "Authorization: Bearer {token}"
```

### **3. Test with Python**

```python
import requests

# Upload video
with open('video.mp4', 'rb') as f:
    response = requests.post(
        f'http://localhost:8000/api/v1/meetings/{meeting_id}/upload-video',
        headers={'Authorization': f'Bearer {token}'},
        files={'video': f},
        data={'uploaded_by': user_id}
    )
    print(response.json())

# Trigger inference
response = requests.post(
    f'http://localhost:8000/api/v1/meetings/{meeting_id}/trigger-inference',
    headers={'Authorization': f'Bearer {token}'}
)
print(response.json())
```

---

## ⚙️ Configuration

### **Environment Variables**

Required for Supabase S3 storage:

```env
SUPABASE_S3_ENDPOINT=https://{project}.supabase.co/storage/v1/s3
SUPABASE_S3_REGION=ap-southeast-1
SUPABASE_S3_BUCKET=meetmate-videos
SUPABASE_S3_ACCESS_KEY=...
SUPABASE_S3_SECRET_KEY=...
```

If not configured, falls back to local storage:
```
backend/uploaded_files/videos/{uuid}.mp4
```

---

## 🚀 Next Steps

### **Phase 1: Basic Upload (Done ✅)**
- [x] Upload endpoint
- [x] Storage integration
- [x] Update meeting.recording_url
- [x] Validation

### **Phase 2: Background Processing (TODO)**
- [ ] Implement background job queue (Celery/RQ)
- [ ] Extract audio from video (ffmpeg)
- [ ] Run Whisper transcription
- [ ] Run diarization (pyannote.audio)
- [ ] Generate transcript chunks
- [ ] Auto-generate meeting minutes
- [ ] Update processing status

### **Phase 3: Enhancements (Future)**
- [ ] Progress tracking for upload
- [ ] Progress tracking for processing
- [ ] Video compression before upload
- [ ] Multiple format support (1080p, 720p, 480p)
- [ ] Thumbnail generation
- [ ] Video metadata extraction (duration, resolution)
- [ ] Delete video from storage
- [ ] Video versioning

---

## 🐛 Known Issues & Limitations

### **Current Limitations:**
1. **No background job** - `trigger_inference` returns mock `job_id`
2. **No progress tracking** - Upload/processing progress not tracked
3. **Presigned URLs expire** - URLs expire after 24 hours
4. **No video deletion** - Videos not deleted from storage when meeting deleted
5. **No metadata** - Duration, format, size not stored

### **Future Fixes:**
- Implement Celery/RQ for background jobs
- Add WebSocket for progress updates
- Store metadata in database (Option 2 design)
- Implement video deletion on meeting delete
- Extract and store video metadata

---

## 📚 Related Documentation

- `VIDEO_STORAGE_DESIGN.md` - Database design options
- `VIDEO_UPLOAD_FEATURE.md` - Frontend implementation
- `local_worker/README.md` - Inference models documentation

---

## ✅ Checklist

### **Backend (Done ✅)**
- [x] Video upload endpoint
- [x] Video service layer
- [x] Storage integration (Supabase S3 + local fallback)
- [x] File validation (type, size)
- [x] Update meeting.recording_url
- [x] Trigger inference endpoint (mock)
- [x] Error handling
- [x] Documentation

### **Backend (TODO ⚠️)**
- [ ] Background job queue
- [ ] Audio extraction from video
- [ ] Transcription pipeline
- [ ] Diarization pipeline
- [ ] Progress tracking
- [ ] Video metadata extraction
- [ ] Video deletion

---

**Backend implementation completed! 🎉**

Ready for integration with frontend. Next step: Implement background job processing.

