import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Label } from "@/shared/ui/label"

export function ProfileVisibilityControl() {
  const { session } = useAuth()
  const [isPublic, setIsPublic] = React.useState(true)

  if (!session) return null

  const handleToggle = () => {
    setIsPublic(!isPublic)
    // mock save
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Visibility</CardTitle>
        <CardDescription>Control who can see your profile on the platform.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <button 
            role="switch"
            aria-checked={isPublic}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${isPublic ? 'bg-action' : 'bg-slate'}`}
          >
            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-lg ring-0 transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <div>
            <Label className="text-base font-medium">Make my profile visible to recruiters</Label>
            <p className="text-sm text-slate mt-1">
              {isPublic 
                ? "Your profile is searchable by verified companies. You may receive direct messages." 
                : "Your profile is hidden. You can still apply to jobs, but recruiters cannot find you."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
