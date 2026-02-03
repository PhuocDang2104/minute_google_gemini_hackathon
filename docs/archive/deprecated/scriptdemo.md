1. Bối cảnh chung của In-meeting demo

Màn hình demo: Tab “Live Meeting” trong web app MeetMate.

Meeting đã có meeting_id (lấy sẵn từ Teams / calendar).

Vì chưa có streaming STT VNPT nên:

Phần “audio → transcript” được giả lập bằng cách paste raw transcript vào một ô nhập (textarea).

Khi bấm “Process transcript”:

Gọi pipeline RAG LLM Graph.

Gọi API VNPT SmartBot (mock) để phân loại intent.

Mục tiêu demo:

Thấy được live-recap box bên phải tự cập nhật khi feed transcript.

Thấy được topic detect, tóm tắt, và chuyển topic khi đổi chủ đề.

Thấy được semantic intent: NO_INTENT, ASK_AI, ACTION_COMMAND.

Thấy được Ask-AI Q&A box hoạt động.

Thấy được bảng Actions sinh ra action item từ đoạn hội thoại.

2. Flow demo tổng quát (góc nhìn người trình bày)
Bước 0 – Mở màn In-meeting

Chuyển qua tab “Live Meeting”.

Giải thích nhanh:

App đã gắn với một meeting_id tương ứng cuộc họp trên Teams.

Optional UI: bấm vào nút Teams → mock giao diện “thu nhỏ app sang bên phải” giống side-panel trong Teams (chỉ cần đổi layout CSS và hiển thị khung Teams giả lập bên trái, app bên phải).

Nói rõ hạn chế:

“Do tụi em chưa được cung cấp API streaming audio STT của VNPT nên phần demo này tụi em mock transcript bằng cách paste text vào. Ở production, đoạn transcript này sẽ được lấy trực tiếp từ API STT của bên VNPT.”

Chỉ vào ô “Raw transcript input”:

“Tụi em sẽ feed 3 đoạn hội thoại khác nhau tương ứng với 3 intent: NO_INTENT, ASK_AI, ACTION_COMMAND.”

Từ đây bắt đầu 3 example, mỗi example = 1 round nhập transcript → hệ thống cập nhật Recap/Topic/Intent/Actions/Q&A.

3. Example 1 – NO_INTENT (Status update bình thường)
3.1. Thao tác demo trên UI

Presenter paste đoạn transcript Example 1 vào ô “Raw transcript”:

[00:40] SPEAKER_01: Em cập nhật nhanh phần Mobile Banking Sprint 23 nhé. Hiện tại tổng tiến độ khoảng bảy mươi phần trăm, các user story chính đều đã lên UAT.

[00:48] SPEAKER_02: Bug production tuần rồi thì sao, đã xử lý xong cái vụ lỗi timeout màn hình chuyển khoản chưa?

[00:55] SPEAKER_01: Dạ, lỗi timeout đã fix và deploy hotfix từ tối qua, hiện chưa ghi nhận thêm phản ánh mới trên kênh call center.

[01:03] SPEAKER_03: Ok, vậy sprint này rủi ro lớn nhất chủ yếu là performance test cuối cùng, mình vẫn target kịp cut-off thứ Sáu tuần sau.

Bấm nút “Process transcript”.

3.2. Pipeline xử lý (để bạn mock data)

Backend nhận được payload:

meeting_id

raw_transcript (4 câu như trên)

Chạy VNPT SmartBot (mock) → semantic intent:

semantic_intent_label = "NO_INTENT"

Chạy LLM RAG Graph:

Detect topic: "Mobile Banking Sprint 23 – Status & Risks".

Generate recap theo từng đoạn thời gian.

3.3. Output hiển thị (cần mock)

Ô “Intent / Semantic Router”:

Hiển thị: Intent: NO_INTENT.

Ô “Topic hiện tại”:

Topic: Mobile Banking Sprint 23 – Status & Risks.

Box “Live Recap” bên phải hiển thị:

