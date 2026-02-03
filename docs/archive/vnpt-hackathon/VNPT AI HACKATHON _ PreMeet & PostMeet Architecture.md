# Pre-Meeting & Post-Meeting AI Architecture

**MeetMate | Pre-Meeting & Post-Meeting AI Layer**  
**Nguyên lý kỹ thuật & kiến trúc triển khai (tích hợp VNPT AI)**

---

## **1. Mục tiêu & Phạm vi**

### **1.1. Mục tiêu Pre-Meeting AI**

Trong giai đoạn **Pre-Meeting**, hệ thống AI của MeetMate cần:

* **Tự động sinh Agenda** từ thông tin cuộc họp, lịch sử họp trước, và tài liệu liên quan.
* **Chuẩn bị tài liệu (Pre-Read Pack)**:
  * Link tài liệu liên quan từ Knowledge Hub.
  * Tóm tắt các điểm chính từ biên bản họp trước.
  * Citations rõ ràng cho từng source.
* **Thu thập input trước họp**:
  * Câu hỏi cần thảo luận (Questions).
  * Rủi ro tiềm ẩn (Risks).
  * Yêu cầu từ thành viên (Requests).
* **Gửi thông báo cuộc họp** với nội dung chuẩn bị đến tất cả thành viên.
* **Hỗ trợ Q&A** về nội dung cuộc họp sắp tới dựa trên RAG.

Đồng thời đảm bảo:

* **Chất lượng cao**: Sử dụng LLM strong profile (long-context) cho Pre-Meeting.
* **Bảo mật dữ liệu**: Không rò rỉ PII, filter theo ACL/permission.
* **Dễ mở rộng**: Logic Pre-Meeting có thể tái sử dụng cho recurring meetings.

### **1.2. Mục tiêu Post-Meeting AI**

Trong giai đoạn **Post-Meeting**, hệ thống AI cần:

* **Sinh Executive Summary / Minutes of Meeting** theo chuẩn schema enterprise.
* **Tổng hợp và tối ưu ADR** (Action / Decision / Risk):
  * Loại bỏ trùng lặp (dedupe).
  * Bổ sung thông tin còn thiếu từ transcript.
  * Gắn nguồn (citations) với timecode.
* **Phân phối kết quả** qua Email/Teams với format professional.
* **Export PDF/DOCX** với branding và format chuẩn.
* **Đồng bộ Action Items** sang task management systems (Planner/Jira/LOffice Work).
* **Sinh Video Highlights** (optional) với timecode + tóm tắt.
* **Lưu trữ compliance** với WORM storage và audit trail đầy đủ.

Đồng thời đảm bảo:

* **Batch processing**: SLA = batch, không cần realtime.
* **Long-context**: Có thể xử lý transcript dài (map-reduce nếu cần).
* **Quality over speed**: Ưu tiên chất lượng output hơn tốc độ.

### **1.3. Phạm vi tài liệu**

Tài liệu này tập trung vào:

* **Nguyên lý & kiến trúc tổng thể Pre-Meeting và Post-Meeting AI**.
* Cách bố trí **router – agent – graph – chain – tools** trong `backend/app/llm`.
* Thiết kế **RAG Pre-Meeting** theo kiểu **History-Aware RAG**:
  * Vector search + previous meetings + topic correlation.
  * Project/Department scoping.
* Thiết kế **RAG Post-Meeting** theo kiểu **Long-Context Consolidation**:
  * Full transcript processing + ADR refinement.
  * Cross-meeting trend analysis.
* Cách tích hợp các API **VNPT AI**:
  * **VNPT SmartBot**: LLM cho Agenda/MoM/ADR generation.
  * **VNPT SmartReader**: OCR + bóc tách thông tin cho document ingestion.
  * **VNPT SmartVoice**: (optional) TTS cho audio recap.

---

## **2. Kiến trúc logic Pre-Meeting**

### **2.1. Các thành phần chính**

#### **2.1.1. Client Layer (Electron desktop + Teams add-in)**

**Nhiệm vụ:**

* Hiển thị UI Pre-Meeting với các panel:
  * Agenda Panel (AI generate + manual edit).
  * Reminders Panel (Questions/Risks/Requests).
  * Documents Panel (drag & drop upload).
  * AI Assistant Panel (Q&A chat).
  * Participants Panel (manage attendees).
* Gọi REST API để:
  * Generate agenda: `POST /api/v1/agenda/generate`
  * Manage reminders: CRUD `/api/v1/reminders`
  * Send notifications: `POST /api/v1/meetings/{id}/notify`
  * Q&A chat: `POST /api/v1/ai/chat`

**Kết quả:**

* Người dùng thấy UI kiểu:
  * **Agenda Builder** với AI suggestions.
  * **Pre-Read Pack** với links và summaries.
  * **Reminders Dashboard** phân loại theo type.
  * **AI Chat** để hỏi về cuộc họp sắp tới.

---

#### **2.1.2. Backend MeetMate (FastAPI + LangGraph)**

**API Endpoints:**

