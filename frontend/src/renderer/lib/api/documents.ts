// ============================================
// DOCUMENTS API
// API functions for document operations
// ============================================

import api from '../apiClient';

export interface Document {
  id: string;
  meeting_id: string;
  title: string;
  file_type: string;
  file_size?: number;
  description?: string;
  file_url?: string;
  storage_key?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface DocumentCreate {
  meeting_id: string;
  title: string;
  file_type: string;
  file_size?: number;
  description?: string;
  file_url?: string;
  uploaded_by?: string;
}

export interface DocumentList {
  documents: Document[];
  total: number;
}

export interface DocumentUploadResponse {
  id: string;
  title: string;
  file_url: string;
  storage_key?: string;
  message: string;
}

export const uploadFile = async (
  file: File,
  options?: { meeting_id?: string; description?: string; uploaded_by?: string }
): Promise<DocumentUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.meeting_id) formData.append('meeting_id', options.meeting_id);
  if (options?.description) formData.append('description', options.description);
  if (options?.uploaded_by) formData.append('uploaded_by', options.uploaded_by);
  return api.post<DocumentUploadResponse>(`${ENDPOINT}/upload-file`, formData);
};

const ENDPOINT = '/documents';

export const documentsApi = {
  /**
   * List all documents for a meeting
   */
  listByMeeting: async (meetingId: string): Promise<DocumentList> => {
    return api.get<DocumentList>(`${ENDPOINT}/meeting/${meetingId}`);
  },

  /**
   * Get a single document by ID
   */
  get: async (documentId: string): Promise<Document> => {
    return api.get<Document>(`${ENDPOINT}/${documentId}`);
  },

  /**
   * Upload a new document (mock - just stores metadata)
   */
  upload: async (data: DocumentCreate): Promise<DocumentUploadResponse> => {
    return api.post<DocumentUploadResponse>(`${ENDPOINT}/upload`, data);
  },

  /**
   * Update document metadata
   */
  update: async (documentId: string, data: Partial<Document>): Promise<Document> => {
    return api.put<Document>(`${ENDPOINT}/${documentId}`, data);
  },

  /**
   * Delete a document
   */
  delete: async (documentId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/${documentId}`);
  },
};

export default documentsApi;
