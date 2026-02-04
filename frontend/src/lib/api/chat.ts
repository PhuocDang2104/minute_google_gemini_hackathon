import apiClient from '../apiClient';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string; // Map 'message' from API to 'content' for frontend consistency if needed, or use 'message'
    message?: string; // API returns 'message'
    created_at: string;
    confidence?: number;
}

export interface ChatSession {
    id: string;
    meeting_id?: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
}

export interface ChatResponse {
    id: string;
    message: string;
    role: 'assistant';
    confidence: number;
    created_at: string;
}

export const chatApi = {
    // Send a message
    sendMessage: async (data: {
        session_id?: string;
        meeting_id?: string;
        message: string;
        include_context: boolean;
    }): Promise<ChatResponse> => {
        return apiClient.post('/chat/message', data);
    },

    // Get a specific session
    getSession: async (sessionId: string): Promise<ChatSession> => {
        return apiClient.get(`/chat/sessions/${sessionId}`);
    },

    // List sessions (optional)
    listSessions: async (meetingId?: string): Promise<{ sessions: ChatSession[]; total: number }> => {
        return apiClient.get('/chat/sessions', { params: { meeting_id: meetingId } });
    },
};
