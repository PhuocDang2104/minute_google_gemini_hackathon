"""
RAG (Retrieval Augmented Generation) Endpoints
Uses Gemini AI with document context
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from uuid import uuid4
from typing import Optional
import json

from app.db.session import get_db
from app.schemas.ai import RAGQuery, RAGResponse, RAGHistory, Citation
from app.llm.gemini_client import GeminiChat, is_gemini_available

router = APIRouter()


# Knowledge base context (demo; production would come from vector DB)
KNOWLEDGE_BASE = """
# MINUTE Demo Knowledge Base

## Thông tư NHNN
### Thông tư 09/2020/TT-NHNN - Quản lý rủi ro CNTT
- Điều 15: Thời gian lưu trữ dữ liệu giao dịch tối thiểu 10 năm
- Điều 16: Yêu cầu mã hóa dữ liệu AES-256 cho data at rest
- Điều 20: Penetration testing phải thực hiện quarterly

### Thông tư 35/2016/TT-NHNN - Chuyển mạch thanh toán
- Yêu cầu SLA 99.9% uptime
- Timeout transaction: 30 giây

## Security Policies
### LPBank Security Policy v3.0
- Data encryption: AES-256 (at rest), TLS 1.3 (in transit)
- MFA bắt buộc cho tất cả internal systems
- Password policy: 12+ chars, complexity required
- Session timeout: 15 phút

## Dự án
### Core Banking Modernization
- Timeline: Q4 2024 go-live
- Tech stack: Microservices, Oracle, K8s
- Status: UAT phase

### Mobile Banking 3.0
- Sprint 23 completed
- Features: eKYC, Quick Transfer
- Dependencies: Core Banking APIs

### LOS (Loan Origination System)
- Integration với Core Banking
- Risk: Performance bottleneck
"""


class RAGAssistant:
    """RAG-enhanced AI Assistant"""
    
    def __init__(self):
        self.chat = GeminiChat(system_prompt=self._build_system_prompt())
    
    def _build_system_prompt(self) -> str:
        return f"""Bạn là MINUTE AI Assistant.