```
POST /api/v1/meetings/{meeting_id}/prepare
  → Trigger pre-meeting preparation pipeline
  → Returns: AgendaDraft, PreReadSummary[]

POST /api/v1/agenda/generate
  → AI generate agenda from context
  → Body: { meeting_id, use_history, use_rag }
  → Returns: AgendaItem[]

POST /api/v1/ai/chat
  → Pre-meeting Q&A
  → Body: { meeting_id, question, context }
  → Returns: { answer, citations }

POST /api/v1/meetings/{meeting_id}/notify
  → Send meeting notification
  → Body: { recipients, include_agenda, include_docs, message }
  → Returns: NotificationResult
```

**AI Layer – `backend/app/llm`:**

* `agents/pre_meeting_agent.py`:
  * Orchestration cho Pre-Meeting pipeline.
  * Quản lý state và gọi LangGraph.
* `graphs/pre_meeting_graph.py`:
  * Pre-Meeting Graph với các nodes:
    * Calendar Ingest Node.
    * History RAG Node.
    * Agenda Generator Node.
    * Pre-Read Compiler Node.
    * Distribution Node.
* `chains/pre_meeting_chain.py`:
  * Agenda chain.
  * Pre-read summarization chain.
  * Q&A chain.
* `tools/*.py`:
  * `calendar_tool.py` – fetch calendar/meeting info.
  * `rag_search_tool.py` – search documents.
  * `email_tool.py` – send notifications.

---

#### **2.1.3. Data & RAG cho Pre-Meeting**

**PostgreSQL:**

* `Meeting` – thông tin cuộc họp.
* `AgendaItem` – agenda items với source tracking.
* `MeetingReminder` – questions/risks/requests.
* `MeetingHistory` – link tới các cuộc họp trước liên quan.
* `PreReadDocument` – documents attached for pre-read.

**Vector DB (pgvector):**

* Lưu embedding của:
  * Tài liệu nội bộ đã qua **VNPT SmartReader**.
  * Biên bản các cuộc họp trước (MoM từ Post-Meeting).
  * Email/attachments liên quan.

---

### **2.2. Pre-Meeting Graph (LangGraph)**

```
┌────────────────────────────────────────────────────────────────┐
│                     PRE-MEETING GRAPH                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────────┐                                             │
│   │   START      │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Calendar     │──── Fetch: meeting info, attendees,         │
│   │ Ingest Node  │     recurring pattern, project context      │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ History RAG  │──── RAG: previous meetings, decisions,      │
│   │ Node         │     pending actions, relevant docs          │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Agenda       │──── LLM generates structured agenda         │
│   │ Generator    │     based on history + context              │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Pre-Read     │──── Compile relevant docs & summaries       │
│   │ Compiler     │     with citations                          │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Distribution │──── Send email/Teams notifications          │
│   │ Node         │     with agenda + pre-read pack             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │     END      │                                             │
│   └──────────────┘                                             │
└────────────────────────────────────────────────────────────────┘
```

---

### **2.3. Pre-Meeting State**

```python
class PreMeetingState(TypedDict, total=False):
    # Context
    meeting_id: str
    stage: Literal["pre"]
    sla: Literal["near_realtime", "batch"]
    sensitivity: Literal["low", "medium", "high"]
    
    # Meeting info (from Calendar Ingest)
    meeting_title: str
    meeting_description: str
    meeting_type: str
    start_time: datetime
    end_time: datetime
    location: str
    teams_link: str
    participants: List[Participant]
    project_id: Optional[str]
    department_id: Optional[str]
    recurring_pattern: Optional[str]
    
    # History context (from History RAG)
    previous_meetings: List[MeetingSummary]
    pending_actions: List[ActionItem]
    unresolved_decisions: List[Decision]
    open_risks: List[Risk]
    
    # Generated content
    agenda_items: List[AgendaItem]
    pre_read_docs: List[DocumentSnippet]
    pre_read_summary: str
    
    # Reminders (user input)
    questions: List[ReminderItem]
    risks: List[ReminderItem]
    requests: List[ReminderItem]
    
    # RAG
    rag_docs: List[DocumentChunk]
    citations: List[Citation]
    
    # Distribution
    notification_recipients: List[str]
    notification_sent: bool
    notification_status: str
    
    # Q&A (for AI Assistant)
    last_user_question: Optional[str]
    last_qa_answer: Optional[str]
    
    # Debug
    debug_info: dict
```

---

## **3. RAG Pre-Meeting – History-Aware RAG**

### **3.1. Mục tiêu RAG trong Pre-Meeting**

* Support cho **Agenda Generation** và **Q&A** về cuộc họp sắp tới.
* Ưu tiên:
  * **Lịch sử cuộc họp** (biên bản, decisions, pending actions).
  * **Tài liệu project/department** liên quan.
  * **Kho tri thức nội bộ** (policies, quy trình).
* Mang tinh thần **History-Aware RAG**:
  * Focus vào context của series cuộc họp (recurring).
  * Ưu tiên follow-up từ meetings trước.

### **3.2. Data Sources cho Pre-Meeting RAG**

| Source | Priority | Scope |
|--------|----------|-------|
| Previous Meeting Minutes | 1 (Highest) | Same project/series |
| Pending Action Items | 1 (Highest) | Assigned to attendees |
| Attached Documents | 2 | Meeting attachments |
| Project Documents | 2 | Same `project_id` |
| Department Policies | 3 | Same `department_id` |
| Global Knowledge Base | 4 (Lowest) | Organization-wide |

