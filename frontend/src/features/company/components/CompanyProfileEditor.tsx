import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createCompany, updateCompany } from "../api"
import type { Company } from "@/api/types"

const companySchema = z.object({
  name: z.string().min(2, "Company name is required"),
  slug: z.string().min(2, "Slug is required for new companies").optional(),
  description: z.string().optional().nullable(),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")).nullable(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")).nullable(),
  location: z.string().optional().nullable(),
})

type CompanyValues = z.infer<typeof companySchema>

interface CompanyProfileEditorProps {
  company?: Company
}

export function CompanyProfileEditor({ company }: CompanyProfileEditorProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!company

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name || "",
      slug: company?.slug || "",
      description: company?.description || "",
      websiteUrl: company?.websiteUrl || "",
      logoUrl: company?.logoUrl || "",
      location: company?.location || "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: CompanyValues) => {
      if (isEditing) {
        return updateCompany(company.id, {
          expectedVersion: company.version,
          ...data,
          websiteUrl: data.websiteUrl || null,
          logoUrl: data.logoUrl || null,
        })
      } else {
        return createCompany({
          ...data,
          slug: data.slug!,
          websiteUrl: data.websiteUrl || null,
          logoUrl: data.logoUrl || null,
        })
      }
    },
    onSuccess: (savedCompany) => {
      queryClient.setQueryData(['company', savedCompany.id], savedCompany)
      navigate({ to: '/company', search: { companyId: savedCompany.id } })
    },
    onError: (error: any) => {
      setError("root", { type: "server", message: error.response?.data?.error?.message || "Failed to save company profile" })
    }
  })

  const onSubmit = (data: CompanyValues) => {
    mutation.mutate(data)
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-ink">
          {isEditing ? "Edit Company Profile" : "Create Company Profile"}
        </h2>
        <p className="text-slate">
          {isEditing
            ? "Update your organization's details and public presence."
            : "Set up your organization to start posting jobs."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-surface p-6 rounded-lg border border-border shadow-sm">
        {errors.root && (
          <div className="p-3 text-sm rounded bg-danger/10 text-danger border border-danger/20">
            {errors.root.message}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name <span className="text-danger">*</span></Label>
              <Input id="name" {...register("name")} placeholder="Acme Inc." />
              {errors.name && (
                <p className="text-sm text-danger">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Company Slug {isEditing ? "(Read Only)" : <span className="text-danger">*</span>}</Label>
              <Input
                id="slug"
                {...register("slug")}
                placeholder="acme-inc"
                disabled={isEditing}
                className={isEditing ? "bg-slate/10 opacity-70" : ""}
              />
              {errors.slug && (
                <p className="text-sm text-danger">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              {...register("description")}
              className="flex min-h-[100px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              placeholder="Tell us about your company..."
            />
            {errors.description && (
              <p className="text-sm text-danger">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Headquarters Location</Label>
            <Input id="location" {...register("location")} placeholder="San Francisco, CA" />
            {errors.location && (
              <p className="text-sm text-danger">{errors.location.message}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input id="websiteUrl" type="url" {...register("websiteUrl")} placeholder="https://example.com" />
              {errors.websiteUrl && (
                <p className="text-sm text-danger">{errors.websiteUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" type="url" {...register("logoUrl")} placeholder="https://example.com/logo.png" />
              {errors.logoUrl && (
                <p className="text-sm text-danger">{errors.logoUrl.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/company', search: { companyId: company?.id } })}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </form>
    </div>
  )
}
