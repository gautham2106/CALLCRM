'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LEAD_STAGE_COLORS,
  CALL_STAGE_COLORS,
  PRIORITY_COLORS,
  LEAD_STAGES,
  formatDate,
} from '@/lib/utils'
import {
  Search,
  Filter,
  Upload,
  UserPlus,
  Phone,
  Eye,
  ChevronDown,
  Download,
} from 'lucide-react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'

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
  assigned_to: string | null
  assigned_user: { id: string; name: string; email: string } | null
}

interface Props {
  initialLeads: Lead[]
  counsellors: { id: string; name: string; email: string }[]
  sources: { id: string; source_name: string }[]
  collegeId: string
  adminId: string
}

export function AdminLeadsClient({ initialLeads, counsellors, sources, collegeId, adminId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [counsellorFilter, setCounsellorFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned'>('all')

  const filtered = useMemo(() => {
    let result = leads

    if (activeTab === 'unassigned') {
      result = result.filter((l) => !l.assigned_to)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      )
    }

    if (stageFilter !== 'all') {
      result = result.filter((l) => l.current_lead_stage === stageFilter)
    }

    if (counsellorFilter !== 'all') {
      if (counsellorFilter === 'unassigned') {
        result = result.filter((l) => !l.assigned_to)
      } else {
        result = result.filter((l) => l.assigned_to === counsellorFilter)
      }
    }

    if (priorityFilter !== 'all') {
      result = result.filter((l) => l.priority === priorityFilter)
    }

    return result
  }, [leads, search, stageFilter, counsellorFilter, priorityFilter, activeTab])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)))
    }
  }

  const exportCSV = () => {
    const rows = filtered.map((l) => ({
      Name: l.name,
      Phone: l.phone,
      Email: l.email || '',
      City: l.city || '',
      Course: l.course_interest || '',
      Source: l.source_name || '',
      'Lead Stage': l.current_lead_stage,
      'Call Stage': l.current_call_stage || '',
      Priority: l.priority,
      'Follow-up Date': l.follow_up_date || '',
      'Assigned To': l.assigned_user?.name || 'Unassigned',
      'Created At': formatDate(l.created_at),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">{leads.length} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Link href={`/admin/assignment?leads=${Array.from(selectedIds).join(',')}`}>
              <Button variant="default" size="sm">
                <UserPlus className="h-4 w-4" />
                Assign {selectedIds.size} leads
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/admin/leads/import">
            <Button size="sm">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['all', 'unassigned'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'all' ? 'All Leads' : 'Unassigned'}
            {tab === 'unassigned' && (
              <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                {leads.filter((l) => !l.assigned_to).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Lead Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={counsellorFilter} onValueChange={setCounsellorFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Counsellor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Counsellors</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {counsellors.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="Hot">Hot</SelectItem>
            <SelectItem value="Warm">Warm</SelectItem>
            <SelectItem value="Cold">Cold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Course / Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Follow-up</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No leads found
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-xs text-gray-400">{lead.city || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-mono text-gray-700">{lead.phone}</p>
                        {lead.email && (
                          <p className="text-xs text-gray-400 truncate max-w-36">{lead.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-700 text-xs">{lead.course_interest || '—'}</p>
                        <p className="text-xs text-gray-400">{lead.source_name || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[lead.priority] || ''}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.assigned_user ? (
                        <span className="text-gray-700">{lead.assigned_user.name}</span>
                      ) : (
                        <span className="text-orange-500 font-medium text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${
                        lead.follow_up_date && lead.follow_up_date <= new Date().toISOString().split('T')[0]
                          ? 'text-red-600 font-medium'
                          : 'text-gray-500'
                      }`}>
                        {formatDate(lead.follow_up_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a href={`tel:${lead.phone}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-green-600">
                          <Phone className="h-4 w-4" />
                        </a>
                        <Link href={`/admin/leads/${lead.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {filtered.length} of {leads.length} leads
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </span>
        </div>
      </div>
    </div>
  )
}
