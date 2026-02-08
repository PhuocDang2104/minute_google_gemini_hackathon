
// ============================================
// MEETING TYPES
// Matches backend schemas
// ============================================

export type MeetingType = 'project_meeting' | 'study_session' | 'steering' | 'weekly_status' | 'risk_review' | 'workshop' | 'daily';
export type MeetingPhase = 'pre' | 'in' | 'post';
export type LocaleCode = 'vi' | 'en';
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

export interface MeetingCreate {
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  meeting_type?: MeetingType;
  project_id?: string;
  department_id?: string;
  location?: string;
  teams_link?: string;
  organizer_id?: string;
  participant_ids?: string[];
}

export interface MeetingUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  meeting_type?: MeetingType;
  phase?: MeetingPhase;
  project_id?: string;
  location?: string;
  teams_link?: string;
  recording_url?: string;
}

export interface MeetingWithParticipants extends Meeting {
  participants?: User[];
}

export interface MeetingListResponse {
  meetings: Meeting[];
  total: number;
}

export interface MeetingFilters {
  skip?: number;
  limit?: number;
  phase?: MeetingPhase;
  meeting_type?: MeetingType;
  project_id?: string;
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

export const MEETING_TYPE_LABELS_EN: Record<string, string> = {
  project_meeting: 'Project Meeting',
  study_session: 'Study Session',
  steering: 'Steering Committee',
  weekly_status: 'Weekly Status',
  risk_review: 'Risk Review',
  workshop: 'Workshop',
  daily: 'Daily Standup',
};

export const MEETING_PHASE_LABELS_EN: Record<MeetingPhase, string> = {
  pre: 'Preparation',
  in: 'In Meeting',
  post: 'Completed',
};

export function getMeetingTypeLabel(type: string, language: LocaleCode = 'vi'): string {
  if (language === 'en') {
    return MEETING_TYPE_LABELS_EN[type] || type;
  }
  return MEETING_TYPE_LABELS[type] || type;
}

export function getMeetingPhaseLabel(phase: MeetingPhase, language: LocaleCode = 'vi'): string {
  if (language === 'en') {
    return MEETING_PHASE_LABELS_EN[phase] || phase;
  }
  return MEETING_PHASE_LABELS[phase] || phase;
}
