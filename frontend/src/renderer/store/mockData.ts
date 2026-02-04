// ============================================
// MEETMATE MOCK DATA STORE
// Mirror of database mock data for frontend demo
// ============================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'PMO' | 'chair' | 'user';
  department: string;
  avatar?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  organizer: User;
  startTime: Date;
  endTime: Date;
  meetingType: 'steering' | 'weekly_status' | 'risk_review' | 'workshop' | 'daily';
  phase: 'pre' | 'in' | 'post';
  project: string;
  location: string;
  teamsLink: string;
  participants: User[];
}

export interface ActionItem {
  id: string;
  meetingId: string;
  owner: User;
  description: string;
  deadline: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  sourceText?: string;
  externalLink?: string;
}

export interface DecisionItem {
  id: string;
  meetingId: string;
  description: string;
  rationale: string;
  confirmedBy: User;
  status: 'proposed' | 'confirmed';
}

export interface RiskItem {
  id: string;
  meetingId: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
  status: 'proposed' | 'confirmed' | 'mitigated' | 'closed';
  owner: User;
}

export interface TranscriptChunk {
  id: string;
  meetingId: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  speaker: User;
  text: string;
}

export interface PrereadDocument {
  id: string;
  meetingId: string;
  title: string;
  source: 'SharePoint' | 'LOffice' | 'Wiki';
  url: string;
  snippet: string;
  relevanceScore: number;
  status: 'suggested' | 'accepted' | 'ignored';
}

export interface AIQuery {
  id: string;
  meetingId: string;
  user: User;
  query: string;
  answer: string;
  citations: Array<{ title: string; page: number; snippet: string }>;
}

// ============================================
// USERS
// ============================================

export const users: Record<string, User> = {
  'u001': {
    id: 'u001',
    email: 'nguyenvana@lpbank.vn',
    displayName: 'Nguyễn Văn A',
    role: 'PMO',
    department: 'PMO',
  },
  'u002': {
    id: 'u002',
    email: 'tranthib@lpbank.vn',
    displayName: 'Trần Thị B',
    role: 'PMO',
    department: 'PMO',
  },
  'u003': {
    id: 'u003',
    email: 'levanc@lpbank.vn',
    displayName: 'Lê Văn C',
    role: 'user',
    department: 'PMO',
  },
  'u004': {
    id: 'u004',
    email: 'phamvand@lpbank.vn',
    displayName: 'Phạm Văn D',
    role: 'admin',
    department: 'Công nghệ',
  },
  'u005': {
    id: 'u005',
    email: 'hoangthie@lpbank.vn',
    displayName: 'Hoàng Thị E',
    role: 'user',
    department: 'Công nghệ',
  },
  'u006': {
    id: 'u006',
    email: 'ngothif@lpbank.vn',
    displayName: 'Ngô Thị F',
    role: 'user',
    department: 'Công nghệ',
  },
  'u007': {
    id: 'u007',
    email: 'vuvang@lpbank.vn',
    displayName: 'Vũ Văn G',
    role: 'chair',
    department: 'Kinh doanh',
  },
  'u008': {
    id: 'u008',
    email: 'dothih@lpbank.vn',
    displayName: 'Đỗ Thị H',
    role: 'user',
    department: 'Kinh doanh',
  },
  'u009': {
    id: 'u009',
    email: 'buivani@lpbank.vn',
    displayName: 'Bùi Văn I',
    role: 'chair',
    department: 'Risk & Compliance',
  },
  'u010': {
    id: 'u010',
    email: 'dangthik@lpbank.vn',
    displayName: 'Đặng Thị K',
    role: 'user',
    department: 'Risk & Compliance',
  },
};

export const currentUser = users['u001'];