00:40 – Status
Sprint 23 Mobile Banking hoàn thành khoảng 70%, các user story chính đã lên UAT, bug timeout chuyển khoản đã được hotfix và không còn phản ánh mới.

01:03 – Risk
Rủi ro chính còn lại là performance test cuối, nhưng cả team vẫn target kịp cut-off thứ Sáu tuần sau.

Dữ liệu mock tương ứng trong state:

current_topic_id = "T_MOBILE_SPRINT_23_STATUS"

current_recaps = [ {timecode: 40, type: "status", ...}, {timecode: 63, type: "risk", ...} ]

Người demo giải thích: “Với các đoạn hội thoại chỉ cập nhật tiến độ, hệ thống gắn label NO_INTENT, vẫn tóm tắt và gom thành 1 topic rõ ràng, dùng cho recap và minutes sau này.”

4. Example 2 – ASK_AI (Q&A với trợ lý AI)
4.1. Thao tác demo trên UI

Người demo bấm nút “Clear / New segment” (nếu có), hoặc chọn “Segment 2”.

Paste đoạn transcript Example 2:

[00:30] SPEAKER_01: Sang phần security cho Mobile Banking phiên bản mới nhé, đặc biệt là giới hạn đăng nhập sai.

[00:36] SPEAKER_02: Lần trước audit có hỏi khá kỹ chỗ này, mình phải bám đúng policy nội bộ.

[00:42] SPEAKER_03: MeetMate ơi, cho anh hỏi theo quy định hiện tại của LPBank thì khi khách nhập sai OTP năm lần liên tiếp trên app mobile, tài khoản sẽ bị khoá trong bao lâu?

[00:52] SPEAKER_01: Câu này để trợ lý AI trả lời cho chắc, nó có đọc policy rồi.

Bấm “Process transcript”.

4.2. Pipeline xử lý

Gọi VNPT SmartBot (mock) để detect intent:

semantic_intent_label = "ASK_AI"

semantic_intent_slots["question"] = "Theo quy định hiện tại của LPBank thì khi khách nhập sai OTP 5 lần liên tiếp trên app mobile, tài khoản sẽ bị khoá trong bao lâu?"

LLM RAG:

Detect topic: "Mobile Security – OTP Lockout Policy".

Search RAG trên kho policy nội bộ → trả lời.

Sinh citations = [doc_id_1, doc_id_2] (mock 1 doc là đủ).

4.3. Output hiển thị

Ô “Intent / Semantic Router”:

Intent: ASK_AI

Slot question hiển thị cho debug:

"Question: Theo quy định hiện tại của LPBank thì khi khách nhập sai OTP 5 lần liên tiếp trên app mobile, tài khoản sẽ bị khoá trong bao lâu?".

Ô “Topic hiện tại”:

Topic: Mobile Security – OTP Lockout Policy.

Box “Ask-AI / Q&A” hiển thị:

MeetMate – Trả lời:
Theo policy bảo mật hiện hành của LPBank, khi khách hàng nhập sai OTP 5 lần liên tiếp trên Mobile Banking, tài khoản đăng nhập sẽ bị khóa tạm thời trong 15 phút trước khi cho phép thử lại.

Lưu ý:
Khoảng thời gian khóa có thể cấu hình, nhưng mặc định là 15 phút.
Thao tác reset sớm hơn phải đi qua kênh call center hoặc quầy giao dịch.

Trích dẫn: Tài liệu “Policy bảo mật kênh số – phiên bản 2.3”, mục 4.2.1.

Box “Live Recap” vẫn cập nhật nhẹ:

“Nhóm đang thảo luận về security cho Mobile Banking; người dùng hỏi MeetMate về chính sách khoá tài khoản khi nhập sai OTP 5 lần, AI trả lời dựa trên policy nội bộ.”

Mock state:

qa_list append thêm một mục:

qa_id, question, answer, topic_id, citations = ["DOC_POLICY_2_3"].

