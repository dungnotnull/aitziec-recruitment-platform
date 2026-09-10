import { X } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMyProfile } from "../api"
import type { CandidateProfile } from "@/api/types"
import { Badge } from "@/shared/ui/badge"

export function SkillCombobox({ profile }: { profile?: CandidateProfile }) {
  const queryClient = useQueryClient()
  const skills = profile?.skills ?? []

  const mutation = useMutation({
    mutationFn: (removedSkillId: string) => {
      if (!profile) throw new Error("Profile not loaded")
      return updateMyProfile({
        expectedVersion: profile.version,
        skills: profile.skills
          .filter((skill) => skill.skillId !== removedSkillId)
          .map((skill) => ({
            skillId: skill.skillId,
            yearsOfExperience: skill.yearsOfExperience,
          })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    }
  })

  return (
    <div className="space-y-4">
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <Badge key={skill.skillId} variant="outline" className="flex items-center gap-1.5 border-action/20 bg-action/5 px-3 py-1.5 text-sm text-action">
              {skill.name}
              <button
                type="button"
                aria-label={`Remove ${skill.name}`}
                onClick={() => mutation.mutate(skill.skillId)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-sm hover:text-danger focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action"
                disabled={mutation.isPending}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate italic">No skills added yet.</p>
      )}

      <p className="rounded-md border border-border bg-surface-raised p-3 text-sm text-ink-muted">
        Adding skills is unavailable because a skill catalog is not exposed by the backend. Existing profile skills above come directly from the API.
      </p>
    </div>
  )
}
