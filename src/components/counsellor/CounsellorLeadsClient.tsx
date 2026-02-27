'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  LEAD_STAGE_COLORS,
  LEAD_STAGES,
  formatDate,
} from '@/lib/utils'
import {
  Search, Phone, MessageCircle, Eye, Users, Clock, PhoneOff, Building2, Pencil,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { LeadSlidePanel } from '@/components/shared/LeadSlidePanel'

const PAGE_SIZE = 50

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
  is_active: boolean
  created_at: string
}

interface Props {
  initialLeads: Lead[]
  counsellorId: string
  collegeId: string
}

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

export function CounsellorLeadsClient({ initialLeads, counsellorId, collegeId }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get('filter') || 'all'

  const [leads, setLeads] = useState(initialLeads)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'visits' | 'not-called'>(
    initialFilter as 'all' | 'today' | 'visits' | 'not-called'
  )
  const [page, setPage] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const resetPage = () => { setPage(0); setShowAll(false) }

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let result = leads
    if (filterTab === 'today') result = result.filter((l) => l.follow_up_date === today)
    else if (filterTab === 'visits') result = result.filter((l) => l.visit_date === today)
    else if (filterTab === 'not-called') result = result.filter((l) => !l.current_call_stage)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email || '').toLowerCase().includes(q)
      )
    }
    if (stageFilter !== 'all') result = result.filter((l) => l.current_lead_stage === stageFilter)
    return result
  }, [leads, search, stageFilter, filterTab, today])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  // If a lead update shrinks filtered and the current page no longer exists, clamp silently
  const safePage = filtered.length === 0 ? 0 : Math.min(page, Math.max(0, totalPages - 1))
  const paginated = showAll ? filtered : filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const tabCount = {
    all: leads.length,
    today: leads.filter((l) => l.follow_up_date === today).length,
    visits: leads.filter((l) => l.visit_date === today).length,
    'not-called': leads.filter((l) => !l.current_call_stage).length,
  }

  const handleLeadUpdated = (id: string, updated: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l))
  }

  const tabs = [
    { key: 'all' as const, label: 'All', icon: Users },
    { key: 'today' as const, label: 'Follow-ups', icon: Clock },
    { key: 'visits' as const, label: "Today's Visits", icon: Building2 },
    { key: 'not-called' as const, label: 'Not Called', icon: PhoneOff },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">{leads.length} leads assigned to you</p>
      </div>

      <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-2 sm:px-4 rounded-t-xl -mb-px overflow-x-auto scrollbar-none">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setFilterTab(key); resetPage() }}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                filterTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                filterTab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tabCount[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
              className="pl-9 h-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); resetPage() }}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-400">
            <Phone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No leads found</p>
            <p className="text-xs mt-1">Try changing filters or search query</p>
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden space-y-2">
              {/* Mobile toolbar — top */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {showAll
                      ? `${filtered.length.toLocaleString()} leads`
                      : `${Math.min(safePage * PAGE_SIZE + 1, filtered.length)}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {filtered.length > PAGE_SIZE && (
                      <button
                        onClick={() => { setShowAll((v) => !v); setPage(0) }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        {showAll ? 'Paginate' : 'Show all'}
                      </button>
                    )}
                    {!showAll && totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p - 1)} disabled={safePage === 0}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1 font-medium text-gray-700">{safePage + 1} / {totalPages}</span>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages - 1}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {paginated.map((lead) => {
                const isOverdue = lead.follow_up_date && lead.follow_up_date <= today &&
                  !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                return (
                  <div
                    key={lead.id}
                    className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{lead.name}</p>
                      <p className="text-xs font-mono text-gray-500">{lead.phone}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                          {lead.current_lead_stage}
                        </span>
                        {lead.current_call_stage && (
                          <span className={`text-[10px] font-medium ${CALL_PILL[lead.current_call_stage] || 'text-gray-400'}`}>
                            {lead.current_call_stage}
                          </span>
                        )}
                        {isOverdue && lead.follow_up_date && (
                          <span className="text-[10px] text-red-500 font-medium">⚠ {formatDate(lead.follow_up_date)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={`tel:${lead.phone}`} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                        <Phone className="h-4 w-4" />
                      </a>
                      <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <button onClick={() => setEditingLeadId(lead.id)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: Standardised Table */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Toolbar: count + pagination + show all */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
                <span className="text-xs text-gray-500">
                  {showAll
                    ? `${filtered.length.toLocaleString()} leads`
                    : `${Math.min(safePage * PAGE_SIZE + 1, filtered.length).toLocaleString()}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}`}
                </span>
                <div className="flex items-center gap-3">
                  {!showAll && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p - 1)} disabled={safePage === 0}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-medium text-gray-600 px-1">{safePage + 1} / {totalPages}</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages - 1}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {filtered.length > PAGE_SIZE && (
                    <button
                      onClick={() => { setShowAll((v) => !v); setPage(0) }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      {showAll ? 'Paginate' : `Show all ${filtered.length.toLocaleString()}`}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Source</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((lead) => {
                      const isOverdue = lead.follow_up_date && lead.follow_up_date <= today &&
                        !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                      const isVisitToday = lead.visit_date === today
                      const isVisitOverdue = lead.visit_date && lead.visit_date < today &&
                        !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                      return (
                        <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                          {/* Lead */}
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-gray-900">{lead.name}</p>
                            {lead.city && <p className="text-xs text-gray-400 mt-0.5">{lead.city}</p>}
                          </td>
                          {/* Contact */}
                          <td className="px-4 py-3.5">
                            <p className="font-mono text-gray-700 text-[13px]">{lead.phone}</p>
                            {lead.email && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{lead.email}</p>}
                          </td>
                          {/* Course / Source */}
                          <td className="px-4 py-3.5">
                            <p className="text-gray-700 text-[13px]">{lead.course_interest || <span className="text-gray-300">—</span>}</p>
                            {lead.source_name && <p className="text-xs text-gray-400 mt-0.5">{lead.source_name}</p>}
                          </td>
                          {/* Stage */}
                          <td className="px-4 py-3.5">
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
                          <td className="px-4 py-3.5">
                            {lead.visit_date ? (
                              <span className={`text-xs font-medium ${isVisitOverdue ? 'text-red-500' : isVisitToday ? 'text-purple-600 font-semibold' : 'text-gray-600'}`}>
                                {isVisitOverdue && <span className="mr-0.5">⚠</span>}
                                {isVisitToday && <span className="mr-0.5">📅</span>}
                                {formatDate(lead.visit_date)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          {/* Follow-up */}
                          <td className="px-4 py-3.5">
                            {lead.follow_up_date ? (
                              <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : lead.follow_up_date === today ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
                                {isOverdue && <span className="mr-0.5">⚠</span>}
                                {formatDate(lead.follow_up_date)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              <a href={`tel:${lead.phone}`} title="Call" className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                <Phone className="h-4 w-4" />
                              </a>
                              <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                              <button onClick={() => setEditingLeadId(lead.id)} title="Edit lead" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
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
              {!showAll && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                  <span className="text-xs text-gray-500">
                    {Math.min(safePage * PAGE_SIZE + 1, filtered.length).toLocaleString()}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of{' '}
                    <span className="font-medium text-gray-700">{filtered.length.toLocaleString()}</span> leads
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p - 1)} disabled={safePage === 0}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-medium text-gray-600 px-2">{safePage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages - 1}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <LeadSlidePanel
        leadId={editingLeadId}
        collegeId={collegeId}
        currentUserId={counsellorId}
        onClose={() => setEditingLeadId(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </div>
  )
}
