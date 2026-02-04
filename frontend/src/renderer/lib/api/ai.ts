import api from '../apiClient';
import type {
  GenerateAgendaResponse,
  AgendaItem,
  PrereadDocumentList,
  RAGResponse,
  RAGHistory,
  SuggestionList,
} from '../../shared/dto/ai';

export const aiApi = {
  // Agenda
  generateAgenda: async (meetingId: string, context?: string): Promise<GenerateAgendaResponse> => {
    return api.post<GenerateAgendaResponse>('/pre-meeting/agenda/generate', {
      meeting_id: meetingId,
      context,
    });
  },

  saveAgenda: async (meetingId: string, items: AgendaItem[]): Promise<void> => {
    return api.post<void>(`/pre-meeting/agenda/${meetingId}/save`, items);
  },

  // Documents
  suggestDocuments: async (meetingId: string, keywords?: string[]): Promise<PrereadDocumentList> => {
    return api.post<PrereadDocumentList>('/pre-meeting/documents/suggest', {
      meeting_id: meetingId,
      keywords,
    });
  },

  // Suggestions
  getSuggestions: async (meetingId: string): Promise<SuggestionList> => {
    return api.get<SuggestionList>(`/pre-meeting/suggestions/${meetingId}`);
  },

  // RAG
  queryRAG: async (query: string, meetingId?: string): Promise<RAGResponse> => {
    return api.post<RAGResponse>('/rag/query', {
      query,
      meeting_id: meetingId,
      include_meeting_context: true,
    });
  },

  getRAGHistory: async (meetingId: string): Promise<RAGHistory> => {
    return api.get<RAGHistory>(`/rag/history/${meetingId}`);
  },

  // Chat
  sendMessage: async (message: string, meetingId?: string): Promise<{ message: string; confidence: number }> => {
    return api.post('/chat/message', {
      message,
      meeting_id: meetingId,
      include_context: true,
    });
  },

  homeAsk: async (message: string): Promise<{ message: string; confidence?: number }> => {
    return api.post('/chat/home', {
      message,
    });
  },

  // Summary
  generateSummary: async (meetingId: string, transcript: string): Promise<{ summary: string }> => {
    return api.post('/chat/generate/summary', {
      meeting_id: meetingId,
      transcript,
    });
  },
};

export default aiApi;

