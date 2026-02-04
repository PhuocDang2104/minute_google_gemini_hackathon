// ============================================
// AI TYPES
// ============================================

// Agenda
export interface AgendaItem {
  order: number;
  title: string;
  duration_minutes: number;
  presenter?: string;
  description?: string;
}

export interface AgendaProposal {
  id: string;
  meeting_id: string;
  items: AgendaItem[];
  status: 'draft' | 'approved';
  generated_at: string;
  approved_at?: string;
}

export interface GenerateAgendaResponse {
  agenda: AgendaProposal;
  confidence: number;
}

// Pre-read Documents
export interface PrereadDocument {
  id: string;
  meeting_id: string;
  title: string;
  source: 'SharePoint' | 'LOffice' | 'Wiki' | 'Confluence' | 'Upload';
  url: string;
  snippet: string;
  relevance_score: number;
  status: 'suggested' | 'accepted' | 'ignored';
  created_at?: string;
}

export interface PrereadDocumentList {
  documents: PrereadDocument[];
  total: number;
}

// RAG Q&A
export interface Citation {
  title: string;
  source: string;
  page?: number;
  snippet: string;
  url?: string;
}

export interface RAGResponse {
  id: string;
  query: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  created_at: string;
}

export interface RAGHistory {
  queries: RAGResponse[];
  total: number;
}

// Meeting Suggestions
export interface MeetingSuggestion {
  id: string;
  meeting_id: string;
  suggestion_type: 'document' | 'person';
  title: string;
  description?: string;
  reference_url?: string;
  score: number;
  status: 'pending' | 'accepted' | 'ignored';
  reason?: string;
}

export interface SuggestionList {
  suggestions: MeetingSuggestion[];
  total: number;
}

// Source icon mapping
export const SOURCE_ICONS: Record<string, string> = {
  SharePoint: '📁',
  LOffice: '📄',
  Wiki: '📚',
  Confluence: '📝',
  Upload: '⬆️',
  NHNN: '🏛️',
};

