"""
Transcript Service
"""
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Set, Optional

from app.schemas.transcript import (
    TranscriptChunkCreate, TranscriptChunkUpdate, 
    TranscriptChunkResponse, TranscriptChunkList,
    LiveRecapSnapshot
)


def list_transcript_chunks(
    db: Session, 
    meeting_id: str,
    from_index: Optional[int] = None,
    to_index: Optional[int] = None,
    limit: int = 100
) -> TranscriptChunkList:
    """List transcript chunks for a meeting"""
    columns = _get_transcript_columns(db)
    
    conditions = ["meeting_id = :meeting_id"]
    params = {'meeting_id': meeting_id, 'limit': limit}
    
    if from_index is not None:
        conditions.append("chunk_index >= :from_index")
        params['from_index'] = from_index
    if to_index is not None:
        conditions.append("chunk_index <= :to_index")
        params['to_index'] = to_index
    
    where_clause = " AND ".join(conditions)
    
    start_expr = _start_time_expr(columns)
    end_expr = _end_time_expr(columns)
    language_expr = _language_expr(columns)
    speaker_user_expr = "tc.speaker_user_id::text" if "speaker_user_id" in columns else "NULL::text"
    speaker_name_expr = "u.display_name" if "speaker_user_id" in columns else "NULL"
    join_user = "LEFT JOIN user_account u ON tc.speaker_user_id = u.id" if "speaker_user_id" in columns else ""

    query = text(f"""
        SELECT 
            tc.id::text, tc.meeting_id::text, tc.chunk_index,
            {start_expr} as start_time,
            {end_expr} as end_time,
            tc.speaker,
            {speaker_user_expr} as speaker_user_id,
            tc.text, tc.confidence,
            {language_expr} as language, tc.created_at,
            {speaker_name_expr} as speaker_name
        FROM transcript_chunk tc
        {join_user}
        WHERE {where_clause}
        ORDER BY tc.chunk_index ASC
        LIMIT :limit
    """)
    
    result = db.execute(query, params)
    rows = result.fetchall()
    
    chunks = []
    for row in rows:
        chunks.append(TranscriptChunkResponse(
            id=row[0],
            meeting_id=row[1],
            chunk_index=row[2],
            start_time=row[3],
            end_time=row[4],
            speaker=row[5],
            speaker_user_id=row[6],
            text=row[7],
            confidence=row[8],
            language=row[9],
            created_at=row[10],
            speaker_name=row[11]
        ))
    
    return TranscriptChunkList(chunks=chunks, total=len(chunks))


