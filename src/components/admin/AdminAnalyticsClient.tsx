'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Users, GraduationCap, PhoneCall, AlertCircle, Clock, Building2,
  TrendingUp, Activity, UserX, Target, ArrowUp, ArrowDown, Minus, Shield,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'

// ---- Types ----
interface Overview {
  totalLeads: number
  enrolled: number
  inProgress: number
  coldWrong: number
  unassigned: number
  conversionRate: number
  callsToday: number
  staleLeads: number
  todayFollowUps: number
  todayVisits: number
}

interface FunnelEntry {
  stage: string
  count: number
}

interface StageEntry {
  stage: string
  count: number
}

interface SourceLead {
  id: string
  name: string
  phone: string
  stage: string
  counsellor: string
  createdAt: string
}

interface SourceStat {
  source: string
  total: number
  enrolled: number
  rate: number
  stages: StageEntry[]
  thisMonth: number
  lastMonth: number
  leads: SourceLead[]
}

interface SchoolInterest {
  school_name: string
  total: number
  interested: number
  not_interested: number
  enrolled: number
}

interface CounsellorInterest {
  counsellor_id: string
  name: string
  total_called: number
  interested: number
  not_interested: number
}

interface TeamPerformance {
  team_leader_id: string
  team_leader_name: string
  total_counsellors: number
  total_leads: number
  called: number
  not_called: number
  interested: number
  not_interested: number
  visit_done: number
  enrolled: number
  cold_wrong: number
  stale: number
  followups_today: number
}

interface CounsellorStat {
  id: string
  name: string
  teamLeaderId: string | null
  assigned: number
  called: number
  notCalled: number
  interested: number
  enrolled: number
  conversion: number
  followUpsToday: number
}

interface Props {
  overview: Overview
  funnelData: FunnelEntry[]
  sourceData: SourceStat[]
  schoolInterest?: SchoolInterest[]
  counsellorInterest?: CounsellorInterest[]
  teamPerformance?: TeamPerformance[]
  counsellorStats?: CounsellorStat[]
}

// ---- Colors ----
const STAGE_COLORS: Record<string, string> = {
  'New Enquiry': '#3b82f6',
  'Contacted': '#f59e0b',
  'Visit Scheduled': '#8b5cf6',
  'Visit Done': '#6366f1',
  'Application Started': '#f97316',
  'Enrolled': '#22c55e',
  'Cold Lead': '#6b7280',
  'Wrong Lead': '#ef4444',
}

const STAGE_PILL: Record<string, string> = {
  'New Enquiry': 'bg-blue-100 text-blue-700',
  'Contacted': 'bg-amber-100 text-amber-700',
  'Visit Scheduled': 'bg-purple-100 text-purple-700',
  'Visit Done': 'bg-indigo-100 text-indigo-700',
  'Application Started': 'bg-orange-100 text-orange-700',
  'Enrolled': 'bg-green-100 text-green-700',
  'Cold Lead': 'bg-gray-100 text-gray-500',
  'Wrong Lead': 'bg-red-100 text-red-500',
}

type TabId = 'teams' | 'overview' | 'pipeline' | 'interest'

// ============================================================
// Root Component
// ============================================================
export function AdminAnalyticsClient({ overview, funnelData, sourceData, schoolInterest = [], counsellorInterest = [], teamPerformance = [], counsellorStats = [] }: Props) {
  const [tab, setTab] = useState<TabId>('teams')

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'teams',    label: 'Team Performance', icon: Shield },
    { id: 'overview', label: 'Overview',          icon: TrendingUp },
    { id: 'pipeline', label: 'Pipeline & Sources', icon: Activity },
    { id: 'interest', label: 'Interest Analytics', icon: Target },
  ]

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-2 sm:px-6 overflow-x-auto">
        <div className="flex">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {tab === 'teams'    && <TeamsTab teams={teamPerformance} counsellorStats={counsellorStats} />}
        {tab === 'overview' && <OverviewTab overview={overview} funnelData={funnelData} />}
        {tab === 'pipeline' && <PipelineTab funnelData={funnelData} sourceData={sourceData} overview={overview} />}
        {tab === 'interest' && <InterestTab schoolInterest={schoolInterest} counsellorInterest={counsellorInterest} />}
      </div>
    </div>
  )
}