### **3.3. Pre-Meeting RAG Priority – 4 Layers**

Khi Pre-Meeting graph cần RAG (cho Agenda hoặc Q&A), `RagService` sẽ:

**1. Xác định scope:**
* `meeting_id`, `project_id`, `department_id`
* `recurring_pattern` (nếu là recurring meeting)
* Danh sách `participant_ids`

**2. Áp dụng 4 lớp priority:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-MEETING RAG PRIORITY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 1 – Meeting History Context                     │   │
│  │ • Previous meeting minutes (same series/project)         │   │
│  │ • Pending action items assigned to attendees             │   │
│  │ • Unresolved decisions needing follow-up                 │   │
│  │ • Open risks from previous meetings                      │   │
│  │ Weight: 1.0                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 2 – Meeting Attachments                         │   │
│  │ • Documents explicitly attached to this meeting          │   │
│  │ • Pre-read materials shared by organizer                 │   │
│  │ • Agenda templates for meeting type                      │   │
│  │ Weight: 0.85                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 3 – Project/Topic Documents                     │   │
│  │ • Documents with matching project_id                     │   │
│  │ • Documents with related topic_id (from topic graph)     │   │
│  │ • Recent updates (effective_date within 30 days)         │   │
│  │ Weight: 0.7                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 4 – Global Knowledge                            │   │
│  │ • Department policies                                    │   │
│  │ • Organization-wide procedures                           │   │
│  │ • General templates and guidelines                       │   │
│  │ Weight: 0.5                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**3. Merge & Re-rank:**
```python
def pre_meeting_rag_score(chunk, meeting_context):
    # Base similarity score
    score = chunk.similarity_score
    
    # Priority weight
    priority_weights = {1: 1.0, 2: 0.85, 3: 0.7, 4: 0.5}
    score *= priority_weights[chunk.priority_bucket]
    
    # Recency boost (for meeting history)
    if chunk.source_type == 'meeting_minutes':
        days_ago = (now - chunk.meeting_date).days
        recency_boost = max(0, 1 - (days_ago / 90))  # Decay over 90 days
        score += 0.2 * recency_boost
    
    # Participant overlap boost
    if chunk.has_participant_overlap:
        score += 0.15
    
    # Action/Decision pending boost
    if chunk.has_pending_items:
        score += 0.25
    
    return score
```

### **3.4. Pre-Meeting RAG Pipeline**

```
┌────────────────────────────────────────────────────────────────┐
│               PRE-MEETING RAG RETRIEVAL PIPELINE               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Input: meeting_id, agenda_context, optional_question         │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 1. FETCH MEETING CONTEXT                             │     │
│   │    • Get project_id, department_id, participants     │     │
│   │    • Identify recurring pattern (if any)             │     │
│   │    • Extract entities from meeting title/description │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 2. PRIORITY 1: MEETING HISTORY SEARCH                │     │
│   │    • Query: previous_meetings (project, series)      │     │
│   │    • Query: pending_actions (owner in participants)  │     │
│   │    • Query: open_decisions, open_risks               │     │
│   │    • Limit: top 10 items                             │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 3. PRIORITY 2: ATTACHMENT SEARCH                     │     │
│   │    • Query: documents attached to meeting            │     │
│   │    • Query: pre-read materials                       │     │
│   │    • Limit: top 5 documents                          │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 4. PRIORITY 3: PROJECT DOCS VECTOR SEARCH            │     │
│   │    • Embed: agenda_context / question                │     │
│   │    • Filter: project_id = meeting.project_id         │     │
│   │    • Filter: topic_id related to meeting topics      │     │
│   │    • Limit: top 8 chunks                             │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 5. PRIORITY 4: GLOBAL KNOWLEDGE VECTOR SEARCH        │     │
│   │    • Filter: department_id or org-wide               │     │
│   │    • Filter: doc_type in [policy, procedure, guide]  │     │
│   │    • Limit: top 5 chunks                             │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │ 6. MERGE & RE-RANK                                   │     │
│   │    • Apply priority weights                          │     │
│   │    • Apply recency boost                             │     │
│   │    • Apply participant overlap boost                 │     │
│   │    • Deduplicate similar chunks                      │     │
│   │    • Return top-K (K=15 for agenda, K=8 for Q&A)     │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   Output: rag_docs[] with citations                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## **4. Kiến trúc logic Post-Meeting**

### **4.1. Các thành phần chính**

#### **4.1.1. Client Layer (Electron desktop + Teams add-in)**

**Nhiệm vụ:**

* Hiển thị UI Post-Meeting với các section:
  * Summary Section (AI generate minutes + edit + export).
  * Stats Section (ADR counts).
  * Action Items Section (list + toggle + sync).
  * Decisions Section (list với rationale).
  * Risks Section (grouped by severity).
  * Distribution Section (email, share, export).
* Gọi REST API để:
  * Generate minutes: `POST /api/v1/minutes/generate`
  * Update minutes: `PUT /api/v1/minutes/{id}`
  * Distribute: `POST /api/v1/minutes/{id}/distribute`
  * Export: `GET /api/v1/minutes/{id}/export`

---

#### **4.1.2. Backend MeetMate (FastAPI + LangGraph)**

**API Endpoints:**

```
POST /api/v1/meetings/{meeting_id}/minutes/generate
  → AI generate meeting minutes
  → Body: GenerateMinutesRequest
  → Returns: MeetingMinutes

