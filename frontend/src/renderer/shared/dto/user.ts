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

