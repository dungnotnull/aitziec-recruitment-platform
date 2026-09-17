import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createCompany, updateCompany, uploadCompanyLogo } from "../api"
import {
  getCompanyExtendedInfo,
  saveCompanyExtendedInfo,
  type CompanyReasonToJoin,
  type CompanyPerk,
} from "../company-meta"
import type { Company } from "@/api/types"
import { validateAndNormalizeImageFile } from "@/shared/lib/image-validator"
import { useEffect } from "react"
import {
  Building2,
  Sparkles,
  Code2,
  HeartHandshake,
  Plus,
  Trash2,
  Globe,
  Clock,
  Users,
  Award,
  Briefcase,
  X,
} from "lucide-react"

const companySchema = z.object({
  name: z.string().min(2, "Tên công ty là bắt buộc (tối thiểu 2 ký tự)"),
  slug: z.string().min(2, "Slug là bắt buộc đối với công ty mới").optional(),
  description: z.string().optional().nullable(),
  websiteUrl: z.string().url("Phải là một đường dẫn URL hợp lệ").optional().or(z.literal("")).nullable(),
  logoUrl: z.string().optional().or(z.literal("")).nullable(),
  location: z.string().optional().nullable(),
})

type CompanyValues = z.infer<typeof companySchema>

interface CompanyProfileEditorProps {
  company?: Company
}

const COMMON_TECH_SUGGESTIONS = [
  'Java',
  'Spring Boot',
  'ReactJS',
  'TypeScript',
  'Node.js',
  'Python',
  'Golang',
  'PostgreSQL',
  'Docker',
  'Kubernetes',
  'AWS',
  'Flutter',
  'Vue.js',
  '.NET',
]

