# 🔧 Transcript Schema Fix - Backward Compatibility

## 📋 Problem

Database `transcript_chunk` table has **duplicate columns** from different migrations:
- `start_time` / `end_time` (from original schema)
- `time_start` / `time_end` (from SQLAlchemy model)
- `language` (from original schema)
- `lang` (from SQLAlchemy model)
- `is_final` (from SQLAlchemy model)

## ✅ Solution

Updated `transcript_service.py` to support **both column sets** for backward compatibility:

### **1. INSERT Statement**

```sql
INSERT INTO transcript_chunk (
    id, meeting_id, chunk_index, 
    start_time, end_time, time_start, time_end,  -- Both sets
    speaker, speaker_user_id, text, confidence, 
    language, lang, is_final, created_at         -- Both sets
)
VALUES (
    :id, :meeting_id, :chunk_index, 
    :start_time, :end_time, :start_time, :end_time,  -- Map to both
    :speaker, :speaker_user_id, :text, :confidence, 
    :language, :language, :is_final, :created_at      -- Map to both
)
```

### **2. SELECT Statement (COALESCE)**

```sql
SELECT 
    tc.id::text, tc.meeting_id::text, tc.chunk_index,
    COALESCE(tc.start_time, tc.time_start, 0.0) as start_time,
    COALESCE(tc.end_time, tc.time_end, 0.0) as end_time,
    tc.speaker,
    tc.speaker_user_id::text, tc.text, tc.confidence,
    COALESCE(tc.language, tc.lang, 'vi') as language, tc.created_at,
    u.display_name as speaker_name
FROM transcript_chunk tc
...
```

### **3. UPDATE Statement (COALESCE)**

```sql
UPDATE transcript_chunk
SET ...
WHERE id = :chunk_id
RETURNING 
    id::text, meeting_id::text, chunk_index,
    COALESCE(start_time, time_start, 0.0) as start_time,
    COALESCE(end_time, time_end, 0.0) as end_time,
    ...
    COALESCE(language, lang, 'vi') as language, created_at
```

---

## 🎯 Benefits

1. **Backward Compatible**: Works with existing data in both column sets
2. **Forward Compatible**: New inserts populate both sets
3. **No Migration Needed**: Existing code continues to work
4. **Flexible**: Can read from either column set

---

## 📝 Notes

- `is_final` defaults to `True` for API-created chunks
- `language` defaults to `'vi'` if not provided
- `start_time`/`end_time` take precedence over `time_start`/`time_end` when reading
- `language` takes precedence over `lang` when reading

---

## 🔄 Future Migration (Optional)

If you want to clean up the schema later:

```sql
-- 1. Migrate data from time_start/time_end to start_time/end_time
UPDATE transcript_chunk 
SET start_time = COALESCE(start_time, time_start),
    end_time = COALESCE(end_time, time_end),
    language = COALESCE(language, lang)
WHERE start_time IS NULL OR end_time IS NULL OR language IS NULL;

-- 2. Drop duplicate columns
ALTER TABLE transcript_chunk DROP COLUMN time_start;
ALTER TABLE transcript_chunk DROP COLUMN time_end;
ALTER TABLE transcript_chunk DROP COLUMN lang;
```

---

**Backend now supports both column sets! ✅**

