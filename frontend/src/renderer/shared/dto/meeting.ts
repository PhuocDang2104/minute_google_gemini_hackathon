
// ============================================
// MEETING TYPES
// Matches backend schemas
// ============================================

export type MeetingType = 'steering' | 'weekly_status' | 'risk_review' | 'workshop' | 'daily';
export type MeetingPhase = 'pre' | 'in' | 'post';
export type ParticipantRole = 'organizer' | 'required' | 'optional' | 'attendee';
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

export interface Participant {
  user_id: string;
  role: ParticipantRole;
  response_status: ResponseStatus;
  email?: string;
  display_name?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  organizer_id?: string;
  start_time?: string;
  end_time?: string;
  meeting_type: MeetingType;
  phase: MeetingPhase;
  project_id?: string;
  department_id?: string;
  location?: string;
  teams_link?: string;
  recording_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MeetingWithParticipants extends Meeting {
  participants: Participant[];
  organizer?: Participant;
}

export interface MeetingListResponse {
  meetings: Meeting[];
  total: number;
}

export interface MeetingCreate {
  title: string;
  description?: string;
  organizer_id?: string;  // Optional until auth is implemented
  start_time?: string;
  end_time?: string;
  meeting_type: MeetingType;
  project_id?: string;
  department_id?: string;
  location?: string;
  teams_link?: string;
  participant_ids?: string[];
}

export interface MeetingUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  meeting_type?: MeetingType;
  phase?: MeetingPhase;
  location?: string;
  teams_link?: string;
  recording_url?: string;
}

export interface MeetingListResponse {
  meetings: Meeting[];
  total: number;
}

export interface MeetingFilters {
  phase?: MeetingPhase;
  meeting_type?: MeetingType;
  project_id?: string;
  skip?: number;
  limit?: number;
}

export interface MeetingNotifyRecipient {
  email: string;
  name?: string;
  role?: string;
}

export interface MeetingNotifyRequest {
  recipients: MeetingNotifyRecipient[];
  include_agenda?: boolean;
  include_documents?: boolean;
  include_notes?: boolean;
  custom_message?: string;
}

// Meeting type labels
export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
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
