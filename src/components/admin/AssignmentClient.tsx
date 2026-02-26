'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { LEAD_STAGE_COLORS } from '@/lib/utils'
import {
  UserPlus,
  Shuffle,
  Search,
  Users,
  CheckCircle,
  Loader2,
} from 'lucide-react'

interface Lead {
  id: string
  name: string
  phone: string
  city: string | null
  course_interest: string | null
  source_name: string | null
  current_lead_stage: string
  assigned_to: string | null
  assigned_user: { id: string; name: string } | null
}

interface Counsellor {
  id: string
  name: string
  email: string
}

interface Props {
  initialLeads: Lead[]
  counsellors: Counsellor[]
  collegeId: string
  adminId: string
}

export function AssignmentClient({ initialLeads, counsellors, collegeId, adminId }: Props) {
  const searchParams = useSearchParams()

  const preSelectedIds = searchParams.get('leads')?.split(',').filter(Boolean) || []

  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds))
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [selectedCounsellorId, setSelectedCounsellorId] = useState('')
  const [reason, setReason] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'unassigned'>('unassigned')

  const filtered = useMemo(() => {
    let result = leads

    if (filterMode === 'unassigned') {
      result = result.filter((l) => !l.assigned_to)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [leads, search, filterMode])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)))
    }
  }

  const assignLeads = async (isReassign = false) => {
    if (!selectedCounsellorId || selectedIds.size === 0) return
    setAssigning(true)

    const counsellor = counsellors.find((c) => c.id === selectedCounsellorId)

    try {
      const res = await fetch('/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
          counsellorId: selectedCounsellorId,
          reason: reason || null,
          isReassign,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Assignment failed')

      // Update local state
      setLeads((prev) =>
        prev.map((l) =>
          selectedIds.has(l.id)
            ? { ...l, assigned_to: selectedCounsellorId, assigned_user: { id: selectedCounsellorId, name: counsellor?.name || '' } }
            : l
        )
      )

      toast({
        title: 'Leads assigned',
        description: `${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''} assigned to ${counsellor?.name}`,
        variant: 'success',
      })

      setSelectedIds(new Set())
      setSelectedCounsellorId('')
      setReason('')
      setShowAssignDialog(false)
      setShowReassignDialog(false)
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Assignment failed', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const autoDistribute = async () => {
    if (counsellors.length === 0 || selectedIds.size === 0) return
    setAssigning(true)

    const leadIds = Array.from(selectedIds)

    try {
      const res = await fetch('/api/admin/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Distribution failed')

      // Rebuild local assignments (round-robin, same logic as server)
      const assignments: Record<string, string[]> = {}
      leadIds.forEach((id, idx) => {
        const c = counsellors[idx % counsellors.length]
        if (!assignments[c.id]) assignments[c.id] = []
        assignments[c.id].push(id)
      })

      setLeads((prev) =>
        prev.map((l) => {
          for (const [counsellorId, ids] of Object.entries(assignments)) {
            if (ids.includes(l.id)) {
              const c = counsellors.find((c) => c.id === counsellorId)
              return { ...l, assigned_to: counsellorId, assigned_user: { id: counsellorId, name: c?.name || '' } }
            }
          }
          return l
        })
      )

      toast({
        title: 'Auto-distributed!',
        description: `${leadIds.length} leads distributed equally among ${counsellors.length} counsellors`,
        variant: 'success',
      })
      setSelectedIds(new Set())
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Distribution failed', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const hasReassignableSelected = Array.from(selectedIds).some(
    (id) => leads.find((l) => l.id === id)?.assigned_to
  )

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Assignment</h1>
          <p className="text-gray-500 text-sm mt-0.5">Assign leads to counsellors</p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">{selectedIds.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={autoDistribute}
              disabled={assigning}
            >
              <Shuffle className="h-4 w-4" />
              <span className="hidden xs:inline">Auto-Distribute</span>
              <span className="xs:hidden">Auto</span>
            </Button>
            {hasReassignableSelected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReassignDialog(true)}
              >
                <UserPlus className="h-4 w-4" />
                Reassign
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShowAssignDialog(true)}
              disabled={assigning}
            >
              <UserPlus className="h-4 w-4" />
              Assign
            </Button>
          </div>
        )}
      </div>

      {/* Counsellor Summary */}
      {counsellors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {counsellors.map((c) => {
            const count = leads.filter((l) => l.assigned_to === c.id).length
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-sm mx-auto mb-1">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-lg font-bold text-blue-600">{count}</p>
                <p className="text-xs text-gray-400">leads</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex gap-1 border border-gray-200 rounded-md p-1 self-start">
          <button
            onClick={() => setFilterMode('unassigned')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterMode === 'unassigned' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Unassigned ({leads.filter((l) => !l.assigned_to).length})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Leads
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
            {filterMode === 'unassigned' ? 'All leads are assigned!' : 'No leads found'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-2.5">
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-gray-500 font-medium">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all ${filtered.length}`}
              </span>
            </div>
            {filtered.map((lead) => (
              <div
                key={lead.id}
                onClick={() => toggleSelect(lead.id)}
                className={`bg-white rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  selectedIds.has(lead.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900">{lead.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                    {(lead.city || lead.course_interest) && (
                      <p className="text-xs text-gray-400 mt-0.5">{lead.city || lead.course_interest}</p>
                    )}
                    <div className="mt-1.5">
                      {lead.assigned_user ? (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{lead.assigned_user.name}</span>
                      ) : (
                        <span className="text-xs text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Currently Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  {filterMode === 'unassigned' ? 'All leads are assigned!' : 'No leads found'}
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className={`hover:bg-gray-50 ${selectedIds.has(lead.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.city || lead.course_interest || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                      {lead.current_lead_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.assigned_user ? (
                      <span className="text-gray-700">{lead.assigned_user.name}</span>
                    ) : (
                      <span className="text-orange-500 font-medium text-xs">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Counsellor</Label>
              <Select value={selectedCounsellorId} onValueChange={setSelectedCounsellorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a counsellor..." />
                </SelectTrigger>
                <SelectContent>
                  {counsellors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {leads.filter((l) => l.assigned_to === c.id).length} leads
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={() => assignLeads(false)} disabled={!selectedCounsellorId || assigning}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Assign Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={selectedCounsellorId} onValueChange={setSelectedCounsellorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose new counsellor..." />
                </SelectTrigger>
                <SelectContent>
                  {counsellors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for reassignment</Label>
              <Textarea
                placeholder="Why are these leads being reassigned? (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>Cancel</Button>
            <Button onClick={() => assignLeads(true)} disabled={!selectedCounsellorId || assigning}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reassign Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
