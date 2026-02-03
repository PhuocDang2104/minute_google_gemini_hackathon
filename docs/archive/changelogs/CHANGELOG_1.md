# Changelog 1 – AI layer skeleton & dockerized backend

## Tóm tắt
- Bổ sung Dockerfile backend và mở rộng `infra/docker-compose.yml` để chạy FastAPI cùng Postgres, mount code hot-reload, hỗ trợ `GEMINI_API_KEY`.
- Hoàn thiện `requirements.txt` theo code thực tế (pydantic v2 + pydantic-settings, google-generativeai, version pins cho FastAPI/SQLAlchemy/LangGraph/LangChain...).
- Dựng sườn LangGraph: `MeetingState` chung, router 3 giai đoạn (pre/in/post) và subgraph stub, agent wrappers.
- Wire API/WS vào router: `POST /api/v1/agents/{stage}`, WS `/api/v1/ws/in-meeting/{session_id}`, in-meeting REST demo dùng state từ graph.
- Viết tài liệu AI layer (`backend/app/llm/README.md`) và hướng dẫn data engineer về DB/schema/migration (`docs/data_engineer_guide.md`).

## Chi tiết chính
- Backend Docker: `backend/Dockerfile`, compose service `backend` (port 8000, DB URL trỏ service postgres).
- LangGraph:
  - `graphs/state.py` định nghĩa MeetingState + stub StateGraph khi thiếu langgraph.
  - `graphs/router.py` router node + conditional edges → subgraphs `pre/in/post`.
  - Subgraphs thêm stub nodes (agenda, recap+ADR+QA, post-summary).
  - Agents wrap router với stage mặc định.
- API/WS:
  - `/api/v1/agents/{stage}` nhận payload MeetingState và trả state sau graph.
  - WS `/api/v1/ws/in-meeting/{session_id}` nhận `{chunk, question?, meeting_id?, full_transcript?}` trả state.
  - In-meeting REST (`recap`, `actions`) gọi graph stub để demo output.
- Docs:
  - `backend/app/llm/README.md`: layout, MeetingState contract, router, cách mở rộng.
  - `docs/data_engineer_guide.md`: kết nối Postgres, nguồn schema, hướng dẫn alembic/seed, gợi ý bảng transcript/action/decision/risk.

## Hướng dẫn chạy nhanh (dev)
- Docker (khuyến nghị): `cd infra && docker compose up -d --build` (tùy chọn set `GEMINI_API_KEY`). DB `localhost:5433`, backend `http://localhost:8000`.
- WS thử nhanh: kết nối `/api/v1/ws/in-meeting/{session_id}`, gửi `{"chunk": "text", "question": "?"}` để nhận state stub.
- REST thử nhanh: `POST /api/v1/agents/in` với `{ "transcript_window": "some text" }` xem recap/actions stub.