GET /api/v1/meetings/{meeting_id}/minutes/latest
  → Get latest version
  → Returns: MeetingMinutes

PUT /api/v1/meetings/{meeting_id}/minutes/{version}
  → Update minutes content
  → Body: MinutesUpdate
  → Returns: MeetingMinutes

POST /api/v1/meetings/{meeting_id}/minutes/{version}/approve
  → Approve minutes for distribution
  → Returns: MeetingMinutes

POST /api/v1/meetings/{meeting_id}/minutes/{version}/distribute
  → Distribute minutes via email/teams
  → Body: { channel, recipients }
  → Returns: DistributionRecord

POST /api/v1/meetings/{meeting_id}/actions/sync
  → Sync actions to external task system
  → Body: { target: "planner"|"jira"|"loffice" }
  → Returns: SyncResult

GET /api/v1/meetings/{meeting_id}/export/pdf
  → Export meeting to PDF
  → Returns: PDF file
```

**AI Layer – `backend/app/llm`:**

* `agents/post_meeting_agent.py`:
  * Orchestration cho Post-Meeting pipeline.
  * Batch processing với long-context handling.
* `graphs/post_meeting_graph.py`:
  * Post-Meeting Graph với các nodes:
    * Transcript Consolidation Node.
    * ADR Refiner Node.
    * MoM Generator Node.
    * Checker Agent Node.
    * Highlights Generator Node.
    * Render & Sync Node.
    * Archive & Compliance Node.
* `chains/post_meeting_chain.py`:
  * MoM generation chain.
  * ADR refinement chain.
  * Highlights extraction chain.

---

### **4.2. Post-Meeting Graph (LangGraph)**

```
┌────────────────────────────────────────────────────────────────┐
│                     POST-MEETING GRAPH                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────────┐                                             │
│   │   START      │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Transcript   │──── Consolidate full transcript             │
│   │ Consolidate  │     + In-Meeting ADR events                 │
│   │ Node         │     + Speaker diarization                   │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ ADR Refiner  │──── Dedupe, fill missing, merge             │
│   │ Node         │     Override conflicts, add citations       │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ RAG Enrich   │──── Enrich ADR with policy refs             │
│   │ Node         │     Link to related documents               │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ MoM          │──── LLM Strong profile (long-context)       │
│   │ Generator    │     Executive summary + full minutes        │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ├────────────────────────────────┐                    │
│          │                                │                    │
│          ▼                                ▼                    │
│   ┌──────────────┐                 ┌──────────────┐            │
│   │ Checker      │                 │ Highlights   │            │
│   │ Agent        │                 │ Generator    │            │
│   │ (Validate)   │                 │ (Optional)   │            │
│   └──────┬───────┘                 └──────┬───────┘            │
│          │                                │                    │
│          ▼                                │                    │
│   ┌──────────────┐◄───────────────────────┘                    │
│   │ Render &     │                                             │
│   │ Sync Node    │──── PDF/DOCX export, Task sync              │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Distribution │──── Email/Teams distribution                │
│   │ Node         │     with formatted content                  │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Archive &    │──── WORM storage, Audit trail               │
│   │ Compliance   │     Retention policy compliance             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │     END      │                                             │
│   └──────────────┘                                             │
└────────────────────────────────────────────────────────────────┘
```

---

### **4.3. Post-Meeting State**

```python
class PostMeetingState(TypedDict, total=False):
    # Context
    meeting_id: str
    stage: Literal["post"]
    sla: Literal["batch"]
    sensitivity: Literal["low", "medium", "high"]
    
    # Input data (from In-Meeting)
    full_transcript: str
    transcript_segments: List[TranscriptSegment]
    transcript_word_count: int
    in_meeting_actions: List[ActionItem]
    in_meeting_decisions: List[Decision]
    in_meeting_risks: List[Risk]
    topic_segments: List[TopicSegment]
    
    # Refined ADR (after post-processing)
    actions: List[ActionItem]
    decisions: List[Decision]
    risks: List[Risk]
    adr_citations: List[Citation]
    
    # Generated content
    minutes: MeetingMinutes
    executive_summary: str
    key_points: List[str]
    highlights: List[Highlight]
    
    # RAG enrichment
    rag_policy_refs: List[PolicyReference]
    rag_related_docs: List[DocumentReference]
    
    # Distribution
    distribution_channels: List[str]
    distribution_recipients: List[str]
    distribution_status: dict
    
    # Sync
    synced_tasks: List[TaskSyncRecord]
    sync_target: str  # planner, jira, loffice
    
    # Export
    export_pdf_url: Optional[str]
    export_docx_url: Optional[str]
    
    # Archive
    archive_id: str
    archive_storage_path: str
    compliance_status: str
    retention_until: datetime
    
    # Debug
    debug_info: dict
    processing_time_ms: int
