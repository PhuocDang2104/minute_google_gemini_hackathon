# Data Engineer Guide (DB + AI Layer)

This note is for data engineers to connect to Postgres, understand the current schema, and extend it to support the AI/LangGraph flows.

## Connection & Environment
- Default dev stack: `docker compose` from `infra/`.
  - Postgres service: host `localhost`, port `5433`, db `meetmate`, user/password `meetmate`.
  - Init SQL auto-runs on first boot: `infra/postgres/init/01_init_extensions.sql`, `02_schema.sql`, `03_seed_mock.sql`.
- Env templates: `infra/env/.env.local.example` (host=localhost, port=5433 when running via compose).
- Connection string examples:
  - `psql postgresql://meetmate:meetmate@localhost:5433/meetmate`
  - SQLAlchemy: `postgresql+psycopg2://meetmate:meetmate@localhost:5433/meetmate`

## Schema sources
- Canonical schema (SQL): `infra/postgres/init/02_schema.sql` (+ seed `03_seed_mock.sql`).
- ORM models: `backend/app/models/*.py`.
- Alembic (migrations): `backend/alembic/` (currently empty placeholder).

## How to evolve the schema
1) Stand up DB:
   ```powershell
   cd infra
   docker compose up -d
   ```
2) Make changes via Alembic (preferred):
   ```powershell
   cd backend
   .\.venv\Scripts\activate  # or use Docker backend container
   alembic revision -m "add transcript tables" --autogenerate
   alembic upgrade head
   ```
   - Ensure models reflect new tables/columns before `autogenerate`.
3) Update SQL seeds if needed:
   - Add base data to `infra/postgres/init/03_seed_mock.sql` (only applied on fresh volumes).
   - For incremental seed, use `scripts/seed_data.py` or a new migration with INSERTs.

## Tables relevant to AI/LangGraph
- Meetings/users/projects/org/departments are defined in `02_schema.sql`.
- To support the new LangGraph `MeetingState` (actions/decisions/risks/transcripts), add or extend tables such as:
  - `transcript_chunk` (meeting_id, speaker, text, start_ts, end_ts, source) for storage and retrieval windows.
  - `action_item` (meeting_id, task, owner, due_date, priority, source_timecode, status).
  - `decision_item` (meeting_id, title, rationale, impact, source_timecode).
  - `risk_item` (meeting_id, desc, severity, mitigation, owner, source_timecode).
  - `embeddings` / `documents` already exist; extend with `meeting_id`, `chunk_id`, `vector` for RAG.
- Align column names with `MeetingState` keys (actions/decisions/risks) to make graph outputs easy to persist.

## How backend will use it
- LangGraph produces `MeetingState`; API/WS endpoints will persist:
  - transcript chunks → `transcript_chunk` (and to pgvector for retrieval).
  - actions/decisions/risks → respective tables (with meeting_id + timecodes).
  - citations/docs → `document`/`embedding`.
- Services layer (`backend/app/services/*`) is the place to write DB writes/reads; keep AI code (graphs/chains) separate from persistence.

## Validation checklist before merging DB changes
- Run `docker compose up -d --build` after schema change to ensure init scripts are consistent.
- If using Alembic, run `alembic upgrade head` inside the backend container or host venv.
- Confirm health:
  ```powershell
  docker exec -it vnpt_meetmate_db psql -U meetmate -d meetmate -c "\dt"
  ```
- Coordinate with AI/Backend engineers:
  - Expose new tables/columns via SQLAlchemy models + Pydantic schemas.
  - Provide sample data in seed SQL for quick demos.
