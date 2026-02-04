# Official Idea Proposal

# **MINUTE | Idea Proposal**

**Web app – Meetings \+ Workflow/Educational Assistant | Gemini 3 API | Multimodal Companion Agent | LightRAG (tiered) | Tool-calling có human-in-the-loop**

## **1\. Product Summary – Tổng quan**

**MINUTE** là giải pháp **AI Assistant** cho cá nhân và đội nhóm trong môi trường làm việc/học tập trên các nền tảng trực tuyến (từ meeting đến các buổi học online hoặc record offline). Tích hợp **Gemini 3 API** để:

* **Recap realtime** theo mốc thời gian trong phiên  
* **Generate summary \+ notes \+ Action/Quiz** sau khi kết thúc  
* **Hỏi đáp theo ngữ cảnh** dựa trên transcript/summary \+ tài liệu người dùng cung cấp

**Điểm khác biệt (Multimodal Companion Agent):** Không chỉ nghe (ASR) mà còn **“thấy và hiểu” video đang stream** (hoặc frame tại thời điểm tương ứng trong record). MINUTE hoạt động như **agent đồng hành thông minh**: vừa nghe, vừa quan sát slide/màn hình/biểu đồ/đoạn code/bảng viết tay… để hiểu **điều gì đang xảy ra** và đồng hành cùng người dùng trong cuộc họp/buổi học.

### **Inspiration**

* NotebookLM (Q\&A \+ grounded theo tài liệu)  
* Code IDE với agent dạng sidebar (hỏi đáp, tổng hợp và tải tài liệu nhanh)  
* Fathom/Otter (transcript & meeting summary tự động)  
* Multimodal live companion (nghe \+ nhìn theo timeline)

### **What it does**

**Realtime (Trong phiên / live)**

* **ASR realtime → transcript** liên tục  
* **Video understanding song song**: hiểu nội dung hình ảnh theo thời gian (slide đang chiếu, màn hình share, sơ đồ, code, công thức, bảng, biểu cảm/nhấn mạnh của người nói nếu có)  
* **Recap mỗi 2 phút** (gắn timestamp)  
* **Chat Q\&A trực tiếp** dựa trên context **audio \+ video \+ tài liệu upload**

**Post-session (Sau phiên / upload record)**

* Upload video/audio record → tạo **timeline understanding** (transcript \+ sự kiện hình ảnh theo mốc thời gian)  
* **Summary sau phiên**: key takeaways \+ notes quan trọng (grounded)  
* Hỏi đáp theo ngữ cảnh dựa trên: transcript \+ summary \+ video highlight (những đoạn slide/đồ thị/đoạn code quan trọng)

---

## **2\. Function chính ưu tiên – Core Features**

### **2.1 Post (Sau buổi họp/học hoặc upload record)**

Chia làm **2 loại**: **Meetings** và **Study**

* **Generate:** Summary \+ Important notes \+ Timeline highlights (các cut quan trọng theo timestamp, kèm frame/ảnh minh họa nếu có)  
* **Q\&A:** LLM reasoning dựa trên summary \+ transcript \+ video context

### **2.2 In-Meeting (Trong session realtime)**

* **Pipeline:** ASR → transcript realtime  
* **Pipeline song song:** Video stream → frame sampling theo thời gian → visual understanding  
* Recap định kỳ (mỗi 2 phút) dạng “What happened \+ what’s shown”  
* Companion Agent sidebar: hỏi đáp trực tiếp theo đúng thời điểm đang diễn ra và có thể tải tài liệu trực tiếp lên chat để hỏi đáp

---

## **3\. Optional – Tính năng mở rộng (Nice-to-have)**

* **Web search** để gán đúng tài liệu hoặc kiến thức chuyên ngành, academic tương ứng theo query người dùng  
* Có thể tạo kèm ở trong post-meeting tương ứng với từng loại session::  
  * **Meeting:** Action items, tài liệu liên quan  
  * **Study:** Khái niệm học thuật liên quan, ví dụ, quiz  
    * 2 lớp: gọi LLM generate câu hỏi trắc nghiệm với **4 đáp án**  
    * Muốn biết đáp án → gọi LLM lần nữa với **query câu hỏi \+ giải thích**

---

## **4\. Settings – Tùy chỉnh & cá nhân hóa**

* Cho phép chọn model (**Gemini (Default), Claude, GPT, LLama, etc.**)  
* Cho phép sử dụng **API key LLM riêng của người dùng**  
* Cho phép các kiểu customization (giọng văn, *more about you*, …) để inject vào prompt, giúp **cá nhân hóa** tốt hơn

