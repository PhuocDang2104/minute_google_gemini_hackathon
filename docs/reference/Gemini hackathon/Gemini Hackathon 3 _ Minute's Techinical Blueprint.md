# **MINUTE | Blueprint Sản phẩm & Kiến trúc Technical cho Gemini Hackathon 3**

**Web app – Meetings \+ Workflow/Educational Assistant | Gemini 3 API | RAG-first | Tool-calling có human-in-the-loop**

**Mục đích tài liệu:** Mô tả định hướng sản phẩm, kiến trúc hệ thống, hợp đồng API/WS, mô hình dữ liệu, tiêu chuẩn bảo mật-vận hành và cấu trúc triển khai để hiện thực hoá thành sản phẩm demo có thể mở rộng.

---

## **1\. Tóm tắt nền tảng sản phẩm**

**MINUTE** là trợ lý cho họp trực tuyến và học tập số, triển khai dưới dạng web application, phục vụ nhiều bối cảnh: doanh nghiệp, giáo dục, đào tạo nội bộ, nghiên cứu và nhu cầu cá nhân hoá theo ngành nghề, vai trò và mục tiêu sử dụng.

Sản phẩm hỗ trợ vòng đời một session (**meeting** hoặc **study**) với 2 pha chính: **in-session realtime** và **post-session**.  
**Khác biệt cốt lõi:** MINUTE là **multimodal companion agent** – vừa **nghe** (ASR streaming) vừa **thấy** (hiểu nội dung **video stream / frame theo timestamp**) để hiểu bối cảnh đang diễn ra trong họp/học/record.

Về tri thức, MINUTE không “RAG-first baseline” mà theo **LightRAG đa tầng** nhằm:

* ưu tiên **grounded** khi có tài liệu  
* nhưng vẫn **tự mở rộng tìm hiểu** khi thiếu nguồn (web search \+ reasoning)  
* có **self-reflection/correction loop** và **policy \+ human approval** cho tool-calling để giảm rủi ro

**Inspiration**

* NotebookLM: hỏi–đáp grounded theo tài liệu  
* Code IDE Agent: sidebar agent, hỏi-đáp và tổng hợp nhanh trong phiên  
* Fathom/Otter: transcript và meeting summary tự động  
* Multimodal live companion: hiểu “audio \+ video \+ timeline”

**What it does**

* Recap realtime trong phiên theo mốc thời gian (**audio \+ video context**)  
* Summary sau phiên: key takeaways và notes quan trọng  
* Hỏi-đáp theo ngữ cảnh dựa trên nội dung session/summary và tài liệu tải lên  
* Upload record để xử lý offline tương tự session trực tuyến  
* Cá nhân hóa: phong cách ghi chú, lĩnh vực, mục tiêu học tập/công việc

---

## **2\. Mục tiêu, phạm vi và tiêu chí hoàn thiện**

### **2.1 Mục tiêu**

* **Chuẩn hoá biên bản và giảm ghi chép thủ công**: tự động hoá ghi nhận nội dung, rút ngắn thời gian phát hành minutes/summary  
* **Tăng chất lượng theo dõi session:** ghi nhận nội dung, quyết định và hành động có bằng chứng gắn timecode \+ video moments  
* **Nâng năng lực tra cứu tại chỗ**: hỏi–đáp dựa trên transcript, summary và tài liệu tải lên, đúng phạm vi và quyền truy cập  
* **Đảm bảo kiểm soát vận hành:** policy lưu trữ, retention, xuất dữ liệu và audit trail cho hành vi nhạy cảm

### **2.2 Phạm vi chức năng theo nhóm ưu tiên**

**(1) Session Management (Meetings/Study)**

* Tạo session theo loại; lưu lịch sử session và artifacts (record, transcript, recap, summary)  
* Trang chi tiết session: timeline, transcript, recap windows, Q\&A, tài liệu đính kèm  
* Upload record offline: audio/video, tài liệu tham chiếu

**(2) Personalization & Settings**

