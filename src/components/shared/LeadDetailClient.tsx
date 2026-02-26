'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  LEAD_STAGES,
  CALL_STAGES,
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  formatDateTime,
  formatDate,
  getWhatsAppLink,
  getCallLink,
} from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import {
  Phone,
  MessageCircle,
  ArrowLeft,
  Plus,
  Loader2,
  Clock,
  User,
  History,
  ArrowRight,
  MapPin,
  BookOpen,
  Calendar,
  Save,
  UserCheck,
} from 'lucide-react'

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
  visit_date: string | null
  follow_up_date: string | null
  notes: string | null
  assigned_to: string | null
  assigned_user: { id: string; name: string; email: string } | null
  created_at: string
}

interface CallEntry {
  id: string
  call_stage: string
  lead_stage_at_time: string
  notes: string | null
  follow_up_date: string | null
  created_at: string
  caller: { id: string; name: string } | null
}

interface AssignmentEntry {
  id: string
  reason: string | null
  created_at: string
  from_user: { id: string; name: string } | null
  to_user: { id: string; name: string } | null
  by_user: { id: string; name: string } | null
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
  lead: Lead
  callDiary: CallEntry[]
  assignmentHistory: AssignmentEntry[]
  customFields: CustomField[]
  fieldValues: Record<string, string>
  counsellors: { id: string; name: string; email: string }[]
  currentUserId: string
  collegeId: string
  userRole: 'admin' | 'counsellor'
}

