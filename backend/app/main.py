from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import get_settings
from app.api.v1.endpoints import (
    admin,
    users,
    sessions,
    meetings,
    projects,
    documents,
    agenda,
    knowledge,
    diarization,
    in_meeting,
    post_meeting,
    rag,
    agents,
    chat_http,
    health,
    action_items,
    transcripts,
    participants,
    minutes,
    minutes_template,
    tools,
    marketing,
    asr,
)
from app.api.v1.websocket import in_meeting_ws

settings = get_settings()

# Parse CORS origins from settings
def get_cors_origins():
    origins = settings.cors_origins
    if origins == '*':
        return ['*']
    return [o.strip() for o in origins.split(',') if o.strip()]

app = FastAPI(
    title=settings.project_name,
    description="Minute - AI Meeting & Study Copilot",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health.router, prefix=f"{settings.api_v1_prefix}/health", tags=['health'])
app.include_router(admin.router, prefix=f"{settings.api_v1_prefix}/admin", tags=['admin'])
app.include_router(users.router, prefix=f"{settings.api_v1_prefix}/users", tags=['users'])
app.include_router(sessions.router, prefix=f"{settings.api_v1_prefix}/sessions", tags=['sessions'])
app.include_router(meetings.router, prefix=f"{settings.api_v1_prefix}/meetings", tags=['meetings'])
app.include_router(projects.router, prefix=f"{settings.api_v1_prefix}/projects", tags=['projects'])
app.include_router(documents.router, prefix=f"{settings.api_v1_prefix}/documents", tags=['documents'])
app.include_router(agenda.router, prefix=f"{settings.api_v1_prefix}/agenda", tags=['agenda'])
app.include_router(knowledge.router, prefix=f"{settings.api_v1_prefix}/knowledge", tags=['knowledge'])
# Diarization API temporarily disabled - using external service instead
# app.include_router(diarization.router, prefix=f"{settings.api_v1_prefix}", tags=['diarization'])
app.include_router(in_meeting.router, prefix=f"{settings.api_v1_prefix}/in-meeting", tags=['in-meeting'])
app.include_router(post_meeting.router, prefix=f"{settings.api_v1_prefix}/post-meeting", tags=['post-meeting'])
app.include_router(rag.router, prefix=f"{settings.api_v1_prefix}/rag", tags=['rag'])
app.include_router(agents.router, prefix=f"{settings.api_v1_prefix}/agents", tags=['agents'])
app.include_router(chat_http.router, prefix=f"{settings.api_v1_prefix}/chat", tags=['chat'])
app.include_router(action_items.router, prefix=f"{settings.api_v1_prefix}/items", tags=['items'])
app.include_router(transcripts.router, prefix=f"{settings.api_v1_prefix}/transcripts", tags=['transcripts'])
app.include_router(participants.router, prefix=f"{settings.api_v1_prefix}/participants", tags=['participants'])
app.include_router(minutes.router, prefix=f"{settings.api_v1_prefix}/minutes", tags=['minutes'])
app.include_router(minutes_template.router, prefix=f"{settings.api_v1_prefix}/minutes-templates", tags=['minutes-templates'])
app.include_router(tools.router, prefix=f"{settings.api_v1_prefix}/tools", tags=['tools'])
app.include_router(marketing.router, prefix=f"{settings.api_v1_prefix}/marketing", tags=['marketing'])
app.include_router(asr.router, prefix=f"{settings.api_v1_prefix}/asr", tags=['asr'])
app.include_router(in_meeting_ws.router, prefix=f"{settings.api_v1_prefix}/ws", tags=['ws'])

# Serve uploaded files (local)
upload_path = (Path(__file__).parent.parent / "uploaded_files").resolve()
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(upload_path)), name="files")


@app.get('/')
def root():
    return {"message": "Minute API v2 running"}

