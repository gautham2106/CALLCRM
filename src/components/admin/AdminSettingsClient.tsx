'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { GraduationCap, Loader2, Settings } from 'lucide-react'
import type { UserProfile } from '@/types/database'

interface College {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  subscription_plan: string
}

interface Props {
  college: College | null
  currentUser: UserProfile
}

export function AdminSettingsClient({ college, currentUser }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: college?.name || '',
    email: college?.email || '',
    phone: college?.phone || '',
    address: college?.address || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!college) return
    setSaving(true)

    const { error } = await (supabase as any)
      .from('colleges')
      .update({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
      })
      .eq('id', college.id)

    if (!error) {
      toast({ title: 'Settings saved', variant: 'success' })
    } else {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your college profile and subscription</p>
      </div>

      {/* College Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            College Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>College Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your College Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admissions@college.edu"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 College Road, City, State"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            Subscription Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 capitalize">{college?.subscription_plan || 'Free'} Plan</p>
              <p className="text-sm text-gray-500">Contact us to upgrade your plan</p>
            </div>
            <Badge variant={college?.subscription_plan === 'free' ? 'secondary' : 'default'}>
              {college?.subscription_plan?.toUpperCase() || 'FREE'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{currentUser.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{currentUser.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Role</span>
            <Badge variant="default">Admin</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
