# MINUTE — Product Intro Video Script (Gemini Hackathon)

Mục tiêu: **video demo tiếng Anh < 3 phút (target 2:45–2:55)** “đánh thẳng” vào 3 tiêu chí hackathon: **Innovation (multimodal)** · **Technical excellence (LightRAG + router + policy)** · **Real impact (minutes-grade outputs)**.

---

## Hackathon Rules — “Must-pass” checklist (tóm tắt để không bị loại)
**Video requirements**
- ✅ **≤ 3:00** (mục tiêu 2:45–2:55 để có buffer). Nếu >3:00: chỉ 3 phút đầu được chấm.
- ✅ **English voiceover** *hoặc* **English subtitles** (khuyến nghị: **có cả 2**).
- ✅ Chỉ quay **tính năng chạy thật** (Project phải “run consistently” đúng như video mô tả).
- ✅ Quay **fullscreen** / crop để **không lộ URL bar**, tránh vô tình hiện logo/brand/PII.

**Submission hygiene**
- ✅ Tránh lộ **secrets** (API keys, tokens), tránh **PII** (email thật, calendar thật).
- ✅ Tránh hiển thị **logo/brand bên thứ 3** (Jira/Slack/Microsoft/…); dùng dữ liệu demo và tên file trung tính (VD: `Q1-KPI-Deck.pdf`, `PRD.pdf`, source `Upload`).
- ✅ Trong Devpost: có **public demo link** (không paywall), **public code repo**, **~200 words Gemini 3 integration**, **testing instructions**.
- ✅ Dự án phải là **new project trong Contest Period** (nếu bạn reuse code cũ, hãy cân nhắc repo mới cho hackathon).

Copy/paste pack cho Devpost: `docs/reference/Gemini hackathon/Devpost_Submission_Pack.md`

> Gợi ý: tạo một meeting demo riêng + dữ liệu giả. Không dùng tên công ty/ngân hàng thật trong video.

## 0) Big idea (1 câu)
**Minute là “multimodal companion agent”**: vừa **nghe** (ASR realtime) vừa **thấy** (hiểu slide/biểu đồ/code theo timestamp) để tạo **timeline có bằng chứng**, recap realtime, Q&A grounded, và summary sau phiên.

Tagline gợi ý (chọn 1):
- **Hear it. See it. Remember it.**
- **From meeting noise → decisions you can cite.**
- **One timeline for everything said & shown.**

---

## 0.1) Nếu mình là người xem khó tính: đánh giá script V1
### Điểm mạnh
- **Hook + positioning rõ**: “hear + see” + timeline + citations là khác biệt đúng trend.
- **Có showcase end-to-end**: live recap → Q&A → minutes output → approve → (tuỳ) Jira.
- **Pacing hợp lý**: 3 phút, đủ chạm 3 trụ: innovation/tech/impact.

### Điểm trừ (những chỗ judge sẽ “bắt bẻ”)
1) **Chưa “prove” multimodal đủ gắt**: nói “sees slides/charts” nhưng chưa có một khoảnh khắc *không thể fake* (VD: bắt lỗi số liệu giữa lời nói vs slide).
2) **Chưa cụ thể UI/động tác**: thiếu “click cái gì, gõ câu gì, màn hình hiện gì” → quay dễ lạc nhịp, demo dễ fail.
3) **Citations/timecode** đang nói như 1 tính năng chính, nhưng nếu UI demo không show rõ → judge sẽ nghĩ “marketing claim”.
4) **Technical excellence chưa có “proof shot”**: thiếu 1–2 giây show event/metric (VD: `visual_event_count`, `recap_window_ready`, “revision when late data arrives”).
5) **Risk plan thiếu**: live demo hay chết vì audio share / mạng / inference lâu.

### Chấm nhanh (thang 10, góc nhìn “khó tính”)
- Hook (0–5s): **7/10** (ổn nhưng còn “generic”)
- Multimodal differentiation: **6.5/10** (nói đúng, chứng minh chưa đủ)
- Credibility / proof: **6/10** (thiếu 1–2 proof shots)
- Demo feasibility: **7/10** (cần checklist thao tác + plan B)
- “Win factor”: **7.5/10** (nâng proof + cụ thể hoá là lên 9)

---

