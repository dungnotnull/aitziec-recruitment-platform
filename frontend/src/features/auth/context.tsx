import * as React from 'react'
import type { AuthSession } from '@/api/types'
import { setAccessToken } from '@/api/client'

interface AuthContextValue {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
  isAuthenticated: boolean
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = React.useState<AuthSession | null>(null)

  const setSession = React.useCallback((newSession: AuthSession | null) => {
    setSessionState(newSession)
    if (newSession) {
      setAccessToken(newSession.accessToken)
    } else {
      setAccessToken(null)
    }
  }, [])

  const value = React.useMemo(
    () => ({
      session,
      setSession,
      isAuthenticated: !!session,
    }),
    [session, setSession]
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
