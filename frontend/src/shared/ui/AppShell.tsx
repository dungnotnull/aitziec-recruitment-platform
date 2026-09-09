import * as React from "react"
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/context"
import { Button } from "./button"
import { LogOut, LayoutDashboard, User, Building2, Shield, Zap } from "lucide-react"
import { logoutFn } from "@/features/auth/api"

function NavLink({ to, children, icon: Icon }: { to: string; children: React.ReactNode; icon?: React.ElementType }) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname === to || routerState.location.pathname.startsWith(to + '/')

  return (
    <Link
      to={to}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
        ${isActive
          ? 'text-action bg-action/10 border border-action/20'
          : 'text-slate hover:text-ink hover:bg-surface-raised'
        }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {isActive && (
        <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-action/60 to-transparent" />
      )}
    </Link>
  )
}

export function AppShell() {
  const { session, setSession } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logoutFn()
    setSession(null)
    navigate({ to: "/auth/login" })
  }

  const userInitials = session?.user.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">

      {/* Enterprise Top Header */}
      <header className="sticky top-0 z-40 w-full">
        {/* Glassmorphism header */}
        <div className="relative border-b border-border/60 bg-surface/80 backdrop-blur-xl shadow-lg shadow-black/20">
          {/* Top accent line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-action/40 to-transparent" />

          <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-4 lg:px-8">

            {/* Logo + Nav */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-action to-indigo-500 shadow-lg shadow-action/30 group-hover:shadow-action/50 transition-shadow">
                  <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="font-display text-base font-bold tracking-tight">
                  <span className="text-ink">IT</span>
                  <span className="bg-gradient-to-r from-action to-indigo-400 bg-clip-text text-transparent">Ziec</span>
                </span>
              </Link>

              <div className="h-5 w-px bg-border/60 hidden md:block" />

              <nav className="hidden md:flex items-center gap-1">
                {session?.user.role === 'CANDIDATE' && (
                  <NavLink to="/profile" icon={User}>My Profile</NavLink>
                )}
                {session?.user.role === 'HR' && (
                  <NavLink to="/company" icon={Building2}>Company Dashboard</NavLink>
                )}
                {session?.user.role === 'ADMIN' && (
                  <>
                    <NavLink to="/admin" icon={Shield}>Admin</NavLink>
                    <NavLink to="/company" icon={Building2}>Companies</NavLink>
                  </>
                )}
              </nav>
            </div>

            {/* Right side: user info + logout */}
            <div className="flex items-center gap-3">
              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/60 bg-surface-raised/60 backdrop-blur-sm">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-action/70 to-indigo-500/70 text-white text-xs font-bold">
                  {userInitials}
                </div>
                <span className="text-xs font-medium text-ink-muted max-w-[160px] truncate">
                  {session?.user.email}
                </span>
                <span className="hidden lg:inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-action/10 text-action border border-action/20">
                  {session?.user.role}
                </span>
              </div>

              {/* Logout button */}
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 h-8 px-3 text-xs font-medium border border-border/60 bg-surface-raised/60 text-slate hover:text-danger hover:border-danger/30 hover:bg-danger/5 rounded-lg transition-all duration-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Sign out"}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Subtle footer glow */}
      <div className="fixed bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent pointer-events-none" />
    </div>
  )
}
