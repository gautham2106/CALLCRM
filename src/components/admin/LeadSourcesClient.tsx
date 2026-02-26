'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { LEAD_STAGES, CALL_STAGES } from '@/lib/utils'
import {
  Plus, Tags, Eye, EyeOff, Trash2, Loader2, Phone, MessageCircle,
  ChevronDown, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Minus,
  Save, X, Pencil,
} from 'lucide-react'

interface LeadSource {
  id: string
  source_name: string
  is_active: boolean
  created_at: string
}

interface SourceStat {
  sourceId: string
  total: number
  enrolled: number
  rate: number
  thisMonth: number
  lastMonth: number
  stages: { stage: string; count: number }[]
}

interface SourceLead {
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
}

interface EditingLead {
  id: string
  name: string
  phone: string
  current_lead_stage: string
  current_call_stage: string | null
  follow_up_date: string | null
  visit_date: string | null
  notes: string | null
}

interface Props {
  initialSources: LeadSource[]
  collegeId: string
  adminId: string
  initialSourceStats: SourceStat[]
  unknownStat: SourceStat | null
}

const PAGE_SIZE = 15

const STAGE_PILL: Record<string, string> = {
  'New Enquiry': 'bg-blue-50 text-blue-700',
  'Contacted': 'bg-amber-50 text-amber-700',
  'Visit Scheduled': 'bg-purple-50 text-purple-700',
  'Visit Done': 'bg-indigo-50 text-indigo-700',
  'Application Started': 'bg-orange-50 text-orange-700',
  'Enrolled': 'bg-green-50 text-green-700',
  'Cold Lead': 'bg-gray-100 text-gray-500',
  'Wrong Lead': 'bg-red-50 text-red-500',
}

