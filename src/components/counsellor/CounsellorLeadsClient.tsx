'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
import { Search, Phone, Eye, Users, Clock, PhoneOff, MapPin, BookOpen, Calendar } from 'lucide-react'

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
  is_active: boolean
  created_at: string
}

interface Props {
  initialLeads: Lead[]
  counsellorId: string
}

const PRIORITY_DOT: Record<string, string> = {
  Hot: 'bg-red-500',
  Warm: 'bg-orange-400',
  Cold: 'bg-blue-400',
}

export function CounsellorLeadsClient({ initialLeads }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get('filter') || 'all'

  const [leads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'not-called'>(
    initialFilter as 'all' | 'today' | 'not-called'
  )

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let result = leads
    if (filterTab === 'today') result = result.filter((l) => l.follow_up_date === today)
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
    'not-called': leads.filter((l) => !l.current_call_stage).length,
  }

  const tabs = [
    { key: 'all' as const, label: 'All Leads', icon: Users },
    { key: 'today' as const, label: "Today's Follow-ups", icon: Clock },
    { key: 'not-called' as const, label: 'Not Called', icon: PhoneOff },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">{leads.length} leads assigned to you</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 bg-white px-4 rounded-t-xl -mb-px">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilterTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filterTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
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
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
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
            <SelectTrigger className="w-44 h-9">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((lead) => {
              const isFollowUpToday = lead.follow_up_date === today
              const isOverdue = lead.follow_up_date && lead.follow_up_date < today
              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all ${
                    isOverdue ? 'border-red-200' :
                    isFollowUpToday ? 'border-orange-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* Priority indicator bar */}
                  <div className={`h-1 ${
                    lead.priority === 'Hot' ? 'bg-red-400' :
                    lead.priority === 'Warm' ? 'bg-orange-300' :
                    'bg-blue-300'
                  }`} />

                  <div className="p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
                        <p className="text-sm font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[lead.priority] || 'bg-gray-300'}`} />
                        <span className="text-xs font-medium text-gray-600">{lead.priority}</span>
                      </div>
                    </div>

                    {/* Stage chips */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_lead_stage}
                      </span>
                      {lead.current_call_stage && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100 text-gray-700'}`}>
                          {lead.current_call_stage}
                        </span>
                      )}
                      {!lead.current_call_stage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-dashed border-gray-300">
                          Not called
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
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
                      <Link href={`/counsellor/leads/${lead.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1.5 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
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
    </div>
  )
}
