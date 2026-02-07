from typing import Any, Dict, List

from sqlalchemy import text

from app.db.session import SessionLocal
from app.llm.clients.jina_embed import embed_texts, is_jina_available
from app.vectorstore.retrieval import light_rag_retrieval


def _normalize_for_embedding(query: str) -> str:
    return (query or "").replace("\x00", "").strip().lower()


def _format_vector(vec: List[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


def _query_bucket(
    db,
    *,
    question: str,
    bucket: str,
    meeting_id: str | None,
    project_id: str | None,
    limit: int,
) -> List[Dict[str, Any]]:
    if bucket == "meeting":
        if not meeting_id:
            return []
        scope_clause = "COALESCE(kd.meeting_id, kc.scope_meeting)::text = :meeting_id"
        params: Dict[str, Any] = {"meeting_id": meeting_id, "limit": limit}
    elif bucket == "project":
        if not project_id:
            return []
        scope_clause = (
            "COALESCE(kd.project_id, kc.scope_project)::text = :project_id "
            "AND COALESCE(kd.meeting_id, kc.scope_meeting) IS NULL"
        )
        params = {"project_id": project_id, "limit": limit}
    else:
        scope_clause = "COALESCE(kd.meeting_id, kc.scope_meeting) IS NULL AND COALESCE(kd.project_id, kc.scope_project) IS NULL"
        params = {"limit": limit}

    if is_jina_available():
        query_vec = embed_texts([_normalize_for_embedding(question)])[0]
        params["query_vec"] = _format_vector(query_vec)
        sql = text(
            f"""
            SELECT
                kd.id::text AS doc_id,
                kd.title AS title,
                kd.file_url AS source,
                kc.chunk_index AS chunk_index,
                kc.content AS snippet,
                (kc.embedding <=> CAST(:query_vec AS vector(1024))) AS score
            FROM knowledge_chunk kc
            JOIN knowledge_document kd ON kd.id = kc.document_id
            WHERE {scope_clause}
            ORDER BY score ASC
            LIMIT :limit
            """
        )
    else:
        params["kw"] = f"%{question.strip()}%"
        sql = text(
            f"""
            SELECT
                kd.id::text AS doc_id,
                kd.title AS title,
                kd.file_url AS source,
                kc.chunk_index AS chunk_index,
                kc.content AS snippet,
                0.6 AS score
            FROM knowledge_chunk kc
            JOIN knowledge_document kd ON kd.id = kc.document_id
            WHERE {scope_clause}
              AND (kc.content ILIKE :kw OR kd.title ILIKE :kw OR COALESCE(kd.description, '') ILIKE :kw)
            ORDER BY kd.updated_at DESC NULLS LAST
            LIMIT :limit
            """
        )

    rows = db.execute(sql, params).mappings().all()
    docs: List[Dict[str, Any]] = []
    for row in rows:
        snippet = (row.get("snippet") or "").strip()
        docs.append(
            {
                "doc_id": row.get("doc_id"),
                "title": row.get("title") or "Untitled",
                "snippet": snippet[:500],
                "source": row.get("source"),
                "chunk_index": row.get("chunk_index"),
                "bucket": bucket,
                "topic_id": None,
                "project_id": project_id if bucket == "project" else None,
                "score": float(row.get("score") or 0.0),
                "metadata": {"bucket": bucket},
            }
        )
    return docs


def rag_retrieve(
    question: str,
    meeting_id: str | None = None,
    topic_id: str | None = None,
    project_id: str | None = None,
) -> List[Dict[str, Any]]:
    """Retrieve session/project docs from DB first, fallback to mock LightRAG."""
    if not question or not question.strip():
        return []

    db = SessionLocal()
    try:
        docs: List[Dict[str, Any]] = []
        seen: set[tuple[str, Any]] = set()

        for bucket in ("meeting", "project", "global"):
            bucket_docs = _query_bucket(
                db,
                question=question,
                bucket=bucket,
                meeting_id=meeting_id,
                project_id=project_id,
                limit=6,
            )
            for item in bucket_docs:
                key = (str(item.get("doc_id")), item.get("chunk_index"))
                if key in seen:
                    continue
                seen.add(key)
                docs.append(item)
                if len(docs) >= 8:
                    break
            if len(docs) >= 8:
                break

        if docs:
            return docs
    except Exception:
        db.rollback()
    finally:
        db.close()

    return light_rag_retrieval(
        question=question,
        meeting_id=meeting_id,
        project_id=project_id,
        topic_id=topic_id,
    )
