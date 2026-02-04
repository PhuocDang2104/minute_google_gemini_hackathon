// ============================================
// ITEMS API (Actions, Decisions, Risks)
// ============================================

import api from '../apiClient';

// Action Items
export interface ActionItem {
  id: string;
  meeting_id: string;
  owner_user_id?: string;
  owner_name?: string;
  title?: string; // Added field
  meeting_title?: string;
  description: string;
  deadline?: string;
  due_date?: string; // Added alias
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  source_text?: string;
  external_task_link?: string;
  external_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItemCreate {
  meeting_id: string;
  title?: string;
  description: string;
  owner_user_id?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  external_task_link?: string;
}

export interface ActionItemUpdate {
  title?: string;
  description?: string;
  owner_user_id?: string;
  deadline?: string;
  priority?: string;
  status?: string;
  external_task_link?: string;
  external_task_id?: string;
}

export interface ActionItemFilters {
  status?: string;
  priority?: string;
  owner_user_id?: string;
  overdue_only?: boolean;
}

export interface ActionItemList {
  items: ActionItem[];
  total: number;
}

// Decisions
export interface DecisionItem {
  id: string;
  meeting_id: string;
  title?: string; // Added field
  description: string;
  rationale?: string;
  impact?: string; // Added field
  confirmed_by?: string;
  confirmed_at?: string;
  source_text?: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionItemList {
  items: DecisionItem[];
  total: number;
}

// Risks
export interface RiskItem {
  id: string;
  meeting_id: string;
  title?: string; // Added field
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
  status: 'identified' | 'mitigated' | 'in_progress';
  source_text?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskItemList {
  items: RiskItem[];
  total: number;
}

const ENDPOINT = '/items';

export const itemsApi = {
  // Action Items - List all with filters
  listAllActions: async (filters?: ActionItemFilters): Promise<ActionItemList> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.owner_user_id) params.append('owner_user_id', filters.owner_user_id);
    if (filters?.overdue_only) params.append('overdue_only', 'true');

    const query = params.toString();
    return api.get<ActionItemList>(`${ENDPOINT}/actions${query ? `?${query}` : ''}`);
  },

  // Action Items - List by meeting
  listActions: async (meetingId: string): Promise<ActionItemList> => {
    return api.get<ActionItemList>(`${ENDPOINT}/actions/${meetingId}`);
  },

  getAction: async (itemId: string): Promise<ActionItem> => {
    return api.get<ActionItem>(`${ENDPOINT}/actions/item/${itemId}`);
  },

  createAction: async (data: ActionItemCreate): Promise<ActionItem> => {
    return api.post<ActionItem>(`${ENDPOINT}/actions`, data);
  },

  updateAction: async (itemId: string, data: ActionItemUpdate): Promise<ActionItem> => {
    return api.put<ActionItem>(`${ENDPOINT}/actions/${itemId}`, data);
  },

  deleteAction: async (itemId: string): Promise<void> => {
    return api.delete(`${ENDPOINT}/actions/${itemId}`);
  },

  // Decisions
  listDecisions: async (meetingId: string): Promise<DecisionItemList> => {
    return api.get<DecisionItemList>(`${ENDPOINT}/decisions/${meetingId}`);
  },

  getDecision: async (itemId: string): Promise<DecisionItem> => {
    return api.get<DecisionItem>(`${ENDPOINT}/decisions/item/${itemId}`);
  },

  // Risks
  listRisks: async (meetingId: string): Promise<RiskItemList> => {
    return api.get<RiskItemList>(`${ENDPOINT}/risks/${meetingId}`);
  },

  getRisk: async (itemId: string): Promise<RiskItem> => {
    return api.get<RiskItem>(`${ENDPOINT}/risks/item/${itemId}`);
  },
};

export default itemsApi;

