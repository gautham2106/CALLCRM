'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { LEAD_STAGE_COLORS } from '@/lib/utils'
import {
  Shuffle,
  Search,
  Loader2,
} from 'lucide-react'

interface Lead {
  id: string
  name: string
  phone: string
  city: string | null
  course_interest: string | null
  source_name: string | null
  current_lead_stage: string
  assigned_to: string | null
  assigned_user: { id: string; name: string } | null
}

interface Counsellor {
  id: string
  name: string
  email: string
}

interface Props {
  initialLeads: Lead[]
  counsellors: Counsellor[]
  collegeId: string
  adminId: string
}

export function AssignmentClient({ initialLeads, counsellors }: Props) {
  const searchParams = useSearchParams()

  const preSelectedIds = searchParams.get('leads')?.split(',').filter(Boolean) || []

  const [leads, setLeads] = useState(initialLeads)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds))
  const [filterCounsellor, setFilterCounsellor] = useState<string>('unassigned')
  const [distributing, setDistributing] = useState(false)

  const filtered = useMemo(() => {
    let result = leads

    if (filterCounsellor === 'unassigned') {
      result = result.filter((l) => !l.assigned_to)
    } else if (filterCounsellor) {
      result = result.filter((l) => l.assigned_to === filterCounsellor)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [leads, search, filterCounsellor])

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

  const autoDistribute = async () => {
    if (counsellors.length === 0 || selectedIds.size === 0) return
    setDistributing(true)

    const leadIds = Array.from(selectedIds)

    try {
      const res = await fetch('/api/admin/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Distribution failed')

      // Rebuild local assignments (round-robin, same logic as server)
      const assignments: Record<string, string[]> = {}
      leadIds.forEach((id, idx) => {
        const c = counsellors[idx % counsellors.length]
        if (!assignments[c.id]) assignments[c.id] = []
        assignments[c.id].push(id)
      })

      setLeads((prev) =>
        prev.map((l) => {
          for (const [counsellorId, ids] of Object.entries(assignments)) {
            if (ids.includes(l.id)) {
              const c = counsellors.find((c) => c.id === counsellorId)
              return { ...l, assigned_to: counsellorId, assigned_user: { id: counsellorId, name: c?.name || '' } }
            }
          }
          return l
        })
      )

      toast({
        title: 'Auto-distributed!',
        description: `${leadIds.length} leads distributed equally among ${counsellors.length} counsellors`,
        variant: 'success',
      })
      setSelectedIds(new Set())
    } catch (err: unknown) {
      const error = err as Error
      toast({ title: 'Distribution failed', description: error?.message || 'Something went wrong.', variant: 'destructive' })
    } finally {
      setDistributing(false)
    }
  }

  const unassignedCount = leads.filter((l) => !l.assigned_to).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Auto-Distribute</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Evenly split leads across all counsellors. For manual assignment, use the{' '}
            <a href="/admin/leads" className="text-blue-600 hover:underline">Leads page</a>.
          </p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={autoDistribute}
              disabled={distributing || counsellors.length === 0}
            >
              {distributing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Shuffle className="h-4 w-4" />
              }
              Distribute Evenly
            </Button>
          </div>
        )}
      </div>

      {/* Counsellor workload summary */}
      {counsellors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm mx-auto mb-1">?</div>
            <p className="text-xs font-medium text-gray-700">Unassigned</p>
            <p className="text-lg font-bold text-orange-600">{unassignedCount}</p>
            <p className="text-xs text-gray-400">leads</p>
          </div>
          {counsellors.map((c) => {
            const count = leads.filter((l) => l.assigned_to === c.id).length
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-sm mx-auto mb-1">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-lg font-bold text-blue-600">{count}</p>
                <p className="text-xs text-gray-400">leads</p>
              </div>
            )
          })}
        </div>
      )}

      {counsellors.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No active counsellors found. Add counsellors first before distributing leads.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-lg border border-gray-200">
        <Select value={filterCounsellor} onValueChange={setFilterCounsellor}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Filter by counsellor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            <SelectItem value="all">All Leads</SelectItem>
            {counsellors.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({leads.filter((l) => l.assigned_to === c.id).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-12 text-center text-gray-400 text-sm">
            {filterCounsellor === 'unassigned' ? 'All leads are assigned!' : 'No leads found'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-2.5">
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-gray-500 font-medium">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all ${filtered.length}`}
              </span>
            </div>
            {filtered.map((lead) => (
              <div
                key={lead.id}
                onClick={() => toggleSelect(lead.id)}
                className={`bg-white rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  selectedIds.has(lead.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900">{lead.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{lead.phone}</p>
                    {(lead.city || lead.course_interest) && (
                      <p className="text-xs text-gray-400 mt-0.5">{lead.city || lead.course_interest}</p>
                    )}
                    <div className="mt-1.5">
                      {lead.assigned_user ? (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{lead.assigned_user.name}</span>
                      ) : (
                        <span className="text-xs text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Currently Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  {filterCounsellor === 'unassigned' ? 'All leads are assigned!' : 'No leads found'}
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className={`hover:bg-gray-50 ${selectedIds.has(lead.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.city || lead.course_interest || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                      {lead.current_lead_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.assigned_user ? (
                      <span className="text-gray-700">{lead.assigned_user.name}</span>
                    ) : (
                      <span className="text-orange-500 font-medium text-xs">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