## 1) Những “WOW moments” phải có (để hơn đối thủ)
1) **Audio-only tools “nghe nhầm số” → Minute “nhìn” slide để đúng số** (đối chiếu chart/slide vs lời nói).
2) **Q&A có citations + evidence**: trả lời kèm **nguồn** (tài liệu upload là “must show”; transcript/visual evidence có thể show bằng overlay/proof shot nếu UI chưa render).
3) **Minutes-grade output**: action items theo owner/deadline + nút **Approve** (human-in-the-loop) + (tuỳ) “Send to Jira (demo)”.
4) **No-source-no-answer**: không có bằng chứng trong session/tài liệu → nói rõ giới hạn, không bịa.

---

## 2) Demo scenario (chuẩn bị để lên hình đẹp)
Mục tiêu demo: **1 phiên họp ngắn 2–3 phút + 1 đoạn record (webm/mp4) 60–90s** để đảm bảo có **transcript + visual events**.

> Tip: quay theo kiểu “*live-look* nhưng thực ra là có backup”. Plan A live, Plan B replay cùng UI y hệt.

### 2.1 Meeting (2–3 phút đủ 1 recap; 5–6 phút cho 2–3 recap windows)
Chuẩn bị 4 slide (Google Slides / PDF / màn hình share):
1) **Agenda** (3 gạch đầu dòng).
2) **Chart**: 1 biểu đồ có **con số rõ** (VD: “Revenue +13% QoQ”).
3) **Decision & Actions**: slide có 3 action items (Owner + deadline).
4) **Architecture**: 1 hình pipeline đơn giản (audio + video + RAG).

Script cho người nói (đọc đúng 3 câu “đinh”):
- “**Decision:** chốt launch ngày **15/03**.”
- “**Action:** Linh update PRD trước **Friday 5PM**.”
- “Trên slide KPI, tăng trưởng là **13%** (nhấn đúng con số).”

### 2.2 Study (2–3 phút)
Chuẩn bị 1 đoạn mini-lecture (màn hình share) có:
- 1 công thức / đoạn code / bảng.
- 1 định nghĩa + 1 ví dụ.

---

## 3) Script V2 (chi tiết để quay “chắc thắng”) — Shotlist + On-screen + VO
Gợi ý nhịp đọc VO: **140–160 wpm**. Text overlay: **3–6 từ**. Mỗi shot 1 thông điệp, 1 hành động.

### 3.1 Chuẩn bị assets (để quay đúng 1 lần)
**A. Meeting setup (trong app)**
- Tạo 1 meeting tên: **“Q1 Launch Sync (Demo)”**.
- Mở `Dock in-meeting` và chuẩn bị share **Chrome Tab** có slide.

**B. Slide nội dung (bắt buộc có chữ to + số to)**
- Slide 1: “Agenda: KPI, Launch, Owners”
- Slide 2: Chart có chữ: **“Growth = 13% QoQ”**
- Slide 3: “Decision: Launch Mar 15” + “Action: Linh PRD by Fri 5PM”
- Slide 4: “Minute Architecture: Hear + See + LightRAG”

**C. Record backup (60–90s)**
- Dùng chính Dock để record 60–90s (webm) và upload lên meeting (để inference chạy ra `visual_event`).

**D. Prompt mẫu để gõ trong AI chat (copy/paste sẵn)**
- “What’s the confirmed launch date and who owns the PRD update? Answer with evidence.”
- “What’s the KPI growth number on the slide? If speech and slide conflict, prefer the slide.”
- “List action items by owner and deadline. No guessing.”

### 3.2 “Proof shots” (2 giây nhưng cực quan trọng)
Chèn 1 trong 2 proof shots để judge không nghi ngờ:
- Proof shot A (UI): minutes output có mục **visual_context** dạng `"[mm:ss | visual] Growth = 13% QoQ"`.
- Proof shot B (API): overlay 1 dòng response từ backend: `visual_event_count: 12` (từ trigger inference).
> Nếu citations/timecode chưa đẹp trong UI: **đừng nói suông**. Hãy overlay 1 chip nhỏ kiểu “Evidence @ 01:12 (Slide OCR)” hoặc “Source: PRD.pdf (Upload)”.

