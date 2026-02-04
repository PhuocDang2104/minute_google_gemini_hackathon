// ============================================
// MINUTES API
// API functions for meeting minutes operations
// ============================================

import api from '../apiClient';

export interface MeetingMinutes {
  id: string;
  meeting_id: string;
  version: number;
  minutes_text?: string;
  minutes_html?: string;
  minutes_markdown?: string;
  executive_summary?: string;
  minutes_doc_url?: string;
  status: 'draft' | 'reviewed' | 'approved' | 'distributed';
  generated_at: string;
  edited_by?: string;
  edited_at?: string;
  approved_by?: string;
  approved_at?: string;
}

export interface MeetingMinutesList {
  minutes: MeetingMinutes[];
  total: number;
}

export interface GenerateMinutesRequest {
  meeting_id: string;
  template_id?: string; // Template ID to use for generation
  include_transcript?: boolean;
  include_actions?: boolean;
  include_decisions?: boolean;
  include_risks?: boolean;
  format?: 'markdown' | 'html' | 'text';
}

export interface DistributeMinutesRequest {
  minutes_id: string;
  meeting_id: string;
  channels?: string[]; // email, teams, sharepoint
  recipients?: string[]; // user_ids, undefined = all participants
}

export interface DistributionLog {
  id: string;
  minutes_id: string;
  meeting_id: string;
  user_id?: string;
  channel: string;
  recipient_email?: string;
  sent_at: string;
  status: string;
  error_message?: string;
}

export interface DistributionLogList {
  logs: DistributionLog[];
  total: number;
}

const ENDPOINT = '/minutes';

export const minutesApi = {
  /**
   * List all minutes versions for a meeting
   */
  list: async (meetingId: string): Promise<MeetingMinutesList> => {
    return api.get<MeetingMinutesList>(`${ENDPOINT}/${meetingId}`);
  },

  /**
   * Get the latest minutes for a meeting
   */
  getLatest: async (meetingId: string): Promise<MeetingMinutes | null> => {
    const response = await api.get<{ meeting_id: string; minutes: MeetingMinutes | null; message?: string }>(
      `${ENDPOINT}/${meetingId}/latest`
    );
    return response.minutes;
  },

  /**
   * Generate minutes using AI
   */
  generate: async (request: GenerateMinutesRequest): Promise<MeetingMinutes> => {
    return api.post<MeetingMinutes>(`${ENDPOINT}/generate`, request);
  },

  /**
   * Update minutes
   */
  update: async (minutesId: string, data: Partial<MeetingMinutes>): Promise<MeetingMinutes> => {
    return api.put<MeetingMinutes>(`${ENDPOINT}/${minutesId}`, data);
  },

  /**
   * Approve minutes
   */
  approve: async (minutesId: string, approvedBy: string): Promise<MeetingMinutes> => {
    return api.post<MeetingMinutes>(`${ENDPOINT}/${minutesId}/approve?approved_by=${encodeURIComponent(approvedBy)}`, null);
  },

  /**
   * Get distribution logs for a meeting
   */
  getDistributionLogs: async (meetingId: string): Promise<DistributionLogList> => {
    return api.get<DistributionLogList>(`${ENDPOINT}/${meetingId}/distribution`);
  },

  /**
   * Distribute minutes to participants
   */
  distribute: async (request: DistributeMinutesRequest): Promise<{
    status: string;
    distributed_to: number;
    channels: string[];
    logs: DistributionLog[];
  }> => {
    return api.post(`${ENDPOINT}/distribute`, request);
  },
};

export default minutesApi;

