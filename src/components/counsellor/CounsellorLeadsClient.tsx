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
  todayIST,
} from '@/lib/utils'
import {
  Search, Phone, MessageCircle, Users, Clock, PhoneOff, Building2, Pencil,
  ChevronLeft, ChevronRight, Calendar, GraduationCap, TrendingUp, XCircle, AlertTriangle,
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
  'No Show': 'bg-red-50 text-red-600',
  'Cold Lead': 'bg-gray-100 text-gray-500',
  'Wrong Lead': 'bg-red-50 text-red-500',
}

const TERMINAL_STAGES = ['Enrolled', 'Cold Lead', 'Wrong Lead', 'No Show']

type FilterTab = 'all' | 'today' | 'visits' | 'not-called' | 'interested' | 'enrolled' | 'no-show' | 'visit-overdue' | 'missed-followup'

const CALL_PILL: Record<string, string> = {
  'Call Picked':     'text-green-600',
  'Interested':      'text-blue-600',
  'Not Interested':  'text-red-500',
  'Call Not Picked': 'text-gray-400',
  'Call Later':      'text-orange-500',
}

export function CounsellorLeadsClient({ initialLeads, counsellorId, collegeId }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') || 'all') as FilterTab

  const [leads, setLeads] = useState(initialLeads)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [filterTab, setFilterTab] = useState<FilterTab>(initialFilter)
  const [page, setPage] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const resetPage = () => { setPage(0); setShowAll(false) }

  const today = todayIST()

  const filtered = useMemo(() => {
    let result = leads
    if (filterTab === 'today')           result = result.filter((l) => l.follow_up_date === today)
    else if (filterTab === 'visits')     result = result.filter((l) => l.visit_date === today)
    else if (filterTab === 'not-called') result = result.filter((l) => !l.current_call_stage)
    else if (filterTab === 'interested') result = result.filter((l) => l.current_call_stage === 'Interested')
    else if (filterTab === 'enrolled')   result = result.filter((l) => l.current_lead_stage === 'Enrolled')
    else if (filterTab === 'no-show')    result = result.filter((l) => l.current_lead_stage === 'No Show')
    else if (filterTab === 'visit-overdue')
      result = result.filter((l) => l.current_lead_stage === 'Visit Scheduled' && l.visit_date != null && l.visit_date < today)
    else if (filterTab === 'missed-followup')
      result = result.filter((l) => l.follow_up_date != null && l.follow_up_date < today && !TERMINAL_STAGES.includes(l.current_lead_stage))
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

  const tabCount: Record<FilterTab, number> = {
    all:               leads.length,
    today:             leads.filter((l) => l.follow_up_date === today).length,
    visits:            leads.filter((l) => l.visit_date === today).length,
    'not-called':      leads.filter((l) => !l.current_call_stage).length,
    interested:        leads.filter((l) => l.current_call_stage === 'Interested').length,
    enrolled:          leads.filter((l) => l.current_lead_stage === 'Enrolled').length,
    'no-show':         leads.filter((l) => l.current_lead_stage === 'No Show').length,
    'visit-overdue':   leads.filter((l) => l.current_lead_stage === 'Visit Scheduled' && l.visit_date != null && l.visit_date < today).length,
    'missed-followup': leads.filter((l) => l.follow_up_date != null && l.follow_up_date < today && !TERMINAL_STAGES.includes(l.current_lead_stage)).length,
  }

  const handleLeadUpdated = (id: string, updated: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l))
  }

  const allTabs: { key: FilterTab; label: string; icon: React.ElementType; danger?: boolean }[] = [
    { key: 'all',             label: 'All',            icon: Users },
    { key: 'missed-followup', label: 'Missed F/U',     icon: AlertTriangle, danger: true },
    { key: 'visit-overdue',   label: 'Visit Overdue',  icon: Building2,     danger: true },
    { key: 'no-show',         label: 'No Show',        icon: XCircle,       danger: true },
    { key: 'today',           label: 'Due Today',      icon: Clock },
    { key: 'visits',          label: "Today's Visits", icon: Building2 },
    { key: 'not-called',      label: 'Not Called',     icon: PhoneOff },
    { key: 'interested',      label: 'Interested',     icon: TrendingUp },
    { key: 'enrolled',        label: 'Enrolled',       icon: GraduationCap },
  ]
  // Always show All + active tab; show others only if they have leads
  const tabs = allTabs.filter((t) => t.key === 'all' || t.key === filterTab || tabCount[t.key] > 0)

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
          {tabs.map(({ key, label, icon: Icon, danger }) => {
            const isActive = filterTab === key
            const activeColor = danger ? 'border-red-500 text-red-600' : 'border-blue-600 text-blue-600'
            const badgeColor  = isActive
              ? (danger ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')
              : (danger && tabCount[key] > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500')
            return (
              <button
                key={key}
                onClick={() => { setFilterTab(key); resetPage() }}
                className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? activeColor
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                  {tabCount[key]}
                </span>
              </button>
            )
          })}
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
                const isOverdue = lead.follow_up_date && lead.follow_up_date < today &&
                  !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                const isVisitToday = lead.visit_date === today
                return (
                  <div key={lead.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    {/* Name + stage */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
                        <p className="text-sm font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                        {lead.city && <p className="text-xs text-gray-400 mt-0.5">{lead.city}</p>}
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </div>
                    {/* Tags: call stage + course + source */}
                    {(lead.current_call_stage || lead.course_interest || lead.source_name) && (
                      <div className="flex flex-wrap gap-1.5">
                        {lead.current_call_stage && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${CALL_PILL[lead.current_call_stage] || 'text-gray-600'}`}>
                            {lead.current_call_stage}
                          </span>
                        )}
                        {lead.course_interest && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                            {lead.course_interest}
                          </span>
                        )}
                        {lead.source_name && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                            {lead.source_name}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Dates */}
                    {(lead.follow_up_date || lead.visit_date) && (
                      <div className="flex items-center flex-wrap gap-3 text-xs">
                        {lead.follow_up_date && (
                          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : 'text-orange-500'}`}>
                            {isOverdue && '⚠ '}<Calendar className="h-3 w-3" />
                            Follow-up: {formatDate(lead.follow_up_date)}
                          </span>
                        )}
                        {lead.visit_date && (
                          <span className={`flex items-center gap-1 font-medium ${isVisitToday ? 'text-purple-600' : 'text-gray-500'}`}>
                            <Calendar className="h-3 w-3" />
                            Visit: {formatDate(lead.visit_date)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <a href={`tel:${lead.phone}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 text-green-700 border-green-200">
                          <Phone className="h-3.5 w-3.5" /> Call
                        </Button>
                      </a>
                      <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1 text-emerald-600 border-emerald-200">
                          <MessageCircle className="h-3.5 w-3.5" /> WA
                        </Button>
                      </a>
                      <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setEditingLeadId(lead.id)}>
                        <Pencil className="h-3.5 w-3.5" /> View
                      </Button>
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
