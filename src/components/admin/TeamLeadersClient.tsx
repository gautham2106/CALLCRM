'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import {
  UserPlus, Mail, Phone, Loader2, Users, Shield, UserCheck,
  ToggleLeft, ToggleRight, Pencil, X, Check,
} from 'lucide-react'

interface TeamLeader {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
  created_at: string
  team_members: Counsellor[]
}

interface Counsellor {
  id: string
  name: string
  email: string
  is_active: boolean
  team_leader_id: string | null
}

interface Props {
  initialTeamLeaders: TeamLeader[]
  allCounsellors: Counsellor[]
  collegeId: string
}

export function TeamLeadersClient({ initialTeamLeaders, allCounsellors, collegeId }: Props) {
  const [teamLeaders, setTeamLeaders] = useState(initialTeamLeaders)
  const [counsellors, setCounsellors] = useState(allCounsellors)

  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', pin: '' })

  // Edit dialog
  const [editTarget, setEditTarget] = useState<TeamLeader | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', newPin: '' })
  const [saving, setSaving] = useState(false)

  // Manage team dialog
  const [teamTarget, setTeamTarget] = useState<TeamLeader | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/admin/team-leaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, pin: form.pin }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      setTeamLeaders((prev) => [{ ...json.user, team_members: [] }, ...prev])
      setShowAddDialog(false)
      setForm({ name: '', email: '', phone: '', pin: '' })
      toast({ title: 'Team leader added', description: `${form.name} has been added successfully.`, variant: 'success' })
    } catch (err: unknown) {
      toast({ title: 'Failed to add', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (tl: TeamLeader) => {
    const res = await fetch('/api/admin/team-leaders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tl.id, is_active: !tl.is_active }),
    })
    if (res.ok) {
      setTeamLeaders((prev) => prev.map((t) => t.id === tl.id ? { ...t, is_active: !t.is_active } : t))
      toast({ title: tl.is_active ? 'Deactivated' : 'Activated', description: `${tl.name} has been ${tl.is_active ? 'deactivated' : 'activated'}.` })
    }
  }

  const openEdit = (tl: TeamLeader) => {
    setEditTarget(tl)
    setEditForm({ name: tl.name, email: tl.email, phone: tl.phone || '', newPin: '' })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/team-leaders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, ...editForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      setTeamLeaders((prev) => prev.map((t) => t.id === editTarget.id ? { ...t, ...json.user } : t))
      setEditTarget(null)
      toast({ title: 'Saved', description: 'Team leader updated successfully.' })
    } catch (err: unknown) {
      toast({ title: 'Failed to save', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const assignCounsellor = async (counsellorId: string, action: 'assign' | 'unassign') => {
    if (!teamTarget) return
    setAssigning(counsellorId)
    try {
      const res = await fetch('/api/admin/team-leaders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teamTarget.id, counsellorId, action }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Something went wrong.')
      }

      // Update counsellors list
      setCounsellors((prev) => prev.map((c) =>
        c.id === counsellorId ? { ...c, team_leader_id: action === 'assign' ? teamTarget.id : null } : c
      ))

      // Update team leader's member list
      setTeamLeaders((prev) => prev.map((t) => {
        if (t.id !== teamTarget.id) return t
        const members = action === 'assign'
          ? [...t.team_members, counsellors.find((c) => c.id === counsellorId)!]
          : t.team_members.filter((m) => m.id !== counsellorId)
        return { ...t, team_members: members }
      }))

      // Keep dialog's teamTarget in sync
      setTeamTarget((prev) => {
        if (!prev) return null
        const members = action === 'assign'
          ? [...prev.team_members, counsellors.find((c) => c.id === counsellorId)!]
          : prev.team_members.filter((m) => m.id !== counsellorId)
        return { ...prev, team_members: members }
      })

      toast({ title: action === 'assign' ? 'Counsellor assigned' : 'Counsellor removed', description: counsellors.find((c) => c.id === counsellorId)?.name })
    } catch (err: unknown) {
      toast({ title: 'Failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setAssigning(null)
    }
  }

  // Counsellors not assigned to any team leader (available to assign)
  const unassignedCounsellors = counsellors.filter((c) => !c.team_leader_id && c.is_active)
  // Counsellors in the current team leader's team
  const teamMemberIds = new Set(teamTarget?.team_members.map((m) => m.id) ?? [])

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team Leaders</h1>
            <p className="text-sm text-gray-500 mt-0.5">{teamLeaders.length} team leader{teamLeaders.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Team Leader
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {teamLeaders.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No team leaders yet</p>
            <p className="text-sm text-gray-400 mt-1">Add a team leader to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teamLeaders.map((tl) => (
              <div key={tl.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{tl.name}</p>
                      <Badge variant={tl.is_active ? 'default' : 'secondary'} className="text-xs mt-0.5">
                        {tl.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(tl)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(tl)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title={tl.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {tl.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{tl.email}</span>
                  </div>
                  {tl.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{tl.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{tl.team_members.length} counsellor{tl.team_members.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setTeamTarget(tl)}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                  Manage Team
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Team Leader Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Leader</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tl-name">Name <span className="text-red-500">*</span></Label>
              <Input id="tl-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-email">Email <span className="text-red-500">*</span></Label>
              <Input id="tl-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-phone">Phone</Label>
              <Input id="tl-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-pin">PIN <span className="text-red-500">*</span></Label>
              <Input id="tl-pin" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} placeholder="6-digit PIN for login" maxLength={6} required />
              <p className="text-xs text-gray-500">The team leader will use this PIN to log in.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={adding}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Team Leader
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Leader Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Leader</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>New PIN</Label>
              <Input value={editForm.newPin} onChange={(e) => setEditForm((f) => ({ ...f, newPin: e.target.value }))} placeholder="Leave blank to keep current PIN" maxLength={6} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Team Dialog */}
      <Dialog open={!!teamTarget} onOpenChange={(open) => !open && setTeamTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-600" />
              {teamTarget?.name}&apos;s Team
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Current members */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Team ({teamTarget?.team_members.length ?? 0})</p>
              {(teamTarget?.team_members.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 italic">No counsellors assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {teamTarget?.team_members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => assignCounsellor(m.id, 'unassign')}
                        disabled={assigning === m.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Remove from team"
                      >
                        {assigning === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available counsellors */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Available Counsellors ({unassignedCounsellors.length})
              </p>
              {unassignedCounsellors.length === 0 ? (
                <p className="text-sm text-gray-400 italic">All counsellors are already assigned to a team.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {unassignedCounsellors.filter((c) => !teamMemberIds.has(c.id)).map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <UserCheck className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => assignCounsellor(c.id, 'assign')}
                        disabled={assigning === c.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50"
                        title="Add to team"
                      >
                        {assigning === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
