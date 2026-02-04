# Changelog - 08/12/2025

## 🚀 Tính năng mới

### 📊 Dashboard
- **Export Report**: Nút xuất báo cáo CSV với dữ liệu meetings, tasks, analytics
- **Real-time Stats**: Kết nối với `MeetingService` để hiển thị số liệu thống kê thực
- **Skeleton Loaders**: Hiệu ứng loading khi đang tải dữ liệu

### 📅 Calendar (`/app/calendar`)
- **Multi-view Calendar**: Hỗ trợ 3 chế độ xem:
  - 📆 **Year View**: Xem tổng quan cả năm với các tháng
  - 📅 **Month View**: Xem chi tiết từng tháng với grid ngày
  - 📋 **Week View**: Xem lịch theo tuần với time slots
- **Meeting Sidebar**: Panel bên phải hiển thị các cuộc họp của ngày được chọn
- **Navigation**: Nút điều hướng Previous/Next và nút "Hôm nay"
- **Visual Indicators**: Đánh dấu ngày hôm nay và ngày có cuộc họp

### ✅ Tasks (`/app/tasks`)
- **Filter Modal**: Lọc task theo Status (pending/in_progress/completed) và Priority
- **Add New Task**: Modal tạo task mới với đầy đủ fields (title, description, priority, due date)
- **Toggle Status**: Click checkbox để chuyển đổi trạng thái task
- **CRUD Operations**: Kết nối API create/update/delete action items

### 🔔 Notifications
- **Notification Dropdown**: Panel dropdown trong Topbar kiểu Intercom
- **Unread Badge**: Hiển thị số thông báo chưa đọc
- **Mark as Read**: Click để đánh dấu đã đọc từng thông báo
- **Mark All Read**: Nút đánh dấu tất cả đã đọc
- **LocalStorage Persistence**: Lưu trạng thái đọc vào localStorage

### ⚙️ Settings (`/app/settings`)
- **Save Profile**: Nút "Lưu thay đổi" lưu thông tin profile vào localStorage
- **Toggle Switches**: Các công tắc bật/tắt cho:
  - Email notifications
  - Desktop notifications
  - AI suggestions
  - Auto-summarize
- **Persistent State**: Tất cả settings được lưu và khôi phục từ localStorage

### 📝 Post-Meet Tab (Sau họp)
- **AI Executive Summary**: Tạo biên bản họp tự động với AI
- **Edit Mode**: Chỉnh sửa nội dung biên bản trực tiếp
- **Copy Button**: Copy nội dung biên bản vào clipboard
- **Export PDF**: Xuất biên bản dạng PDF (print-friendly HTML)
- **Improved UI**: Giao diện đẹp hơn với empty state, loading indicator

### 📁 Documents Panel
- **Upload Integration**: Nút "Tải lên" kết nối với API `/api/v1/knowledge/upload`

---

## 🛠️ Cải tiến Backend

### Action Items API
- **New Endpoint**: `GET /api/v1/actions` - Lấy danh sách tất cả action items
- **Filters Support**: Hỗ trợ filter theo status, priority, meeting_id

### In-Meeting Features (by team)
- LightRAG-lite integration
- In-meeting persistence service
- Tool execution API
- WebSocket improvements

---

## 🐛 Bug Fixes

- **UUID Prefix**: Sửa lỗi invalid UUID format trong `knowledge_service.py` (k -> a)
- **Duplicate Function**: Xóa hàm `handleCopySummary` bị duplicate trong PostMeetTab
- **NoneType Error**: Sửa lỗi NoneType trong backend
- **Socket Events**: Sửa lỗi WebSocket events

---

## 🎨 UI/UX Improvements

### Global CSS
- Thêm styles cho Calendar views (year, month, week)
- Thêm styles cho Notification dropdown
- Thêm styles cho PostMeet tab improvements
- Fix overflow issue cho Topbar dropdowns

### Responsive Design
- Calendar sidebar responsive
- Notification dropdown mobile-friendly

---

## 📁 Files Changed

### Frontend (Electron/React)
| File | Changes |
|------|---------|
| `app/routes/Dashboard.tsx` | Export CSV, MeetingService integration |
| `app/routes/Calendar.tsx` | Complete rewrite - Year/Month/Week views |
| `app/routes/Tasks.tsx` | Filter, Add new, Toggle status |
| `app/routes/Settings.tsx` | Save profile, Toggle persistence |
| `app/layout/Topbar.tsx` | Notification dropdown |
| `features/meetings/components/tabs/PostMeetTab.tsx` | AI summary, Edit, Copy, PDF export |
| `features/meetings/components/DocumentsPanel.tsx` | Upload API connection |
| `lib/api/items.ts` | CRUD APIs for action items |
| `styles/global.css` | +500 lines for new features |

### Backend (FastAPI)
| File | Changes |
|------|---------|
| `api/v1/endpoints/action_items.py` | New list all endpoint |
| `schemas/action_item.py` | Updated ActionItemList |
| `services/action_item_service.py` | list_all_action_items function |

---

## 📊 Statistics

- **Total Files Changed**: 12+
- **Lines Added**: ~3,500+
- **Lines Removed**: ~500
- **Commits**: 10+ (merged)

---

## 🔜 Next Steps

- [ ] Test tất cả tính năng mới
- [ ] Kết nối với backend APIs thật (thay vì mock data)
- [ ] Hoàn thiện In-meet features
- [ ] Mobile responsive testing
- [ ] Performance optimization

