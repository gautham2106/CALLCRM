'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  PRIORITY_COLORS,
  LEAD_STAGES,
  formatDate,
} from '@/lib/utils'
import {
  Search,
  Upload,
  UserPlus,
  Phone,
  Eye,
  Download,
  MessageCircle,
  Users,
  SlidersHorizontal,
  CircleAlert,
  Plus,
  Loader2,
  Shuffle,
  CheckCircle,
} from 'lucide-react'
import Papa from 'papaparse'
import { toast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  course_interest: string | null
  source_name: string | null
  current_lead_stage: string
  current_call_stage: string | null
  priority: string
  follow_up_date: string | null
  is_active: boolean
  created_at: string
  assigned_to: string | null
  assigned_user: { id: string; name: string; email: string } | null
}

interface Props {
  initialLeads: Lead[]
  counsellors: { id: string; name: string; email: string }[]
  sources: { id: string; source_name: string }[]
  collegeId: string
  adminId: string
}

const PRIORITY_DOT: Record<string, string> = {
  Hot: 'bg-red-500',
  Warm: 'bg-orange-400',
  Cold: 'bg-blue-400',
}

const EMPTY_LEAD_FORM = { name: '', phone: '', email: '', city: '', course_interest: '', source_id: '', priority: 'Warm', notes: '' }

