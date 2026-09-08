import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMyProfile } from "../api"
import type { CandidateProfile } from "@/api/types"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Plus, Trash2, Briefcase } from "lucide-react"

const experienceSchema = z.object({
  roles: z.array(z.object({
    id: z.string().optional(),
    company: z.string().min(1, "Company is required"),
    title: z.string().min(1, "Title is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional(),
    isCurrent: z.boolean().default(false),
  }))
})

type ExperienceValues = z.infer<typeof experienceSchema>

export function WorkExperienceEditor({ profile }: { profile?: CandidateProfile }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = React.useState(false)

  const { register, control, handleSubmit, watch, formState: { errors, isDirty }, reset } = useForm<ExperienceValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      roles: []
    }
  })

  React.useEffect(() => {
    if (profile?.experiences) {
      reset({
        roles: profile.experiences.map(exp => ({
          id: exp.id,
          company: exp.companyName,
          title: exp.title,
          startDate: exp.startDate.substring(0, 7), // map ISO to YYYY-MM
          endDate: exp.endDate ? exp.endDate.substring(0, 7) : undefined,
          isCurrent: !exp.endDate
        }))
      })
    }
  }, [profile, reset])

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles"
  })

  const mutation = useMutation({
    mutationFn: (data: ExperienceValues) => {
      if (!profile) throw new Error("Profile not loaded")
      return updateMyProfile({
        expectedVersion: profile.version,
        experiences: data.roles.map(r => ({
          id: r.id,
          companyName: r.company,
          title: r.title,
          startDate: r.startDate ? new Date(`${r.startDate}-01`).toISOString() : new Date().toISOString(),
          endDate: r.isCurrent || !r.endDate ? null : new Date(`${r.endDate}-01`).toISOString(),
        }))
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
      setIsEditing(false)
    }
  })

  const onSubmit = (data: ExperienceValues) => {
    mutation.mutate(data)
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
  }

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl">Work Experience</CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            {profile?.experiences && profile.experiences.length > 0 ? "Edit Experience" : "Add Experience"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          /* View Mode: Timeline Display */
          <div className="space-y-6 pl-4 border-l-2 border-border ml-2">
            {!profile?.experiences || profile.experiences.length === 0 ? (
              <p className="text-sm text-slate italic -ml-4">No work experience added.</p>
            ) : (
              profile.experiences.map((exp, index) => (
                <div key={exp.id || index} className="relative -ml-[25px] pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-action ring-4 ring-surface" />
                  
                  <div className="mb-1">
                    <h4 className="text-lg font-bold text-ink leading-none">{exp.title}</h4>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="font-semibold text-action">{exp.companyName}</span>
                      <span className="text-slate">•</span>
                      <span className="text-slate">
                        {formatDisplayDate(exp.startDate)} - {exp.endDate ? formatDisplayDate(exp.endDate) : "Present"}
                      </span>
                    </div>
                  </div>
                  {exp.description && (
                    <p className="text-sm text-slate mt-2 leading-relaxed whitespace-pre-wrap">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Edit Mode: Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {fields.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-border rounded-md">
                <Briefcase className="h-8 w-8 text-slate mx-auto mb-2 opacity-50" />
                <p className="text-sm text-slate mb-4">No roles added yet.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ company: "", title: "", startDate: "", isCurrent: false })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first role
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {fields.map((field, index) => {
                  const isCurrent = watch(`roles.${index}.isCurrent`)
                  return (
                    <div key={field.id} className="p-5 border border-border bg-canvas/50 rounded-lg relative space-y-5 transition-all hover:border-action/30">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-ink">Role #{index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-slate hover:text-danger hover:bg-danger/10 h-8 w-8"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-slate">Company</Label>
                          <Input {...register(`roles.${index}.company`)} placeholder="e.g. Acme Corp" disabled={mutation.isPending} className="bg-surface" />
                          {errors.roles?.[index]?.company && (
                            <p className="text-xs text-danger mt-1">{errors.roles[index].company.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-slate">Title</Label>
                          <Input {...register(`roles.${index}.title`)} placeholder="e.g. Senior Developer" disabled={mutation.isPending} className="bg-surface" />
                          {errors.roles?.[index]?.title && (
                            <p className="text-xs text-danger mt-1">{errors.roles[index].title.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-slate">Start Date</Label>
                          <Input type="month" {...register(`roles.${index}.startDate`)} disabled={mutation.isPending} className="bg-surface" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-slate">End Date</Label>
                          <Input type="month" {...register(`roles.${index}.endDate`)} disabled={isCurrent || mutation.isPending} className="bg-surface" />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-1">
                        <input type="checkbox" id={`current-${index}`} {...register(`roles.${index}.isCurrent`)} className="rounded border-border text-action focus:ring-action" disabled={mutation.isPending} />
                        <Label htmlFor={`current-${index}`} className="text-sm font-medium cursor-pointer">I currently work here</Label>
                      </div>
                    </div>
                  )
                })}

                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => append({ company: "", title: "", startDate: "", isCurrent: false })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add another role
                </Button>
              </div>
            )}
            
            {mutation.isError && (
              <div className="p-3 bg-danger/10 text-danger rounded-md text-sm border border-danger/20">
                Failed to save experiences. Please try again.
              </div>
            )}
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
              <Button type="button" variant="ghost" onClick={handleCancel} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || (fields.length > 0 && !isDirty)}>
                {mutation.isPending ? "Saving..." : "Save Experiences"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
