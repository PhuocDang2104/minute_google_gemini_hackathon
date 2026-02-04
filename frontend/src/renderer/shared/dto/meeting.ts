
// ============================================
// MEETING TYPES
// Matches backend schemas
// ============================================

export type MeetingType = 'project_meeting' | 'study_session' | 'steering' | 'weekly_status' | 'risk_review' | 'workshop' | 'daily';
export type MeetingPhase = 'pre' | 'in' | 'post';
export type ParticipantRole = 'organizer' | 'required' | 'optional' | 'attendee';
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

export interface User {
  id: string;
  email: string;
  display_name?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  meeting_type: MeetingType;
  phase: MeetingPhase;
  start_time: string; // ISO string
  end_time: string; // ISO string
  location?: string;
  teams_link?: string;
  project_id?: string;
  created_at?: string; // ISO string
  organizer?: User;
  participants?: any[]; // Simplified for now
}

// Meeting type labels
export const MEETING_TYPE_LABELS: Record<string, string> = {
  project_meeting: 'Họp dự án',
  study_session: 'Học online',
  steering: 'Steering Committee',
  weekly_status: 'Weekly Status',
  risk_review: 'Risk Review',
  workshop: 'Workshop',
  daily: 'Daily Standup',
  // Fallback for others
};

export const MEETING_PHASE_LABELS: Record<MeetingPhase, string> = {
  pre: 'Chuẩn bị',
  in: 'Đang họp',
  post: 'Hoàn thành',
};
