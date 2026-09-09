import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Label } from "@/shared/ui/label"
import { Eye, EyeOff } from "lucide-react"

export function ProfileVisibilityControl() {
  const { session } = useAuth()
  const [isPublic, setIsPublic] = React.useState(true)

  if (!session) return null

  const handleToggle = () => {
    setIsPublic(!isPublic)
    // mock save
  }

  return (
    <Card className={`border-border shadow-sm transition-all duration-300 ${isPublic ? 'bg-surface' : 'bg-canvas'}`}>
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              {isPublic ? <Eye className="h-5 w-5 text-action" /> : <EyeOff className="h-5 w-5 text-slate" />}
              Profile Visibility
            </CardTitle>
            <CardDescription className="mt-1">Manage who can see your profile</CardDescription>
          </div>
          <button 
            role="switch"
            aria-checked={isPublic}
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${isPublic ? 'bg-action' : 'bg-slate'}`}
          >
            <span className={`pointer-events-none block h-6 w-6 rounded-full bg-surface shadow-md ring-0 transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div>
          <Label className="text-base font-semibold text-ink">
            {isPublic ? "Visible to Employers" : "Hidden from Employers"}
          </Label>
          <p className="text-sm text-slate mt-1.5 leading-relaxed">
            {isPublic 
              ? "Your profile is active and can be discovered by verified recruiters. You're open to receiving direct job opportunities." 
              : "Your profile is completely hidden. You can still apply to jobs manually, but recruiters cannot find you in their searches."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
