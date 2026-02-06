export interface Project {
  id: string
  name: string
  code?: string
  description?: string
  objective?: string
  status?: string
  owner_id?: string
  organization_id?: string
  department_id?: string
  meeting_count?: number
  document_count?: number
  member_count?: number
  created_at?: string
  updated_at?: string
}

export interface ProjectListResponse {
  projects: Project[]
  total: number
}

export interface ProjectCreate {
  name: string
  code?: string
  description?: string
  objective?: string
  status?: string
  owner_id?: string
  organization_id?: string
  department_id?: string
}

export interface ProjectUpdate {
  name?: string
  code?: string
  description?: string
  objective?: string
  status?: string
  owner_id?: string
  organization_id?: string
  department_id?: string
}
