'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  PRIORITY_COLORS,
  LEAD_STAGES,
  formatDate,
} from '@/lib/utils'
import { Search, Phone, Eye } from 'lucide-react'

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

export function CounsellorLeadsClient({ initialLeads, counsellorId }: Props) {
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get('filter') || 'all'

  const [leads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'not-called'>(initialFilter as 'all' | 'today' | 'not-called')

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let result = leads

    if (filterTab === 'today') {
      result = result.filter((l) => l.follow_up_date === today)
    } else if (filterTab === 'not-called') {
      result = result.filter((l) => !l.current_call_stage)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email || '').toLowerCase().includes(q)
      )
    }

    if (stageFilter !== 'all') {
      result = result.filter((l) => l.current_lead_stage === stageFilter)
    }

    return result
  }, [leads, search, stageFilter, filterTab, today])

  const tabCount = {
    all: leads.length,
    today: leads.filter((l) => l.follow_up_date === today).length,
    'not-called': leads.filter((l) => !l.current_call_stage).length,
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
        <p className="text-gray-500 text-sm">{leads.length} leads assigned to you</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['all', 'today', 'not-called'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filterTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'all' ? 'All Leads' : tab === 'today' ? "Today's Follow-ups" : 'Not Called'}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filterTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {tabCount[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lead Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No leads found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className={`bg-white border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow ${
                lead.follow_up_date === today ? 'border-orange-200' : 'border-gray-200'
              }`}
            >
              {/* Top */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{lead.name}</p>
                  <p className="text-sm font-mono text-gray-500">{lead.phone}</p>
                  {lead.city && <p className="text-xs text-gray-400">{lead.city}</p>}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[lead.priority] || ''}`}>
                  {lead.priority}
                </span>
              </div>

              {/* Stage info */}
              <div className="flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                  {lead.current_lead_stage}
                </span>
                {lead.current_call_stage && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CALL_STAGE_COLORS[lead.current_call_stage] || 'bg-gray-100'}`}>
                    {lead.current_call_stage}
                  </span>
                )}
              </div>

              {/* Course & Source */}
              {(lead.course_interest || lead.source_name) && (
                <p className="text-xs text-gray-400">
                  {lead.course_interest && `${lead.course_interest}`}
                  {lead.course_interest && lead.source_name && ' · '}
                  {lead.source_name && `${lead.source_name}`}
                </p>
              )}

              {/* Follow-up */}
              {lead.follow_up_date && (
                <p className={`text-xs font-medium ${lead.follow_up_date <= today ? 'text-red-600' : 'text-orange-500'}`}>
                  📅 Follow-up: {formatDate(lead.follow_up_date)}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <a href={`tel:${lead.phone}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-green-600 border-green-200 hover:bg-green-50">
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                </a>
                <Link href={`/counsellor/leads/${lead.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
