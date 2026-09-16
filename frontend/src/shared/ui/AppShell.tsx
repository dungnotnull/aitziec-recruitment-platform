import * as React from "react"
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/context"
import { Button } from "./button"
import {
  LogOut,
  User,
  Building2,
  Shield,
  Zap,
  Bell,
  BrainCircuit,
  Sparkles,
  ScrollText,
  Menu,
  X,
  Search,
  Briefcase,
  ChevronDown,
} from "lucide-react"
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

function NavLink({
  to,
  children,
  icon: Icon,
  onNavigate,
  badge,
}: {
  to: any
  children: React.ReactNode
  icon?: React.ElementType
  onNavigate?: () => void
  badge?: React.ReactNode
}) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname === to || (to !== '/' && routerState.location.pathname.startsWith(to + '/'))

  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`relative inline-flex items-center gap-2 h-16 px-3.5 lg:px-4 text-sm font-medium transition-all duration-150 whitespace-nowrap shrink-0 border-b-2
        ${isActive
          ? 'text-white border-[#EA1E30] font-semibold bg-white/[0.04]'
          : 'text-zinc-300 border-transparent hover:text-white hover:border-zinc-500 hover:bg-white/[0.02]'
        }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-white" aria-hidden="true" />}
      <span className="whitespace-nowrap select-none">{children}</span>
      {badge}
    </Link>
  )
}

export function AppShell() {
  const { session, setSession } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false)
  const userDropdownRef = React.useRef<HTMLDivElement>(null)
  const mainRef = React.useRef<HTMLElement>(null)
  const routerState = useRouterState()
  const navigationItems = session ? getNavigationItems(session.user.role) : []
  const isHomePage = routerState.location.pathname === '/'

  React.useEffect(() => {
    mainRef.current?.focus()
  }, [routerState.location.pathname])

  // Close user dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutFn()
    } finally {
      setSession(null)
      navigate({ to: "/" })
    }
  }

  const userInitials = session?.user.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans">
      <a href="#main-content" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-[#EA1E30] px-4 py-3 font-semibold text-white focus:translate-y-0 transition-transform">
        Skip to main content
      </a>

      {/* ITviec-style Dark Sleek Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#121212] text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4 flex-nowrap">

            {/* Left: Brand Logo + Primary Navigation */}
            <div className="flex items-center gap-6 lg:gap-8 flex-nowrap shrink-0 min-w-0">
              <Link to="/" className="flex items-center gap-2.5 group shrink-0 whitespace-nowrap">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EA1E30] shadow-sm group-hover:scale-105 transition-transform shrink-0">
                  <Zap className="h-5 w-5 text-white fill-white shrink-0" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div className="flex items-baseline whitespace-nowrap shrink-0">
                  <span className="font-display text-xl font-black tracking-tight text-white">IT</span>
                  <span className="font-display text-xl font-black tracking-tight text-[#EA1E30]">Ziec</span>
                  <span className="ml-1.5 hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Jobs</span>
                </div>
              </Link>

              <div className="h-6 w-px bg-zinc-800 hidden md:block shrink-0" />

              {/* Desktop Nav Items - Strictly single line tab navigation */}
              <nav className="hidden md:flex items-center gap-1 flex-nowrap shrink-0 overflow-x-auto no-scrollbar">
                <NavLink to="/jobs" icon={Search}>Việc Làm IT</NavLink>
                <NavLink to="/companies" icon={Building2}>Công Ty IT</NavLink>
                {session && navigationItems
                  .filter(item => item.href !== '/jobs' && item.href !== '/notifications' && item.href !== '/profile')
                  .map((item) => (
                    <NavLink key={item.href} to={item.href} icon={navigationIcons[item.icon]}>
                      {item.label}
                    </NavLink>
                  ))
                }
              </nav>
            </div>

            {/* Right: Guest actions or Authenticated Profile */}
            <div className="flex items-center gap-2 lg:gap-3 flex-nowrap shrink-0">
              {!session ? (
                // Guest state: Login / Register / Employer buttons
                <div className="hidden sm:flex items-center gap-2 lg:gap-3 flex-nowrap shrink-0">
                  <Link
                    to="/auth/register"
                    className="flex items-center gap-1.5 text-xs lg:text-sm font-medium text-zinc-300 hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-800/80 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Briefcase className="h-4 w-4 text-[#EA1E30] shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">Dành cho Nhà tuyển dụng</span>
                  </Link>
                  <Link
                    to="/auth/login"
                    className="text-xs lg:text-sm font-semibold text-white hover:text-zinc-200 px-3.5 lg:px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-900 transition-all whitespace-nowrap shrink-0"
                  >
                    <span className="whitespace-nowrap">Đăng nhập</span>
                  </Link>
                  <Link
                    to="/auth/register"
                    className="text-xs lg:text-sm font-semibold text-white px-3.5 lg:px-4 py-2 rounded-lg bg-[#EA1E30] hover:bg-[#D01223] active:bg-[#B70F1E] shadow-sm shadow-red-950/40 transition-all whitespace-nowrap shrink-0"
                  >
                    <span className="whitespace-nowrap">Đăng ký</span>
                  </Link>
                </div>
              ) : (
                // Authenticated user state
                <div className="flex items-center gap-2 lg:gap-3 flex-nowrap shrink-0">
                  <Link
                    to="/notifications"
                    className="relative p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                    aria-label="Xem thông báo"
                    title="Thông báo"
                  >
                    <Bell className="h-5 w-5 shrink-0" />
                    <NotificationUnreadBadge />
                  </Link>

                  {/* User Profile Menu Dropdown */}
                  <div className="relative" ref={userDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setUserDropdownOpen(prev => !prev)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left whitespace-nowrap shrink-0"
                      aria-expanded={userDropdownOpen}
                      aria-haspopup="true"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EA1E30] text-white text-xs font-bold shrink-0">
                        {userInitials}
                      </div>
                      <div className="hidden sm:flex flex-col min-w-0">
                        <span className="text-xs font-medium text-zinc-200 max-w-[120px] lg:max-w-[160px] truncate whitespace-nowrap">
                          {session.user.email}
                        </span>
                        <span className="text-[10px] font-bold text-[#EA1E30] uppercase tracking-wider whitespace-nowrap">
                          {session.user.role}
                        </span>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform shrink-0 ${userDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Card */}
                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-60 rounded-xl border border-zinc-800 bg-[#1A1A1A] shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                          <p className="text-xs font-semibold text-white truncate">{session.user.email}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 text-[#EA1E30] border border-red-800/40 uppercase">
                            {session.user.role}
                          </span>
                        </div>

                        <Link
                          to="/profile"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <User className="h-4 w-4 text-zinc-400 shrink-0" />
                          <span className="whitespace-nowrap">Hồ sơ cá nhân</span>
                        </Link>

                        {session.user.role === 'CANDIDATE' && (
                          <>
                            <Link
                              to="/candidate/recommendations"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Sparkles className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="whitespace-nowrap">Gợi ý việc làm</span>
                            </Link>
                            <Link
                              to="/candidate/ai"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <BrainCircuit className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="whitespace-nowrap">Phân tích CV</span>
                            </Link>
                          </>
                        )}

                        {session.user.role === 'HR' && (
                          <Link
                            to="/company"
                            search={{ companyId: undefined }}
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
                            <span className="whitespace-nowrap">Quản lý công ty</span>
                          </Link>
                        )}

                        {session.user.role === 'ADMIN' && (
                          <>
                            <Link
                              to="/admin"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Shield className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="whitespace-nowrap">Quản trị hệ thống</span>
                            </Link>
                            <Link
                              to="/admin/audit"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <ScrollText className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="whitespace-nowrap">Nhật ký hệ thống</span>
                            </Link>
                          </>
                        )}

                        <div className="my-1 border-t border-zinc-800/80" />

                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false)
                            handleLogout()
                          }}
                          disabled={loggingOut}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors text-left whitespace-nowrap"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          <span className="whitespace-nowrap">{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Sign out button */}
                  <Button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="hidden lg:flex items-center gap-2 h-9 px-3 text-xs font-medium border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 rounded-lg transition-all whitespace-nowrap shrink-0"
                    title="Đăng xuất"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{loggingOut ? "Đang thoát…" : "Đăng xuất"}</span>
                  </Button>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 md:hidden shrink-0"
                aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X className="h-5 w-5 shrink-0" aria-hidden="true" /> : <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className={`${menuOpen ? 'grid' : 'hidden'} gap-1 border-t border-zinc-800 py-4 md:hidden`}
          >
            <Link
              to="/jobs"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Search className="h-4 w-4 text-[#EA1E30] shrink-0" />
              <span className="whitespace-nowrap">Việc Làm IT</span>
            </Link>
            <Link
              to="/companies"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Building2 className="h-4 w-4 text-[#EA1E30] shrink-0" />
              <span className="whitespace-nowrap">Công Ty IT</span>
            </Link>

            {session ? (
              <>
                <div className="my-2 border-t border-zinc-800 pt-2 px-3">
                  <p className="text-xs font-semibold text-zinc-400 truncate">Tài khoản: {session.user.email}</p>
                </div>
                {navigationItems
                  .filter(item => item.href !== '/jobs')
                  .map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <span className="flex items-center gap-3">
                        {React.createElement(navigationIcons[item.icon], { className: "h-4 w-4 text-zinc-400 shrink-0" })}
                        <span className="whitespace-nowrap">{item.label}</span>
                      </span>
                      {item.href === '/notifications' ? <NotificationUnreadBadge variant="inline" /> : null}
                    </Link>
                  ))}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    handleLogout()
                  }}
                  disabled={loggingOut}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/20 rounded-lg transition-colors mt-2 text-left whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
                </button>
              </>
            ) : (
              <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2 mt-2">
                <Link
                  to="/auth/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-300 hover:text-white whitespace-nowrap"
                >
                  <Briefcase className="h-4 w-4 text-[#EA1E30] shrink-0" />
                  <span className="whitespace-nowrap">Dành cho Nhà tuyển dụng</span>
                </Link>
                <Link
                  to="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-semibold text-white whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">Đăng nhập</span>
                </Link>
                <Link
                  to="/auth/register"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg bg-[#EA1E30] hover:bg-[#D01223] text-sm font-semibold text-white whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">Đăng ký</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`flex-1 w-full focus:outline-none ${isHomePage ? '' : 'mx-auto max-w-7xl px-4 lg:px-8 py-8'}`}
      >
        <Outlet />
      </main>

      {/* ITviec-style Comprehensive Footer */}
      <footer className="border-t border-zinc-800 bg-[#121212] text-zinc-400 text-sm mt-auto">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            
            {/* Column 1: Brand & Bio */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EA1E30]">
                  <Zap className="h-4 w-4 text-white fill-white" />
                </div>
                <span className="font-display text-lg font-black tracking-tight text-white">
                  IT<span className="text-[#EA1E30]">Ziec</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Nền tảng tuyển dụng việc làm IT hàng đầu cho Developer Chất. Kết nối nhân tài công nghệ với những công ty IT hàng đầu tại Việt Nam và toàn cầu.
              </p>
              <div className="text-xs text-zinc-500 space-y-1">
                <p>📍 Ho Chi Minh City • Ha Noi • Da Nang</p>
                <p>✉️ support@itziec.com</p>
                <p>📞 (+84) 28 1234 5678</p>
              </div>
            </div>

            {/* Column 2: Hot IT Jobs */}
            <div>
              <h4 className="font-display font-semibold text-white text-sm mb-4 tracking-wide uppercase">
                Hot IT Jobs
              </h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/jobs" search={{ q: 'React' }} className="hover:text-white transition-colors">ReactJS Developer Jobs</Link></li>
                <li><Link to="/jobs" search={{ q: 'NodeJS' }} className="hover:text-white transition-colors">Node.js Developer Jobs</Link></li>
                <li><Link to="/jobs" search={{ q: 'Java' }} className="hover:text-white transition-colors">Java Software Engineer</Link></li>
                <li><Link to="/jobs" search={{ q: 'Python' }} className="hover:text-white transition-colors">Python / AI Engineer Jobs</Link></li>
                <li><Link to="/jobs" search={{ q: 'Golang' }} className="hover:text-white transition-colors">Golang Backend Jobs</Link></li>
                <li><Link to="/jobs" search={{ q: 'DevOps' }} className="hover:text-white transition-colors">DevOps & Cloud Engineer</Link></li>
                <li><Link to="/jobs" search={{ q: 'QA' }} className="hover:text-white transition-colors">Software QA / QC Tester</Link></li>
              </ul>
            </div>

            {/* Column 3: Jobs by Location */}
            <div>
              <h4 className="font-display font-semibold text-white text-sm mb-4 tracking-wide uppercase">
                Jobs by City
              </h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/jobs" search={{ location: ['Ho Chi Minh'] }} className="hover:text-white transition-colors">IT Jobs in Ho Chi Minh City</Link></li>
                <li><Link to="/jobs" search={{ location: ['Ha Noi'] }} className="hover:text-white transition-colors">IT Jobs in Ha Noi</Link></li>
                <li><Link to="/jobs" search={{ location: ['Da Nang'] }} className="hover:text-white transition-colors">IT Jobs in Da Nang</Link></li>
                <li><Link to="/jobs" search={{ workplaceType: ['REMOTE'] }} className="hover:text-white transition-colors">Remote IT Developer Jobs</Link></li>
                <li><Link to="/jobs" search={{ workplaceType: ['HYBRID'] }} className="hover:text-white transition-colors">Hybrid Work IT Jobs</Link></li>
              </ul>
            </div>

            {/* Column 4: About & Employers */}
            <div>
              <h4 className="font-display font-semibold text-white text-sm mb-4 tracking-wide uppercase">
                For Employers & Candidates
              </h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/companies" className="hover:text-white transition-colors">Top IT Employers in Vietnam</Link></li>
                <li><Link to="/auth/register" className="hover:text-white transition-colors">Post a Job / For Recruiters</Link></li>
                <li><Link to="/auth/login" className="hover:text-white transition-colors">Candidate Account Login</Link></li>
                <li><span className="text-zinc-500">AI CV Match & Insights</span></li>
                <li><span className="text-zinc-500">Vietnam IT Salary Report</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} ITZiec. All rights reserved. IT Jobs For Top Developers.</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-zinc-400 cursor-pointer">Privacy Policy</span>
              <span className="hover:text-zinc-400 cursor-pointer">Terms of Service</span>
              <span className="hover:text-zinc-400 cursor-pointer">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