// ============================================================
// Tab 1 — Team Overview
// ============================================================
function OverviewTab({ overview, funnelData }: { overview: Overview; funnelData: FunnelEntry[] }) {
  const maxCount = Math.max(...funnelData.map((f) => f.count), 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard label="Total Leads" value={overview.totalLeads} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50" iconColor="text-blue-600" sub="active pipeline" />
        <KPICard label="Enrolled" value={overview.enrolled} icon={<GraduationCap className="h-5 w-5" />} iconBg="bg-green-50" iconColor="text-green-600" sub={`${overview.conversionRate}% conversion`} subColor="text-green-600" />
        <KPICard label="In Progress" value={overview.inProgress} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-indigo-50" iconColor="text-indigo-600" sub="being worked" />
        <KPICard label="Cold / Wrong" value={overview.coldWrong} icon={<UserX className="h-5 w-5" />} iconBg="bg-gray-100" iconColor="text-gray-500" sub="not converting" />
      </div>

      {(overview.staleLeads > 0 || overview.unassigned > 0 || overview.todayFollowUps > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FlagCard value={overview.staleLeads} label="Stale Leads (3+ days silent)" icon={<AlertCircle className="h-5 w-5" />} color={overview.staleLeads > 0 ? 'red' : 'gray'} />
          <FlagCard value={overview.unassigned} label="Unassigned Leads" icon={<Users className="h-5 w-5" />} color={overview.unassigned > 0 ? 'orange' : 'gray'} />
          <FlagCard value={overview.todayFollowUps} label="Follow-ups Due Today" icon={<Clock className="h-5 w-5" />} color={overview.todayFollowUps > 0 ? 'blue' : 'gray'} />
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Today&apos;s Pulse</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PulseCard label="Calls Logged" value={overview.callsToday} icon={<PhoneCall className="h-4 w-4 text-blue-500" />} bg="bg-blue-50" />
          <PulseCard label="Follow-ups" value={overview.todayFollowUps} icon={<Clock className="h-4 w-4 text-amber-500" />} bg="bg-amber-50" />
          <PulseCard label="Campus Visits" value={overview.todayVisits} icon={<Building2 className="h-4 w-4 text-purple-500" />} bg="bg-purple-50" />
          <PulseCard label="Stale Leads" value={overview.staleLeads} icon={<AlertCircle className="h-4 w-4 text-red-400" />} bg="bg-red-50" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Lead Stage Snapshot</h3>
          <p className="text-xs text-gray-400 mt-0.5">Where every lead sits right now</p>
        </div>
        <div className="p-5 space-y-3">
          {funnelData.map((item) => {
            const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0
            const color = STAGE_COLORS[item.stage] || '#94a3b8'
            return (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 shrink-0 text-right leading-tight">{item.stage}</span>
                <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg flex items-center px-2.5 transition-all duration-500"
                    style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`, backgroundColor: color }}
                  >
                    {item.count > 0 && pct > 12 && (
                      <span className="text-white text-xs font-semibold">{item.count}</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-semibold w-7 shrink-0 tabular-nums ${pct <= 12 ? 'text-gray-600' : 'text-transparent'}`}>
                  {item.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tab 2 — Pipeline & Sources
// ============================================================
function PipelineTab({ funnelData, sourceData, overview }: {
  funnelData: FunnelEntry[]; sourceData: SourceStat[]; overview: Overview
}) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const maxSourceTotal = Math.max(...sourceData.map((s) => s.total), 1)
  const bestConvertingSource = sourceData.filter((s) => s.total >= 3).reduce(
    (best, curr) => (curr.rate > (best?.rate || 0) ? curr : best),
    null as SourceStat | null
  )
  const highestVolumeSource = sourceData.reduce(
    (best, curr) => (curr.total > (best?.total || 0) ? curr : best),
    null as SourceStat | null
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PulseCard label="Active Pipeline" value={overview.inProgress + overview.enrolled} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} bg="bg-blue-50" />
        <PulseCard label="Enrolled" value={overview.enrolled} icon={<GraduationCap className="h-4 w-4 text-green-500" />} bg="bg-green-50" />
        <PulseCard label="Dead Leads" value={overview.coldWrong} icon={<UserX className="h-4 w-4 text-gray-400" />} bg="bg-gray-100" />
        <PulseCard label="Conversion Rate" value={overview.conversionRate} icon={<Target className="h-4 w-4 text-orange-500" />} bg="bg-orange-50" suffix="%" />
      </div>

      {/* Stage Distribution */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Stage Distribution</h3>
          <p className="text-xs text-gray-400 mt-0.5">Volume at each stage of the pipeline</p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 36, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={130} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {funnelData.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Intelligence */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">Source Intelligence</h3>
              <p className="text-xs text-gray-400 mt-0.5">Where leads come from, where they end up — tap a row to see stage breakdown</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {bestConvertingSource && (
                <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                  Best Rate: {bestConvertingSource.source} ({bestConvertingSource.rate}%)
                </span>
              )}
              {highestVolumeSource && highestVolumeSource.source !== bestConvertingSource?.source && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  Most Volume: {highestVolumeSource.source}
                </span>
              )}
            </div>
          </div>
        </div>

        {sourceData.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No source data yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sourceData.map((s) => {
              const volPct = maxSourceTotal > 0 ? Math.round((s.total / maxSourceTotal) * 100) : 0
              const isBest = s.source === bestConvertingSource?.source
              const isExpanded = expandedSource === s.source
              const trendDiff = s.thisMonth - s.lastMonth

              return (
                <div key={s.source}>
                  <button
                    onClick={() => setExpandedSource(isExpanded ? null : s.source)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2 gap-4">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-semibold text-gray-900 text-sm">{s.source}</span>
                        {isBest && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold shrink-0">Best Rate</span>
                        )}
                        <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          trendDiff > 0 ? 'bg-green-50 text-green-600' : trendDiff < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {trendDiff > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : trendDiff < 0 ? <ArrowDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                          {s.thisMonth} this month
                          {s.lastMonth > 0 && (
                            <span className="opacity-70 ml-0.5">({trendDiff > 0 ? '+' : ''}{trendDiff} vs last)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                        <span className="tabular-nums">{s.total} leads</span>
                        <span className="text-green-600 font-semibold tabular-nums">{s.enrolled} enrolled</span>
                        <span className={`font-bold w-9 text-right tabular-nums ${s.rate >= 20 ? 'text-green-600' : s.rate >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {s.rate}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${volPct}%` }} />
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${s.rate >= 20 ? 'bg-green-500' : s.rate >= 10 ? 'bg-orange-400' : 'bg-gray-300'}`}
                          style={{ width: `${s.rate}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded: stage breakdown + lead list */}
                  {isExpanded && (
                    <SourceLeadPanel source={s} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {sourceData.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-blue-400 inline-block" />Lead volume</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-green-500 inline-block" />Conversion rate</span>
            <span className="opacity-70">Tap a row to expand stage breakdown</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Source Lead Panel (expanded view)
// ============================================================
function SourceLeadPanel({ source: s }: { source: SourceStat }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? s.leads : s.leads.slice(0, 30)

  function fmt(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      {/* Summary stats */}
      <div className="flex items-center gap-6 mb-3 text-xs text-gray-500">
        <span><span className="font-bold text-gray-900">{s.total}</span> total leads</span>
        <span><span className="font-bold text-green-600">{s.enrolled}</span> enrolled</span>
        <span><span className={`font-bold ${s.rate >= 20 ? 'text-green-600' : s.rate >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>{s.rate}%</span> conversion</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Phone</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Stage</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Counsellor</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">Added On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{lead.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 tabular-nums">{lead.phone || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STAGE_PILL[lead.stage] || 'bg-gray-100 text-gray-500'}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {lead.counsellor === 'Unassigned'
                      ? <span className="text-orange-500 font-medium">Unassigned</span>
                      : lead.counsellor}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{fmt(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!showAll && s.leads.length > 30 && (
          <div className="border-t border-gray-100 px-4 py-3 text-center">
            <button onClick={() => setShowAll(true)} className="text-xs text-blue-600 font-medium hover:underline">
              Show all {s.leads.length} leads
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Tab 3 — Interest Analytics
// ============================================================
function InterestTab({ schoolInterest, counsellorInterest }: {
  schoolInterest: SchoolInterest[]; counsellorInterest: CounsellorInterest[]
}) {
  const [schoolSort, setSchoolSort] = useState<'total' | 'interested' | 'not_interested' | 'rate'>('total')
  const [counsellorSort, setCounsellorSort] = useState<'ni_ratio' | 'total_called' | 'interested' | 'not_interested'>('ni_ratio')

  const sortedSchools = [...schoolInterest].sort((a, b) => {
    if (schoolSort === 'rate') {
      const rateA = a.total > 0 ? a.interested / a.total : 0
      const rateB = b.total > 0 ? b.interested / b.total : 0
      return rateB - rateA
    }
    return (b[schoolSort] as number) - (a[schoolSort] as number)
  })

  // Average NI ratio across counsellors with min 10 called
  const qualifiedCounsellors = counsellorInterest.filter((c) => c.total_called >= 10)
  const avgNIRatio = qualifiedCounsellors.length > 0
    ? qualifiedCounsellors.reduce((sum, c) => sum + (c.total_called > 0 ? c.not_interested / c.total_called : 0), 0) / qualifiedCounsellors.length
    : 0

  const sortedCounsellors = [...counsellorInterest].sort((a, b) => {
    if (counsellorSort === 'ni_ratio') {
      const ratioA = a.total_called > 0 ? a.not_interested / a.total_called : 0
      const ratioB = b.total_called > 0 ? b.not_interested / b.total_called : 0
      return ratioB - ratioA
    }
    return (b[counsellorSort] as number) - (a[counsellorSort] as number)
  })

  return (
    <div className="space-y-6">
      {/* School Interest Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">School-wise Interest</h3>
          <p className="text-xs text-gray-400 mt-0.5">Interest rates across schools — identify which schools respond best</p>
        </div>
        {schoolInterest.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No school data yet. Import leads with school names to see analytics.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School</th>
                  {[
                    { key: 'total', label: 'Total' },
                    { key: 'interested', label: 'Interested' },
                    { key: 'not_interested', label: 'Not Int.' },
                    { key: 'rate', label: 'Interest Rate' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => setSchoolSort(col.key as typeof schoolSort)}
                      className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-gray-800 ${
                        schoolSort === col.key ? 'text-blue-600' : 'text-gray-500'
                      }`}
                    >
                      {col.label} {schoolSort === col.key && '▾'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedSchools.map((s) => {
                  const rate = s.total > 0 ? Math.round((s.interested / s.total) * 100) : 0
                  const bestRate = Math.max(...schoolInterest.filter((x) => x.total >= 5).map((x) => x.total > 0 ? Math.round((x.interested / x.total) * 100) : 0), 0)
                  const worstRate = Math.min(...schoolInterest.filter((x) => x.total >= 5).map((x) => x.total > 0 ? Math.round((x.interested / x.total) * 100) : 100), 100)
                  const isBest = s.total >= 5 && rate === bestRate && rate > 0
                  const isWorst = s.total >= 5 && rate === worstRate && schoolInterest.filter((x) => x.total >= 5).length > 1
                  return (
                    <tr key={s.school_name} className={`hover:bg-blue-50/30 transition-colors ${isBest ? 'bg-green-50/40' : isWorst ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.school_name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{s.total}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-medium tabular-nums">{s.interested}</td>
                      <td className="px-4 py-2.5 text-right text-red-500 font-medium tabular-nums">{s.not_interested}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${isBest ? 'text-green-700' : isWorst ? 'text-red-600' : 'text-gray-700'}`}>
                        {rate}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Counsellor Interest Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Counsellor-wise Interest Analysis</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Detect abnormal &quot;Not Interested&quot; ratios — counsellors flagged if NI ratio is 1.5x above average (min 10 calls)
          </p>
        </div>
        {counsellorInterest.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No call data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Counsellor</th>
                  {[
                    { key: 'total_called', label: 'Called' },
                    { key: 'interested', label: 'Interested' },
                    { key: 'not_interested', label: 'Not Int.' },
                    { key: 'ni_ratio', label: 'NI Ratio' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => setCounsellorSort(col.key as typeof counsellorSort)}
                      className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-gray-800 ${
                        counsellorSort === col.key ? 'text-blue-600' : 'text-gray-500'
                      }`}
                    >
                      {col.label} {counsellorSort === col.key && '▾'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCounsellors.map((c) => {
                  const niRatio = c.total_called > 0 ? Math.round((c.not_interested / c.total_called) * 100) : 0
                  const isFlagged = c.total_called >= 10 && avgNIRatio > 0 && (c.not_interested / c.total_called) > avgNIRatio * 1.5
                  return (
                    <tr key={c.counsellor_id} className={`hover:bg-blue-50/30 transition-colors ${isFlagged ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <span className="flex items-center gap-2">
                          {c.name}
                          {isFlagged && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold" title="NI ratio significantly above average">
                              Review
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{c.total_called}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-medium tabular-nums">{c.interested}</td>
                      <td className="px-4 py-2.5 text-right text-red-500 font-medium tabular-nums">{c.not_interested}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${isFlagged ? 'text-red-600' : 'text-gray-700'}`}>
                        {niRatio}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {avgNIRatio > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
                Average NI ratio (min 10 calls): <span className="font-medium text-gray-600">{Math.round(avgNIRatio * 100)}%</span>
                {' '}— Flagged threshold: <span className="font-medium text-red-500">{Math.round(avgNIRatio * 150)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Tab 1 — Team Performance (now the default tab)
// ============================================================
type TeamSortKey = 'enrollRate' | 'callCoverage' | 'staleRate' | 'totalLeads' | 'interestedRate' | 'niRate'

function TeamsTab({ teams, counsellorStats }: { teams: TeamPerformance[]; counsellorStats: CounsellorStat[] }) {
  const [sortKey, setSortKey] = useState<TeamSortKey>('enrollRate')
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  if (teams.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
        <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No teams configured yet</p>
        <p className="text-sm text-gray-400 mt-1">Add team leaders and assign counsellors to see team performance.</p>
      </div>
    )
  }

  const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0

  const band = (value: number, lo: number, hi: number, invert = false) => {
    if (invert) {
      if (value <= lo) return { bar: '#22c55e', text: 'text-green-600' }
      if (value <= hi) return { bar: '#f59e0b', text: 'text-amber-600' }
      return { bar: '#ef4444', text: 'text-red-600' }
    }
    if (value >= hi) return { bar: '#22c55e', text: 'text-green-600' }
    if (value >= lo) return { bar: '#f59e0b', text: 'text-amber-600' }
    return { bar: '#ef4444', text: 'text-red-600' }
  }

  const totalLeads    = teams.reduce((s, t) => s + t.total_leads, 0)
  const totalEnrolled = teams.reduce((s, t) => s + t.enrolled, 0)
  const overallRate   = pct(totalEnrolled, totalLeads)

  const sortedTeams = [...teams].sort((a, b) => {
    if (sortKey === 'enrollRate')     return pct(b.enrolled,       b.total_leads) - pct(a.enrolled,       a.total_leads)
    if (sortKey === 'callCoverage')  return pct(b.called,         b.total_leads) - pct(a.called,         a.total_leads)
    if (sortKey === 'staleRate')     return pct(a.stale,          a.total_leads) - pct(b.stale,          b.total_leads) // asc — lower is better
    if (sortKey === 'totalLeads')    return b.total_leads - a.total_leads
    if (sortKey === 'interestedRate') return pct(b.interested,    b.called)      - pct(a.interested,    a.called)
    if (sortKey === 'niRate')        return pct(a.not_interested, a.called)      - pct(b.not_interested, b.called) // asc — lower NI is better
    return 0
  })

  const RANK_BADGES = ['🥇', '🥈', '🥉']

  const sortOptions: { key: TeamSortKey; label: string }[] = [
    { key: 'enrollRate',     label: 'Enrollment Rate' },
    { key: 'callCoverage',   label: 'Call Coverage' },
    { key: 'interestedRate', label: 'Interest Rate' },
    { key: 'niRate',         label: 'Least NI' },
    { key: 'staleRate',      label: 'Least Stale' },
    { key: 'totalLeads',     label: 'Total Leads' },
  ]

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PulseCard label="Teams"          value={teams.length}   icon={<Shield        className="h-4 w-4 text-purple-500" />} bg="bg-purple-50" />
        <PulseCard label="Total Leads"    value={totalLeads}     icon={<Users         className="h-4 w-4 text-blue-500"   />} bg="bg-blue-50" />
        <PulseCard label="Total Enrolled" value={totalEnrolled}  icon={<GraduationCap className="h-4 w-4 text-green-500"  />} bg="bg-green-50" />
        <PulseCard label="Overall Rate"   value={overallRate}    icon={<Target        className="h-4 w-4 text-orange-500" />} bg="bg-orange-50" suffix="%" />
      </div>

      {/* Sort controls + legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort by:</span>
        {sortOptions.map((o) => (
          <button
            key={o.key}
            onClick={() => setSortKey(o.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              sortKey === o.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-400 hidden sm:inline">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Good</span>
          {' · '}
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Average</span>
          {' · '}
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Needs attention</span>
        </span>
      </div>

      {/* Team cards */}
      {sortedTeams.map((team, idx) => {
        const coverage    = pct(team.called,         team.total_leads)
        const interestRate= pct(team.interested,     team.called)
        const niRate      = pct(team.not_interested, team.called)
        const visitRate   = pct(team.visit_done,     team.interested)
        const closingRate = pct(team.enrolled,       team.visit_done)
        const enrollRate  = pct(team.enrolled,       team.total_leads)
        const staleRate   = pct(team.stale,          team.total_leads)
        const deadRate    = pct(team.cold_wrong,     team.total_leads)
        const isExpanded  = expandedTeam === team.team_leader_id

        const enrollColors = band(enrollRate, 8, 15)

        const metrics: {
          label: string; pct: number; num: number; sub: string
          lo: number; hi: number; invert?: boolean
        }[] = [
          { label: 'Call Coverage',    pct: coverage,     num: team.called,         sub: 'called',        lo: 60, hi: 80 },
          { label: 'Interest Rate',    pct: interestRate, num: team.interested,     sub: 'interested',    lo: 25, hi: 45 },
          { label: 'Not Interested ↓', pct: niRate,       num: team.not_interested, sub: 'not interested',lo: 30, hi: 50, invert: true },
          { label: 'Visit Conversion', pct: visitRate,    num: team.visit_done,     sub: 'visits',        lo: 30, hi: 55 },
          { label: 'Closing Rate',     pct: closingRate,  num: team.enrolled,       sub: 'enrolled',      lo: 40, hi: 65 },
        ]

        const teamCounsellors = counsellorStats.filter((c) => c.teamLeaderId === team.team_leader_id)

        return (
          <div key={team.team_leader_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0 select-none">{RANK_BADGES[idx] ?? `#${idx + 1}`}</span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-base leading-snug">{team.team_leader_name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {team.total_counsellors} counsellor{team.total_counsellors !== 1 ? 's' : ''}
                    &nbsp;·&nbsp;
                    {team.total_leads.toLocaleString()} leads
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-3xl font-bold tabular-nums leading-none ${enrollColors.text}`}>{enrollRate}%</p>
                <p className="text-[11px] text-gray-400 mt-1">Enrollment Rate</p>
                <p className={`text-xs font-semibold mt-0.5 ${enrollColors.text}`}>{team.enrolled} enrolled</p>
              </div>
            </div>

            {/* Funnel metric bars */}
            <div className="px-5 py-4 space-y-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Performance Funnel</p>
              {metrics.map((m) => {
                const colors = band(m.pct, m.lo, m.hi, m.invert)
                const barW   = Math.max(m.pct, m.num > 0 ? 2 : 0)
                return (
                  <div key={m.label} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs text-gray-500 w-32 shrink-0 text-right leading-tight">{m.label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                      <div className="h-full rounded-md transition-all duration-500" style={{ width: `${barW}%`, backgroundColor: colors.bar }} />
                    </div>
                    <span className={`text-sm font-bold w-10 shrink-0 tabular-nums text-right ${colors.text}`}>{m.pct}%</span>
                    <span className="text-xs text-gray-400 w-24 shrink-0 tabular-nums hidden sm:inline">
                      {m.num.toLocaleString()} {m.sub}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Footer: health indicators + expand toggle */}
            <div className="px-5 pb-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-50 pt-3">
              <span className={`text-xs font-medium ${staleRate > 20 ? 'text-red-500' : staleRate > 10 ? 'text-amber-500' : 'text-gray-400'}`}>
                Stale: <strong>{staleRate}%</strong> <span className="font-normal">({team.stale})</span>
              </span>
              <span className={`text-xs font-medium ${deadRate > 30 ? 'text-red-500' : deadRate > 15 ? 'text-amber-500' : 'text-gray-400'}`}>
                Dead: <strong>{deadRate}%</strong> <span className="font-normal">({team.cold_wrong})</span>
              </span>
              <span className={`text-xs font-medium ${team.followups_today > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                Follow-ups today: <strong>{team.followups_today}</strong>
              </span>
              <span className="text-xs text-gray-400">{team.not_called.toLocaleString()} uncalled</span>
              <button
                onClick={() => setExpandedTeam(isExpanded ? null : team.team_leader_id)}
                className="ml-auto flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {isExpanded ? 'Hide counsellors' : 'View counsellors'}
              </button>
            </div>

            {/* Expanded counsellor breakdown */}
            {isExpanded && (
              <TeamCounsellorPanel counsellors={teamCounsellors} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Expanded counsellor panel within a team card
// ============================================================
function TeamCounsellorPanel({ counsellors }: { counsellors: CounsellorStat[] }) {
  if (counsellors.length === 0) {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-5 py-6 text-center text-sm text-gray-400">
        No counsellor data linked to this team yet.
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-500">Counsellor</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Assigned</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Called</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Not Called</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Interested</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Enrolled</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Conv%</th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Follow-ups</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {counsellors.map((c) => (
              <tr key={c.id} className="hover:bg-white transition-colors">
                <td className="px-5 py-2.5 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{c.assigned}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{c.called}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={c.notCalled > 5 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{c.notCalled}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-blue-600 font-medium tabular-nums">{c.interested}</td>
                <td className="px-4 py-2.5 text-right text-green-600 font-bold tabular-nums">{c.enrolled}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={`font-semibold ${c.conversion >= 10 ? 'text-green-600' : c.conversion >= 5 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {c.conversion}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={c.followUpsToday > 0 ? 'text-orange-500 font-medium' : 'text-gray-400'}>{c.followUpsToday}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/counsellors/${c.id}`}
                    className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Shared UI Primitives
// ============================================================
function KPICard({ label, value, icon, iconBg, iconColor, sub, subColor }: {
  label: string; value: number; icon: React.ReactNode
  iconBg: string; iconColor: string; sub?: string; subColor?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex items-start justify-between">
      <div>
        <p className="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value.toLocaleString()}</p>
        {sub && <p className={`text-xs font-medium mt-1 ${subColor || 'text-gray-400'}`}>{sub}</p>}
      </div>
      <div className={`p-2.5 sm:p-3 rounded-xl ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
    </div>
  )
}

function FlagCard({ value, label, icon, color }: {
  value: number; label: string; icon: React.ReactNode; color: 'red' | 'orange' | 'blue' | 'gray'
}) {
  const styles = {
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-400',
  }
  return (
    <div className={`border rounded-xl p-4 flex items-center gap-3 ${styles[color]}`}>
      <div className="shrink-0 opacity-80">{icon}</div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      </div>
    </div>
  )
}

function PulseCard({ label, value, icon, bg, suffix = '' }: {
  label: string; value: number; icon: React.ReactNode; bg: string; suffix?: string
}) {
  return (
    <div className={`${bg} rounded-xl p-3 sm:p-4 flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{value}{suffix}</p>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
    </div>
  )
}
