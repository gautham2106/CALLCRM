'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LEAD_STAGES,
  CALL_STAGES,
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  PRIORITY_COLORS,
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
  priority: string
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
        priority: lead.priority,
        follow_up_date: lead.follow_up_date || null,
        notes: lead.notes,
        email: lead.email,
        city: lead.city,
        course_interest: lead.course_interest,
      })
      .eq('id', lead.id)

    if (!error) {
      // Save custom field values
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

      // Update lead stage too
      await supabase
        .from('leads')
        .update({
          current_call_stage: callForm.call_stage,
          current_lead_stage: callForm.lead_stage,
          follow_up_date: callForm.follow_up_date || lead.follow_up_date,
        })
        .eq('id', lead.id)

      if (entry) {
        setDiary((prev) => [entry as unknown as CallEntry, ...prev])
      }
      setLead((prev) => ({
        ...prev,
        current_call_stage: callForm.call_stage,
        current_lead_stage: callForm.lead_stage,
        follow_up_date: callForm.follow_up_date || prev.follow_up_date,
      }))

      setShowCallDialog(false)
      setCallForm({ call_stage: '', lead_stage: lead.current_lead_stage, notes: '', follow_up_date: '' })
      toast({ title: 'Call logged', description: 'Call entry saved to diary.', variant: 'success' })
    } catch {
      toast({ title: 'Failed to log call', variant: 'destructive' })
    } finally {
      setLoggingCall(false)
    }
  }

  const backPath = userRole === 'admin' ? '/admin/leads' : '/counsellor/leads'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(backPath)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
              {lead.current_lead_stage}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[lead.priority] || ''}`}>
              {lead.priority}
            </span>
            {lead.current_call_stage && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100'}`}>
                {lead.current_call_stage}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={getCallLink(lead.phone)}>
            <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
              <Phone className="h-4 w-4" />
              Call
            </Button>
          </a>
          <a href={getWhatsAppLink(lead.phone)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">
            <User className="h-4 w-4 mr-1.5" />
            Lead Info
          </TabsTrigger>
          <TabsTrigger value="diary">
            <Phone className="h-4 w-4 mr-1.5" />
            Call Diary ({diary.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1.5" />
            Assignment History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Lead Info */}
        <TabsContent value="info">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={lead.name} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={lead.phone} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    value={lead.email || ''}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input
                    value={lead.city || ''}
                    onChange={(e) => setLead({ ...lead, city: e.target.value })}
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Course Interest</Label>
                  <Input
                    value={lead.course_interest || ''}
                    onChange={(e) => setLead({ ...lead, course_interest: e.target.value })}
                    placeholder="MBA, B.Tech..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Source</Label>
                  <Input value={lead.source_name || '—'} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Lead Stage</Label>
                  <Select
                    value={lead.current_lead_stage}
                    onValueChange={(val) => setLead({ ...lead, current_lead_stage: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select
                    value={lead.priority}
                    onValueChange={(val) => setLead({ ...lead, priority: val })}
                  >
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
                <div className="space-y-1">
                  <Label>Follow-up Date</Label>
                  <Input
                    type="date"
                    value={lead.follow_up_date || ''}
                    onChange={(e) => setLead({ ...lead, follow_up_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Assigned To</Label>
                  <Input value={lead.assigned_user?.name || 'Unassigned'} disabled />
                </div>
                <div className="col-span-full space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={lead.notes || ''}
                    onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => {
                    const value = fieldValues[field.id] || ''
                    const options = Array.isArray(field.dropdown_options) ? field.dropdown_options as string[] : []

                    return (
                      <div key={field.id} className="space-y-1">
                        <Label>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Select —</SelectItem>
                              {options.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.field_type === 'checkbox' ? (
                          <div className="flex items-center gap-2 pt-2">
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
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={saveLeadInfo} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Call Diary */}
        <TabsContent value="diary">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCallDialog(true)}>
                <Plus className="h-4 w-4" />
                Log a Call
              </Button>
            </div>

            {diary.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No calls logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diary.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CALL_STAGE_COLORS[entry.call_stage] || 'bg-gray-100'}`}>
                            {entry.call_stage}
                          </span>
                          <span className="text-xs text-gray-400">→</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[entry.lead_stage_at_time] || 'bg-gray-100'}`}>
                            {entry.lead_stage_at_time}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</p>
                          <p className="text-xs text-gray-500">{entry.caller?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{entry.notes}</p>
                      )}
                      {entry.follow_up_date && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-orange-600">
                          <Clock className="h-3 w-3" />
                          Follow-up: {formatDate(entry.follow_up_date)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Assignment History */}
        <TabsContent value="history">
          {assignmentHistory.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No assignment history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentHistory.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">{entry.from_user?.name || 'Unassigned'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-900">{entry.to_user?.name || '—'}</span>
                        {entry.by_user && (
                          <span className="text-gray-400 text-xs">by {entry.by_user.name}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</span>
                    </div>
                    {entry.reason && (
                      <p className="text-sm text-gray-500 mt-1 italic">"{entry.reason}"</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Log Call Dialog */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Call — {lead.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Call Result</Label>
              <Select
                value={callForm.call_stage}
                onValueChange={(val) => setCallForm({ ...callForm, call_stage: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="What happened on this call?" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Update Lead Stage</Label>
              <Select
                value={callForm.lead_stage}
                onValueChange={(val) => setCallForm({ ...callForm, lead_stage: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={callForm.notes}
                onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                placeholder="What was discussed? Any key points..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Follow-up Date</Label>
              <Input
                type="date"
                value={callForm.follow_up_date}
                onChange={(e) => setCallForm({ ...callForm, follow_up_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallDialog(false)}>Cancel</Button>
            <Button onClick={logCall} disabled={!callForm.call_stage || loggingCall}>
              {loggingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Save Call Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