### 3.3 Shotlist FINAL (2:50, English-only, < 3 minutes)
| Time | Shot & Camera | Bạn làm gì trên UI | On-screen text | VO (English) |
|---:|---|---|---|---|
| 0:00–0:03 | **S1 Hook montage** (0.5s/cut) | Cắt nhanh: Dock transcript → Recap & Insights → Post-meet “Tạo biên bản” → Export PDF | “Meetings → Evidence” | “Meetings create decisions… and then we lose the proof.” |
| 0:03–0:10 | **S2 Problem** (b-roll) | Tabs/Docs/Chat lộn xộn + action items trôi | “Notes arrive late” | “Notes arrive late, action items drift, and context gets buried across chat threads and docs.” |
| 0:10–0:14 | **S3 Intro** (logo + meeting list) | Mở Minute, vào meeting “Q1 Launch Sync (Demo)” | “This is MINUTE” | “This is MINUTE — a multimodal companion agent built with the Gemini 3 API.” |
| 0:14–0:28 | **S4 Live capture** (Dock) | Dock: bấm **“Chọn tab + âm thanh”** → tick **“Share tab audio”** → thấy preview + status | “Live capture” | “In a live meeting, Minute captures tab audio and streams a real-time transcript.” |
| 0:28–0:42 | **S5 Transcript → Recap** (tight zoom) | Chuyển sang **Live Transcript**, rồi **Recap & Insights** để thấy recap entry xuất hiện | “Recap & insights” | “It publishes quick recaps and insights—so decisions, risks, and action items don’t get lost.” |
| 0:42–0:55 | **S6 ADR glimpse** | Zoom panel actions/decisions/risks (1–2 giây mỗi panel) | “Decisions. Actions. Risks.” | “As the meeting runs, it surfaces what matters.” |
| 0:55–1:10 | **S7 Proof: it also sees** | Post-meet: upload recording → trigger inference → overlay response `visual_event_count` | “It also sees” | “Now here’s the difference. After you upload the recording, Minute extracts what was shown on screen—slide titles, charts, and on-screen text—tied to timestamps.” |
| 1:10–1:30 | **S8 WOW Q&A (evidence)** | Mở AI chat → hỏi KPI trên slide → show answer có bracket source (VD: `[Visual event ...]`) | “Ask. Get evidence.” | “So when someone says the wrong KPI, you can ask: what number was actually on the slide? Minute answers with evidence—and if it can’t cite, it won’t guess.” |
| 1:30–1:52 | **S9 Generate minutes** | Bấm **“Tạo biên bản”** → show executive summary + action items list | “Minutes‑grade output” | “Then with one click, Minute generates minutes-grade outputs: an executive summary, decisions, risks, and owner-ready action items with deadlines.” |
| 1:52–2:08 | **S10 Review & export** | Review/Approve + Copy + Export PDF (chọn 1–2 thao tác) | “Review → Approve → Share” | “Review, approve, then export to PDF or copy—human-in-the-loop by design.” |
| 2:08–2:28 | **S11 Architecture (1 breath)** | 1 diagram: Router → recap/qna/summary + LightRAG tiers | “LightRAG + Router” | “Under the hood, a task router and tiered LightRAG keep responses grounded: session memory first, uploaded docs next.” |
| 2:28–2:50 | **S12 Close** | Montage timeline + logo + “Built with Gemini” | “Hear. See. Remember.” | “MINUTE turns every meeting into searchable, citeable knowledge. Hear it. See it. Remember it.” |

**Safe cuts (để giảm rủi ro demo):**
- Nếu inference mất thời gian: dùng meeting đã xử lý sẵn (đã có `visual_event_count` và transcript) để quay **S7–S9**.
- Nếu live capture dễ fail: quay **S4–S6** bằng screencast backup nhưng vẫn giữ “live-look” (cursor + status indicators).

### 3.4 Script “lời người nói trong meeting” (để transcript/recap đẹp)
Nói chậm, rõ, 2–3 câu “đinh” (chủ đích để Minute bắt được ADR):
- “**Decision:** We launch on **March 15**.”
- “**Action item:** Linh owns the PRD update—due **Friday 5PM**.”
- “KPI growth on the slide is **13% QoQ**.”
- “**Risk:** Legal review might delay signing.”

### 3.5 Script “câu hỏi trong AI chat” (để ra đúng WOW)
Copy/paste 3 câu theo thứ tự:
1) “What did we decide, and why? Provide evidence.”
2) “List action items with owner and deadline. No guessing.”
3) “What’s the KPI growth number on the slide? If there’s a conflict, prefer the slide.”

### 3.6 Full voiceover script (English, < 3 minutes)
> Dùng bản này để thu VO 1 lần cho chuẩn nhịp. Khi dựng, cắt theo shotlist ở 3.3.

