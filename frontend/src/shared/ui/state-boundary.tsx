import * as React from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "./alert"
import { Button } from "./button"

interface StateBoundaryProps {
  isLoading: boolean
  isError: boolean
  error?: any
  onRetry?: () => void
  children: React.ReactNode
  loadingMessage?: string
}

export function StateBoundary({ 
  isLoading, 
  isError, 
  error, 
  onRetry, 
  children, 
  loadingMessage = "Loading..." 
}: StateBoundaryProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-action" />
        <p className="text-sm text-slate">{loadingMessage}</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Data</AlertTitle>
        <AlertDescription className="mt-2">
          {error?.message || "An unexpected error occurred while communicating with the server."}
          {onRetry && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}