export function LeadSourcesClient({ initialSources, collegeId, adminId, initialSourceStats, unknownStat }: Props) {
  const supabase = createClient()
  const [sources, setSources] = useState(initialSources)
  const [sourceStats] = useState(initialSourceStats)
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [sourceLeadsMap, setSourceLeadsMap] = useState<Record<string, { leads: SourceLead[]; loading: boolean }>>({})
  const [pageMap, setPageMap] = useState<Record<string, number>>({})
  const [editingLead, setEditingLead] = useState<EditingLead | null>(null)
  const [saving, setSaving] = useState(false)

  const getStat = (sourceId: string) => sourceStats.find((s) => s.sourceId === sourceId) ?? null

  const toggleExpandUnknown = async () => {
    const key = '__unknown__'
    if (expandedSourceId === key) { setExpandedSourceId(null); return }
    setExpandedSourceId(key)
    if (sourceLeadsMap[key]) return
    setSourceLeadsMap((prev) => ({ ...prev, [key]: { leads: [], loading: true } }))
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, email, city, course_interest, source_name, current_lead_stage, current_call_stage, visit_date, follow_up_date, notes')
      .eq('college_id', collegeId)
      .is('source_id', null)
      .order('created_at', { ascending: false })
    setSourceLeadsMap((prev) => ({
      ...prev,
      [key]: { leads: error ? [] : (data || []), loading: false },
    }))
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSource.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('lead_sources')
      .insert({ college_id: collegeId, source_name: newSource.trim(), created_by: adminId })
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
    if (expandedSourceId === source.id) { setExpandedSourceId(null); return }
    setExpandedSourceId(source.id)
    if (sourceLeadsMap[source.id]) return
    setSourceLeadsMap((prev) => ({ ...prev, [source.id]: { leads: [], loading: true } }))
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, email, city, course_interest, source_name, current_lead_stage, current_call_stage, visit_date, follow_up_date, notes')
      .eq('college_id', collegeId)
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
    setSourceLeadsMap((prev) => ({
      ...prev,
      [source.id]: { leads: error ? [] : (data || []), loading: false },
    }))
  }

  const openEdit = (lead: SourceLead) => {
    setEditingLead({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      current_lead_stage: lead.current_lead_stage,
      current_call_stage: lead.current_call_stage,
      follow_up_date: lead.follow_up_date,
      visit_date: lead.visit_date,
      notes: lead.notes,
    })
  }

  const saveEdit = async () => {
    if (!editingLead) return
    setSaving(true)
    const { error } = await supabase
      .from('leads')
      .update({
        current_lead_stage: editingLead.current_lead_stage,
        current_call_stage: editingLead.current_call_stage,
        follow_up_date: editingLead.follow_up_date || null,
        visit_date: editingLead.visit_date || null,
        notes: editingLead.notes || null,
      })
      .eq('id', editingLead.id)

    if (!error) {
      // Sync to local lead list
      setSourceLeadsMap((prev) => {
        const next = { ...prev }
        for (const sid in next) {
          next[sid] = {
            ...next[sid],
            leads: next[sid].leads.map((l) =>
              l.id === editingLead.id ? { ...l, ...editingLead } : l
            ),
          }
        }
        return next
      })
      toast({ title: 'Lead updated', variant: 'success' })
      setEditingLead(null)
    } else {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  // Source Intelligence best rate
  const bestConvertingSource = sources
    .map((s) => ({ source: s, stat: getStat(s.id) }))
    .filter((x) => x.stat && x.stat.total >= 3)
    .reduce<{ source: LeadSource; stat: SourceStat } | null>(
      (best, curr) => (!best || curr.stat!.rate > best.stat.rate ? curr as { source: LeadSource; stat: SourceStat } : best),
      null
    )

  const sourcesWithData = sources.filter((s) => (getStat(s.id)?.total || 0) > 0)
  const maxTotal = Math.max(
    ...sourcesWithData.map((s) => getStat(s.id)?.total || 0),
    unknownStat?.total || 0,
    1
  )

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lead Sources</h1>
        <p className="text-gray-500 text-sm">Track performance and manage your lead sources</p>
      </div>

      {/* ── Source Intelligence ── */}
      {sourcesWithData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">Source Intelligence</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Blue = lead volume · Green = conversion rate
              </p>
            </div>
            {bestConvertingSource && (
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                Best Rate: {bestConvertingSource.source.source_name} ({bestConvertingSource.stat.rate}%)
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {[...sourcesWithData]
              .sort((a, b) => (getStat(b.id)?.total || 0) - (getStat(a.id)?.total || 0))
              .map((source) => {
                const stat = getStat(source.id)!
                const volPct = Math.round((stat.total / maxTotal) * 100)
                const trendDiff = stat.thisMonth - stat.lastMonth

                return (
                  <div key={source.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-semibold text-gray-900 text-sm">{source.source_name}</span>
                        <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          trendDiff > 0 ? 'bg-green-50 text-green-600'
                          : trendDiff < 0 ? 'bg-red-50 text-red-500'
                          : 'bg-gray-100 text-gray-400'
                        }`}>
                          {trendDiff > 0
                            ? <ArrowUp className="h-2.5 w-2.5" />
                            : trendDiff < 0
                            ? <ArrowDown className="h-2.5 w-2.5" />
                            : <Minus className="h-2.5 w-2.5" />
                          }
                          {stat.thisMonth} this month
                          {stat.lastMonth > 0 && (
                            <span className="opacity-60 ml-0.5">
                              ({trendDiff > 0 ? '+' : ''}{trendDiff} vs last)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                        <span className="tabular-nums">{stat.total} leads</span>
                        <span className="text-green-600 font-semibold tabular-nums">{stat.enrolled} enrolled</span>
                        <span className={`font-bold w-9 text-right tabular-nums ${
                          stat.rate >= 20 ? 'text-green-600'
                          : stat.rate >= 10 ? 'text-orange-500'
                          : 'text-gray-400'
                        }`}>
                          {stat.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${volPct}%` }} />
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stat.rate >= 20 ? 'bg-green-500'
                            : stat.rate >= 10 ? 'bg-orange-400'
                            : 'bg-gray-300'
                          }`}
                          style={{ width: `${stat.rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

            {/* Unknown / no-source row in Intelligence */}
            {unknownStat && unknownStat.total > 0 && (() => {
              const volPct = Math.round((unknownStat.total / maxTotal) * 100)
              const trendDiff = unknownStat.thisMonth - unknownStat.lastMonth
              return (
                <div className="px-5 py-3.5 bg-gray-50/60">
                  <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-500 text-sm italic">Unknown / No Source</span>
                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                        trendDiff > 0 ? 'bg-green-50 text-green-600' : trendDiff < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {trendDiff > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : trendDiff < 0 ? <ArrowDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                        {unknownStat.thisMonth} this month
                        {unknownStat.lastMonth > 0 && <span className="opacity-60 ml-0.5">({trendDiff > 0 ? '+' : ''}{trendDiff} vs last)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                      <span className="tabular-nums">{unknownStat.total} leads</span>
                      <span className="text-green-600 font-semibold tabular-nums">{unknownStat.enrolled} enrolled</span>
                      <span className={`font-bold w-9 text-right tabular-nums ${unknownStat.rate >= 20 ? 'text-green-600' : unknownStat.rate >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {unknownStat.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-300 rounded-full transition-all duration-500" style={{ width: `${volPct}%` }} />
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${unknownStat.rate >= 20 ? 'bg-green-500' : unknownStat.rate >= 10 ? 'bg-orange-400' : 'bg-gray-300'}`} style={{ width: `${unknownStat.rate}%` }} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Add New Source ── */}
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

      {/* ── Sources List with Leads ── */}
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
              const stat = getStat(source.id)
              const leads = sourceData?.leads || []
              const currentPage = pageMap[source.id] || 0
              const totalPages = Math.ceil(leads.length / PAGE_SIZE)
              const pageLeads = leads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

              return (
                <div key={source.id}>
                  {/* Source Header Row */}
                  <div className={`flex items-center justify-between px-4 py-3 ${!source.is_active ? 'opacity-50' : ''}`}>
                    <button
                      className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                      onClick={() => toggleExpand(source)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      }
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {source.source_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium text-gray-900">{source.source_name}</span>
                        {!source.is_active && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                        {stat && stat.total > 0 && (
                          <span className="text-xs text-gray-400">
                            {stat.total} leads ·{' '}
                            <span className={
                              stat.rate >= 20 ? 'text-green-600 font-semibold'
                              : stat.rate >= 10 ? 'text-orange-500 font-semibold'
                              : 'text-gray-400'
                            }>
                              {stat.rate}% conv.
                            </span>
                          </span>
                        )}
                        {sourceData && !sourceData.loading && stat?.total === 0 && (
                          <span className="text-xs text-gray-400">({leads.length} leads)</span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(source)} title={source.is_active ? 'Hide source' : 'Activate source'}>
                        {source.is_active ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSource(source)} title="Delete source">
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
                      ) : leads.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No leads from this source yet.
                        </div>
                      ) : (
                        <div>
                          {/* Summary strip */}
                          {stat && stat.total > 0 && (
                            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <span><span className="font-bold text-gray-800">{leads.length}</span> leads loaded</span>
                              <span><span className="font-bold text-green-600">{stat.enrolled}</span> enrolled</span>
                              <span><span className={`font-bold ${stat.rate >= 20 ? 'text-green-600' : stat.rate >= 10 ? 'text-orange-500' : 'text-gray-500'}`}>{stat.rate}%</span> conversion</span>
                            </div>
                          )}

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
                                {pageLeads.map((lead) => (
                                  <tr key={lead.id} className="bg-white hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      <div>{lead.name}</div>
                                      {(lead.city || lead.course_interest) && (
                                        <div className="text-xs text-gray-400 mt-0.5">
                                          {[lead.city, lead.course_interest].filter(Boolean).join(' · ')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lead.phone}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-col gap-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                                          {lead.current_lead_stage}
                                        </span>
                                        {lead.current_call_stage && (
                                          <span className="text-[10px] text-gray-400">{lead.current_call_stage}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
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
                                        <button
                                          onClick={() => openEdit(lead)}
                                          title="Edit lead"
                                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
                              <span>{leads.length} leads · Page {currentPage + 1} of {totalPages}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setPageMap((prev) => ({ ...prev, [source.id]: currentPage - 1 }))}
                                  disabled={currentPage === 0}
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setPageMap((prev) => ({ ...prev, [source.id]: currentPage + 1 }))}
                                  disabled={currentPage >= totalPages - 1}
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unknown / No Source row */}
            {unknownStat && unknownStat.total > 0 && (() => {
              const key = '__unknown__'
              const isExpanded = expandedSourceId === key
              const unknownData = sourceLeadsMap[key]
              const leads = unknownData?.leads || []
              const currentPage = pageMap[key] || 0
              const totalPages = Math.ceil(leads.length / PAGE_SIZE)
              const pageLeads = leads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

              return (
                <div className="border-t-2 border-dashed border-gray-200">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/60">
                    <button
                      className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                      onClick={toggleExpandUnknown}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      }
                      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">?</div>
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium text-gray-500 italic">Unknown / No Source</span>
                        <span className="text-xs text-gray-400">
                          {unknownStat.total} leads ·{' '}
                          <span className={unknownStat.rate >= 20 ? 'text-green-600 font-semibold' : unknownStat.rate >= 10 ? 'text-orange-500 font-semibold' : 'text-gray-400'}>
                            {unknownStat.rate}% conv.
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      {unknownData?.loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading leads...
                        </div>
                      ) : leads.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">No leads without a source.</div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500">
                            <span><span className="font-bold text-gray-800">{leads.length}</span> leads with no source</span>
                            <span><span className="font-bold text-green-600">{unknownStat.enrolled}</span> enrolled</span>
                          </div>
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
                                {pageLeads.map((lead) => (
                                  <tr key={lead.id} className="bg-white hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      <div>{lead.name}</div>
                                      {(lead.city || lead.course_interest) && (
                                        <div className="text-xs text-gray-400 mt-0.5">{[lead.city, lead.course_interest].filter(Boolean).join(' · ')}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lead.phone}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                                        {lead.current_lead_stage}
                                      </span>
                                      {lead.current_call_stage && <div className="text-[10px] text-gray-400 mt-0.5">{lead.current_call_stage}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-0.5">
                                        <a href={`tel:${lead.phone}`} title="Call" className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors">
                                          <Phone className="h-4 w-4" />
                                        </a>
                                        <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors">
                                          <MessageCircle className="h-4 w-4" />
                                        </a>
                                        <button onClick={() => openEdit(lead)} title="Edit lead" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
                              <span>{leads.length} leads · Page {currentPage + 1} of {totalPages}</span>
                              <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPageMap((prev) => ({ ...prev, [key]: currentPage - 1 }))} disabled={currentPage === 0}>
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPageMap((prev) => ({ ...prev, [key]: currentPage + 1 }))} disabled={currentPage >= totalPages - 1}>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Inline Lead Edit Panel ── */}
      {editingLead && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setEditingLead(null)}
          />
          {/* Slide panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4 shrink-0 bg-white">
              <div className="min-w-0">
                <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{editingLead.name}</h2>
                <p className="text-sm text-gray-400 font-mono mt-0.5">{editingLead.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${editingLead.phone}`}
                  className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                  title="Call"
                >
                  <Phone className="h-4 w-4" />
                </a>
                <a
                  href={`https://wa.me/91${editingLead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setEditingLead(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Stage</Label>
                <Select
                  value={editingLead.current_lead_stage}
                  onValueChange={(val) => setEditingLead({ ...editingLead, current_lead_stage: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Stage</Label>
                <Select
                  value={editingLead.current_call_stage || '__none__'}
                  onValueChange={(val) => setEditingLead({ ...editingLead, current_call_stage: val === '__none__' ? null : val })}
                >
                  <SelectTrigger><SelectValue placeholder="Select call stage..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not set —</SelectItem>
                    {CALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up Date</Label>
                  <Input
                    type="date"
                    value={editingLead.follow_up_date || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, follow_up_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Date</Label>
                  <Input
                    type="date"
                    value={editingLead.visit_date || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, visit_date: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
                <Textarea
                  value={editingLead.notes || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  placeholder="Any notes about this lead..."
                  rows={5}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-5 py-4 bg-white shrink-0">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingLead(null)}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-1.5" onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
