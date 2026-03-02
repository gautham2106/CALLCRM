'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import {
  LEAD_STAGES, CALL_STAGES,
  LEAD_STAGE_COLORS, CALL_STAGE_COLORS,
  formatDate, formatDateTime,
} from '@/lib/utils'
import {
  Phone, MessageCircle, X, Save, Loader2, Clock, ArrowRight, History, AlertTriangle,
} from 'lucide-react'

interface LeadSource {
  id: string
  source_name: string
}

interface LeadCourse {
  id: string
  course_name: string
}

interface SlideLeadData {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  school_name: string | null
  course_interest: string | null
  course_id: string | null
  source_id: string | null
  source_name: string | null
  current_lead_stage: string
  current_call_stage: string | null
  visit_date: string | null
  follow_up_date: string | null
  notes: string | null
}

interface CallEntry {
  id: string
  call_stage: string
  lead_stage_at_time: string
  notes: string | null
  follow_up_date: string | null
  created_at: string
  caller_name: string | null
}

interface CustomField {
  id: string
  field_name: string
  field_type: string
  dropdown_options: unknown
  is_required: boolean
  display_order: number
}

interface Props {
  leadId: string | null
  collegeId: string
  currentUserId: string
  onClose: () => void
  onLeadUpdated?: (id: string, updated: Partial<SlideLeadData>) => void
}