* Chọn model theo profile: Gemini (default), Claude, GPT, Llama…  
* Cho phép dùng API key riêng của người dùng  
* Customization: giọng văn, mục tiêu, “more about you” để cá nhân hoá đầu ra

**(3) Knowledge Upload & Tiered Retrieval (LightRAG)**

* Upload tài liệu theo session; lưu metadata và phân loại theo loại session  
* Retrieval theo tầng:  
  * **Tier 0**: session memory (recap/summary/transcript/visual moments)  
  * **Tier 1**: tài liệu upload (hybrid keyword \+ vector \+ filter theo session\_id/ACL)  
  * **Tier 2**: web search (chỉ khi thiếu evidence hoặc user cho phép)  
  * **Tier 3**: deep web research (multi-hop, lập luận cao, có kiểm chứng & trích dẫn)

* Trả lời kèm trích dẫn: doc\_id, section/page hoặc timestamp (và link nguồn web nếu có)

**(4) Realtime In-Session Assistant**

* ASR streaming tạo transcript có timestamp; hỗ trợ partial/final  
* Recap theo nhịp mỗi 2 phút, hiển thị dạng timeline  
* Q\&A trong session: RAG trên tài liệu đã tải lên, trả lời kèm trích dẫn

**(5) Post-Session Summary & Outputs**

* Summary đa phần theo template; có versioning  
* Minutes-grade output cho meeting; learning pack cho study  
* Export (định hướng): DOCX/PDF

---

## **3\. Flow Graph AI (3 tác vụ chính theo task\_type)**

### **3.1 Task Router**

Entry nhận task\_type và định tuyến sang 1 trong 3 pipeline:

* realtime\_recap  
* qna  
* summary\_generate

**Nguyên tắc:**

* Ưu tiên dữ liệu hợp lệ trong session \+ tài liệu upload  
* Nếu thiếu evidence → kích hoạt LightRAG escalation (web search) theo policy  
* Nếu tool-call có rủi ro (web, write action items, export, share) → **đề xuất–phê duyệt–thực thi** (human-in-the-loop)

---

### **3.2 Pipeline: realtime\_recap**

**Mục tiêu:** cập nhật recap timeline trong phiên, theo nhịp mỗi 2 phút

**Flow**

1. Audio Ingest (system \+ mic)  
2. ASR Streaming → Transcript Buffer (partial/final, timestamp)  
3. Video Ingest (screen share / camera / record)  
4. Frame Sampler (ví dụ 1–2 fps hoặc theo event: slide change)  
5. Visual Understanding (Gemini multimodal) → Visual Events (slide title, key chart, code snippet, whiteboard note…)  
6. Window Builder (2 phút) → merge transcript \+ visual events  
7. Recap Generator (Gemini)  
8. Persist Recap Window \+ Timeline Update  
9. Extract: Action/Decision (meeting) hoặc Concept/Formula/Table quan trọng (study)

**Output**

* Recap windows theo mốc thời gian  
* Timeline realtime (audio+video)  
* Highlight video moments (frame \+ caption \+ timestamp)

---

### **3.3 Pipeline: qna  (LightRAG tiered \+ self-reflective)**

**Mục tiêu:** trả lời theo ngữ cảnh session \+ tài liệu upload; khi thiếu nguồn thì **mở rộng websearch có kiểm soát**, kèm trích dẫn.

**Flow**

1. Query Input  
2. Scope & Policy Check (session\_id, type, ACL, web\_allowed)  
3. **Tier 0 Retrieval**: recap/summary/transcript/visual moments (fast path)  
4. **Tier 1 Retrieval**: docs upload (hybrid keyword \+ vector)  
5. Rerank & Context Pack (top-k \+ citations)  
6. Answer Synthesis (Gemini 3\) → trả lời **grounded** nếu evidence đủ  
7. **Self-Check / Coverage Check**  
   * thiếu evidence? mâu thuẫn? confidence thấp? → Escalate  
