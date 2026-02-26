'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import {
  Plus,
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  Type,
  Hash,
  Phone,
  List,
  Calendar,
  CheckSquare,
  AlignLeft,
  Loader2,
  Sliders,
} from 'lucide-react'

type FieldType = 'text' | 'number' | 'phone' | 'dropdown' | 'date' | 'checkbox' | 'textarea'

interface CustomField {
  id: string
  field_name: string
  field_type: FieldType
  dropdown_options: unknown
  is_required: boolean
  display_order: number
  is_active: boolean
  created_at: string
}

interface Props {
  initialFields: CustomField[]
  collegeId: string
  adminId: string
}

const FIELD_TYPE_INFO: Record<FieldType, { label: string; icon: React.ElementType }> = {
  text: { label: 'Text', icon: Type },
  number: { label: 'Number', icon: Hash },
  phone: { label: 'Phone', icon: Phone },
  dropdown: { label: 'Dropdown', icon: List },
  date: { label: 'Date', icon: Calendar },
  checkbox: { label: 'Checkbox', icon: CheckSquare },
  textarea: { label: 'Text Area', icon: AlignLeft },
}

export function SuperFieldsClient({ initialFields, collegeId, adminId }: Props) {
  const supabase = createClient()
  const [fields, setFields] = useState(initialFields)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editField, setEditField] = useState<CustomField | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<{
    field_name: string
    field_type: FieldType
    is_required: boolean
    dropdown_options: string[]
    newOption: string
  }>({
    field_name: '',
    field_type: 'text',
    is_required: false,
    dropdown_options: [],
    newOption: '',
  })

  const openAdd = () => {
    setForm({ field_name: '', field_type: 'text', is_required: false, dropdown_options: [], newOption: '' })
    setEditField(null)
    setShowAddDialog(true)
  }

  const openEdit = (field: CustomField) => {
    setForm({
      field_name: field.field_name,
      field_type: field.field_type,
      is_required: field.is_required,
      dropdown_options: Array.isArray(field.dropdown_options) ? field.dropdown_options as string[] : [],
      newOption: '',
    })
    setEditField(field)
    setShowAddDialog(true)
  }

  const addDropdownOption = () => {
    if (!form.newOption.trim()) return
    setForm({ ...form, dropdown_options: [...form.dropdown_options, form.newOption.trim()], newOption: '' })
  }

  const removeOption = (opt: string) => {
    setForm({ ...form, dropdown_options: form.dropdown_options.filter((o) => o !== opt) })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editField) {
        const { data } = await supabase
          .from('custom_field_definitions')
          .update({
            field_name: form.field_name,
            field_type: form.field_type,
            is_required: form.is_required,
            dropdown_options: form.dropdown_options,
          })
          .eq('id', editField.id)
          .select()
          .single()

        if (data) {
          setFields((prev) => prev.map((f) => (f.id === editField.id ? { ...f, ...data } as CustomField : f)))
          toast({ title: 'Field updated', variant: 'success' })
        }
      } else {
        const { data } = await supabase
          .from('custom_field_definitions')
          .insert({
            college_id: collegeId,
            field_name: form.field_name,
            field_type: form.field_type,
            is_required: form.is_required,
            dropdown_options: form.field_type === 'dropdown' ? form.dropdown_options : [],
            display_order: fields.length,
            created_by: adminId,
          })
          .select()
          .single()

        if (data) {
          setFields((prev) => [...prev, data as CustomField])
          toast({ title: 'Field added', variant: 'success' })
        }
      }
      setShowAddDialog(false)
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (field: CustomField) => {
    const { error } = await supabase
      .from('custom_field_definitions')
      .update({ is_active: !field.is_active })
      .eq('id', field.id)

    if (!error) {
      setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, is_active: !f.is_active } : f)))
      toast({
        title: field.is_active ? 'Field hidden' : 'Field activated',
        description: `"${field.field_name}" is now ${field.is_active ? 'hidden' : 'visible'}.`,
      })
    }
  }

  const deleteField = async (field: CustomField) => {
    if (!confirm(`Delete field "${field.field_name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', field.id)
    if (!error) {
      setFields((prev) => prev.filter((f) => f.id !== field.id))
      toast({ title: 'Field deleted' })
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Super Fields</h1>
          <p className="text-gray-500 text-sm">Custom fields that appear on every lead</p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Sliders className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No custom fields yet</p>
          <p className="text-sm">Add fields to capture additional lead information</p>
          <Button className="mt-4" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, idx) => {
            const TypeIcon = FIELD_TYPE_INFO[field.field_type]?.icon || Type
            const options = Array.isArray(field.dropdown_options) ? field.dropdown_options as string[] : []

            return (
              <div
                key={field.id}
                className={`bg-white border rounded-lg p-4 flex items-center gap-3 ${!field.is_active ? 'opacity-50' : ''}`}
              >
                <GripVertical className="h-5 w-5 text-gray-300 cursor-grab shrink-0" />
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{field.field_name}</span>
                    {field.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                    {!field.is_active && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                    <span>{FIELD_TYPE_INFO[field.field_type]?.label}</span>
                    {field.field_type === 'dropdown' && options.length > 0 && (
                      <span className="truncate">· {options.slice(0, 3).join(', ')}{options.length > 3 ? ` +${options.length - 3}` : ''}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(field)} className="h-8 px-2">Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(field)} className="h-8 w-8 p-0">
                    {field.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteField(field)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editField ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Field Name</Label>
              <Input
                value={form.field_name}
                onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                placeholder="e.g. 12th Percentage, Preferred Branch"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={form.field_type}
                onValueChange={(val) => setForm({ ...form, field_type: val as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_INFO).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.field_type === 'dropdown' && (
              <div className="space-y-2">
                <Label>Dropdown Options</Label>
                <div className="space-y-2">
                  {form.dropdown_options.map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">{opt}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(opt)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={form.newOption}
                      onChange={(e) => setForm({ ...form, newOption: e.target.value })}
                      placeholder="Add option..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDropdownOption())}
                    />
                    <Button type="button" variant="outline" onClick={addDropdownOption}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={form.is_required}
                onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="required">Required field</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editField ? 'Save Changes' : 'Add Field'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
