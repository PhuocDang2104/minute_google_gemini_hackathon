import api from '../apiClient';

export interface GoMeetJoinUrlRequest {
  session_id: string;
  audio_ingest_token: string;
  meeting_secret_key?: string;
  access_code?: string;
  platform_meeting_ref?: string;
  idempotency_key?: string;
}

export interface GoMeetJoinUrlResponse {
  join_url: string;
  full_join_url: string;
  host_join_url?: string;
  start_raw?: Record<string, unknown>;
  join_raw?: Record<string, unknown>;
}

export const inMeetingApi = {
  createGoMeetJoinUrl: (payload: GoMeetJoinUrlRequest) =>
    api.post<GoMeetJoinUrlResponse>('/in-meeting/gomeet/join-url', payload, { skipAuth: true }),
};

export default inMeetingApi;
