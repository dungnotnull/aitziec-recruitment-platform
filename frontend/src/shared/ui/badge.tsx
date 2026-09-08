import * as React from "react"
import { cn } from "./button"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2",
        {
          "border-transparent bg-ink text-surface hover:bg-ink/80": variant === "default",
          "border-transparent bg-slate text-surface hover:bg-slate/80": variant === "secondary",
          "border-transparent bg-danger text-surface hover:bg-danger/80": variant === "destructive",
          "border-transparent bg-green-600 text-surface hover:bg-green-600/80": variant === "success",
          "text-ink": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
