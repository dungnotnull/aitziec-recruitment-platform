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
import { Plus, Trash2 } from "lucide-react"

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
  const { register, control, handleSubmit, watch, formState: { errors }, reset } = useForm<ExperienceValues>({
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
    }
  })

  const onSubmit = (data: ExperienceValues) => {
    mutation.mutate(data)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Work Experience</CardTitle>
        <Button variant="outline" size="sm" onClick={() => append({ company: "", title: "", startDate: "", isCurrent: false })}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {fields.length === 0 ? (
            <p className="text-sm text-slate italic">No work experience added.</p>
          ) : (
            fields.map((field, index) => {
              const isCurrent = watch(`roles.${index}.isCurrent`)
              return (
                <div key={field.id} className="p-4 border border-border rounded-md relative space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-danger hover:bg-danger/10 p-1 h-8 w-8"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input {...register(`roles.${index}.company`)} placeholder="e.g. Acme Corp" disabled={mutation.isPending} />
                      {errors.roles?.[index]?.company && (
                        <p className="text-sm text-danger">{errors.roles[index].company.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input {...register(`roles.${index}.title`)} placeholder="e.g. Software Engineer" disabled={mutation.isPending} />
                      {errors.roles?.[index]?.title && (
                        <p className="text-sm text-danger">{errors.roles[index].title.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" {...register(`roles.${index}.startDate`)} disabled={mutation.isPending} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="month" {...register(`roles.${index}.endDate`)} disabled={isCurrent || mutation.isPending} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id={`current-${index}`} {...register(`roles.${index}.isCurrent`)} className="rounded border-border text-action focus:ring-action" disabled={mutation.isPending} />
                    <Label htmlFor={`current-${index}`}>I currently work here</Label>
                  </div>
                </div>
              )
            })
          )}
          {mutation.isError && (
            <p className="text-sm text-danger">Failed to save experiences.</p>
          )}
          {fields.length > 0 && (
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Experience"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
