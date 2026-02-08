from datetime import datetime
from typing import Optional, List, Tuple
from uuid import uuid4
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.schemas.meeting import (
    Meeting, 
    MeetingCreate, 
    MeetingUpdate,
    MeetingWithParticipants,
    Participant
)
from app.services.storage_client import delete_object, is_storage_configured


logger = logging.getLogger(__name__)


def _table_exists(db: Session, table_name: str) -> bool:
    try:
        result = db.execute(
            text("SELECT to_regclass(:table_name)"),
            {"table_name": f"public.{table_name}"},
        ).scalar()
        return bool(result)
    except Exception:
        return False


def _table_has_column(db: Session, table_name: str, column_name: str) -> bool:
    try:
        result = db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
                LIMIT 1
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        ).fetchone()
        return bool(result)
    except Exception:
        return False


def _collect_assets_by_scope(
    db: Session,
    table_name: str,
    scope_column: str,
    scope_value: str,
) -> list[dict]:
    if not _table_exists(db, table_name) or not _table_has_column(db, table_name, scope_column):
        return []
    fields: list[str] = []
    for col in ("storage_key", "file_url", "provider"):
        if _table_has_column(db, table_name, col):
            fields.append(col)
    if not fields:
        return []
    rows = db.execute(
        text(f"SELECT {', '.join(fields)} FROM {table_name} WHERE {scope_column} = :scope_value"),
        {"scope_value": scope_value},
    ).mappings().all()
    assets: list[dict] = []
    for row in rows:
        assets.append(
            {
                "storage_key": row.get("storage_key"),
                "file_url": row.get("file_url"),
                "provider": row.get("provider"),
            }
        )
    return assets


def _delete_rows_by_scope(db: Session, table_name: str, scope_column: str, scope_value: str) -> None:
    if not _table_exists(db, table_name) or not _table_has_column(db, table_name, scope_column):
        return
    db.execute(
        text(f"DELETE FROM {table_name} WHERE {scope_column} = :scope_value"),
        {"scope_value": scope_value},
    )


def _remove_mock_docs_for_meeting(meeting_id: str) -> None:
    try:
        from app.services import knowledge_service
        keys = [
            key
            for key, doc in getattr(knowledge_service, "_mock_knowledge_docs", {}).items()
            if str(getattr(doc, "meeting_id", "")) == str(meeting_id)
        ]
        for key in keys:
            knowledge_service._mock_knowledge_docs.pop(key, None)
    except Exception:
        pass
    try:
        from app.services import document_service
        keys = [
            key
            for key, doc in getattr(document_service, "_mock_documents", {}).items()
            if str(getattr(doc, "meeting_id", "")) == str(meeting_id)
        ]
        for key in keys:
            document_service._mock_documents.pop(key, None)
    except Exception:
        pass


def _delete_file_assets(assets: list[dict]) -> None:
    backend_root = Path(__file__).resolve().parents[2]
    seen: set[tuple[str, str]] = set()
    for asset in assets:
        storage_key = str(asset.get("storage_key") or "").strip()
        file_url = str(asset.get("file_url") or "").strip()
        provider = str(asset.get("provider") or "").strip().lower()

        key = (storage_key, file_url)
        if key in seen:
            continue
        seen.add(key)

        if storage_key and (provider == "supabase" or is_storage_configured()):
            try:
                delete_object(storage_key)
            except Exception as exc:
                logger.warning("Failed to delete storage object %s: %s", storage_key, exc)

        if file_url and file_url.startswith("/files/"):
            relative = file_url[len("/files/"):].lstrip("/")
            candidates = [
                backend_root / "uploaded_files" / relative,
                backend_root / file_url.lstrip("/"),
                Path("/app/uploaded_files") / relative,
                Path("/app") / file_url.lstrip("/"),
            ]
            for path in candidates:
                try:
                    if path.exists() and path.is_file():
                        path.unlink()
                        break
                except Exception as exc:
                    logger.warning("Failed to delete local file %s: %s", path, exc)


