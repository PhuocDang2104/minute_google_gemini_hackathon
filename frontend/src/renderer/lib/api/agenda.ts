// ============================================
// AGENDA API
// API functions for agenda operations
// ============================================

import api from '../apiClient';

export interface AgendaItem {
  id: string;
  meeting_id: string;
  order_index: number;
  title: string;
  duration_minutes: number;
  presenter_id?: string;
  presenter_name?: string;
  description?: string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface AgendaItemCreate {
  order_index: number;
  title: string;
  duration_minutes?: number;
  presenter_id?: string;
  presenter_name?: string;
  description?: string;
  notes?: string;
}

export interface AgendaItemUpdate {
  order_index?: number;
  title?: string;
  duration_minutes?: number;
  presenter_id?: string;
  presenter_name?: string;
  description?: string;
  notes?: string;
  status?: 'pending' | 'in_progress' | 'completed';
}

export interface AgendaList {
  items: AgendaItem[];
  total: number;
  total_duration_minutes: number;
}

export interface AgendaGenerateRequest {
  meeting_id: string;
  meeting_title: string;
  meeting_type?: string;
  meeting_description?: string;
  duration_minutes?: number;
  participants?: string[];
  context?: string;
}

export interface AgendaGenerateResponse {
  items: AgendaItemCreate[];
  total_duration_minutes: number;
  ai_notes?: string;
  is_saved: boolean;
}

export interface AgendaSaveRequest {
  meeting_id: string;
  items: AgendaItemCreate[];
}

const ENDPOINT = '/agenda';

export const agendaApi = {
  /**
   * List all agenda items for a meeting
   */
  listByMeeting: async (meetingId: string): Promise<AgendaList> => {
    return api.get<AgendaList>(`${ENDPOINT}/meeting/${meetingId}`);
  },

  /**
   * Get a single agenda item by ID
   */
  getItem: async (itemId: string): Promise<AgendaItem> => {
    return api.get<AgendaItem>(`${ENDPOINT}/item/${itemId}`);
  },

  /**
   * Create a new agenda item
   */
  createItem: async (meetingId: string, data: AgendaItemCreate): Promise<AgendaItem> => {
    return api.post<AgendaItem>(`${ENDPOINT}/meeting/${meetingId}/item`, data);
  },

  /**
   * Update an agenda item
   */
  updateItem: async (itemId: string, data: AgendaItemUpdate): Promise<AgendaItem> => {
    return api.put<AgendaItem>(`${ENDPOINT}/item/${itemId}`, data);
  },

  /**
   * Delete an agenda item
   */
  deleteItem: async (itemId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/item/${itemId}`);
  },

  /**
   * Generate agenda using AI
   */
  generate: async (request: AgendaGenerateRequest): Promise<AgendaGenerateResponse> => {
    return api.post<AgendaGenerateResponse>(`${ENDPOINT}/generate`, request);
  },

  /**
   * Save a complete agenda (replaces existing)
   */
  save: async (data: AgendaSaveRequest): Promise<AgendaList> => {
    return api.post<AgendaList>(`${ENDPOINT}/save`, data);
  },

  /**
   * Reorder agenda items
   */
  reorder: async (meetingId: string, itemIds: string[]): Promise<AgendaList> => {
    return api.post<AgendaList>(`${ENDPOINT}/meeting/${meetingId}/reorder`, itemIds);
  },
};

export default agendaApi;

