# 🎥 Video Upload & Processing Feature

## 📋 Overview

Thêm tính năng **upload video** vào Post-Meeting tab với:
- ✅ **Video Player** - Hiển thị video nếu đã có recording
- ✅ **Upload Zone** - Drag & drop hoặc click để upload video
- ✅ **Auto Processing** - Tự động trigger inference (transcription + diarization) sau khi upload
- ✅ **UI/UX** - Giống Fireflies.ai style

---

## 🎯 Features

### **1. Video Player (Nếu có video)**
- 📹 Hiển thị video player với controls
- 🎬 Auto-play khi có `recording_url`
- 📐 Responsive, max-height 400px

### **2. Upload Zone (Nếu chưa có video)**
- 📤 **Drag & Drop** - Kéo thả video vào zone
- 🖱️ **Click to Upload** - Click button để chọn file
- 📋 **Format Support** - MP4, MOV, AVI, MKV, WebM
- ⏳ **Upload Progress** - Loading state khi đang upload
- 🔄 **Processing State** - Hiển thị khi AI đang xử lý

### **3. Auto Processing**
- 🎯 Sau khi upload thành công → Tự động trigger inference
- 📝 Tạo transcript từ video
- 🎤 Diarization (phân biệt người nói)
- 📄 Tự động generate biên bản họp

---

## 📂 Files Modified

### **Frontend**

#### **1. `PostMeetTabFireflies.tsx`**
- ✅ Thêm `VideoSection` component
- ✅ Thêm drag & drop handlers
- ✅ Thêm upload logic
- ✅ Thêm processing state

**Key Changes:**
```tsx
// Video Section ở đầu Center Panel
<VideoSection
  recordingUrl={meeting.recording_url}
  onUpload={handleVideoUpload}
  isUploading={isUploadingVideo}
  isProcessing={isProcessingVideo}
  dragActive={dragActive}
  onDrag={handleDrag}
  onDrop={handleDrop}
  onFileInput={handleFileInput}
/>
```

#### **2. `meetings.ts` (API Client)**
- ✅ Thêm `uploadVideo()` method
- ✅ Thêm `triggerInference()` method

**New API Methods:**
```typescript
// Upload video
uploadVideo: async (meetingId: string, file: File): Promise<{ recording_url: string; message: string }>

// Trigger inference
triggerInference: async (meetingId: string): Promise<{ job_id: string; message: string }>
```

#### **3. `fireflies.css`**
- ✅ Thêm styles cho video section
- ✅ Thêm upload zone styles
- ✅ Thêm drag & drop visual feedback
- ✅ Thêm loading animations

**New CSS Classes:**
- `.fireflies-video-section` - Container
- `.fireflies-video-player` - Video player wrapper
- `.fireflies-video-upload` - Upload zone
- `.fireflies-upload-status` - Loading state
- `.fireflies-upload-button` - Upload button

---

## 🔌 Backend API Endpoints (Cần implement)

### **1. Upload Video**
```
POST /api/v1/meetings/{meeting_id}/upload-video

Request:
  - Content-Type: multipart/form-data
  - Body: { video: File }

Response:
  {
    "recording_url": "https://storage.example.com/videos/abc123.mp4",
    "message": "Video uploaded successfully"
  }
```

**Implementation Notes:**
- Upload video file to storage (Supabase S3 hoặc local)
- Save `recording_url` to meeting record
- Return presigned URL nếu cần

### **2. Trigger Inference**
```
POST /api/v1/meetings/{meeting_id}/trigger-inference

Request:
  {}

Response:
  {
    "job_id": "job_abc123",
    "message": "Inference job started"
  }
```

**Implementation Notes:**
- Trigger background job để:
  1. Extract audio từ video
  2. Run Whisper transcription
  3. Run diarization (pyannote.audio)
  4. Generate transcript chunks
  5. Auto-generate meeting minutes

**Suggested Flow:**
```python
# backend/app/api/v1/meetings.py

@router.post("/{meeting_id}/trigger-inference")
async def trigger_inference(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    meeting = get_meeting(db, meeting_id)
    if not meeting or not meeting.recording_url:
        raise HTTPException(404, "Meeting or video not found")
    
    # Queue background job
    job_id = queue_inference_job(meeting_id, meeting.recording_url)
    
    return {
        "job_id": job_id,
        "message": "Inference job started"
    }
```

---

## 🎨 UI/UX Flow

### **Scenario 1: Chưa có video**
```
1. User vào Post-Meeting tab
   ↓
2. Thấy Upload Zone (drag & drop)
   ↓
3. User kéo thả video hoặc click "Chọn file video"
   ↓
4. Upload bắt đầu → Hiển thị "Đang tải lên video..."
   ↓
5. Upload thành công → Hiển thị "Đang xử lý video..."
   ↓
6. AI xử lý xong → Video player xuất hiện + Transcript được tạo
```