def list_meetings(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    phase: Optional[str] = None,
    meeting_type: Optional[str] = None,
    project_id: Optional[str] = None
) -> Tuple[List[Meeting], int]:
    """List meetings with filters"""
    
    # Build query
    query = """
        SELECT 
            id::text, title, description, 
            organizer_id::text, 
            start_time, end_time, 
            meeting_type, phase,
            project_id::text, department_id::text,
            location, teams_link, recording_url,
            created_at
        FROM meeting
        WHERE 1=1
    """
    count_query = "SELECT COUNT(*) FROM meeting WHERE 1=1"
    params = {}
    
    if phase:
        query += " AND phase = :phase"
        count_query += " AND phase = :phase"
        params['phase'] = phase
    
    if meeting_type:
        query += " AND meeting_type = :meeting_type"
        count_query += " AND meeting_type = :meeting_type"
        params['meeting_type'] = meeting_type
    
    if project_id:
        query += " AND project_id = :project_id"
        count_query += " AND project_id = :project_id"
        params['project_id'] = project_id
    
    query += " ORDER BY start_time DESC NULLS LAST LIMIT :limit OFFSET :skip"
    params['limit'] = limit
    params['skip'] = skip
    
    # Execute queries
    result = db.execute(text(query), params)
    rows = result.fetchall()
    
    count_result = db.execute(text(count_query), {k: v for k, v in params.items() if k not in ['limit', 'skip']})
    total = count_result.scalar()
    
    meetings = []
    for row in rows:
        meetings.append(Meeting(
            id=row[0],
            title=row[1],
            description=row[2],
            organizer_id=row[3],
            start_time=row[4],
            end_time=row[5],
            meeting_type=row[6] or 'weekly_status',
            phase=row[7] or 'pre',
            project_id=row[8],
            department_id=row[9],
            location=row[10],
            teams_link=row[11],
            recording_url=row[12],
            created_at=row[13],
        ))
    
    return meetings, total


def create_meeting(db: Session, payload: MeetingCreate) -> Meeting:
    """Create a new meeting"""
    meeting_id = str(uuid4())
    now = datetime.utcnow()
    
    # Check if organizer_id exists in user_account
    organizer_id = None
    if payload.organizer_id:
        check_user = db.execute(
            text("SELECT id FROM user_account WHERE id = :user_id"),
            {'user_id': payload.organizer_id}
        )
        if check_user.fetchone():
            organizer_id = payload.organizer_id
    
    # Check if project_id exists
    project_id = None
    if payload.project_id:
        check_project = db.execute(
            text("SELECT id FROM project WHERE id = :project_id"),
            {'project_id': payload.project_id}
        )
        if check_project.fetchone():
            project_id = payload.project_id
    
    query = text("""
        INSERT INTO meeting (
            id, title, description, organizer_id,
            start_time, end_time, meeting_type, phase,
            project_id, department_id, location, teams_link,
            created_at
        ) VALUES (
            :id, :title, :description, :organizer_id,
            :start_time, :end_time, :meeting_type, 'pre',
            :project_id, :department_id, :location, :teams_link,
            :created_at
        )
        RETURNING id::text, title, description, organizer_id::text,
                  start_time, end_time, meeting_type, phase,
                  project_id::text, department_id::text, location, teams_link,
                  created_at
    """)
    
    result = db.execute(query, {
        'id': meeting_id,
        'title': payload.title,
        'description': payload.description,
        'organizer_id': organizer_id,
        'start_time': payload.start_time,
        'end_time': payload.end_time,
        'meeting_type': payload.meeting_type,
        'project_id': project_id,
        'department_id': payload.department_id,
        'location': payload.location,
        'teams_link': payload.teams_link,
        'created_at': now,
    })
    
    db.commit()
    row = result.fetchone()
    
    # Add participants if provided (skip invalid user_ids)
    if payload.participant_ids:
        for user_id in payload.participant_ids:
            try:
                add_participant(db, meeting_id, user_id, 'attendee')
            except Exception:
                pass  # Skip invalid user_id
    
    return Meeting(
        id=row[0],
        title=row[1],
        description=row[2],
        organizer_id=row[3],
        start_time=row[4],
        end_time=row[5],
        meeting_type=row[6],
        phase=row[7],
        project_id=row[8],
        department_id=row[9],
        location=row[10],
        teams_link=row[11],
        created_at=row[12],
    )


