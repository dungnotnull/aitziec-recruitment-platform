import * as React from "react"
import { cn } from "./button"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const isFile = type === "file"
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm ring-offset-canvas placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isFile
            ? "cursor-pointer p-1.5 text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface-raised file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink file:shadow-xs file:transition-all hover:file:border-action-border hover:file:bg-surface hover:file:text-action active:file:scale-95"
            : "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
