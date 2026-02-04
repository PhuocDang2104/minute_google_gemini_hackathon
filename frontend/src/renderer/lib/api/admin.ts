import api from '../apiClient'
import { User, UserListResponse } from '../../shared/dto/user'
import { Document, DocumentListResponse } from '../../shared/dto/document'
import { Meeting, MeetingUpdate, MeetingWithParticipants } from '../../shared/dto/meeting'
import { ActionItemListResponse, ActionItemResponse, ActionItemUpdate } from '../../shared/dto/actionItem'
import { RegisterResponse } from './auth'
import { Project, ProjectListResponse } from '../../shared/dto/project'

// Users
export const adminListUsers = (params?: { skip?: number; limit?: number; search?: string; department_id?: string }) =>
  api.get<UserListResponse>('/admin/users', params)

export const adminGetUser = (userId: string) =>
  api.get<User>(`/admin/users/${userId}`)

export const adminUpdateUserRole = (userId: string, role: string) =>
  api.patch<User>(`/admin/users/${userId}/role`, { role })

export const adminUpdateUserStatus = (userId: string, is_active: boolean) =>
  api.patch<User>(`/admin/users/${userId}/status`, { is_active })

export const adminCreateUser = (data: { email: string; password: string; display_name: string; role?: string; department_id?: string; organization_id?: string }) =>
  api.post<RegisterResponse>('/admin/users', data)

// Documents (mock)
export const adminListDocuments = (params?: { meeting_id?: string; skip?: number; limit?: number }) =>
  api.get<DocumentListResponse>('/admin/documents', params)

export const adminUpdateDocument = (documentId: string, data: Partial<Pick<Document, 'title' | 'description'>>) =>
  api.patch<Document>(`/admin/documents/${documentId}`, data)

export const adminDeleteDocument = (documentId: string) =>
  api.delete<void>(`/admin/documents/${documentId}`)

// Meetings
export const adminListMeetings = (params?: { skip?: number; limit?: number; phase?: string; meeting_type?: string; project_id?: string }) =>
  api.get<Meeting[]>('/admin/meetings', params)

export const adminGetMeeting = (meetingId: string) =>
  api.get<MeetingWithParticipants>(`/admin/meetings/${meetingId}`)

export const adminUpdateMeeting = (meetingId: string, data: MeetingUpdate) =>
  api.patch<Meeting>(`/admin/meetings/${meetingId}`, data)

export const adminDeleteMeeting = (meetingId: string) =>
  api.delete<void>(`/admin/meetings/${meetingId}`)

// Action Items
export const adminListActionItems = (params?: { status?: string; priority?: string; owner_user_id?: string; overdue_only?: boolean }) =>
  api.get<ActionItemListResponse>('/admin/action-items', params)

export const adminGetActionItem = (itemId: string) =>
  api.get<ActionItemResponse>(`/admin/action-items/${itemId}`)

export const adminUpdateActionItem = (itemId: string, data: ActionItemUpdate) =>
  api.patch<ActionItemResponse>(`/admin/action-items/${itemId}`, data)

export const adminDeleteActionItem = (itemId: string) =>
  api.delete<void>(`/admin/action-items/${itemId}`)

// Projects
export const adminListProjects = (params?: { skip?: number; limit?: number; search?: string; department_id?: string; organization_id?: string }) =>
  api.get<ProjectListResponse>('/projects/', params)

export const adminCreateProject = (data: { name: string; code?: string; description?: string; organization_id?: string; department_id?: string }) =>
  api.post<Project>('/projects/', data)
