import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { ProfileEditor } from "./ProfileEditor"
import { CVUploader } from "./CVUploader"
import { WorkExperienceEditor } from "./WorkExperienceEditor"
import { ProfileVisibilityControl } from "./ProfileVisibilityControl"
import { SkillCombobox } from "./SkillCombobox"

export function ProfileOverview() {
  const { session } = useAuth()

  if (!session) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Candidate Profile</h2>
          <p className="text-slate">Manage your professional identity, experience, and CVs.</p>
        </div>
        <ProfileVisibilityControl />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-slate">Email</div>
                <div className="text-ink">{session.user.email}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate">Status</div>
                <div className="text-ink">{session.user.status}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate mb-1">Top Skills</div>
                <SkillCombobox />
              </div>
              <ProfileEditor />
            </CardContent>
          </Card>
          
          <WorkExperienceEditor />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CV Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CVUploader />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