---

## **5\. UX Flow – Luồng trải nghiệm**

* Mới vào web → **landing page** đẹp, chuyên nghiệp → **Start (không login)**  
* Tạo session → **Study / Meetings** → vào thẳng **giao diện post-meeting** (bỏ pre)  
* Có thể:  
  * Tải video record có sẵn, hoặc  
  * Tham gia meeting/buổi học, record trực tiếp để cùng học & làm việc  
* Khi có record (online hoặc upload offline) → generate:  
  * **Summary đầy đủ \+ ADR/note, ví dụ, quiz**  
* Mở tab **hỏi đáp** ngay bên phải để tương tác, hỏi đáp ngay trên ngữ cảnh điều hướng

# Idea Proposal

**Minute | Trợ lý họp và học trực tuyến thông minh cá nhân hóa**  
 **(Desktop app \+ Teams add‑in, RAG \+ LLM \+ Tool‑Calling)**

---

## **1\. Problem Summary – Vấn đề trong họp tại doanh nghiệp lớn và cá nhân** 

* Biên bản và note học tập ghi thủ công, phát hành chậm; sai/thiếu ý chính, **khó tổng hợp action items**.  
* Người họp/học phải vừa lắng nghe vừa ghi chép → **mất tập trung**, bỏ sót quyết định, ý quan trọng  
* **Tài liệu rải rác** (SharePoint/OneDrive, email, wiki) → khó tra nhanh khi đang họp.  
* Sau họp **khó theo dõi công việc**: ai làm gì, deadline khi nào; cập nhật tiến độ rời rạc.

---

## **2\. Solution Overview – Giải pháp tổng quan**

**Minute** là trợ lý AI đa giai đoạn (Pre‑Meeting → In‑Meeting → Post‑Meeting), khả năng tích hợp mọi nền tảng (miễn là trên google web)  
**Mục tiêu:** Chuẩn hóa quy trình họp, nâng cao quá trình học tập, giảm ghi chép thủ công, tăng khả năng theo dõi công việc sau họp.

### **2.1 Pre‑Meeting (chuẩn bị trước họp)**

* Tự đồng bộ lịch từ Outlook/Teams; nhận diện **chủ đề/đối tượng/đơn vị** tham gia.  
* **RAG tìm tài liệu liên quan** (đề án, policy, KPI, quyết định trước) từ LOffice/SharePoint.  
* Gợi ý **agenda** \+ “pre‑read pack”, gửi mail/Teams cho người tham dự.  
* Thu thập input trước họp (note, câu hỏi, rủi ro, yêu cầu demo) để tối ưu thời lượng.

### **2.2 In‑Meeting (trợ lý realtime)**

* **Dùng google web để capture tab screen \+ audio \+ mic người dùng** để ASR  
* **Live recap** theo mốc thời gian; “ask‑AI” ngay trong cuộc họp (tra cứu policy/số liệu qua RAG)  
* **Nhận diện quyết định, action items, risks** theo ngữ cảnh; hiển thị bảng việc ngay panel.  
* **Tool‑calling**: tạo task (Planner/Jira), đặt lịch follow‑up, mở tài liệu liên quan, ghi poll/vote.  
* **Co‑host etiquette**: không làm gián đoạn; chỉ “nói khi được gọi”, ưu tiên hiển thị sidebar.

### **2.3 Post‑Meeting (kết thúc, tổng kết & theo dõi)**

* **Executive summary** (mục tiêu, quyết định, action/owner/deadline, rủi ro, next steps).  
* **Đồng bộ task** về công cụ cá nhân/ doanh nghiệp dùng (Google calender, Microsoft Planner/Jira/TFS).  
* **Video highlights** (trích đoạn keypoints), timeline \+ transcript có tìm kiếm như Fathom.  
* Lưu trữ transcript/summary có **mã hoá, phân quyền, audit trail**; cho phép **Q\&A sau họp**.

---

## **3\. AI Components – Thành phần AI cốt lõi**

### **3.0 Chính sách lựa chọn model & hạ tầng (Router)**

Một **Router ở giữa** nhìn vào (triển khai bằng **LangGraph/LangChain**): giai đoạn, độ nhạy dữ liệu, yêu cầu latency/chi phí → rồi chọn:

* graph nào chạy,  
* model nào dùng (fast/strong, API hay on-prem)  
* tool nào được phép gọi.