### **Scenario 2: Đã có video**
```
1. User vào Post-Meeting tab
   ↓
2. Thấy Video Player với video đã có
   ↓
3. User có thể play/pause video
   ↓
4. Transcript đã được tạo từ video
```

---

## 📊 Component Structure

```
PostMeetTabFireflies
├── LeftPanel (Filters)
├── CenterPanel
│   ├── VideoSection ⭐ NEW
│   │   ├── VideoPlayer (nếu có recording_url)
│   │   └── UploadZone (nếu chưa có)
│   │       ├── Drag & Drop handler
│   │       ├── File input
│   │       └── Upload/Processing states
│   ├── AI Content Header
│   ├── Threads (Summary | Actions | Decisions)
│   └── Content
└── RightPanel (Transcript)
```

---

## 🔧 Integration Checklist

### **Frontend (Done ✅)**
- [x] VideoSection component
- [x] Upload zone với drag & drop
- [x] Video player
- [x] Loading states
- [x] API client methods
- [x] CSS styles

### **Backend (TODO ⚠️)**
- [ ] `POST /meetings/{id}/upload-video` endpoint
- [ ] `POST /meetings/{id}/trigger-inference` endpoint
- [ ] Video storage integration (Supabase S3)
- [ ] Background job queue (Celery hoặc similar)
- [ ] Inference pipeline:
  - [ ] Extract audio from video
  - [ ] Whisper transcription
  - [ ] Diarization (pyannote.audio)
  - [ ] Generate transcript chunks
  - [ ] Auto-generate minutes

---

## 🧪 Testing

### **1. Upload Video Test**
```bash
# Test upload
1. Navigate to Meeting Detail → Post-Meeting tab
2. Drag & drop video file
3. Verify upload progress
4. Verify video player appears after upload
```

### **2. Video Player Test**
```bash
# Test player
1. Navigate to meeting with recording_url
2. Verify video player displays
3. Test play/pause controls
4. Verify responsive sizing
```

### **3. Processing Test**
```bash
# Test inference
1. Upload video
2. Verify "Processing" state appears
3. Wait for job completion
4. Verify transcript chunks created
5. Verify minutes generated
```

---

## 🎯 Next Steps

### **Phase 1: Backend Implementation**
1. ✅ Create upload endpoint
2. ✅ Integrate storage (Supabase S3)
3. ✅ Create inference trigger endpoint
4. ✅ Set up background job queue

### **Phase 2: Inference Pipeline**
1. ✅ Extract audio from video (ffmpeg)
2. ✅ Run Whisper transcription
3. ✅ Run diarization
4. ✅ Save transcript chunks
5. ✅ Auto-generate minutes

### **Phase 3: Enhancements**
- [ ] Progress bar cho upload
- [ ] Progress indicator cho processing
- [ ] Video thumbnail preview
- [ ] Video trimming/cutting
- [ ] Multiple video support
- [ ] Video quality selection

---

## 📚 API Reference

### **Upload Video**
```typescript
const result = await meetingsApi.uploadVideo(meetingId, file);
// Returns: { recording_url: string; message: string }
```

### **Trigger Inference**
```typescript
const result = await meetingsApi.triggerInference(meetingId);
// Returns: { job_id: string; message: string }
```

---

## 🐛 Known Issues & TODOs

### **Current Limitations**
- [ ] Backend endpoints chưa implement
- [ ] No progress tracking cho upload
- [ ] No progress tracking cho processing
- [ ] No error recovery

### **Future Enhancements**
- [ ] Resume upload nếu bị gián đoạn
- [ ] Video compression trước khi upload
- [ ] Preview video trước khi upload
- [ ] Video metadata (duration, size, format)
- [ ] Video playback với transcript sync

---

## 💡 Usage Example

```tsx
// Component automatically handles:
// 1. Check if meeting has recording_url
// 2. Show video player if exists
// 3. Show upload zone if not exists
// 4. Handle upload & processing

<PostMeetTabFireflies 
  meeting={meeting}
  onRefresh={fetchMeeting}
/>
```

---

## 🎨 Design Notes

### **Upload Zone States**
- **Default**: Dashed border, hover effect
- **Drag Active**: Solid border, blue background
- **Uploading**: Loading spinner, disabled
- **Processing**: Loading spinner, "AI đang xử lý..."

### **Video Player**
- Max height: 400px
- Responsive width
- Native HTML5 controls
- Rounded corners

---

**Feature completed! 🎉**

Video upload & processing đã sẵn sàng. Chỉ cần implement backend endpoints! ✨

