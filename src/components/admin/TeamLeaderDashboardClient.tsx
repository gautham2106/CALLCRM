'use client'

import Link from 'next/link'
import { Users, Phone, UserCheck, TrendingUp, Calendar, AlertCircle } from 'lucide-react'

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
}

interface Props {
  teamLeaderName: string
  counsellorStats: CounsellorStat[]
  todayDate: string
}

export function TeamLeaderDashboardClient({ teamLeaderName, counsellorStats, todayDate }: Props) {
  const totalAssigned    = counsellorStats.reduce((s, c) => s + c.assigned,    0)
  const totalCalled      = counsellorStats.reduce((s, c) => s + c.called,      0)
  const totalEnrolled    = counsellorStats.reduce((s, c) => s + c.enrolled,    0)
  const totalFollowUps   = counsellorStats.reduce((s, c) => s + c.followUpsToday, 0)
  const teamConversion   = totalAssigned > 0 ? Math.round((totalEnrolled / totalAssigned) * 100) : 0

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Team</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(todayDate).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{teamLeaderName}</p>
            <p className="text-xs text-gray-500">Team Leader</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Counsellors</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{counsellorStats.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-gray-500">Total Leads</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalAssigned.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-gray-500">Enrolled</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalEnrolled.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{teamConversion}% conversion</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-gray-500">Follow-ups Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalFollowUps}</p>
          </div>
        </div>

        {/* Counsellor table */}
        {counsellorStats.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No counsellors assigned to you yet</p>
            <p className="text-gray-400 text-sm mt-1">Ask your admin to assign counsellors to your team.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Counsellor Performance</h2>
              <Link
                href="/admin/leads"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View all leads →
              </Link>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Counsellor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Called</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Not Called</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Interested</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enrolled</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conv %</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-ups</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {counsellorStats.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-blue-700">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-700">{c.assigned}</td>
                      <td className="px-4 py-3.5 text-right text-gray-700">{c.called}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={c.notCalled > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {c.notCalled}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-blue-600 font-medium">{c.interested}</td>
                      <td className="px-4 py-3.5 text-right text-green-600 font-bold">{c.enrolled}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-medium ${c.conversion >= 10 ? 'text-green-600' : c.conversion >= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {c.conversion}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={c.followUpsToday > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                          {c.followUpsToday}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/counsellors/${c.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {counsellorStats.map((c) => (
                <div key={c.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                    <Link href={`/admin/counsellors/${c.id}`} className="text-xs text-blue-600 font-medium">View →</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Assigned', value: c.assigned, color: 'text-gray-700' },
                      { label: 'Called',   value: c.called,   color: 'text-gray-700' },
                      { label: 'Not Called', value: c.notCalled, color: c.notCalled > 0 ? 'text-red-600' : 'text-gray-400' },
                      { label: 'Interested', value: c.interested, color: 'text-blue-600' },
                      { label: 'Enrolled',   value: c.enrolled,   color: 'text-green-600' },
                      { label: 'Conv %',     value: `${c.conversion}%`, color: c.conversion >= 10 ? 'text-green-600' : 'text-gray-500' },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                        <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {c.followUpsToday > 0 && (
                    <p className="mt-2 text-xs text-orange-600 font-medium">
                      {c.followUpsToday} follow-up{c.followUpsToday > 1 ? 's' : ''} due today
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