8. **Tier 2 Web Search (optional, gated)**  
   * Tool-call đề xuất → user approve  
   * tổng hợp nguồn \+ trích dẫn web  
9. **Corrective Loop**: re-answer \+ validate citations (no\_source\_no\_answer cho các claim quan trọng)  
10. Nếu vẫn thiếu → **Tier 3 Deep Research** (multi-hop search \+ reasoning cao, có tóm tắt nguồn & nêu giới hạn)

**Output**

* Trả lời có nguồn trích dẫn, bám scope session  
* Nếu phải dùng web: hiển thị rõ “mở rộng ngoài session” \+ nguồn  
* Nếu vẫn thiếu: trả lời theo dạng “best-effort \+ assumptions \+ phần còn thiếu”

---

### **3.4 Pipeline: summary\_generate**

**Mục tiêu:** tạo summary sau phiên và sinh các outputs theo loại session

**Flow chung**

1. Load all Transcript Final \+ Recap Timeline \+ tham khảo chéo slide hoặc tài liệu nếu có  
2. Long Transcript Consolidation (map-reduce hoặc hierarchical)  
3. Core Summary (key takeaways \+ notes quan trọng)  
4. Branch by Session Type  
5. Generate Outputs  
6. Persist Summary Version \+ Artifacts

#### **3.4.1 Nhánh Meeting**

* Action Items  
* Tài liệu liên quan (related docs theo retrieval trong session)

**Nodes**

* Meeting Action Extractor: owner, task, deadline, status (candidate → confirm)  
* Related Docs Finder: query từ summary → retrieval tài liệu upload → danh sách liên quan có trích dẫn

**Output Meeting**

* Summary \+ Action items \+ Related documents

#### **3.4.2 Nhánh Study**

* Khái niệm học thuật liên quan  
* Ví dụ minh hoạ  
* Quiz (2 lớp)

**Nodes**

* Concept Extractor: khái niệm trọng tâm, định nghĩa ngắn, liên kết về đoạn evidence trong transcript/tài liệu  
* Example Generator: ví dụ theo ngữ cảnh môn học và mục tiêu người dùng  
* Quiz Generator (Layer 1): generate câu hỏi trắc nghiệm với 4 đáp án  
* Quiz Answer Explainer (Layer 2): khi người dùng hỏi đáp án → gọi LLM với query câu hỏi \+ yêu cầu giải thích

**Output Study**

* Summary \+ Concepts \+ Examples \+ Quiz  
* Hỗ trợ “ask for answer” để có đáp án và giải thích theo từng câu

---

## **4\. Kiến trúc tổng thể (MVP)**

### **4.1 Components**

* Client web (Next.js): Session Hub, In-session panel, Q\&A panel, Summary viewer/editor  
* Realtime gateway: WebSocket nhận audio chunks, phát transcript events  
* ASR service: third-party streaming hoặc open-source cho demo  
* RAG service: Postgres \+ pgvector, BM25, ACL filter, reranker nhẹ  
* LLM orchestrator/router: điều phối 3 task\_type, gọi Gemini 3 API và tools  
* Summary service: pipeline summary\_generate, versioning  
* Data layer: Postgres \+ pgvector; object store cho artifacts; audit event store

### **4.2 Data flow (high level)**

* Session created → upload docs/record (tuỳ chọn)  
* In-session: audio → ASR → transcript → realtime\_recap → UI timeline  
* Q\&A: query → retrieval → answer \+ citations  
* Post-session: summary\_generate → core summary → branch outputs (meeting/study) → artifacts

---

## **5\. Security & Compliance (MVP focus)**

* Demo public: dùng dữ liệu giả hoặc scrubbed; không khuyến nghị upload dữ liệu nhạy cảm  
* Định hướng production: TLS/mTLS, Vault cho secrets, RBAC/ABAC, ACL enforcement tại RAG layer, redaction/masking PII trước khi gọi API, retention theo policy, audit trail cho thao tác nhạy cảm