// ============================================
// MEETINGS
// ============================================

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const meetings: Meeting[] = [
  {
    id: 'm001',
    title: 'Steering Committee - Core Banking Q4 2024',
    description: 'Họp chỉ đạo dự án Core Banking: Review tiến độ, budget, risks, và quyết định các milestone quan trọng.',
    organizer: users['u001'],
    startTime: new Date(today.getTime() - 2 * 60 * 60 * 1000),
    endTime: new Date(today.getTime() - 1 * 60 * 60 * 1000),
    meetingType: 'steering',
    phase: 'post',
    project: 'Core Banking Modernization',
    location: 'Phòng họp VIP - Tầng 15',
    teamsLink: 'https://teams.microsoft.com/l/meetup-join/steering-001',
    participants: [users['u001'], users['u004'], users['u005'], users['u007'], users['u009']],
  },
  {
    id: 'm002',
    title: 'Weekly Project Status - Mobile Banking Sprint 23',
    description: 'Review sprint 23, demo features, discuss blockers.',
    organizer: users['u002'],
    startTime: new Date(today.getTime() - 30 * 60 * 1000),
    endTime: new Date(today.getTime() + 30 * 60 * 1000),
    meetingType: 'weekly_status',
    phase: 'in',
    project: 'Mobile Banking 3.0',
    location: 'Online - Microsoft Teams',
    teamsLink: 'https://teams.microsoft.com/l/meetup-join/weekly-002',
    participants: [users['u002'], users['u006'], users['u008'], users['u001']],
  },
  {
    id: 'm003',
    title: 'Risk Review - LOS Integration với Core Banking',
    description: 'Đánh giá rủi ro tích hợp LOS với Core Banking mới, compliance requirements.',
    organizer: users['u009'],
    startTime: new Date(today.getTime() + 2 * 60 * 60 * 1000),
    endTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
    meetingType: 'risk_review',
    phase: 'pre',
    project: 'Loan Origination System',
    location: 'Phòng họp Risk - Tầng 12',
    teamsLink: 'https://teams.microsoft.com/l/meetup-join/risk-003',
    participants: [users['u009'], users['u010'], users['u001'], users['u005']],
  },
  {
    id: 'm004',
    title: 'Workshop: KYC Enhancement - Business Requirements',
    description: 'Workshop cross-functional để finalize BRD cho module eKYC mới.',
    organizer: users['u007'],
    startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
    endTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
    meetingType: 'workshop',
    phase: 'pre',
    project: 'KYC Enhancement',
    location: 'Phòng Training - Tầng 3',
    teamsLink: 'https://teams.microsoft.com/l/meetup-join/workshop-004',
    participants: [users['u007'], users['u008'], users['u003'], users['u010']],
  },
  {
    id: 'm005',
    title: 'Daily Standup - Core Banking Team',
    description: 'Daily standup 15 phút: Yesterday, Today, Blockers.',
    organizer: users['u005'],
    startTime: new Date(today.getTime() - 4 * 60 * 60 * 1000),
    endTime: new Date(today.getTime() - 3.75 * 60 * 60 * 1000),
    meetingType: 'daily',
    phase: 'post',
    project: 'Core Banking Modernization',
    location: 'Online - Microsoft Teams',
    teamsLink: 'https://teams.microsoft.com/l/meetup-join/daily-005',
    participants: [users['u005'], users['u004'], users['u003']],
  },
];

// ============================================
// ACTION ITEMS
// ============================================

export const actionItems: ActionItem[] = [
  {
    id: 'ai001',
    meetingId: 'm001',
    owner: users['u006'],
    description: 'Gửi updated roadmap Sprint 24-25 cho Mobile Banking, re-plan scope sau khi điều chuyển resources',
    deadline: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    priority: 'high',
    status: 'confirmed',
    sourceText: 'Team Mobile có thể adjust scope Sprint 24, đưa một số features non-critical sang Sprint 25.',
    externalLink: 'https://planner.lpbank.vn/tasks/12345',
  },
  {
    id: 'ai002',
    meetingId: 'm001',
    owner: users['u002'],
    description: 'Coordinate với HR để arrange điều chuyển 2 senior developers từ team Mobile sang Core Banking',
    deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
    priority: 'critical',
    status: 'in_progress',
    sourceText: 'HR arrange việc điều chuyển 2 developers trước thứ Hai tuần sau.',
    externalLink: 'https://jira.lpbank.vn/browse/HR-456',
  },
  {
    id: 'ai003',
    meetingId: 'm001',
    owner: users['u005'],
    description: 'Gửi Penetration Test Report chi tiết cho team Risk & Compliance',
    deadline: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    priority: 'high',
    status: 'confirmed',
    sourceText: 'Em sẽ gửi báo cáo chi tiết cho anh sau meeting.',
  },
  {
    id: 'ai004',
    meetingId: 'm001',
    owner: users['u003'],
    description: 'Update Risk Register với timeline mới và resource allocation changes',
    deadline: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    priority: 'medium',
    status: 'proposed',
    sourceText: 'Cần update Risk Register với timeline mới và resource changes.',
  },
  {
    id: 'ai005',
    meetingId: 'm005',
    owner: users['u005'],
    description: 'Fix performance issue trong batch processing module - optimize Oracle queries',
    deadline: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
    priority: 'critical',
    status: 'in_progress',
    externalLink: 'https://jira.lpbank.vn/browse/CB-789',
  },
];

// ============================================
// DECISIONS
// ============================================

