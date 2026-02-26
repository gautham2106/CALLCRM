'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import { LeadSlidePanel } from '@/components/shared/LeadSlidePanel'
import {
  Plus, Tags, Eye, EyeOff, Trash2, Loader2, Phone, MessageCircle,
  ChevronDown, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Minus, Pencil,
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

const CALL_PILL: Record<string, string> = {
  'Interested': 'text-green-600',
  'Not Interested': 'text-red-500',
  'Call Back': 'text-orange-500',
  'No Answer': 'text-gray-400',
  'Busy': 'text-yellow-600',
  'Wrong Number': 'text-red-400',
  'Switched Off': 'text-gray-400',
}

const today = new Date().toISOString().split('T')[0]

export function LeadSourcesClient({ initialSources, collegeId, adminId, initialSourceStats, unknownStat }: Props) {
  const supabase = createClient()
  const [sources, setSources] = useState(initialSources)
  const [sourceStats] = useState(initialSourceStats)
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [sourceLeadsMap, setSourceLeadsMap] = useState<Record<string, { leads: SourceLead[]; loading: boolean }>>({})
  const [pageMap, setPageMap] = useState<Record<string, number>>({})
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({})
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)

  const getStat = (sourceId: string) => sourceStats.find((s) => s.sourceId === sourceId) ?? null

  const handleLeadUpdated = (id: string, updated: Partial<SourceLead>) => {
    setSourceLeadsMap((prev) => {
      const next = { ...prev }
      for (const sid in next) {
        next[sid] = {
          ...next[sid],
          leads: next[sid].leads.map((l) => l.id === id ? { ...l, ...updated } : l),
        }
      }
      return next
    })
  }

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

  // Shared leads table renderer — matches main table column structure
  const renderLeadsTable = (leads: SourceLead[], sourceKey: string) => {
    const currentPage = pageMap[sourceKey] || 0
    const isShowAll = showAllMap[sourceKey] || false
    const totalPages = Math.ceil(leads.length / PAGE_SIZE)
    const pageLeads = isShowAll ? leads : leads.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

    return (
      <div>
        {leads.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white/80">
            <span className="text-xs text-gray-400">{leads.length} leads</span>
            <button
              onClick={() => setShowAllMap((prev) => ({ ...prev, [sourceKey]: !isShowAll }))}
              className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
            >
              {isShowAll ? 'Paginate' : `Show all ${leads.length}`}
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Course / Source</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageLeads.map((lead) => {
                const isOverdue = lead.follow_up_date && lead.follow_up_date <= today &&
                  !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                return (
                  <tr key={lead.id} className="bg-white hover:bg-blue-50/30 transition-colors">
                    {/* Lead */}
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <div>{lead.name}</div>
                      {lead.city && (
                        <div className="text-xs text-gray-400 mt-0.5">{lead.city}</div>
                      )}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="font-mono text-gray-700 text-[13px]">{lead.phone}</p>
                      {lead.email && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{lead.email}</p>
                      )}
                    </td>
                    {/* Course / Source */}
                    <td className="px-4 py-3">
                      <p className="text-gray-700 text-[13px]">{lead.course_interest || <span className="text-gray-300">—</span>}</p>
                      {lead.source_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{lead.source_name}</p>
                      )}
                    </td>
                    {/* Stage */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                        {lead.current_lead_stage}
                      </span>
                      {lead.current_call_stage && (
                        <div className={`text-[10px] mt-0.5 font-medium ${CALL_PILL[lead.current_call_stage] || 'text-gray-400'}`}>
                          {lead.current_call_stage}
                        </div>
                      )}
                    </td>
                    {/* Visit Date */}
                    <td className="px-4 py-3">
                      {lead.visit_date ? (
                        <span className="text-xs font-medium text-gray-600">{formatDate(lead.visit_date)}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {/* Follow-up */}
                    <td className="px-4 py-3">
                      {lead.follow_up_date ? (
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-600'}`}>
                          {isOverdue && <span className="mr-0.5">⚠</span>}
                          {formatDate(lead.follow_up_date)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${lead.phone}`}
                          title="Call"
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a
                          href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setEditingLeadId(lead.id)}
                          title="Edit lead"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {leads.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
            <span>{leads.length} leads{!isShowAll && totalPages > 1 ? ` · Page ${currentPage + 1} of ${totalPages}` : ''}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllMap((prev) => ({ ...prev, [sourceKey]: !isShowAll }))}
                className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
              >
                {isShowAll ? 'Paginate' : `Show all ${leads.length}`}
              </button>
              {!isShowAll && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPageMap((prev) => ({ ...prev, [sourceKey]: currentPage - 1 }))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPageMap((prev) => ({ ...prev, [sourceKey]: currentPage + 1 }))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

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
                          {stat && stat.total > 0 && (
                            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <span><span className="font-bold text-gray-800">{leads.length}</span> leads loaded</span>
                              <span><span className="font-bold text-green-600">{stat.enrolled}</span> enrolled</span>
                              <span><span className={`font-bold ${stat.rate >= 20 ? 'text-green-600' : stat.rate >= 10 ? 'text-orange-500' : 'text-gray-500'}`}>{stat.rate}%</span> conversion</span>
                            </div>
                          )}
                          {renderLeadsTable(leads, source.id)}
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
                          {renderLeadsTable(leads, key)}
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

      {/* ── Full-featured Lead Slide Panel ── */}
      <LeadSlidePanel
        leadId={editingLeadId}
        collegeId={collegeId}
        currentUserId={adminId}
        onClose={() => setEditingLeadId(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </div>
  )
}
