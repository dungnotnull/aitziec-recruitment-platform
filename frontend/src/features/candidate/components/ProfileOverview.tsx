import React, { useState } from "react"
import { useAuth } from "@/features/auth/context"
import { useQuery } from "@tanstack/react-query"
import { getMyProfile } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Button } from "@/shared/ui/button"
import { ProfileEditor } from "./ProfileEditor"
import { CvUploader } from "@/features/cv/components/CvUploader"
import { CvList } from "@/features/cv/components/CvList"
import { WorkExperienceEditor } from "./WorkExperienceEditor"
import { ProfileVisibilityControl } from "./ProfileVisibilityControl"
import { SkillCombobox } from "./SkillCombobox"
import { Avatar } from "@/shared/ui/avatar"
import { Progress } from "@/shared/ui/progress"
import { Mail, Phone, MapPin, Camera, ExternalLink } from "lucide-react"
import { Link } from "@tanstack/react-router"

export function ProfileOverview() {
  const { session } = useAuth()
  const [localAvatar, setLocalAvatar] = useState<string | null>(null)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setLocalAvatar(e.target?.result as string)
      reader.readAsDataURL(file)
      alert("Tính năng Upload Avatar hiện chưa có API hỗ trợ từ Backend. Vui lòng gửi yêu cầu cho team Backend bổ sung API này nhé!")
    }
  }

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
              
              {/* Interactive Avatar Upload */}
              <div className="relative group cursor-pointer shrink-0">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleAvatarUpload}
                  title="Upload Avatar"
                />
                <Avatar 
                  size="xl" 
                  src={localAvatar || undefined}
                  fallback={profile?.fullName || session.user.email} 
                  className="border-4 border-surface shadow-sm bg-white relative z-10 transition-opacity group-hover:opacity-90"
                />
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-4 border-transparent">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>

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
            {profile && <ProfileVisibilityControl key={profile.version} profile={profile} />}
            
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-xl">CV Management</CardTitle>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/candidate/cvs" className="flex items-center gap-1.5 text-xs font-medium">
                    <span>Manage All CVs</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <CvUploader />
                <div className="pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold text-ink mb-3">Your CVs</h4>
                  <CvList />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </StateBoundary>
    </div>
  )
}
