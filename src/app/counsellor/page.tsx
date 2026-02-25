import { createClient } from '@/lib/supabase/server'
import { requireCounsellor } from '@/lib/auth'
import {
  PhoneCall, Users, TrendingUp, GraduationCap, Clock, AlertTriangle, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import { LEAD_STAGE_COLORS, formatDate } from '@/lib/utils'

export default async function CounsellorDashboard() {
  const user = await requireCounsellor()
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: leads },
    { count: todayCalls },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, phone, current_lead_stage, current_call_stage, priority, follow_up_date')
      .eq('assigned_to', user.id)
      .eq('is_active', true)
      .order('follow_up_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('call_diary')
      .select('*', { count: 'exact', head: true })
      .eq('called_by', user.id)
      .gte('created_at', today),
  ])

  const allLeads = leads || []
  const totalAssigned = allLeads.length
  const enrolled = allLeads.filter((l) => l.current_lead_stage === 'Enrolled').length
  const interested = allLeads.filter((l) => l.current_call_stage === 'Interested').length
  const todayFollowUps = allLeads.filter((l) => l.follow_up_date === today)
  const notCalled = allLeads.filter((l) => !l.current_call_stage)
  const conversion = totalAssigned > 0 ? Math.round((enrolled / totalAssigned) * 100) : 0

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">Counsellor</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Link href="/counsellor/leads">
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
              <div>
                <p className="text-sm font-medium text-gray-500">My Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{totalAssigned}</p>
                <p className="text-xs text-gray-400 mt-1">assigned to you</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Link>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Enrolled</p>
              <p className="text-3xl font-bold text-green-600 mt-1 tabular-nums">{enrolled}</p>
              <p className="text-xs text-green-600 font-medium mt-1">{conversion}% conversion</p>
            </div>
            <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Interested</p>
              <p className="text-3xl font-bold text-indigo-600 mt-1 tabular-nums">{interested}</p>
              <p className="text-xs text-gray-400 mt-1">warm leads</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Calls Today</p>
              <p className="text-3xl font-bold text-orange-600 mt-1 tabular-nums">{todayCalls || 0}</p>
              <p className="text-xs text-gray-400 mt-1">logged today</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Alert Strip */}
        {(todayFollowUps.length > 0 || notCalled.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {todayFollowUps.length > 0 && (
              <Link href="/counsellor/leads?filter=today" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm font-medium hover:bg-orange-100 transition-colors">
                <Clock className="h-4 w-4 text-orange-500" />
                {todayFollowUps.length} follow-ups due today
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </Link>
            )}
            {notCalled.length > 0 && (
              <Link href="/counsellor/leads?filter=not-called" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm font-medium hover:bg-red-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {notCalled.length} leads not called yet
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </Link>
            )}
          </div>
        )}

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Follow-ups */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
                <h2 className="font-semibold text-gray-900">Today&apos;s Follow-ups</h2>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                todayFollowUps.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {todayFollowUps.length} due
              </span>
            </div>
            <div className="p-4">
              {todayFollowUps.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">🎉</div>
                  <p className="text-gray-400 text-sm font-medium">All caught up!</p>
                  <p className="text-gray-400 text-xs mt-1">No follow-ups due today</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {todayFollowUps.slice(0, 6).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/counsellor/leads/${lead.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div>
                        <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{lead.name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.phone}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.current_lead_stage}
                      </span>
                    </Link>
                  ))}
                  {todayFollowUps.length > 6 && (
                    <Link href="/counsellor/leads?filter=today" className="text-blue-600 text-xs font-medium hover:underline flex items-center justify-center gap-1 pt-2">
                      View {todayFollowUps.length - 6} more <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Not Called */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <h2 className="font-semibold text-gray-900">Not Called Yet</h2>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                notCalled.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {notCalled.length} pending
              </span>
            </div>
            <div className="p-4">
              {notCalled.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">✓</div>
                  <p className="text-gray-400 text-sm font-medium">All leads called!</p>
                  <p className="text-gray-400 text-xs mt-1">Great work keeping up with your pipeline</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notCalled.slice(0, 6).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/counsellor/leads/${lead.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div>
                        <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{lead.name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.phone}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        lead.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                        lead.priority === 'Warm' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {lead.priority}
                      </span>
                    </Link>
                  ))}
                  {notCalled.length > 6 && (
                    <Link href="/counsellor/leads?filter=not-called" className="text-blue-600 text-xs font-medium hover:underline flex items-center justify-center gap-1 pt-2">
                      View {notCalled.length - 6} more <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
