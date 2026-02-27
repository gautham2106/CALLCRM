'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import {
  UserPlus, Mail, Phone, Eye, Loader2, Users, Upload, Plus,
  Building2, AlertCircle, CheckCircle, ArrowRight, X, FileText, AlertTriangle,
} from 'lucide-react'

interface CounsellorLead {
  id: string
  is_active: boolean | null
  current_lead_stage: string
  current_call_stage: string | null
  visit_date: string | null
  follow_up_date: string | null
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

interface CustomFieldDef {
  id: string
  field_name: string
  field_type: string
  is_required: boolean
  dropdown_options: string[] | null
}

interface Props {
  initialCounsellors: Counsellor[]
  collegeId: string
  adminId: string
  sources: { id: string; source_name: string }[]
  courses: { id: string; course_name: string }[]
  customFields: CustomFieldDef[]
  unassignedCount: number
}

// Static mappable fields — source + course are batch-level dropdowns, not per-row
const STATIC_CSV_FIELDS = [
  { key: 'name',       label: 'Name',                    required: true  },
  { key: 'phone',      label: 'Phone',                   required: true  },
  { key: 'email',      label: 'Email',                   required: false },
  { key: 'city',       label: 'City',                    required: false },
  { key: 'visit_date', label: 'Visit Date (YYYY-MM-DD)', required: false },
  { key: 'notes',      label: 'Notes',                   required: false },
]

const EMPTY_SINGLE = { name: '', phone: '', email: '', city: '', course_id: '', source_id: '', notes: '' }

type SortKey = 'enrolled' | 'conversion' | 'assigned' | 'notCalled' | 'interested'

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  { key: 'enrolled', label: 'Enrolled', desc: 'Results' },
  { key: 'conversion', label: 'Conversion %', desc: 'Efficiency' },
  { key: 'assigned', label: 'Assigned', desc: 'Workload' },
  { key: 'notCalled', label: 'Not Called', desc: 'At Risk' },
  { key: 'interested', label: 'Interested', desc: 'Warm Pipeline' },
]

function getCounsellorSortValue(c: Counsellor, key: SortKey, today: string): number {
  // Exclude soft-deleted leads (is_active = false) from all stats
  const leads = (c.assigned_leads || []).filter((l) => l.is_active !== false)
  const enrolled = leads.filter((l) => l.current_lead_stage === 'Enrolled').length
  switch (key) {
    case 'enrolled': return enrolled
    case 'conversion': return leads.length > 0 ? enrolled / leads.length : 0
    case 'assigned': return leads.length
    case 'notCalled': return leads.filter((l) => l.current_call_stage === null).length
    case 'interested': return leads.filter((l) => l.current_call_stage === 'Interested').length
    default: return 0
  }
}

