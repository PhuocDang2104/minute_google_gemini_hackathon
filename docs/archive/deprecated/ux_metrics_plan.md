# UX Metrics & Continuous Optimization Plan (MeetMate)

## 1. Mục tiêu
- Đo lường và tối ưu trải nghiệm sử dụng MeetMate (chuẩn bị, trong họp, sau họp).
- Xác định sớm điểm nghẽn, ưu tiên cải tiến dựa trên dữ liệu.

## 2. Bộ chỉ số cốt lõi
- **Task Success**: tỷ lệ hoàn thành tác vụ chính (tạo cuộc họp, tham gia, tải tài liệu, tạo biên bản).
- **Time on Task**: thời gian hoàn thành các flow chính (tạo cuộc họp, join, tạo MoM).
- **Error Rate / Task Failure**: số lỗi UI/API, form validation fail, WS disconnect.
- **Adoption & Engagement**: DAU/WAU, số cuộc họp tạo/ngày, số biên bản tạo/ngày, % người dùng dùng tính năng AI (MoM, agenda AI).
- **Retention**: D1/D7/D30 retention; cohort by team.
- **Conversion Funnel**: đăng ký → tạo họp đầu tiên → tạo biên bản đầu tiên → phân phối biên bản (tỷ lệ rớt ở từng bước).
- **Performance**: TTFB, FCP/LCP, latency API chính (meetings, minutes, transcripts), thời gian render dashboard.
- **Reliability**: uptime, WS reconnect count, audio ingest success %, biên bản tạo thành công %.
- **Support/Feedback**: CSAT sau hành động (gửi biên bản, tham gia họp), số ticket/1000 người dùng.
- **AI Quality**: % biên bản bị chỉnh sửa nhiều (delta >30%), % action/decision AI trích đúng qua audit mẫu, complaint rate.
- **Security/Trust**: 2FA adoption (nếu có), tỷ lệ login thất bại bất thường.

## 3. Phương pháp đo
- **Instrumentation**: log sự kiện FE (page view, click, submit, success/fail) kèm `user_id`, `session_id`, `meeting_id`.
- **Server metrics**: API latency, lỗi 4xx/5xx theo endpoint; WS connect/disconnect; job queue (minutes generation) success/fail.
- **A/B testing**: bật/tắt AI gợi ý, layout nút hành động, copy CTA.
- **Survey in-product**: mini CSAT/NPS sau các điểm chạm (gửi biên bản, kết thúc họp).
- **Sampling audit**: review thủ công 5–10% biên bản AI/tuần.

## 4. Lộ trình tối ưu
- **T-0 (trước launch)**: hoàn thiện instrumentation FE/BE; dashboard tối thiểu (funnel, latency, error); ngưỡng cảnh báo.
- **Alpha/Beta (tháng 1–2)**:
  - Mục tiêu: Time on Task giảm 20%, Task Success >85%.
  - Ưu tiên: sửa lỗi form, tối ưu hành trình tạo/đăng ký/thu thập transcript; đảm bảo minutes generation ổn định.
  - Chạy A/B copy và bố cục nút hành động.
- **GA (tháng 3–4)**:
  - Thêm CSAT/NPS in-app; theo dõi adoption tính năng AI.
  - Tối ưu performance (FCP/LCP, API latency <500ms cho endpoints chính).
  - Giảm error rate xuống <1% cho flow chính.
- **Ongoing (hàng tháng)**:
  - Review dashboard + ticket + feedback.
  - Chọn 1–2 cải tiến UX/chu kỳ (copy, layout, auto-fill).
  - Audit AI quality; điều chỉnh prompt/model hoặc fallback.
  - Theo dõi retention/cohort và hành vi drop-off trong funnel.

## 5. Hướng triển khai cụ thể
- **Theo dõi và cảnh báo**:
  - Dùng một pipeline log (ví dụ PostHog/Segment) cho sự kiện FE; Prometheus/Grafana (hoặc APM) cho BE.
  - Alert khi: error rate >2% trong 5 phút; latency API >800ms p95; WS disconnect spike; minutes generation fail >5%.
- **Dashboard**:
  - Funnel đăng ký → tạo họp → tạo biên bản → phân phối biên bản.
  - Latency/API errors per endpoint; WS health.
  - Adoption AI: % họp có minutes AI, % action/decision AI được dùng.
- **Thử nghiệm/A/B**:
  - Biến thể: vị trí/nội dung CTA “AI tạo biên bản”, “Tham gia”, “Tải tài liệu”.
  - Thời gian: 1–2 tuần, mục tiêu tăng CTR/Task Success, giảm Time on Task.
- **Quy trình cải tiến liên tục**:
  - Họp ngắn hàng tuần: xem error/latency, top ticket, top drop-off.
  - Sprint hàng tháng: chọn 1–2 UX fix + 1 tối ưu hiệu năng.
  - Audit AI nội dung: lấy mẫu biên bản, chấm chất lượng, cập nhật prompt/ràng buộc nếu cần.

## 6. Checklist vận hành
- [ ] FE gửi đủ event cho các hành trình chính; có event success/fail.
- [ ] BE log lỗi/latency, có alert.
- [ ] Dashboard funnel + performance sẵn sàng.
- [ ] CSAT/NPS inline ở các điểm chạm chính.
- [ ] A/B framework khả dụng (feature flag).
- [ ] Lịch review metrics hàng tuần/tháng.
