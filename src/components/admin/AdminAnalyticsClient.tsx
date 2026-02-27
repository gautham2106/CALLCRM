'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Users, GraduationCap, PhoneCall, AlertCircle, Clock, Building2,
  TrendingUp, Activity, UserX, Target, ArrowUp, ArrowDown, Minus,
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

interface Props {
  overview: Overview
  funnelData: FunnelEntry[]
  sourceData: SourceStat[]
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

type TabId = 'overview' | 'pipeline'

// ============================================================
// Root Component
// ============================================================
export function AdminAnalyticsClient({ overview, funnelData, sourceData }: Props) {
  const [tab, setTab] = useState<TabId>('overview')

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Team Overview', icon: TrendingUp },
    { id: 'pipeline', label: 'Pipeline & Sources', icon: Activity },
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
        {tab === 'overview' && <OverviewTab overview={overview} funnelData={funnelData} />}
        {tab === 'pipeline' && <PipelineTab funnelData={funnelData} sourceData={sourceData} overview={overview} />}
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
