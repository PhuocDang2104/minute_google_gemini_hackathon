// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'PMO' | 'chair' | 'user';
  department_id?: string;
  department_name?: string;
  avatar_url?: string;
  organization_id?: string;
  created_at?: string;
  last_login_at?: string;
  is_active?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface Department {
  id: string;
  name: string;
  organization_id?: string;
}

export interface DepartmentListResponse {
  departments: Department[];
  total: number;
}

export type LlmProvider = 'gemini' | 'groq';

export interface LlmBehaviorSettings {
  nickname?: string | null;
  about?: string | null;
  future_focus?: string | null;
  role?: string | null;
  note_style?: string | null;
  tone?: string | null;
  cite_evidence?: boolean | null;
}

export interface LlmSettings {
  provider: LlmProvider;
  model: string;
  api_key_set: boolean;
  api_key_last4?: string | null;
  visual_provider: LlmProvider;
  visual_model: string;
  visual_api_key_set: boolean;
  visual_api_key_last4?: string | null;
  master_prompt?: string | null;
  behavior?: LlmBehaviorSettings;
}

export interface LlmSettingsUpdate {
  provider: LlmProvider;
  model: string;
  api_key?: string;
  clear_api_key?: boolean;
  visual_provider?: LlmProvider;
  visual_model?: string;
  visual_api_key?: string;
  clear_visual_api_key?: boolean;
  master_prompt?: string | null;
  clear_master_prompt?: boolean;
  behavior?: LlmBehaviorSettings;
}

// Helper function to get initials
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

// Role labels
export const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Admin',
  PMO: 'PMO',
  chair: 'Chủ trì',
  user: 'Thành viên',
};
