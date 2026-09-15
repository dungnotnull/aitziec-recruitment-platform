import { apiClient } from '@/api/client';
import type { 
  Company, 
  CreateCompanyInput, 
  UpdateCompanyInput, 
  CompanyMembership, 
  CallerCompanyMembership,
  AddCompanyMemberInput,
  CompanyInvitation,
  PaginatedResponse,
  SuccessResponse,
  UploadCompanyLogoResponse,
} from '@/api/types';

export const createCompany = async (data: CreateCompanyInput): Promise<Company> => {
  const response = await apiClient.post<SuccessResponse<Company>>('/companies', data);
  return response.data.data;
};

export async function getCompany(idOrSlug: string): Promise<Company> {
  const response = await apiClient.get<SuccessResponse<Company>>(`/companies/${idOrSlug}`);
  return response.data.data;
}

export const updateCompany = async (id: string, data: UpdateCompanyInput): Promise<Company> => {
  const response = await apiClient.patch<SuccessResponse<Company>>(`/companies/${id}`, data);
  return response.data.data;
};

export const uploadCompanyLogo = async (
  companyId: string,
  file: File,
  expectedVersion?: number
): Promise<UploadCompanyLogoResponse> => {
  const formData = new FormData();
  formData.append('logo', file);
  if (expectedVersion !== undefined) {
    formData.append('expectedVersion', String(expectedVersion));
  }
  const response = await apiClient.post<SuccessResponse<UploadCompanyLogoResponse>>(
    `/companies/${companyId}/logo`,
    formData,
    {
      headers: { 'Content-Type': undefined },
    }
  );
  return response.data.data;
};

export const listMyCompanies = async (): Promise<CallerCompanyMembership[]> => {
  const response = await apiClient.get<SuccessResponse<CallerCompanyMembership[]>>(`/companies/mine`);
  return response.data.data;
};

export const listMembers = async (companyId: string, cursor?: string): Promise<PaginatedResponse<CompanyMembership>> => {
  const params = cursor ? { cursor } : {};
  // PaginatedResponse already extends SuccessResponse
  const response = await apiClient.get<PaginatedResponse<CompanyMembership>>(`/companies/${companyId}/members`, { params });
  return response.data;
};

export const addMember = async (companyId: string, data: AddCompanyMemberInput): Promise<CompanyInvitation> => {
  const response = await apiClient.post<SuccessResponse<CompanyInvitation>>(`/companies/${companyId}/members`, data);
  return response.data.data;
};

export const acceptCompanyInvitation = async (token: string): Promise<CompanyMembership> => {
  const response = await apiClient.post<SuccessResponse<CompanyMembership>>(`/company-invitations/${token}/accept`);
  return response.data.data;
};

export const removeMember = async (companyId: string, memberId: string): Promise<void> => {
  await apiClient.delete(`/companies/${companyId}/members/${memberId}`);
};