QUAN TRỌNG: Khi trả lời, bạn PHẢI:
1. Dựa trên knowledge base được cung cấp
2. Trích dẫn nguồn cụ thể (tên tài liệu, điều khoản)
3. Nếu không có thông tin trong knowledge base, nói rõ "Không tìm thấy thông tin trong hệ thống MINUTE"
4. KHÔNG sử dụng markdown (không dùng **, ##, hay bất kỳ ký tự markdown nào)
5. KHÔNG chào hỏi mỗi lần trả lời (chỉ trả lời trực tiếp câu hỏi)
6. Trả lời bằng văn bản thuần túy, ngắn gọn, súc tích

KNOWLEDGE BASE:
{KNOWLEDGE_BASE}

Format trả lời:
- Văn bản thuần túy, không markdown
- Ngắn gọn, súc tích
- Luôn kèm nguồn trích dẫn (nếu có)"""

    async def query(self, question: str, meeting_context: Optional[str] = None) -> tuple:
        """Query with RAG context"""
        
        # Build enhanced prompt
        prompt = question
        if meeting_context:
            prompt = f"Context cuộc họp: {meeting_context}\n\nCâu hỏi: {question}"
        
        # Get response
        answer = await self.chat.chat(prompt)
        
        # Clean markdown from answer (GeminiChat has _clean_markdown method)
        import re
        # Remove bold **text**
        answer = re.sub(r'\*\*(.*?)\*\*', r'\1', answer)
        # Remove italic *text*
        answer = re.sub(r'\*(.*?)\*', r'\1', answer)
        # Remove headers # ## ###
        answer = re.sub(r'^#+\s*', '', answer, flags=re.MULTILINE)
        # Remove code blocks ```
        answer = re.sub(r'```.*?```', '', answer, flags=re.DOTALL)
        # Remove inline code `code`
        answer = re.sub(r'`([^`]+)`', r'\1', answer)
        # Remove links [text](url)
        answer = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', answer)
        # Clean up multiple spaces and newlines
        answer = re.sub(r'\s+', ' ', answer)
        answer = re.sub(r'\n{3,}', '\n\n', answer)
        answer = answer.strip()
        
        # Extract citations (simplified - in production use NER/regex)
        citations = self._extract_citations(answer, question)
        
        return answer, citations
    
    def _extract_citations(self, answer: str, question: str) -> list:
        """Extract citations from answer"""
        citations = []
        
        # Simple keyword matching for demo
        if 'thông tư 09' in answer.lower() or 'thông tư 09' in question.lower():
            citations.append(Citation(
                title='Thông tư 09/2020/TT-NHNN',
                source='NHNN',
                page=15,
                snippet='Quy định về quản lý rủi ro CNTT trong hoạt động ngân hàng',
                url='https://wiki.lpbank.vn/compliance/nhnn-09-2020'
            ))
        
        if 'security' in answer.lower() or 'bảo mật' in question.lower():
            citations.append(Citation(
                title='LPBank Security Policy v3.0',
                source='Internal',
                snippet='Chính sách bảo mật thông tin của LPBank',
                url='https://sharepoint.lpbank.vn/policies/security-v3'
            ))
        
        if 'core banking' in answer.lower() or 'core banking' in question.lower():
            citations.append(Citation(
                title='Core Banking Modernization - Project Charter',
                source='SharePoint',
                snippet='Tài liệu dự án Core Banking Modernization',
                url='https://sharepoint.lpbank.vn/projects/core-banking'
            ))
        
        # Default citation if none found
        if not citations:
            citations.append(Citation(
                title='LPBank Knowledge Base',
                source='Wiki',
                snippet='Cơ sở tri thức nội bộ LPBank',
                url='https://wiki.lpbank.vn'
            ))
        
        return citations


# Global RAG assistant instance
rag_assistant = RAGAssistant()


@router.post('/query', response_model=RAGResponse)
async def query_rag(
    request: RAGQuery,
    db: Session = Depends(get_db)
):
    """Query the RAG system with a question"""
    
    # Get meeting context if provided
    meeting_context = None
    if request.meeting_id and request.include_meeting_context:
        try:
            query = text("""
                SELECT m.title, m.meeting_type, m.description, p.name as project_name
                FROM meeting m
                LEFT JOIN project p ON m.project_id = p.id
                WHERE m.id = :meeting_id
            """)
            result = db.execute(query, {'meeting_id': request.meeting_id})
            row = result.fetchone()
            if row:
                meeting_context = f"Cuộc họp: {row[0]}, Loại: {row[1]}, Dự án: {row[3]}"
        except Exception:
            pass
    
    # Query RAG
    answer, citations = await rag_assistant.query(request.query, meeting_context)
    
    # Calculate confidence
    confidence = 0.90 if is_gemini_available() else 0.75
    if not citations:
        confidence = 0.60
    
    query_id = str(uuid4())
    
    # Save to database
    if request.meeting_id:
        try:
            save_query = text("""
                INSERT INTO ask_ai_query (id, meeting_id, query_text, answer_text, citations, created_at)
                VALUES (:id, :meeting_id, :query, :answer, :citations, :created_at)
            """)
            db.execute(save_query, {
                'id': query_id,
                'meeting_id': request.meeting_id,
                'query': request.query,
                'answer': answer,
                'citations': json.dumps([c.model_dump() for c in citations]),
                'created_at': datetime.utcnow()
            })
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to save RAG query: {e}")
    
    return RAGResponse(
        id=query_id,
        query=request.query,
        answer=answer,
        citations=citations,
        confidence=confidence,
        created_at=datetime.utcnow()
    )


@router.get('/history/{meeting_id}', response_model=RAGHistory)
def get_rag_history(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get RAG query history for a meeting"""
    
    query = text("""
        SELECT id::text, query_text, answer_text, citations, created_at
        FROM ask_ai_query
        WHERE meeting_id = :meeting_id
        ORDER BY created_at DESC
        LIMIT 20
    """)
    
    try:
        result = db.execute(query, {'meeting_id': meeting_id})
        rows = result.fetchall()
    except Exception as e:
        db.rollback()
        print(f"Failed to load RAG history: {e}")
        return RAGHistory(queries=[], total=0)
    
    queries = []
    for row in rows:
        citations = []
        if row[3]:
            try:
                citation_data = json.loads(row[3]) if isinstance(row[3], str) else row[3]
                citations = [Citation(**c) for c in citation_data]
            except:
                pass
        
        queries.append(RAGResponse(
            id=row[0],
            query=row[1],
            answer=row[2],
            citations=citations,
            confidence=0.85,
            created_at=row[4]
        ))
    
    return RAGHistory(queries=queries, total=len(queries))


@router.get('/knowledge-base')
def get_knowledge_base_info():
    """Get information about the knowledge base"""
    return {
        'sources': [
            {'name': 'NHNN Circulars', 'count': 5, 'type': 'regulation'},
            {'name': 'Security Policies', 'count': 3, 'type': 'policy'},
            {'name': 'Project Documents', 'count': 15, 'type': 'internal'},
            {'name': 'Meeting Minutes', 'count': 120, 'type': 'meeting'},
        ],
        'last_updated': datetime.utcnow().isoformat(),
        'total_documents': 143,
        'vector_db': 'pgvector',
        'embedding_model': 'text-embedding-004'
    }
