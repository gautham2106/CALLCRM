'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  LEAD_STAGES,
  formatDate,
} from '@/lib/utils'
import { Search, Phone, Eye, Users, Clock, PhoneOff, MapPin, BookOpen, Calendar, Building2 } from 'lucide-react'
import { LeadSlidePanel } from '@/components/shared/LeadSlidePanel'

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
        {/* Tabs — horizontally scrollable on mobile */}
        <div className="flex border-b border-gray-200 bg-white px-2 sm:px-4 rounded-t-xl -mb-px overflow-x-auto scrollbar-none">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilterTab(key)}
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
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Lead Cards */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-400">
            <Phone className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No leads found</p>
            <p className="text-xs mt-1">Try changing filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((lead) => {
              const isFollowUpToday = lead.follow_up_date === today
              const isOverdue = lead.follow_up_date && lead.follow_up_date < today
              const isVisitToday = lead.visit_date === today
              const isVisitOverdue = lead.visit_date && lead.visit_date < today

              const stageBorderColor =
                lead.current_lead_stage === 'Enrolled' ? 'border-l-green-400' :
                lead.current_lead_stage === 'Visit Scheduled' ? 'border-l-purple-400' :
                lead.current_lead_stage === 'Visit Done' ? 'border-l-indigo-400' :
                lead.current_lead_stage === 'Application Started' ? 'border-l-orange-400' :
                lead.current_lead_stage === 'Contacted' ? 'border-l-yellow-400' :
                lead.current_lead_stage === 'Cold Lead' ? 'border-l-gray-300' :
                lead.current_lead_stage === 'Wrong Lead' ? 'border-l-red-300' :
                'border-l-blue-400'

              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border-l-4 border border-gray-200 overflow-hidden hover:shadow-md transition-all ${stageBorderColor} ${
                    isOverdue ? 'ring-1 ring-red-200' :
                    isFollowUpToday ? 'ring-1 ring-orange-200' : ''
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Name + stage */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
                        <p className="text-sm font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </div>

                    {/* Call stage */}
                    {lead.current_call_stage ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_call_stage}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-dashed border-gray-300">
                        Not called yet
                      </span>
                    )}

                    {/* Meta */}
                    <div className="space-y-1">
                      {lead.city && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {lead.city}
                        </p>
                      )}
                      {lead.course_interest && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-400">
                          <BookOpen className="h-3 w-3 shrink-0" />
                          {lead.course_interest}
                        </p>
                      )}
                      {lead.visit_date && (
                        <p className={`flex items-center gap-1.5 text-xs font-semibold ${
                          isVisitOverdue ? 'text-red-600' : isVisitToday ? 'text-purple-600' : 'text-gray-500'
                        }`}>
                          <Building2 className="h-3 w-3 shrink-0" />
                          {isVisitOverdue ? 'Visit overdue: ' : isVisitToday ? 'Visit TODAY: ' : 'Visit: '}
                          {formatDate(lead.visit_date)}
                        </p>
                      )}
                      {lead.follow_up_date && (
                        <p className={`flex items-center gap-1.5 text-xs font-medium ${
                          isOverdue ? 'text-red-600' : isFollowUpToday ? 'text-orange-600' : 'text-gray-500'
                        }`}>
                          <Calendar className="h-3 w-3 shrink-0" />
                          {isOverdue ? 'Overdue: ' : isFollowUpToday ? 'Today: ' : 'Follow-up: '}
                          {formatDate(lead.follow_up_date)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <a href={`tel:${lead.phone}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300">
                          <Phone className="h-3.5 w-3.5" />
                          Call
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                        onClick={() => setEditingLeadId(lead.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 pt-2">
            Showing {filtered.length} of {leads.length} leads
          </p>
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