Người demo nhấn mạnh: “Điểm khác biệt ở đây là intent = ASK_AI, nên đoạn hội thoại này đi vào nhánh Q&A, vừa trả lời trực tiếp, vừa lưu thành knowledge để truy xuất về sau.”

5. Example 3 – ACTION_COMMAND (Sinh Action Item)
5.1. Thao tác demo trên UI

Chọn “New segment” hoặc “Segment 3”.

Paste Example 3:

[00:20] SPEAKER_01: Giờ mình chốt vài đầu việc cho Sprint 23 Mobile nhé.

[00:24] SPEAKER_02: Ui detail màn hình lịch sử giao dịch mới hôm qua BA vừa update xong rồi đó.

[00:29] SPEAKER_01: An ơi, em nhận giúp anh task cập nhật màn hình lịch sử giao dịch theo thiết kế mới, nhớ thêm filter theo loại giao dịch và hoàn thành trước thứ Hai tuần sau nhé.

[00:39] SPEAKER_03: Với lại nhớ log lại performance query cho màn hình đó, để QA dễ theo dõi.

Bấm “Process transcript”.

5.2. Pipeline xử lý

VNPT SmartBot (mock) detect:

semantic_intent_label = "ACTION_COMMAND"

LLM Action Extractor:

Gom thông tin:

Task content: “Cập nhật màn hình lịch sử giao dịch theo thiết kế mới, thêm filter theo loại giao dịch và log performance query.”

Owner: “An”.

Due date: parse “trước thứ Hai tuần sau” → “2025-12-15” (mock sẵn).

Priority: “medium”.

Source timecode: 29.0.

Gán topic: "T_MOBILE_TXN_HISTORY".

5.3. Output hiển thị

Ô “Intent / Semantic Router”:

Intent: ACTION_COMMAND.

Box “Actions” hiển thị một dòng mới (và cho debug JSON nếu cần):

{
  "id": "A-MB-001",
  "topic_id": "T_MOBILE_TXN_HISTORY",
  "task": "Cập nhật màn hình lịch sử giao dịch theo thiết kế mới, thêm filter theo loại giao dịch và log performance query.",
  "owner": "An",
  "due_date": "2025-12-15",
  "priority": "medium",
  "status": "open",
  "source_timecode": 29.0,
  "source_text": "An ơi, em nhận giúp anh task cập nhật màn hình lịch sử giao dịch theo thiết kế mới, nhớ thêm filter theo loại giao dịch và hoàn thành trước thứ Hai tuần sau nhé."
}


Cho phép host click vào checkbox “Approve”:

Khi tick:

status đổi từ "open" sang "approved" (hoặc "confirmed").

Action xuất hiện trong bảng “Approved Actions / Decisions” (hoặc “Decision log”) với PIC = An.

Mock state cần có:

new_actions list (chứa A-MB-001).

approved_actions list khi user click approve.

Người demo nhấn mạnh: “Đây là chỗ MeetMate tự phát hiện câu giao việc rõ ràng, convert thành action item, sau đó host chỉ cần bấm approve là xong – không phải gõ lại.”

6. Tóm tắt các state / mock data tối thiểu cho In-meeting demo

Để chạy mượt cả 3 example, bạn chỉ cần chuẩn bị:

meeting_id = "MOBILE_SPRINT_23_DEMO".

topic_list:

"T_MOBILE_SPRINT_23_STATUS"

"T_MOBILE_SECURITY_OTP"

"T_MOBILE_TXN_HISTORY"

recap_list cho Example 1.

qa_list cho Example 2 (kèm citations).

actions_list cho Example 3.

current_intent và current_topic thay đổi theo từng lần bấm “Process transcript”.

Toàn bộ logic “RAG LLM Graph / VNPT SmartBot / Semantic Router” có thể mock bằng cách:

FE gửi payload → BE trả về luôn các object như trên.

Hoặc FE gọi trực tiếp file JSON tĩnh cho từng example.