export const decisions: DecisionItem[] = [
  {
    id: 'di001',
    meetingId: 'm001',
    description: 'Approve điều chuyển 2 senior developers từ team Mobile sang team Core Banking trong 4 tuần',
    rationale: 'Để đảm bảo timeline go-live 01/01 cho Core Banking, cần thêm resources để optimize batch processing performance.',
    confirmedBy: users['u007'],
    status: 'confirmed',
  },
  {
    id: 'di002',
    meetingId: 'm001',
    description: 'Team Mobile sẽ adjust scope Sprint 24, đưa non-critical features sang Sprint 25',
    rationale: 'Trade-off để support Core Banking go-live đúng hạn.',
    confirmedBy: users['u001'],
    status: 'confirmed',
  },
];

// ============================================
// RISKS
// ============================================

export const risks: RiskItem[] = [
  {
    id: 'ri001',
    meetingId: 'm001',
    description: 'Go-live Core Banking có thể delay 2 tuần nếu không có đủ resources',
    severity: 'high',
    mitigation: 'Đã approve điều chuyển 2 senior developers từ team Mobile.',
    status: 'mitigated',
    owner: users['u001'],
  },
  {
    id: 'ri002',
    meetingId: 'm001',
    description: 'Còn 3 medium security issues từ Penetration Test chưa được fix',
    severity: 'medium',
    mitigation: 'Team Core Banking đang fix, target hoàn thành trước go-live.',
    status: 'confirmed',
    owner: users['u009'],
  },
  {
    id: 'ri003',
    meetingId: 'm001',
    description: 'Mobile Banking Sprint 24 có thể bị ảnh hưởng do điều chuyển resources',
    severity: 'medium',
    mitigation: 'Team Mobile sẽ re-plan và defer non-critical features.',
    status: 'mitigated',
    owner: users['u006'],
  },
];

// ============================================
// TRANSCRIPT (for Steering Committee)
// ============================================

export const transcriptChunks: TranscriptChunk[] = [
  {
    id: 'tc001',
    meetingId: 'm001',
    chunkIndex: 1,
    startTime: 0,
    endTime: 45,
    speaker: users['u001'],
    text: 'Xin chào các anh chị, hôm nay chúng ta họp Steering Committee cho dự án Core Banking Q4. Xin mời anh Phạm Văn D báo cáo tình hình tiến độ.',
  },
  {
    id: 'tc002',
    meetingId: 'm001',
    chunkIndex: 2,
    startTime: 46,
    endTime: 180,
    speaker: users['u004'],
    text: 'Cảm ơn anh A. Hiện tại dự án Core Banking đang ở milestone 3, tiến độ overall là 68%. Module Account Management đã hoàn thành UAT tuần trước. Module Transaction Processing đang trong giai đoạn SIT, dự kiến hoàn thành vào 15/12. Tuy nhiên, chúng ta đang gặp một số issues với performance của batch processing, cần thêm 2 tuần để optimize.',
  },
  {
    id: 'tc003',
    meetingId: 'm001',
    chunkIndex: 3,
    startTime: 181,
    endTime: 240,
    speaker: users['u007'],
    text: 'Anh D ơi, việc delay 2 tuần có ảnh hưởng đến timeline go-live không? Business đang rất cần module này để support chiến dịch cuối năm.',
  },
  {
    id: 'tc004',
    meetingId: 'm001',
    chunkIndex: 4,
    startTime: 241,
    endTime: 350,
    speaker: users['u004'],
    text: 'Nếu không có thêm resources, go-live sẽ phải lùi từ 01/01 sang 15/01. Tuy nhiên, nếu được approve thêm 2 senior developers từ team Mobile, chúng ta có thể giữ nguyên timeline.',
  },
  {
    id: 'tc005',
    meetingId: 'm001',
    chunkIndex: 5,
    startTime: 351,
    endTime: 420,
    speaker: users['u005'],
    text: 'Đúng rồi anh. Em cần 2 người có experience với batch processing và Oracle optimization. Nếu có người từ team Mobile qua support 3-4 tuần là đủ.',
  },
  {
    id: 'tc006',
    meetingId: 'm001',
    chunkIndex: 6,
    startTime: 421,
    endTime: 510,
    speaker: users['u009'],
    text: 'Tôi có concern về security của module Transaction Processing. Penetration test đã pass hết chưa? Và data encryption at rest đã implement theo standard của NHNN chưa?',
  },
  {
    id: 'tc007',
    meetingId: 'm001',
    chunkIndex: 7,
    startTime: 511,
    endTime: 600,
    speaker: users['u005'],
    text: 'Dạ anh I, pentest đã pass 95% test cases, còn 3 medium issues đang fix. Data encryption đã implement AES-256 theo chuẩn. Em sẽ gửi báo cáo chi tiết cho anh sau meeting.',
  },
  {
    id: 'tc008',
    meetingId: 'm001',
    chunkIndex: 8,
    startTime: 601,
    endTime: 680,
    speaker: users['u001'],
    text: 'OK, tôi đề xuất chúng ta approve việc điều chuyển 2 senior developers từ team Mobile sang hỗ trợ Core Banking trong 4 tuần. Anh chị đồng ý không?',
  },
];

