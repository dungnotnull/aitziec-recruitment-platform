import * as React from "react"
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/context"
import { Button } from "./button"
import { LogOut, User, Building2, Shield, Zap, Bell, BrainCircuit, Sparkles, ScrollText, Menu, X, Search } from "lucide-react"
import { logoutFn } from "@/features/auth/api"
import { getNavigationItems } from "./navigation-items"
import { NotificationUnreadBadge } from "@/features/notifications/NotificationUnreadBadge"

const navigationIcons = {
  bell: Bell,
  user: User,
  sparkles: Sparkles,
  brain: BrainCircuit,
  building: Building2,
  shield: Shield,
  audit: ScrollText,
  search: Search,
} as const

function NavLink({ to, children, icon: Icon, onNavigate }: { to: string; children: React.ReactNode; icon?: React.ElementType; onNavigate?: () => void }) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname === to || routerState.location.pathname.startsWith(to + '/')

  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
        ${isActive
          ? 'text-action bg-action/10 border border-action/20'
          : 'text-slate hover:text-ink hover:bg-surface-raised'
        }`}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
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
  const [menuOpen, setMenuOpen] = React.useState(false)
  const mainRef = React.useRef<HTMLElement>(null)
  const routerState = useRouterState()
  const navigationItems = session ? getNavigationItems(session.user.role) : []

  React.useEffect(() => {
    mainRef.current?.focus()
  }, [routerState.location.pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutFn()
    } finally {
      setSession(null)
      navigate({ to: "/auth/login" })
    }
  }

  const userInitials = session?.user.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">

      <a href="#main-content" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-action px-4 py-3 font-semibold text-white focus:translate-y-0">
        Skip to main content
      </a>

      {/* Enterprise Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface">
        <div>
          <div className="mx-auto max-w-7xl flex h-14 items-center justify-between px-4 lg:px-8">

            {/* Logo + Nav */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-action">
                  <Zap className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <span className="font-display text-base font-bold tracking-tight">
                  <span className="text-ink">IT</span>
                  <span className="text-action">Ziec</span>
                </span>
              </Link>

              <div className="h-5 w-px bg-border/60 hidden md:block" />

              <nav className="hidden md:flex items-center gap-1">
                {navigationItems.map((item) => <NavLink key={item.href} to={item.href} icon={navigationIcons[item.icon]}>{item.label}{item.href === '/notifications' ? <NotificationUnreadBadge /> : null}</NavLink>)}
              </nav>
            </div>

            {/* Right side: user info + logout */}
            <div className="flex items-center gap-3">
              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-surface-raised">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-action text-white text-xs font-bold">
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
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Sign out"}</span>
              </Button>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action md:hidden" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}</button>
            </div>
          </div>
          <nav id="mobile-navigation" aria-label="Mobile navigation" className={`${menuOpen ? 'grid' : 'hidden'} gap-1 border-t border-border px-4 py-3 md:hidden`}>
            {navigationItems.map((item) => <NavLink key={item.href} to={item.href} icon={navigationIcons[item.icon]} onNavigate={() => setMenuOpen(false)}>{item.label}{item.href === '/notifications' ? <NotificationUnreadBadge /> : null}</NavLink>)}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 mx-auto w-full max-w-7xl px-4 lg:px-8 py-8 focus:outline-none">
        <Outlet />
      </main>
    </div>
  )
}