export function CompanyProfileEditor({ company }: CompanyProfileEditorProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!company
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewLogo, setPreviewLogo] = useState<string | null>(company?.logoUrl || null)
  const [previewError, setPreviewError] = useState(false)
  const [fileValidationError, setFileValidationError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<number>(company?.version ?? 0)

  useEffect(() => {
    if (company?.version !== undefined) {
      setCurrentVersion(company.version)
    }
  }, [company?.version])

  // Initialize extended metadata
  const initialExt = getCompanyExtendedInfo(company?.id)
  const [companyModel, setCompanyModel] = useState<string>(initialExt.companyModel)
  const [companySize, setCompanySize] = useState<string>(initialExt.companySize)
  const [country, setCountry] = useState<string>(initialExt.country)
  const [workingTime, setWorkingTime] = useState<string>(initialExt.workingTime)
  const [overtimePolicy, setOvertimePolicy] = useState<string>(initialExt.overtimePolicy)
  const [techStack, setTechStack] = useState<string[]>(initialExt.techStack)
  const [newTechInput, setNewTechInput] = useState<string>('')
  const [reasonsToJoin, setReasonsToJoin] = useState<CompanyReasonToJoin[]>(initialExt.reasonsToJoin)
  const [perks, setPerks] = useState<CompanyPerk[]>(initialExt.perks)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
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

  // Tech stack handling
  const handleAddTech = (tech: string) => {
    const trimmed = tech.trim()
    if (!trimmed || techStack.includes(trimmed)) return
    setTechStack([...techStack, trimmed])
    setNewTechInput('')
  }

  const handleRemoveTech = (techToRemove: string) => {
    setTechStack(techStack.filter((t) => t !== techToRemove))
  }

  // Reasons to join handling
  const handleReasonChange = (index: number, field: keyof CompanyReasonToJoin, value: string) => {
    const updated = [...reasonsToJoin]
    updated[index] = { ...updated[index], [field]: value }
    setReasonsToJoin(updated)
  }

  // Perks handling
  const handleAddPerk = () => {
    setPerks([...perks, { title: 'Phúc lợi mới', description: 'Mô tả chi tiết quyền lợi...' }])
  }

  const handleRemovePerk = (index: number) => {
    if (perks.length <= 1) return
    setPerks(perks.filter((_, i) => i !== index))
  }

  const handlePerkChange = (index: number, field: keyof CompanyPerk, value: string) => {
    const updated = [...perks]
    updated[index] = { ...updated[index], [field]: value }
    setPerks(updated)
  }

  const mutation = useMutation({
    mutationFn: async (data: CompanyValues) => {
      let savedCompany: Company
      let versionToUse = currentVersion

      if (isEditing) {
        let finalLogoUrl = company.logoUrl

        // Upload logo FIRST if a new file is chosen.
        // If logo upload fails (e.g. invalid signature), updateCompany will not run,
        // preventing version bump and stale expectedVersion conflict.
        if (logoFile) {
          try {
            const logoRes = await uploadCompanyLogo(company.id, logoFile, versionToUse)
            finalLogoUrl = logoRes.logoUrl
            versionToUse = logoRes.version
            setCurrentVersion(logoRes.version)
          } catch (err: any) {
            console.error("Failed to upload company logo:", err)
            throw new Error(err?.response?.data?.error?.message || "Không thể tải lên logo công ty. Vui lòng kiểm tra lại định dạng và dung lượng.")
          }
        }

        savedCompany = await updateCompany(company.id, {
          expectedVersion: versionToUse,
          name: data.name,
          description: data.description || null,
          location: data.location || null,
          websiteUrl: data.websiteUrl || null,
          logoUrl: finalLogoUrl,
        })
        setCurrentVersion(savedCompany.version)
      } else {
        savedCompany = await createCompany({
          name: data.name,
          slug: data.slug!,
          description: data.description || null,
          location: data.location || null,
          websiteUrl: data.websiteUrl || null,
          logoUrl: null,
        })

        if (logoFile) {
          try {
            const logoRes = await uploadCompanyLogo(savedCompany.id, logoFile, savedCompany.version)
            savedCompany = { ...savedCompany, logoUrl: logoRes.logoUrl, version: logoRes.version }
            setCurrentVersion(savedCompany.version)
          } catch (err: any) {
            console.error("Failed to upload company logo:", err)
            throw new Error(err?.response?.data?.error?.message || "Không thể tải lên logo công ty. Vui lòng kiểm tra lại định dạng và dung lượng.")
          }
        }
      }

      // Save extended metadata (ITviec standards)
      saveCompanyExtendedInfo(savedCompany.id, {
        companyModel,
        companySize,
        country,
        workingTime,
        overtimePolicy,
        techStack,
        reasonsToJoin,
        perks,
      })

      return savedCompany
    },
    onSuccess: (savedCompany) => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
      queryClient.invalidateQueries({ queryKey: ['public-company-detail'] })
      queryClient.setQueryData(['company', savedCompany.id], savedCompany)
      localStorage.setItem('hr_company_id', savedCompany.id)
      navigate({ to: '/company', search: { companyId: savedCompany.id } })
    },
    onError: (error: any) => {
      const isConflict =
        error?.response?.status === 409 ||
        error?.response?.data?.error?.code === 'VERSION_CONFLICT' ||
        error?.message?.includes("expectedVersion")

      if (isConflict && company?.id) {
        queryClient.invalidateQueries({ queryKey: ['company', company.id] })
        setError("root", {
          type: "server",
          message: "Dữ liệu công ty vừa được cập nhật ở một phiên khác (Xung đột phiên bản). Hệ thống đã làm mới dữ liệu mới nhất, vui lòng kiểm tra lại và bấm Lưu hồ sơ.",
        })
      } else {
        setError("root", {
          type: "server",
          message: error?.message || error.response?.data?.error?.message || "Không thể lưu thông tin công ty. Vui lòng kiểm tra lại.",
        })
      }
    },
  })

  const onSubmit = (data: CompanyValues) => {
    mutation.mutate(data)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
            <Building2 className="h-3.5 w-3.5" />
            <span>Quản Lý Hồ Sơ Doanh Nghiệp</span>
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-ink tracking-tight">
          {isEditing ? "Chỉnh sửa hồ sơ công ty" : "Tạo mới hồ sơ công ty"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEditing
            ? "Cập nhật thông tin chi tiết, văn hóa, tech stack và phúc lợi theo chuẩn trang thương hiệu ITviec."
            : "Thiết lập thông tin tổ chức của bạn để bắt đầu đăng tuyển việc làm IT chất lượng cao."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {errors.root && (
          <div className="p-4 text-sm rounded-xl bg-danger/10 text-danger border border-danger/20">
            {errors.root.message}
          </div>
        )}

        {/* SECTION 1: THÔNG TIN CƠ BẢN */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h2 className="font-display font-bold text-lg text-ink">
              1. Thông tin cơ bản & Nhận diện thương hiệu
            </h2>
          </div>

          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                  Tên công ty <span className="text-[#EA1E30]">*</span>
                </Label>
                <Input id="name" {...register("name")} placeholder="VD: TechCorp Solutions Vietnam" className="rounded-xl" />
                {errors.name && <p className="text-xs font-medium text-danger">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                  Slug đường dẫn {isEditing ? "(Cố định)" : <span className="text-[#EA1E30]">*</span>}
                </Label>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder="techcorp-vietnam"
                  disabled={isEditing}
                  className={`rounded-xl ${isEditing ? "bg-slate-100 dark:bg-zinc-800/60 opacity-80 cursor-not-allowed" : ""}`}
                />
                {errors.slug && <p className="text-xs font-medium text-danger">{errors.slug.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                Giới thiệu công ty (Về chúng tôi)
              </Label>
              <textarea
                id="description"
                {...register("description")}
                rows={4}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                placeholder="Giới thiệu tầm nhìn, sản phẩm, sứ mệnh và văn hóa công nghệ của công ty bạn..."
              />
              {errors.description && <p className="text-xs font-medium text-danger">{errors.description.message}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                  Trụ sở / Địa điểm làm việc
                </Label>
                <Input id="location" {...register("location")} placeholder="VD: Quận 1, TP. Hồ Chí Minh" className="rounded-xl" />
                {errors.location && <p className="text-xs font-medium text-danger">{errors.location.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                  Website chính thức
                </Label>
                <Input id="websiteUrl" type="url" {...register("websiteUrl")} placeholder="https://example.com" className="rounded-xl" />
                {errors.websiteUrl && <p className="text-xs font-medium text-danger">{errors.websiteUrl.message}</p>}
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="logoUrl" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                Logo doanh nghiệp
              </Label>
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-zinc-900 p-1.5 shrink-0">
                  {previewLogo && !previewError ? (
                    <img
                      src={previewLogo}
                      alt="Logo preview"
                      className="h-full w-full object-contain rounded-xl"
                      onError={() => setPreviewError(true)}
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    id="logoUrl"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="rounded-xl text-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-xs"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setFileValidationError(null)
                        const validation = await validateAndNormalizeImageFile(file)
                        if (!validation.isValid) {
                          setFileValidationError(validation.error || "Tệp ảnh không hợp lệ")
                          setLogoFile(null)
                          return
                        }
                        setLogoFile(validation.file)
                        setPreviewError(false)
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setPreviewLogo(reader.result as string)
                        }
                        reader.readAsDataURL(validation.file)
                      }
                    }}
                  />
                  {fileValidationError && (
                    <p className="text-xs font-medium text-danger mt-1">{fileValidationError}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">Định dạng hỗ trợ: PNG, JPG, WEBP (Khuyên dùng kích thước vuông, tối thiểu 200x200px)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: THÔNG TIN CHUNG (ITVIEC PROFILE SIDEBAR) */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Briefcase className="h-5 w-5 text-[#EA1E30]" />
            <div>
              <h2 className="font-display font-bold text-lg text-ink">
                2. Thông tin chung về mô hình & Quy chế làm việc
              </h2>
              <p className="text-xs text-muted-foreground">Hiển thị trong widget "Thông tin chung" trên trang công ty</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>Mô hình công ty</span>
              </Label>
              <select
                value={companyModel}
                onChange={(e) => setCompanyModel(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <option value="Product">Product (Sản phẩm riêng)</option>
                <option value="Outsourcing / IT Services">Outsourcing / Dịch vụ IT</option>
                <option value="Product & IT Solutions">Product & IT Solutions (Hỗn hợp)</option>
                <option value="Consulting / Agency">Consulting / Digital Agency</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span>Quy mô nhân sự</span>
              </Label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <option value="1 - 49 nhân viên">&lt; 50 nhân viên</option>
                <option value="50 - 99 nhân viên">50 - 99 nhân viên</option>
                <option value="100 - 499 nhân viên">100 - 499 nhân viên</option>
                <option value="500 - 999 nhân viên">500 - 999 nhân viên</option>
                <option value="1,000+ nhân viên">1,000+ nhân viên (Tập đoàn lớn)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span>Quốc tịch công ty / Trụ sở chính</span>
              </Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="VD: Việt Nam, Nhật Bản, Singapore, Mỹ..."
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Thời gian làm việc</span>
              </Label>
              <Input
                value={workingTime}
                onChange={(e) => setWorkingTime(e.target.value)}
                placeholder="VD: Thứ 2 - Thứ 6 (8:30 - 17:30)"
                className="rounded-xl"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-slate-400" />
                <span>Chính sách làm thêm giờ (OT)</span>
              </Label>
              <select
                value={overtimePolicy}
                onChange={(e) => setOvertimePolicy(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <option value="Không áp lực OT">Không áp lực OT (Work-life balance cao)</option>
                <option value="OT có lương theo luật lao động">OT có tính lương minh bạch theo luật</option>
                <option value="OT theo yêu cầu dự án (có phụ cấp)">OT theo yêu cầu dự án (kèm phụ cấp thỏa đáng)</option>
                <option value="Không làm thêm giờ (No OT)">Hoàn toàn không làm ngoài giờ (No OT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: KỸ NĂNG & CÔNG NGHỆ CHÍNH (TECH STACK) */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Code2 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-display font-bold text-lg text-ink">
                3. Kỹ năng & Công nghệ chính (Tech Stack)
              </h2>
              <p className="text-xs text-muted-foreground">Giúp ứng viên nhanh chóng nhận diện hệ sinh thái công nghệ của công ty</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Tag add input */}
            <div className="flex gap-2">
              <Input
                value={newTechInput}
                onChange={(e) => setNewTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTech(newTechInput)
                  }
                }}
                placeholder="Nhập tên công nghệ (VD: React, Node.js, Spring Boot...) rồi nhấn Thêm"
                className="rounded-xl flex-1"
              />
              <Button
                type="button"
                onClick={() => handleAddTech(newTechInput)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4"
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm
              </Button>
            </div>

            {/* Current Tags */}
            <div className="flex flex-wrap gap-2 pt-1 min-h-[44px] p-3 rounded-xl border border-dashed border-border bg-slate-50/50 dark:bg-zinc-900/40">
              {techStack.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">Chưa có công nghệ nào. Chọn từ gợi ý bên dưới hoặc tự nhập.</span>
              ) : (
                techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                  >
                    <span>{tech}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTech(tech)}
                      className="hover:text-danger rounded-full p-0.5 transition-colors"
                      title="Xóa tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Suggestions */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gợi ý phổ biến:</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_TECH_SUGGESTIONS.map((sug) => {
                  const isAdded = techStack.includes(sug)
                  return (
                    <button
                      key={sug}
                      type="button"
                      disabled={isAdded}
                      onClick={() => handleAddTech(sug)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                        isAdded
                          ? 'opacity-40 border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 hover:border-blue-400 bg-surface hover:bg-blue-50 text-ink'
                      }`}
                    >
                      + {sug}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: TẠI SAO BẠN SẼ THÍCH LÀM VIỆC TẠI ĐÂY */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="font-display font-bold text-lg text-ink">
                4. Tại sao bạn sẽ thích làm việc tại đây (Top 3 lý do)
              </h2>
              <p className="text-xs text-muted-foreground">Tính năng thương hiệu nổi bật nhất trên ITviec để thu hút nhân tài</p>
            </div>
          </div>

          <div className="space-y-4">
            {reasonsToJoin.slice(0, 3).map((reason, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-xs uppercase tracking-wider text-ink">Lý do {idx + 1}</span>
                </div>

                <div className="space-y-2">
                  <Input
                    value={reason.title}
                    onChange={(e) => handleReasonChange(idx, 'title', e.target.value)}
                    placeholder="Tiêu đề lý do (VD: Đãi ngộ cạnh tranh & Thưởng hiệu suất)"
                    className="rounded-lg font-semibold text-sm bg-surface"
                  />
                  <textarea
                    value={reason.content}
                    onChange={(e) => handleReasonChange(idx, 'content', e.target.value)}
                    rows={2}
                    placeholder="Mô tả cụ thể và thuyết phục..."
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: CHẾ ĐỘ ĐÃI NGỘ & PHÚC LỢI NỔI BẬT */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <HeartHandshake className="h-5 w-5 text-[#EA1E30]" />
              <div>
                <h2 className="font-display font-bold text-lg text-ink">
                  5. Chế độ đãi ngộ & Phúc lợi nổi bật
                </h2>
                <p className="text-xs text-muted-foreground">Hiển thị dạng các thẻ tiện ích quyền lợi trong hồ sơ</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPerk}
              className="rounded-xl text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Thêm phúc lợi
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {perks.map((perk, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border bg-surface space-y-2.5 relative group">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={perk.title}
                    onChange={(e) => handlePerkChange(idx, 'title', e.target.value)}
                    placeholder="Tên phúc lợi (VD: Bảo hiểm sức khỏe)"
                    className="h-8 text-xs font-bold rounded-md bg-slate-50 dark:bg-zinc-900"
                  />
                  {perks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePerk(idx)}
                      className="text-slate-400 hover:text-danger transition-colors p-1"
                      title="Xóa phúc lợi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={perk.description}
                  onChange={(e) => handlePerkChange(idx, 'description', e.target.value)}
                  rows={2}
                  placeholder="Mô tả quyền lợi..."
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/company', search: { companyId: company?.id } })}
            disabled={mutation.isPending}
            className="rounded-xl font-semibold text-xs px-5 h-11"
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-xs px-8 h-11 rounded-xl shadow-md shadow-red-900/20"
          >
            {mutation.isPending ? "Đang lưu thông tin..." : "Lưu hồ sơ công ty"}
          </Button>
        </div>
      </form>
    </div>
  )
}
