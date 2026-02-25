import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { AdminDashboardCharts } from '@/components/admin/AdminDashboardCharts'
import {
  Users, GraduationCap, TrendingUp, UserX,
  PhoneCall, Clock, AlertCircle, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

async function getDashboardData(collegeId: string) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalLeads }, { count: enrolled }, { count: coldWrong },
    { data: stageData }, { data: counsellorData }, { data: sourceData },
    { count: todayFollowUps }, { count: staleLeads }, { count: callsToday },
    { count: unassigned },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('current_lead_stage', 'Enrolled'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).in('current_lead_stage', ['Cold Lead', 'Wrong Lead']),
    supabase.from('leads').select('current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('users').select('id, name, assigned_leads:leads(id, current_lead_stage, current_call_stage)').eq('college_id', collegeId).eq('role', 'counsellor').eq('is_active', true),
    supabase.from('leads').select('source_name, current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('follow_up_date', today),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).lte('updated_at', threeDaysAgo).not('current_lead_stage', 'in', '("Enrolled","Cold Lead","Wrong Lead")'),
    supabase.from('call_diary').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).gte('created_at', today),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).is('assigned_to', null).eq('is_active', true),
  ])

  const stageCounts: Record<string, number> = {}
  ;(stageData || []).forEach((l: any) => {
    stageCounts[l.current_lead_stage] = (stageCounts[l.current_lead_stage] || 0) + 1
  })

  const counsellorStats = (counsellorData || []).map((c: any) => {
    const leads = c.assigned_leads || []
    const enrolledCount = leads.filter((l: any) => l.current_lead_stage === 'Enrolled').length
    return {
      id: c.id, name: c.name,
      assigned: leads.length,
      called: leads.filter((l: any) => l.current_call_stage !== null).length,
      interested: leads.filter((l: any) => l.current_call_stage === 'Interested').length,
      enrolled: enrolledCount,
      conversion: leads.length > 0 ? Math.round((enrolledCount / leads.length) * 100) : 0,
    }
  })

  const sourceStats: Record<string, { total: number; enrolled: number }> = {}
  ;(sourceData || []).forEach((l: any) => {
    const s = l.source_name || 'Unknown'
    if (!sourceStats[s]) sourceStats[s] = { total: 0, enrolled: 0 }
    sourceStats[s].total++
    if (l.current_lead_stage === 'Enrolled') sourceStats[s].enrolled++
  })

  return {
    totalLeads: totalLeads || 0,
    enrolled: enrolled || 0,
    inProgress: (totalLeads || 0) - (enrolled || 0) - (coldWrong || 0),
    coldWrong: coldWrong || 0,
    unassigned: unassigned || 0,
    stageCounts, counsellorStats, sourceStats,
    todayFollowUps: todayFollowUps || 0,
    staleLeads: staleLeads || 0,
    callsToday: callsToday || 0,
  }
}

export default async function AdminDashboard() {
  const user = await requireAdmin()
  const data = await getDashboardData(user.college_id!)

  const stageOrder = ['New Enquiry','Contacted','Visit Scheduled','Visit Done','Application Started','Enrolled','Cold Lead','Wrong Lead']
  const funnelData = stageOrder.map(stage => ({ stage, count: data.stageCounts[stage] || 0 }))
  const sourceArray = Object.entries(data.sourceStats)
    .map(([source, s]) => ({ source, total: s.total, enrolled: s.enrolled, rate: s.total > 0 ? Math.round((s.enrolled / s.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
  const conversionRate = data.totalLeads > 0 ? Math.round((data.enrolled / data.totalLeads) * 100) : 0

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard label="Total Leads" value={data.totalLeads} icon={<Users className="h-5 w-5" />} iconBg="bg-blue-50" iconColor="text-blue-600" href="/admin/leads" />
          <KPICard label="Enrolled" value={data.enrolled} icon={<GraduationCap className="h-5 w-5" />} iconBg="bg-green-50" iconColor="text-green-600" sub={`${conversionRate}% conversion`} subColor="text-green-600" />
          <KPICard label="In Progress" value={data.inProgress} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <KPICard label="Cold / Wrong" value={data.coldWrong} icon={<UserX className="h-5 w-5" />} iconBg="bg-gray-100" iconColor="text-gray-500" />
        </div>

        {/* Alert Strip */}
        {(data.staleLeads > 0 || data.todayFollowUps > 0 || data.unassigned > 0) && (
          <div className="flex flex-wrap gap-3">
            {data.staleLeads > 0 && <AlertChip icon={<AlertCircle className="h-4 w-4 text-red-500" />} label={`${data.staleLeads} leads not contacted in 3+ days`} href="/admin/leads" color="red" />}
            {data.todayFollowUps > 0 && <AlertChip icon={<Clock className="h-4 w-4 text-amber-500" />} label={`${data.todayFollowUps} follow-ups due today`} href="/admin/leads" color="amber" />}
            {data.unassigned > 0 && <AlertChip icon={<Users className="h-4 w-4 text-blue-500" />} label={`${data.unassigned} unassigned leads`} href="/admin/assignment" color="blue" />}
          </div>
        )}

        {/* Charts */}
        <AdminDashboardCharts funnelData={funnelData} counsellorStats={data.counsellorStats} sourceData={sourceArray} />

        {/* Daily Activity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActivityCard icon={<PhoneCall className="h-5 w-5 text-blue-600" />} iconBg="bg-blue-50" label="Calls Logged Today" value={data.callsToday} />
          <ActivityCard icon={<Clock className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50" label="Follow-ups Due Today" value={data.todayFollowUps} />
          <ActivityCard icon={<AlertCircle className="h-5 w-5 text-red-500" />} iconBg="bg-red-50" label="Stale Leads (3+ days)" value={data.staleLeads} />
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, iconBg, iconColor, sub, subColor, href }: {
  label: string; value: number; icon: React.ReactNode; iconBg: string; iconColor: string;
  sub?: string; subColor?: string; href?: string;
}) {
  const inner = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between group hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value.toLocaleString()}</p>
        {sub && <p className={`text-xs font-medium mt-1 ${subColor || 'text-gray-400'}`}>{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${iconBg} ${iconColor} group-hover:scale-110 transition-transform`}>{icon}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function AlertChip({ icon, label, href, color }: { icon: React.ReactNode; label: string; href: string; color: 'red' | 'amber' | 'blue' }) {
  const colors = { red: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100', amber: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100', blue: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' }
  return (
    <Link href={href} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${colors[color]}`}>
      {icon}{label}<ArrowUpRight className="h-3 w-3 opacity-60" />
    </Link>
  )
}

function ActivityCard({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${iconBg} shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
