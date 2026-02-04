# 🎯 MeetMate Development Plan

## Tổng quan Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MEETMATE FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   PRE-MEET   │───▶│   IN-MEET    │───▶│  POST-MEET   │          │
│  │              │    │              │    │              │          │
│  │ • Agenda     │    │ • Transcript │    │ • Summary    │          │
│  │ • Documents  │    │ • Actions    │    │ • MoM        │          │
│  │ • Suggest    │    │ • Decisions  │    │ • Tasks Sync │          │
│  │ • Q&A RAG    │    │ • Risks      │    │ • Follow-up  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     AI ENGINE (Gemini)                       │   │
│  │  • Agenda Generation  • Transcript Analysis  • Summarization │   │
│  │  • Document RAG       • Action Detection     • MoM Generation│   │
│  │  • Participant Suggest• Decision Tracking    • Task Sync     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    POSTGRESQL + pgvector                     │   │
│  │  Meetings | Users | Documents | Transcript | Actions | Embed │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Phase 1: Frontend Refinement (2-3 ngày)

### 1.1 Pre-meeting Tab

| Feature | Component | Status | Priority |
|---------|-----------|--------|----------|
| Agenda Editor | `AgendaEditor.tsx` | 🔄 Refine | P0 |
| AI Agenda Generate | `AgendaGenerator.tsx` | ✅ Done | P0 |
| Document Suggestions | `DocumentsPanel.tsx` | ✅ Done | P0 |
| Participant Manager | `ParticipantsPanel.tsx` | ✅ Done | P1 |
| Pre-meeting Q&A | `PreMeetingQA.tsx` | 🔄 Refine | P1 |
| AI Assistant Chat | `AIAssistantPanel.tsx` | ✅ Done | P0 |

**Tasks:**
- [ ] Kết nối AgendaEditor với API `/pre-meeting/agenda/generate`
- [ ] Kết nối DocumentsPanel với API `/pre-meeting/documents/suggest`
- [ ] Thêm invite participant từ user list
- [ ] Lưu pre-meeting questions vào database

### 1.2 In-meeting Tab

| Feature | Component | Status | Priority |
|---------|-----------|--------|----------|
| Live Transcript | `TranscriptViewer.tsx` | 🔄 Mock | P0 |
| Action Item Detector | `ActionDetector.tsx` | 🔄 Mock | P0 |
| Decision Tracker | `DecisionTracker.tsx` | 🔄 Mock | P0 |
| Risk Detector | `RiskDetector.tsx` | 🔄 Mock | P1 |
| AI RAG Q&A | `AIAssistantPanel.tsx` | ✅ Done | P0 |
| Live Recap | `LiveRecap.tsx` | 🆕 New | P2 |

**Tasks:**
- [ ] Tạo WebSocket connection cho live transcript
- [ ] UI confirm/edit detected items (Actions, Decisions, Risks)
- [ ] Real-time extraction với AI
- [ ] Recording controls (nếu có Teams integration)

### 1.3 Post-meeting Tab

| Feature | Component | Status | Priority |
|---------|-----------|--------|----------|
| Executive Summary | `SummaryPanel.tsx` | ✅ Done | P0 |
| Action Items List | `ActionItemsList.tsx` | ✅ Done | P0 |
| Decisions List | `DecisionsList.tsx` | ✅ Done | P0 |
| Risks List | `RisksList.tsx` | ✅ Done | P0 |
| MoM Generator | `MoMGenerator.tsx` | 🆕 New | P0 |
| Task Sync (Jira) | `TaskSync.tsx` | 🆕 New | P1 |
| Email Distribution | `EmailDistribution.tsx` | 🔄 Mock | P2 |
| Highlight Clips | `HighlightClips.tsx` | 🔄 Mock | P3 |

**Tasks:**
- [ ] Kết nối Summary với API `/post-meeting/summary/generate`
- [ ] Export MoM as PDF/Word
- [ ] Action items tracking status
- [ ] Email MoM to participants

---

