import { http, HttpResponse, delay } from 'msw'
import type { SuccessResponse, AuthSession } from '../types'

// Mock database
let users = [
  {
    id: 'user-1',
    email: 'test@example.com',
    role: 'CANDIDATE' as const,
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString(),
  }
];

export const handlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    await delay(800)
    const body = await request.json() as any;

    if (body.email === 'test@example.com' && body.password === 'password123') {
      const response: SuccessResponse<AuthSession> = {
        data: {
          accessToken: 'mock.access.token',
          accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          user: users[0],
        },
      }
      return HttpResponse.json(response)
    }

    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          requestId: 'mock-req-id',
          timestamp: new Date().toISOString()
        }
      },
      { status: 401 }
    )
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    await delay(1000)
    const body = await request.json() as any;

    const exists = users.find(u => u.email === body.email)
    if (exists) {
      return HttpResponse.json(
        {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email already exists',
            requestId: 'mock-req-id',
            timestamp: new Date().toISOString()
          }
        },
        { status: 409 }
      )
    }

    const newUser = {
      id: `user-${Date.now()}`,
      email: body.email,
      role: body.role || 'CANDIDATE',
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    const response: SuccessResponse<AuthSession> = {
      data: {
        accessToken: 'mock.access.token',
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: newUser,
      },
    }

    return HttpResponse.json(response, { status: 201 })
  }),
]
