export interface ProjectMember {
  project_id: string
  user_id: string
  role?: string
  joined_at?: string
  display_name?: string
  email?: string
}

export interface ProjectMemberList {
  members: ProjectMember[]
  total: number
}
