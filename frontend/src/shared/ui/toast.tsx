import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { cn } from "./button"

export type ToastVariant = "default" | "success" | "destructive"

export interface ToastData {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  duration?: number
}

interface ToastContextType {
  toasts: ToastData[]
  toast: (props: Omit<ToastData, "id">) => string
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    ({ title, description, variant = "default", duration = 4000 }: Omit<ToastData, "id">) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, title, description, variant, duration }])
      return id
    },
    []
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <Toaster />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export function Toaster() {
  const context = React.useContext(ToastContext)
  if (!context) return null
  const { toasts, dismiss } = context

  return (
    <>
      {toasts.map(({ id, title, description, variant = "default", duration }) => (
        <ToastPrimitive.Root
          key={id}
          duration={duration}
          onOpenChange={(open) => {
            if (!open) dismiss(id)
          }}
          className={cn(
            "group pointer-events-auto relative flex w-full max-w-md items-start justify-between space-x-3 overflow-hidden rounded-2xl border p-4 shadow-xl transition-all",
            "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full",
            variant === "destructive" && "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950 dark:text-red-100",
            variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100",
            variant === "default" && "border-border bg-surface text-ink shadow-sm"
          )}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {variant === "success" && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            {variant === "destructive" && (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            {variant === "default" && (
              <Info className="h-5 w-5 text-action shrink-0 mt-0.5" />
            )}
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastPrimitive.Title className="text-sm font-bold leading-tight">{title}</ToastPrimitive.Title>}
              {description && (
                <ToastPrimitive.Description className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </ToastPrimitive.Description>
              )}
            </div>
          </div>
          <ToastPrimitive.Close className="rounded-lg p-1 text-slate-400 hover:text-ink opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-action">
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col sm:max-w-[420px] gap-2 pointer-events-none" />
    </>
  )
}
