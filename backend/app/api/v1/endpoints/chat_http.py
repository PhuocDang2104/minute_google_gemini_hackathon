"""
AI Chat HTTP Endpoints
Gemini-first with Groq fallback
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from uuid import uuid4
from typing import Optional
import json

from app.db.session import get_db
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSession,
    ChatSessionList,
    HomeAskRequest,
    GenerateAgendaRequest,
    ExtractItemsRequest,
    GenerateSummaryRequest,
    AIGenerationResponse,
)
from app.llm.gemini_client import GeminiChat, MeetingAIAssistant, is_gemini_available, get_llm_status

router = APIRouter()

HOME_ASK_CONTEXT = """MINUTE | Tro ly thong minh cho meetings va study sessions
(Web app + Multimodal Companion Agent + LightRAG + Tool-calling)

1. Product Summary
- MINUTE la AI assistant cho ca nhan va doi nhom trong meeting/hoc online hoac record offline.
- ASR realtime -> transcript, recap theo moc thoi gian.
- Post-session: summary + notes + action/decision/risk (meeting) hoac concepts + quiz (study).
- Q&A grounded theo transcript/summary + tai lieu nguoi dung cung cap.
- Multimodal: vua nghe vua "thay" (slide, man hinh share, bang, code) theo timeline.

2. Core Features
2.1 In-meeting (realtime)
- ASR -> transcript lien tuc.
- Recap dinh ky (vi du moi 2 phut) gan timestamp.
- Hoi dap theo context (audio + video + tai lieu).

2.2 Post-meeting / Upload record
- Generate summary + important notes + highlights theo timeline.
- Meeting: action items, decisions, risks, next steps.
- Study: concepts + quiz (4 lua chon, co giai thich).

3. Settings & Personalization
- Cho phep chon model (Gemini default, co the thay the).
- Cho phep su dung API key LLM rieng.
- Tuy chinh giong van, muc do chi tiet.

4. Guardrails
- No-source -> no-answer.
- Neu thieu du lieu, tra loi ro rang va de xuat buoc tiep theo.
- Khong tu dong thuc thi tool-calling neu chua duoc xac nhan.
"""

HOME_ASK_SYSTEM_PROMPT = f"""Ban la MINUTE Assistant.

Quy tac bat buoc:
- Chi su dung thong tin nam trong <context>.
- Neu cau hoi khong nam trong context hoac qua chuyen sau/ngoai pham vi, tra loi: "Minh chua co thong tin ve noi dung do trong tai lieu MINUTE hien tai. Ban co the hoi ve MINUTE, chuc nang va luong trai nghiem."
- Neu nguoi dung chao hoi, cam on, chia se cam xuc hoac hoi dap giao tiep co ban, hay phan hoi than thien va goi y co the hoi ve MINUTE.
- Khong bịa, khong suy doan ngoai context, khong dua thong tin moi.
- Tra loi bang tieng Viet, van noi tu nhien, 1-5 cau, khong markdown.

<context>
{HOME_ASK_CONTEXT}
</context>
"""

HOME_ASK_MOCK_RESPONSE = (
    "MINUTE la tro ly thong minh cho meetings va study sessions. "
    "Ung dung ho tro live recap, hoi dap theo ngu canh, va tao bien ban sau buoi hop. "
    "Co the upload record, tao transcript + summary + action/quiz, va tra loi theo tai lieu lien quan."
)


# Store chat sessions in memory (for demo - use Redis in production)
chat_sessions: dict = {}


def get_or_create_session(session_id: Optional[str], meeting_id: Optional[str]) -> tuple:
    """Get existing session or create new one"""
    if session_id and session_id in chat_sessions:
        return session_id, chat_sessions[session_id]
    
    new_id = session_id or str(uuid4())
    chat_sessions[new_id] = {
        'id': new_id,
        'meeting_id': meeting_id,
        'chat': GeminiChat(),
        'messages': [],
        'created_at': datetime.utcnow(),
    }
    return new_id, chat_sessions[new_id]


@router.get('/status')
def get_ai_status():
    """Check if AI is available"""
    return get_llm_status()


@router.get('/test')
async def test_llm():
    """Test Gemini/Groq via unified wrapper"""
    status = get_llm_status()
    if status["status"] != "ready":
        return {"success": False, "error": "No API key configured", "status": status}
    try:
        chat = GeminiChat()
        response = await chat.chat("Say hello in Vietnamese.")
        return {
            "success": True,
            "response": response,
            "provider": status["provider"],
            "model": status["model"],
            "sdk": status.get("sdk"),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "status": status,
        }


@router.post('/message', response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Send a message to AI and get response"""
    
    session_id, session = get_or_create_session(request.session_id, request.meeting_id)
    
    # Get meeting context if requested
    context = None
    if request.include_context and request.meeting_id:
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
                context = f"Cuộc họp: {row[0]}\nLoại: {row[1]}\nMô tả: {row[2]}\nDự án: {row[3]}"
        except Exception:
            pass
    
    # Get AI response
    chat: GeminiChat = session['chat']
    response_text = await chat.chat(request.message, context)
    
    # Save message to session
    session['messages'].append({
        'role': 'user',
        'content': request.message,
        'timestamp': datetime.utcnow()
    })
    session['messages'].append({
        'role': 'assistant',
        'content': response_text,
        'timestamp': datetime.utcnow()
    })
    
    # Save to database if meeting_id provided
    if request.meeting_id:
        try:
            save_query = text("""
                INSERT INTO chat_message (id, session_id, meeting_id, role, content, created_at)
                VALUES (:id, :session_id, :meeting_id, 'user', :user_content, :created_at)
            """)
            db.execute(save_query, {
                'id': str(uuid4()),
                'session_id': session_id,
                'meeting_id': request.meeting_id,
                'user_content': request.message,
                'created_at': datetime.utcnow()
            })
            
            db.execute(save_query.text.replace("'user'", "'assistant'"), {
                'id': str(uuid4()),
                'session_id': session_id,
                'meeting_id': request.meeting_id,
                'user_content': response_text,
                'created_at': datetime.utcnow()
            })
            db.commit()
        except Exception as e:
            print(f"Failed to save chat message: {e}")
    
    return ChatResponse(
        id=str(uuid4()),
        message=response_text,
        role='assistant',
        confidence=0.85 if is_gemini_available() else 0.7,
        created_at=datetime.utcnow()
    )


