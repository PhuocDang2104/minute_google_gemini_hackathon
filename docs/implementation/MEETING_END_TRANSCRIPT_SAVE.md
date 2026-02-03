# 💾 Meeting End - Auto Save Transcript

## 📋 Overview

Khi user bấm "Kết thúc họp" (stop meeting), hệ thống tự động lưu transcript từ session store vào database để phục vụ cho post-meeting processing.

---

## 🔄 Flow

```
User clicks "Kết thúc họp"
    ↓
Frontend: meetingsApi.updatePhase(meetingId, 'post')
    ↓
Backend: PATCH /api/v1/meetings/{meeting_id}/phase
    ↓
meeting_service.update_phase() → Update phase to 'post'
    ↓
Check if phase == 'post'
    ↓
Get session from session_store.get(meeting_id)
    ↓
Extract final_stream (FinalTranscriptChunk[])
    ↓
Convert to TranscriptChunkCreate[]
    ↓
Check if transcript already exists (avoid duplicates)
    ↓
Save to database: transcript_service.create_batch_transcript_chunks()
```

---

## 🔧 Implementation

### **Backend: `backend/app/api/v1/endpoints/meetings.py`**

```python
@router.patch('/{meeting_id}/phase', response_model=Meeting)
def update_meeting_phase(
    meeting_id: str,
    phase: str,
    db: Session = Depends(get_db)
):
    """Update meeting phase (pre -> in -> post)"""
    # ... validate phase ...
    
    meeting = meeting_service.update_phase(db=db, meeting_id=meeting_id, phase=phase)
    
    # When ending meeting (phase -> 'post'), save transcript from session store to database
    if phase == 'post':
        session = session_store.get(meeting_id)
        if session and session.stream_state and session.stream_state.final_stream:
            # Convert FinalTranscriptChunk to TranscriptChunkCreate
            # Check if transcript already exists (avoid duplicates)
            # Save to database using transcript_service.create_batch_transcript_chunks()
    
    return meeting
```

---

## 📊 Data Structure

### **From Session Store**

```python
session.stream_state.final_stream  # List[FinalTranscriptChunk]

class FinalTranscriptChunk:
    seq: int
    time_start: float
    time_end: float
    speaker: str
    lang: str
    confidence: float
    text: str
```

### **To Database**

```python
TranscriptChunkCreate(
    chunk_index: int          # From enumerate (1, 2, 3, ...)
    start_time: float         # From chunk.time_start
    end_time: float           # From chunk.time_end
    speaker: str              # From chunk.speaker
    text: str                 # From chunk.text
    confidence: float         # From chunk.confidence
    language: str             # From chunk.lang
    meeting_id: str           # From meeting_id
)
```

---

## 🛡️ Safety Features

### **1. Duplicate Prevention**

```python
# Check if transcript already exists
existing_chunks = transcript_service.list_transcript_chunks(
    db=db,
    meeting_id=meeting_id,
    limit=1
)

# Only save if no transcript exists
if existing_chunks.total == 0:
    # Save transcript chunks
```

### **2. Error Handling**

```python
try:
    # Save transcript
except Exception as e:
    # Log error but don't fail the phase update
    logger.error(f"Failed to save transcript: {e}", exc_info=True)
    # Phase update still succeeds
```

### **3. Logging**

- Log success: `"Saved {count} transcript chunks for meeting {meeting_id}"`
- Log skip: `"Transcript already exists for meeting {meeting_id}, skipping save"`
- Log error: `"Failed to save transcript when ending meeting {meeting_id}: {e}"`

---

## ✅ Benefits

1. **Automatic**: No manual step needed
2. **Reliable**: Transcript saved when meeting ends
3. **Safe**: Won't fail phase update if transcript save fails
4. **No Duplicates**: Checks before saving
5. **Ready for Post-Meeting**: Transcript available immediately after meeting ends

---

## 🔍 Testing

### **Test Case 1: Normal Flow**

1. Start meeting → transcript chunks accumulate in session
2. End meeting → transcript saved to database
3. Check database: `SELECT * FROM transcript_chunk WHERE meeting_id = '{meeting_id}'`
4. Verify all chunks are saved with correct data

### **Test Case 2: Duplicate Prevention**

1. End meeting → transcript saved
2. End meeting again → should skip (already exists)
3. Check logs: should see "Transcript already exists, skipping save"

### **Test Case 3: Error Handling**

1. Simulate error (e.g., invalid session)
2. End meeting → phase update should still succeed
3. Check logs: should see error logged but phase updated

---

## 📝 Notes

- Session ID is assumed to be the same as `meeting_id`
- Transcript is saved from `session.stream_state.final_stream` (only final chunks)
- Partial/interim chunks are not saved (only final confirmed chunks)
- Batch insert is used for efficiency

---

**Auto-save transcript on meeting end completed! ✅**

