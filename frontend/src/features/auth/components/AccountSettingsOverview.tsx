import React from "react"
import { useAuth } from "@/features/auth/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { useForm } from "react-hook-form"

type ProfileFormValues = {
  fullName: string;
  phone: string;
}

export function AccountSettingsOverview() {
  const { session } = useAuth()
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ProfileFormValues>({
    defaultValues: {
      fullName: "",
      phone: ""
    }
  })

  const onSubmit = async (data: ProfileFormValues) => {
    // API Call goes here when Backend is ready
    console.log("Submitting HR Profile Data: ", data)
    alert("Tính năng cập nhật thông tin HR chưa được hỗ trợ bởi Backend. Dữ liệu: " + JSON.stringify(data))
  }

  if (!session) return null

  return (
    <div className="space-y-8 pb-12 max-w-2xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Account Settings</h2>
          <p className="text-slate">Manage your personal HR profile and account credentials.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <CardDescription>Update your contact details and identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" value={session.user.email} disabled className="bg-slate/10" />
              <p className="text-xs text-slate">Email cannot be changed as it is used for login.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="e.g. Jane Doe" {...register("fullName")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="e.g. +84 123 456 789" {...register("phone")} />
            </div>

            <div className="space-y-2">
              <Label>Account Role</Label>
              <Input value={session.user.role === 'HR' ? 'Recruiter / HR' : session.user.role} disabled className="bg-slate/10" />
            </div>

          </CardContent>
          <CardFooter className="flex justify-end border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