export function LeadSlidePanel({ leadId, collegeId, currentUserId, onClose, onLeadUpdated }: Props) {
  const supabase = createClient()
  const [lead, setLead] = useState<SlideLeadData | null>(null)
  const [diary, setDiary] = useState<CallEntry[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [courses, setCourses] = useState<LeadCourse[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loggingCall, setLoggingCall] = useState(false)
  const [callForm, setCallForm] = useState({ call_stage: '', lead_stage: '', notes: '', follow_up_date: '' })
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null)
  const originalPhoneRef = useRef<string>('')
  const phoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    const [{ data: leadData }, { data: diaryData }, { data: sourcesData }, { data: coursesData }, { data: cfDefs }, { data: cfVals }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, name, phone, email, city, school_name, course_interest, course_id, source_id, source_name, current_lead_stage, current_call_stage, visit_date, follow_up_date, notes')
        .eq('id', id)
        .single(),
      supabase
        .from('call_diary')
        .select('id, call_stage, lead_stage_at_time, notes, follow_up_date, created_at, called_by')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('lead_sources')
        .select('id, source_name')
        .eq('college_id', collegeId)
        .eq('is_active', true)
        .order('source_name'),
      supabase
        .from('courses')
        .select('id, course_name')
        .eq('college_id', collegeId)
        .eq('is_active', true)
        .order('course_name'),
      supabase
        .from('custom_field_definitions')
        .select('id, field_name, field_type, dropdown_options, is_required, display_order')
        .eq('college_id', collegeId)
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('custom_field_values')
        .select('field_id, value')
        .eq('lead_id', id),
    ])

    if (leadData) {
      setLead(leadData as SlideLeadData)
      originalPhoneRef.current = (leadData as SlideLeadData).phone
      setPhoneWarning(null)
      setCallForm((prev) => ({ ...prev, lead_stage: (leadData as SlideLeadData).current_lead_stage }))
    }

    if (sourcesData) setSources(sourcesData as LeadSource[])
    if (coursesData) setCourses(coursesData as LeadCourse[])
    if (cfDefs) setCustomFields(cfDefs as CustomField[])
    if (cfVals) setFieldValues(Object.fromEntries((cfVals as any[]).map((v) => [v.field_id, v.value || ''])))

    if (diaryData && diaryData.length > 0) {
      const callerIds = [...new Set((diaryData as any[]).map((d) => d.called_by).filter(Boolean))]
      const { data: users } = await supabase.from('users').select('id, name').in('id', callerIds)
      const userMap: Record<string, string> = {}
      ;(users || []).forEach((u: any) => { userMap[u.id] = u.name })
      setDiary((diaryData as any[]).map((d) => ({
        id: d.id,
        call_stage: d.call_stage,
        lead_stage_at_time: d.lead_stage_at_time,
        notes: d.notes,
        follow_up_date: d.follow_up_date,
        created_at: d.created_at,
        caller_name: d.called_by ? (userMap[d.called_by] || 'Unknown') : null,
      })))
    } else {
      setDiary([])
    }
    setLoading(false)
  }, [supabase, collegeId])

  useEffect(() => {
    if (leadId) {
      setLead(null)
      setDiary([])
      setPhoneWarning(null)
      setCallForm({ call_stage: '', lead_stage: '', notes: '', follow_up_date: '' })
      fetchData(leadId)
    }
  }, [leadId, fetchData])

  const saveLead = async () => {
    if (!lead) return
    setSaving(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        school_name: lead.school_name,
        course_interest: lead.course_interest,
        course_id: lead.course_id || null,
        source_id: lead.source_id,
        source_name: lead.source_name,
        current_lead_stage: lead.current_lead_stage,
        current_call_stage: lead.current_call_stage,
        visit_date: lead.visit_date || null,
        follow_up_date: lead.follow_up_date || null,
        notes: lead.notes,
        customFields: fieldValues,
      }),
    })
    if (res.ok) {
      onLeadUpdated?.(lead.id, lead)
      toast({ title: 'Lead updated', variant: 'success' })
    } else {
      const json = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast({ title: 'Duplicate phone', description: json.error, variant: 'destructive' })
      } else {
        toast({ title: 'Save failed', description: json.error || 'Unknown error', variant: 'destructive' })
      }
    }
    setSaving(false)
  }

  const logCall = async () => {
    if (!lead || !callForm.call_stage) return
    setLoggingCall(true)
    try {
      const effectiveLeadStage = callForm.lead_stage || lead.current_lead_stage
      const { data: entry } = await supabase
        .from('call_diary')
        .insert({
          lead_id: lead.id,
          college_id: collegeId,
          called_by: currentUserId,
          call_stage: callForm.call_stage,
          lead_stage_at_time: effectiveLeadStage,
          notes: callForm.notes || null,
          follow_up_date: callForm.follow_up_date || null,
        })
        .select('id, call_stage, lead_stage_at_time, notes, follow_up_date, created_at')
        .single()

      await supabase
        .from('leads')
        .update({
          current_call_stage: callForm.call_stage,
          current_lead_stage: effectiveLeadStage,
          follow_up_date: callForm.follow_up_date || lead.follow_up_date,
        })
        .eq('id', lead.id)

      if (entry) {
        setDiary((prev) => [{
          id: (entry as any).id,
          call_stage: (entry as any).call_stage,
          lead_stage_at_time: (entry as any).lead_stage_at_time,
          notes: (entry as any).notes,
          follow_up_date: (entry as any).follow_up_date,
          created_at: (entry as any).created_at,
          caller_name: 'You',
        }, ...prev])
      }

      const updatedLead = {
        ...lead,
        current_call_stage: callForm.call_stage,
        current_lead_stage: effectiveLeadStage,
        follow_up_date: callForm.follow_up_date || lead.follow_up_date,
      }
      setLead(updatedLead)
      onLeadUpdated?.(lead.id, updatedLead)
      setCallForm({ call_stage: '', lead_stage: updatedLead.current_lead_stage, notes: '', follow_up_date: '' })
      toast({ title: 'Call logged', variant: 'success' })
    } catch {
      toast({ title: 'Failed to log call', variant: 'destructive' })
    } finally {
      setLoggingCall(false)
    }
  }

  if (!leadId) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {loading || !lead ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading lead...</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 px-5 py-4 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-lg truncate">{lead.name}</h2>
                  <p className="text-sm text-gray-400 font-mono">{lead.phone}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                      {lead.current_lead_stage}
                    </span>
                    {lead.current_call_stage && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_call_stage}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a href={`tel:${lead.phone}`} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Call">
                    <Phone className="h-4 w-4" />
                  </a>
                  <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="WhatsApp">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-5 mt-3 bg-gray-100 p-1 rounded-lg h-auto shrink-0 grid grid-cols-3">
                <TabsTrigger value="info" className="text-xs rounded-md">Lead Info</TabsTrigger>
                <TabsTrigger value="call" className="text-xs rounded-md">Log Call</TabsTrigger>
                <TabsTrigger value="history" className="text-xs rounded-md">
                  History
                  {diary.length > 0 && (
                    <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full">{diary.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Lead Info Tab */}
              <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="px-5 py-4 space-y-3 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</Label>
                      <Input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Full name" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</Label>
                      <Input
                        value={lead.phone}
                        onChange={(e) => {
                          const newPhone = e.target.value
                          setLead({ ...lead, phone: newPhone })
                          if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current)
                          if (newPhone.length >= 6 && newPhone !== originalPhoneRef.current) {
                            const currentLeadId = lead.id
                            phoneCheckTimer.current = setTimeout(async () => {
                              const { data } = await supabase
                                .from('leads')
                                .select('id, name')
                                .eq('college_id', collegeId)
                                .eq('phone', newPhone)
                                .neq('id', currentLeadId)
                                .limit(1)
                              setPhoneWarning(
                                data && data.length > 0
                                  ? `Duplicate: "${(data[0] as any).name}" already has this number`
                                  : null
                              )
                            }, 500)
                          } else {
                            setPhoneWarning(null)
                          }
                        }}
                        placeholder="Phone number"
                        className={`font-mono${phoneWarning ? ' border-orange-400 focus-visible:ring-orange-300' : ''}`}
                      />
                      {phoneWarning && (
                        <p className="text-xs text-orange-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />{phoneWarning}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</Label>
                      <Input value={lead.email || ''} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</Label>
                      <Input value={lead.city || ''} onChange={(e) => setLead({ ...lead, city: e.target.value })} placeholder="Mumbai" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School</Label>
                      <Input value={lead.school_name || ''} onChange={(e) => setLead({ ...lead, school_name: e.target.value })} placeholder="School name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Interest</Label>
                      {courses.length > 0 ? (
                        <Select
                          value={lead.course_id || '__none__'}
                          onValueChange={(val) => {
                            const c = courses.find((x) => x.id === val)
                            setLead({
                              ...lead,
                              course_id: val === '__none__' ? null : val,
                              course_interest: c?.course_name || null,
                            })
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— No course —</SelectItem>
                            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={lead.course_interest || ''} onChange={(e) => setLead({ ...lead, course_interest: e.target.value })} placeholder="MBA, B.Tech..." />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</Label>
                      <Select
                        value={lead.source_id || '__none__'}
                        onValueChange={(val) => {
                          const src = sources.find((s) => s.id === val)
                          setLead({
                            ...lead,
                            source_id: val === '__none__' ? null : val,
                            source_name: src?.source_name || null,
                          })
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— No source —</SelectItem>
                          {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Stage</Label>
                      <Select value={lead.current_lead_stage} onValueChange={(val) => setLead({ ...lead, current_lead_stage: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Stage</Label>
                      <Select
                        value={lead.current_call_stage || '__none__'}
                        onValueChange={(val) => setLead({ ...lead, current_call_stage: val === '__none__' ? null : val })}
                      >
                        <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Not set —</SelectItem>
                          {CALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up Date</Label>
                      <Input type="date" value={lead.follow_up_date || ''} onChange={(e) => setLead({ ...lead, follow_up_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Date</Label>
                      <Input type="date" value={lead.visit_date || ''} onChange={(e) => setLead({ ...lead, visit_date: e.target.value || null })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
                      <Textarea value={lead.notes || ''} onChange={(e) => setLead({ ...lead, notes: e.target.value })} placeholder="Notes about this lead..." rows={3} />
                    </div>
                    {/* Custom / Additional fields */}
                    {customFields.length > 0 && (
                      <>
                        <div className="col-span-2 pt-1 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Information</p>
                        </div>
                        {customFields.map((field) => {
                          const value = fieldValues[field.id] || ''
                          const options = Array.isArray(field.dropdown_options) ? field.dropdown_options as string[] : []
                          return (
                            <div key={field.id} className={`space-y-1 ${field.field_type === 'textarea' ? 'col-span-2' : ''}`}>
                              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {field.field_name}
                                {field.is_required && <span className="text-red-500 ml-1">*</span>}
                              </Label>
                              {field.field_type === 'textarea' ? (
                                <Textarea
                                  value={value}
                                  onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                                  rows={2}
                                />
                              ) : field.field_type === 'dropdown' ? (
                                <Select
                                  value={value || '__none__'}
                                  onValueChange={(val) => setFieldValues({ ...fieldValues, [field.id]: val === '__none__' ? '' : val })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Select —</SelectItem>
                                    {options.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : field.field_type === 'checkbox' ? (
                                <div className="flex items-center gap-2 h-9">
                                  <input
                                    type="checkbox"
                                    checked={value === 'true'}
                                    onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.checked ? 'true' : 'false' })}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                  />
                                  <span className="text-sm text-gray-600">{field.field_name}</span>
                                </div>
                              ) : (
                                <Input
                                  type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                                  value={value}
                                  onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                                />
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                  <Button onClick={saveLead} disabled={saving} className="w-full gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </TabsContent>

              {/* Log Call Tab */}
              <TabsContent value="call" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="px-5 py-4 space-y-4 flex-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Result *</Label>
                    <Select value={callForm.call_stage} onValueChange={(val) => setCallForm({ ...callForm, call_stage: val })}>
                      <SelectTrigger><SelectValue placeholder="What happened on this call?" /></SelectTrigger>
                      <SelectContent>{CALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Lead Stage</Label>
                    <Select
                      value={callForm.lead_stage || lead.current_lead_stage}
                      onValueChange={(val) => setCallForm({ ...callForm, lead_stage: val })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
                    <Textarea value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} placeholder="What was discussed..." rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule Follow-up</Label>
                    <Input type="date" value={callForm.follow_up_date} onChange={(e) => setCallForm({ ...callForm, follow_up_date: e.target.value })} />
                  </div>
                  <Button onClick={logCall} disabled={!callForm.call_stage || loggingCall} className="w-full gap-1.5">
                    {loggingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Save Call Log
                  </Button>
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="px-5 py-4 flex-1">
                  {diary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <History className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No calls logged yet</p>
                      <p className="text-xs mt-1 text-gray-400">Switch to "Log Call" to add one</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gray-200" />
                      <div className="space-y-3">
                        {diary.map((entry, idx) => (
                          <div key={entry.id} className="relative flex gap-3">
                            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              CALL_STAGE_COLORS[entry.call_stage]?.includes('green') ? 'bg-green-100'
                              : CALL_STAGE_COLORS[entry.call_stage]?.includes('red') ? 'bg-red-100'
                              : 'bg-blue-100'
                            }`}>
                              <Phone className={`h-3.5 w-3.5 ${
                                CALL_STAGE_COLORS[entry.call_stage]?.includes('green') ? 'text-green-600'
                                : CALL_STAGE_COLORS[entry.call_stage]?.includes('red') ? 'text-red-600'
                                : 'text-blue-600'
                              }`} />
                            </div>
                            <div className={`flex-1 bg-white rounded-xl border p-3 ${idx === 0 ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}>
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CALL_STAGE_COLORS[entry.call_stage] || 'bg-gray-100 text-gray-700'}`}>
                                    {entry.call_stage}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${LEAD_STAGE_COLORS[entry.lead_stage_at_time] || 'bg-gray-100 text-gray-700'}`}>
                                    {entry.lead_stage_at_time}
                                  </span>
                                  {idx === 0 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">Latest</span>}
                                </div>
                                <div className="text-right shrink-0">
                                  {entry.caller_name && <p className="text-xs font-medium text-gray-700">{entry.caller_name}</p>}
                                  <p className="text-[10px] text-gray-400">{formatDateTime(entry.created_at)}</p>
                                </div>
                              </div>
                              {entry.notes && (
                                <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed">{entry.notes}</p>
                              )}
                              {entry.follow_up_date && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-orange-600 font-medium">
                                  <Clock className="h-3 w-3" />
                                  Follow-up: {formatDate(entry.follow_up_date)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="border-t border-gray-200 px-5 py-3 bg-white shrink-0">
              <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