```

---

## **5. RAG Post-Meeting – Long-Context Consolidation**

### **5.1. Mục tiêu RAG trong Post-Meeting**

* Support cho **ADR Enrichment** và **Policy Linking**.
* Enrich decisions/risks với:
  * Policy references.
  * Related documents.
  * Historical context từ previous meetings.
* Mang tinh thần **Long-Context Consolidation**:
  * Process full transcript (có thể dùng map-reduce).
  * Cross-reference với existing knowledge base.

### **5.2. Post-Meeting RAG Architecture**

```
┌────────────────────────────────────────────────────────────────┐
│               POST-MEETING RAG ARCHITECTURE                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                TRANSCRIPT PROCESSING                  │     │
│   │                                                       │     │
│   │  Full Transcript (may be 10,000+ tokens)              │     │
│   │           │                                           │     │
│   │           ▼                                           │     │
│   │  ┌─────────────────────────────────────────────────┐  │     │
│   │  │ Map-Reduce Strategy (if > 8K tokens)            │  │     │
│   │  │ • Split into 2K-token segments                  │  │     │
│   │  │ • Extract ADR from each segment                 │  │     │
│   │  │ • Merge & dedupe results                        │  │     │
│   │  └─────────────────────────────────────────────────┘  │     │
│   │                                                       │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                ADR ENRICHMENT RAG                     │     │
│   │                                                       │     │
│   │  For each Decision/Risk:                              │     │
│   │  ┌─────────────────────────────────────────────────┐  │     │
│   │  │ 1. Policy Search                                │  │     │
│   │  │    • Find relevant policies                     │  │     │
│   │  │    • Attach policy_ref to decision/risk         │  │     │
│   │  │    • Add compliance notes                       │  │     │
│   │  └─────────────────────────────────────────────────┘  │     │
│   │  ┌─────────────────────────────────────────────────┐  │     │
│   │  │ 2. Historical Search                            │  │     │
│   │  │    • Find similar decisions from past meetings  │  │     │
│   │  │    • Link to related risks/outcomes             │  │     │
│   │  │    • Add historical context notes               │  │     │
│   │  └─────────────────────────────────────────────────┘  │     │
│   │  ┌─────────────────────────────────────────────────┐  │     │
│   │  │ 3. Document Search                              │  │     │
│   │  │    • Find technical docs mentioned              │  │     │
│   │  │    • Attach relevant doc references             │  │     │
│   │  │    • Add supporting evidence                    │  │     │
│   │  └─────────────────────────────────────────────────┘  │     │
│   │                                                       │     │
│   └──────────────────────────────────────────────────────┘     │
│                          │                                     │
│                          ▼                                     │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                MOM GENERATION                         │     │
│   │                                                       │     │
│   │  Input:                                               │     │
│   │  • Full transcript (or summarized segments)           │     │
│   │  • Enriched ADR with citations                        │     │
│   │  • Topic segments                                     │     │
│   │  • Agenda items (from Pre-Meeting)                    │     │
│   │                                                       │     │
│   │  Output:                                              │     │
│   │  • Executive Summary (3-5 sentences)                  │     │
│   │  • Full Minutes (Markdown format)                     │     │
│   │  • Key Points (bulleted list)                         │     │
│   │  • Citations throughout                               │     │
│   │                                                       │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### **5.3. Post-Meeting RAG Priority – 3 Layers**

```
┌─────────────────────────────────────────────────────────────────┐
│                   POST-MEETING RAG PRIORITY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 1 – Meeting Transcript Context                  │   │
│  │ • Current meeting transcript (segmented)                 │   │
│  │ • In-meeting ADR events with timecodes                   │   │
│  │ • Topic segments and transitions                         │   │
│  │ Weight: 1.0                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 2 – Policy & Compliance Documents               │   │
│  │ • Relevant policies for decisions made                   │   │
│  │ • Compliance requirements                                │   │
│  │ • Risk assessment frameworks                             │   │
│  │ Weight: 0.9                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PRIORITY 3 – Historical Context                          │   │
│  │ • Similar decisions from past meetings                   │   │
│  │ • Related risks and outcomes                             │   │
│  │ • Action item follow-up history                          │   │
│  │ Weight: 0.7                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **5.4. Long-Context Handling Strategy**

```python
class PostMeetingProcessor:
    MAX_SINGLE_PASS_TOKENS = 8000
    SEGMENT_SIZE_TOKENS = 2000
    OVERLAP_TOKENS = 200
    
    def process_transcript(self, full_transcript: str) -> dict:
        token_count = self.count_tokens(full_transcript)
        
        if token_count <= self.MAX_SINGLE_PASS_TOKENS:
            # Single pass processing
            return self.single_pass_extract(full_transcript)
        else:
            # Map-Reduce processing
            return self.map_reduce_extract(full_transcript)
    
    def map_reduce_extract(self, full_transcript: str) -> dict:
        # MAP: Split into segments and extract ADR from each
        segments = self.split_with_overlap(
            full_transcript, 
            self.SEGMENT_SIZE_TOKENS, 
            self.OVERLAP_TOKENS
        )
        
        segment_results = []
        for segment in segments:
            result = self.extract_adr_from_segment(segment)
            segment_results.append(result)
        
        # REDUCE: Merge and deduplicate
        merged = self.merge_segment_results(segment_results)
        deduped = self.deduplicate_adr(merged)
        
        return deduped
    
    def deduplicate_adr(self, adr_list: List[dict]) -> List[dict]:
        # Group by similarity
        # Prefer items with more context/citations
        # Merge overlapping items
        pass
