# 📹 Video Storage Database Design

## 📋 Overview

Thiết kế database để lưu trữ video recordings của meetings với 2 options:
- **Option 1 (Simple)**: Chỉ dùng `recording_url` trong `meeting` table
- **Option 2 (Advanced)**: Tạo `video_recording` table riêng để lưu metadata

---

## 🎯 Option 1: Simple Design (Recommended for MVP)

### **Database Schema**

```sql
-- Meeting table đã có sẵn recording_url
CREATE TABLE meeting (
    id UUID PRIMARY KEY,
    ...
    recording_url TEXT,  -- ✅ Đã có sẵn
    ...
);
```

### **Pros:**
- ✅ Đơn giản, nhanh implement
- ✅ Không cần migration (field đã có)
- ✅ Đủ cho MVP

### **Cons:**
- ❌ Không lưu metadata (duration, format, size)
- ❌ Không track processing status
- ❌ Không có versioning

### **Implementation:**
- Upload video → Lưu vào storage (Supabase S3)
- Lấy presigned URL hoặc public URL
- Update `meeting.recording_url` với URL đó

---

## 🎯 Option 2: Advanced Design (Recommended for Production)

### **Database Schema**

```sql
-- Video Recording Table
CREATE TABLE video_recording (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    
    -- Storage Info
    storage_key TEXT NOT NULL,  -- S3 object key
    file_url TEXT,              -- Public/presigned URL
    file_size BIGINT,           -- Bytes
    file_format TEXT,           -- mp4, mov, avi, etc.
    duration_seconds INTEGER,   -- Video duration
    
    -- Processing Status
    processing_status TEXT DEFAULT 'pending',  -- pending | processing | completed | failed
    processing_error TEXT,      -- Error message if failed
    processed_at TIMESTAMPTZ,   -- When processing completed
    
    -- Metadata
    uploaded_by UUID REFERENCES user_account(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(meeting_id)  -- One video per meeting
);

CREATE INDEX idx_video_recording_meeting ON video_recording(meeting_id);
CREATE INDEX idx_video_recording_status ON video_recording(processing_status);
```

### **Pros:**
- ✅ Lưu đầy đủ metadata
- ✅ Track processing status
- ✅ Dễ mở rộng (versions, thumbnails, etc.)
- ✅ Có thể có multiple formats/qualities

### **Cons:**
- ❌ Cần migration
- ❌ Phức tạp hơn

### **Relationship:**

```
meeting (1) ──→ (1) video_recording
```

Một meeting chỉ có một video recording.

---

## 🎯 Recommendation

### **Phase 1 (MVP - Current):**
✅ Dùng **Option 1** - Chỉ `recording_url` trong meeting table

**Why?**
- Nhanh implement
- Đủ cho MVP
- Không cần migration
- Dễ maintain

### **Phase 2 (Future Enhancement):**
🔄 Nâng cấp lên **Option 2** - Tạo `video_recording` table

**When?**
- Cần track processing status
- Cần metadata (duration, format, size)
- Cần multiple versions/qualities
- Cần analytics

---

## 📊 Current Implementation (Option 1)

### **Flow:**

```
1. User uploads video
   ↓
2. Backend receives file
   ↓
3. Upload to Supabase S3 storage
   - Object key: videos/{meeting_id}/{uuid}.mp4
   ↓
4. Generate presigned/public URL
   ↓
5. Update meeting.recording_url
   ↓
6. Return URL to frontend
```

### **Storage Structure:**

```
Supabase S3 Bucket:
├── videos/
│   ├── {meeting_id_1}/
│   │   └── {uuid_1}.mp4
│   ├── {meeting_id_2}/
│   │   └── {uuid_2}.mp4
│   └── ...
```

### **URL Format:**

- **Presigned URL** (temporary, expires in 1 hour):
  ```
  https://{supabase_project}.supabase.co/storage/v1/object/sign/...
  ```

- **Public URL** (nếu bucket public):
  ```
  https://{supabase_project}.supabase.co/storage/v1/object/public/videos/{meeting_id}/{uuid}.mp4
  ```

---

## 🔄 Migration Path (Option 1 → Option 2)

### **Step 1: Create video_recording table**

```sql
-- Migration: add_video_recording_table.sql
CREATE TABLE video_recording (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    file_url TEXT,
    file_size BIGINT,
    file_format TEXT,
    duration_seconds INTEGER,
    processing_status TEXT DEFAULT 'pending',
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    uploaded_by UUID REFERENCES user_account(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meeting_id)
);

CREATE INDEX idx_video_recording_meeting ON video_recording(meeting_id);
CREATE INDEX idx_video_recording_status ON video_recording(processing_status);
```

