'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, Loader2, Eye, EyeOff, PhoneCall, Users, BarChart3 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast({ title: 'Login failed', description: error.message, variant: 'destructive' })
        return
      }
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', data.user.id)
          .single()
        const p = profile as { role: string } | null
        if (p?.role === 'admin') router.push('/admin')
        else if (p?.role === 'counsellor') router.push('/counsellor')
        else toast({ title: 'Access denied', description: 'Account not set up. Contact your administrator.', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Users, label: 'Lead Management', desc: 'Track every enquiry end-to-end' },
    { icon: PhoneCall, label: 'Call Diary', desc: 'Log every call with stage updates' },
    { icon: BarChart3, label: 'Analytics', desc: 'Funnel insights & team performance' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 right-1/3 w-64 h-64 rounded-full bg-white/5" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">CallCRM</span>
          </div>
          <p className="text-blue-200 text-sm ml-[52px]">Admission Management System</p>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Convert every enquiry<br />into an enrollment.
            </h1>
            <p className="text-blue-200 mt-3 text-lg leading-relaxed">
              Manage leads, track calls, assign counsellors, and grow admissions — all in one place.
            </p>
          </div>
          <div className="space-y-3">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.label}</p>
                  <p className="text-blue-200 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-blue-300/70 text-xs">
          © {new Date().getFullYear()} CallCRM · Built for admission excellence
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">CallCRM</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your admission portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                : 'Sign In'
              }
            </Button>
          </form>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-amber-800 text-sm font-semibold">Secure Access Only</p>
            <p className="text-amber-700 text-xs mt-1 leading-relaxed">
              Accounts are created by your college administrator. Contact them if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
