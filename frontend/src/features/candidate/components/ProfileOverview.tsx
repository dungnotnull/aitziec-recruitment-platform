import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { useQuery } from "@tanstack/react-query"
import { getMyProfile } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { ProfileEditor } from "./ProfileEditor"
import { CVUploader } from "./CVUploader"
import { WorkExperienceEditor } from "./WorkExperienceEditor"
import { ProfileVisibilityControl } from "./ProfileVisibilityControl"
import { SkillCombobox } from "./SkillCombobox"
import { Avatar } from "@/shared/ui/avatar"
import { Progress } from "@/shared/ui/progress"
import { Mail, Phone, MapPin } from "lucide-react"

export function ProfileOverview() {
  const { session } = useAuth()

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: getMyProfile,
    enabled: !!session,
  })

  if (!session) return null

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title (Optional) */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">My Profile</h2>
          <p className="text-slate">Manage your professional identity and let recruiters find you.</p>
        </div>
      </div>

      <StateBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        {/* Hero Header Section */}
        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-r from-canvas to-surface">
          <div className="h-32 bg-action/10" />
          <CardContent className="relative px-6 pb-8 sm:px-8 sm:pb-10">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-20 mb-6">
              <Avatar 
                size="xl" 
                fallback={profile?.fullName || session.user.email} 
                className="border-4 border-surface shadow-sm bg-white"
              />
              <div className="flex-1 w-full flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-display font-bold text-ink">
                    {profile?.fullName || 'Anonymous Candidate'}
                  </h1>
                  <p className="text-lg text-slate mt-1 font-medium">
                    {profile?.headline || 'Add a headline to stand out'}
                  </p>
                </div>
                <ProfileEditor profile={profile} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-ink">
                    <Mail className="h-4 w-4 text-slate" />
                    <span>{session.user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink">
                    <Phone className="h-4 w-4 text-slate" />
                    <span className={!profile?.phone ? 'text-slate italic' : ''}>
                      {profile?.phone || 'No phone number added'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-ink">
                    <MapPin className="h-4 w-4 text-slate" />
                    <span className={!profile?.location ? 'text-slate italic' : ''}>
                      {profile?.location || 'No location added'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Completeness */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate">Profile Completeness</h3>
                  <span className="text-2xl font-bold text-action">
                    {profile?.profileCompleteness || 0}%
                  </span>
                </div>
                <Progress value={profile?.profileCompleteness || 0} className="h-3" />
                <p className="text-sm text-slate">
                  {(profile?.profileCompleteness || 0) < 100 
                    ? "Complete your profile to increase your chances of being noticed by top companies."
                    : "Excellent! Your profile is fully complete."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2-Column Main Layout */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Left Column: Bio, Skills, Experience */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">About Me</CardTitle>
              </CardHeader>
              <CardContent>
                {profile?.bio ? (
                  <p className="text-ink whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
                    <p className="text-slate mb-4">You haven't written a bio yet.</p>
                    <ProfileEditor profile={profile} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Top Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <SkillCombobox profile={profile} />
              </CardContent>
            </Card>

            <WorkExperienceEditor profile={profile} />
          </div>

          {/* Right Column: Visibility, CVs */}
          <div className="space-y-8">
            <ProfileVisibilityControl />
            
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">CV Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CVUploader />
              </CardContent>
            </Card>
          </div>

        </div>
      </StateBoundary>
    </div>
  )
}
