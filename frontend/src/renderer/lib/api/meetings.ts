// ============================================
// MEETINGS API
// API functions for meeting operations
// ============================================

import api from '../apiClient';
import type {
  Meeting,
  MeetingCreate,
  MeetingUpdate,
  MeetingWithParticipants,
  MeetingListResponse,
  MeetingFilters,
} from '../../shared/dto/meeting';
import type { MeetingNotifyRequest } from '../../shared/dto/meeting';

const ENDPOINT = '/meetings';

export const meetingsApi = {
  /**
   * List all meetings with optional filters
   */
  list: async (filters?: MeetingFilters): Promise<MeetingListResponse> => {
    return api.get<MeetingListResponse>(`${ENDPOINT}/`, filters as Record<string, string | number | undefined>);
  },

  /**
   * Get a single meeting by ID
   */
  get: async (id: string): Promise<MeetingWithParticipants> => {
    return api.get<MeetingWithParticipants>(`${ENDPOINT}/${id}`);
  },

  /**
   * Create a new meeting
   */
  create: async (data: MeetingCreate): Promise<Meeting> => {
    return api.post<Meeting>(`${ENDPOINT}/`, data);
  },

  /**
   * Quick-create a new meeting with auto-generated title
   * Title format: "Untitled YYYY-MM-DD HH:MM"
   */
  quickCreate: async (): Promise<Meeting> => {
    return api.post<Meeting>(`${ENDPOINT}/quick`, {});
  },

  /**
   * Update a meeting
   */
  update: async (id: string, data: MeetingUpdate): Promise<Meeting> => {
    return api.put<Meeting>(`${ENDPOINT}/${id}`, data);
  },

  /**
   * Delete a meeting
   */
  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/${id}`);
  },

  /**
   * Add participant to meeting
   */
  addParticipant: async (meetingId: string, userId: string, role: string = 'attendee'): Promise<Meeting> => {
    return api.post<Meeting>(`/participants/${meetingId}`, { user_id: userId, role });
  },

  /**
   * Remove participant from meeting
   */
  removeParticipant: async (meetingId: string, userId: string): Promise<void> => {
    return api.delete<void>(`/participants/${meetingId}/user/${userId}`);
  },

  /**
   * Update meeting phase
   */
  updatePhase: async (id: string, phase: 'pre' | 'in' | 'post'): Promise<Meeting> => {
    return api.patch<Meeting>(`${ENDPOINT}/${id}/phase`, { phase });
  },

  /**
   * Send notification email for a meeting
   */
  notify: async (id: string, payload: MeetingNotifyRequest): Promise<any> => {
    return api.post(`${ENDPOINT}/${id}/notify`, payload);
  },

  /**
   * Upload video recording for a meeting
   */
  uploadVideo: async (meetingId: string, file: File): Promise<{ recording_url: string; message: string }> => {
    const formData = new FormData();
    formData.append('video', file);
    return api.post<{ recording_url: string; message: string }>(`${ENDPOINT}/${meetingId}/upload-video`, formData);
  },

  /**
   * Trigger inference (transcription + diarization) from video
   */
  triggerInference: async (meetingId: string): Promise<{ status: string; message: string; transcript_count?: number; minutes_id?: string; pdf_url?: string }> => {
    return api.post<{ status: string; message: string; transcript_count?: number; minutes_id?: string; pdf_url?: string }>(`${ENDPOINT}/${meetingId}/trigger-inference`, {});
  },

  /**
   * Delete video recording for a meeting
   */
  deleteVideo: async (meetingId: string): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(`${ENDPOINT}/${meetingId}/video`);
  },
};

export default meetingsApi;
