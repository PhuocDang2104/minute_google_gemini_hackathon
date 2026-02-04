/**
 * Minutes Template API Client
 */
import api from '../apiClient';

export interface MinutesTemplate {
  id: string;
  name: string;
  code?: string;
  description?: string;
  structure: any; // JSONB structure
  sample_data?: any;
  meeting_types?: string[];
  is_default: boolean;
  is_active: boolean;
  version: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  parent_template_id?: string;
}

export interface MinutesTemplateList {
  templates: MinutesTemplate[];
  total: number;
}

export interface MinutesTemplateCreate {
  name: string;
  code?: string;
  description?: string;
  structure: any;
  sample_data?: any;
  meeting_types?: string[];
  is_default?: boolean;
  is_active?: boolean;
  created_by?: string;
}

export interface MinutesTemplateUpdate {
  name?: string;
  code?: string;
  description?: string;
  structure?: any;
  sample_data?: any;
  meeting_types?: string[];
  is_default?: boolean;
  is_active?: boolean;
  updated_by?: string;
}

const ENDPOINT = '/minutes-templates';

export const minutesTemplateApi = {
  /**
   * List all templates
   */
  list: async (params?: {
    meeting_type?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<MinutesTemplateList> => {
    return api.get<MinutesTemplateList>(ENDPOINT, params);
  },

  /**
   * Get default template
   */
  getDefault: async (): Promise<MinutesTemplate> => {
    return api.get<MinutesTemplate>(`${ENDPOINT}/default`);
  },

  /**
   * Get template by ID
   */
  get: async (templateId: string): Promise<MinutesTemplate> => {
    return api.get<MinutesTemplate>(`${ENDPOINT}/${templateId}`);
  },

  /**
   * Create template
   */
  create: async (data: MinutesTemplateCreate): Promise<MinutesTemplate> => {
    return api.post<MinutesTemplate>(ENDPOINT, data);
  },

  /**
   * Update template
   */
  update: async (templateId: string, data: MinutesTemplateUpdate): Promise<MinutesTemplate> => {
    return api.put<MinutesTemplate>(`${ENDPOINT}/${templateId}`, data);
  },

  /**
   * Delete template
   */
  delete: async (templateId: string): Promise<void> => {
    return api.delete<void>(`${ENDPOINT}/${templateId}`);
  },

  /**
   * Set template as default
   */
  setDefault: async (templateId: string): Promise<MinutesTemplate> => {
    return api.post<MinutesTemplate>(`${ENDPOINT}/${templateId}/set-default`, {});
  },
};

export default minutesTemplateApi;

