import { apiClient } from '@/api/client';
import type { 
  Company, 
  CreateCompanyInput, 
  UpdateCompanyInput, 
  CompanyMembership, 
  AddCompanyMemberInput,
  PaginatedResponse,
  SuccessResponse
} from '@/api/types';

export const createCompany = async (data: CreateCompanyInput): Promise<Company> => {
  const response = await apiClient.post<SuccessResponse<Company>>('/companies', data);
  return response.data.data;
};

export const getCompany = async (idOrSlug: string): Promise<Company> => {
  const response = await apiClient.get<SuccessResponse<Company>>(`/companies/${idOrSlug}`);
  return response.data.data;
};

export const updateCompany = async (id: string, data: UpdateCompanyInput): Promise<Company> => {
  const response = await apiClient.patch<SuccessResponse<Company>>(`/companies/${id}`, data);
  return response.data.data;
};

export const listMembers = async (companyId: string, cursor?: string): Promise<PaginatedResponse<CompanyMembership[]>> => {
  const params = cursor ? { cursor } : {};
  // PaginatedResponse already extends SuccessResponse
  const response = await apiClient.get<PaginatedResponse<CompanyMembership[]>>(`/companies/${companyId}/members`, { params });
  return response.data;
};

export const addMember = async (companyId: string, data: AddCompanyMemberInput): Promise<CompanyMembership> => {
  const response = await apiClient.post<SuccessResponse<CompanyMembership>>(`/companies/${companyId}/members`, data);
  return response.data.data;
};

export const removeMember = async (companyId: string, memberId: string): Promise<void> => {
  await apiClient.delete(`/companies/${companyId}/members/${memberId}`);
};
