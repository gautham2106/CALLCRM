'use client'

import { useState, useEffect, useCallback } from 'react'
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
  LEAD_STAGES,
  formatDate,
  todayIST,
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
  Building2,
  Calendar,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Tag,
  AlertTriangle,
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
  school_name: string | null
  course_interest: string | null
  course_id: string | null
  source_name: string | null
  current_lead_stage: string
  current_call_stage: string | null
  visit_date: string | null
  follow_up_date: string | null
  is_active: boolean
  created_at: string
  assigned_to: string | null
  assigned_user: { id: string; name: string; email: string } | null
}

interface CustomFieldDef {
  id: string
  field_name: string
  field_type: string
  is_required: boolean
  dropdown_options: string[] | null
}

interface Props {
  counsellors: { id: string; name: string; email: string }[]
  sources: { id: string; source_name: string }[]
  courses: { id: string; course_name: string }[]
  customFields: CustomFieldDef[]
  schools: string[]
  collegeId: string
  adminId: string
  userRole?: string
  initialSourceFilter?: string
}

const PAGE_SIZE = 50
const EMPTY_LEAD_FORM = { name: '', phone: '', email: '', city: '', course_id: '', source_id: '', notes: '' }

export function AdminLeadsClient({ counsellors, sources, courses, customFields, schools, collegeId, adminId, userRole, initialSourceFilter }: Props) {
  const supabase = createClient()

  // ---- Server-side paginated lead state ----
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [unassignedTotal, setUnassignedTotal] = useState(0)
  const [visitsOverdueTotal, setVisitsOverdueTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // ---- Filter state ----
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [counsellorFilter, setCounsellorFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState(initialSourceFilter || 'all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'visits'>('all')
  const [page, setPage] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [selectAllMatching, setSelectAllMatching] = useState(false)
  const [loadingIds, setLoadingIds] = useState(false)

  // ---- UI state ----
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingLead, setAddingLead] = useState(false)
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null)

  // ---- Assignment state ----
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [selectedCounsellorId, setSelectedCounsellorId] = useState('')
  const [reason, setReason] = useState('')
  const [assigning, setAssigning] = useState(false)

  // ---- Bulk state ----
  const [showBulkStageDialog, setShowBulkStageDialog] = useState(false)
  const [bulkStageValue, setBulkStageValue] = useState('')
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const today = todayIST()
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ---- Debounce search ----
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // ---- Build API params from current filter state ----
  const buildParams = useCallback((overridePage?: number, forceExport?: boolean) => {
    const p = new URLSearchParams({
      page: String(overridePage ?? page),
      limit: String(PAGE_SIZE),
    })
    if (showAll || forceExport) p.set('export', 'true')
    if (debouncedSearch)           p.set('search', debouncedSearch)
    if (stageFilter !== 'all')     p.set('stage', stageFilter)
    if (counsellorFilter !== 'all') p.set('counsellor', counsellorFilter)
    if (activeTab === 'unassigned') p.set('tab', 'unassigned')
    if (activeTab === 'visits') p.set('tab', 'visits')

    // Resolve source ID → source name for the API
    if (sourceFilter !== 'all') {
      if (sourceFilter === '__none__') {
        p.set('source', '__none__')
      } else {
        const name = sources.find((s) => s.id === sourceFilter)?.source_name
        if (name) p.set('source', name)
      }
    }
    if (courseFilter !== 'all') {
      p.set('course', courseFilter === '__none__' ? '__none__' : courseFilter)
    }
    if (schoolFilter !== 'all') {
      p.set('school', schoolFilter)
    }
    return p
  }, [page, showAll, debouncedSearch, stageFilter, counsellorFilter, sourceFilter, courseFilter, schoolFilter, activeTab, sources])

  // ---- Core fetch function ----
  const fetchLeads = useCallback(async (overridePage?: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/leads?${buildParams(overridePage)}`)
      if (!res.ok) throw new Error('Failed to load leads')
      const json = await res.json()
      setLeads(json.leads || [])
      setTotal(json.total || 0)
      setUnassignedTotal(json.unassigned_total || 0)
      setVisitsOverdueTotal(json.visits_overdue_total || 0)
    } catch {
      toast({ title: 'Failed to load leads', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // ---- Fetch on filter / page change ----
  useEffect(() => {
    // Clear select-all-matching whenever filters or page change
    setSelectAllMatching(false)
    fetchLeads()
  }, [fetchLeads])

  // ---- Reset page to 0 and exit showAll when filters change ----
  const resetPage = () => { setPage(0); setShowAll(false) }

  // ---- Fetch ALL matching IDs (for Select All Matching across pages) ----
  const fetchAllIds = useCallback(async () => {
    setLoadingIds(true)
    try {
      const p = buildParams(0)
      p.set('ids_only', 'true')
      const res = await fetch(`/api/admin/leads?${p}`)
      const json = await res.json()
      setSelectedIds(new Set(json.ids || []))
      setSelectAllMatching(true)
    } catch {
      toast({ title: 'Failed to select all leads', variant: 'destructive' })
    } finally {
      setLoadingIds(false)
    }
  }, [buildParams])

  // ---- Selection helpers ----
  const toggleSelect = (id: string) => {
    setSelectAllMatching(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // True when every lead on the current page is in the selection set
  const allCurrentPageSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id))

  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      // Deselect only the current page — preserve other-page selections
      setSelectedIds((prev) => {
        const next = new Set(prev)
        leads.forEach((l) => next.delete(l.id))
        return next
      })
      setSelectAllMatching(false)
    } else {
      // Add all current-page leads to the selection
      setSelectedIds((prev) => {
        const next = new Set(prev)
        leads.forEach((l) => next.add(l.id))
        return next
      })
    }
  }

  // ---- Export all matching leads (bypasses pagination) ----
  const exportCSV = async () => {
    const p = buildParams(0, true) // forceExport=true
    try {
      const res = await fetch(`/api/admin/leads?${p}`)
      const json = await res.json()

      const fieldDefs: { id: string; field_name: string; display_order: number }[] =
        json.custom_field_definitions || []
      const fieldValues: { lead_id: string; field_id: string; value: string | null }[] =
        json.custom_field_values || []

      // Build lookup: lead_id -> { field_id -> value }
      const valueLookup: Record<string, Record<string, string>> = {}
      for (const fv of fieldValues) {
        if (!valueLookup[fv.lead_id]) valueLookup[fv.lead_id] = {}
        valueLookup[fv.lead_id][fv.field_id] = fv.value || ''
      }

      const rows = (json.leads || []).map((l: Lead) => {
        const customCols: Record<string, string> = {}
        for (const fd of fieldDefs) {
          customCols[fd.field_name] = valueLookup[l.id]?.[fd.id] || ''
        }
        return {
          Name: l.name, Phone: l.phone, Email: l.email || '', City: l.city || '',
          School: l.school_name || '', Course: l.course_interest || '', Source: l.source_name || '',
          'Lead Stage': l.current_lead_stage, 'Call Stage': l.current_call_stage || '',
          'Visit Date': l.visit_date || '', 'Follow-up Date': l.follow_up_date || '',
          'Assigned To': l.assigned_user?.name || 'Unassigned',
          'Created At': formatDate(l.created_at),
          ...customCols,
        }
      })
      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${today}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export ready', description: `${rows.length} leads exported.` })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  // ---- Add lead ----
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingLead(true)
    try {
      const source = sources.find((s) => s.id === leadForm.source_id)
      const course = courses.find((c) => c.id === leadForm.course_id)
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          source_name: source?.source_name || null,
          source_id: leadForm.source_id || null,
          course_id: leadForm.course_id || null,
          course_interest: course?.course_name || null,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        toast({ title: 'Duplicate phone number', description: json.error, variant: 'destructive' })
        return
      }
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      // Save custom field values if any
      if (customFields.length > 0 && json.lead?.id) {
        const cfValues = customFields
          .filter((f) => customFieldValues[f.id] && String(customFieldValues[f.id]).trim())
          .map((f) => ({
            lead_id: json.lead.id,
            field_id: f.id,
            college_id: collegeId,
            value: String(customFieldValues[f.id]),
            updated_by: adminId,
          }))
        if (cfValues.length > 0) {
          await supabase.from('custom_field_values').insert(cfValues)
        }
      }

      setShowAddDialog(false)
      setLeadForm(EMPTY_LEAD_FORM)
      setCustomFieldValues({})
      setPhoneWarning(null)
      toast({ title: 'Lead added', description: `${leadForm.name} has been added.`, variant: 'success' })
      // Refetch page 0 to show the new lead at the top
      setPage(0)
      fetchLeads(0)
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Failed to add lead', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAddingLead(false)
    }
  }

  // ---- Assign / Reassign ----
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
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
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
      fetchLeads()
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Assignment failed', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  // ---- Auto-distribute ----
  const autoDistribute = async () => {
    if (counsellors.length === 0 || selectedIds.size === 0) return
    setAssigning(true)
    const leadIds = Array.from(selectedIds)
    try {
      const res = await fetch('/api/admin/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds, counsellors }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
      toast({
        title: 'Auto-distributed!',
        description: `${leadIds.length} leads distributed equally among ${counsellors.length} counsellors`,
        variant: 'success',
      })
      setSelectedIds(new Set())
      fetchLeads()
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Distribution failed', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  // ---- Bulk stage change ----
  const bulkChangeStage = async () => {
    if (!bulkStageValue || selectedIds.size === 0) return
    setBulkProcessing(true)
    const { error } = await supabase
      .from('leads')
      .update({ current_lead_stage: bulkStageValue })
      .in('id', Array.from(selectedIds))
      .eq('college_id', collegeId)
    if (!error) {
      toast({ title: `${selectedIds.size} leads moved to "${bulkStageValue}"`, variant: 'success' })
      setSelectedIds(new Set())
      setBulkStageValue('')
      setShowBulkStageDialog(false)
      fetchLeads()
    } else {
      toast({ title: 'Failed to update leads', description: error.message, variant: 'destructive' })
    }
    setBulkProcessing(false)
  }

  // ---- Bulk delete ----
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkProcessing(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      toast({ title: `${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''} permanently deleted`, variant: 'success' })
      setSelectedIds(new Set())
      setShowBulkDeleteDialog(false)
      fetchLeads()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      toast({ title: 'Failed to delete leads', description: message, variant: 'destructive' })
    }
    setBulkProcessing(false)
  }

  const hasReassignableSelected = Array.from(selectedIds).some(
    (id) => leads.find((l) => l.id === id)?.assigned_to
  )

  return (
    <>
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : (
                <>
                  {total.toLocaleString()} total
                  {unassignedTotal > 0 && (
                    <span className="ml-2 text-orange-600 font-medium">· {unassignedTotal.toLocaleString()} unassigned</span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                  <Button variant="outline" size="sm" onClick={() => setShowReassignDialog(true)} className="gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Reassign
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowAssignDialog(true)} disabled={assigning} className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Assign {selectedIds.size}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBulkStageDialog(true)} className="gap-1.5">
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline">Change Stage</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}
            {userRole === 'admin' && (
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
            <Link href="/admin/leads/import">
              <Button size="sm" className="gap-1.5">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 bg-white px-4 rounded-t-xl -mb-px">
          <button
            onClick={() => { setActiveTab('all'); resetPage() }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> All Leads
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {total.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('unassigned'); resetPage() }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'unassigned'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CircleAlert className="h-3.5 w-3.5" /> Unassigned
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === 'unassigned' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {unassignedTotal.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('visits'); resetPage() }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'visits'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CalendarX className="h-3.5 w-3.5" /> Visit Follow-up
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === 'visits'
                ? 'bg-orange-100 text-orange-700'
                : visitsOverdueTotal > 0
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {visitsOverdueTotal.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <SlidersHorizontal className="h-4 w-4 text-gray-400 shrink-0 hidden sm:block" />
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage() }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); resetPage() }}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={counsellorFilter} onValueChange={(v) => { setCounsellorFilter(v); resetPage() }}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue placeholder="Counsellor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counsellors</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {counsellors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {sources.length > 0 && (
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); resetPage() }}>
                <SelectTrigger className="w-full sm:w-40 h-9">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="__none__">Unknown / No Source</SelectItem>
                  {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {courses.length > 0 && (
              <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); resetPage() }}>
                <SelectTrigger className="w-full sm:w-40 h-9">
                  <SelectValue placeholder="Course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  <SelectItem value="__none__">No Course</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {schools.length > 0 && (
              <Select value={schoolFilter} onValueChange={(v) => { setSchoolFilter(v); resetPage() }}>
                <SelectTrigger className="w-full sm:w-40 h-9">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {schools.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {(search || stageFilter !== 'all' || counsellorFilter !== 'all' || sourceFilter !== 'all' || courseFilter !== 'all' || schoolFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setStageFilter('all'); setCounsellorFilter('all'); setSourceFilter('all'); setCourseFilter('all'); setSchoolFilter('all'); resetPage() }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Visit Follow-up info banner */}
        {activeTab === 'visits' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-start gap-2 text-sm text-orange-800">
            <CalendarX className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>Visit Follow-up required:</strong> These leads had a visit scheduled on a past date but are still marked as &quot;Visit Scheduled&quot;.
              Ask the counsellor to update the stage to <strong>Visit Done</strong> (visit happened) or <strong>No Show</strong> (lead didn&apos;t arrive).
            </span>
          </div>
        )}

        {/* Select All Matching banner */}
        {selectedIds.size > 0 && total > leads.length && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
            {selectAllMatching ? (
              <span className="text-blue-700 font-medium">
                All <strong>{selectedIds.size.toLocaleString()}</strong> matching leads selected
              </span>
            ) : (
              <span className="text-blue-700">
                <strong>{selectedIds.size}</strong> lead{selectedIds.size > 1 ? 's' : ''} selected
              </span>
            )}
            {selectAllMatching ? (
              <button
                onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false) }}
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                Clear selection
              </button>
            ) : (
              <button
                onClick={fetchAllIds}
                disabled={loadingIds}
                className="text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-1"
              >
                {loadingIds && <Loader2 className="h-3 w-3 animate-spin" />}
                Select all {total.toLocaleString()} matching leads
              </button>
            )}
          </div>
        )}

        {/* Mobile: Card Grid */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-12 text-gray-400">
              <Users className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No leads found</p>
            </div>
          ) : (
            <>
              {/* Mobile toolbar — top */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span>{showAll ? `${total.toLocaleString()} leads` : `${(page * PAGE_SIZE + 1)}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`}</span>
                  </label>
                  {selectedIds.size > 0 && (
                    <span className="text-blue-600 font-medium">{selectedIds.size} selected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {total > PAGE_SIZE && (
                    <button
                      onClick={() => { setShowAll((v) => !v); setPage(0) }}
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      {showAll ? 'Paginate' : 'Show all'}
                    </button>
                  )}
                  {!showAll && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="px-1 font-medium text-gray-700">{page + 1} / {totalPages}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1 || loading}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {leads.map((lead) => {
                const isOverdue  = lead.follow_up_date && lead.follow_up_date < today
                const isVisitToday = lead.visit_date === today
                return (
                  <div
                    key={lead.id}
                    className={`bg-white rounded-xl border p-4 space-y-3 ${
                      selectedIds.has(lead.id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                            {lead.current_lead_stage}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                        {lead.city && <p className="text-xs text-gray-400">{lead.city}</p>}
                        {lead.school_name && <p className="text-xs text-gray-400">{lead.school_name}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.current_call_stage && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CALL_STAGE_COLORS[lead.current_call_stage]}`}>
                          {lead.current_call_stage}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{lead.assigned_user ? (
                        <span className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                            {lead.assigned_user.name.charAt(0)}
                          </div>
                          {lead.assigned_user.name}
                        </span>
                      ) : (
                        <span className="text-orange-500 font-medium">Unassigned</span>
                      )}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        {lead.visit_date && (
                          <span className={`flex items-center gap-1 ${isVisitToday ? 'text-purple-600 font-medium' : 'text-gray-400'}`}>
                            <Building2 className="h-3 w-3" />
                            Visit: {formatDate(lead.visit_date)}
                          </span>
                        )}
                        {lead.follow_up_date && (
                          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(lead.follow_up_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <a href={`tel:${lead.phone}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 text-green-700 border-green-200">
                          <Phone className="h-3.5 w-3.5" /> Call
                        </Button>
                      </a>
                      <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 text-green-600">
                          <MessageCircle className="h-3.5 w-3.5" /> WA
                        </Button>
                      </a>
                      <Link href={`/admin/leads/${lead.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Desktop: Table */}
        <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table toolbar: count + show-all toggle + pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs text-gray-500">
                {showAll
                  ? `${total.toLocaleString()} leads`
                  : `${(page * PAGE_SIZE + 1).toLocaleString()}–${Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()}`}
              </span>
              <div className="flex items-center gap-3">
                {!showAll && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium text-gray-600 px-1">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1 || loading}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {total > PAGE_SIZE && (
                  <button
                    onClick={() => { setShowAll((v) => !v); setPage(0) }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    {showAll ? 'Paginate' : `Show all ${total.toLocaleString()}`}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                      </div>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
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
                  leads.map((lead) => {
                    const isOverdue = lead.follow_up_date && lead.follow_up_date <= today
                    const isVisitToday = lead.visit_date === today
                    const isVisitOverdue = lead.visit_date && lead.visit_date < today
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
                            {lead.school_name && <p className="text-xs text-gray-400 mt-0.5">{lead.school_name}</p>}
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
                          {lead.visit_date ? (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              isVisitOverdue ? 'text-red-600' : isVisitToday ? 'text-purple-600' : 'text-gray-500'
                            }`}>
                              <Building2 className="h-3 w-3" />
                              {isVisitToday ? 'Today' : formatDate(lead.visit_date)}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
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
                          <div className="flex items-center gap-1">
                            <a href={`tel:${lead.phone}`} title="Call" className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                              <Phone className="h-4 w-4" />
                            </a>
                            <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <Link href={`/admin/leads/${lead.id}`} title="View" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
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

          {/* Pagination footer (hidden when showing all) */}
          {total > 0 && !showAll && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing{' '}
                <span className="font-medium text-gray-700">
                  {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()}
                </span>{' '}
                of <span className="font-medium text-gray-700">{total.toLocaleString()}</span> leads
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">· {selectedIds.size} selected</span>
                )}
                {selectedIds.size > 0 && (
                  <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-gray-400 hover:text-gray-600 underline">
                    Clear
                  </button>
                )}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-gray-700">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1 || loading}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Add Lead Dialog */}
    <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setLeadForm(EMPTY_LEAD_FORM); setCustomFieldValues({}); setPhoneWarning(null) } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
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
                onChange={(e) => {
                  const phone = e.target.value
                  setLeadForm({ ...leadForm, phone })
                  if (phone.length >= 6) {
                    const norm = phone.replace(/\D/g, '')
                    const dup = leads.find((l) => l.phone.replace(/\D/g, '') === norm)
                    setPhoneWarning(dup ? `Duplicate on this page: "${dup.name}" already has this number` : null)
                  } else {
                    setPhoneWarning(null)
                  }
                }}
                placeholder="9876543210"
                required
                className={phoneWarning ? 'border-orange-400 focus-visible:ring-orange-300' : ''}
              />
              {phoneWarning && (
                <p className="text-xs text-orange-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />{phoneWarning}
                </p>
              )}
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
            {courses.length > 0 && (
              <div className="space-y-1.5">
                <Label>Course Interest</Label>
                <Select value={leadForm.course_id} onValueChange={(v) => setLeadForm({ ...leadForm, course_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sources.length > 0 && (
              <div className="space-y-1.5">
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
            {customFields.length > 0 && (
              <div className="col-span-2 pt-1 space-y-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Custom Fields</p>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-sm">
                      {field.field_name}
                      {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    {field.field_type === 'dropdown' ? (
                      <Select
                        value={customFieldValues[field.id] || '__none__'}
                        onValueChange={(v) => setCustomFieldValues({ ...customFieldValues, [field.id]: v === '__none__' ? '' : v })}
                      >
                        <SelectTrigger><SelectValue placeholder={`Select ${field.field_name}`} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select —</SelectItem>
                          {(field.dropdown_options || []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : field.field_type === 'textarea' ? (
                      <Textarea
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                        placeholder={`Enter ${field.field_name}`}
                        className="min-h-[60px]"
                      />
                    ) : field.field_type === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`cf-${field.id}`}
                          checked={customFieldValues[field.id] === 'true'}
                          onCheckedChange={(c) => setCustomFieldValues({ ...customFieldValues, [field.id]: c ? 'true' : 'false' })}
                        />
                        <label htmlFor={`cf-${field.id}`} className="text-sm text-gray-600 cursor-pointer">{field.field_name}</label>
                      </div>
                    ) : (
                      <Input
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'phone' ? 'tel' : field.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                        placeholder={`Enter ${field.field_name}`}
                        required={field.is_required}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
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
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

    {/* Bulk Change Stage Dialog */}
    <Dialog open={showBulkStageDialog} onOpenChange={(open) => { setShowBulkStageDialog(open); if (!open) setBulkStageValue('') }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Stage for {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>New Stage</Label>
          <Select value={bulkStageValue} onValueChange={setBulkStageValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select a stage..." />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowBulkStageDialog(false)}>Cancel</Button>
          <Button onClick={bulkChangeStage} disabled={!bulkStageValue || bulkProcessing}>
            {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Apply to {selectedIds.size} Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk Delete Confirmation Dialog */}
    <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 py-2">
          This will remove {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} from your system.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={bulkDelete}
            disabled={bulkProcessing}
            className="gap-1.5"
          >
            {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete {selectedIds.size} Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
