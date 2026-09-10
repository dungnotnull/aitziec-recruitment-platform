import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CandidateProfile } from "@/api/types"
import { updateMyProfile } from "../api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Label } from "@/shared/ui/label"
import { Eye, EyeOff } from "lucide-react"
import { getApiErrorDetails } from "@/shared/lib/api-error"

export function ProfileVisibilityControl({ profile }: { profile: CandidateProfile }) {
  const queryClient = useQueryClient()
  const [optimisticValue, setOptimisticValue] = React.useState<boolean | null>(null)
  const isPublic = optimisticValue ?? profile.isSearchable

  const handleToggle = () => {
    const nextValue = !isPublic
    setOptimisticValue(nextValue)
    mutation.mutate(nextValue)
  }

  const mutation = useMutation({
    mutationFn: (isSearchable: boolean) => updateMyProfile({
      expectedVersion: profile.version,
      isSearchable,
    }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['candidate-profile'], updatedProfile)
      setOptimisticValue(updatedProfile.isSearchable)
    },
    onError: () => setOptimisticValue(null),
  })

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
            type="button"
            role="switch"
            aria-label="Profile visibility"
            aria-checked={isPublic}
            onClick={handleToggle}
            disabled={mutation.isPending}
            className={`relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-wait disabled:opacity-60 ${isPublic ? 'bg-action' : 'bg-slate'}`}
          >
            <span className={`pointer-events-none block h-6 w-6 rounded-full bg-surface shadow-md ring-0 transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0'}`} />
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
          {mutation.isError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {getApiErrorDetails(mutation.error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
