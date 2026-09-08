import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/shared/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMyProfile } from "../api"
import type { CandidateProfile } from "@/api/types"

const skillsDB = [
  "React", "TypeScript", "Node.js", "Python", "Go", "Java", "Docker", "Kubernetes", "AWS"
]

export function SkillCombobox({ profile }: { profile?: CandidateProfile }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const queryClient = useQueryClient()

  const selected = profile?.skills.map(s => s.name) || []

  const mutation = useMutation({
    mutationFn: (newSkills: string[]) => {
      if (!profile) throw new Error("Profile not loaded")
      return updateMyProfile({
        expectedVersion: profile.version,
        skills: newSkills.map(s => ({
          skillId: `skill-${s.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, // Mock generation for now
          name: s,
          yearsOfExperience: null
        }))
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    }
  })

  const filtered = skillsDB.filter(s => s.toLowerCase().includes(search.toLowerCase()))

  const toggleSkill = (skill: string) => {
    if (mutation.isPending) return;
    const newSelected = selected.includes(skill) 
      ? selected.filter(s => s !== skill) 
      : [...selected, skill]
    mutation.mutate(newSelected)
  }

  return (
    <div className="relative">
      <div 
        className={cn(
          "flex min-h-10 w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm ring-offset-canvas cursor-pointer",
          mutation.isPending && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !mutation.isPending && setOpen(!open)}
      >
        <div className="flex flex-wrap gap-1">
          {selected.length === 0 ? <span className="text-slate">Select skills...</span> : 
            selected.map(s => (
              <span key={s} className="bg-action/10 text-action px-2 py-0.5 rounded-sm text-xs font-medium">
                {s}
              </span>
            ))
          }
        </div>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-md">
          <div className="p-2">
            <input 
              type="text" 
              className="w-full rounded bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action" 
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-60 overflow-auto p-1">
            {filtered.length === 0 ? (
              <li className="p-2 text-sm text-slate text-center">No skills found.</li>
            ) : (
              filtered.map(skill => (
                <li 
                  key={skill}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-canvas hover:text-ink",
                    selected.includes(skill) && "text-action font-medium"
                  )}
                  onClick={() => toggleSkill(skill)}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {selected.includes(skill) && <Check className="h-4 w-4" />}
                  </span>
                  {skill}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