```

---

## **6. Integration với VNPT AI**

### **6.1. VNPT SmartBot**

**Pre-Meeting:**
* **Agenda Generation**: Dùng SmartBot LLM để sinh agenda từ context.
* **Q&A**: Dùng SmartBot cho conversational AI về cuộc họp.

**Post-Meeting:**
* **MoM Generation**: Dùng SmartBot LLM profile strong cho long-context.
* **ADR Refinement**: Dùng SmartBot để clean và enrich ADR.

```python
# Pre-Meeting Agenda Generation
async def generate_agenda(meeting_context: dict) -> List[AgendaItem]:
    response = await smartbot_client.chat(
        system_prompt=AGENDA_GENERATION_PROMPT,
        user_message=f"Generate agenda for: {meeting_context}",
        model_profile="strong",  # Use strong model
        max_tokens=2000
    )
    return parse_agenda_response(response)

# Post-Meeting MoM Generation
async def generate_mom(meeting_state: PostMeetingState) -> MeetingMinutes:
    response = await smartbot_client.chat(
        system_prompt=MOM_GENERATION_PROMPT,
        user_message=build_mom_context(meeting_state),
        model_profile="strong_long",  # Long-context model
        max_tokens=4000
    )
    return parse_mom_response(response)
```

### **6.2. VNPT SmartReader**

**Document Ingestion Pipeline:**

```
┌────────────────────────────────────────────────────────────────┐
│               SMARTREADER DOCUMENT PIPELINE                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────────┐                                             │
│   │ Document     │──── PDF, DOCX, Images, Scans                │
│   │ Upload       │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ SmartReader  │──── OCR + Layout extraction                 │
│   │ OCR          │     Table detection, Form fields            │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Text         │──── Clean text output                       │
│   │ Extraction   │     Preserve structure                      │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Chunking     │──── 400-800 tokens per chunk                │
│   │              │     10-20% overlap                          │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Topic        │──── Assign topic_id using LLM/heuristics    │
│   │ Assignment   │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Embedding    │──── Generate embeddings                     │
│   │              │     Store in pgvector                       │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Indexing     │──── Store with metadata                     │
│   │              │     Update topic graph                      │
│   └──────────────┘                                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## **7. LLM Prompts**

### **7.1. Agenda Generation Prompt**

```python
AGENDA_GENERATION_PROMPT = """
Bạn là trợ lý AI chuyên về tổ chức cuộc họp cho doanh nghiệp. 
Nhiệm vụ của bạn là tạo agenda chi tiết cho cuộc họp dựa trên thông tin được cung cấp.

**Thông tin cuộc họp:**
- Tiêu đề: {meeting_title}
- Mô tả: {meeting_description}
- Loại họp: {meeting_type}
- Thời lượng: {duration_minutes} phút
- Thành viên: {participants}

**Lịch sử cuộc họp trước (nếu có):**
{previous_meeting_summary}

**Pending Actions cần follow-up:**
{pending_actions}

**Tài liệu liên quan (từ RAG):**
{rag_documents}

**Yêu cầu:**
1. Tạo agenda với 3-7 mục (tùy thời lượng)
2. Mỗi mục có: title, description, duration_minutes, presenter (nếu biết)
3. Phân bổ thời gian hợp lý
4. ƯU TIÊN: Follow-up các pending actions từ cuộc họp trước
5. Để 10% thời gian cho Q&A và wrap-up
6. Không bịa đặt thông tin không có trong context

**Output format (JSON):**
{
  "agenda_items": [
    {
      "title": "...",
      "description": "...",
      "duration_minutes": ...,
      "presenter": "...",
      "is_followup": true/false
    }
  ],
  "suggested_pre_read": ["..."],
  "notes": "..."
}
"""
```

### **7.2. Minutes Generation Prompt**

```python
MOM_GENERATION_PROMPT = """
Bạn là trợ lý AI chuyên tạo biên bản cuộc họp chuyên nghiệp cho doanh nghiệp.

**Thông tin cuộc họp:**
- Tiêu đề: {meeting_title}
- Thời gian: {start_time} - {end_time}
- Địa điểm: {location}
- Thành viên: {participants}
- Agenda: {agenda_items}

**Transcript cuộc họp:**
{transcript}

**Action Items đã trích xuất (từ In-Meeting):**
{action_items}

**Quyết định đã đưa ra:**
{decisions}

**Rủi ro đã nhận diện:**
{risks}

**Policy references (từ RAG):**
{policy_refs}

**Yêu cầu:**
1. Viết biên bản bằng tiếng Việt, văn phong chuyên nghiệp
2. Cấu trúc:
   ## Tóm tắt điều hành
   (3-5 câu tổng kết)
   
   ## Các điểm chính
   (Liệt kê theo agenda items)
   
   ## Quyết định
   (Với rationale và policy reference nếu có)
   
   ## Action Items
   (Với owner, deadline, priority)
   
   ## Rủi ro
   (Với severity và mitigation plan)
   
   ## Bước tiếp theo
   (Next steps và follow-up meeting nếu cần)

3. Gắn citations [T:mm:ss] cho các điểm quan trọng
4. Gắn policy references [Policy: xxx] cho decisions liên quan
5. KHÔNG bịa đặt thông tin không có trong transcript
6. Format: Markdown

**Output:**
Biên bản cuộc họp đầy đủ theo format markdown.
"""
```