export function LeadDetailClient({
  lead: initialLead,
  callDiary: initialDiary,
  assignmentHistory,
  customFields,
  fieldValues: initialFieldValues,
  counsellors,
  currentUserId,
  collegeId,
  userRole,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState(initialLead)
  const [diary, setDiary] = useState(initialDiary)
  const [fieldValues, setFieldValues] = useState(initialFieldValues)
  const [saving, setSaving] = useState(false)
  const [showCallDialog, setShowCallDialog] = useState(false)
  const [callForm, setCallForm] = useState({
    call_stage: '',
    lead_stage: lead.current_lead_stage,
    notes: '',
    follow_up_date: '',
  })
  const [loggingCall, setLoggingCall] = useState(false)

  const saveLeadInfo = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('leads')
      .update({
        current_lead_stage: lead.current_lead_stage,
        current_call_stage: lead.current_call_stage,
        visit_date: lead.visit_date || null,
        follow_up_date: lead.follow_up_date || null,
        notes: lead.notes,
        email: lead.email,
        city: lead.city,
        course_interest: lead.course_interest,
      })
      .eq('id', lead.id)

    if (!error) {
      for (const [fieldId, value] of Object.entries(fieldValues)) {
        await supabase
          .from('custom_field_values')
          .upsert({
            lead_id: lead.id,
            field_id: fieldId,
            college_id: collegeId,
            value: value || null,
            updated_by: currentUserId,
          }, { onConflict: 'lead_id,field_id' })
      }
      toast({ title: 'Lead updated', description: 'All changes saved.', variant: 'success' })
    } else {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const logCall = async () => {
    if (!callForm.call_stage) return
    setLoggingCall(true)

    try {
      const { data: entry } = await supabase
        .from('call_diary')
        .insert({
          lead_id: lead.id,
          college_id: collegeId,
          called_by: currentUserId,
          call_stage: callForm.call_stage,
          lead_stage_at_time: callForm.lead_stage,
          notes: callForm.notes || null,
          follow_up_date: callForm.follow_up_date || null,
        })
        .select(`
          id, call_stage, lead_stage_at_time, notes, follow_up_date, created_at,
          caller:users!call_diary_called_by_fkey(id, name)
        `)
        .single()

      await supabase
        .from('leads')
        .update({
          current_call_stage: callForm.call_stage,
          current_lead_stage: callForm.lead_stage,
          follow_up_date: callForm.follow_up_date || lead.follow_up_date,
        })
        .eq('id', lead.id)

      if (entry) setDiary((prev) => [entry as unknown as CallEntry, ...prev])
      setLead((prev) => ({
        ...prev,
        current_call_stage: callForm.call_stage,
        current_lead_stage: callForm.lead_stage,
        follow_up_date: callForm.follow_up_date || prev.follow_up_date,
      }))

      setShowCallDialog(false)
      setCallForm({ call_stage: '', lead_stage: lead.current_lead_stage, notes: '', follow_up_date: '' })
      toast({ title: 'Call logged', description: 'Entry added to call diary.', variant: 'success' })
    } catch {
      toast({ title: 'Failed to log call', variant: 'destructive' })
    } finally {
      setLoggingCall(false)
    }
  }

  const backPath = userRole === 'admin' ? '/admin/leads' : '/counsellor/leads'

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push(backPath)}
            className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                    {lead.current_lead_stage}
                  </span>
                  {lead.current_call_stage && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100 text-gray-700'}`}>
                      {lead.current_call_stage}
                    </span>
                  )}
                  {lead.visit_date && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                      <Calendar className="h-3 w-3" />
                      Visit: {formatDate(lead.visit_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={getCallLink(lead.phone)}>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                </a>
                <a href={getWhatsAppLink(lead.phone)} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              </div>
            </div>
            {/* Meta strip */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {lead.phone}
              </span>
              {lead.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {lead.city}
                </span>
              )}
              {lead.course_interest && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {lead.course_interest}
                </span>
              )}
              {lead.source_name && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-medium">
                  {lead.source_name}
                </span>
              )}
              {lead.assigned_user && (
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  {lead.assigned_user.name}
                </span>
              )}
              {lead.follow_up_date && (
                <span className="flex items-center gap-1 text-orange-600 font-medium">
                  <Calendar className="h-3 w-3" />
                  Follow-up: {formatDate(lead.follow_up_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-6">
        <Tabs defaultValue="info">
          <TabsList className="mb-6 bg-white border border-gray-200 p-1 rounded-xl h-auto">
            <TabsTrigger value="info" className="rounded-lg data-[state=active]:shadow-sm">
              <User className="h-4 w-4 mr-1.5" />
              Lead Info
            </TabsTrigger>
            <TabsTrigger value="diary" className="rounded-lg data-[state=active]:shadow-sm">
              <Phone className="h-4 w-4 mr-1.5" />
              Call Diary
              {diary.length > 0 && (
                <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{diary.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:shadow-sm">
              <History className="h-4 w-4 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Lead Info */}
          <TabsContent value="info" className="mt-0">
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</Label>
                    <Input value={lead.name} disabled className="bg-gray-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</Label>
                    <Input value={lead.phone} disabled className="bg-gray-50 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</Label>
                    <Input
                      value={lead.email || ''}
                      onChange={(e) => setLead({ ...lead, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City</Label>
                    <Input
                      value={lead.city || ''}
                      onChange={(e) => setLead({ ...lead, city: e.target.value })}
                      placeholder="Mumbai"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Interest</Label>
                    <Input
                      value={lead.course_interest || ''}
                      onChange={(e) => setLead({ ...lead, course_interest: e.target.value })}
                      placeholder="MBA, B.Tech..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</Label>
                    <Input value={lead.source_name || '—'} disabled className="bg-gray-50" />
                  </div>
                </div>
              </div>

              {/* Status & Stage */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Status & Follow-up</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Stage</Label>
                    <Select
                      value={lead.current_lead_stage}
                      onValueChange={(val) => setLead({ ...lead, current_lead_stage: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Scheduled Date</Label>
                    <Input
                      type="date"
                      value={lead.visit_date || ''}
                      onChange={(e) => setLead({ ...lead, visit_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up Date</Label>
                    <Input
                      type="date"
                      value={lead.follow_up_date || ''}
                      onChange={(e) => setLead({ ...lead, follow_up_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</Label>
                    <Input value={lead.assigned_user?.name || 'Unassigned'} disabled className="bg-gray-50" />
                  </div>
                  <div className="col-span-full space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
                    <Textarea
                      value={lead.notes || ''}
                      onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                      placeholder="Any additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customFields.map((field) => {
                      const value = fieldValues[field.id] || ''
                      const options = Array.isArray(field.dropdown_options) ? field.dropdown_options as string[] : []
                      return (
                        <div key={field.id} className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {field.field_name}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {field.field_type === 'textarea' ? (
                            <Textarea
                              value={value}
                              onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                              rows={3}
                            />
                          ) : field.field_type === 'dropdown' ? (
                            <Select
                              value={value || '__none__'}
                              onValueChange={(val) => setFieldValues({ ...fieldValues, [field.id]: val === '__none__' ? '' : val })}
                            >
                              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Select —</SelectItem>
                                {options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : field.field_type === 'checkbox' ? (
                            <div className="flex items-center gap-2 pt-2 h-10">
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
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={saveLeadInfo} disabled={saving} className="gap-1.5 px-6">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Call Diary */}
          <TabsContent value="diary" className="mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {diary.length > 0 ? `${diary.length} call${diary.length !== 1 ? 's' : ''} logged` : 'No calls logged yet'}
                </p>
                <Button onClick={() => setShowCallDialog(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Log a Call
                </Button>
              </div>

              {diary.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-400">
                  <Phone className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No calls logged yet</p>
                  <p className="text-xs mt-1">Click "Log a Call" to add the first entry</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200" />
                  <div className="space-y-3">
                    {diary.map((entry, idx) => (
                      <div key={entry.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                          CALL_STAGE_COLORS[entry.call_stage]?.includes('green') ? 'bg-green-100' :
                          CALL_STAGE_COLORS[entry.call_stage]?.includes('red') ? 'bg-red-100' :
                          CALL_STAGE_COLORS[entry.call_stage]?.includes('orange') ? 'bg-orange-100' :
                          'bg-blue-100'
                        }`}>
                          <Phone className={`h-4 w-4 ${
                            CALL_STAGE_COLORS[entry.call_stage]?.includes('green') ? 'text-green-600' :
                            CALL_STAGE_COLORS[entry.call_stage]?.includes('red') ? 'text-red-600' :
                            CALL_STAGE_COLORS[entry.call_stage]?.includes('orange') ? 'text-orange-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div className={`flex-1 bg-white rounded-xl border p-4 ${idx === 0 ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${CALL_STAGE_COLORS[entry.call_stage] || 'bg-gray-100 text-gray-700'}`}>
                                {entry.call_stage}
                              </span>
                              <ArrowRight className="h-3 w-3 text-gray-300" />
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${LEAD_STAGE_COLORS[entry.lead_stage_at_time] || 'bg-gray-100 text-gray-700'}`}>
                                {entry.lead_stage_at_time}
                              </span>
                              {idx === 0 && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium border border-blue-100">Latest</span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-medium text-gray-700">{entry.caller?.name || 'Unknown'}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(entry.created_at)}</p>
                            </div>
                          </div>
                          {entry.notes && (
                            <p className="text-sm text-gray-700 mt-3 bg-gray-50 rounded-lg p-3 leading-relaxed">{entry.notes}</p>
                          )}
                          {entry.follow_up_date && (
                            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-orange-600 font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              Next follow-up: {formatDate(entry.follow_up_date)}
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

          {/* Tab 3: Assignment History */}
          <TabsContent value="history" className="mt-0">
            {assignmentHistory.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-400">
                <History className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No assignment history</p>
                <p className="text-xs mt-1">Assignment changes will appear here</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200" />
                <div className="space-y-3">
                  {assignmentHistory.map((entry) => (
                    <div key={entry.id} className="relative flex gap-4">
                      <div className="relative z-10 w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center flex-wrap gap-2 text-sm">
                            <span className="text-gray-500 font-medium">{entry.from_user?.name || 'Unassigned'}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-semibold text-gray-900">{entry.to_user?.name || '—'}</span>
                            {entry.by_user && (
                              <span className="text-xs text-gray-400">by {entry.by_user.name}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{formatDateTime(entry.created_at)}</span>
                        </div>
                        {entry.reason && (
                          <p className="text-sm text-gray-500 mt-2 italic bg-gray-50 rounded-lg px-3 py-2">"{entry.reason}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Log Call Dialog */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              Log a Call — {lead.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Result *</Label>
              <Select
                value={callForm.call_stage}
                onValueChange={(val) => setCallForm({ ...callForm, call_stage: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="What happened on this call?" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Lead Stage</Label>
              <Select
                value={callForm.lead_stage}
                onValueChange={(val) => setCallForm({ ...callForm, lead_stage: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
              <Textarea
                value={callForm.notes}
                onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                placeholder="What was discussed? Any key points..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule Follow-up</Label>
              <Input
                type="date"
                value={callForm.follow_up_date}
                onChange={(e) => setCallForm({ ...callForm, follow_up_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallDialog(false)}>Cancel</Button>
            <Button onClick={logCall} disabled={!callForm.call_stage || loggingCall} className="gap-1.5">
              {loggingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Save Call Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