## 📋 Phase 2: Backend API Development (3-5 ngày)

### 2.1 Pre-meeting APIs

```
POST   /api/v1/pre-meeting/agenda/generate
       Request: { meeting_id, meeting_type, context? }
       Response: { agenda_items[], generated_at }

POST   /api/v1/pre-meeting/agenda/save
       Request: { meeting_id, agenda_items[] }
       Response: { success }

POST   /api/v1/pre-meeting/documents/suggest
       Request: { meeting_id, keywords[], limit? }
       Response: { documents[], relevance_scores }

POST   /api/v1/pre-meeting/participants/suggest
       Request: { meeting_id, context }
       Response: { suggested_users[], reasons[] }

GET    /api/v1/pre-meeting/questions/{meeting_id}
POST   /api/v1/pre-meeting/questions
       Request: { meeting_id, user_id, question, type }
```

### 2.2 In-meeting APIs

```
WebSocket /api/v1/ws/transcript/{meeting_id}
          - Real-time transcript chunks
          - Speaker diarization

POST   /api/v1/in-meeting/transcript/chunk
       Request: { meeting_id, speaker_id, text, timestamp }

POST   /api/v1/in-meeting/extract/actions
       Request: { meeting_id, transcript_chunk }
       Response: { actions[], confidence }

POST   /api/v1/in-meeting/extract/decisions
       Request: { meeting_id, transcript_chunk }
       Response: { decisions[], confidence }

POST   /api/v1/in-meeting/extract/risks
       Request: { meeting_id, transcript_chunk }
       Response: { risks[], confidence }

POST   /api/v1/in-meeting/item/confirm
       Request: { item_id, item_type, confirmed: bool }

GET    /api/v1/in-meeting/recap/{meeting_id}
       Response: { key_points[], current_topic }
```

### 2.3 Post-meeting APIs

```
POST   /api/v1/post-meeting/summary/generate
       Request: { meeting_id }
       Response: { executive_summary, key_decisions, action_count }

POST   /api/v1/post-meeting/mom/generate
       Request: { meeting_id, format: 'html' | 'markdown' }
       Response: { mom_content, generated_at }

POST   /api/v1/post-meeting/mom/export
       Request: { meeting_id, format: 'pdf' | 'docx' }
       Response: { file_url }

POST   /api/v1/post-meeting/distribute
       Request: { meeting_id, recipients[], include_attachments }
       Response: { sent_count, failed[] }

GET    /api/v1/post-meeting/actions/{meeting_id}
PATCH  /api/v1/post-meeting/actions/{action_id}
       Request: { status, notes? }

POST   /api/v1/post-meeting/sync/jira
       Request: { meeting_id, action_ids[], project_key }
       Response: { synced_issues[] }
```

### 2.4 RAG & AI APIs

```
POST   /api/v1/rag/query
       Request: { query, meeting_id?, include_meeting_context? }
       Response: { answer, citations[], confidence }

POST   /api/v1/rag/documents/index
       Request: { document_url, document_type, metadata }
       Response: { indexed: bool, chunks_count }

GET    /api/v1/rag/documents
       Response: { documents[], total }
```

---

## 📋 Phase 3: Database Schema Updates

### 3.1 New Tables Needed

