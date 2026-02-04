# 📝 Transcript Storage Flow - In-Meeting to Post-Meeting

## 📋 Overview

Tài liệu này mô tả cách transcript được lưu trong in-meeting và được sử dụng trong post-meeting.

---

## 🗄️ Database Schema

### **transcript_chunk Table**

```sql
CREATE TABLE transcript_chunk (
    id UUID PRIMARY KEY,
    meeting_id UUID REFERENCES meeting(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,           -- Thứ tự chunk
    start_time FLOAT NOT NULL,          -- Giây từ đầu cuộc họp
    end_time FLOAT NOT NULL,
    speaker TEXT,                       -- Speaker label từ diarization
    speaker_user_id UUID,               -- Mapped user nếu identified
    text TEXT NOT NULL,                 -- Nội dung transcript
    confidence FLOAT DEFAULT 0.0,
    language TEXT DEFAULT 'vi',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 Flow: In-Meeting → Database → Post-Meeting

### **1. In-Meeting: Transcript Ingestion**

#### **A. Realtime (WebSocket)**

```typescript
// WebSocket connection
ws://localhost:8000/api/v1/ws/in-meeting/{session_id}?token={token}

// Send transcript chunk
{
  "type": "transcript",
  "payload": {
    "seq": 1,
    "time_start": 0.0,
    "time_end": 2.5,
    "speaker": "SPEAKER_01",
    "text": "Hôm nay chúng ta nói về...",
    "confidence": 0.95,
    "lang": "vi",
    "is_final": true
  }
}
```

**Backend Processing:**
1. WebSocket handler: `backend/app/api/v1/websocket/in_meeting_ws.py`
2. Calls `ingestTranscript()` → `realtime_ingest.py`
3. Persists to DB: `persist_transcript()` → `in_meeting_persistence.py`
4. Saves to `transcript_chunk` table

#### **B. REST API (Batch Upload)**

```http
POST /api/v1/transcripts/{meeting_id}/chunks
Content-Type: application/json

{
  "chunk_index": 1,
  "start_time": 0.0,
  "end_time": 2.5,
  "speaker": "SPEAKER_01",
  "text": "Hôm nay chúng ta nói về...",
  "confidence": 0.95,
  "language": "vi",
  "speaker_user_id": null
}
```

**Batch Upload:**
```http
POST /api/v1/transcripts/{meeting_id}/chunks/batch
Content-Type: application/json

