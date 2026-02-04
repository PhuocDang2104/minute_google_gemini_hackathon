import api from '../apiClient';

export interface SessionCreateRequest {
  session_id?: string;
  language_code?: string;
  target_sample_rate_hz?: number;
  audio_encoding?: 'PCM_S16LE';
  channels?: number;
  realtime?: boolean;
  interim_results?: boolean;
  enable_word_time_offsets?: boolean;
}

export interface SessionCreateResponse {
  session_id: string;
  audio_ws_url: string;
  frontend_ws_url: string;
  transcript_test_ws_url: string;
  ingest_policy: {
    expected_audio: { codec: 'PCM_S16LE'; sample_rate_hz: number; channels: number };
    recommended_frame_ms: number;
    max_frame_ms: number;
  };
}

export interface SourceRegisterResponse {
  session_id: string;
  audio_ingest_token: string;
  token_ttl_seconds: number;
}

export const sessionsApi = {
  create: (data: SessionCreateRequest) =>
    api.post<SessionCreateResponse>('/sessions', data, { skipAuth: true }),

  registerSource: (sessionId: string, platform?: string) => {
    const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return api.post<SourceRegisterResponse>(`/sessions/${sessionId}/sources${query}`, undefined, { skipAuth: true });
  },
};