“Meetings create decisions… and then we lose the proof.
Notes arrive late, action items drift, and context gets buried across chat threads and docs.

This is MINUTE — a multimodal companion agent built with the Gemini 3 API.

In a live meeting, Minute captures tab audio, streams a real-time transcript, and publishes quick recaps and insights—so decisions, risks, and action items don’t get lost.

Now here’s the difference. Minute doesn’t just listen.
After you upload the recording, Minute extracts what was shown on screen—slide titles, charts, and on-screen text—and ties it to the same timeline.

So when someone says the wrong KPI, you can ask: what number was actually on the slide?
Minute answers with evidence from the session—and if it can’t cite, it won’t guess.

You can also ask: what did we decide, who owns what, and by when?
Minute answers with citations from your uploaded materials and meeting context, without leaving the timeline.

Then with one click, Minute generates minutes-grade outputs: an executive summary, decisions, risks, and owner-ready action items with deadlines.
Review, approve, then export to PDF or copy—human-in-the-loop by design.

Under the hood, a task router and tiered LightRAG keep responses grounded: session memory first, uploaded docs next.

MINUTE turns every meeting into searchable, citeable knowledge.
Hear it. See it. Remember it.”

### 3.7 Full voiceover script (Vietnamese, optional)
“Họp tạo ra quyết định… nhưng bằng chứng thì lại thất lạc.
Biên bản ra chậm, việc bị trôi, và ngữ cảnh chết trong hàng chục tab và thread chat.

Đây là MINUTE — trợ lý đa phương thức, powered by Gemini.

Trong phiên họp, Minute capture audio tab realtime, stream transcript, và cập nhật recap/insights—để decision, risk, action items không bị trôi.

Và đây là khác biệt thật sự: Minute không chỉ “nghe”.
Sau khi bạn upload recording, Minute trích xuất thứ đã hiển thị trên màn hình—tiêu đề slide, biểu đồ, chữ trên màn hình—và gắn vào cùng timeline.

Vì vậy nếu ai đó nói nhầm KPI, bạn hỏi: con số thật trên slide là bao nhiêu?
Minute trả lời có bằng chứng từ session—không có nguồn thì không bịa.

Bạn cũng có thể hỏi: mình đã chốt gì, ai owner việc nào, deadline khi nào?
Minute trả lời kèm trích nguồn từ tài liệu upload và ngữ cảnh cuộc họp, ngay trên timeline.

Kết thúc phiên, chỉ 1 click là có biên bản chuẩn: executive summary, decisions, risks, action items có owner và deadline.
Bạn review, approve, rồi export PDF/copy/gửi email follow-up—human-in-the-loop ngay từ thiết kế.

Bên dưới là task router và LightRAG đa tầng: ưu tiên grounded, chỉ mở rộng web search khi được phép.

MINUTE biến họp thành tri thức tra cứu được, trích dẫn được.
Hear it. See it. Remember it.”

### 3.8 Overlay text pack (copy/paste cho editor)
- “Meetings → Evidence”
- “Live transcript”
- “Recap & insights”
- “Grounded to the slide”
- “Ask. Get evidence.”
- “Minutes‑grade output”
- “Visual evidence included”
- “Human‑in‑the‑loop”
- “LightRAG + Router”
- “Hear. See. Remember.”

---

## 4) Checklist quay + dựng (để “peak”)
- **Quay UI**: 1440p, cursor lớn, zoom-in theo click; che thông tin nhạy cảm.
- **Caption**: luôn bật subtitle (EN) để judge xem không cần audio.
- **Kinetic text**: mỗi cảnh 1 message, 3–6 từ; giữ typography đồng nhất.
- **1 diagram duy nhất** ở ~2:08–2:28 (đừng sa đà kỹ thuật).
- **Nhạc**: nhịp 120–140 BPM, drop nhẹ ở cảnh “WOW: grounded to the slide”.
- **Plan B**: luôn có 1 đoạn screencast backup (đã có transcript + minutes) để thay thế nếu live capture lỗi.

---

## 5) Cutdown 60s (nếu hackathon yêu cầu ngắn)
0:00 hook montage → 0:07 problem → 0:12 “Minute = hear + see” → 0:20 recap/insights → 0:30 WOW (slide OCR evidence) → 0:40 minutes output → 0:52 proof shot → 0:60 close.
