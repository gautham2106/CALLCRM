'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { UserPlus, Mail, Phone, Eye, Loader2, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CounsellorLead {
  id: string
  current_lead_stage: string
  current_call_stage: string | null
}

interface Counsellor {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
  created_at: string
  assigned_leads: CounsellorLead[]
}

interface Props {
  initialCounsellors: Counsellor[]
  collegeId: string
  adminId: string
}

export function CounsellorsClient({ initialCounsellors, collegeId, adminId }: Props) {
  const [counsellors, setCounsellors] = useState(initialCounsellors)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/admin/counsellors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      setCounsellors((prev) => [{ ...json.user, assigned_leads: [] } as Counsellor, ...prev])
      setShowAddDialog(false)
      setForm({ name: '', email: '', phone: '', password: '' })
      toast({ title: 'Counsellor added', description: `${form.name} has been added successfully.`, variant: 'success' })
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Failed to add', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (counsellor: Counsellor) => {
    const res = await fetch('/api/admin/counsellors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: counsellor.id, is_active: !counsellor.is_active }),
    })
    if (res.ok) {
      setCounsellors((prev) =>
        prev.map((c) => (c.id === counsellor.id ? { ...c, is_active: !c.is_active } : c))
      )
      toast({
        title: counsellor.is_active ? 'Counsellor deactivated' : 'Counsellor activated',
        description: `${counsellor.name} has been ${counsellor.is_active ? 'deactivated' : 'activated'}.`,
      })
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Counsellors</h1>
          <p className="text-gray-500 text-sm">{counsellors.length} total counsellors</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4" />
          Add Counsellor
        </Button>
      </div>

      {/* Counsellor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {counsellors.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No counsellors yet. Add your first counsellor.</p>
          </div>
        ) : (
          counsellors.map((c) => {
            const leads = c.assigned_leads || []
            const total = leads.length
            const called = leads.filter((l) => l.current_call_stage !== null).length
            const enrolled = leads.filter((l) => l.current_lead_stage === 'Enrolled').length
            const conversion = total > 0 ? Math.round((enrolled / total) * 100) : 0

            return (
              <div key={c.id} className={`bg-white border rounded-xl p-5 space-y-4 ${!c.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={c.is_active ? 'success' : 'secondary'}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">{total}</p>
                    <p className="text-xs text-gray-400">Assigned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-blue-600">{called}</p>
                    <p className="text-xs text-gray-400">Called</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{enrolled}</p>
                    <p className="text-xs text-gray-400">Enrolled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-purple-600">{conversion}%</p>
                    <p className="text-xs text-gray-400">Conv.</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <Link href={`/admin/counsellors/${c.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </Link>
                  <Button
                    variant={c.is_active ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => toggleActive(c)}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Counsellor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Counsellor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Priya Sharma"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="priya@college.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add Counsellor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
