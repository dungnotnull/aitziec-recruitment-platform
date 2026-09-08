import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/shared/ui/button"
import { UploadCloud, FileText, Trash2 } from "lucide-react"
import { apiClient } from "@/api/client"

interface CV {
  id: string
  fileName: string
  uploadedAt: string
}

export function CVUploader() {
  const [cvs, setCvs] = React.useState<CV[]>([])
  
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Mock upload to pre-signed URL behavior
      const formData = new FormData()
      formData.append("file", file)
      // We simulate success since MSW can't easily handle FormData out of the box without complex setup
      return new Promise<CV>((resolve) => {
        setTimeout(() => {
          resolve({
            id: `cv-${Date.now()}`,
            fileName: file.name,
            uploadedAt: new Date().toISOString()
          })
        }, 1500)
      })
    },
    onSuccess: (newCv) => {
      setCvs((prev) => [...prev, newCv])
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(e.target.files[0])
    }
  }

  const removeCv = (id: string) => {
    setCvs((prev) => prev.filter(cv => cv.id !== id))
  }

  return (
    <div className="space-y-4">
      {cvs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-slate">
          <UploadCloud className="mx-auto h-8 w-8 text-slate mb-4" />
          <p>No CV uploaded yet</p>
          <p className="text-xs mt-1">PDF up to 5MB</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cvs.map(cv => (
            <li key={cv.id} className="flex items-center justify-between rounded border border-border p-3 text-sm">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-action" />
                <span className="font-medium text-ink">{cv.fileName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeCv(cv.id)} className="text-danger hover:bg-danger/10 p-1">
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          disabled={uploadMutation.isPending}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Button className="w-full" disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? "Uploading..." : "Upload New CV"}
        </Button>
      </div>
    </div>
  )
}

// Temporary inline Input for this component until Button supports full styling variants
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input type={type} className={className} ref={ref} {...props} />
    )
  }
)
Input.displayName = "Input"
