import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateMyProfile } from "../api"
import type { CandidateProfile } from "@/api/types"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Pencil } from "lucide-react"

const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
})

type ProfileValues = z.infer<typeof profileSchema>

export function ProfileEditor({ profile, trigger }: { profile?: CandidateProfile, trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.fullName || "",
      phone: profile?.phone || "",
      location: profile?.location || "",
      headline: profile?.headline || "",
      bio: profile?.bio || "",
    }
  })

  React.useEffect(() => {
    if (profile && open) {
      reset({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        location: profile.location || "",
        headline: profile.headline || "",
        bio: profile.bio || "",
      })
    }
  }, [profile, reset, open])

  const mutation = useMutation({
    mutationFn: (data: ProfileValues) => {
      if (!profile) throw new Error("Profile not loaded")
      return updateMyProfile({
        expectedVersion: profile.version,
        fullName: data.fullName,
        phone: data.phone || null,
        location: data.location || null,
        headline: data.headline || null,
        bio: data.bio || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
      setOpen(false)
    }
  })

  const onSubmit = (data: ProfileValues) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" {...register("fullName")} disabled={mutation.isPending} />
            {errors.fullName && <p className="text-sm text-danger">{errors.fullName.message}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register("phone")} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="e.g. Ho Chi Minh City" {...register("location")} disabled={mutation.isPending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Professional Headline</Label>
            <Input id="headline" placeholder="e.g. Senior Frontend Engineer" {...register("headline")} disabled={mutation.isPending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">About Me (Bio)</Label>
            <textarea 
              id="bio" 
              className="flex min-h-[120px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tell employers about your background and career goals..." 
              {...register("bio")} 
              disabled={mutation.isPending} 
            />
          </div>

          {mutation.isError && (
            <div className="p-3 bg-danger/10 text-danger rounded-md text-sm border border-danger/20">
              Failed to save profile. Please try again.
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !isDirty}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