def get_meeting(db: Session, meeting_id: str) -> Optional[MeetingWithParticipants]:
    """Get a meeting with participants"""
    
    # Get meeting
    query = text("""
        SELECT 
            m.id::text, m.title, m.description, 
            m.organizer_id::text, 
            m.start_time, m.end_time, 
            m.meeting_type, m.phase,
            m.project_id::text, m.department_id::text,
            m.location, m.teams_link, m.recording_url,
            m.created_at
        FROM meeting m
        WHERE m.id = :meeting_id
    """)
    
    result = db.execute(query, {'meeting_id': meeting_id})
    row = result.fetchone()
    
    if not row:
        return None
    
    meeting = MeetingWithParticipants(
        id=row[0],
        title=row[1],
        description=row[2],
        organizer_id=row[3],
        start_time=row[4],
        end_time=row[5],
        meeting_type=row[6] or 'weekly_status',
        phase=row[7] or 'pre',
        project_id=row[8],
        department_id=row[9],
        location=row[10],
        teams_link=row[11],
        recording_url=row[12],
        created_at=row[13],
        participants=[]
    )
    
    # Get participants
    participants_query = text("""
        SELECT 
            mp.user_id::text, mp.role, mp.response_status,
            u.email, u.display_name
        FROM meeting_participant mp
        LEFT JOIN user_account u ON mp.user_id = u.id
        WHERE mp.meeting_id = :meeting_id
    """)
    
    p_result = db.execute(participants_query, {'meeting_id': meeting_id})
    for p_row in p_result.fetchall():
        meeting.participants.append(Participant(
            user_id=p_row[0],
            role=p_row[1] or 'attendee',
            response_status=p_row[2] or 'pending',
            email=p_row[3],
            display_name=p_row[4]
        ))
    
    return meeting


def update_meeting(db: Session, meeting_id: str, payload: MeetingUpdate) -> Optional[Meeting]:
    """Update a meeting"""
    
    # Build dynamic update query
    update_fields = []
    params = {'meeting_id': meeting_id}
    
    if payload.title is not None:
        update_fields.append("title = :title")
        params['title'] = payload.title
    
    if payload.description is not None:
        update_fields.append("description = :description")
        params['description'] = payload.description
    
    if payload.start_time is not None:
        update_fields.append("start_time = :start_time")
        params['start_time'] = payload.start_time
    
    if payload.end_time is not None:
        update_fields.append("end_time = :end_time")
        params['end_time'] = payload.end_time
    
    if payload.meeting_type is not None:
        update_fields.append("meeting_type = :meeting_type")
        params['meeting_type'] = payload.meeting_type
    
    if payload.phase is not None:
        update_fields.append("phase = :phase")
        params['phase'] = payload.phase

    if payload.project_id is not None:
        update_fields.append("project_id = :project_id")
        params['project_id'] = payload.project_id
    
    if payload.location is not None:
        update_fields.append("location = :location")
        params['location'] = payload.location
    
    if payload.teams_link is not None:
        update_fields.append("teams_link = :teams_link")
        params['teams_link'] = payload.teams_link
    
    if payload.recording_url is not None:
        update_fields.append("recording_url = :recording_url")
        params['recording_url'] = payload.recording_url
    
    if not update_fields:
        return get_meeting(db, meeting_id)
    
    query = text(f"""
        UPDATE meeting 
        SET {', '.join(update_fields)}
        WHERE id = :meeting_id
        RETURNING id::text, title, description, organizer_id::text,
                  start_time, end_time, meeting_type, phase,
                  project_id::text, department_id::text, location, teams_link,
                  recording_url, created_at
    """)
    
    result = db.execute(query, params)
    db.commit()
    row = result.fetchone()
    
    if not row:
        return None
    
    return Meeting(
        id=row[0],
        title=row[1],
        description=row[2],
        organizer_id=row[3],
        start_time=row[4],
        end_time=row[5],
        meeting_type=row[6],
        phase=row[7],
        project_id=row[8],
        department_id=row[9],
        location=row[10],
        teams_link=row[11],
        recording_url=row[12],
        created_at=row[13],
    )


