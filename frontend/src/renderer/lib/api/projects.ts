import api from '../apiClient'
import type { Project, ProjectCreate, ProjectListResponse, ProjectUpdate } from '../../shared/dto/project'
import type { ProjectMember, ProjectMemberList } from '../../shared/dto/projectMember'

const ENDPOINT = '/projects'

export const projectsApi = {
  list: async (params?: { skip?: number; limit?: number; search?: string; department_id?: string; organization_id?: string }): Promise<ProjectListResponse> => {
    return api.get<ProjectListResponse>(`${ENDPOINT}/`, params)
  },
  get: async (projectId: string): Promise<Project> => {
    return api.get<Project>(`${ENDPOINT}/${projectId}`)
  },
  create: async (data: ProjectCreate): Promise<Project> => {
    return api.post<Project>(`${ENDPOINT}/`, data)
  },
  update: async (projectId: string, data: ProjectUpdate): Promise<Project> => {
    return api.put<Project>(`${ENDPOINT}/${projectId}`, data)
  },
  delete: async (projectId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/${projectId}`)
  },
  listMembers: async (projectId: string): Promise<ProjectMemberList> => {
    return api.get<ProjectMemberList>(`${ENDPOINT}/${projectId}/members`)
  },
  addMember: async (projectId: string, data: { user_id: string; role?: string }): Promise<ProjectMember> => {
    return api.post<ProjectMember>(`${ENDPOINT}/${projectId}/members`, data)
  },
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/${projectId}/members/${userId}`)
  },
}

export default projectsApi