[
  {
    "chunk_index": 1,
    "start_time": 0.0,
    "end_time": 2.5,
    "speaker": "SPEAKER_01",
    "text": "Hôm nay chúng ta nói về...",
    ...
  },
  {
    "chunk_index": 2,
    "start_time": 2.5,
    "end_time": 5.0,
    "speaker": "SPEAKER_02",
    "text": "Dâu",
    ...
  }
]
```

---

### **2. Database Storage**

Transcript chunks được lưu vào `transcript_chunk` table với:
- `meeting_id` - Link với meeting
- `chunk_index` - Thứ tự để ghép lại
- `start_time` / `end_time` - Timestamp (seconds)
- `speaker` - Speaker label (SPEAKER_01, SPEAKER_02, etc.)
- `text` - Nội dung transcript
- `confidence` - Confidence score
- `language` - Language code (default: "vi")

---

### **3. Post-Meeting: Reading Transcripts**

#### **A. List Chunks**

```http
GET /api/v1/transcripts/{meeting_id}?from_index=0&to_index=100&limit=100
```

**Response:**
```json
{
  "chunks": [
    {
      "id": "...",
      "meeting_id": "...",
      "chunk_index": 1,
      "start_time": 0.0,
      "end_time": 2.5,
      "speaker": "SPEAKER_01",
      "speaker_user_id": null,
      "speaker_name": null,
      "text": "Hôm nay chúng ta nói về...",
      "confidence": 0.95,
      "language": "vi",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### **B. Get Full Transcript**

```http
GET /api/v1/transcripts/{meeting_id}/full
```

**Response:**
```json
{
  "meeting_id": "...",
  "transcript": "[SPEAKER_01]: Hôm nay chúng ta nói về...\n[SPEAKER_02]: Dâu"
}
```

---

## 📊 Frontend API Usage

### **1. List Transcripts**

```typescript
import { transcriptsApi } from '@/lib/api/transcripts';

// List chunks
const chunks = await transcriptsApi.list(meetingId, {
  from_index: 0,
  to_index: 100,
  limit: 100
});

console.log(chunks.chunks); // Array of TranscriptChunk
```

### **2. Get Full Transcript**

```typescript
const fullTranscript = await transcriptsApi.getFull(meetingId);
console.log(fullTranscript.transcript); // Full text
```

### **3. Save Transcript Chunk**

```typescript
// Single chunk
await transcriptsApi.ingest(meetingId, {
  chunk_index: 1,
  start_time: 0.0,
  end_time: 2.5,
  speaker: "SPEAKER_01",
  text: "Hôm nay chúng ta nói về...",
  confidence: 0.95,
  language: "vi"
});

// Batch chunks
await transcriptsApi.ingestBatch(meetingId, [
  { chunk_index: 1, start_time: 0.0, end_time: 2.5, text: "...", ... },
  { chunk_index: 2, start_time: 2.5, end_time: 5.0, text: "...", ... }
]);
```

---

## 🔧 Backend API Endpoints

### **CRUD Operations**

```
GET    /api/v1/transcripts/{meeting_id}              # List chunks
GET    /api/v1/transcripts/{meeting_id}/full         # Get full transcript
POST   /api/v1/transcripts/{meeting_id}/chunks       # Create single chunk
POST   /api/v1/transcripts/{meeting_id}/chunks/batch # Create batch chunks
PUT    /api/v1/transcripts/chunks/{chunk_id}         # Update chunk
DELETE /api/v1/transcripts/{meeting_id}              # Delete all chunks
```

### **AI Extraction**

```
POST /api/v1/transcripts/{meeting_id}/extract/actions    # Extract actions
POST /api/v1/transcripts/{meeting_id}/extract/decisions  # Extract decisions
POST /api/v1/transcripts/{meeting_id}/extract/risks      # Extract risks
POST /api/v1/transcripts/{meeting_id}/recap/generate     # Generate live recap
```

---

## 📝 Data Structure

### **Frontend Interface**

```typescript
interface TranscriptChunk {
  id: string;
  meeting_id: string;
  chunk_index: number;
  start_time: number;
  end_time: number;
  speaker?: string;
  speaker_user_id?: string;
  speaker_name?: string;  // From user_account if mapped
  text: string;
  confidence?: number;
  language?: string;
  created_at?: string;
}
```

### **Backend Schema**

```python
class TranscriptChunkCreate(BaseModel):
    chunk_index: int
    start_time: float
    end_time: float
    speaker: Optional[str] = None
    speaker_user_id: Optional[str] = None
    text: str
    confidence: float = 0.0
    language: str = "vi"
```

---

## 🔄 Complete Flow Example

### **Step 1: In-Meeting - Save Transcript**

```typescript
// During meeting, save transcript chunk
await transcriptsApi.ingest(meetingId, {
  chunk_index: 1,
  start_time: 0.0,
  end_time: 2.5,
  speaker: "SPEAKER_01",
  text: "Hôm nay chúng ta nói về nợ...",
  confidence: 0.95,
  language: "vi"
});
```

### **Step 2: Post-Meeting - Read Transcript**

```typescript
// Load transcripts for display
const transcriptData = await transcriptsApi.list(meetingId);
setTranscripts(transcriptData.chunks);

// Or get full transcript for AI processing
const fullTranscript = await transcriptsApi.getFull(meetingId);
// Use fullTranscript.transcript for AI generation
```

### **Step 3: Post-Meeting - Generate Minutes**

```typescript
// Generate minutes with transcript
await minutesApi.generate({
  meeting_id: meetingId,
  template_id: templateId,
  include_transcript: true,  // Uses transcript from database
  format: 'markdown'
});
```

---

## ✅ API Status

### **Backend (Done ✅)**
- [x] POST `/transcripts/{meeting_id}/chunks` - Save single chunk
- [x] POST `/transcripts/{meeting_id}/chunks/batch` - Save batch chunks
- [x] GET `/transcripts/{meeting_id}` - List chunks
- [x] GET `/transcripts/{meeting_id}/full` - Get full transcript
- [x] PUT `/transcripts/chunks/{chunk_id}` - Update chunk
- [x] DELETE `/transcripts/{meeting_id}` - Delete all chunks

### **Frontend (Fixed ✅)**
- [x] Fixed API client to match backend schema
- [x] Updated interface: `chunk` → `text`, `time_start` → `start_time`, etc.
- [x] Added `ingestBatch()` method
- [x] Added `getFull()` method
- [x] Fixed endpoint paths

---

## 🧪 Testing

### **1. Save Transcript Chunk**

```bash
curl -X POST "http://localhost:8000/api/v1/transcripts/{meeting_id}/chunks" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "chunk_index": 1,
    "start_time": 0.0,
    "end_time": 2.5,
    "speaker": "SPEAKER_01",
    "text": "Hôm nay chúng ta nói về nợ...",
    "confidence": 0.95,
    "language": "vi"
  }'
```

### **2. List Transcripts**

```bash
curl -X GET "http://localhost:8000/api/v1/transcripts/{meeting_id}" \
  -H "Authorization: Bearer {token}"
```

### **3. Get Full Transcript**

```bash
curl -X GET "http://localhost:8000/api/v1/transcripts/{meeting_id}/full" \
  -H "Authorization: Bearer {token}"
```

---

## 🎯 Usage in Post-Meeting Tab

### **Load Transcripts**

```typescript
// In PostMeetTabFireflies.tsx
const transcriptData = await transcriptsApi.list(meeting.id);
setTranscripts(transcriptData.chunks);

// Display in transcript panel
transcripts.map(chunk => (
  <div>
    <span>{chunk.speaker}</span>
    <span>{formatTime(chunk.start_time)}</span>
    <p>{chunk.text}</p>
  </div>
))
```

### **Use for AI Generation**

```typescript
// Get full transcript for AI
const fullTranscript = await transcriptsApi.getFull(meeting.id);

// Generate minutes with transcript
await minutesApi.generate({
  meeting_id: meeting.id,
  template_id: templateId,
  include_transcript: true,  // Backend uses transcript from DB
  format: 'markdown'
});
```

---

**Transcript storage flow completed! 🎉**

Transcript được lưu vào database trong in-meeting và sử dụng trong post-meeting.

