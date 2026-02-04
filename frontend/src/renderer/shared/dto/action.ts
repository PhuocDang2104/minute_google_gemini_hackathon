export type ActionItem = {
  id: string
  task: string
  owner: string
  dueDate?: string
  status?: 'open' | 'in_progress' | 'done'
}