### **7.3. ADR Refinement Prompt**

```python
ADR_REFINEMENT_PROMPT = """
Bạn là trợ lý AI chuyên xử lý Action Items, Decisions và Risks từ cuộc họp.

**Dữ liệu ADR thô từ In-Meeting:**
{raw_adr_data}

**Transcript excerpt để cross-check:**
{transcript_excerpt}

**Danh sách participants (để gán owner):**
{participants}

**Nhiệm vụ:**

1. **ACTIONS - Làm sạch và bổ sung:**
   - Loại bỏ trùng lặp (merge similar tasks)
   - Bổ sung owner nếu có thể nhận diện từ transcript
   - Bổ sung due_date nếu có mention
   - Gắn source_timecode chính xác
   - Xác định priority (high/medium/low)

2. **DECISIONS - Clarify và link:**
   - Clarify rationale từ context
   - Xác định impact (business impact nếu có)
   - Link tới related actions
   - Gắn policy_ref nếu liên quan policy nào

3. **RISKS - Assess và mitigate:**
   - Xác định severity (high/medium/low)
   - Đề xuất mitigation nếu có trong thảo luận
   - Gắn owner cho risk
   - Link tới related decisions

**Output format (JSON):**
{
  "actions": [
    {
      "task": "...",
      "owner": "...",
      "due_date": "YYYY-MM-DD",
      "priority": "high|medium|low",
      "source_timecode": 123.5,
      "source_text": "...",
      "related_decision_id": null
    }
  ],
  "decisions": [
    {
      "title": "...",
      "rationale": "...",
      "impact": "...",
      "source_timecode": 456.7,
      "policy_ref": "...",
      "related_action_ids": []
    }
  ],
  "risks": [
    {
      "desc": "...",
      "severity": "high|medium|low",
      "mitigation": "...",
      "owner": "...",
      "source_timecode": 789.0,
      "related_decision_id": null
    }
  ]
}
"""
```

---

## **8. Database Schema**

### **8.1. Pre-Meeting Tables**

```sql
-- Agenda Items
CREATE TABLE agenda_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    duration_minutes INTEGER,
    order_index INTEGER NOT NULL,
    presenter_id UUID REFERENCES user_account(id),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    source VARCHAR(20) DEFAULT 'manual', -- manual, ai_generated, imported
    is_followup BOOLEAN DEFAULT FALSE,
    followup_from_meeting_id UUID REFERENCES meeting(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders (Questions/Risks/Requests)
CREATE TABLE meeting_reminder (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'question', 'risk', 'request'
    content TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'medium',
    is_completed BOOLEAN DEFAULT FALSE,
    ai_hint TEXT, -- AI-generated reminder for in-meeting
    created_by UUID REFERENCES user_account(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-Read Documents
CREATE TABLE pre_read_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    document_id UUID REFERENCES document(id),
    title VARCHAR(500),
    url TEXT,
    summary TEXT,
    added_by UUID REFERENCES user_account(id),
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting History Links
CREATE TABLE meeting_history_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    previous_meeting_id UUID NOT NULL REFERENCES meeting(id),
    link_type VARCHAR(20) DEFAULT 'series', -- series, followup, related
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **8.2. Post-Meeting Tables**

```sql
-- Distribution Records
CREATE TABLE distribution_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minutes_id UUID NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- 'email', 'teams', 'link', 'pdf'
    recipients TEXT[],
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    email_subject TEXT,
    email_body_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Sync Records
CREATE TABLE task_sync_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_item(id) ON DELETE CASCADE,
    target_system VARCHAR(50) NOT NULL, -- 'planner', 'jira', 'loffice'
    external_task_id VARCHAR(255),
    external_url TEXT,
    sync_status VARCHAR(20) DEFAULT 'pending',
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archive Records
CREATE TABLE archive_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meeting(id),
    archive_type VARCHAR(50) NOT NULL, -- 'minutes', 'transcript', 'full'
    storage_path TEXT NOT NULL,
    storage_type VARCHAR(20) DEFAULT 'worm', -- worm, cold, standard
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    retention_until TIMESTAMPTZ,
    compliance_tags TEXT[],
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_by UUID REFERENCES user_account(id)
);

