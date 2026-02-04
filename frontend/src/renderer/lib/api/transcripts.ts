/**
 * Transcripts API Client
 */
import api from '../apiClient';

export interface TranscriptChunk {
  id: string;
  meeting_id: string;
  chunk_index: number;
  start_time: number;
  end_time: number;
  speaker?: string;
  speaker_user_id?: string;
  speaker_name?: string;
  text: string;
  confidence?: number;
  language?: string;
  created_at?: string;
}

export interface TranscriptChunksResponse {
  chunks: TranscriptChunk[];
  total: number;
}

export interface TranscriptChunkCreate {
  chunk_index: number;
  start_time: number;
  end_time: number;
  speaker?: string;
  speaker_user_id?: string;
  text: string;
  confidence?: number;
  language?: string;
}

/**
 * List transcript chunks for a meeting
 */
export const list = async (
  meetingId: string,
  params?: {
    from_index?: number;
    to_index?: number;
    limit?: number;
  }
): Promise<TranscriptChunksResponse> => {
  return api.get<TranscriptChunksResponse>(`/transcripts/${meetingId}`, params);
};

/**
 * Get full transcript text for a meeting
 */
export const getFull = async (meetingId: string): Promise<{ meeting_id: string; transcript: string }> => {
  return api.get<{ meeting_id: string; transcript: string }>(`/transcripts/${meetingId}/full`);
};

/**
 * Ingest a single transcript chunk
 */
export const ingest = async (meetingId: string, chunk: TranscriptChunkCreate): Promise<TranscriptChunk> => {
  return api.post<TranscriptChunk>(`/transcripts/${meetingId}/chunks`, chunk);
};

/**
 * Ingest multiple transcript chunks (batch)
 */
export const ingestBatch = async (meetingId: string, chunks: TranscriptChunkCreate[]): Promise<TranscriptChunksResponse> => {
  return api.post<TranscriptChunksResponse>(`/transcripts/${meetingId}/chunks/batch`, chunks);
};

/**
 * Extract actions/decisions/risks from transcript
 */
export const extract = async (meetingId: string): Promise<{
  actions: any[];
  decisions: any[];
  risks: any[];
}> => {
  // Note: Backend has separate endpoints for extract actions/decisions/risks
  // This is a convenience wrapper (if needed, implement separately)
  const [actionsRes, decisionsRes, risksRes] = await Promise.all([
    api.post(`/transcripts/${meetingId}/extract/actions`).catch(() => ({ actions: [] })),
    api.post(`/transcripts/${meetingId}/extract/decisions`).catch(() => ({ decisions: [] })),
    api.post(`/transcripts/${meetingId}/extract/risks`).catch(() => ({ risks: [] })),
  ]);
  
  return {
    actions: actionsRes.actions || [],
    decisions: decisionsRes.decisions || [],
    risks: risksRes.risks || [],
  };
};

export const transcriptsApi = {
  list,
  getFull,
  ingest,
  ingestBatch,
  extract,
};

export default transcriptsApi;

