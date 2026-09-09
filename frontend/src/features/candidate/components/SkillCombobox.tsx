import * as React from "react"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { cn } from "@/shared/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMyProfile } from "../api"
import type { CandidateProfile } from "@/api/types"
import { Badge } from "@/shared/ui/badge"

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
    <div className="space-y-4">
      {/* Selected Skills */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map(s => (
            <Badge key={s} variant="outline" className="text-sm py-1.5 px-3 border-action/20 bg-action/5 text-action flex items-center gap-1.5 transition-colors hover:bg-action/10">
              {s}
              <button 
                onClick={(e) => { e.stopPropagation(); toggleSkill(s); }}
                className="hover:text-danger focus:outline-none transition-colors"
                disabled={mutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate italic">No skills added yet.</p>
      )}

      {/* Add Skill Button & Combobox */}
      <div className="relative w-full max-w-sm">
        <div 
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border bg-canvas px-3 py-2 text-sm transition-colors cursor-pointer hover:border-action/50",
            mutation.isPending && "opacity-50 cursor-not-allowed",
            open && "ring-2 ring-action/20 border-action"
          )}
          onClick={() => !mutation.isPending && setOpen(!open)}
        >
          <span className="text-slate flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add a skill
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </div>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-2 border-b border-border">
                <input 
                  type="text" 
                  autoFocus
                  className="w-full rounded-sm bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action transition-all" 
                  placeholder="Search skills..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ul className="max-h-60 overflow-auto py-1">
                {filtered.length === 0 ? (
                  <li className="p-3 text-sm text-slate text-center">No skills found.</li>
                ) : (
                  filtered.map(skill => (
                    <li 
                      key={skill}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center py-2 pl-9 pr-3 text-sm outline-none hover:bg-canvas transition-colors",
                        selected.includes(skill) ? "text-action font-medium" : "text-ink"
                      )}
                      onClick={() => toggleSkill(skill)}
                    >
                      <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
                        {selected.includes(skill) && <Check className="h-4 w-4" />}
                      </span>
                      {skill}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
