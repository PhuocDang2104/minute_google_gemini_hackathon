// ============================================
// KNOWLEDGE HUB API
// API functions for knowledge hub operations
// ============================================

import api from '../apiClient';

export interface KnowledgeDocument {
  id: string;
  title: string;
  description?: string;
  document_type: string;
  source: string;
  file_type: string;
  file_size?: number;
  file_url?: string;
  tags?: string[];
  category?: string;
  meeting_id?: string;
  project_id?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  view_count: number;
  last_accessed_at?: string;
}

export interface KnowledgeDocumentList {
  documents: KnowledgeDocument[];
  total: number;
}

export interface KnowledgeDocumentCreate {
  title: string;
  description?: string;
  document_type: string;
  source?: string;
  file_type: string;
  file_size?: number;
  category?: string;
  tags?: string[];
  uploaded_by?: string;
  file_url?: string;
  meeting_id?: string;
  project_id?: string;
}

export interface KnowledgeSearchRequest {
  query: string;
  document_type?: string;
  source?: string;
  category?: string;
  tags?: string[];
  meeting_id?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface KnowledgeSearchResponse {
  documents: KnowledgeDocument[];
  total: number;
  query: string;
}

export interface KnowledgeQueryRequest {
  query: string;
  include_documents?: boolean;
  include_meetings?: boolean;
  limit?: number;
  meeting_id?: string;
  project_id?: string;
}

export interface KnowledgeQueryResponse {
  answer: string;
  relevant_documents: KnowledgeDocument[];
  confidence: number;
  citations?: string[];
}

export interface RecentQuery {
  query: string;
  timestamp: string;
}

const ENDPOINT = '/knowledge';

export const knowledgeApi = {
  /**
   * List all knowledge documents
   */
  list: async (params?: {
    skip?: number;
    limit?: number;
    document_type?: string;
    source?: string;
    category?: string;
    meeting_id?: string;
    project_id?: string;
  }): Promise<KnowledgeDocumentList> => {
    return api.get<KnowledgeDocumentList>(`${ENDPOINT}/documents`, params);
  },

  /**
   * Get a single document by ID
   */
  get: async (documentId: string): Promise<KnowledgeDocument> => {
    return api.get<KnowledgeDocument>(`${ENDPOINT}/documents/${documentId}`);
  },

  /**
   * Upload a new document
   */
  upload: async (data: KnowledgeDocumentCreate, file?: File): Promise<{ id: string; title: string; file_url: string; message: string }> => {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    formData.append('document_type', data.document_type);
    formData.append('source', data.source || 'Uploaded');
    formData.append('file_type', data.file_type);
    if (data.file_size) formData.append('file_size', data.file_size.toString());
    if (data.category) formData.append('category', data.category);
    if (data.tags && data.tags.length > 0) formData.append('tags', data.tags.join(','));
    if (data.uploaded_by) formData.append('uploaded_by', data.uploaded_by);
    if (data.meeting_id) formData.append('meeting_id', data.meeting_id);
    if (data.project_id) formData.append('project_id', data.project_id);
    if (file) formData.append('file', file);

    // Use fetch directly for FormData
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const token = localStorage.getItem('minute_access_token');

    const response = await fetch(`${API_BASE_URL}/api/v1${ENDPOINT}/documents/upload`, {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`,
      } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Update document metadata
   */
  update: async (documentId: string, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> => {
    return api.put<KnowledgeDocument>(`${ENDPOINT}/documents/${documentId}`, data);
  },

  /**
   * Delete a document
   */
  delete: async (documentId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/documents/${documentId}`);
  },

  /**
   * Search documents
   */
  search: async (request: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> => {
    return api.post<KnowledgeSearchResponse>(`${ENDPOINT}/search`, request);
  },

  /**
   * Query knowledge base using AI
   */
  query: async (request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse> => {
    return api.post<KnowledgeQueryResponse>(`${ENDPOINT}/query`, request);
  },

  /**
   * Get recent queries
   */
  getRecentQueries: async (limit?: number): Promise<{ queries: RecentQuery[]; total: number }> => {
    return api.get<{ queries: RecentQuery[]; total: number }>(`${ENDPOINT}/recent-queries`, { limit });
  },
};

export default knowledgeApi;
