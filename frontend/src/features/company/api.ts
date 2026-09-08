import { apiClient } from '@/api/client';
import type { 
  Company, 
  CreateCompanyInput, 
  UpdateCompanyInput, 
  CompanyMembership, 
  AddCompanyMemberInput,
  PaginatedResponse 
} from '@/api/types';

export const createCompany = async (data: CreateCompanyInput): Promise<Company> => {
  const response = await apiClient.post<Company>('/companies', data);
  return response.data;
};

export const getCompany = async (idOrSlug: string): Promise<Company> => {
  const response = await apiClient.get<Company>(`/companies/${idOrSlug}`);
  return response.data;
};

export const updateCompany = async (id: string, data: UpdateCompanyInput): Promise<Company> => {
  const response = await apiClient.patch<Company>(`/companies/${id}`, data);
  return response.data;
};

export const listMembers = async (companyId: string, cursor?: string): Promise<PaginatedResponse<CompanyMembership[]>> => {
  const params = cursor ? { cursor } : {};
  const response = await apiClient.get<PaginatedResponse<CompanyMembership[]>>(`/companies/${companyId}/members`, { params });
  return response.data;
};

export const addMember = async (companyId: string, data: AddCompanyMemberInput): Promise<CompanyMembership> => {
  const response = await apiClient.post<CompanyMembership>(`/companies/${companyId}/members`, data);
  return response.data;
};

export const removeMember = async (companyId: string, memberId: string): Promise<void> => {
  await apiClient.delete(`/companies/${companyId}/members/${memberId}`);
};
