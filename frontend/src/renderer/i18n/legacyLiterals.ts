import type { Language } from './index'

type Pair = { vi: string; en: string }

const LEGACY_LITERAL_PAIRS: Pair[] = [
  { vi: 'Tạo mới', en: 'Create' },
  { vi: 'Dự án mới', en: 'New project' },
  { vi: 'Phiên mới', en: 'New session' },
  { vi: 'Tạo phiên làm việc mới', en: 'Create new working session' },
  { vi: 'Tạo dự án mới', en: 'Create new project' },
  { vi: 'Tên dự án', en: 'Project name' },
  { vi: 'Tên dự án *', en: 'Project name *' },
  { vi: 'Mã dự án', en: 'Project code' },
  { vi: 'Mô tả', en: 'Description' },
  { vi: 'Mục tiêu', en: 'Objective' },
  { vi: 'Lưu', en: 'Save' },
  { vi: 'Lưu thay đổi', en: 'Save changes' },
  { vi: 'Đang lưu...', en: 'Saving...' },
  { vi: 'Đang tải...', en: 'Loading...' },
  { vi: 'Đang tải dự án...', en: 'Loading project...' },
  { vi: 'Đang tạo...', en: 'Creating...' },
  { vi: 'Hủy', en: 'Cancel' },
  { vi: 'Xóa', en: 'Delete' },
  { vi: 'Đổi tên', en: 'Rename' },
  { vi: 'Tên mới', en: 'New name' },
  { vi: 'Nhập tên mới...', en: 'Enter new name...' },
  { vi: 'Tạo dự án', en: 'Create project' },
  { vi: 'Tạo phiên', en: 'Create session' },
  { vi: 'Tạo cuộc họp', en: 'Create meeting' },
  { vi: 'Xem', en: 'View' },
  { vi: 'Mở', en: 'Open' },
  { vi: 'Mở tài liệu', en: 'Open document' },
  { vi: 'Xem tất cả', en: 'View all' },
  { vi: 'Xem danh sách', en: 'View list' },
  { vi: 'Xem tất cả phiên', en: 'View all sessions' },
  { vi: 'Làm mới', en: 'Refresh' },
  { vi: 'Lọc', en: 'Filter' },
  { vi: 'Thêm', en: 'Add' },
  { vi: 'Thêm mới', en: 'Add new' },
  { vi: 'Tài liệu', en: 'Documents' },
  { vi: 'Kho tài liệu dự án', en: 'Project document hub' },
  { vi: 'Tải tài liệu', en: 'Upload document' },
  { vi: 'Upload tài liệu', en: 'Upload document' },
  { vi: 'Knowledge Hub', en: 'Knowledge Hub' },
  { vi: 'Tìm kiếm', en: 'Search' },
  { vi: 'Tìm kiếm gần đây', en: 'Recent searches' },
  { vi: 'Không có link', en: 'No link' },
  { vi: 'Không tìm thấy tài liệu', en: 'No documents found' },
  { vi: 'Không có cuộc họp nào', en: 'No meetings' },
  { vi: 'Không có cuộc họp sắp tới.', en: 'No upcoming meetings.' },
  { vi: 'Bạn chưa có nhiệm vụ nào.', en: 'You have no tasks yet.' },
  { vi: 'Không có tài liệu nào.', en: 'No documents yet.' },
  { vi: 'Không có dữ liệu', en: 'No data' },
  { vi: 'Không tìm thấy dự án', en: 'Project not found' },
  { vi: 'Không tìm thấy cuộc họp', en: 'Meeting not found' },
  { vi: 'Không có cuộc họp live', en: 'No live meeting' },
  { vi: 'Cuộc họp đang diễn ra', en: 'Meeting in progress' },
  { vi: 'Tham gia ngay', en: 'Join now' },
  { vi: 'Quay lại', en: 'Back' },
  { vi: 'Cài đặt', en: 'Settings' },
  { vi: 'Giới thiệu', en: 'About' },
  { vi: 'Giới thiệu Minute', en: 'About Minute' },
  { vi: 'Dự án', en: 'Projects' },
  { vi: 'Lịch họp', en: 'Calendar' },
  { vi: 'Quản lý lịch họp của bạn', en: 'Manage your meeting schedule' },
  { vi: 'Hôm nay', en: 'Today' },
  { vi: 'Năm', en: 'Year' },
  { vi: 'Tháng', en: 'Month' },
  { vi: 'Tuần', en: 'Week' },
  { vi: 'Đóng', en: 'Close' },
  { vi: 'Chọn một ngày để xem lịch họp', en: 'Select a day to view meetings' },
  { vi: 'Workspace', en: 'Workspace' },
  { vi: 'Tổng quan', en: 'Overview' },
  { vi: 'Phiên họp/học', en: 'Sessions' },
  { vi: 'Phiên họp/học gần đây', en: 'Recent sessions' },
  { vi: 'Mục tiêu dự án', en: 'Project objective' },
  { vi: 'Chỉnh sửa', en: 'Edit' },
  { vi: 'Chỉnh sửa dự án', en: 'Edit project' },
  { vi: 'Đổi tên phiên', en: 'Rename session' },
  { vi: 'Không thể tải dữ liệu. Đang sử dụng dữ liệu mẫu.', en: 'Unable to load data. Using mock data.' },
  { vi: 'Không thể tải danh sách dự án. Vui lòng thử lại.', en: 'Unable to load project list. Please try again.' },
  { vi: 'Không thể tạo dự án. Vui lòng thử lại.', en: 'Unable to create project. Please try again.' },
  { vi: 'Không thể tải thông tin dự án.', en: 'Unable to load project detail.' },
  { vi: 'Không thể cập nhật dự án.', en: 'Unable to update project.' },
  { vi: 'Không thể đổi tên phiên. Vui lòng thử lại.', en: 'Unable to rename session. Please try again.' },
  { vi: 'Không thể xóa phiên. Vui lòng thử lại.', en: 'Unable to delete session. Please try again.' },
  { vi: 'Không thể kết nối Groq lúc này. Vui lòng thử lại sau.', en: 'Unable to connect to Groq right now. Please try again later.' },
  { vi: 'Gửi', en: 'Send' },
  { vi: 'Đang gửi...', en: 'Sending...' },
  { vi: 'Tìm kiếm tài liệu theo từ khóa...', en: 'Search documents by keyword...' },
  { vi: 'Tìm kiếm tài liệu và hỏi đáp với AI', en: 'Search documents and ask AI' },
  { vi: 'Kết quả tìm kiếm', en: 'Search results' },
  { vi: 'Tài liệu phổ biến', en: 'Popular documents' },
  { vi: 'Cuộc họp phù hợp', en: 'Relevant meetings' },
  { vi: 'Chưa có lịch', en: 'No schedule yet' },
  { vi: 'Chưa có tài liệu nào', en: 'No documents yet' },
  { vi: 'Chưa có tài liệu', en: 'No documents yet' },
  { vi: 'Chưa có mô tả.', en: 'No description.' },
  { vi: 'Chưa có mô tả. Bạn có thể cập nhật thêm.', en: 'No description yet. You can update it.' },
  { vi: 'Chưa có thời gian', en: 'No schedule yet' },
  { vi: 'Chưa có phiên nào.', en: 'No sessions yet.' },
  { vi: 'Chưa có phiên nào. Tạo phiên đầu tiên cho dự án.', en: 'No sessions yet. Create the first one for this project.' },
  { vi: 'Tổng số', en: 'Total' },
  { vi: 'Quá hạn', en: 'Overdue' },
  { vi: 'Đang thực hiện', en: 'In progress' },
  { vi: 'Hoàn thành', en: 'Completed' },
  { vi: 'Ưu tiên cao', en: 'High priority' },
  { vi: 'Tất cả', en: 'All' },
  { vi: 'Nhiệm vụ', en: 'Tasks' },
  { vi: 'Nhiệm vụ của tôi', en: 'My tasks' },
  { vi: 'Action Items', en: 'Action Items' },
  { vi: 'Theo dõi tất cả action items từ các cuộc họp', en: 'Track all action items from meetings' },
  { vi: 'AI gợi ý cho bạn', en: 'AI suggested for you' },
]

