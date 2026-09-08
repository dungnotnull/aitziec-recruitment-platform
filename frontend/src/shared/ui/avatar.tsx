import * as React from "react"
import { cn } from "./button"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  fallback?: string
  src?: string
  alt?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, fallback, src, alt, size = "md", ...props }, ref) => {
    const [imgFailed, setImgFailed] = React.useState(false)

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-canvas items-center justify-center font-semibold text-slate",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src && !imgFailed ? (
          <img
            src={src}
            alt={alt || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="uppercase">{fallback?.substring(0, 2) || "?"}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"
