import { apiClient } from '@/api/client'
import type { SuccessResponse, AuthSession, UserSummary } from '@/api/types'

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

export const refreshSession = async (): Promise<AuthSession> => {
  const response = await apiClient.post<SuccessResponse<AuthSession>>('/auth/refresh', {})
  return response.data.data
}

export const getCurrentUser = async (): Promise<UserSummary> => {
  const response = await apiClient.get<SuccessResponse<UserSummary>>('/auth/me')
  return response.data.data
}

export const logoutAllSessions = async (): Promise<void> => {
  await apiClient.post('/auth/logout-all')
}