| Giai đoạn | Nên dùng gì | Lý do |
| :---- | :---- | :---- |
| **In‑meeting** (realtime) | ASR streaming enterprise (VNPT SmartVoice) VNPT Smartbot nhận diện intent ( trong in-meeting riêng để xử lý real-time) LLM fast (Enterprise API có streaming) LightRAG | Cần độ trễ thấp, kiểm soát mạng; dữ liệu đang nói có thể nhạy cảm → ưu tiên private endpoint/Private Link. |
| **Pre‑meeting** | Enterprise API (LLM mạnh) \+ History-Aware RAG nội bộ | Không yêu cầu realtime; tổng hợp agenda từ tài liệu đã phân quyền. |
| **Post‑meeting** | Enterprise API model lớn ( long‑context) \+ **RAG** (Long-Context Consolidation); chạy batch | Tổng hợp dài, kiểm tra chéo, sinh highlights — ưu tiên độ chính xác |

**Router nguyên tắc:** Một pipeline/agent architecture chung, nhưng **chọn đích suy luận** theo `stage`, `độ nhạy dữ liệu`, `SLA`, `chi phí`. Mặc định: **không gửi PII thô** ra API; nếu bắt buộc → bật **zero‑retention/no‑logging \+ Private Link** và **redaction** trước khi gọi.

# Demo UX

Khi mới vào, thì sẽ hello rồi user mô tả bản thân:  
\- Ngành nghề  
\- Tuổi  
\- Định hướng  
\- Thế mạnh, sở thích

Có thể tạo Projects → Chọn Meeting hoặc Study → sau đó được đưa vào, có thể chọn nút tải record lên hoặc chuyển qua chọn phát trực tiếp.   
Nó sẽ hiện ra cùng với thông tin cá nhân hóa đã chọn của user \+ nội dung, tên input của user mà tự suggest những tài liệu liên quan, hay nhất ở pre-read pack.  
Sau đó → sau khi kết thúc hoặc khi đã tải lên xong:  
\- Generate Transcript full theo timecode  
\- Summary MoM & Summary, các nội dung chính chuyên nghiệp, chính xác theo từng topic, sector và nội dung diễn ra ở khúc đó kèm theo ở cuối hoặc là những chỗ có vẻ cần thì suggest link, kiến thức thêm liên quan → Có thể edit, download và share

# Overall Idea

Minute \- Là một sản phẩm hỗ trợ cá nhân trong các nền tảng trực tuyến (từ meeting cho tới các buổi học online hoặc record offline). Tích hợp gemini pro 3 API thông minh để recap trực tiếp và generate summary của session meetings/studying sau khi kết thúc. Và có thể tùy biến tải được record lên nhằm mục đích hỗ trợ, hỏi đáp, take notes, etc. dựa theo nhu cầu, định hướng và ngành nghề cá nhân người dùng.   
**Function chính ưu tiên:**

* **Post**: Chia làm 2 loại: meetings và study  
  \- Sau kết thúc / Upload record → tạo summary \+ note quan trọng

\- Hỏi đáp: LLM reasoning trên cái summary nó tóm tắt được

* **In-meeting:**  
  \- ASR → transcript realtime → Recap mỗi 2 phút  
  \- Chatbot hỏi đáp trực tiếp

* **Optional:**  
- Web search để gán đúng tài liệu tương ứng query ng dùng  
- Rag dựa trên tài liệu được up lên  
- Tạo được:  
+ Action item  
+ Khái niệm, ví dụ, quiz ( 2 lớp → kêu LLM gen câu hỏi với 4 đáp án → muốn biết đáp án thì hỏi LLM lần nữa với query câu hỏi trên \+ giải thích  
- Setting cho phép chỉnh:  
+ Cho phép chọn model ( Gemini, Claude )  
+ Cho phép sử dụng API key LLM của họ  
+ Cho phép các kiểu customization ( giọng văn, more about you, …) để inject vào prompt cho nó cá nhân hóa hơn

 

**UX Flow:**

- Mới vào web → landing page cho đẹp, chuyên nghiệp → Start (ko login)  
- Tạo session → Study / meetings → vô thẳng giao diện post-meeting (bỏ pre)  
- Chọn được tải video record có sẵn, hoặc tham gia meeting, buổi học, record trực tiếp để cùng học và làm việc  
- Sau khi có được record ( dù là sau online hay tải offline) thì cũng generate ra summary đầy đủ \+ ADR/ note, ví dụ, quiz   
- Mở tab hỏi đáp ngay bên phải như meetmate cũ

**Các yếu tố cần refine:**

- Bỏ login  
- Bỏ giao diện pre  
- Bỏ /projects