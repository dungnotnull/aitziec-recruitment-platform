import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const variantClasses = {
  default: 'bg-action text-surface hover:bg-action-hover',
  outline: 'border border-border bg-transparent text-ink hover:bg-surface-raised',
  secondary: 'bg-surface-raised text-ink hover:bg-border',
  ghost: 'bg-transparent text-ink hover:bg-surface-raised',
  destructive: 'bg-danger text-white hover:bg-danger/90',
} as const

const sizeClasses = {
  default: 'h-11 px-4 py-2',
  sm: 'h-11 px-3 py-2 text-sm',
  lg: 'h-12 px-6 py-3',
  icon: 'h-11 w-11 p-0',
} as const

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, variant = 'default', size = 'default', ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(
          "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
