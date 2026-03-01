'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, Phone, UserCheck, Calendar, AlertCircle, ArrowUpDown, UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

interface CounsellorStat {
  id: string
  name: string
  assigned: number
  called: number
  notCalled: number
  interested: number
  notInterested: number
  enrolled: number
  conversion: number
  followUpsToday: number
}

interface Props {
  teamLeaderName: string
  counsellorStats: CounsellorStat[]
  todayDate: string
}

const BLANK_FORM = { name: '', email: '', phone: '', pin: '', confirmPin: '' }

type SortKey = 'name' | 'assigned' | 'called' | 'notCalled' | 'interested' | 'notInterested' | 'enrolled' | 'conversion' | 'followUpsToday'

export function TeamLeaderDashboardClient({ teamLeaderName, counsellorStats: initialStats, todayDate }: Props) {
  const [counsellorStats, setCounsellorStats] = useState<CounsellorStat[]>(initialStats)
  const [sortKey, setSortKey] = useState<SortKey>('notCalled')
  const [sortAsc, setSortAsc] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  function setField(field: keyof typeof BLANK_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.pin.trim()) {
      toast({ title: 'Name, email and PIN are required', variant: 'destructive' })
      return
    }
    if (form.pin !== form.confirmPin) {
      toast({ title: 'PINs do not match', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/team-leader/counsellors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, pin: form.pin }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: data.error || 'Failed to create counsellor', variant: 'destructive' }); return }
      // Optimistically add to stats with zeroes
      setCounsellorStats((prev) => [...prev, {
        id: data.user.id, name: data.user.name,
        assigned: 0, called: 0, notCalled: 0, interested: 0, notInterested: 0, enrolled: 0, conversion: 0, followUpsToday: 0,
      }])
      toast({ title: `${data.user.name} added to your team` })
      setShowAddDialog(false)
      setForm(BLANK_FORM)
    } finally {
      setSaving(false)
    }
  }

  const totalAssigned  = counsellorStats.reduce((s, c) => s + c.assigned,      0)
  const totalEnrolled  = counsellorStats.reduce((s, c) => s + c.enrolled,      0)
  const totalFollowUps = counsellorStats.reduce((s, c) => s + c.followUpsToday, 0)
  const teamConversion = totalAssigned > 0 ? Math.round((totalEnrolled / totalAssigned) * 100) : 0

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  const sorted = [...counsellorStats].sort((a, b) => {
    const av = a[sortKey as keyof CounsellorStat]
    const bv = b[sortKey as keyof CounsellorStat]
    const cmp = typeof av === 'string' ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  // Attention Needed: counsellors with high not-called counts or pending follow-ups
  const needsAttention = counsellorStats
    .filter((c) => c.notCalled > 5 || c.followUpsToday > 0)
    .sort((a, b) => (b.notCalled + b.followUpsToday * 2) - (a.notCalled + a.followUpsToday * 2))
    .slice(0, 4)

  const SortTh = ({ label, col, right = true }: { label: string; col: SortKey; right?: boolean }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none ${right ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 shrink-0 ${sortKey === col ? 'text-blue-500' : 'opacity-30'}`} />
      </span>
    </th>
  )

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Team</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(todayDate).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Add Counsellor
            </Button>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{teamLeaderName}</p>
              <p className="text-xs text-gray-500">Team Leader</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Counsellors</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{counsellorStats.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-gray-500">Total Leads</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalAssigned.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-gray-500">Enrolled</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalEnrolled.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{teamConversion}% conversion</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-gray-500">Follow-ups Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalFollowUps}</p>
          </div>
        </div>

        {/* Attention Needed */}
        {needsAttention.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">Attention Needed</p>
            </div>
            <div className="space-y-1.5">
              {needsAttention.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4">
                  <Link href={`/admin/counsellors/${c.id}`} className="text-sm font-medium text-amber-900 hover:underline truncate">
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    {c.notCalled > 5 && (
                      <span className="text-red-600 font-medium">{c.notCalled} not called</span>
                    )}
                    {c.followUpsToday > 0 && (
                      <span className="text-orange-600 font-medium">{c.followUpsToday} follow-up{c.followUpsToday > 1 ? 's' : ''} due</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Counsellor table */}
        {counsellorStats.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No counsellors assigned to you yet</p>
            <p className="text-gray-400 text-sm mt-1">Ask your admin to assign counsellors to your team.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Counsellor Performance</h2>
              <Link
                href="/admin/leads"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View all leads →
              </Link>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <SortTh label="Counsellor"    col="name"          right={false} />
                    <SortTh label="Assigned"       col="assigned" />
                    <SortTh label="Called"         col="called" />
                    <SortTh label="Not Called"     col="notCalled" />
                    <SortTh label="Interested"     col="interested" />
                    <SortTh label="Not Interested" col="notInterested" />
                    <SortTh label="Enrolled"       col="enrolled" />
                    <SortTh label="Conv %"         col="conversion" />
                    <SortTh label="Follow-ups"     col="followUpsToday" />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-blue-700">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-700">{c.assigned}</td>
                      <td className="px-4 py-3.5 text-right text-gray-700">{c.called}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={c.notCalled > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {c.notCalled}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-blue-600 font-medium">{c.interested}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={c.notInterested > 0 ? 'text-orange-500 font-medium' : 'text-gray-400'}>
                          {c.notInterested}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-green-600 font-bold">{c.enrolled}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-medium ${c.conversion >= 10 ? 'text-green-600' : c.conversion >= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {c.conversion}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={c.followUpsToday > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                          {c.followUpsToday}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/counsellors/${c.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sorted.map((c) => (
                <div key={c.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                    <Link href={`/admin/counsellors/${c.id}`} className="text-xs text-blue-600 font-medium">View →</Link>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Assigned',      value: c.assigned,      color: 'text-gray-700' },
                      { label: 'Called',        value: c.called,        color: 'text-gray-700' },
                      { label: 'Not Called',    value: c.notCalled,     color: c.notCalled > 0 ? 'text-red-600' : 'text-gray-400' },
                      { label: 'Interested',    value: c.interested,    color: 'text-blue-600' },
                      { label: 'Not Interested',value: c.notInterested, color: c.notInterested > 0 ? 'text-orange-500' : 'text-gray-400' },
                      { label: 'Enrolled',      value: c.enrolled,      color: 'text-green-600' },
                      { label: 'Conv %',        value: `${c.conversion}%`, color: c.conversion >= 10 ? 'text-green-600' : 'text-gray-500' },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                        <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {c.followUpsToday > 0 && (
                    <p className="mt-2 text-xs text-orange-600 font-medium">
                      {c.followUpsToday} follow-up{c.followUpsToday > 1 ? 's' : ''} due today
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Counsellor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setForm(BLANK_FORM) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Counsellor to Your Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="Full name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" placeholder="Email address" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" placeholder="Phone number (optional)" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>PIN * <span className="text-gray-400 font-normal text-xs">(6 digits)</span></Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={form.pin} onChange={(e) => setField('pin', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm PIN *</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={form.confirmPin} onChange={(e) => setField('confirmPin', e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setForm(BLANK_FORM) }} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating…</> : 'Create Counsellor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