-- Indexes
CREATE INDEX idx_agenda_item_meeting ON agenda_item(meeting_id);
CREATE INDEX idx_reminder_meeting ON meeting_reminder(meeting_id);
CREATE INDEX idx_pre_read_meeting ON pre_read_document(meeting_id);
CREATE INDEX idx_history_link_current ON meeting_history_link(current_meeting_id);
CREATE INDEX idx_distribution_minutes ON distribution_record(minutes_id);
CREATE INDEX idx_task_sync_action ON task_sync_record(action_id);
CREATE INDEX idx_archive_meeting ON archive_record(meeting_id);
```

---

## **9. Bố trí thư mục /llm (Pre/Post-Meeting)**

```
backend/app/llm
├── __init__.py
├── agents
│   ├── __init__.py
│   ├── base_agent.py
│   ├── pre_meeting_agent.py      # Pre-Meeting orchestration
│   ├── post_meeting_agent.py     # Post-Meeting orchestration
│   └── in_meeting_agent.py       # (existing)
├── chains
│   ├── __init__.py
│   ├── pre_meeting_chain.py      # Agenda, Pre-read, Q&A chains
│   ├── post_meeting_chain.py     # MoM, ADR refinement, Highlights
│   ├── in_meeting_chain.py       # (existing)
│   └── rag_chain.py              # Shared RAG chain
├── graphs
│   ├── __init__.py
│   ├── router.py                 # Stage Router pre/in/post
│   ├── state.py                  # MeetingState (shared)
│   ├── pre_meeting_graph.py      # Pre-Meeting LangGraph
│   ├── post_meeting_graph.py     # Post-Meeting LangGraph
│   └── in_meeting_graph.py       # (existing)
├── prompts
│   ├── __init__.py
│   ├── pre_meeting_prompts.py    # Agenda, Pre-read, Q&A prompts
│   ├── post_meeting_prompts.py   # MoM, ADR, Highlights prompts
│   └── in_meeting_prompts.py     # (existing)
├── rag
│   ├── __init__.py
│   ├── pre_meeting_rag.py        # History-Aware RAG
│   ├── post_meeting_rag.py       # Long-Context Consolidation RAG
│   ├── in_meeting_rag.py         # (existing) LightRAG-lite
│   └── priority_ranker.py        # Shared priority ranking logic
├── tools
│   ├── __init__.py
│   ├── calendar_tool.py          # Calendar/meeting fetch
│   ├── email_tool.py             # Email sending
│   ├── task_sync_tool.py         # Planner/Jira sync
│   ├── export_tool.py            # PDF/DOCX export
│   ├── archive_tool.py           # WORM storage
│   └── rag_search_tool.py        # RAG search
└── README.md
```

---

## **10. Phi chức năng & Bảo mật**

### **10.1. Performance (SLA)**

| Stage | SLA | Typical Latency | Max Context |
|-------|-----|-----------------|-------------|
| Pre-Meeting Agenda Gen | Near-realtime | 3-5s | 8K tokens |
| Pre-Meeting Q&A | Near-realtime | 2-4s | 4K tokens |
| Post-Meeting MoM Gen | Batch | 10-30s | 16K tokens (map-reduce) |
| Post-Meeting ADR Refine | Batch | 5-10s | 8K tokens |
| Distribution | Batch | 1-5s | N/A |

### **10.2. Security**

* **PII Protection**:
  * Redact PII trước khi gửi tới external LLM.
  * Log có masking cho sensitive fields.
* **Access Control**:
  * RBAC cho meeting access.
  * Minutes approval workflow.
  * Distribution only to authorized recipients.
* **Audit Trail**:
  * Log mọi action với user_id, timestamp, IP.
  * Minutes version history.
  * Distribution tracking.

### **10.3. Compliance**

* **Retention Policy**:
  * Minutes: 7 years (configurable).
  * Transcript: 3 years.
  * Action Items: Until completion + 1 year.
* **WORM Storage**:
  * Finalized minutes → immutable storage.
  * Checksum verification.
* **E-Discovery Ready**:
  * Full-text search trên archived content.
  * Export theo date range, participants, topics.

---

## **11. Observability**

### **11.1. Metrics**

```python
# Pre-Meeting Metrics
pre_meeting_metrics = {
    "agenda_generation_latency_ms": Histogram,
    "agenda_items_generated": Counter,
    "pre_read_docs_retrieved": Counter,
    "qa_questions_asked": Counter,
    "qa_response_latency_ms": Histogram,
    "notification_sent": Counter,
}

# Post-Meeting Metrics
post_meeting_metrics = {
    "mom_generation_latency_ms": Histogram,
    "mom_word_count": Histogram,
    "adr_items_refined": Counter,
    "adr_duplicates_removed": Counter,
    "distribution_sent": Counter,
    "distribution_failures": Counter,
    "task_sync_success": Counter,
    "task_sync_failures": Counter,
    "archive_size_bytes": Histogram,
}
```

### **11.2. Dashboard**

* **Pre-Meeting Dashboard**:
  * Số meetings được prepare/tuần.
  * % meetings có AI-generated agenda.
  * Avg Q&A questions per meeting.
  * Notification delivery rate.

* **Post-Meeting Dashboard**:
  * Số minutes generated/tuần.
  * Avg ADR items per meeting.
  * Distribution channels breakdown.
  * Task sync success rate.

---

## **12. Future Enhancements**

### **12.1. Pre-Meeting**

- [ ] Auto-suggest participants based on meeting topic
- [ ] Smart scheduling based on participant availability
- [ ] Pre-read completion tracking
- [ ] Integration với project management (Jira/Azure DevOps)
- [ ] Recurring meeting templates

### **12.2. Post-Meeting**

- [ ] Video highlights extraction (timecode-based clips)
- [ ] Sentiment analysis for meeting effectiveness
- [ ] Trend analysis across multiple meetings
- [ ] Integration với BI dashboards
- [ ] Auto-generate follow-up meeting suggestion
- [ ] Action item reminder automation

---

*Document Version: 2.0*  
*Last Updated: December 2024*  
*Author: MeetMate Development Team*