def get_full_transcript(db: Session, meeting_id: str) -> str:
    """Get full transcript text for a meeting"""
    query = text("""
        SELECT speaker, text
        FROM transcript_chunk
        WHERE meeting_id = :meeting_id
        ORDER BY chunk_index ASC
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    rows = result.fetchall()
    
    transcript_lines = []
    for row in rows:
        speaker = row[0] or "Unknown"
        text_content = row[1]
        transcript_lines.append(f"[{speaker}]: {text_content}")
    
    return "\n".join(transcript_lines)


def create_transcript_chunk(db: Session, data: TranscriptChunkCreate) -> TranscriptChunkResponse:
    """Create a new transcript chunk"""
    chunk_id = str(uuid4())
    now = datetime.utcnow()

    columns = _get_transcript_columns(db)

    fields = ["id", "meeting_id", "chunk_index", "speaker", "text", "confidence", "created_at"]
    params = {
        "id": chunk_id,
        "meeting_id": data.meeting_id,
        "chunk_index": data.chunk_index,
        "speaker": data.speaker,
        "text": data.text,
        "confidence": data.confidence,
        "created_at": now,
    }

    # Time columns (start/end) - support both legacy and new schemas
    if "start_time" in columns:
        fields.append("start_time")
        params["start_time"] = data.start_time
    elif "time_start" in columns:
        fields.append("time_start")
        params["time_start"] = data.start_time

    if "end_time" in columns:
        fields.append("end_time")
        params["end_time"] = data.end_time
    elif "time_end" in columns:
        fields.append("time_end")
        params["time_end"] = data.end_time

    # Language columns
    if "language" in columns:
        fields.append("language")
        params["language"] = data.language
    elif "lang" in columns:
        fields.append("lang")
        params["lang"] = data.language

    # Optional columns
    if "speaker_user_id" in columns:
        fields.append("speaker_user_id")
        params["speaker_user_id"] = data.speaker_user_id
    if "is_final" in columns:
        fields.append("is_final")
        params["is_final"] = True

    placeholders = ", ".join([f":{name}" for name in fields])
    query = text(f"""
        INSERT INTO transcript_chunk (
            {', '.join(fields)}
        )
        VALUES (
            {placeholders}
        )
        RETURNING id::text
    """)
    
    db.execute(query, params)
    db.commit()
    
    return TranscriptChunkResponse(
        id=chunk_id,
        meeting_id=data.meeting_id,
        chunk_index=data.chunk_index,
        start_time=data.start_time,
        end_time=data.end_time,
        speaker=data.speaker,
        speaker_user_id=data.speaker_user_id,
        text=data.text,
        confidence=data.confidence,
        language=data.language,
        created_at=now
    )


def create_batch_transcript_chunks(
    db: Session, 
    meeting_id: str, 
    chunks: List[TranscriptChunkCreate]
) -> TranscriptChunkList:
    """Create multiple transcript chunks at once"""
    created_chunks = []
    
    for chunk in chunks:
        chunk.meeting_id = meeting_id
        created_chunk = create_transcript_chunk(db, chunk)
        created_chunks.append(created_chunk)
    
    return TranscriptChunkList(chunks=created_chunks, total=len(created_chunks))


def update_transcript_chunk(
    db: Session, 
    chunk_id: str, 
    data: TranscriptChunkUpdate
) -> Optional[TranscriptChunkResponse]:
    """Update a transcript chunk"""
    columns = _get_transcript_columns(db)
    updates = []
    params = {'chunk_id': chunk_id}
    
    if data.text is not None:
        updates.append("text = :text")
        params['text'] = data.text
    if data.speaker is not None:
        updates.append("speaker = :speaker")
        params['speaker'] = data.speaker
    if data.speaker_user_id is not None and "speaker_user_id" in columns:
        updates.append("speaker_user_id = :speaker_user_id")
        params['speaker_user_id'] = data.speaker_user_id
    
    if not updates:
        return None
    
    start_expr = _start_time_expr(columns, prefix="")
    end_expr = _end_time_expr(columns, prefix="")
    language_expr = _language_expr(columns, prefix="")
    speaker_user_expr = "speaker_user_id::text" if "speaker_user_id" in columns else "NULL::text"

    query = text(f"""
        UPDATE transcript_chunk
        SET {', '.join(updates)}
        WHERE id = :chunk_id
        RETURNING id::text, meeting_id::text, chunk_index,
            {start_expr} as start_time,
            {end_expr} as end_time,
            speaker, {speaker_user_expr} as speaker_user_id,
            text, confidence,
            {language_expr} as language, created_at
    """)
    
    result = db.execute(query, params)
    db.commit()
    row = result.fetchone()
    
    if not row:
        return None
    
    return TranscriptChunkResponse(
        id=row[0],
        meeting_id=row[1],
        chunk_index=row[2],
        start_time=row[3],
        end_time=row[4],
        speaker=row[5],
        speaker_user_id=row[6],
        text=row[7],
        confidence=row[8],
        language=row[9],
        created_at=row[10]
    )


def delete_transcript_chunks(db: Session, meeting_id: str) -> int:
    """Delete all transcript chunks for a meeting"""
    query = text("""
        DELETE FROM transcript_chunk 
        WHERE meeting_id = :meeting_id
        RETURNING id
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    db.commit()
    
    return len(result.fetchall())


_TRANSCRIPT_COLUMNS: Optional[Set[str]] = None


def _get_transcript_columns(db: Session) -> Set[str]:
    """Cache transcript_chunk columns to handle schema variants."""
    global _TRANSCRIPT_COLUMNS
    if _TRANSCRIPT_COLUMNS is None:
        try:
            result = db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'transcript_chunk'
            """))
            _TRANSCRIPT_COLUMNS = {row[0] for row in result.fetchall()}
        except Exception:
            # Fallback to legacy schema
            _TRANSCRIPT_COLUMNS = {
                "id", "meeting_id", "chunk_index", "speaker", "text",
                "time_start", "time_end", "lang", "confidence", "created_at", "updated_at", "is_final",
            }
    return _TRANSCRIPT_COLUMNS


def _start_time_expr(columns: Set[str], prefix: str = "tc.") -> str:
    p = prefix
    if "start_time" in columns and "time_start" in columns:
        return f"COALESCE({p}start_time, {p}time_start, 0.0)"
    if "start_time" in columns:
        return f"COALESCE({p}start_time, 0.0)"
    if "time_start" in columns:
        return f"COALESCE({p}time_start, 0.0)"
    return "0.0"


def _end_time_expr(columns: Set[str], prefix: str = "tc.") -> str:
    p = prefix
    if "end_time" in columns and "time_end" in columns:
        return f"COALESCE({p}end_time, {p}time_end, 0.0)"
    if "end_time" in columns:
        return f"COALESCE({p}end_time, 0.0)"
    if "time_end" in columns:
        return f"COALESCE({p}time_end, 0.0)"
    return "0.0"


def _language_expr(columns: Set[str], prefix: str = "tc.") -> str:
    p = prefix
    if "language" in columns and "lang" in columns:
        return f"COALESCE({p}language, {p}lang, 'vi')"
    if "language" in columns:
        return f"COALESCE({p}language, 'vi')"
    if "lang" in columns:
        return f"COALESCE({p}lang, 'vi')"
    return "'vi'"


# ============================================
# Live Recap
# ============================================

def get_live_recap(db: Session, meeting_id: str) -> Optional[LiveRecapSnapshot]:
    """Get the latest live recap for a meeting"""
    query = text("""
        SELECT id::text, meeting_id::text, snapshot_time, summary, 
            key_points, created_at
        FROM live_recap_snapshot
        WHERE meeting_id = :meeting_id
        ORDER BY snapshot_time DESC
        LIMIT 1
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    row = result.fetchone()
    
    if not row:
        return None
    
    return LiveRecapSnapshot(
        id=row[0],
        meeting_id=row[1],
        snapshot_time=row[2],
        summary=row[3],
        key_points=row[4],
        created_at=row[5]
    )


def create_live_recap(
    db: Session, 
    meeting_id: str, 
    summary: str, 
    key_points: Optional[List[str]] = None
) -> LiveRecapSnapshot:
    """Create a new live recap snapshot"""
    recap_id = str(uuid4())
    now = datetime.utcnow()
    
    import json
    
    query = text("""
        INSERT INTO live_recap_snapshot (
            id, meeting_id, snapshot_time, summary, key_points, created_at
        )
        VALUES (
            :id, :meeting_id, :snapshot_time, :summary, :key_points, :created_at
        )
        RETURNING id::text
    """)
    
    db.execute(query, {
        'id': recap_id,
        'meeting_id': meeting_id,
        'snapshot_time': now,
        'summary': summary,
        'key_points': json.dumps(key_points) if key_points else None,
        'created_at': now
    })
    db.commit()
    
    return LiveRecapSnapshot(
        id=recap_id,
        meeting_id=meeting_id,
        snapshot_time=now,
        summary=summary,
        key_points=key_points,
        created_at=now
    )

