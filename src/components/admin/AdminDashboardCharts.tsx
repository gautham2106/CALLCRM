'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { LEAD_STAGE_COLORS } from '@/lib/utils'

interface FunnelEntry {
  stage: string
  count: number
}

interface CounsellorStat {
  id: string
  name: string
  assigned: number
  called: number
  interested: number
  enrolled: number
  conversion: number
}

interface SourceStat {
  source: string
  total: number
  enrolled: number
  rate: number
}

interface Props {
  funnelData: FunnelEntry[]
  counsellorStats: CounsellorStat[]
  sourceData: SourceStat[]
}

const STAGE_CHART_COLORS: Record<string, string> = {
  'New Enquiry': '#3b82f6',
  'Contacted': '#f59e0b',
  'Visit Scheduled': '#8b5cf6',
  'Visit Done': '#6366f1',
  'Application Started': '#f97316',
  'Enrolled': '#22c55e',
  'Cold Lead': '#6b7280',
  'Wrong Lead': '#ef4444',
}

export function AdminDashboardCharts({ funnelData, counsellorStats, sourceData }: Props) {
  const bestSource = sourceData.reduce(
    (best, curr) => (curr.rate > (best?.rate || 0) ? curr : best),
    sourceData[0]
  )

  return (
    <div className="space-y-6">
      {/* Row 2: Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Stage Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_CHART_COLORS[entry.stage] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 3: Counsellor Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Counsellor Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {counsellorStats.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No counsellors yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Counsellor</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Assigned</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Called</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Interested</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Enrolled</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Conversion %</th>
                  </tr>
                </thead>
                <tbody>
                  {counsellorStats.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{c.name}</td>
                      <td className="py-3 px-4 text-center text-gray-700">{c.assigned}</td>
                      <td className="py-3 px-4 text-center text-gray-700">{c.called}</td>
                      <td className="py-3 px-4 text-center text-blue-600">{c.interested}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-medium">{c.enrolled}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-semibold ${c.conversion >= 20 ? 'text-green-600' : c.conversion >= 10 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {c.conversion}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Source Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Source Performance</CardTitle>
            {bestSource && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                Best: {bestSource.source} ({bestSource.rate}%)
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sourceData.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No source data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Source</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Total Leads</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Enrolled</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Conversion %</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((s) => (
                    <tr
                      key={s.source}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${s.source === bestSource?.source ? 'bg-green-50' : ''}`}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {s.source}
                        {s.source === bestSource?.source && (
                          <span className="ml-2 text-xs text-green-600">★ Best</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">{s.total}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-medium">{s.enrolled}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-semibold ${s.rate >= 20 ? 'text-green-600' : s.rate >= 10 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {s.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