```sql
-- Agenda items (refined)
CREATE TABLE agenda_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meeting(id),
    order_num INT NOT NULL,
    title TEXT NOT NULL,
    duration_minutes INT DEFAULT 10,
    presenter_id UUID REFERENCES user_account(id),
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-meeting questions
CREATE TABLE pre_meeting_question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meeting(id),
    user_id UUID REFERENCES user_account(id),
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'question', -- question, risk, blocker
    answered BOOLEAN DEFAULT FALSE,
    answer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Minutes (MoM)
CREATE TABLE meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meeting(id) UNIQUE,
    executive_summary TEXT,
    full_content TEXT,
    format TEXT DEFAULT 'markdown',
    generated_at TIMESTAMPTZ,
    approved_by UUID REFERENCES user_account(id),
    approved_at TIMESTAMPTZ,
    distributed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distribution log
CREATE TABLE distribution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meeting(id),
    recipient_id UUID REFERENCES user_account(id),
    recipient_email TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task sync log (Jira, Planner)
CREATE TABLE task_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_item_id UUID REFERENCES action_item(id),
    external_system TEXT NOT NULL, -- jira, planner, asana
    external_id TEXT,
    external_url TEXT,
    sync_status TEXT DEFAULT 'pending',
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📋 Phase 4: AI Prompts & Knowledge Base (2-3 ngày)

### 4.1 System Prompts

```python
# Agenda Generation Prompt
AGENDA_PROMPT = """
Bạn là MeetMate AI - trợ lý tạo agenda cuộc họp.

Loại cuộc họp: {meeting_type}
Dự án: {project_name}
Context: {context}

Tạo agenda với format:
1. [Title] - [Duration] phút - [Presenter]
...

Yêu cầu:
- Tổng thời gian: 60 phút
- Luôn có Opening và Closing
- Với Steering: ưu tiên status update và decisions
- Với Sprint Review: ưu tiên demo và retrospective
"""

# Action Item Detection Prompt
ACTION_PROMPT = """
Phân tích transcript và trích xuất ACTION ITEMS:

Transcript:
{transcript}

Rules:
- Chỉ trích xuất cam kết rõ ràng (sẽ làm, đảm nhận, chịu trách nhiệm)
- Xác định owner từ ngữ cảnh
- Nếu có deadline thì ghi rõ
- Format JSON: [{description, owner, deadline, priority}]
"""

# Decision Detection Prompt
DECISION_PROMPT = """
Trích xuất các QUYẾT ĐỊNH từ transcript:

Transcript:
{transcript}

Rules:
- Chỉ lấy quyết định được xác nhận (đồng ý, phê duyệt, thống nhất)
- Ghi rõ người xác nhận
- Format JSON: [{description, confirmed_by, rationale}]
"""
```

### 4.2 Knowledge Base Setup

```python
# Documents to index for RAG
KNOWLEDGE_SOURCES = [
    {
        "type": "policy",
        "sources": [
            "Thông tư 09/2020/TT-NHNN",
            "LPBank Security Policy v3.0",
            "IT Project Management Standards"
        ]
    },
    {
        "type": "project",
        "sources": [
            "Core Banking Requirements Spec",
            "LOS Integration Architecture",
            "Mobile Banking Feature Roadmap"
        ]
    },
    {
        "type": "meeting_history",
        "sources": [
            "Past meeting transcripts",
            "Previous decisions",
            "Action items log"
        ]
    }
]
```

---

## 📋 Timeline Summary

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Frontend Refinement | 2-3 days | - |
| **Phase 2** | Backend APIs | 3-5 days | Phase 1 |
| **Phase 3** | Database Updates | 1-2 days | Phase 2 |
| **Phase 4** | AI & RAG | 2-3 days | Phase 2, 3 |
| **Phase 5** | Testing & Demo | 2-3 days | All |

**Total: ~2 weeks for MVP**

---

## 🎯 MVP Scope (Demo)

### Must Have
- [x] Meeting CRUD
- [x] 3-tab layout (Pre/In/Post)
- [x] AI Agenda generation
- [ ] AI Action/Decision extraction
- [ ] AI Summary generation
- [x] RAG Q&A

### Nice to Have
- [ ] Live transcript (WebSocket)
- [ ] MoM PDF export
- [ ] Jira sync
- [ ] Email distribution

### Future
- [ ] Teams Bot integration
- [ ] Voice recording
- [ ] Multi-language support

---

## 🚀 Next Steps

1. **Immediate**: Kết nối Frontend với deployed API
2. **This week**: Hoàn thiện Pre-meeting flow
3. **Next week**: In-meeting extraction + Post-meeting summary
4. **Week 3**: Demo với mentor, collect feedback

---

*Created: December 2024*
*Last Updated: December 6, 2024*

