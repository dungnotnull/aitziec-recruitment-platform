import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Link, useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { registerFn } from "../api"
import { useAuth } from "../context"

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["CANDIDATE", "HR"]),
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const { setSession } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "CANDIDATE" },
  })

  const mutation = useMutation({
    mutationFn: registerFn,
    onSuccess: (data) => {
      setSession(data)
      navigate({ to: '/' })
    },
    onError: (error: any) => {
      setError("root", { type: "server", message: error.response?.data?.error?.message || "Registration failed" })
    }
  })

  const onSubmit = (data: RegisterValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errors.root && (
        <div className="p-3 text-sm rounded bg-danger/10 text-danger border border-danger/20">
          {errors.root.message}
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-danger">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <p className="text-sm text-danger">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">I am a</Label>
          <select
            id="role"
            {...register("role")}
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          >
            <option value="CANDIDATE">Candidate</option>
            <option value="HR">Recruiter / HR</option>
          </select>
          {errors.role && (
            <p className="text-sm text-danger">{errors.role.message}</p>
          )}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating account..." : "Create account"}
      </Button>
      <div className="text-center text-sm text-slate">
        Already have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-action hover:text-action/80">
          Sign in
        </Link>
      </div>
    </form>
  )
}
