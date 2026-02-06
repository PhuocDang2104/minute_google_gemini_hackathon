"""
Agenda Service - AI-powered agenda generation and CRUD operations
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
import logging
import json
import re

from sqlalchemy.orm import Session
from app.schemas.agenda import (
    AgendaItem,
    AgendaItemCreate,
    AgendaItemUpdate,
    AgendaList,
    AgendaGenerateRequest,
    AgendaGenerateResponse,
    AgendaSaveRequest,
)
from app.llm.gemini_client import GeminiChat, is_gemini_available

logger = logging.getLogger(__name__)

# In-memory storage for mock agendas
_mock_agendas: dict[str, AgendaItem] = {}




def _init_mock_agendas():
    """Initialize with some mock agenda items"""
    mock_data = [
        # Meeting 1 - Steering Committee
        {
            "id": UUID("f0000001-0000-0000-0000-000000000001"),
            "meeting_id": UUID("c0000001-0000-0000-0000-000000000001"),
            "order_index": 0,
            "title": "Khai mạc & Giới thiệu mục tiêu cuộc họp",
            "duration_minutes": 5,
            "presenter_name": "Nguyễn Văn A - Head of PMO",
            "description": "Welcome và overview các nội dung sẽ thảo luận",
            "status": "completed",
        },
        {
            "id": UUID("f0000002-0000-0000-0000-000000000002"),
            "meeting_id": UUID("c0000001-0000-0000-0000-000000000001"),
            "order_index": 1,
            "title": "Review tiến độ dự án Core Banking",
            "duration_minutes": 20,
            "presenter_name": "Hoàng Thị E - Tech Lead",
            "description": "Báo cáo milestone đã đạt được, blockers hiện tại",
            "status": "completed",
        },
        {
            "id": UUID("f0000003-0000-0000-0000-000000000003"),
            "meeting_id": UUID("c0000001-0000-0000-0000-000000000001"),
            "order_index": 2,
            "title": "Báo cáo Budget & Resource",
            "duration_minutes": 15,
            "presenter_name": "Phạm Văn D - CTO",
            "description": "Tình hình ngân sách, resource allocation",
            "status": "in_progress",
        },
        {
            "id": UUID("f0000004-0000-0000-0000-000000000004"),
            "meeting_id": UUID("c0000001-0000-0000-0000-000000000001"),
            "order_index": 3,
            "title": "Risk Assessment & Mitigation",
            "duration_minutes": 15,
            "presenter_name": "Bùi Văn I - CRO",
            "description": "Đánh giá rủi ro và kế hoạch xử lý",
            "status": "pending",
        },
        {
            "id": UUID("f0000005-0000-0000-0000-000000000005"),
            "meeting_id": UUID("c0000001-0000-0000-0000-000000000001"),
            "order_index": 4,
            "title": "Q&A và Kết luận",
            "duration_minutes": 5,
            "presenter_name": "Vũ Văn G - Business Director",
            "description": "Thảo luận mở và action items",
            "status": "pending",
        },
        # Meeting 2 - Sprint Review
        {
            "id": UUID("f0000006-0000-0000-0000-000000000006"),
            "meeting_id": UUID("c0000002-0000-0000-0000-000000000002"),
            "order_index": 0,
            "title": "Sprint Goals Review",
            "duration_minutes": 5,
            "presenter_name": "Trần Thị B - Senior PM",
            "status": "pending",
        },
        {
            "id": UUID("f0000007-0000-0000-0000-000000000007"),
            "meeting_id": UUID("c0000002-0000-0000-0000-000000000002"),
            "order_index": 1,
            "title": "Demo: Feature Login với Biometrics",
            "duration_minutes": 15,
            "presenter_name": "Ngô Thị F - Tech Lead Mobile",
            "status": "pending",
        },
        {
            "id": UUID("f0000008-0000-0000-0000-000000000008"),
            "meeting_id": UUID("c0000002-0000-0000-0000-000000000002"),
            "order_index": 2,
            "title": "Demo: Payment QR Code",
            "duration_minutes": 15,
            "presenter_name": "Ngô Thị F - Tech Lead Mobile",
            "status": "pending",
        },
        {
            "id": UUID("f0000009-0000-0000-0000-000000000009"),
            "meeting_id": UUID("c0000002-0000-0000-0000-000000000002"),
            "order_index": 3,
            "title": "Blockers Discussion",
            "duration_minutes": 10,
            "presenter_name": "All",
            "status": "pending",
        },
    ]
    
    for item_data in mock_data:
        now = datetime.now()
        item = AgendaItem(
            **item_data,
            created_at=now,
            updated_at=now,
        )
        _mock_agendas[str(item.id)] = item


# Initialize mock data
_init_mock_agendas()


async def list_agenda_items(
    db: Session,
    meeting_id: UUID,
) -> AgendaList:
    """List all agenda items for a meeting"""
    items = [
        item for item in _mock_agendas.values()
        if item.meeting_id == meeting_id
    ]
    items.sort(key=lambda x: x.order_index)
    
    total_duration = sum(item.duration_minutes or 0 for item in items)
    
    return AgendaList(
        items=items,
        total=len(items),
        total_duration_minutes=total_duration,
    )


async def get_agenda_item(db: Session, item_id: UUID) -> Optional[AgendaItem]:
    """Get a single agenda item by ID"""
    return _mock_agendas.get(str(item_id))


async def create_agenda_item(
    db: Session,
    meeting_id: UUID,
    data: AgendaItemCreate,
) -> AgendaItem:
    """Create a new agenda item"""
    item_id = uuid4()
    now = datetime.now()
    
    item = AgendaItem(
        id=item_id,
        meeting_id=meeting_id,
        order_index=data.order_index,
        title=data.title,
        duration_minutes=data.duration_minutes,
        presenter_id=data.presenter_id,
        presenter_name=data.presenter_name,
        description=data.description,
        notes=data.notes,
        status="pending",
        created_at=now,
        updated_at=now,
    )
    
    _mock_agendas[str(item_id)] = item
    return item


async def update_agenda_item(
    db: Session,
    item_id: UUID,
    data: AgendaItemUpdate,
) -> Optional[AgendaItem]:
    """Update an agenda item"""
    item = _mock_agendas.get(str(item_id))
    if not item:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Create new item with updated fields
    item_dict = item.model_dump()
    item_dict.update(update_data)
    item_dict["updated_at"] = datetime.now()
    
    updated_item = AgendaItem(**item_dict)
    _mock_agendas[str(item_id)] = updated_item
    
    return updated_item


async def delete_agenda_item(db: Session, item_id: UUID) -> bool:
    """Delete an agenda item"""
    if str(item_id) in _mock_agendas:
        del _mock_agendas[str(item_id)]
        return True
    return False


async def save_agenda(
    db: Session,
    data: AgendaSaveRequest,
) -> AgendaList:
    """Save a complete agenda (replace existing items)"""
    # Delete existing items for this meeting
    to_delete = [
        key for key, item in _mock_agendas.items()
        if item.meeting_id == data.meeting_id
    ]
    for key in to_delete:
        del _mock_agendas[key]
    
    # Create new items
    items = []
    for item_data in data.items:
        item = await create_agenda_item(db, data.meeting_id, item_data)
        items.append(item)
    
    total_duration = sum(item.duration_minutes or 0 for item in items)
    
    return AgendaList(
        items=items,
        total=len(items),
        total_duration_minutes=total_duration,
    )


async def generate_agenda_ai(
    db: Session,
    request: AgendaGenerateRequest,
) -> AgendaGenerateResponse:
    """Generate agenda using Gemini-first LLM."""

    if not is_gemini_available():
        logger.warning("LLM not available, returning mock agenda")
        return _generate_mock_agenda(request)

    try:
        chat = GeminiChat(
            system_prompt=(
                "Bạn là MINUTE Agenda Builder cho cuộc họp doanh nghiệp. "
                "Trả lời tiếng Việt, ngắn gọn, không markdown. "
                "Chỉ dùng thông tin đã cho; nếu thiếu thì dùng 'TBD'."
            )
        )

        # Build prompt
        prompt = f"""Tạo agenda chi tiết cho cuộc họp với thông tin sau:
- Tiêu đề: {request.meeting_title}
- Loại cuộc họp: {request.meeting_type or 'general'}
- Mô tả: {request.meeting_description or 'Không có mô tả'}
- Thời lượng: {request.duration_minutes or 60} phút
- Người tham gia: {', '.join(request.participants) if request.participants else 'Chưa xác định'}
{f'- Context bổ sung: {request.context}' if request.context else ''}

Yêu cầu:
1) Tạo agenda với các mục rõ ràng, phù hợp với loại cuộc họp.
2) Phân bổ thời gian hợp lý cho từng mục.
3) Đề xuất người trình bày nếu phù hợp (nếu không rõ, đặt "TBD").
4) Tổng thời lượng không vượt quá {request.duration_minutes or 60} phút.

Trả về JSON theo format:
{{
  "items": [
    {{
      "order_index": 0,
      "title": "Tiêu đề mục agenda",
      "duration_minutes": 10,
      "presenter_name": "Tên người trình bày hoặc null",
      "description": "Mô tả ngắn gọn"
    }}
  ],
  "ai_notes": "Ghi chú thêm của AI về agenda này"
}}

Chỉ trả về JSON, không có text khác."""

        response_text = (await chat.chat(prompt)).strip()
        
        # Clean up response - remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        # Parse JSON
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError("Cannot parse AI response as JSON")
        
        items = []
        for item_data in data.get("items", []):
            items.append(AgendaItemCreate(
                order_index=item_data.get("order_index", len(items)),
                title=item_data.get("title", "Untitled"),
                duration_minutes=item_data.get("duration_minutes", 10),
                presenter_name=item_data.get("presenter_name"),
                description=item_data.get("description"),
            ))
        
        total_duration = sum(item.duration_minutes or 0 for item in items)
        
        logger.info(f"[AI] Generated agenda with {len(items)} items")
        
        return AgendaGenerateResponse(
            items=items,
            total_duration_minutes=total_duration,
            ai_notes=data.get("ai_notes"),
            is_saved=False,
        )
        
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return _generate_mock_agenda(request)


def _generate_mock_agenda(request: AgendaGenerateRequest) -> AgendaGenerateResponse:
    """Generate a mock agenda when AI is not available"""
    duration = request.duration_minutes or 60
    meeting_type = request.meeting_type or "general"
    
    # Different templates based on meeting type
    if meeting_type == "steering":
        items = [
            AgendaItemCreate(order_index=0, title="Khai mạc & Giới thiệu", duration_minutes=5, description="Welcome và mục tiêu cuộc họp"),
            AgendaItemCreate(order_index=1, title="Review tiến độ dự án", duration_minutes=int(duration * 0.3), description="Cập nhật tình hình milestone"),
            AgendaItemCreate(order_index=2, title="Báo cáo ngân sách", duration_minutes=int(duration * 0.2), description="Tình hình tài chính dự án"),
            AgendaItemCreate(order_index=3, title="Đánh giá rủi ro", duration_minutes=int(duration * 0.2), description="Risk assessment và mitigation"),
            AgendaItemCreate(order_index=4, title="Thảo luận & Quyết định", duration_minutes=int(duration * 0.2), description="Các vấn đề cần quyết định"),
            AgendaItemCreate(order_index=5, title="Kết luận & Next steps", duration_minutes=int(duration * 0.1), description="Tổng kết và action items"),
        ]
    elif meeting_type == "weekly_status":
        items = [
            AgendaItemCreate(order_index=0, title="Sprint Goals Review", duration_minutes=5),
            AgendaItemCreate(order_index=1, title="Demo các features hoàn thành", duration_minutes=int(duration * 0.4)),
            AgendaItemCreate(order_index=2, title="Blockers & Issues", duration_minutes=int(duration * 0.25)),
            AgendaItemCreate(order_index=3, title="Kế hoạch sprint tiếp theo", duration_minutes=int(duration * 0.2)),
            AgendaItemCreate(order_index=4, title="Q&A", duration_minutes=int(duration * 0.15)),
        ]
    elif meeting_type == "workshop":
        items = [
            AgendaItemCreate(order_index=0, title="Giới thiệu workshop", duration_minutes=10),
            AgendaItemCreate(order_index=1, title="Phần 1: Presentation", duration_minutes=int(duration * 0.3)),
            AgendaItemCreate(order_index=2, title="Break", duration_minutes=10),
            AgendaItemCreate(order_index=3, title="Phần 2: Hands-on Practice", duration_minutes=int(duration * 0.35)),
            AgendaItemCreate(order_index=4, title="Thảo luận nhóm", duration_minutes=int(duration * 0.15)),
            AgendaItemCreate(order_index=5, title="Tổng kết", duration_minutes=10),
        ]
    else:
        # General meeting
        items = [
            AgendaItemCreate(order_index=0, title="Opening & Agenda Review", duration_minutes=5),
            AgendaItemCreate(order_index=1, title="Nội dung chính 1", duration_minutes=int(duration * 0.35)),
            AgendaItemCreate(order_index=2, title="Nội dung chính 2", duration_minutes=int(duration * 0.35)),
            AgendaItemCreate(order_index=3, title="Thảo luận mở", duration_minutes=int(duration * 0.2)),
            AgendaItemCreate(order_index=4, title="Action Items & Closing", duration_minutes=int(duration * 0.1)),
        ]
    
    total_duration = sum(item.duration_minutes or 0 for item in items)
    
    return AgendaGenerateResponse(
        items=items,
        total_duration_minutes=total_duration,
        ai_notes="Đây là agenda mẫu được tạo tự động. Bạn có thể chỉnh sửa theo nhu cầu.",
        is_saved=False,
    )