const viToEn = new Map<string, string>()
const enToVi = new Map<string, string>()

for (const pair of LEGACY_LITERAL_PAIRS) {
  viToEn.set(pair.vi, pair.en)
  enToVi.set(pair.en, pair.vi)
}

export const translateLegacyLiteral = (value: string, language: Language): string => {
  if (!value) return value
  if (language === 'en') return viToEn.get(value) || value
  return enToVi.get(value) || value
}

const shouldSkipNode = (node: Node | null): boolean => {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as HTMLElement
  return (
    el.tagName === 'SCRIPT'
    || el.tagName === 'STYLE'
    || el.tagName === 'NOSCRIPT'
    || el.hasAttribute('data-no-auto-i18n')
  )
}

export const applyLegacyAutoTranslation = (root: ParentNode, language: Language): void => {
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const parent = node.parentElement
    if (shouldSkipNode(parent)) continue

    const raw = node.nodeValue || ''
    const trimmed = raw.trim()
    if (!trimmed) continue
    const translated = translateLegacyLiteral(trimmed, language)
    if (translated !== trimmed) {
      node.nodeValue = raw.replace(trimmed, translated)
    }
  }

  const translatableAttrs = ['placeholder', 'title', 'aria-label'] as const
  const elements = root.querySelectorAll<HTMLElement>('*')
  for (const el of elements) {
    if (shouldSkipNode(el)) continue
    for (const attr of translatableAttrs) {
      const current = el.getAttribute(attr)
      if (!current) continue
      const translated = translateLegacyLiteral(current, language)
      if (translated !== current) {
        el.setAttribute(attr, translated)
      }
    }
  }
}