### **Step 2: Migrate existing data**

```sql
-- Copy existing recording_url to video_recording table
INSERT INTO video_recording (meeting_id, file_url, processing_status, uploaded_at)
SELECT 
    id as meeting_id,
    recording_url as file_url,
    'completed' as processing_status,
    updated_at as uploaded_at
FROM meeting
WHERE recording_url IS NOT NULL;
```

### **Step 3: Update code**

- Update service layer to use `video_recording` table
- Keep `recording_url` in meeting table for backward compatibility (deprecated)

---

## 📝 Implementation Details

### **Storage Client Functions:**

```python
from app.services.storage_client import (
    is_storage_configured,
    build_object_key,
    upload_bytes_to_storage,
    generate_presigned_get_url,
)

# Upload video
object_key = build_object_key(filename, prefix="videos")
storage_key = upload_bytes_to_storage(video_bytes, object_key, content_type="video/mp4")
file_url = generate_presigned_get_url(storage_key, expires_in=86400)  # 24 hours
```

### **Content Types:**

- `video/mp4`
- `video/quicktime` (MOV)
- `video/x-msvideo` (AVI)
- `video/webm`
- `video/x-matroska` (MKV)

---

## 🎯 Best Practices

### **1. File Naming**

```python
# Pattern: videos/{meeting_id}/{uuid}_{safe_filename}.{ext}
object_key = f"videos/{meeting_id}/{uuid.uuid4()}_{slugify(filename)}.{ext}"
```

### **2. Storage Organization**

```
videos/
├── {meeting_id}/          # Group by meeting
│   ├── original.mp4       # Original upload
│   ├── thumbnail.jpg      # Thumbnail (future)
│   └── transcript.json    # Transcript (future)
```

### **3. URL Expiration**

- **Presigned URLs**: 24 hours (for private videos)
- **Public URLs**: Never expire (if bucket is public)

### **4. File Size Limits**

- Max file size: **500MB** (configurable)
- Compress if needed
- Show progress bar for large files

### **5. Security**

- ✅ Validate file type (only video formats)
- ✅ Validate file size
- ✅ Scan for malware (future)
- ✅ Use presigned URLs for private videos
- ✅ Check user permissions before upload

---

## 🔍 Query Examples

### **Option 1 (Current):**

```sql
-- Get meeting with video URL
SELECT id, title, recording_url
FROM meeting
WHERE id = :meeting_id AND recording_url IS NOT NULL;
```

### **Option 2 (Future):**

```sql
-- Get meeting with video metadata
SELECT 
    m.id, m.title,
    vr.file_url, vr.file_size, vr.duration_seconds, vr.processing_status
FROM meeting m
LEFT JOIN video_recording vr ON m.id = vr.meeting_id
WHERE m.id = :meeting_id;

-- Get all videos pending processing
SELECT vr.*, m.title
FROM video_recording vr
JOIN meeting m ON vr.meeting_id = m.id
WHERE vr.processing_status = 'pending'
ORDER BY vr.uploaded_at ASC;
```

---

## 📊 Future Enhancements

### **1. Multiple Formats/Qualities**

```sql
CREATE TABLE video_format (
    id UUID PRIMARY KEY,
    video_recording_id UUID REFERENCES video_recording(id),
    quality TEXT,  -- original, 1080p, 720p, 480p
    format TEXT,   -- mp4, webm
    file_url TEXT,
    file_size BIGINT,
    storage_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **2. Thumbnails**

```sql
ALTER TABLE video_recording 
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN thumbnail_storage_key TEXT;
```

### **3. Video Analytics**

```sql
CREATE TABLE video_view (
    id UUID PRIMARY KEY,
    video_recording_id UUID REFERENCES video_recording(id),
    user_id UUID REFERENCES user_account(id),
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_watched INTEGER,  -- seconds
    UNIQUE(video_recording_id, user_id)
);
```

---

## ✅ Decision: Option 1 (Current Implementation)

**Chọn Option 1 vì:**
1. ✅ Nhanh implement
2. ✅ Đủ cho MVP
3. ✅ Không cần migration
4. ✅ Dễ maintain
5. ✅ Có thể nâng cấp lên Option 2 sau

**Recording URL sẽ lưu:**
- Presigned URL (temporary, 24 hours)
- Hoặc public URL (nếu bucket public)

---

**Design completed! 🎉**

Implementation sẽ theo Option 1 (Simple Design).

