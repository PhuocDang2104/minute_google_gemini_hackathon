export interface ActionItemResponse {
  id: string
  meeting_id: string
  owner_user_id?: string
  owner_name?: string
  meeting_title?: string
  description: string
  deadline?: string
  priority: string
  status: string
  source_chunk_id?: string
  source_text?: string
  external_task_link?: string
  external_task_id?: string
  confirmed_by?: string
  confirmed_at?: string
  created_at: string
  updated_at?: string
}

export interface ActionItemListResponse {
  items: ActionItemResponse[]
  total: number
}

export interface ActionItemUpdate {
  description?: string
  owner_user_id?: string
  deadline?: string
  priority?: string
  status?: string
  external_task_link?: string
  external_task_id?: string
}

export interface ActionItemCreate {
  meeting_id: string
  description: string
  owner_user_id?: string
  deadline?: string
  priority?: string
}

