import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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

export function WorkExperienceEditor() {
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<ExperienceValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      roles: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles"
  })

  const onSubmit = (data: ExperienceValues) => {
    console.log("Saving work experience:", data)
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
                      <Input {...register(`roles.${index}.company`)} placeholder="e.g. Acme Corp" />
                      {errors.roles?.[index]?.company && (
                        <p className="text-sm text-danger">{errors.roles[index].company.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input {...register(`roles.${index}.title`)} placeholder="e.g. Software Engineer" />
                      {errors.roles?.[index]?.title && (
                        <p className="text-sm text-danger">{errors.roles[index].title.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" {...register(`roles.${index}.startDate`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="month" {...register(`roles.${index}.endDate`)} disabled={isCurrent} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id={`current-${index}`} {...register(`roles.${index}.isCurrent`)} className="rounded border-border text-action focus:ring-action" />
                    <Label htmlFor={`current-${index}`}>I currently work here</Label>
                  </div>
                </div>
              )
            })
          )}
          {fields.length > 0 && (
            <Button type="submit">Save Experience</Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
