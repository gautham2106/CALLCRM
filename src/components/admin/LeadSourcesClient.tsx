'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { Plus, Tags, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react'

interface LeadSource {
  id: string
  source_name: string
  is_active: boolean
  created_at: string
}

interface Props {
  initialSources: LeadSource[]
  collegeId: string
  adminId: string
}

export function LeadSourcesClient({ initialSources, collegeId, adminId }: Props) {
  const supabase = createClient()
  const [sources, setSources] = useState(initialSources)
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSource.trim()) return
    setAdding(true)

    const { data, error } = await supabase
      .from('lead_sources')
      .insert({
        college_id: collegeId,
        source_name: newSource.trim(),
        created_by: adminId,
      })
      .select()
      .single()

    if (!error && data) {
      setSources((prev) => [...prev, data as LeadSource])
      setNewSource('')
      toast({ title: 'Source added', variant: 'success' })
    } else {
      toast({ title: 'Failed to add', description: error?.message, variant: 'destructive' })
    }
    setAdding(false)
  }

  const toggleActive = async (source: LeadSource) => {
    const { error } = await supabase
      .from('lead_sources')
      .update({ is_active: !source.is_active })
      .eq('id', source.id)

    if (!error) {
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, is_active: !s.is_active } : s)))
      toast({ title: source.is_active ? 'Source hidden' : 'Source activated' })
    }
  }

  const deleteSource = async (source: LeadSource) => {
    if (!confirm(`Delete source "${source.source_name}"?`)) return
    const { error } = await supabase.from('lead_sources').delete().eq('id', source.id)
    if (!error) {
      setSources((prev) => prev.filter((s) => s.id !== source.id))
      toast({ title: 'Source deleted' })
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lead Sources</h1>
        <p className="text-gray-500 text-sm">Manage where your leads come from</p>
      </div>

      {/* Add New Source */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-medium text-gray-900 mb-3">Add New Source</h2>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="e.g. Google Ad, Walk-in, Instagram..."
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !newSource.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </form>
      </div>

      {/* Sources List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {sources.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Tags className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No sources yet. Add your first lead source above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sources.map((source) => (
              <div
                key={source.id}
                className={`flex items-center justify-between px-4 py-3 ${!source.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                    {source.source_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-900">{source.source_name}</span>
                  {!source.is_active && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(source)}>
                    {source.is_active ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSource(source)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
