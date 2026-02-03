# AI Architecture

**MeetMate | AI LangGraph/LangChain Architecture**  
**( RAG, Tool-Calling & Multi-Stage Meeting Assistant )**

## **1\. Mục tiêu & Phạm vi kiến trúc AI**

**Mục tiêu chính của AI layer trong MeetMate**

* Chuẩn hóa cách xử lý **Pre-Meeting → In-Meeting → Post-Meeting** trên một kiến trúc chung  
* Tách bạch rõ:  
  * **Logic nghiệp vụ họp** (agenda, action, decision…)  
  * **Hạ tầng AI** (ASR, LLM, RAG, tool-calling).  
* Đảm bảo:  
  * **Realtime** cho In-Meeting, **độ chính xác cao** cho Pre và Post-Meeting.  
  * **Bảo mật dữ liệu** theo chuẩn ngân hàng, không rò rỉ PII ra ngoài.  
  * **Khả năng quan sát & kiểm soát chi phí** (SLA, token budget, routing).

Kiến trúc được thiết kế bám theo tư duy enterprise RAG/agent: ingestion → indexing → retrieval → multi-agent orchestration, giống các reference như Vertex AI RAG Engine & RAG reference architectures cho enterprise. [Google Cloud Documentation+1](https://docs.cloud.google.com/architecture/rag-genai-gemini-enterprise-vertexai?utm_source=chatgpt.com)

---

## **2\. Tổng quan kiến trúc AI dùng LangGraph / LangChain**

Ở tầng AI, MeetMate dùng một **LangGraph graph chung** (hoặc vài graph liên quan) với:

* **Supervisor / Router node**:  
  * Nhìn vào `stage` (pre/in/post), `sensitivity`, `SLA_profile`.  
  * Quyết định: chạy subgraph nào, dùng profile model nào (fast/strong), bật/tắt tool nào.  
* **Các Subgraph/Agent chính**:  
  * **Pre-Meeting Agent Graph** – RAG \+ agenda builder.  
  * **In-Meeting Realtime Graph** – streaming recap, ADR extractor, Q\&A agent, tool-caller.  
  * **Post-Meeting Batch Graph** – long-context summarizer, highlights, task sync.  
* **State chung**:  
  * `MeetingState` (id, stage, participants, permissions…)  
  * `TranscriptState` (chunks, speakers, topics…)  
  * `ActionDecisionRiskState` (list action/decision/risk đã detect \+ citations).

LangGraph cho phép triển khai **multi-agent workflow với supervisor, checkpointing, human-in-the-loop** – giống các pattern multi-agent mà nhiều enterprise đang dùng để điều phối AI agent ở production. [Arize AI+2Royal Cyber+2](https://arize.com/docs/phoenix/cookbook/agent-workflow-patterns/langgraph?utm_source=chatgpt.com)

---

## **3\. Router 3 giai đoạn (Stage-Aware AI Router)**

### **3.1 Input & Policy**

Router nhận các input chính:

* `stage`: `PRE_MEETING | IN_MEETING | POST_MEETING`  
* `sensitivity`: `LOW | MEDIUM | HIGH` (dựa loại cuộc họp, phòng ban).  
* `SLA`: `REALTIME | NEAR_REALTIME | BATCH`  
* `tenant_policy`: cho phép dùng API nào (Azure OpenAI, VNPT SmartBot, on-prem LLM…).

Từ đó Router chọn:

* **Subgraph**: Pre / In / Post.  
* **Model profile**:  
  * `fast` (In-Meeting): model nhỏ, streaming, latency thấp.  
  * `strong` (Pre và Post-Meeting): model lớn, long-context, ưu tiên chất lượng.  
* **Tool allow-list**:  
  * In-Meeting chỉ cho phép `create_task`, `open_doc`, `schedule_meeting` với 1-click confirm.  
  * Post-Meeting cho phép `publish_minutes`, `sync_task`, `render_highlights`.

### **3.2 Bảng mapping (ví dụ)**

* **Pre-Meeting**  
  * `SLA`: BATCH/NEAR\_REALTIME  
  * Model: Enterprise LLM mạnh (cloud/private)  
  * Tools: RAG search, Email/Teams send, fetch\_calendar.

* **In-Meeting**  
  * `SLA`: REALTIME (sub-second)  
  * Model: fast streaming LLM, ASR streaming  
  * Tools: create\_task, fetch\_policy, poll/vote, fetch\_doc.

* **Post-Meeting**  
  * `SLA`: BATCH  
  * Model: strong long-context  
  * Tools: generate\_minutes, sync\_task, render\_video, archive\_compliance.

Pattern này tương đồng với cách các nền tảng enterprise chia profile cho real-time agent vs offline agent (low latency vs high accuracy). [CorticalFlow+1](https://corticalflow.com/en/blog/real-time-ai-agent-orchestration-production-systems?utm_source=chatgpt.com)

---

## **4\. Pre-Meeting AI Architecture (Agent cho chuẩn bị họp)**

### **4.1 Nhiệm vụ AI**

* Phân tích calendar: xác định **dự án, đơn vị, chủ đề**.  
* RAG lên LOffice/SharePoint để lấy:  
  * Đề án, policy, KPI, minutes cũ, quyết định trước.  
* Sinh:  
  * Agenda đề xuất.  
  * Pre-read pack (link tài liệu, đoạn tóm tắt, citations).  
* Thu & chuẩn hóa input trước họp (câu hỏi, risk, yêu cầu demo).

### **4.2 LangGraph Subgraph: Pre-Meeting**

Các node chính:

1. **Calendar Ingest Node**  
   * Input: `meeting_id`.  
   * Gọi Microsoft Graph \+ LOffice API để lấy title, description, attendees, files đính kèm  
   * Gắn `entities` (mã dự án, phòng ban) vào state.

2. **Pre-Meeting RAG Node**  
   * Dùng **RAG Service**: vector DB \+ BM25.  
   * Query dựa trên `entities`, keywords từ title và lịch sử họp trước.  
   * Kết quả: danh sách `DocumentSnippet` \+ metadata & permission.

3. **Agenda & Pre-Read Generator Node**

   * Gọi LLM profile **strong** (Enterprise API/VNPT SmartBot).  
   * Prompt:  
     * Đầu vào: snippets \+ policy \+ template agenda LPBank.  
     * Ràng buộc:  
       * Sinh agenda rõ ràng, liệt kê tài liệu kèm citations.  
       * No-hallucination: “no-source no-answer”.  
   * Output: `AgendaDraft`, `PreReadSummary[]`.

4. **Distribution Node**  
   * Tool-calling: gửi email/Teams message, cập nhật vào **Meeting Workspace**.  
   * Log action vào `AuditLog`.

Đây là một **RAG workflow \+ summarizer** tương tự các RAG reference: ingestion → retrieval → LLM → citations, nhưng đóng gói trong LangGraph subgraph riêng để dễ quan sát & debug. [Google Cloud Documentation+2Google Cloud Documentation+2](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview?utm_source=chatgpt.com)

---

## **5\. In-Meeting Realtime AI Architecture**

### **5.1 Nhiệm vụ AI**

* Nhận audio stream từ Teams/desktop.  
* **ASR realtime \+ diarization** → transcript theo speaker (vi/en).  
* **Live recap** theo timeline.  
* **Nhận diện Action / Decision / Risk (ADR)**.  
* **Q\&A** trên transcript \+ RAG policy/số liệu.  
* **Tool-calling realtime** với 1-click confirm.

### **5.2 Luồng Realtime (streaming pipeline)**

#### **5.2.1 From client tới ASR**

1. Desktop/Teams bot → **WebSocket/gRPC** → `Transcription Service`.  
2. `Transcription Service`:  
   * Gọi VNPT SmartVoice hoặc Azure Speech (diarization, custom vocab).  
   * Kết quả: stream `TranscriptChunk{t, speaker, text}`.

#### **5.2.2 In-Meeting Graph (LangGraph Subgraph)**

Trên LangGraph, ta xây một **Realtime Agent Graph** với:

* **Node: Transcript Aggregator**  
  * Buffer các chunk theo cửa sổ (rolling window 10–30s).  
  * Gắn `topic_id`/segment nếu detect chuyển chủ đề.

* **Node: Live Recap Agent**  
  * Fast LLM (streaming).  
  * Input: cửa sổ transcript gần nhất \+ context ngắn về agenda.  
  * Output:  
    * `LiveRecap` (2-3 câu) hiển thị ở panel.  
    * Cập nhật `TimelineRecap` trong state.

* **Node: ADR Extractor Agent**  
  * LLM được prompt chuyên biệt:  
    * Tìm pattern: “Anh B chịu trách nhiệm… trước ngày…”, “Chúng ta chốt phương án…”.  
  * Output JSON:  
    * `ActionItem{task, owner, due_date, priority, source_timecode}`  
    * `Decision{title, rationale, impact, source_timecode}`  
    * `Risk{desc, severity, mitigation, owner}`  
  * Append vào `ActionDecisionRiskState`.

* **Node: Q\&A Agent (Conversational RAG)**  
  * Trigger khi user bấm **Ask-AI**.  
  * Input:  
    * Câu hỏi \+ last N phút transcript \+ RAG kết quả (policy, KPI…).  
  * Output:  
    * Câu trả lời có citations, highlight phần trong transcript/tài liệu làm nguồn.

* **Node: Tool-Calling Orchestrator**  
  * Nhận `ActionItem/Decision/Risk` đã detect.  
  * Đề xuất hành động (create\_task, schedule\_followup, attach\_doc).  
  * Gửi về UI → user **confirm 1-click** → mới call:  
    * Planner/Jira/TFS/LOffice Work qua API.  
        
* **Guardrails Node / Policy Check**  
  * Kiểm soát:  
    * Không gửi transcript raw ra ngoài tenant.  
    * Giới hạn loại tool được phép gọi.  
    * Rate-limit hành động/meeting.

Pattern này là một **multi-agent realtime system** (recap agent, ADR agent, Q\&A agent, tool-agent) điều phối bởi LangGraph, giống các multi-agent workflow thực tế: supervisor, agents chuyên biệt, tools riêng, checkpoint state. [blog.futuresmart.ai+2Arize AI+2](https://blog.futuresmart.ai/multi-agent-system-with-langgraph?utm_source=chatgpt.com)

---

## **6\. Post-Meeting AI Architecture (Batch & Long-Context)**

### **6.1 Nhiệm vụ AI**

* Sinh **Executive Summary / Minutes of Meeting** chuẩn schema.  
* Tối ưu lại danh sách **Action/Decision/Risk** (dedupe, fill missing).  
* Sinh **Video Highlights** (timecode \+ tóm tắt).  
* Đồng bộ task & lưu trữ compliance.

### **6.2 Batch Graph (LangGraph Subgraph)**

Các node chính:

1. **Transcript Consolidation Node**  
   * Gom toàn bộ transcript (multi-segment) \+ ADR events \+ RAG citations.  
   * Có thể chạy **map-reduce** nếu cuộc họp dài.

2. **MoM Generator Node**  
   * LLM profile **strong long-context**.  
   * Prompt:  
     * Input: full transcript/segments \+ ADR list \+ agenda.  
     * Output:  
       * `Minutes{ objectives, decisions, actions, risks, next_steps }`.  
   * Chạy kèm một **Checker Agent**:  
     * So sánh output với raw ADR list, tránh bỏ sót quyết định quan trọng.

3. **Highlights Generator Node**  
   * Ranking theo:  
     * Mật độ action/decision.  
     * Thời lượng & mức độ tranh luận (kết hợp sentiment nếu dùng SmartVoice/GenAI analytics).

   * Output:  
     * Danh sách `Highlight{ start_t, end_t, title, summary }`.

4. **Rendering & Sync Node**  
   * Tool-calling:  
     * `/meetings/{id}/minutes` → DOCX/PDF.  
     * `/actions` → sync task sang Planner/Jira/LOffice Work.  
     * `/highlights/{id}/render` → generate video.

5. **Archive & Compliance Node**  
   * Đẩy transcript, minutes, ADR, highlights vào **WORM storage**.  
   * Ghi `AuditTrail` (ai xem/sửa gì, khi nào).

---

## **7\. RAG & Knowledge Hub Architecture**

### **7.1 Ingestion & Indexing**

* Nguồn: LOffice, SharePoint/OneDrive, wiki, email đính kèm, file scan.  
* Pipeline:  
  1. **SmartReader / OCR** để convert PDF/ảnh → text \+ layout.  
  2. **Chunking** 400–800 tokens \+ overlap 10–20%.  
  3. **Metadata**:  
     * `department`, `project_id`, `doc_type`, `effective_date`, `permission`.  
  4. **Embeddings**:  
     * Ưu tiên chạy nội bộ; nếu dùng API → bật zero-retention, redaction.  
  5. **Indexing**:  
     * Vector DB (pgvector/Milvus) \+ BM25 cho keyword.

Flow này tương đồng với các RAG Engine enterprise: data ingestion → transformation → indexing → retrieval, có enrich metadata & permission filters. [Google Cloud Documentation+1](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview?utm_source=chatgpt.com)

### **7.2 Query & Policy-Aware Answering**

* **Hybrid search**: semantic \+ keyword \+ filter theo:  
  * `department`, `project_id`, `effective_date <= meeting_date`.  
  * ACL theo user/meeting (permission-aware).

* **Policy-aware prompting**:  
  * Grounded answer \+ citations.  
  * Nếu không có nguồn → trả lời “không có dữ liệu phù hợp”.

* Dùng chung cho:  
  * Pre-Meeting agenda generation.  
  * In-Meeting Q\&A.  
  * Post-Meeting Q\&A sau cuộc họp.

---

## **8\. Tool-Calling & Integration Layer**

### **8.1 Bộ function chuẩn**

* `create_task(owner, content, due_date, source_meeting, source_timecode)`  
* `schedule_meeting(datetime, participants, topic, source_meeting)`  
* `fetch_policy(policy_id | query, scope)`  
* `attach_doc(meeting_id, doc_id)`  
* `send_summary(meeting_id, channel, recipients)`

### **8.2 Nguyên tắc vận hành**

* **Human-in-the-loop**:  
  * In-Meeting: mọi tool-call quan trọng đều phải confirm trong UI.  
  * Post-Meeting: cho phép auto-apply với policy an toàn (vd: sync task nội bộ team).

* **Idempotency**:  
  * Request ID per meeting/action để tránh tạo task trùng.

* **Circuit-breaker**:  
  * Nếu vendor rate-limit hoặc lỗi → queue lại, thông báo nhẹ cho user.

---

## **9\. Observability, Governance & Cost Optimisation**

### **9.1 Observability**

* **Tracing theo `meeting_id`**:  
  * ASR latency, LLM latency, số token, số tool-call.

* **LangGraph checkpointing**:  
  * Lưu state theo step → hỗ trợ replay, điều tra incident, human-review. [Arize AI+1](https://arize.com/docs/phoenix/cookbook/agent-workflow-patterns/langgraph?utm_source=chatgpt.com)

### **9.2 Governance & Security**

* **Content Firewall**:  
  * Pre-processor: PII masking, token hóa participant (PARTICIPANT\_01…).  
  * Post-processor: restore định danh sau khi qua LLM nếu cần.

* **Model version pinning**:  
  * Cố định version; rollout model mới qua canary.

* **Compliance**:  
  * Log đầy đủ: prompt, context, tool-call, output; gắn `meeting_id`, `user_id`.  
  * Retention policy theo quy định LPBank.

### **9.3 Cost & Performance**

* Router gửi workload:  
  * In-Meeting → `fast` profile, context nhỏ, rolling window.  
  * Post-Meeting → `strong` profile, batch, map-reduce.

* **Token budget per meeting**:  
  * Hạn chế Ask-AI spam, reuse context & cache (FAQ, glossary nội bộ).

* Tối ưu embedding & RAG:  
  * Cache query phổ biến.  
  * Giảm kích thước context (chỉ lấy top-k \+ re-rank).

# LangGraph ( Router \+ Sub-Graphs )

# **MeetMate | Backend LLM / LangGraph Architecture Overview**

## **0\. Mục đích tài liệu**

Tài liệu này mô tả **kiến trúc tổng quan** của tầng AI/LLM trong MeetMate, tập trung vào:

* Cách map các khối kiến trúc (Pre / In / Post Meeting, RAG, Realtime agent) vào **folder structure** hiện có của `backend/app`.  
* Thiết kế **LangGraph router** chung cho 3 giai đoạn: `pre`, `in`, `post`.  
* Định nghĩa **state dùng chung (`MeetingState`)** cho tất cả các graph.  
* Nguyên lý hoạt động: request từ client → FastAPI → LangGraph → trả kết quả.  
* Đặt nền cho việc triển khai chi tiết In-Meeting graph sau này.

---

## **1\. Mapping kiến trúc → folder `backend/app`**

### **1.1. Kiến trúc logic (từ high-level)**

Từ tài liệu kiến trúc, backend MeetMate có các khối chính:

* **Client Layer**: Electron app \+ Teams add-in.  
* **Communication Layer**: WebSocket cho realtime In-Meeting, REST cho Pre/Post/RAG.  
* **Backend Core & Data**:  
  * Meeting Ingest, Transcription, Realtime Agent, RAG, Summary & Action, Task Sync…  
* **AI / ML Layer**:  
  * ASR, diarization, LLM serving, LangGraph orchestration.  
* **Security & Compliance**:  
  * RBAC, content firewall, audit log, retention.

Các khối này được **materialize** trong `backend/app` như sau:

### **1.2. Các layer trong `backend/app`**

#### **1.2.1. `api/` – FastAPI routers (HTTP \+ WebSocket)**

* Định nghĩa các endpoint mà client gọi:  
  * `api/v1/endpoints/meetings.py`: CRUD meeting, metadata.  
  * `api/v1/endpoints/in_meeting.py`: REST cho in-meeting agent (nếu có).  
  * `api/v1/endpoints/pre_meeting.py`, `post_meeting.py`: Pre/Post pipelines.  
  * `api/v1/endpoints/rag.py`: `/rag/query`, `/rag/reindex`.  
  * `api/v1/endpoints/agents.py`: list/config agents.  
  * `api/v1/endpoints/chat_http.py`: generic chat REST.  
  * `api/v1/endpoints/health.py`: health/ready endpoints.  
  * `api/v1/websocket/in_meeting_ws.py`: WebSocket realtime `/ws/in-meeting/{session_id}`.

* **Vai trò**:

  * Là lớp **API/vỏ**: nhận HTTP/WS request từ client.  
  * Chuyển request thành **input chuẩn** cho LangGraph (tức là tạo `MeetingState`).  
  * Gọi tới các **services** hoặc **graphs** tương ứng.  
  * Format lại output state → JSON trả cho client (dashboard, panel, live UI).

---

#### **1.2.2. `models/`, `schemas/`, `services/` – Business logic \+ DB**

* `models/`: SQLAlchemy models (User, Meeting, Document, TranscriptChunk, ActionItem…).  
* `schemas/`: Pydantic models để validate request/response.  
* `services/`: business logic **non-LLM**, ví dụ:  
  * `meeting_service.py`: tạo / update / lấy meeting, participants.  
  * `document_service.py`: upload file, link vào meetings.  
  * `chat_service.py`: log chat sessions, history.

* **Vai trò**:

  * Giữ phần **nghiệp vụ / dữ liệu** không phụ thuộc AI.  
  * LangGraph có thể gọi các services này như **tools**, nhưng concern AI và concern business vẫn tách bạch.  
  * Pre/Post pipelines sử dụng services để ghi kết quả (minutes, action items, logs) vào DB.

---

#### **1.2.3. `llm/` – LangChain / LangGraph / RAG / tools**

Đây là **“AI Layer”** trong backend, gồm:

* `llm/clients/`:  
  * `openai_client.py`, `embedding_client.py`, hoặc wrappers gọi VNPT SmartBot, SmartVoice…  
  * Chuẩn hoá cách gọi LLM/embedding thành interface thống nhất cho LangChain.

* `llm/prompts/`:  
  * `in_meeting_prompts.py`, `pre_meeting_prompts.py`, `post_meeting_prompts.py`.  
  * Chứa prompt templates chuyên biệt cho từng giai đoạn / tác vụ (recap, ADR extractor, MoM…).

* `llm/chains/`:  
  * `in_meeting_chain.py`, `pre_meeting_chain.py`, `post_meeting_chain.py`, `rag_chain.py`.  
  * Dùng **LangChain** để build các **chain/layer**:  
    * Prompt → Model → Parser → Output.  
    * Ví dụ: live recap chain, ADR extractor chain, Q\&A chain, MoM generator.

* `llm/graphs/`:  
  * `state.py`: định nghĩa `MeetingState` cho LangGraph.  
  * `router.py`: graph router chung (Pre / In / Post).  
  * `in_meeting_graph.py`, `pre_meeting_graph.py`, `post_meeting_graph.py`: subgraph cho từng giai đoạn.  
  * Đây là nơi dùng **LangGraph** để “nối dây” các chains/tool thành workflow.

* `llm/agents/`:  
  * `in_meeting_agent.py`, `pre_meeting_agent.py`, `post_meeting_agent.py`.  
  * Có thể bọc graph/chains thành một “agent” dễ gọi từ API hoặc từ nơi khác.

* `llm/tools/`:  
  * `fs_tool.py`, `search_tool.py`, `calendar_tool.py`, `http_tool.py`…  
  * Định nghĩa tools cho agent dùng (VD: create\_task, fetch\_policy, attach\_doc, send\_summary…).

**Nguyên lý:**

* **LangChain** \= dùng để build **“viên gạch”**:  
  * Prompt \+ Model \+ Parser → chain (recap, ADR, QA, summary…).  
* **LangGraph** \= dùng để build **“sơ đồ dây điện”**:  
  * Nối nhiều chain \+ tools lại thành pipeline Pre / In / Post, trạng thái dùng chung.

---

#### **1.2.4. `vectorstore/` – pgvector \+ retrieval (RAG)**

* `pgvector_client.py`: connect tới Postgres với pgvector.  
* `retrieval.py`: tạo retriever, hybrid search (BM25 \+ vector).  
* `ingestion/`: loaders \+ pipelines ingest từ LOffice, SharePoint, wiki…

**Vai trò:**

* Cung cấp **RAG Service**:  
  * Nhận query (kèm `meeting_id`, `user_id`…), truy vấn vector \+ BM25.  
  * Trả về list tài liệu \+ metadata (permissions, citations).

* LangChain chains (RAG) sẽ dùng retriever này để trả lời Q\&A, generate agenda, summary.

---

#### **1.2.5. `websocket/` – WebSocket manager / broadcast**

* `manager.py`: quản lý connection theo `session_id`/`meeting_id`.  
* `events.py`: định nghĩa các message type (recap, adr\_update, qa\_answer…).

**Vai trò:**

* Là tầng glue giữa **In-Meeting graph** và client realtime.  
* Tích luỹ transcript per session (cửa sổ trượt), forward output (recap, actions…) cho các client đang xem.

---

#### **1.2.6. `workers/` – Background tasks**

* `background_tasks.py`, `indexing_worker.py`…

**Vai trò:**

* Chạy các job **batch**:  
  * Ingestion RAG.  
  * Post-Meeting summary \+ highlights.  
  * Indexing transcript.

* Gọi **Post-Meeting graph** theo chế độ batch (SLA \= `batch`, stage \= `post`).

---

### **1.3. Ý tưởng tổng**

* **LangGraph \=** “bộ não orchestrator” cho 3 giai đoạn Pre / In / Post  
* **LangChain \=** building blocks (prompt, chain, tools, retriever)  
* **FastAPI / WebSocket \=** lớp vỏ I/O, convert request ↔ state ↔ response

Dòng chảy tổng quát:

1. Client (Electron/Teams) gửi request (HTTP/WS).  
2. Router FastAPI:  
   * Xác định `meeting_id`, `stage` (`pre`/`in`/`post`), SLA (`realtime`/`batch`)…  
   * Build `MeetingState` ban đầu.

3. Gọi **LangGraph router**:  
   * Router nhìn `stage` → route sang subgraph Pre/In/Post.  
   * Subgraph gọi LangChain chains \+ tools → cập nhật `MeetingState`.

4. FastAPI/WebSocket:  
   * Chuyển `MeetingState` → response JSON, gửi về client hoặc ghi xuống DB.

---

## **2\. Sườn LangGraph chung (Router \+ Subgraph)**

Phần này định nghĩa **“khung xương”** của AI layer:

* Một kiểu state dùng chung: `MeetingState`.  
* Một **router graph** duy nhất chọn subgraph theo stage (`pre` / `in` / `post`).  
* Mỗi subgraph implement logic riêng, nhưng cùng nói chuyện bằng `MeetingState`.

---

### **2.1. MeetingState – state dùng chung cho mọi graph**

**File:** `backend/app/llm/graphs/state.py`

`from typing import List, Optional, Literal, TypedDict`  
`from datetime import datetime`

`class ActionItem(TypedDict):`  
    `task: str`  
    `owner: Optional[str]`  
    `due_date: Optional[str]`  
    `priority: Optional[str]`  
    `source_timecode: Optional[float]`

`class Decision(TypedDict):`  
    `title: str`  
    `rationale: Optional[str]`  
    `impact: Optional[str]`  
    `source_timecode: Optional[float]`

`class Risk(TypedDict):`  
    `desc: str`  
    `severity: Optional[str]`  
    `mitigation: Optional[str]`  
    `owner: Optional[str]`  
    `source_timecode: Optional[float]`

`class MeetingState(TypedDict, total=False):`  
    `# Thông tin context chung`  
    `meeting_id: str`  
    `stage: Literal["pre", "in", "post"]`  
    `sensitivity: Literal["low", "medium", "high"]`  
    `sla: Literal["realtime", "near_realtime", "batch"]`

    `# Transcript & context`  
    `transcript_window: str`  
    `full_transcript: str`  
    `last_user_question: Optional[str]`

    `# Outputs có cấu trúc`  
    `actions: List[ActionItem]`  
    `decisions: List[Decision]`  
    `risks: List[Risk]`

    `# RAG`  
    `rag_docs: list`  
    `citations: list`

    `# Meta`  
    `debug_info: dict`

#### **Nguyên lý thiết kế**

1. **TypedDict**:  
   * Dùng `TypedDict` để:  
     * Có type hints rõ ràng.  
     * LangGraph hiểu schema để validate/merge state.  
   * `total=False` cho phép một số field optional (tuỳ giai đoạn).

2. **Một state chung cho Pre/In/Post:**  
   * Pre-Meeting chủ yếu dùng:  
     * `meeting_id`, `stage="pre"`, `full_transcript` (nếu họp trước), `rag_docs`, `citations`.  
   * In-Meeting:  
     * `stage="in"`, `transcript_window`, `last_user_question`, `actions`, `decisions`, `risks`.  
   * Post-Meeting:  
     * `stage="post"`, `full_transcript`, `actions/decisions/risks` đầy đủ để generate MoM.

3. **Graph node nguyên tắc:**  
   * Mỗi node là hàm:  
      `MeetingState -> MeetingState`.

   * Node **chỉ đọc/ghi** vào state:  
     * Ví dụ: Recap node đọc `transcript_window`, ghi `last_recap` vào `debug_info`.  
     * ADR node đọc `transcript_window`, append vào `actions/decisions/risks`.

4. **Merge state:**  
   * LangGraph tự merge kết quả khi node xong:  
     * Nếu hai node song song viết vào các key khác nhau, state cuối là union.  
     * Nếu ghi vào cùng key, bạn phải quyết định cách merge (append list, override, v.v.).

---

### **2.2. Router graph 3 giai đoạn**

**File:** `backend/app/llm/graphs/router.py`

`from langgraph.graph import StateGraph, END`  
`from .state import MeetingState`  
`from .pre_meeting_graph import build_pre_meeting_subgraph`  
`from .in_meeting_graph import build_in_meeting_subgraph`  
`from .post_meeting_graph import build_post_meeting_subgraph`

`def router_node(state: MeetingState) -> MeetingState:`  
    `stage = state.get("stage", "in")`  
    `state.setdefault("debug_info", {})`  
    `state["debug_info"]["router_stage"] = stage`  
    `return state`

`def build_router_graph():`  
    `workflow = StateGraph(MeetingState)`

    `# 1. Router node`  
    `workflow.add_node("router", router_node)`

    `# 2. Subgraphs`  
    `pre_graph = build_pre_meeting_subgraph()`  
    `in_graph = build_in_meeting_subgraph()`  
    `post_graph = build_post_meeting_subgraph()`

    `# Register như “node con”`  
    `workflow.add_node("pre_meeting", pre_graph)`  
    `workflow.add_node("in_meeting", in_graph)`  
    `workflow.add_node("post_meeting", post_graph)`

    `# Luồng edge`  
    `# Start → router`  
    `workflow.set_entry_point("router")`

    `# Router → subgraph theo stage (dùng conditional edge)`  
    `def route_decider(state: MeetingState):`  
        `stage = state.get("stage")`  
        `if stage == "pre":`  
            `return "pre_meeting"`  
        `elif stage == "in":`  
            `return "in_meeting"`  
        `else:`  
            `return "post_meeting"`

    `workflow.add_conditional_edges(`  
        `"router",`  
        `route_decider,`  
        `{`  
            `"pre_meeting": "pre_meeting",`  
            `"in_meeting": "in_meeting",`  
            `"post_meeting": "post_meeting",`  
        `},`  
    `)`

    `# Sau khi chạy subgraph thì kết thúc`  
    `workflow.add_edge("pre_meeting", END)`  
    `workflow.add_edge("in_meeting", END)`  
    `workflow.add_edge("post_meeting", END)`

    `graph = workflow.compile()`  
    `return graph`

#### **Nguyên lý của router**

1. **router\_node**:  
   * Không gọi LLM, chỉ gắn thêm metadata:  
     * `debug_info["router_stage"] = stage`.  
   * Giúp trace dễ hơn: khi debug bạn biết stage nào đã được chọn.

2. **Subgraphs**:  
   * Mỗi giai đoạn là **một graph con**:  
     * `build_pre_meeting_subgraph()`  
     * `build_in_meeting_subgraph()`  
     * `build_post_meeting_subgraph()`

   * Các subgraph này sẽ:  
     * Có entry node riêng (ví dụ `pre_entry`, `aggregate_transcript`…).  
     * Gọi chains/tool tương ứng.

3. **Conditional edges**:  
   * `add_conditional_edges("router", route_decider, {...})`:  
     * Đọc `state.stage`.  
     * Trả về string key map sang node tương ứng (`"pre_meeting"`, `"in_meeting"`, `"post_meeting"`).  
   * Cho phép **một router graph duy nhất** xử lý cả Pre/In/Post, không cần 3 API tách biệt.

4. **Kết thúc graph**:  
   * Sau mỗi subgraph → edge tới `END`.  
   * `build_router_graph()` trả về `graph` đã compile:  
     * Có thể dùng sync: `graph.invoke(state)` hoặc async: `graph.ainvoke(state)`.

---

### **2.3. Tư duy triển khai theo thứ tự**

Khi bắt tay triển khai trong repo thật, nên đi theo thứ tự:

1. **Bước 1 – Tạo state \+ router skeleton**  
   * Tạo `llm/graphs/state.py` với `MeetingState`.  
   * Tạo `llm/graphs/router.py`:  
     * `router_node`.  
     * `build_router_graph()` gọi `build_pre_meeting_subgraph()` / `build_in_meeting_subgraph()` / `build_post_meeting_subgraph()`.

   * Trong giai đoạn đầu, 3 hàm `build_*_subgraph` có thể chỉ là **stub**:  
     * Một graph đơn node: trả lại state như cũ.

2. **Bước 2 – Kết nối router với FastAPI/WS**  
   * Import `build_router_graph()` vào:  
     * `in_meeting_ws.py` (WS).  
     * `pre_meeting.py`, `post_meeting.py` (REST).  
   * Tại mỗi API:  
     * Build state với `stage` phù hợp:  
       * REST Pre: `stage="pre", sla="near_realtime"/"batch"`.  
       * WS In: `stage="in", sla="realtime"`.  
       * REST Post: `stage="post", sla="batch"`.  
     * Gọi `router_graph.invoke(state)` hoặc `ainvoke`.

3. Lúc này, dù subgraph mới là stub, bạn đã test được **pipeline end-to-end**:  
    request → router → subgraph → response.

4. **Bước 3 – Nâng cấp từng subgraph, bắt đầu từ In-Meeting**  
   * In-Meeting quan trọng nhất cho hackathon:  
      thay stub bằng graph thật:  
     * `aggregate_transcript` → `live_recap` → `adr_extractor` → (optional) `qa_agent`.  
   * Pre/Post thì có thể bổ sung dần:  
     * Pre: Calendar ingest → RAG → Agenda generator.  
     * Post: transcript consolidate → MoM generator → highlights → sync tasks.

---

## **3\. Luồng hoạt động end-to-end (tổng quan)**

### **3.1. Luồng REST (Pre-Meeting, Post-Meeting, RAG)**

Ví dụ: Pre-Meeting generate agenda:

1. Client (Electron/Teams) gọi:  
    `POST /api/v1/pre-meeting/{meeting_id}/prepare`.  
2. Router `pre_meeting.py`:  
   * Lấy thông tin meeting từ DB (service).  
   * Build `MeetingState`:  
     * `meeting_id`, `stage="pre"`, `sla="near_realtime"`, `sensitivity`, v.v.  
   * Gọi:  
      `state_out = await router_graph.ainvoke(state_in)`.

3. Router graph:  
   * `router_node` → đọc `stage="pre"` → route sang `pre_meeting` subgraph.  
   * Pre subgraph:  
     * Calendar ingest, RAG, agenda generator…  
        (gọi LangChain chains).

4. Kết quả:  
   * `state_out` chứa `rag_docs`, `citations`, output agenda summary.  
   * API trả JSON cho client \+ ghi kết quả vào DB.

---

### **3.2. Luồng WebSocket (In-Meeting realtime)**

Ví dụ: In-Meeting live recap \+ ADR:

1. Client (Electron/Teams bot) mở WS:  
    `ws://.../ws/in-meeting/{session_id}`.  
2. Mỗi khi có transcript chunk mới:  
   * Client gửi JSON: `{ "chunk": "text", "question": null }`  
   * Hoặc khi người dùng hỏi: `{ "chunk": "", "question": "deadline API A là khi nào?" }`  
3. WS handler `in_meeting_ws.py`:  
   * Append chunk vào transcript buffer (ở `websocket.manager`).  
   * Build `MeetingState`:  
     * `meeting_id=session_id`  
     * `stage="in"`, `sla="realtime"`  
     * `transcript_window=<cửa sổ 10-30s gần nhất>`  
     * Optional: `last_user_question` nếu có question.  
   * Gọi:  
      `new_state = await router_graph.ainvoke(state)`.

4. Router graph:  
   * `router_node`: stage="in" → route sang `in_meeting` subgraph.  
   * In subgraph:  
     * `aggregate_transcript` (chỉ normalize state).  
     * `live_recap` (gọi chain recap).  
     * `adr_extractor` (gọi chain ADR).  
     * Conditional: `qa_agent` nếu có question.

5. WS handler:  
   * Đọc `new_state`:  
     * Nếu có `last_recap` → gửi `"type": "recap"`.  
     * Nếu `actions/decisions/risks` mới → gửi `"type": "adr_update"`.  
     * Nếu có `last_qa_answer` → gửi `"type": "qa_answer"`.  
   * Client cập nhật UI (LiveBanner, LiveActionsPanel, LiveAiSidebar…).

---

## **4\. Checklist triển khai (tóm tắt để làm việc)**

Bạn có thể dùng phần này làm checklist trong sprint.

### **4.1. Bước 1 – Skeleton graph & router**

* Tạo `llm/graphs/state.py` với `MeetingState`, `ActionItem`, `Decision`, `Risk`.  
* Tạo `llm/graphs/router.py` với:  
  * `router_node(state)`.  
  * `build_router_graph()`:  
    * Thêm node `router`.  
    * Thêm 3 node subgraph stub: `pre_meeting`, `in_meeting`, `post_meeting`.  
    * `add_conditional_edges` theo `stage`.  
    * Edge subgraph → `END`.

### **4.2. Bước 2 – Wiring với FastAPI/WS**

* Import `build_router_graph()` ở `in_meeting_ws.py`.  
* Trong WS handler:  
  * Build `MeetingState` với `stage="in"`.  
  * Gọi `graph.ainvoke(state)`.  
  * Trả state ra WS (tạm thời chỉ debug).  
* Tương tự cho REST pre/post (có thể làm sau).

### **4.3. Bước 3 – Bắt đầu In-Meeting subgraph**

* Tạo `llm/clients/openai_client.py` (hoặc VNPT SmartBot client).  
* Tạo `llm/prompts/in_meeting_prompts.py`.  
* Tạo `llm/chains/in_meeting_chain.py` (live recap \+ ADR \+ QA).  
* Implement `in_meeting_graph.py` với các node:  
  * `aggregate_transcript`  
  * `live_recap`  
  * `adr_extractor`  
  * Optional: `qa_agent`.  
* Kết nối output state với `websocket/manager.py` để gửi events về Electron UI.

# In-meeting Graph

# **MeetMate – In-Meeting AI Layer**

**Nguyên lý kỹ thuật & kiến trúc triển khai (tích hợp VNPT AI)**

---

## **1\. Mục tiêu & phạm vi**

### **1.1. Mục tiêu In-Meeting AI**

Trong giai đoạn **In-Meeting**, hệ thống AI của MeetMate cần:

* Nhận **transcript realtime** (vi/en, có diarization) từ **VNPT SmartVoice**.  
* Sinh **Live Recap** theo thời gian (mỗi vài giây / vài chục giây).  
* **Tự động trích xuất Action / Decision / Risk (ADR)** dưới dạng cấu trúc JSON.  
* Hỗ trợ **Q\&A trong cuộc họp** (Conversational RAG trên tài liệu nội bộ).  
* **Phát hiện intent** trong lời nói:  
  * Giao việc.  
  * Đặt lịch.  
  * Mở tài liệu / tra cứu thông tin.  
     → để gợi ý **tool-calling** (Planner/Jira/LOffice Work/Teams,…).

Đồng thời đảm bảo:

* **Độ trễ thấp**: từ khi người nói → Recap/ADR/Q\&A xuất hiện trong UI trong khoảng **sub-second đến vài giây**, thông qua:  
  * **Tick Scheduler** kiểm soát tần suất gọi LLM.  
  * Giới hạn context và tối ưu RAG.  
* **Bảo mật dữ liệu**:  
  * Không rò rỉ PII ra khỏi tenant/region được phép.  
  * Log đầy đủ, trace được mọi hành động, phục vụ audit & e-discovery.  
* **Dễ mở rộng / reuse**:  
  * Logic In-Meeting tái sử dụng cho:  
    * Pre-Meeting (agenda, pre-read).  
    * Post-Meeting (MoM, highlights, phân tích xu hướng họp).

### **1.2. Phạm vi tài liệu**

Tài liệu này tập trung vào:

* **Nguyên lý & kiến trúc tổng thể In-Meeting AI**.  
* Cách bố trí **router – agent – graph – chain – tools** trong backend `backend/app/llm`.  
* Thiết kế **RAG In-Meeting** theo kiểu **LightRAG-lite**:  
  * Vector search \+ topic graph \+ session graph \+ ưu tiên ngữ cảnh.  
  * Topic segmentation & Q\&A Priority.  
* Cách tích hợp các API **VNPT AI**:  
  * **VNPT SmartVoice**: STT, (optional) summary, TTS.  
  * **VNPT SmartBot**: intent \+ LLM (Recap, ADR, Q\&A).  
  * **VNPT SmartReader**: OCR \+ bóc tách thông tin, cung cấp data cho RAG.  
  * **vnSocial** (optional): tích hợp dạng tool cho một số phiên Q\&A chuyên biệt.

---

## **2\. Kiến trúc logic In-Meeting (tổng thể)**

### **2.1. Các thành phần chính**

#### **2.1.1. Client Layer (Electron desktop \+ Teams add-in)**

**Nhiệm vụ:**

* Stream audio (Teams / phòng họp) tới **Transcription Service**.  
* Mở **WebSocket** tới backend để:  
  * Gửi event:  
    * `type="transcript"`: transcript tick từ STT.  
    * `type="question"`: Ask-AI từ người dùng.  
    * `type="confirm_tool"`: confirm tool-calling (create task, schedule,…).  
  * Nhận event:  
    * `recap`  
    * `adr_update`  
    * `qa_answer`  
    * `tool_suggestion`  
    * `error`.

**Kết quả:**

* Người dùng chỉ thấy UI kiểu:  
  * **Live Notes** (timeline recap).  
  * **Actions / Decisions / Risks**.  
  * **Ask-AI**.  
* Toàn bộ logic LLM, RAG, semantic routing, tool-calling nằm ở backend.

---

#### **2.1.2. Transcription Service (VNPT SmartVoice)**

Gọi **VNPT SmartVoice – Speech to Text (STT)** để nhận transcript:

Output mỗi chunk (ví dụ):

 `{`  
  `"text": "…",`  
  `"speaker": "SPEAKER_01",`  
  `"time_start": 120.5,`  
  `"time_end": 125.8,`  
  `"lang": "vi",`  
  `"is_final": false,`  
  `"confidence": 0.87`  
`}`

* Phân biệt:  
  * **Partial** (`is_final=false`):  
    * Thể hiện nhanh trong UI (subtitle / live transcript).  
    * Không dùng để commit ADR / log chính thức.  
  * **Final** (`is_final=true`):  
    * Dùng để:  
      * Build `full_transcript`.  
      * Chạy Semantic Router, Recap, ADR, Q\&A.  
* **Optional**: định kỳ (30–60 giây) gọi thêm API **tóm tắt đoạn cuộc gọi** của SmartVoice:  
  * Tạo **micro-summary**:  
    * Dùng như input gọn cho Semantic Router (SmartBot intent) và Post-Meeting.  
* Toàn bộ `TranscriptChunk` / `SegmentSummary` được đẩy về backend qua gRPC/HTTP nội bộ.

---

#### **2.1.3. Backend MeetMate (FastAPI \+ WebSocket \+ LangGraph)**

**API / WebSocket:**

* `WS /ws/in-meeting/{session_id}`:  
  * Nhận:  
    * `transcript_event`  
    * `question_event`  
    * `confirm_tool_event`

  * Gửi:  
    * `recap`  
    * `adr_update`  
    * `qa_answer`  
    * `tool_suggestion`  
    * `error`

**AI Layer – `backend/app/llm`:**

* `agents/in_meeting_agent.py`:  
  * Orchestration gần client.  
  * Nhận event từ WS → build **MeetingState** → gọi LangGraph.  
  * Chứa **Tick Scheduler**:  
    * STT tick: chỉ update buffer & state.  
    * LLM tick: mỗi 10–30 giây hoặc mỗi N tokens → mới gọi graph In-Meeting.  
* `graphs/router.py`, `graphs/in_meeting_graph.py`:  
  * **Stage Router**: phân luồng Pre / In / Post.  
  * **In-Meeting Graph**:  
    * Node Semantic Router (SmartBot intent).  
    * Các flow: Normal / Q\&A / Command (Action/Schedule/Risk/Decision).  
    * Tích hợp Topic Segmentation \+ RAG.  
* `chains/in_meeting_chain.py`, `chains/rag_chain.py`:  
  * Recap chain, ADR extraction chain, Q\&A chain.  
  * RAG chain với LightRAG-lite (vector \+ topic/session graph \+ priority).  
* `tools/*.py`:  
  * `smartbot_intent_tool.py` – gọi VNPT SmartBot intent.  
  * `smartbot_llm_tool.py` – SmartBot LLM (Recap/ADR/Q\&A).  
  * `rag_search_tool.py` – nói chuyện với RAG Service.  
  * `calendar_tool.py`, `task_tool.py`, `doc_tool.py`, `vn_social_tool.py`, …

---

#### **2.1.4. Data & RAG**

* **PostgreSQL**:  
  * `Meeting`  
  * `TranscriptChunk`  
  * `ActionItem`, `Decision`, `Risk` (live state).  
  * `AdrHistory` (log mọi sự kiện: thêm/sửa/hủy, override).  
  * `AiEventLog` (log LLM call & router).  
  * `ToolSuggestion`, `ToolExecutionLog`.  
  * `SessionTopic` (topic segmentation cho từng meeting).

* **Vector DB (pgvector)**:

  * Lưu embedding của:  
    * Tài liệu nội bộ đã qua **VNPT SmartReader**.  
    * Có chunking \+ metadata phục vụ RAG.

* **Topic graph & Session graph (LightRAG-lite)**:  
  * Topic graph (offline):  
    * Node: Topic, Document.  
    * Edge: `DOC_BELONGS_TO_TOPIC`, `TOPIC_RELATED_TO_TOPIC`.  
  * Session graph (online cho từng meeting):  
    * Node: MeetingTopic, TranscriptSegment, ADR.  
    * Edge: `SEGMENT_IN_TOPIC`, `ADR_IN_TOPIC`, `TOPIC_NEXT_TOPIC`.

* **vnSocial (optional)**:  
  * Tích hợp dạng tool `vn_social_tool` phục vụ một số truy vấn Q\&A chuyên biệt (không phải core In-Meeting).

---

## **3\. Nguyên lý routing 3 lớp**

### **3.1. Ý tưởng cốt lõi**

Trong cuộc họp, SmartVoice liên tục cung cấp text/micro-summary. MeetMate **không** đẩy thẳng tất cả vào LLM, mà:

1. Lọc qua **Event Router \+ Tick Scheduler** (InMeetingAgent) để:  
   * Tách event từ STT vs Ask-AI vs confirm\_tool.  
   * Hạn chế tần suất gọi LLM.

2. Qua **Stage Router** để tới graph phù hợp:  
   * `stage="in"` → In-Meeting Graph.

3. Trong **In-Meeting Graph**, node đầu tiên là **Semantic Router** (SmartBot intent) để:  
   * Phân loại semantic intent (ASK\_AI, ACTION\_COMMAND, …).  
   * Quyết định flow: Normal / Q\&A / Command.

4.  Dù theo flow nào, tick vẫn kết thúc bằng:  
* **Recap** cập nhật timeline.  
* **ADR update** phản ánh trạng thái live.

### **3.2. Lớp 0 – Stage Router (llm/graphs/router.py)**

* Input: `MeetingState.stage`.  
* Routing:  
  * `"pre"` → `pre_meeting_graph`.  
  * `"in"` → `in_meeting_graph`.  
  * `"post"` → `post_meeting_graph`.

Stage Router chỉ chịu trách nhiệm **chọn graph theo giai đoạn**, không can thiệp logic In-Meeting.

---

### **3.3. Lớp 1 – Event Router \+ Tick Scheduler (agents/in\_meeting\_agent.py)**

**Mapping message → `state.intent`:**

| Message `type` | Nguồn | `state.intent` |
| ----- | ----- | ----- |
| `"transcript"` | SmartVoice STT | `"tick"` |
| `"question"` | User Ask-AI (UI) | `"qa"` |
| `"confirm_tool"` | User confirm action | `"system"` |

**Tick Scheduler:**

* Mỗi khi nhận `type="transcript"`:  
  * Cập nhật:  
    * `vnpt_segment` (final/partial).  
    * `full_transcript` (chỉ khi `is_final=true`).  
    * Buffer để tính số token trong cửa sổ.

  * Kiểm tra:  
    * Nếu `now - last_llm_tick_ts > LLM_INTERVAL` **hoặc**  
    * `buffer_tokens > TOKEN_THRESHOLD`  
       → mới build `MeetingState` và gọi `router_graph.ainvoke(state)`.

* Khi nhận `type="question"`:  
  * Đặt `intent="qa"`, `last_user_question`.  
  * Có thể **force** 1 LLM tick (bỏ qua interval).

* Khi nhận `type="confirm_tool"`:  
  * Không gọi LLM; backend thực thi tool-calling qua REST/SDK.

---

### **3.4. Lớp 2 – Semantic Router (VNPT SmartBot Intent API) (llm/graphs/in\_meeting\_graph.py)**

**Semantic Router là node đầu tiên** trong In-Meeting Graph:

* Input:  
  * `vnpt_segment.text` (ưu tiên final).  
  * Optional: micro-summary từ SmartVoice cho đoạn gần nhất.

* Dùng **VNPT SmartBot intent** để phân loại:  
   Nhãn gợi ý:  
  * `NO_INTENT` – nội dung trao đổi bình thường.  
  * `ASK_AI` – người nói đang hỏi AI / cần giải thích.  
  * `ACTION_COMMAND` – giao việc / phân công nhiệm vụ.  
  * `SCHEDULE_COMMAND` – yêu cầu đặt lịch / follow-up.  
  * `DECISION_STATEMENT` – ra quyết định / chốt phương án.  
  * `RISK_STATEMENT` – nêu rủi ro / cảnh báo.  
  * (Có thể mở rộng: `OPEN_DOC`, `POLL_VOTE`,…).

* Output Semantic Router:  
  * `semantic_intent_label`  
  * `semantic_intent_slots` (owner, task, due\_date, priority, …).  
  * `debug_info["semantic_intent"]`.

* Graph dùng `add_conditional_edges`:  
  * `ASK_AI` → Q\&A flow.  
  * `ACTION_COMMAND` / `SCHEDULE_COMMAND` / `DECISION_STATEMENT` / `RISK_STATEMENT` → Command/ADR flow.  
  * `NO_INTENT` → Normal flow.

Flow nào xong cũng sẽ quay lại Recap \+ ADR update.

Recap \+ ADR thì đều có 2 cái ( thể hiện full lịch sử, và 1 cái tổng quan tracking real-time – nghĩa là xóa những cái trùng, hoặc chỉnh sửa, ghi đè, … )

---

## **4\. MeetingState cho In-Meeting**

`MeetingState` là TypedDict chung cho mọi graph (xem `llm/graphs/state.py`).  
 Các field chính phục vụ In-Meeting:

### **4.1. Context**

* `meeting_id: str`  
* `stage: Literal["pre", "in", "post"]`  
* `intent: Literal["tick", "qa", "system"]` – từ Event Router.  
* `sla: Literal["realtime", "near_realtime", "batch"]`  
* `sensitivity: Literal["low", "medium", "high"]`

### **4.2. VNPT segment & transcript**

* `vnpt_segment: dict`:  
  * `text: str`  
  * `time_start: float`  
  * `time_end: float`  
  * `speaker: str`  
  * `is_final: bool`  
  * `confidence: float`  
* `transcript_window: str` – cửa sổ 10–30s gần nhất (hoặc N câu).  
* `full_transcript: str` – transcript chính thức (chỉ final).

### **4.3. Semantic intent**

* `semantic_intent_label: str`  
* `semantic_intent_slots: dict`

### **4.4. Topic & session graph**

`topic_segments: list` – danh sách topic trong cuộc họp:  
 Mỗi phần tử có thể là:  
 `{`  
    `"topic_id": "T1",`  
    `"title": "…",`  
    `"start_t": 60.0,`  
    `"end_t": 600.0`  
`}`

* `current_topic_id: Optional[str]` – topic hiện tại tại thời điểm tick.

### **4.5. Q\&A**

* `last_user_question: Optional[str]`  
* `last_qa_answer: Optional[str]`  
* `citations: list` – danh sách nguồn (doc\_id, page, snippet, type=meeting/doc).

### **4.6. ADR**

* `actions: List[ActionItem]`  
* `decisions: List[Decision]`  
* `risks: List[Risk]`  
* `new_actions: List[ActionItem]` – ADR mới ở tick hiện tại.  
* `new_decisions: List[Decision]`  
* `new_risks: List[Risk]`

Mỗi ADR item nên có:

* `topic_id`  
* `source_timecode`  
* `source_text`  
* (option) `external_id` (id task ngoài).

### **4.7. RAG**

* `rag_docs: list` – snippets được RAG chọn cho tick hiện tại.

### **4.8. Tool-suggestion & debug**

* `debug_info: dict`:  
  * `router_stage`  
  * `semantic_intent`  
  * `tool_suggestions: list`  
  * `latency_ms_total`, `latency_ms_nodes`  
  * `token_usage_estimate`  
  * `asr_confidence_avg`  
  * `quality_flags` (vd. topic\_drift, low\_confidence,…)

---

## **5\. RAG In-Meeting – Kiểu LightRAG-lite**

### **5.1. Mục tiêu RAG trong In-Meeting**

* Support cho **Q\&A**, và optionally enrich info cho Recap/ADR.  
* Ưu tiên:  
  * Ngữ cảnh của **cuộc họp hiện tại** (transcript \+ ADR \+ topic).  
  * Tài liệu liên quan tới **project / phòng ban / topic**.  
  * Kho tri thức nội bộ chung.  
* Mang tinh thần **LightRAG**:  
  * Vẫn dựa trên vector search,  
  * Nhưng bổ sung **topic graph** và **session graph** để:  
    * Bias context theo topic hiện tại.  
    * Ưu tiên document thuộc chủ đề/mối quan hệ liên quan.

### **5.2. Data ingestion & indexing (offline)**

**Nguồn tài liệu:**

* Policy, quy trình, tài liệu kỹ thuật, biên bản cũ, email PDF, scan, hình ảnh,…

**Pipeline**:

1. **VNPT SmartReader**:  
   * OCR \+ bóc tách layout/field.  
2. **Chunking**:  
   * Mỗi tài liệu → chunk 400–800 tokens, overlap 10–20%.  
3. **Topic assignment (document-level)**:  
   * Gán `topic_id`, `topic_title` bằng LLM/heuristics.  
4. **Entity extraction (optional)**:  
   * Tên sản phẩm, mã quy định, API, hệ thống,…  
5. **Embedding**:  
   * Tính embedding cho mỗi chunk.  
6. **Lưu vào Vector DB** (pgvector) với metadata:  
   * `doc_id`, `chunk_id`, `topic_id`, `project_id`, `unit_id`, `doc_type`,  
   * `effective_date`, `entities`, `sensitivity`, …

**Topic graph offline**:

* Node:  
  * `Topic`, `Document`.  
* Edge:  
  * `DOC_BELONGS_TO_TOPIC`  
  * `TOPIC_RELATED_TO_TOPIC`

### **5.3. Session graph (Meeting graph – online)**

Cho mỗi `meeting_id`, tạo Session graph:

* Node:  
  * `MeetingTopic` (`topic_id`, `title`, `start_t`, `end_t`)  
  * `TranscriptSegment` (time\_range, text)  
  * `ADR` (Action/Decision/Risk)

* Edge:  
  * `SEGMENT_IN_TOPIC`  
  * `ADR_IN_TOPIC`  
  * `TOPIC_NEXT_TOPIC`

Session graph dùng để:

* Biết topic hiện tại (`current_topic_id`).  
* Map câu hỏi hoặc ADR tới topic  
* Khi Q\&A, ưu tiên context cùng topic.

### **5.4. Q\&A Priority – 3 lớp**

Khi Q\&A flow cần RAG, `RagService` sẽ:

1. Xác định **scope**:  
   * `meeting_id`, `project_id`, `unit_id`, `current_topic_id`.  
   * Entities trong question.  
2. Áp dụng 3 lớp priority:  
* **Priority 1 – Meeting context**:  
  * `transcript_window` quanh thời điểm hỏi.  
  * ADR \+ recap thuộc `current_topic_id`.  
  * Tài liệu/doc đã được attach hoặc nhắc tới trong meeting.

* **Priority 2 – Project / Topic docs**:  
  * Vector search trên chunk có:  
    * `project_id = meeting.project_id` **hoặc**  
    * `topic_id` từ topic graph liên quan `current_topic_id`.

* **Priority 3 – Global knowledge**:  
  * Vector search ko filter project, nhưng filter theo:  
    * `doc_type`,  
    * `sensitivity`,  
    * `effective_date`.

3. **Merge & re-rank**:  
   * Mỗi snippet có score tổng hợp từ:  
     * similarity,  
     * bucket priority (1 \> 2 \> 3),  
     * topic match,  
     * entity overlap.

Kết quả trả về `rag_docs` đã sắp xếp để Q\&A chain dùng.

---

## **6\. Các flow chính trong In-Meeting Graph**

Trong `llm/graphs/in_meeting_graph.py`, sau Semantic Router, graph chia ra ba flow chính, nhưng tick nào cũng **kết thúc bằng Recap \+ ADR update**.

### **6.1. Normal Flow – Tick định kỳ**

**Điều kiện:**

* `intent="tick"` và `semantic_intent_label="NO_INTENT"`.

**Pipeline:**

1. `update_transcript_window_node`  
   * Merge `vnpt_segment.text` final vào `full_transcript`.  
   * Cập nhật `transcript_window` (tail N câu).  
   * Cập nhật `current_topic_id` dựa trên `time_end`.

2. `topic_segmenter_node` (chạy theo điều kiện, ví dụ mỗi 2–5 phút):  
   * Input: transcript đoạn gần (2–5 phút).  
   * Output: update `topic_segments`, Session graph.  
   * Gán `topic_id` cho các segment liên quan.

3. `live_recap_node`  
   * Input: `transcript_window`, `current_topic_id`.  
   * Gọi Recap chain (SmartBot LLM profile fast).  
   * Cập nhật recap timeline (không cần RAG).

4. `adr_extractor_node`  
   * Input: `transcript_window`, `current_topic_id`.  
   * Gọi ADR chain (SmartBot LLM).  
   * Trả về `new_actions`, `new_decisions`, `new_risks`.  
   * Backend:  
     * Merge vào `actions/decisions/risks` (override nếu trùng).  
     * Ghi `AdrHistory`.

Output:

* Event `recap` \+ `adr_update` gửi ra WS.

---

### **6.2. Q\&A Flow – Hỏi & trả lời**

**Điều kiện:**

* `semantic_intent_label="ASK_AI"` **hoặc**  
* `intent="qa"` từ UI.

**Pipeline:**

1. `qa_prepare_node`  
   * Lấy `question`:  
     * Từ `last_user_question` (UI), hoặc  
     * Từ `semantic_intent_slots["question"]`.  
   * Chuẩn hóa (cắt bớt noise, thêm context nếu cần).

2. `qa_rag_retrieve_node`  
   * Gọi `RagService` với:  
     * `question`,  
     * `meeting_id`, `current_topic_id`, `project_id`,…  
   * Nhận `rag_docs` với Q\&A Priority \+ LightRAG-lite.

3. `qa_answer_node`  
   * Input:  
     * `question`, `rag_docs`, optionally `transcript_window`/topic summary.  
   * Gọi Q\&A chain (SmartBot LLM).  
   * Cập nhật:  
     * `last_qa_answer`,  
     * `citations`.

4. `live_recap_node` (trên transcript\_window)

5. `adr_extractor_node`

Output:

* Event `qa_answer` \+ `recap`/`adr_update`.

---

### **6.3. Command / ADR Flow – Lệnh & hành động**

**Điều kiện:**

* `semantic_intent_label` ∈ {  
   `ACTION_COMMAND`, `SCHEDULE_COMMAND`, `DECISION_STATEMENT`, `RISK_STATEMENT`  
   }.

**Pipeline:**

1. `command_to_adr_node`  
   * Dùng `semantic_intent_slots` để map thành ADR:  
     * Action: `task`, `owner`, `due_date`, `priority`,…  
     * Decision: `title`, `rationale`, `impact`,…  
     * Risk: `desc`, `severity`, `mitigation`, `owner`,…  
   * Gán `topic_id = current_topic_id`.  
   * Cập nhật `actions/decisions/risks` và `AdrHistory`.

2. `command_rag_enrich_node`  
   * Với Decision/Risk, có thể gọi RAG để:  
     * Gắn thêm `policy_ref`, `doc_id`,…

3. `tool_suggestion_node`  
   * Từ ADR mới → sinh list `tool_suggestions`:  
     * `create_task`, `schedule_meeting`, `open_doc`,…  
   * Gắn:  
     * `suggestion_id`  
     * `action_hash` (phục vụ idempotency)  
     * `payload` chi tiết.  
   * Lưu DB \+ `debug_info["tool_suggestions"]`.

4. `live_recap_node` \+ `adr_extractor_node`  
   * Đảm bảo Recap & ADR được cập nhật nhất quán với lời nói mới.

**Output**:

* Event `tool_suggestion` \+ `recap` \+ `adr_update`.

---

## **7\. Tích hợp VNPT AI theo từng lớp**

### **7.1. VNPT SmartVoice**

* **STT**:  
  * Nguồn transcript chính cho In-Meeting.  
  * Đẩy chunk vào InMeetingAgent → MeetingState.

* **Summary**:  
  * Tóm tắt đoạn hội thoại 30–60 giây.  
  * Có thể dùng:  
    * Là input phụ cho Semantic Router (giảm noise).  
    * Hữu ích cho Post-Meeting.

* **TTS**:  
  * Dùng ở ngoài In-Meeting graph:  
    * Bot đọc nhanh recap cuối buổi.  
    * Nhắc thời lượng, chuyển agenda.

### **7.2. VNPT SmartBot**

* **SmartBot intent**:  
  * Tích hợp qua `tools/smartbot_intent_tool.py`.  
  * Dùng duy nhất trong **Semantic Router**.

* **SmartBot LLM**:  
  * Tích hợp qua `clients/smartbot_client.py` (hoặc `smartbot_llm_tool.py`).  
  * Dùng cho:  
    * Recap chain.  
    * ADR extraction chain.  
    * Q\&A chain.

### **7.3. VNPT SmartReader**

* Chạy ở pipeline ingestion RAG (offline):  
  * OCR \+ bóc tách nội dung tài liệu.  
  * Kết quả đưa vào chunking → embedding → pgvector.

* In-Meeting:  
  * RAG retriever đọc data này phục vụ Q\&A & enrich ADR.

---

## **8\. Bố trí thư mục `/llm` (mapping kiến trúc → code)**

\`\`\`  
`backend/app/llm`  
`├── gemini_client.py              # Có sẵn, có thể giữ / bỏ tùy`  
`├── __init__.py`  
`├── agents`  
`│   ├── base_agent.py`  
`│   ├── in_meeting_agent.py       # Event Router + Tick Scheduler`  
`│   ├── pre_meeting_agent.py`  
`│   ├── post_meeting_agent.py`  
`│   └── __init__.py`  
`├── chains`  
`│   ├── in_meeting_chain.py       # Recap, ADR, Q&A chains`  
`│   ├── rag_chain.py              # Gọi RagService, wrap retriever`  
`│   └── __init__.py`  
`├── clients`  
`│   ├── embedding_client.py`  
`│   ├── openai_client.py          # Có sẵn, fallback`  
`│   ├── smartbot_client.py        # (thêm) wrapper VNPT SmartBot LLM`  
`│   └── __init__.py`  
`├── graphs`  
`│   ├── router.py                 # Stage Router pre/in/post`  
`│   ├── in_meeting_graph.py       # Semantic Router + flows`  
`│   ├── pre_meeting_graph.py`  
`│   ├── post_meeting_graph.py`  
`│   ├── state.py                  # MeetingState, Action/Decision/Risk type`  
`│   └── __init__.py`  
`├── prompts`  
`│   ├── in_meeting_prompts.py     # Prompt Recap, ADR, QA`  
`│   ├── pre_meeting_prompts.py`  
`│   ├── post_meeting_prompts.py`  
`│   └── __init__.py`  
`├── tools`  
`│   ├── smartbot_intent_tool.py   # VNPT SmartBot intent`  
`│   ├── smartbot_llm_tool.py      # (hoặc dùng trong chains)`  
`│   ├── rag_search_tool.py        # Gọi RagService`  
`│   ├── calendar_tool.py`  
`│   ├── task_tool.py`  
`│   ├── doc_tool.py`  
`│   ├── vn_social_tool.py         # optional`  
`│   ├── fs_tool.py`  
`│   ├── http_tool.py`  
`│   ├── search_tool.py`  
`│   └── __init__.py`  
`└── README.md`  
\`\`\`  
---

## **9\. Phi chức năng & bảo mật**

### **9.1. Latency & cost**

* **Tick Scheduler**:  
  * LLM tick ≈ 10–30 giây hoặc mỗi N tokens (config).

* **Giới hạn context**:  
  * `transcript_window` \~ 400–800 tokens.  
  * RAG: top-k nhỏ (vd. 3–8 snippets), đã được re-rank.

* **Timeout per node**:  
  * Recap/ADR: \~500–800ms.  
  * Q\&A: \~2–4s.

### **9.2. Bảo mật**

* **PII & dữ liệu nhạy cảm**:  
  * Nếu gọi LLM ngoài hạ tầng (không on-prem):  
    * Redact PII trước.  
    * Bật zero-retention/no-logging.

* **Audit & trace**:  
  * Mọi call graph/chain/tool đều gắn:  
    * `meeting_id`, `user_id`, `semantic_intent_label`.  
  * Log ToolSuggestion & ToolExecution theo chuẩn audit.

### **9.3. Observability**

* **Metrics log**:  
  * `latency_ms_total`, `latency_ms_nodes`.  
  * `token_usage_estimate`.  
  * `asr_confidence_avg`.  
  * `num_actions/decisions/risks` per meeting.

* **Dashboard**:  
  * SLA Recap (delay).  
  * Tần suất Q\&A.  
  * Số lượng tool suggestions / executions.

---

# Prompt in-meeting

oke đọc kĩ toàn bộ dự án ( đọc kĩ cấu trúc, frontend, database, backend, ... ) đặc biệt ở điều hướng app/meetings/{meeting\_id}/detail mục 2 (Trong họp) . Bây giờ bạn là senior dev chuẩn bị code giúp tôi dựa theo yêu cầu của tôi sau đây. Bây giờ chúng ta sẽ tập trung vào graph in-meeting để nó vận hành ngay tại điều hướng đó luôn. Đọc tài liệu sau để nắm nguyên lý và functions:

**MeetMate – In-Meeting AI Layer**

**Nguyên lý kỹ thuật & kiến trúc triển khai (tích hợp VNPT AI)**

---

## **1\. Mục tiêu & phạm vi**

### **1.1. Mục tiêu In-Meeting AI**

Trong giai đoạn **In-Meeting**, hệ thống AI của MeetMate cần:

* Nhận **transcript realtime** (vi/en, có diarization) từ **VNPT SmartVoice**.  
* Sinh **Live Recap** theo thời gian (mỗi vài giây / vài chục giây).  
* **Tự động trích xuất Action / Decision / Risk (ADR)** dưới dạng cấu trúc JSON.  
* Hỗ trợ **Q\&A trong cuộc họp** (Conversational RAG trên tài liệu nội bộ).  
* **Phát hiện intent** trong lời nói:  
  * Giao việc.  
  * Đặt lịch.  
  * Mở tài liệu / tra cứu thông tin.  
     → để gợi ý **tool-calling** (Planner/Jira/LOffice Work/Teams,…).

Đồng thời đảm bảo:

* **Độ trễ thấp**: từ khi người nói → Recap/ADR/Q\&A xuất hiện trong UI trong khoảng **sub-second đến vài giây**, thông qua:  
  * **Tick Scheduler** kiểm soát tần suất gọi LLM.  
  * Giới hạn context và tối ưu RAG.  
* **Bảo mật dữ liệu**:  
  * Không rò rỉ PII ra khỏi tenant/region được phép.  
  * Log đầy đủ, trace được mọi hành động, phục vụ audit & e-discovery.  
* **Dễ mở rộng / reuse**:  
  * Logic In-Meeting tái sử dụng cho:  
    * Pre-Meeting (agenda, pre-read).  
    * Post-Meeting (MoM, highlights, phân tích xu hướng họp).

### **1.2. Phạm vi tài liệu**

Tài liệu này tập trung vào:

* **Nguyên lý & kiến trúc tổng thể In-Meeting AI**.  
* Cách bố trí **router – agent – graph – chain – tools** trong backend `backend/app/llm`.  
* Thiết kế **RAG In-Meeting** theo kiểu **LightRAG-lite**:  
  * Vector search \+ topic graph \+ session graph \+ ưu tiên ngữ cảnh.  
  * Topic segmentation & Q\&A Priority.  
* Cách tích hợp các API **VNPT AI**:  
  * **VNPT SmartVoice**: STT, (optional) summary, TTS.  
  * **VNPT SmartBot**: intent \+ LLM (Recap, ADR, Q\&A).  
  * **VNPT SmartReader**: OCR \+ bóc tách thông tin, cung cấp data cho RAG.  
  * **vnSocial** (optional): tích hợp dạng tool cho một số phiên Q\&A chuyên biệt.

---

## **2\. Kiến trúc logic In-Meeting (tổng thể)**

### **2.1. Các thành phần chính**

#### **2.1.1. Client Layer (Electron desktop \+ Teams add-in)**

**Nhiệm vụ:**

* Stream audio (Teams / phòng họp) tới **Transcription Service**.  
* Mở **WebSocket** tới backend để:  
  * Gửi event:  
    * `type="transcript"`: transcript tick từ STT.  
    * `type="question"`: Ask-AI từ người dùng.  
    * `type="confirm_tool"`: confirm tool-calling (create task, schedule,…).  
  * Nhận event:  
    * `recap`  
    * `adr_update`  
    * `qa_answer`  
    * `tool_suggestion`  
    * `error`.

**Kết quả:**

* Người dùng chỉ thấy UI kiểu:  
  * **Live Notes** (timeline recap).  
  * **Actions / Decisions / Risks**.  
  * **Ask-AI**.  
* Toàn bộ logic LLM, RAG, semantic routing, tool-calling nằm ở backend.

---

#### **2.1.2. Transcription Service (VNPT SmartVoice)**

Gọi **VNPT SmartVoice – Speech to Text (STT)** để nhận transcript:

Output mỗi chunk (ví dụ):

 `{`  
  `"text": "…",`  
  `"speaker": "SPEAKER_01",`  
  `"time_start": 120.5,`  
  `"time_end": 125.8,`  
  `"lang": "vi",`  
  `"is_final": false,`  
  `"confidence": 0.87`  
`}`

* Phân biệt:  
  * **Partial** (`is_final=false`):  
    * Thể hiện nhanh trong UI (subtitle / live transcript).  
    * Không dùng để commit ADR / log chính thức.  
  * **Final** (`is_final=true`):  
    * Dùng để:  
      * Build `full_transcript`.  
      * Chạy Semantic Router, Recap, ADR, Q\&A.  
* **Optional**: định kỳ (30–60 giây) gọi thêm API **tóm tắt đoạn cuộc gọi** của SmartVoice:  
  * Tạo **micro-summary**:  
    * Dùng như input gọn cho Semantic Router (SmartBot intent) và Post-Meeting.  
* Toàn bộ `TranscriptChunk` / `SegmentSummary` được đẩy về backend qua gRPC/HTTP nội bộ.

---

#### **2.1.3. Backend MeetMate (FastAPI \+ WebSocket \+ LangGraph)**

**API / WebSocket:**

* `WS /ws/in-meeting/{session_id}`:  
  * Nhận:  
    * `transcript_event`  
    * `question_event`  
    * `confirm_tool_event`

  * Gửi:  
    * `recap`  
    * `adr_update`  
    * `qa_answer`  
    * `tool_suggestion`  
    * `error`

**AI Layer – `backend/app/llm`:**

* `agents/in_meeting_agent.py`:  
  * Orchestration gần client.  
  * Nhận event từ WS → build **MeetingState** → gọi LangGraph.  
  * Chứa **Tick Scheduler**:  
    * STT tick: chỉ update buffer & state.  
    * LLM tick: mỗi 10–30 giây hoặc mỗi N tokens → mới gọi graph In-Meeting.  
* `graphs/router.py`, `graphs/in_meeting_graph.py`:  
  * **Stage Router**: phân luồng Pre / In / Post.  
  * **In-Meeting Graph**:  
    * Node Semantic Router (SmartBot intent).  
    * Các flow: Normal / Q\&A / Command (Action/Schedule/Risk/Decision).  
    * Tích hợp Topic Segmentation \+ RAG.  
* `chains/in_meeting_chain.py`, `chains/rag_chain.py`:  
  * Recap chain, ADR extraction chain, Q\&A chain.  
  * RAG chain với LightRAG-lite (vector \+ topic/session graph \+ priority).  
* `tools/*.py`:  
  * `smartbot_intent_tool.py` – gọi VNPT SmartBot intent.  
  * `smartbot_llm_tool.py` – SmartBot LLM (Recap/ADR/Q\&A).  
  * `rag_search_tool.py` – nói chuyện với RAG Service.  
  * `calendar_tool.py`, `task_tool.py`, `doc_tool.py`, `vn_social_tool.py`, …

---

#### **2.1.4. Data & RAG**

* **PostgreSQL**:  
  * `Meeting`  
  * `TranscriptChunk`  
  * `ActionItem`, `Decision`, `Risk` (live state).  
  * `AdrHistory` (log mọi sự kiện: thêm/sửa/hủy, override).  
  * `AiEventLog` (log LLM call & router).  
  * `ToolSuggestion`, `ToolExecutionLog`.  
  * `SessionTopic` (topic segmentation cho từng meeting).

* **Vector DB (pgvector)**:

  * Lưu embedding của:  
    * Tài liệu nội bộ đã qua **VNPT SmartReader**.  
    * Có chunking \+ metadata phục vụ RAG.

* **Topic graph & Session graph (LightRAG-lite)**:  
  * Topic graph (offline):  
    * Node: Topic, Document.  
    * Edge: `DOC_BELONGS_TO_TOPIC`, `TOPIC_RELATED_TO_TOPIC`.  
  * Session graph (online cho từng meeting):  
    * Node: MeetingTopic, TranscriptSegment, ADR.  
    * Edge: `SEGMENT_IN_TOPIC`, `ADR_IN_TOPIC`, `TOPIC_NEXT_TOPIC`.

* **vnSocial (optional)**:  
  * Tích hợp dạng tool `vn_social_tool` phục vụ một số truy vấn Q\&A chuyên biệt (không phải core In-Meeting).

---

## **3\. Nguyên lý routing 3 lớp**

### **3.1. Ý tưởng cốt lõi**

Trong cuộc họp, SmartVoice liên tục cung cấp text/micro-summary. MeetMate **không** đẩy thẳng tất cả vào LLM, mà:

1. Lọc qua **Event Router \+ Tick Scheduler** (InMeetingAgent) để:  
   * Tách event từ STT vs Ask-AI vs confirm\_tool.  
   * Hạn chế tần suất gọi LLM.

2. Qua **Stage Router** để tới graph phù hợp:  
   * `stage="in"` → In-Meeting Graph.

3. Trong **In-Meeting Graph**, node đầu tiên là **Semantic Router** (SmartBot intent) để:  
   * Phân loại semantic intent (ASK\_AI, ACTION\_COMMAND, …).  
   * Quyết định flow: Normal / Q\&A / Command.

4.  Dù theo flow nào, tick vẫn kết thúc bằng:  
* **Recap** cập nhật timeline.  
* **ADR update** phản ánh trạng thái live.

### **3.2. Lớp 0 – Stage Router (llm/graphs/router.py)**

* Input: `MeetingState.stage`.  
* Routing:  
  * `"pre"` → `pre_meeting_graph`.  
  * `"in"` → `in_meeting_graph`.  
  * `"post"` → `post_meeting_graph`.

Stage Router chỉ chịu trách nhiệm **chọn graph theo giai đoạn**, không can thiệp logic In-Meeting.

---

### **3.3. Lớp 1 – Event Router \+ Tick Scheduler (agents/in\_meeting\_agent.py)**

**Mapping message → `state.intent`:**

| Message `type` | Nguồn | `state.intent` |
| ----- | ----- | ----- |
| `"transcript"` | SmartVoice STT | `"tick"` |
| `"question"` | User Ask-AI (UI) | `"qa"` |
| `"confirm_tool"` | User confirm action | `"system"` |

**Tick Scheduler:**

* Mỗi khi nhận `type="transcript"`:  
  * Cập nhật:  
    * `vnpt_segment` (final/partial).  
    * `full_transcript` (chỉ khi `is_final=true`).  
    * Buffer để tính số token trong cửa sổ.

  * Kiểm tra:  
    * Nếu `now - last_llm_tick_ts > LLM_INTERVAL` **hoặc**  
    * `buffer_tokens > TOKEN_THRESHOLD`  
       → mới build `MeetingState` và gọi `router_graph.ainvoke(state)`.

* Khi nhận `type="question"`:  
  * Đặt `intent="qa"`, `last_user_question`.  
  * Có thể **force** 1 LLM tick (bỏ qua interval).

* Khi nhận `type="confirm_tool"`:  
  * Không gọi LLM; backend thực thi tool-calling qua REST/SDK.

---

### **3.4. Lớp 2 – Semantic Router (VNPT SmartBot Intent API) (llm/graphs/in\_meeting\_graph.py)**

**Semantic Router là node đầu tiên** trong In-Meeting Graph:

* Input:  
  * `vnpt_segment.text` (ưu tiên final).  
  * Optional: micro-summary từ SmartVoice cho đoạn gần nhất.

* Dùng **VNPT SmartBot intent** để phân loại:  
   Nhãn gợi ý:  
  * `NO_INTENT` – nội dung trao đổi bình thường.  
  * `ASK_AI` – người nói đang hỏi AI / cần giải thích.  
  * `ACTION_COMMAND` – giao việc / phân công nhiệm vụ.  
  * `SCHEDULE_COMMAND` – yêu cầu đặt lịch / follow-up.  
  * `DECISION_STATEMENT` – ra quyết định / chốt phương án.  
  * `RISK_STATEMENT` – nêu rủi ro / cảnh báo.  
  * (Có thể mở rộng: `OPEN_DOC`, `POLL_VOTE`,…).

* Output Semantic Router:  
  * `semantic_intent_label`  
  * `semantic_intent_slots` (owner, task, due\_date, priority, …).  
  * `debug_info["semantic_intent"]`.

* Graph dùng `add_conditional_edges`:  
  * `ASK_AI` → Q\&A flow.  
  * `ACTION_COMMAND` / `SCHEDULE_COMMAND` / `DECISION_STATEMENT` / `RISK_STATEMENT` → Command/ADR flow.  
  * `NO_INTENT` → Normal flow.

Flow nào xong cũng sẽ quay lại Recap \+ ADR update.

Recap \+ ADR thì đều có 2 cái ( thể hiện full lịch sử, và 1 cái tổng quan tracking real-time – nghĩa là xóa những cái trùng, hoặc chỉnh sửa, ghi đè, … )

---

## **4\. MeetingState cho In-Meeting**

`MeetingState` là TypedDict chung cho mọi graph (xem `llm/graphs/state.py`).  
 Các field chính phục vụ In-Meeting:

### **4.1. Context**

* `meeting_id: str`  
* `stage: Literal["pre", "in", "post"]`  
* `intent: Literal["tick", "qa", "system"]` – từ Event Router.  
* `sla: Literal["realtime", "near_realtime", "batch"]`  
* `sensitivity: Literal["low", "medium", "high"]`

### **4.2. VNPT segment & transcript**

* `vnpt_segment: dict`:  
  * `text: str`  
  * `time_start: float`  
  * `time_end: float`  
  * `speaker: str`  
  * `is_final: bool`  
  * `confidence: float`  
* `transcript_window: str` – cửa sổ 10–30s gần nhất (hoặc N câu).  
* `full_transcript: str` – transcript chính thức (chỉ final).

### **4.3. Semantic intent**

* `semantic_intent_label: str`  
* `semantic_intent_slots: dict`

### **4.4. Topic & session graph**

`topic_segments: list` – danh sách topic trong cuộc họp:  
 Mỗi phần tử có thể là:  
 `{`  
    `"topic_id": "T1",`  
    `"title": "…",`  
    `"start_t": 60.0,`  
    `"end_t": 600.0`  
`}`

* `current_topic_id: Optional[str]` – topic hiện tại tại thời điểm tick.

### **4.5. Q\&A**

* `last_user_question: Optional[str]`  
* `last_qa_answer: Optional[str]`  
* `citations: list` – danh sách nguồn (doc\_id, page, snippet, type=meeting/doc).

### **4.6. ADR**

* `actions: List[ActionItem]`  
* `decisions: List[Decision]`  
* `risks: List[Risk]`  
* `new_actions: List[ActionItem]` – ADR mới ở tick hiện tại.  
* `new_decisions: List[Decision]`  
* `new_risks: List[Risk]`

Mỗi ADR item nên có:

* `topic_id`  
* `source_timecode`  
* `source_text`  
* (option) `external_id` (id task ngoài).

### **4.7. RAG**

* `rag_docs: list` – snippets được RAG chọn cho tick hiện tại.

### **4.8. Tool-suggestion & debug**

* `debug_info: dict`:  
  * `router_stage`  
  * `semantic_intent`  
  * `tool_suggestions: list`  
  * `latency_ms_total`, `latency_ms_nodes`  
  * `token_usage_estimate`  
  * `asr_confidence_avg`  
  * `quality_flags` (vd. topic\_drift, low\_confidence,…)

---

## **5\. RAG In-Meeting – Kiểu LightRAG-lite**

### **5.1. Mục tiêu RAG trong In-Meeting**

* Support cho **Q\&A**, và optionally enrich info cho Recap/ADR.  
* Ưu tiên:  
  * Ngữ cảnh của **cuộc họp hiện tại** (transcript \+ ADR \+ topic).  
  * Tài liệu liên quan tới **project / phòng ban / topic**.  
  * Kho tri thức nội bộ chung.  
* Mang tinh thần **LightRAG**:  
  * Vẫn dựa trên vector search,  
  * Nhưng bổ sung **topic graph** và **session graph** để:  
    * Bias context theo topic hiện tại.  
    * Ưu tiên document thuộc chủ đề/mối quan hệ liên quan.

### **5.2. Data ingestion & indexing (offline)**

**Nguồn tài liệu:**

* Policy, quy trình, tài liệu kỹ thuật, biên bản cũ, email PDF, scan, hình ảnh,…

**Pipeline**:

1. **VNPT SmartReader**:  
   * OCR \+ bóc tách layout/field.  
2. **Chunking**:  
   * Mỗi tài liệu → chunk 400–800 tokens, overlap 10–20%.  
3. **Topic assignment (document-level)**:  
   * Gán `topic_id`, `topic_title` bằng LLM/heuristics.  
4. **Entity extraction (optional)**:  
   * Tên sản phẩm, mã quy định, API, hệ thống,…  
5. **Embedding**:  
   * Tính embedding cho mỗi chunk.  
6. **Lưu vào Vector DB** (pgvector) với metadata:  
   * `doc_id`, `chunk_id`, `topic_id`, `project_id`, `unit_id`, `doc_type`,  
   * `effective_date`, `entities`, `sensitivity`, …

**Topic graph offline**:

* Node:  
  * `Topic`, `Document`.  
* Edge:  
  * `DOC_BELONGS_TO_TOPIC`  
  * `TOPIC_RELATED_TO_TOPIC`

### **5.3. Session graph (Meeting graph – online)**

Cho mỗi `meeting_id`, tạo Session graph:

* Node:  
  * `MeetingTopic` (`topic_id`, `title`, `start_t`, `end_t`)  
  * `TranscriptSegment` (time\_range, text)  
  * `ADR` (Action/Decision/Risk)

* Edge:  
  * `SEGMENT_IN_TOPIC`  
  * `ADR_IN_TOPIC`  
  * `TOPIC_NEXT_TOPIC`

Session graph dùng để:

* Biết topic hiện tại (`current_topic_id`).  
* Map câu hỏi hoặc ADR tới topic  
* Khi Q\&A, ưu tiên context cùng topic.

### **5.4. Q\&A Priority – 3 lớp**

Khi Q\&A flow cần RAG, `RagService` sẽ:

1. Xác định **scope**:  
   * `meeting_id`, `project_id`, `unit_id`, `current_topic_id`.  
   * Entities trong question.  
2. Áp dụng 3 lớp priority:  
* **Priority 1 – Meeting context**:  
  * `transcript_window` quanh thời điểm hỏi.  
  * ADR \+ recap thuộc `current_topic_id`.  
  * Tài liệu/doc đã được attach hoặc nhắc tới trong meeting.

* **Priority 2 – Project / Topic docs**:  
  * Vector search trên chunk có:  
    * `project_id = meeting.project_id` **hoặc**  
    * `topic_id` từ topic graph liên quan `current_topic_id`.

* **Priority 3 – Global knowledge**:  
  * Vector search ko filter project, nhưng filter theo:  
    * `doc_type`,  
    * `sensitivity`,  
    * `effective_date`.

3. **Merge & re-rank**:  
   * Mỗi snippet có score tổng hợp từ:  
     * similarity,  
     * bucket priority (1 \> 2 \> 3),  
     * topic match,  
     * entity overlap.

Kết quả trả về `rag_docs` đã sắp xếp để Q\&A chain dùng.

---

## **6\. Các flow chính trong In-Meeting Graph**

Trong `llm/graphs/in_meeting_graph.py`, sau Semantic Router, graph chia ra ba flow chính, nhưng tick nào cũng **kết thúc bằng Recap \+ ADR update**.

### **6.1. Normal Flow – Tick định kỳ**

**Điều kiện:**

* `intent="tick"` và `semantic_intent_label="NO_INTENT"`.

**Pipeline:**

1. `update_transcript_window_node`  
   * Merge `vnpt_segment.text` final vào `full_transcript`.  
   * Cập nhật `transcript_window` (tail N câu).  
   * Cập nhật `current_topic_id` dựa trên `time_end`.

2. `topic_segmenter_node` (chạy theo điều kiện, ví dụ mỗi 2–5 phút):  
   * Input: transcript đoạn gần (2–5 phút).  
   * Output: update `topic_segments`, Session graph.  
   * Gán `topic_id` cho các segment liên quan.

3. `live_recap_node`  
   * Input: `transcript_window`, `current_topic_id`.  
   * Gọi Recap chain (SmartBot LLM profile fast).  
   * Cập nhật recap timeline (không cần RAG).

4. `adr_extractor_node`  
   * Input: `transcript_window`, `current_topic_id`.  
   * Gọi ADR chain (SmartBot LLM).  
   * Trả về `new_actions`, `new_decisions`, `new_risks`.  
   * Backend:  
     * Merge vào `actions/decisions/risks` (override nếu trùng).  
     * Ghi `AdrHistory`.

Output:

* Event `recap` \+ `adr_update` gửi ra WS.

---

### **6.2. Q\&A Flow – Hỏi & trả lời**

**Điều kiện:**

* `semantic_intent_label="ASK_AI"` **hoặc**  
* `intent="qa"` từ UI.

**Pipeline:**

1. `qa_prepare_node`  
   * Lấy `question`:  
     * Từ `last_user_question` (UI), hoặc  
     * Từ `semantic_intent_slots["question"]`.  
   * Chuẩn hóa (cắt bớt noise, thêm context nếu cần).

2. `qa_rag_retrieve_node`  
   * Gọi `RagService` với:  
     * `question`,  
     * `meeting_id`, `current_topic_id`, `project_id`,…  
   * Nhận `rag_docs` với Q\&A Priority \+ LightRAG-lite.

3. `qa_answer_node`  
   * Input:  
     * `question`, `rag_docs`, optionally `transcript_window`/topic summary.  
   * Gọi Q\&A chain (SmartBot LLM).  
   * Cập nhật:  
     * `last_qa_answer`,  
     * `citations`.

4. `live_recap_node` (trên transcript\_window)

5. `adr_extractor_node`

Output:

* Event `qa_answer` \+ `recap`/`adr_update`.

---

### **6.3. Command / ADR Flow – Lệnh & hành động**

**Điều kiện:**

* `semantic_intent_label` ∈ {  
   `ACTION_COMMAND`, `SCHEDULE_COMMAND`, `DECISION_STATEMENT`, `RISK_STATEMENT`  
   }.

**Pipeline:**

1. `command_to_adr_node`  
   * Dùng `semantic_intent_slots` để map thành ADR:  
     * Action: `task`, `owner`, `due_date`, `priority`,…  
     * Decision: `title`, `rationale`, `impact`,…  
     * Risk: `desc`, `severity`, `mitigation`, `owner`,…  
   * Gán `topic_id = current_topic_id`.  
   * Cập nhật `actions/decisions/risks` và `AdrHistory`.

2. `command_rag_enrich_node`  
   * Với Decision/Risk, có thể gọi RAG để:  
     * Gắn thêm `policy_ref`, `doc_id`,…

3. `tool_suggestion_node`  
   * Từ ADR mới → sinh list `tool_suggestions`:  
     * `create_task`, `schedule_meeting`, `open_doc`,…  
   * Gắn:  
     * `suggestion_id`  
     * `action_hash` (phục vụ idempotency)  
     * `payload` chi tiết.  
   * Lưu DB \+ `debug_info["tool_suggestions"]`.

4. `live_recap_node` \+ `adr_extractor_node`  
   * Đảm bảo Recap & ADR được cập nhật nhất quán với lời nói mới.

**Output**:

* Event `tool_suggestion` \+ `recap` \+ `adr_update`.

---

## **7\. Tích hợp VNPT AI theo từng lớp**

### **7.1. VNPT SmartVoice**

* **STT**:  
  * Nguồn transcript chính cho In-Meeting.  
  * Đẩy chunk vào InMeetingAgent → MeetingState.

* **Summary**:  
  * Tóm tắt đoạn hội thoại 30–60 giây.  
  * Có thể dùng:  
    * Là input phụ cho Semantic Router (giảm noise).  
    * Hữu ích cho Post-Meeting.

* **TTS**:  
  * Dùng ở ngoài In-Meeting graph:  
    * Bot đọc nhanh recap cuối buổi.  
    * Nhắc thời lượng, chuyển agenda.

### **7.2. VNPT SmartBot**

* **SmartBot intent**:  
  * Tích hợp qua `tools/smartbot_intent_tool.py`.  
  * Dùng duy nhất trong **Semantic Router**.

* **SmartBot LLM**:  
  * Tích hợp qua `clients/smartbot_client.py` (hoặc `smartbot_llm_tool.py`).  
  * Dùng cho:  
    * Recap chain.  
    * ADR extraction chain.  
    * Q\&A chain.

### **7.3. VNPT SmartReader**

* Chạy ở pipeline ingestion RAG (offline):  
  * OCR \+ bóc tách nội dung tài liệu.  
  * Kết quả đưa vào chunking → embedding → pgvector.

* In-Meeting:  
  * RAG retriever đọc data này phục vụ Q\&A & enrich ADR.

---

## **8\. Bố trí thư mục `/llm` (mapping kiến trúc → code)**

\`\`\`  
`backend/app/llm`  
`├── gemini_client.py              # Có sẵn, có thể giữ / bỏ tùy`  
`├── __init__.py`  
`├── agents`  
`│   ├── base_agent.py`  
`│   ├── in_meeting_agent.py       # Event Router + Tick Scheduler`  
`│   ├── pre_meeting_agent.py`  
`│   ├── post_meeting_agent.py`  
`│   └── __init__.py`  
`├── chains`  
`│   ├── in_meeting_chain.py       # Recap, ADR, Q&A chains`  
`│   ├── rag_chain.py              # Gọi RagService, wrap retriever`  
`│   └── __init__.py`  
`├── clients`  
`│   ├── embedding_client.py`  
`│   ├── openai_client.py          # Có sẵn, fallback`  
`│   ├── smartbot_client.py        # (thêm) wrapper VNPT SmartBot LLM`  
`│   └── __init__.py`  
`├── graphs`  
`│   ├── router.py                 # Stage Router pre/in/post`  
`│   ├── in_meeting_graph.py       # Semantic Router + flows`  
`│   ├── pre_meeting_graph.py`  
`│   ├── post_meeting_graph.py`  
`│   ├── state.py                  # MeetingState, Action/Decision/Risk type`  
`│   └── __init__.py`  
`├── prompts`  
`│   ├── in_meeting_prompts.py     # Prompt Recap, ADR, QA`  
`│   ├── pre_meeting_prompts.py`  
`│   ├── post_meeting_prompts.py`  
`│   └── __init__.py`  
`├── tools`  
`│   ├── smartbot_intent_tool.py   # VNPT SmartBot intent`  
`│   ├── smartbot_llm_tool.py      # (hoặc dùng trong chains)`  
`│   ├── rag_search_tool.py        # Gọi RagService`  
`│   ├── calendar_tool.py`  
`│   ├── task_tool.py`  
`│   ├── doc_tool.py`  
`│   ├── vn_social_tool.py         # optional`  
`│   ├── fs_tool.py`  
`│   ├── http_tool.py`  
`│   ├── search_tool.py`  
`│   └── __init__.py`  
`└── README.md`  
\`\`\`  
---

## **9\. Phi chức năng & bảo mật**

### **9.1. Latency & cost**

* **Tick Scheduler**:  
  * LLM tick ≈ 10–30 giây hoặc mỗi N tokens (config).

* **Giới hạn context**:  
  * `transcript_window` \~ 400–800 tokens.  
  * RAG: top-k nhỏ (vd. 3–8 snippets), đã được re-rank.

* **Timeout per node**:  
  * Recap/ADR: \~500–800ms.  
  * Q\&A: \~2–4s.

### **9.2. Bảo mật**

* **PII & dữ liệu nhạy cảm**:  
  * Nếu gọi LLM ngoài hạ tầng (không on-prem):  
    * Redact PII trước.  
    * Bật zero-retention/no-logging.

* **Audit & trace**:  
  * Mọi call graph/chain/tool đều gắn:  
    * `meeting_id`, `user_id`, `semantic_intent_label`.  
  * Log ToolSuggestion & ToolExecution theo chuẩn audit.

### **9.3. Observability**

* **Metrics log**:  
  * `latency_ms_total`, `latency_ms_nodes`.  
  * `token_usage_estimate`.  
  * `asr_confidence_avg`.  
  * `num_actions/decisions/risks` per meeting.

* **Dashboard**:  
  * SLA Recap (delay).  
  * Tần suất Q\&A.  
  * Số lượng tool suggestions / executions.

---

Yêu cầu của tôi:

\- Dựa trên tài liệu và nguyên lý tôi gửi, build, code thiết kế kiến trúc ở in-meeting AI layer đến với mọi tầng khác thật chặt chẽ, tích hợp với các backend, database, data entity có sẵn và tạo thêm tương ứng đầy đủ nếu chưa có ( nếu thêm entity, data ha gì nhớ note vào những file doc cho kĩ)  
\- Viết và cập nhật thêm ở /llm file [readme.md](http://readme.md), thêm nguyên một phần in-meeting graph giải thích rõ ràng, chuyên sâu hơn tương ứng với những cái trên  
\- cập nhật prompt tương ứng với các luồng chi tiết khác nhau ( trong tài liệu tổng trên)  
\- xong hết ròi thì viết thêm một CHANGELOG\_4 bỏ vào docs miêu tả tất cả những gì đã thêm, hướng dẫn và future deploy …

Prompt frontend:  
\- Ở app/meetings/{id}/detail ở phần 2.Trong họp. Tôi muốn cái ô Hỏi nhanh AI (Q\&A RAG)  
Biến thành một cái chatbox AI (có nút bấm vào để hiện ra) chỉ ngay phần app/meetings/{id}/detail ở phần 2.Trong họp thôi. Nghĩa là chức năng này chỉ xuất hiện ở in-meeting. Dev frontend component cho tôi tích hợp lên khúc này trên web như tôi yêu cầu trên

\- Ở