import * as React from "react"
import { Link, Outlet, useNavigate } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/context"
import { Button } from "./button"
import { LogOut, User } from "lucide-react"
import { logoutFn } from "@/features/auth/api"

export function AppShell() {
  const { session, setSession } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logoutFn()
    setSession(null)
    navigate({ to: "/auth/login" })
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-display text-xl font-bold text-action">
              ITZiec
            </Link>
            <nav className="hidden md:flex gap-4">
              {session?.user.role === 'CANDIDATE' && (
                <Link to="/profile" className="text-sm font-medium text-slate hover:text-action">
                  My Profile
                </Link>
              )}
              {session?.user.role === 'HR' && (
                <Link to="/company" className="text-sm font-medium text-slate hover:text-action">
                  Company Dashboard
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate hidden sm:block">
              {session?.user.email}
            </div>
            <Button onClick={handleLogout} className="border border-border bg-surface text-ink hover:bg-canvas p-2 w-10 h-10">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container py-8 px-4">
        <Outlet />
      </main>
    </div>
  )
}
