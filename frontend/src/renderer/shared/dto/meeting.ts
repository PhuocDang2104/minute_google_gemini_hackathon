
// ============================================
// MEETING TYPES
// Matches backend schemas
// ============================================

export type MeetingType = 'project_meeting' | 'study_session' | 'steering' | 'weekly_status' | 'risk_review' | 'workshop' | 'daily';
export type MeetingPhase = 'pre' | 'in' | 'post';
export type ParticipantRole = 'organizer' | 'required' | 'optional' | 'attendee';
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

// ... (keep interface definitions same)

// Meeting type labels
export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  project_meeting: 'Họp dự án',
  study_session: 'Học online',
  steering: 'Steering Committee',
  weekly_status: 'Weekly Status',
  risk_review: 'Risk Review',
  workshop: 'Workshop',
  daily: 'Daily Standup',
};

export const MEETING_PHASE_LABELS: Record<MeetingPhase, string> = {
  pre: 'Chuẩn bị',
  in: 'Đang họp',
  post: 'Hoàn thành',
};
