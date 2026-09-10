import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthSession } from '@/api/types'
import { setAccessToken } from '@/api/client'
import { refreshSession } from './api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
  isAuthenticated: boolean
  status: AuthStatus
  ready: Promise<void>
  getSession: () => AuthSession | null
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

function createSessionStore() {
  let current: AuthSession | null = null
  return {
    get: () => current,
    set: (session: AuthSession | null) => { current = session },
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSessionState] = React.useState<AuthSession | null>(null)
  const [status, setStatus] = React.useState<AuthStatus>('loading')
  const [authStore] = React.useState(createSessionStore)
  const bootstrapRequest = React.useRef<Promise<AuthSession> | null>(null)
  const [ready] = React.useState(() => {
    let resolve!: () => void
    const promise = new Promise<void>((done) => { resolve = done })
    return { promise, resolve }
  })

  const setSession = React.useCallback((newSession: AuthSession | null) => {
    const previousUserId = authStore.get()?.user.id
    const nextUserId = newSession?.user.id
    if (previousUserId && previousUserId !== nextUserId) {
      queryClient.clear()
    }
    authStore.set(newSession)
    setSessionState(newSession)
    setStatus(newSession ? 'authenticated' : 'anonymous')
    if (newSession) {
      setAccessToken(newSession.accessToken)
    } else {
      setAccessToken(null)
      queryClient.clear()
    }
  }, [authStore, queryClient])

  const getSession = React.useCallback(() => authStore.get(), [authStore])

  React.useEffect(() => {
    let active = true
    bootstrapRequest.current ??= refreshSession()

    void bootstrapRequest.current
      .then((restoredSession) => {
        if (active) setSession(restoredSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => ready.resolve())

    return () => { active = false }
  }, [ready, setSession])

  React.useEffect(() => {
    const expire = () => setSession(null)
    window.addEventListener('auth:session-expired', expire)
    return () => window.removeEventListener('auth:session-expired', expire)
  }, [setSession])

  const value = React.useMemo(
    () => ({
      session,
      setSession,
      isAuthenticated: !!session,
      status,
      ready: ready.promise,
      getSession,
    }),
    [getSession, ready.promise, session, setSession, status]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
