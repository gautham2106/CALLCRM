'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { School, UserCheck, Trash2, Plus, Info } from 'lucide-react'

interface Mapping {
  id: string
  school_name: string
  counsellor_id: string | null
}

interface Props {
  initialMappings: Mapping[]
  counsellors: { id: string; name: string }[]
  knownSchools: string[]
  schoolCounts: Record<string, number>
}

export function SchoolMappingClient({ initialMappings, counsellors, knownSchools, schoolCounts }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings)
  const [newSchool, setNewSchool] = useState('')
  const [newCounsellorId, setNewCounsellorId] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const mappedSchools = new Set(mappings.map((m) => m.school_name))

  // Suggestions: known schools not yet mapped
  const suggestions = knownSchools.filter((s) => !mappedSchools.has(s))

  const counsellorName = (id: string | null) =>
    counsellors.find((c) => c.id === id)?.name || 'Unassigned'

  const handleAdd = async (schoolName?: string) => {
    const school = (schoolName || newSchool).trim()
    if (!school) {
      toast({ title: 'School name required', variant: 'destructive' })
      return
    }
    if (!newCounsellorId) {
      toast({ title: 'Select a counsellor', variant: 'destructive' })
      return
    }
    if (mappedSchools.has(school)) {
      toast({ title: 'Already mapped', description: `${school} already has a mapping. Edit the existing one instead.`, variant: 'destructive' })
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/admin/school-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: [{ school_name: school, counsellor_id: newCounsellorId === '__none__' ? null : newCounsellorId }] }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const newMapping: Mapping = { id: crypto.randomUUID(), school_name: school, counsellor_id: newCounsellorId === '__none__' ? null : newCounsellorId }
      setMappings((prev) => [...prev, newMapping].sort((a, b) => a.school_name.localeCompare(b.school_name)))
      setNewSchool('')
      setNewCounsellorId('')
      toast({ title: 'Mapping saved', description: `${school} → ${counsellorName(newMapping.counsellor_id)}`, variant: 'success' })
    } catch (err: unknown) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleChangeCounsellor = async (mapping: Mapping, newId: string) => {
    const counsellorId = newId === '__none__' ? null : newId
    const res = await fetch('/api/admin/school-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings: [{ school_name: mapping.school_name, counsellor_id: counsellorId }] }),
    })
    if (res.ok) {
      setMappings((prev) => prev.map((m) => m.id === mapping.id ? { ...m, counsellor_id: counsellorId } : m))
      toast({ title: 'Updated', description: `${mapping.school_name} → ${counsellorName(counsellorId)}`, variant: 'success' })
    } else {
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  const handleDelete = async (mapping: Mapping) => {
    setDeletingId(mapping.id)
    try {
      const res = await fetch(`/api/admin/school-mapping?id=${mapping.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setMappings((prev) => prev.filter((m) => m.id !== mapping.id))
      toast({ title: 'Mapping removed', description: mapping.school_name })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <School className="h-6 w-6 text-blue-600" />
          School → Counsellor Mapping
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Set these rules once. When you import leads with a <code className="bg-gray-100 px-1 rounded text-xs">school_name</code> column, leads are auto-assigned — no manual step every time.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">How it works during CSV import</p>
          <ul className="space-y-0.5 text-xs text-blue-700">
            <li>• All schools in your CSV that match a rule here are <strong>auto-assigned instantly</strong></li>
            <li>• Schools with no rule still ask you to assign manually (just for that batch)</li>
            <li>• You can always override by editing the rule below</li>
          </ul>
        </div>
      </div>

      {/* Existing mappings */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">{mappings.length} saved rule{mappings.length !== 1 ? 's' : ''}</p>
          {mappings.length > 0 && <p className="text-xs text-gray-400">Change counsellor inline or delete the rule</p>}
        </div>

        {mappings.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <School className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No mappings yet. Add your first rule below.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{m.school_name}</p>
                  {schoolCounts[m.school_name] != null && (
                    <p className="text-xs text-gray-400">{schoolCounts[m.school_name]} leads in system</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-gray-400 shrink-0">
                  <UserCheck className="h-4 w-4" />
                </div>
                <Select
                  value={m.counsellor_id || '__none__'}
                  onValueChange={(v) => handleChangeCounsellor(m, v)}
                >
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unassigned —</SelectItem>
                    {counsellors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                  onClick={() => handleDelete(m)}
                  disabled={deletingId === m.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new mapping */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-600" /> Add a rule
        </p>

        {/* Suggestions from existing leads */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Schools in your leads without a rule yet:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 12).map((s) => (
                <button
                  key={s}
                  onClick={() => setNewSchool(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    newSchool === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {s}
                  {schoolCounts[s] != null && <span className="ml-1 opacity-60">({schoolCounts[s]})</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs text-gray-500 font-medium">School Name</label>
            <Input
              value={newSchool}
              onChange={(e) => setNewSchool(e.target.value)}
              placeholder="e.g. Delhi Public School"
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-48 space-y-1 shrink-0">
            <label className="text-xs text-gray-500 font-medium">Assign To</label>
            <Select value={newCounsellorId} onValueChange={setNewCounsellorId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select counsellor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassigned —</SelectItem>
                {counsellors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => handleAdd()} disabled={adding} className="h-9 shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  )
}
