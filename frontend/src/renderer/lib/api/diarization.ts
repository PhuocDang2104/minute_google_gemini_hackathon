import { api } from '../apiClient';

export type DiarizationSegment = {
  speaker: string;
  start: number;
  end: number;
  confidence?: number;
};

export type DiarizationResponse = {
  status: string;
  segments: DiarizationSegment[];
};

export const diarizationApi = {
  list: (sessionId: string) => api.get<DiarizationResponse>(`/diarization/${sessionId}`),
};

export default diarizationApi;