export function CounsellorsClient({ initialCounsellors, collegeId, adminId, sources, courses, customFields, unassignedCount }: Props) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  // All mappable fields: static + custom (computed once per render, stable reference via memo not needed at module level)
  const allCsvFields = [
    ...STATIC_CSV_FIELDS,
    ...customFields.map((f) => ({ key: `custom_${f.id}`, label: f.field_name, required: f.is_required })),
  ]

  const [counsellors, setCounsellors] = useState(initialCounsellors)
  const [sortBy, setSortBy] = useState<SortKey>('enrolled')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', pin: '' })

  // Add Leads modal state
  const [addLeadsTarget, setAddLeadsTarget] = useState<Counsellor | null>(null)

  // Single lead form
  const [singleForm, setSingleForm] = useState(EMPTY_SINGLE)
  const [singleCustomValues, setSingleCustomValues] = useState<Record<string, string>>({})
  const [addingSingle, setAddingSingle] = useState(false)
  const [singlePhoneWarning, setSinglePhoneWarning] = useState<string | null>(null)

  // CSV import state
  const [csvStep, setCsvStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [csvDuplicates, setCsvDuplicates] = useState<string[]>([])
  const [csvImportableCount, setCsvImportableCount] = useState(0)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState({ imported: 0, skipped: 0 })
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([])
  const [csvSelectedSourceId, setCsvSelectedSourceId] = useState<string>('__none__')
  const [csvSelectedCourseId, setCsvSelectedCourseId] = useState<string>('__none__')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetAddLeads = () => {
    setSingleForm(EMPTY_SINGLE)
    setSingleCustomValues({})
    setSinglePhoneWarning(null)
    setCsvStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setColumnMap({})
    setCsvDuplicates([])
    setCsvImportableCount(0)
    setCsvResult({ imported: 0, skipped: 0 })
    setCsvPreview([])
    setCsvSelectedSourceId('__none__')
    setCsvSelectedCourseId('__none__')
  }

  const openAddLeads = (c: Counsellor) => {
    resetAddLeads()
    setAddLeadsTarget(c)
  }

  // Add counsellor
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/admin/counsellors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, pin: form.pin }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      setCounsellors((prev) => [{ ...json.user, assigned_leads: [] } as Counsellor, ...prev])
      setShowAddDialog(false)
      setForm({ name: '', email: '', phone: '', pin: '' })
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

  // Single lead add
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addLeadsTarget) return
    setAddingSingle(true)
    try {
      const source = sources.find((s) => s.id === singleForm.source_id)
      const course = courses.find((c) => c.id === singleForm.course_id)
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...singleForm,
          source_name: source?.source_name || null,
          source_id: singleForm.source_id || null,
          course_id: singleForm.course_id || null,
          course_interest: course?.course_name || null,
          assigned_to: addLeadsTarget.id,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        toast({ title: 'Duplicate phone number', description: json.error, variant: 'destructive' })
        setAddingSingle(false)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')

      // Save custom field values if any
      if (customFields.length > 0 && json.lead?.id) {
        const cfValues = customFields
          .filter((f) => singleCustomValues[f.id] && String(singleCustomValues[f.id]).trim())
          .map((f) => ({
            lead_id: json.lead.id,
            field_id: f.id,
            college_id: collegeId,
            value: String(singleCustomValues[f.id]),
            updated_by: adminId,
          }))
        if (cfValues.length > 0) {
          await supabase.from('custom_field_values').insert(cfValues)
        }
      }

      // Update counsellor's lead count in state
      setCounsellors((prev) => prev.map((c) =>
        c.id === addLeadsTarget.id
          ? { ...c, assigned_leads: [...c.assigned_leads, { id: json.lead.id, is_active: true, current_lead_stage: 'New Enquiry', current_call_stage: null, visit_date: null, follow_up_date: null }] }
          : c
      ))
      setSingleForm(EMPTY_SINGLE)
      setSingleCustomValues({})
      setSinglePhoneWarning(null)
      toast({ title: 'Lead added', description: `${singleForm.name} assigned to ${addLeadsTarget.name}.`, variant: 'success' })
      setAddLeadsTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Failed to add lead', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAddingSingle(false)
    }
  }

  // Parse and apply headers/rows regardless of file type
  const applyParsedData = (headers: string[], rows: Record<string, string>[]) => {
    const trimmedHeaders = headers.map((h) => h.trim())
    // Normalize row keys to trimmed headers so columnMap lookups always work
    const normalizedRows = rows.map((row) => {
      const norm: Record<string, string> = {}
      headers.forEach((h, i) => { norm[trimmedHeaders[i]] = String(row[h] ?? '') })
      return norm
    })
    setCsvHeaders(trimmedHeaders)
    setCsvRows(normalizedRows)

    const autoMap: Record<string, string> = {}
    allCsvFields.forEach((field) => {
      const match = trimmedHeaders.find(
        (h) =>
          h.toLowerCase() === field.label.toLowerCase() ||
          h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
      )
      if (match) autoMap[field.key] = match
    })
    setColumnMap(autoMap)
    setCsvStep('map')
  }

  // CSV / Excel parse
  const handleCsvFile = (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
          if (!raw.length) {
            toast({ title: 'Empty file', description: 'The Excel file has no data.', variant: 'destructive' })
            return
          }
          const headers = raw[0].map((h) => String(h ?? ''))
          const rows = raw.slice(1)
            .filter((r) => r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
            .map((r) => {
              const obj: Record<string, string> = {}
              headers.forEach((h, i) => { obj[h] = String(r[i] ?? '') })
              return obj
            })
          applyParsedData(headers, rows)
        } catch {
          toast({ title: 'Parse error', description: 'Could not read the Excel file.', variant: 'destructive' })
        }
      }
      reader.onerror = () => toast({ title: 'Read error', description: 'Could not open the file.', variant: 'destructive' })
      reader.readAsBinaryString(file)
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          applyParsedData(result.meta.fields || [], result.data as Record<string, string>[])
        },
        error: () => toast({ title: 'Parse error', description: 'Could not read the CSV file.', variant: 'destructive' }),
      })
    }
  }

  const generateCsvPreview = async () => {
    const nameCol = columnMap['name']
    const phoneCol = columnMap['phone']
    if (!nameCol || !phoneCol) {
      toast({ title: 'Required fields missing', description: 'Map Name and Phone columns.', variant: 'destructive' })
      return
    }

    // Deduplicate within the CSV first (first occurrence wins)
    const seenInCsv = new Set<string>()
    const uniquePhones: string[] = []
    csvRows.forEach((r) => {
      const p = r[phoneCol]
      if (p && !seenInCsv.has(p)) { seenInCsv.add(p); uniquePhones.push(p) }
    })

    const { data: existing } = await supabase
      .from('leads')
      .select('phone')
      .eq('college_id', collegeId)
      .in('phone', uniquePhones)

    const existingPhones = new Set((existing || []).map((l: { phone: string }) => l.phone))
    setCsvDuplicates([...existingPhones])
    setCsvImportableCount(uniquePhones.length - existingPhones.size)

    const preview = csvRows.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {}
      allCsvFields.forEach((field) => {
        if (columnMap[field.key]) mapped[field.label] = row[columnMap[field.key]] || ''
      })
      return mapped
    })
    setCsvPreview(preview)
    setCsvStep('preview')
  }

  const handleCsvImport = async () => {
    if (!addLeadsTarget) return
    setCsvImporting(true)
    const phoneCol = columnMap['phone']
    const sourceEntry = csvSelectedSourceId !== '__none__' ? sources.find((s) => s.id === csvSelectedSourceId) : null
    const courseEntry = csvSelectedCourseId !== '__none__' ? courses.find((c) => c.id === csvSelectedCourseId) : null

    const seenPhones = new Set<string>()
    const toImport = csvRows.filter((row) => {
      const phone = row[phoneCol]
      if (!phone || csvDuplicates.includes(phone)) return false
      if (seenPhones.has(phone)) return false
      seenPhones.add(phone)
      return true
    })
    const leadsToInsert = toImport.map((row) => ({
      college_id: collegeId,
      name: row[columnMap['name']] || 'Unknown',
      phone: row[columnMap['phone']],
      email:      columnMap['email']      ? row[columnMap['email']]      || null : null,
      city:       columnMap['city']       ? row[columnMap['city']]       || null : null,
      visit_date: columnMap['visit_date'] ? row[columnMap['visit_date']] || null : null,
      notes:      columnMap['notes']      ? row[columnMap['notes']]      || null : null,
      source_id:   sourceEntry?.id          ?? null,
      course_id:       courseEntry?.id          ?? null,
      course_interest: courseEntry?.course_name ?? null,
      source_name: sourceEntry?.source_name ?? null,
      assigned_to: addLeadsTarget.id,
      created_by: adminId,
      current_lead_stage: 'New Enquiry',
    }))

    try {
      const batchSize = 100
      let imported = 0
      let failed = 0
      const insertedLeadMap: { leadId: string; row: Record<string, string> }[] = []
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize)
        const batchRows = toImport.slice(i, i + batchSize)
        const { data: inserted, error: batchError } = await supabase.from('leads').insert(batch).select('id')
        if (batchError || !inserted) {
          failed += batch.length
        } else {
          imported += inserted.length
          inserted.forEach((lead, idx) => insertedLeadMap.push({ leadId: lead.id, row: batchRows[idx] }))
        }
      }

      if (imported === 0 && failed > 0) {
        throw new Error(`All ${failed} leads failed to save. Please try again.`)
      }

      // Insert custom field values for successfully imported leads
      if (customFields.length > 0 && insertedLeadMap.length > 0) {
        const customFieldValues = insertedLeadMap.flatMap(({ leadId, row }) =>
          customFields
            .filter((f) => columnMap[`custom_${f.id}`] && row[columnMap[`custom_${f.id}`]])
            .map((f) => ({
              lead_id: leadId,
              field_id: f.id,
              college_id: collegeId,
              value: row[columnMap[`custom_${f.id}`]] || null,
              updated_by: adminId,
            }))
        )
        if (customFieldValues.length > 0) {
          await supabase.from('custom_field_values').insert(customFieldValues)
        }
      }

      // Update counsellor's lead count
      const newLeads = Array.from({ length: imported }, () => ({
        id: crypto.randomUUID(),
        is_active: true as const,
        current_lead_stage: 'New Enquiry',
        current_call_stage: null,
        visit_date: null,
        follow_up_date: null,
      }))
      setCounsellors((prev) => prev.map((c) =>
        c.id === addLeadsTarget.id
          ? { ...c, assigned_leads: [...c.assigned_leads, ...newLeads] }
          : c
      ))

      setCsvResult({ imported, skipped: csvRows.length - imported })
      setCsvStep('done')
      if (failed > 0) {
        toast({ title: 'Partial import', description: `${imported} leads imported, ${failed} could not be saved.`, variant: 'destructive' })
      } else {
        toast({ title: 'Import complete', description: `${imported} leads assigned to ${addLeadsTarget.name}.`, variant: 'success' })
      }

      // Notify the counsellor about the new leads
      if (imported > 0) {
        fetch('/api/admin/import-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counsellorId: addLeadsTarget.id, count: imported }),
        }).catch(() => {/* notification failure should not block the UI */})
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong during import.'
      toast({ title: 'Import failed', description: message, variant: 'destructive' })
    } finally {
      setCsvImporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Counsellors</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-gray-500 text-sm">{counsellors.length} counsellors</p>
            {unassignedCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" />
                {unassignedCount} unassigned leads
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4" />
          Add Counsellor
        </Button>
      </div>

      {/* Sort Controls */}
      {counsellors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Sort By</p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`flex flex-col items-start px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  sortBy === opt.key
                    ? opt.key === 'notCalled'
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{opt.label}</span>
                <span className={`text-[10px] font-normal mt-0.5 ${sortBy === opt.key ? 'opacity-80' : 'text-gray-400'}`}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Counsellors List */}
      {counsellors.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No counsellors yet. Add your first counsellor.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {[...counsellors]
              .sort((a, b) => getCounsellorSortValue(b, sortBy, today) - getCounsellorSortValue(a, sortBy, today))
              .map((c, idx) => {
                const leads = (c.assigned_leads || []).filter((l) => l.is_active !== false)
                const total = leads.length
                const enrolled = leads.filter((l) => l.current_lead_stage === 'Enrolled').length
                const notCalled = leads.filter((l) => l.current_call_stage === null).length
                const interested = leads.filter((l) => l.current_call_stage === 'Interested').length
                const conversion = total > 0 ? Math.round((enrolled / total) * 100) : 0
                const overdueCount = leads.filter((l) => l.follow_up_date && l.follow_up_date < today).length

                return (
                  <div key={c.id} className={`bg-white border border-gray-200 rounded-xl p-4 ${!c.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={c.is_active ? 'success' : 'secondary'}>
                              {c.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {overdueCount > 0 && (
                              <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {overdueCount} overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="text-center bg-gray-50 rounded-lg py-2">
                        <p className="text-xs text-gray-400 font-medium">Total</p>
                        <p className="font-bold text-gray-900">{total}</p>
                      </div>
                      <div className="text-center bg-red-50 rounded-lg py-2">
                        <p className="text-xs text-gray-400 font-medium">Uncalled</p>
                        <p className={`font-bold ${notCalled > 0 ? 'text-red-500' : 'text-gray-300'}`}>{notCalled}</p>
                      </div>
                      <div className="text-center bg-green-50 rounded-lg py-2">
                        <p className="text-xs text-gray-400 font-medium">Enrolled</p>
                        <p className="font-bold text-green-600">{enrolled}</p>
                      </div>
                      <div className="text-center bg-blue-50 rounded-lg py-2">
                        <p className="text-xs text-gray-400 font-medium">Conv%</p>
                        <p className="font-bold text-blue-600">{conversion}%</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                        onClick={() => openAddLeads(c)}
                        disabled={!c.is_active}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Leads
                      </Button>
                      <Link href={`/admin/counsellors/${c.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 h-8 text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(c)}
                        className="h-8 px-2.5 text-xs"
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {c.is_active ? '✕' : '✓'}
                      </Button>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Counsellor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Not Called</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Interested</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrolled</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Conv%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...counsellors]
                    .sort((a, b) => getCounsellorSortValue(b, sortBy, today) - getCounsellorSortValue(a, sortBy, today))
                    .map((c, idx) => {
                      const leads = (c.assigned_leads || []).filter((l) => l.is_active !== false)
                      const total = leads.length
                      const enrolled = leads.filter((l) => l.current_lead_stage === 'Enrolled').length
                      const notCalled = leads.filter((l) => l.current_call_stage === null).length
                      const interested = leads.filter((l) => l.current_call_stage === 'Interested').length
                      const conversion = total > 0 ? Math.round((enrolled / total) * 100) : 0
                      const overdueCount = leads.filter((l) => l.follow_up_date && l.follow_up_date < today).length

                      return (
                        <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3.5 text-xs font-bold text-gray-300">{idx + 1}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900">{c.name}</p>
                                <p className="text-xs text-gray-400 truncate">{c.email}</p>
                                {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1">
                              <Badge variant={c.is_active ? 'success' : 'secondary'}>
                                {c.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {overdueCount > 0 && (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  {overdueCount} overdue
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-bold text-gray-900 text-base">{total}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold text-base ${notCalled > 0 ? 'text-red-500' : 'text-gray-300'}`}>{notCalled}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold text-base ${interested > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>{interested}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-bold text-base text-green-600">{enrolled}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-bold text-base text-blue-600">{conversion}%</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-2.5"
                                onClick={() => openAddLeads(c)}
                                disabled={!c.is_active}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Leads
                              </Button>
                              <Link href={`/admin/counsellors/${c.id}`}>
                                <Button variant="outline" size="sm" className="gap-1 h-8 text-xs px-2.5">
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleActive(c)}
                                className="h-8 px-2.5 text-xs"
                                title={c.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {c.is_active ? '✕' : '✓'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Counsellor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Counsellor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="priya@college.edu" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">6-Digit PIN</Label>
              <Input id="pin" type="text" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="e.g. 123456" required minLength={6} maxLength={6} pattern="[0-9]{6}" />
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

      {/* Add Leads to Counsellor Dialog */}
      <Dialog open={!!addLeadsTarget} onOpenChange={(open) => { if (!open) setAddLeadsTarget(null) }}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                {addLeadsTarget?.name.charAt(0)}
              </div>
              Add Leads → {addLeadsTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="single" className="mt-2 flex flex-col flex-1 overflow-hidden">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="single" className="flex-1 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Single Lead
              </TabsTrigger>
              <TabsTrigger value="csv" className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </TabsTrigger>
            </TabsList>

            {/* Single Lead Tab */}
            <TabsContent value="single" className="mt-4 overflow-y-auto flex-1">
              <form onSubmit={handleAddSingle} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Full Name <span className="text-red-500">*</span></Label>
                    <Input value={singleForm.name} onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })} placeholder="Rahul Kumar" required />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Phone <span className="text-red-500">*</span></Label>
                    <Input
                      value={singleForm.phone}
                      onChange={async (e) => {
                        const phone = e.target.value
                        setSingleForm({ ...singleForm, phone })
                        const norm = phone.trim()
                        if (norm.length >= 6) {
                          const { data } = await supabase
                            .from('leads')
                            .select('id, name')
                            .eq('college_id', collegeId)
                            .eq('phone', norm)
                            .limit(1)
                            .maybeSingle()
                          setSinglePhoneWarning(data ? `Duplicate: "${data.name}" already has this number` : null)
                        } else {
                          setSinglePhoneWarning(null)
                        }
                      }}
                      placeholder="9876543210"
                      required
                      className={singlePhoneWarning ? 'border-orange-400 focus-visible:ring-orange-300' : ''}
                    />
                    {singlePhoneWarning && (
                      <p className="text-xs text-orange-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />{singlePhoneWarning}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={singleForm.email} onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={singleForm.city} onChange={(e) => setSingleForm({ ...singleForm, city: e.target.value })} placeholder="Mumbai" />
                  </div>
                  {courses.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Course Interest</Label>
                      <Select value={singleForm.course_id} onValueChange={(v) => setSingleForm({ ...singleForm, course_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {sources.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Source</Label>
                      <Select value={singleForm.source_id} onValueChange={(v) => setSingleForm({ ...singleForm, source_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="col-span-2 space-y-1.5">
                    <Label>Notes</Label>
                    <Input value={singleForm.notes} onChange={(e) => setSingleForm({ ...singleForm, notes: e.target.value })} placeholder="Optional notes..." />
                  </div>
                  {customFields.length > 0 && (
                    <>
                      <div className="col-span-2 pt-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Custom Fields</p>
                        <div className="space-y-2">
                          {customFields.map((field) => (
                            <div key={field.id} className="space-y-1.5">
                              <Label className="text-xs">
                                {field.field_name}
                                {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                              </Label>
                              {field.field_type === 'dropdown' ? (
                                <Select
                                  value={singleCustomValues[field.id] || '__none__'}
                                  onValueChange={(v) => setSingleCustomValues({ ...singleCustomValues, [field.id]: v === '__none__' ? '' : v })}
                                >
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={`Select ${field.field_name}`} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Select —</SelectItem>
                                    {(field.dropdown_options || []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : field.field_type === 'textarea' ? (
                                <Textarea
                                  value={singleCustomValues[field.id] || ''}
                                  onChange={(e) => setSingleCustomValues({ ...singleCustomValues, [field.id]: e.target.value })}
                                  placeholder={`Enter ${field.field_name}`}
                                  className="text-xs min-h-[60px]"
                                />
                              ) : field.field_type === 'checkbox' ? (
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`scf-${field.id}`}
                                    checked={singleCustomValues[field.id] === 'true'}
                                    onCheckedChange={(c) => setSingleCustomValues({ ...singleCustomValues, [field.id]: c ? 'true' : 'false' })}
                                  />
                                  <label htmlFor={`scf-${field.id}`} className="text-xs text-gray-600 cursor-pointer">{field.field_name}</label>
                                </div>
                              ) : (
                                <Input
                                  type={field.field_type === 'number' ? 'number' : field.field_type === 'phone' ? 'tel' : field.field_type === 'date' ? 'date' : 'text'}
                                  value={singleCustomValues[field.id] || ''}
                                  onChange={(e) => setSingleCustomValues({ ...singleCustomValues, [field.id]: e.target.value })}
                                  placeholder={`Enter ${field.field_name}`}
                                  className="h-8 text-xs"
                                  required={field.is_required}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-1 p-3 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  This lead will be automatically assigned to {addLeadsTarget?.name}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddLeadsTarget(null)}>Cancel</Button>
                  <Button type="submit" disabled={addingSingle} className="gap-1.5">
                    {addingSingle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add & Assign
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* CSV Import Tab */}
            <TabsContent value="csv" className="mt-4 space-y-4 overflow-y-auto flex-1">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1">
                {(['upload', 'map', 'preview', 'done'] as const).map((s, idx) => (
                  <div key={s} className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      csvStep === s ? 'bg-blue-600 text-white' :
                      ['upload','map','preview','done'].indexOf(s) < ['upload','map','preview','done'].indexOf(csvStep)
                        ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>{idx + 1}</div>
                    <span className={csvStep === s ? 'text-blue-600 font-medium' : 'text-gray-400 capitalize'}>
                      {s === 'done' ? 'Done' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                    {idx < 3 && <ArrowRight className="h-3 w-3 text-gray-300" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Upload */}
              {csvStep === 'upload' && (
                <div>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files[0]
                      if (f) {
                        const n = f.name.toLowerCase()
                        if (n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls')) handleCsvFile(f)
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium text-sm">Drop CSV or Excel file here or click to browse</p>
                    <p className="text-gray-400 text-xs mt-1">Supports .csv, .xlsx, .xls — Name and Phone required</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
                  <div className="mt-3 p-3 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    All imported leads will be assigned to {addLeadsTarget?.name}
                  </div>
                </div>
              )}

              {/* Step 2: Map */}
              {csvStep === 'map' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">{csvRows.length} rows found. Map columns below.</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {STATIC_CSV_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-700 w-36 shrink-0">
                          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                        <Select
                          value={columnMap[field.key] || '__none__'}
                          onValueChange={(val) => setColumnMap({ ...columnMap, [field.key]: val === '__none__' ? '' : val })}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {customFields.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pt-2">Custom Fields</p>
                        {customFields.map((field) => (
                          <div key={field.id} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-700 w-36 shrink-0">
                              {field.field_name}
                              {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                              <span className="ml-1 text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded uppercase">{field.field_type}</span>
                            </span>
                            <Select
                              value={columnMap[`custom_${field.id}`] || '__none__'}
                              onValueChange={(val) => setColumnMap({ ...columnMap, [`custom_${field.id}`]: val === '__none__' ? '' : val })}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Not mapped —</SelectItem>
                                {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setCsvStep('upload')}>Back</Button>
                    <Button size="sm" onClick={generateCsvPreview}>Preview <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {csvStep === 'preview' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="flex items-center gap-1.5 text-green-600 font-medium">
                      <CheckCircle className="h-4 w-4" />
                      {csvImportableCount} to import
                    </span>
                    {csvRows.length - csvImportableCount > 0 && (
                      <span className="flex items-center gap-1.5 text-orange-500 font-medium">
                        <X className="h-4 w-4" />
                        {csvRows.length - csvImportableCount} skipped
                        {csvDuplicates.length > 0 && ` (${csvDuplicates.length} already in system${csvRows.length - csvImportableCount - csvDuplicates.length > 0 ? `, ${csvRows.length - csvImportableCount - csvDuplicates.length} duplicate rows in file` : ''})`}
                      </span>
                    )}
                  </div>

                  {csvPreview.length > 0 && (
                    <div className="overflow-x-auto border rounded-lg min-w-0">
                      <table className="min-w-full text-xs">
                        <thead><tr className="bg-gray-50">{Object.keys(csvPreview[0]).map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500 border-b">{h}</th>)}</tr></thead>
                        <tbody>{csvPreview.map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5 text-gray-700 border-b border-gray-50">{v || '—'}</td>)}</tr>)}</tbody>
                      </table>
                      {csvRows.length > 5 && <p className="text-center text-xs text-gray-400 py-1.5">Showing 5 of {csvRows.length} rows</p>}
                    </div>
                  )}

                  {/* Source dropdown — batch-level, always shown below preview */}
                  <div className="pt-2 border-t border-gray-100">
                    <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                      Lead Source <span className="text-gray-400 font-normal">(optional — applied to all leads)</span>
                    </Label>
                    <Select value={csvSelectedSourceId} onValueChange={setCsvSelectedSourceId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select source..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No source —</SelectItem>
                        {sources.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Course dropdown — batch-level, always shown below preview */}
                  <div className="pt-2 border-t border-gray-100">
                    <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                      Course Interest <span className="text-gray-400 font-normal">(optional — applied to all leads)</span>
                    </Label>
                    <Select value={csvSelectedCourseId} onValueChange={setCsvSelectedCourseId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select course..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No course —</SelectItem>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCsvStep('map')}>Back</Button>
                    <Button size="sm" onClick={handleCsvImport} disabled={csvImporting}>
                      {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Import {csvImportableCount} Leads
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Done */}
              {csvStep === 'done' && (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <p className="text-lg font-bold text-gray-900">Import Complete!</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="text-green-600 font-semibold">{csvResult.imported} leads</span> assigned to {addLeadsTarget?.name}
                      {csvResult.skipped > 0 && <> · <span className="text-orange-500">{csvResult.skipped} duplicates skipped</span></>}
                    </p>
                  </div>
                  <Button onClick={() => setAddLeadsTarget(null)} className="gap-1.5">
                    Done
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