def delete_meeting(db: Session, meeting_id: str) -> bool:
    """
    Delete meeting and all related data/history.
    Includes documents, knowledge chunks, chat history, summaries, realtime AV logs.
    """
    assets: list[dict] = []
    try:
        assets.extend(_collect_assets_by_scope(db, "meeting_recording", "meeting_id", meeting_id))
        assets.extend(_collect_assets_by_scope(db, "knowledge_document", "meeting_id", meeting_id))
        assets.extend(_collect_assets_by_scope(db, "document", "meeting_id", meeting_id))
        assets.extend(_collect_assets_by_scope(db, "documents", "meeting_id", meeting_id))
    except Exception as exc:
        logger.warning("Failed to collect file assets before meeting delete %s: %s", meeting_id, exc)

    try:
        # Chat history by legacy schema (chat_message has meeting_id).
        _delete_rows_by_scope(db, "chat_message", "meeting_id", meeting_id)

        # Chat history by current schema (chat_message -> chat_session).
        session_ids: list[str] = []
        if _table_exists(db, "chat_session") and _table_has_column(db, "chat_session", "meeting_id"):
            rows = db.execute(
                text("SELECT id::text FROM chat_session WHERE meeting_id = :meeting_id"),
                {"meeting_id": meeting_id},
            ).fetchall()
            session_ids = [row[0] for row in rows if row and row[0]]
        if session_ids and _table_exists(db, "chat_message") and _table_has_column(db, "chat_message", "session_id"):
            for session_id in session_ids:
                db.execute(
                    text("DELETE FROM chat_message WHERE session_id = :session_id"),
                    {"session_id": session_id},
                )

        # Tables with strong meeting ownership.
        for table_name in [
            "agenda_item",
            "tool_suggestion",
            "ai_event_log",
            "adr_history",
            "risk_item",
            "decision_item",
            "action_item",
            "topic_segment",
            "transcript_chunk",
            "note_item",
            "quiz_item",
            "meeting_summary",
            "meeting_minutes",
            "ask_ai_query",
            "visual_object_event",
            "visual_event",
            "context_window",
            "recap_segment",
            "qna_event_log",
            "tool_call_proposal",
            "recap_window",
            "captured_frame",
            "transcript_segment",
            "audio_record",
            "session_roi",
            "meeting_recording",
            "meeting_participant",
            "chat_session",
        ]:
            _delete_rows_by_scope(db, table_name, "meeting_id", meeting_id)

        # Delete chunks linked to docs under this meeting (safety for legacy schema).
        if (
            _table_exists(db, "knowledge_chunk")
            and _table_exists(db, "knowledge_document")
            and _table_has_column(db, "knowledge_chunk", "document_id")
            and _table_has_column(db, "knowledge_document", "meeting_id")
        ):
            db.execute(
                text(
                    """
                    DELETE FROM knowledge_chunk kc
                    USING knowledge_document kd
                    WHERE kc.document_id = kd.id
                      AND kd.meeting_id = :meeting_id
                    """
                ),
                {"meeting_id": meeting_id},
            )

        # Delete meeting-scoped docs metadata.
        _delete_rows_by_scope(db, "knowledge_document", "meeting_id", meeting_id)
        _delete_rows_by_scope(db, "document", "meeting_id", meeting_id)
        _delete_rows_by_scope(db, "documents", "meeting_id", meeting_id)

        result = db.execute(
            text("DELETE FROM meeting WHERE id = :meeting_id RETURNING id"),
            {'meeting_id': meeting_id},
        )
        row = result.fetchone()
        if not row:
            db.rollback()
            return False
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete meeting %s: %s", meeting_id, exc, exc_info=True)
        return False

    _delete_file_assets(assets)
    _remove_mock_docs_for_meeting(meeting_id)
    return True


def add_participant(db: Session, meeting_id: str, user_id: str, role: str = 'attendee') -> Optional[Meeting]:
    """Add a participant to a meeting"""
    query = text("""
        INSERT INTO meeting_participant (meeting_id, user_id, role, response_status)
        VALUES (:meeting_id, :user_id, :role, 'pending')
        ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = :role
    """)
    
    db.execute(query, {
        'meeting_id': meeting_id,
        'user_id': user_id,
        'role': role
    })
    db.commit()
    
    return get_meeting(db, meeting_id)


def update_phase(db: Session, meeting_id: str, phase: str) -> Optional[Meeting]:
    """Update meeting phase"""
    query = text("""
        UPDATE meeting 
        SET phase = :phase
        WHERE id = :meeting_id
        RETURNING id::text
    """)
    
    result = db.execute(query, {
        'meeting_id': meeting_id,
        'phase': phase,
    })
    db.commit()
    
    if not result.fetchone():
        return None
    
    return get_meeting(db, meeting_id)
