"""
RAG (Retrieval Augmented Generation) Endpoints
Uses uploaded knowledge documents/chunks as primary context.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from uuid import uuid4
from typing import Optional, Tuple
import json

from app.db.session import get_db
from app.schemas.ai import RAGQuery, RAGResponse, RAGHistory, Citation
from app.schemas.knowledge import KnowledgeQueryRequest
from app.services import knowledge_service

router = APIRouter()


def _get_meeting_context(db: Session, meeting_id: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Return (meeting_context_text, project_id)."""
    if not meeting_id:
        return None, None

    query = text(
        """
        SELECT m.title, m.meeting_type, m.description, p.name as project_name, p.id::text as project_id
        FROM meeting m
        LEFT JOIN project p ON m.project_id = p.id
        WHERE m.id = :meeting_id
        """
    )
    row = db.execute(query, {"meeting_id": meeting_id}).fetchone()
    if not row:
        return None, None

    context = f"Cuoc hop: {row[0]} | Loai: {row[1]} | Du an: {row[3]}"
    return context, row[4]


def _to_citations(docs) -> list[Citation]:
    citations: list[Citation] = []
    for doc in docs:
        citations.append(
            Citation(
                title=doc.title,
                source=doc.source,
                snippet=(doc.description or "Tai lieu lien quan trong session/project")[:240],
                url=doc.file_url,
            )
        )
    return citations


@router.post('/query', response_model=RAGResponse)
async def query_rag(
    request: RAGQuery,
    db: Session = Depends(get_db)
):
    """Query RAG using uploaded docs/chunks scoped by meeting/project."""

    meeting_context = None
    project_id = None
    if request.meeting_id and request.include_meeting_context:
        try:
            meeting_context, project_id = _get_meeting_context(db, request.meeting_id)
        except Exception:
            meeting_context = None
            project_id = None

    knowledge_request = KnowledgeQueryRequest(
        query=request.query,
        include_documents=True,
        include_meetings=True,
        limit=5,
        meeting_id=request.meeting_id,
        project_id=project_id,
    )

    rag_result = await knowledge_service.query_knowledge_ai(db, knowledge_request)
    answer = rag_result.answer
    if meeting_context and "Khong co ngu canh" in answer:
        answer = f"{meeting_context}. {answer}"

    citations = _to_citations(rag_result.relevant_documents)
    confidence = float(rag_result.confidence or 0.5)

    query_id = str(uuid4())

    if request.meeting_id:
        try:
            save_query = text(
                """
                INSERT INTO ask_ai_query (id, meeting_id, query_text, answer_text, citations, created_at)
                VALUES (:id, :meeting_id, :query, :answer, :citations, :created_at)
                """
            )
            db.execute(
                save_query,
                {
                    "id": query_id,
                    "meeting_id": request.meeting_id,
                    "query": request.query,
                    "answer": answer,
                    "citations": json.dumps([c.model_dump() for c in citations]),
                    "created_at": datetime.utcnow(),
                },
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            print(f"Failed to save RAG query: {exc}")

    return RAGResponse(
        id=query_id,
        query=request.query,
        answer=answer,
        citations=citations,
        confidence=confidence,
        created_at=datetime.utcnow(),
    )


@router.get('/history/{meeting_id}', response_model=RAGHistory)
def get_rag_history(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get RAG query history for a meeting."""

    query = text(
        """
        SELECT id::text, query_text, answer_text, citations, created_at
        FROM ask_ai_query
        WHERE meeting_id = :meeting_id
        ORDER BY created_at DESC
        LIMIT 20
        """
    )

    try:
        rows = db.execute(query, {'meeting_id': meeting_id}).fetchall()
    except Exception as exc:
        db.rollback()
        print(f"Failed to load RAG history: {exc}")
        return RAGHistory(queries=[], total=0)

    queries = []
    for row in rows:
        citations = []
        if row[3]:
            try:
                citation_data = json.loads(row[3]) if isinstance(row[3], str) else row[3]
                citations = [Citation(**c) for c in citation_data]
            except Exception:
                citations = []

        queries.append(
            RAGResponse(
                id=row[0],
                query=row[1],
                answer=row[2],
                citations=citations,
                confidence=0.85,
                created_at=row[4],
            )
        )

    return RAGHistory(queries=queries, total=len(queries))


@router.get('/knowledge-base')
def get_knowledge_base_info(db: Session = Depends(get_db)):
    """Get information about indexed knowledge base."""
    try:
        total_documents = db.execute(text("SELECT COUNT(*) FROM knowledge_document")).scalar_one()
    except Exception:
        total_documents = 0

    try:
        total_chunks = db.execute(text("SELECT COUNT(*) FROM knowledge_chunk")).scalar_one()
    except Exception:
        total_chunks = 0

    return {
        'sources': [
            {'name': 'Session Uploads', 'type': 'meeting'},
            {'name': 'Project Documents', 'type': 'project'},
        ],
        'last_updated': datetime.utcnow().isoformat(),
        'total_documents': total_documents,
        'total_chunks': total_chunks,
        'vector_db': 'pgvector',
        'embedding_model': 'jina-embeddings-v3',
    }
