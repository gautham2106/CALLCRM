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

interface CounsellorStat {
  id: string
  name: string
  assigned: number
  called: number
  notCalled: number
  interested: number
  enrolled: number
  conversion: number
  followUpsToday: number
  visitsToday: number
}

interface StageEntry {
  stage: string
  count: number
}

interface SourceStat {
  source: string
  total: number
  enrolled: number
  rate: number
  stages: StageEntry[]
  thisMonth: number
  lastMonth: number
}

interface Props {
  overview: Overview
  funnelData: FunnelEntry[]
  counsellorStats: CounsellorStat[]
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

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
]

type TabId = 'overview' | 'counsellors' | 'pipeline'

// ============================================================
// Root Component
// ============================================================
export function AdminAnalyticsClient({ overview, funnelData, counsellorStats, sourceData }: Props) {
  const [tab, setTab] = useState<TabId>('overview')

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Team Overview', icon: TrendingUp },
    { id: 'counsellors', label: 'Counsellors', icon: Users },
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
        {tab === 'counsellors' && <CounsellorTab stats={counsellorStats} />}
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
// Tab 2 — Counsellor Performance
// ============================================================
type CounsellorSort = 'enrolled' | 'conversion' | 'assigned' | 'notCalled' | 'interested'

const SORT_OPTIONS: { key: CounsellorSort; label: string; desc: string }[] = [
  { key: 'enrolled', label: 'Enrolled', desc: 'Results' },
  { key: 'conversion', label: 'Conversion %', desc: 'Efficiency' },
  { key: 'assigned', label: 'Assigned', desc: 'Workload' },
  { key: 'notCalled', label: 'Not Called', desc: 'At Risk' },
  { key: 'interested', label: 'Interested', desc: 'Warm Pipeline' },
]

function CounsellorTab({ stats }: { stats: CounsellorStat[] }) {
  const [sortBy, setSortBy] = useState<CounsellorSort>('enrolled')
  const sorted = [...stats].sort((a, b) => b[sortBy] - a[sortBy])
  const maxEnrolled = Math.max(...stats.map((s) => s.enrolled), 1)

  if (stats.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No counsellors yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Sort Counsellors By</p>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex flex-col items-start px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                sortBy === opt.key
                  ? opt.key === 'notCalled'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{opt.label}</span>
              <span className={`text-[10px] font-normal mt-0.5 ${sortBy === opt.key ? 'opacity-80' : 'text-gray-400'}`}>
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((c, idx) => (
          <CounsellorCard key={c.id} stat={c} rank={idx + 1} maxEnrolled={maxEnrolled} colorIndex={stats.indexOf(c)} />
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Full Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Counsellor</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Assigned</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Called</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Not Called</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Interested</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Enrolled</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 min-w-[160px]">Conversion</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.notCalled > 0 && sortBy === 'notCalled' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.assigned}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.called}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${c.notCalled > 0 ? 'text-red-500' : 'text-gray-300'}`}>{c.notCalled}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-indigo-600 font-medium">{c.interested}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-bold">{c.enrolled}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.conversion >= 20 ? 'bg-green-500' : c.conversion >= 10 ? 'bg-orange-400' : 'bg-gray-300'}`}
                          style={{ width: `${c.conversion}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-9 text-right tabular-nums ${c.conversion >= 20 ? 'text-green-600' : c.conversion >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {c.conversion}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      {c.followUpsToday > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                          <Clock className="h-3 w-3" />{c.followUpsToday}
                        </span>
                      )}
                      {c.visitsToday > 0 && (
                        <span className="flex items-center gap-0.5 text-purple-600 font-semibold">
                          <Building2 className="h-3 w-3" />{c.visitsToday}
                        </span>
                      )}
                      {c.followUpsToday === 0 && c.visitsToday === 0 && <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CounsellorCard({ stat, rank, maxEnrolled, colorIndex }: {
  stat: CounsellorStat; rank: number; maxEnrolled: number; colorIndex: number
}) {
  const avatarBg = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
  const enrollPct = maxEnrolled > 0 ? Math.round((stat.enrolled / maxEnrolled) * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
            {stat.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{stat.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.assigned} leads assigned</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-bold tabular-nums ${stat.conversion >= 20 ? 'text-green-600' : stat.conversion >= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
            {stat.conversion}%
          </p>
          <p className="text-[10px] text-gray-400 leading-tight">conversion</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">Enrolled</span>
          <span className="font-bold text-green-600 tabular-nums">{stat.enrolled}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${enrollPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 py-3 border-t border-gray-100">
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900 tabular-nums">{stat.called}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Called</p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className={`text-sm font-bold tabular-nums ${stat.notCalled > 0 ? 'text-red-500' : 'text-gray-300'}`}>{stat.notCalled}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Not Called</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-indigo-600 tabular-nums">{stat.interested}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Interested</p>
        </div>
      </div>

      {(stat.followUpsToday > 0 || stat.visitsToday > 0) && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 flex-wrap">
          {stat.followUpsToday > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-full font-medium">
              <Clock className="h-2.5 w-2.5" />{stat.followUpsToday} follow-up{stat.followUpsToday > 1 ? 's' : ''} today
            </span>
          )}
          {stat.visitsToday > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-2 py-1 rounded-full font-medium">
              <Building2 className="h-2.5 w-2.5" />{stat.visitsToday} visit{stat.visitsToday > 1 ? 's' : ''} today
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Tab 3 — Pipeline & Sources
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

                  {/* Expanded stage breakdown */}
                  {isExpanded && s.stages.length > 0 && (
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        Where {s.source} leads are right now
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {s.stages.map((st) => (
                          <div
                            key={st.stage}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${STAGE_PILL[st.stage] || 'bg-gray-100 text-gray-500'}`}
                          >
                            <span>{st.stage}</span>
                            <span className="font-bold tabular-nums">{st.count}</span>
                            <span className="opacity-60">
                              ({s.total > 0 ? Math.round((st.count / s.total) * 100) : 0}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
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