// ============================================
// PRE-READ DOCUMENTS
// ============================================

export const prereadDocuments: PrereadDocument[] = [
  {
    id: 'pr001',
    meetingId: 'm003',
    title: 'LOS-CoreBanking Integration Architecture v2.1',
    source: 'SharePoint',
    url: 'https://lpbank.sharepoint.com/sites/tech/docs/los-cb-integration-v21.pdf',
    snippet: 'Tài liệu mô tả kiến trúc tích hợp giữa hệ thống LOS và Core Banking mới, bao gồm API specifications, data flow, và security requirements.',
    relevanceScore: 0.95,
    status: 'accepted',
  },
  {
    id: 'pr002',
    meetingId: 'm003',
    title: 'Risk Assessment Template - System Integration',
    source: 'LOffice',
    url: 'https://loffice.lpbank.vn/docs/risk-assessment-template.docx',
    snippet: 'Template đánh giá rủi ro cho các dự án tích hợp hệ thống, bao gồm checklist 50+ items.',
    relevanceScore: 0.88,
    status: 'accepted',
  },
  {
    id: 'pr003',
    meetingId: 'm003',
    title: 'NHNN Circular 09/2020 - IT Risk Management',
    source: 'Wiki',
    url: 'https://wiki.lpbank.vn/compliance/nhnn-circular-09-2020',
    snippet: 'Thông tư 09/2020/TT-NHNN quy định về quản lý rủi ro công nghệ thông tin trong hoạt động ngân hàng.',
    relevanceScore: 0.82,
    status: 'suggested',
  },
];

// ============================================
// AI QUERIES
// ============================================

export const aiQueries: AIQuery[] = [
  {
    id: 'aq001',
    meetingId: 'm001',
    user: users['u009'],
    query: 'Data retention policy cho transaction logs theo quy định NHNN là bao nhiêu năm?',
    answer: 'Theo Thông tư 09/2020/TT-NHNN về quản lý rủi ro CNTT, thời gian lưu trữ dữ liệu giao dịch (transaction logs) tối thiểu là **10 năm** kể từ ngày phát sinh giao dịch.',
    citations: [
      {
        title: 'Thông tư 09/2020/TT-NHNN',
        page: 12,
        snippet: 'Điều 15: Thời gian lưu trữ dữ liệu giao dịch tối thiểu 10 năm...',
      },
    ],
  },
  {
    id: 'aq002',
    meetingId: 'm001',
    user: users['u007'],
    query: 'CR-2024-015 về việc thay đổi API Gateway đã được approve chưa?',
    answer: 'CR-2024-015 đã được **approved** vào ngày 15/10/2024 trong cuộc họp Change Advisory Board. Implementation đã hoàn thành 80%.',
    citations: [
      {
        title: 'Change Request CR-2024-015',
        page: 1,
        snippet: 'Status: Approved. Approval Date: 15/10/2024...',
      },
    ],
  },
];

// ============================================
// STATS
// ============================================

export const dashboardStats = {
  totalMeetingsToday: 5,
  meetingsCompleted: 2,
  meetingsInProgress: 1,
  meetingsUpcoming: 2,
  
  totalActions: actionItems.length,
  actionsCompleted: actionItems.filter(a => a.status === 'completed').length,
  actionsOverdue: actionItems.filter(a => a.deadline < now && a.status !== 'completed').length,
  actionsInProgress: actionItems.filter(a => a.status === 'in_progress').length,
  
  totalDecisions: decisions.length,
  decisionsConfirmed: decisions.filter(d => d.status === 'confirmed').length,
  
  totalRisks: risks.length,
  risksHigh: risks.filter(r => r.severity === 'high' || r.severity === 'critical').length,
  risksMitigated: risks.filter(r => r.status === 'mitigated').length,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export function getMeetingTypeLabel(type: Meeting['meetingType']): string {
  const labels: Record<Meeting['meetingType'], string> = {
    steering: 'Steering Committee',
    weekly_status: 'Weekly Status',
    risk_review: 'Risk Review',
    workshop: 'Workshop',
    daily: 'Daily Standup',
  };
  return labels[type];
}

export function getPhaseLabel(phase: Meeting['phase']): string {
  const labels: Record<Meeting['phase'], string> = {
    pre: 'Chuẩn bị',
    in: 'Đang họp',
    post: 'Hoàn thành',
  };
  return labels[phase];
}

export function getPriorityLabel(priority: ActionItem['priority']): string {
  const labels: Record<ActionItem['priority'], string> = {
    critical: 'Khẩn cấp',
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
  };
  return labels[priority];
}

export function isOverdue(deadline: Date): boolean {
  return deadline < new Date();
}