@router.post('/home', response_model=ChatResponse)
async def home_ask(request: HomeAskRequest):
    """Lightweight home ask endpoint with strict MINUTE context."""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    chat = GeminiChat(system_prompt=HOME_ASK_SYSTEM_PROMPT, mock_response=HOME_ASK_MOCK_RESPONSE)
    response_text = await chat.chat(message)

    return ChatResponse(
        id=str(uuid4()),
        message=response_text,
        role='assistant',
        confidence=0.85 if is_gemini_available() else 0.7,
        created_at=datetime.utcnow()
    )


@router.get('/sessions', response_model=ChatSessionList)
def list_sessions(
    meeting_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List chat sessions"""
    sessions = []
    
    for sid, session in chat_sessions.items():
        if meeting_id and session.get('meeting_id') != meeting_id:
            continue
        
        sessions.append(ChatSession(
            id=sid,
            meeting_id=session.get('meeting_id'),
            messages=session.get('messages', []),
            created_at=session.get('created_at', datetime.utcnow()),
            updated_at=datetime.utcnow()
        ))
    
    return ChatSessionList(sessions=sessions, total=len(sessions))


@router.get('/sessions/{session_id}', response_model=ChatSession)
def get_session(session_id: str):
    """Get a specific chat session"""
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions[session_id]
    return ChatSession(
        id=session_id,
        meeting_id=session.get('meeting_id'),
        messages=session.get('messages', []),
        created_at=session.get('created_at', datetime.utcnow()),
        updated_at=datetime.utcnow()
    )


@router.delete('/sessions/{session_id}')
def delete_session(session_id: str):
    """Delete a chat session"""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {'status': 'deleted'}


# ============================================
# AI GENERATION ENDPOINTS
# ============================================

@router.post('/generate/agenda', response_model=AIGenerationResponse)
async def generate_agenda_ai(
    request: GenerateAgendaRequest,
    db: Session = Depends(get_db)
):
    """Generate meeting agenda using AI"""
    assistant = MeetingAIAssistant(request.meeting_id, {
        'type': request.meeting_type,
    })
    
    result = await assistant.generate_agenda(request.meeting_type)
    
    return AIGenerationResponse(
        id=str(uuid4()),
        result=result,
        confidence=0.85,
        created_at=datetime.utcnow()
    )


@router.post('/extract/items', response_model=AIGenerationResponse)
async def extract_items_ai(
    request: ExtractItemsRequest,
    db: Session = Depends(get_db)
):
    """Extract action items, decisions, or risks from transcript"""
    assistant = MeetingAIAssistant(request.meeting_id)
    
    if request.item_type == 'actions':
        result = await assistant.extract_action_items(request.transcript)
    elif request.item_type == 'decisions':
        result = await assistant.extract_decisions(request.transcript)
    elif request.item_type == 'risks':
        result = await assistant.extract_risks(request.transcript)
    else:
        raise HTTPException(status_code=400, detail="Invalid item_type")
    
    return AIGenerationResponse(
        id=str(uuid4()),
        result=result,
        confidence=0.80,
        created_at=datetime.utcnow()
    )


@router.post('/generate/summary', response_model=AIGenerationResponse)
async def generate_summary_ai(
    request: GenerateSummaryRequest,
    db: Session = Depends(get_db)
):
    """Generate meeting summary from transcript"""
    assistant = MeetingAIAssistant(request.meeting_id)
    
    result = await assistant.generate_summary(request.transcript)
    
    return AIGenerationResponse(
        id=str(uuid4()),
        result=result,
        confidence=0.85,
        created_at=datetime.utcnow()
    )
