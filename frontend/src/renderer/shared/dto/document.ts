import { UUID } from 'crypto'

export interface Document {
  id: UUID
  meeting_id: UUID
  title: string
  file_type: string
  file_size?: number
  description?: string
  file_url?: string
  storage_key?: string
  uploaded_by?: UUID
  uploaded_at: string
}

export interface DocumentListResponse {
  documents: Document[]
  total: number
}