export function AdminLeadsClient({ initialLeads, counsellors, sources, collegeId, adminId }: Props) {
  const supabase = createClient()
  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingLead, setAddingLead] = useState(false)
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM)
  const [stageFilter, setStageFilter] = useState('all')
  const [counsellorFilter, setCounsellorFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned'>('all')

  // Assignment state
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [selectedCounsellorId, setSelectedCounsellorId] = useState('')
  const [reason, setReason] = useState('')
  const [assigning, setAssigning] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let result = leads
    if (activeTab === 'unassigned') result = result.filter((l) => !l.assigned_to)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      )
    }
    if (stageFilter !== 'all') result = result.filter((l) => l.current_lead_stage === stageFilter)
    if (counsellorFilter !== 'all') {
      if (counsellorFilter === 'unassigned') result = result.filter((l) => !l.assigned_to)
      else result = result.filter((l) => l.assigned_to === counsellorFilter)
    }
    if (priorityFilter !== 'all') result = result.filter((l) => l.priority === priorityFilter)
    return result
  }, [leads, search, stageFilter, counsellorFilter, priorityFilter, activeTab])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map((l) => l.id))
    )
  }

  const exportCSV = () => {
    const rows = filtered.map((l) => ({
      Name: l.name, Phone: l.phone, Email: l.email || '', City: l.city || '',
      Course: l.course_interest || '', Source: l.source_name || '',
      'Lead Stage': l.current_lead_stage, 'Call Stage': l.current_call_stage || '',
      Priority: l.priority, 'Follow-up Date': l.follow_up_date || '',
      'Assigned To': l.assigned_user?.name || 'Unassigned',
      'Created At': formatDate(l.created_at),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Export ready', description: `${rows.length} leads exported.` })
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingLead(true)
    try {
      const source = sources.find((s) => s.id === leadForm.source_id)
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          source_name: source?.source_name || null,
          source_id: leadForm.source_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
      setLeads((prev) => [json.lead, ...prev])
      setShowAddDialog(false)
      setLeadForm(EMPTY_LEAD_FORM)
      toast({ title: 'Lead added', description: `${leadForm.name} has been added.`, variant: 'success' })
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Failed to add lead', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAddingLead(false)
    }
  }

  const assignLeads = async (isReassign = false) => {
    if (!selectedCounsellorId || selectedIds.size === 0) return
    setAssigning(true)

    const selectedLeadsList = leads.filter((l) => selectedIds.has(l.id))
    const counsellor = counsellors.find((c) => c.id === selectedCounsellorId)

    try {
      await (supabase as any)
        .from('leads')
        .update({ assigned_to: selectedCounsellorId, updated_at: new Date().toISOString() })
        .in('id', Array.from(selectedIds))

      const historyRows = selectedLeadsList.map((lead) => ({
        lead_id: lead.id,
        college_id: collegeId,
        assigned_from: lead.assigned_to || null,
        assigned_to: selectedCounsellorId,
        assigned_by: adminId,
        reason: reason || null,
      }))
      await (supabase as any).from('lead_assignment_history').insert(historyRows)

      if (selectedIds.size === 1) {
        const lead = selectedLeadsList[0]
        await (supabase as any).from('notifications').insert({
          user_id: selectedCounsellorId,
          college_id: collegeId,
          type: isReassign ? 'reassigned' : 'new_lead',
          message: `${isReassign ? 'Lead reassigned to you' : 'New lead assigned'}: ${lead.name}`,
          lead_id: lead.id,
        })
      } else {
        await (supabase as any).from('notifications').insert({
          user_id: selectedCounsellorId,
          college_id: collegeId,
          type: 'bulk_leads',
          message: `${selectedIds.size} leads ${isReassign ? 'reassigned' : 'assigned'} to you`,
          bulk_count: selectedIds.size,
        })
      }

      setLeads((prev) =>
        prev.map((l) =>
          selectedIds.has(l.id)
            ? { ...l, assigned_to: selectedCounsellorId, assigned_user: { id: selectedCounsellorId, name: counsellor?.name || '', email: '' } }
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
    } catch {
      toast({ title: 'Assignment failed', description: 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const autoDistribute = async () => {
    if (counsellors.length === 0 || selectedIds.size === 0) return
    setAssigning(true)

    const leadIds = Array.from(selectedIds)
    const assignments: Record<string, string[]> = {}

    leadIds.forEach((id, idx) => {
      const counsellor = counsellors[idx % counsellors.length]
      if (!assignments[counsellor.id]) assignments[counsellor.id] = []
      assignments[counsellor.id].push(id)
    })

    try {
      for (const [counsellorId, ids] of Object.entries(assignments)) {
        await (supabase as any)
          .from('leads')
          .update({ assigned_to: counsellorId, updated_at: new Date().toISOString() })
          .in('id', ids)

        const selectedLeadsList = leads.filter((l) => ids.includes(l.id))
        const historyRows = selectedLeadsList.map((lead) => ({
          lead_id: lead.id,
          college_id: collegeId,
          assigned_from: lead.assigned_to || null,
          assigned_to: counsellorId,
          assigned_by: adminId,
          reason: 'Auto-distributed',
        }))
        await (supabase as any).from('lead_assignment_history').insert(historyRows)

        await (supabase as any).from('notifications').insert({
          user_id: counsellorId,
          college_id: collegeId,
          type: 'bulk_leads',
          message: `${ids.length} leads auto-assigned to you`,
          bulk_count: ids.length,
        })
      }

      setLeads((prev) =>
        prev.map((l) => {
          for (const [counsellorId, ids] of Object.entries(assignments)) {
            if (ids.includes(l.id)) {
              const c = counsellors.find((c) => c.id === counsellorId)
              return { ...l, assigned_to: counsellorId, assigned_user: { id: counsellorId, name: c?.name || '', email: '' } }
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
    } catch {
      toast({ title: 'Distribution failed', description: 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const hasReassignableSelected = Array.from(selectedIds).some(
    (id) => leads.find((l) => l.id === id)?.assigned_to
  )

  const unassignedCount = leads.filter((l) => !l.assigned_to).length

  return (
    <>
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {leads.length.toLocaleString()} total leads
              {unassignedCount > 0 && (
                <span className="ml-2 text-orange-600 font-medium">· {unassignedCount} unassigned</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoDistribute}
                  disabled={assigning || counsellors.length === 0}
                  className="gap-1.5"
                >
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  Auto-Distribute
                </Button>
                {hasReassignableSelected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReassignDialog(true)}
                    className="gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    Reassign
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowAssignDialog(true)}
                  disabled={assigning}
                  className="gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
            <Link href="/admin/leads/import">
              <Button size="sm" className="gap-1.5">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 bg-white px-4 rounded-t-xl -mb-px">
          {(['all', 'unassigned'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'all' ? (
                <><Users className="h-3.5 w-3.5" /> All Leads</>
              ) : (
                <><CircleAlert className="h-3.5 w-3.5" /> Unassigned</>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab === 'all' ? leads.length : unassignedCount}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <SlidersHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Lead Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={counsellorFilter} onValueChange={setCounsellorFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Counsellor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Counsellors</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {counsellors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="Hot">Hot</SelectItem>
              <SelectItem value="Warm">Warm</SelectItem>
              <SelectItem value="Cold">Cold</SelectItem>
            </SelectContent>
          </Select>
          {(search || stageFilter !== 'all' || counsellorFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStageFilter('all'); setCounsellorFilter('all'); setPriorityFilter('all') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Users className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium">No leads found</p>
                        <p className="text-xs mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => {
                    const isOverdue = lead.follow_up_date && lead.follow_up_date <= today
                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-blue-50/30 transition-colors group ${
                          selectedIds.has(lead.id) ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleSelect(lead.id)}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="font-semibold text-gray-900 leading-snug">{lead.name}</p>
                            {lead.city && <p className="text-xs text-gray-400 mt-0.5">{lead.city}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-gray-700 text-[13px]">{lead.phone}</p>
                          {lead.email && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{lead.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-gray-700 text-[13px]">{lead.course_interest || <span className="text-gray-300">—</span>}</p>
                          {lead.source_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{lead.source_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                              {lead.current_lead_stage}
                            </span>
                            {lead.current_call_stage && (
                              <div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100 text-gray-700'}`}>
                                  {lead.current_call_stage}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[lead.priority] || 'bg-gray-300'}`} />
                            <span className="text-[13px] text-gray-700 font-medium">{lead.priority}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {lead.assigned_user ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {lead.assigned_user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[13px] text-gray-700">{lead.assigned_user.name}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {lead.follow_up_date ? (
                            <span className={`text-xs font-medium ${
                              isOverdue ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {isOverdue && '⚠ '}{formatDate(lead.follow_up_date)}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={`tel:${lead.phone}`}
                              title="Call"
                              className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                            <a
                              href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <Link
                              href={`/admin/leads/${lead.id}`}
                              title="View"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing <span className="font-medium text-gray-700">{filtered.length.toLocaleString()}</span> of{' '}
                <span className="font-medium text-gray-700">{leads.length.toLocaleString()}</span> leads
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">· {selectedIds.size} selected</span>
                )}
              </span>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-gray-600">
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Add Lead Dialog */}
    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="lead-name"
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                placeholder="Rahul Kumar"
                required
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-phone">Phone <span className="text-red-500">*</span></Label>
              <Input
                id="lead-phone"
                value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                placeholder="9876543210"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                placeholder="rahul@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-city">City</Label>
              <Input
                id="lead-city"
                value={leadForm.city}
                onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                placeholder="Chennai"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-course">Course Interest</Label>
              <Input
                id="lead-course"
                value={leadForm.course_interest}
                onChange={(e) => setLeadForm({ ...leadForm, course_interest: e.target.value })}
                placeholder="B.Tech CSE"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={leadForm.priority} onValueChange={(v) => setLeadForm({ ...leadForm, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hot">Hot</SelectItem>
                  <SelectItem value="Warm">Warm</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sources.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label>Source</Label>
                <Select value={leadForm.source_id} onValueChange={(v) => setLeadForm({ ...leadForm, source_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-notes">Notes</Label>
              <Input
                id="lead-notes"
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button type="submit" disabled={addingLead}>
              {addingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Assign Dialog */}
    <Dialog open={showAssignDialog} onOpenChange={(open) => { setShowAssignDialog(open); if (!open) { setSelectedCounsellorId(''); setReason('') } }}>
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
    <Dialog open={showReassignDialog} onOpenChange={(open) => { setShowReassignDialog(open); if (!open) { setSelectedCounsellorId(''); setReason('') } }}>
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
    </>
  )
}
