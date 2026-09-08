import { apiClient } from '@/api/client'
import type { SuccessResponse, AuthSession } from '@/api/types'

export const loginFn = async (data: any): Promise<AuthSession> => {
  const response = await apiClient.post<SuccessResponse<AuthSession>>('/auth/login', data)
  return response.data.data
}

export const registerFn = async (data: any): Promise<AuthSession> => {
  const response = await apiClient.post<SuccessResponse<AuthSession>>('/auth/register', data)
  return response.data.data
}

export const logoutFn = async (): Promise<void> => {
  await apiClient.post('/auth/logout')
}
