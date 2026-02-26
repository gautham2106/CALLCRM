'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { Plus, Tags, Eye, EyeOff, Trash2, Loader2, Phone, MessageCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface LeadSource {
  id: string
  source_name: string
  is_active: boolean
  created_at: string
}

interface SourceLead {
  id: string
  name: string
  phone: string
  current_lead_stage: string
  current_call_stage: string | null
}

interface Props {
  initialSources: LeadSource[]
  collegeId: string
  adminId: string
}

const STAGE_COLORS: Record<string, string> = {
  'New Enquiry': 'bg-blue-50 text-blue-700',
  'Interested': 'bg-indigo-50 text-indigo-700',
  'Visited': 'bg-purple-50 text-purple-700',
  'Enrolled': 'bg-green-50 text-green-700',
  'Not Interested': 'bg-red-50 text-red-700',
}

export function LeadSourcesClient({ initialSources, collegeId, adminId }: Props) {
  const supabase = createClient()
  const [sources, setSources] = useState(initialSources)
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [sourceLeadsMap, setSourceLeadsMap] = useState<Record<string, { leads: SourceLead[]; loading: boolean }>>({})

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

  const toggleExpand = async (source: LeadSource) => {
    if (expandedSourceId === source.id) {
      setExpandedSourceId(null)
      return
    }
    setExpandedSourceId(source.id)
    if (sourceLeadsMap[source.id]) return // already loaded

    setSourceLeadsMap((prev) => ({ ...prev, [source.id]: { leads: [], loading: true } }))

    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, current_lead_stage, current_call_stage')
      .eq('college_id', collegeId)
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!error) {
      setSourceLeadsMap((prev) => ({ ...prev, [source.id]: { leads: data || [], loading: false } }))
    } else {
      setSourceLeadsMap((prev) => ({ ...prev, [source.id]: { leads: [], loading: false } }))
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
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
            {sources.map((source) => {
              const isExpanded = expandedSourceId === source.id
              const sourceData = sourceLeadsMap[source.id]

              return (
                <div key={source.id}>
                  {/* Source Row */}
                  <div className={`flex items-center justify-between px-4 py-3 ${!source.is_active ? 'opacity-50' : ''}`}>
                    <button
                      className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                      onClick={() => toggleExpand(source)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      }
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {source.source_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{source.source_name}</span>
                      {!source.is_active && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                      {sourceData && !sourceData.loading && (
                        <span className="text-xs text-gray-400 ml-1">({sourceData.leads.length} leads)</span>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(source)}>
                        {source.is_active ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSource(source)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Leads Table */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      {sourceData?.loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading leads...
                        </div>
                      ) : !sourceData || sourceData.leads.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No leads from this source yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {sourceData.leads.map((lead) => (
                                <tr key={lead.id} className="bg-white hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-2.5 font-medium text-gray-900">{lead.name}</td>
                                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{lead.phone}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                                      {lead.current_lead_stage}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center justify-end gap-0.5">
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
                                        title="View lead"
                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
