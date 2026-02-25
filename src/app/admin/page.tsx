import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminDashboardCharts } from '@/components/admin/AdminDashboardCharts'
import {
  Users,
  GraduationCap,
  PhoneCall,
  TrendingUp,
  AlertTriangle,
  Clock,
  UserCheck,
  BarChart3,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getDashboardData(collegeId: string) {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: totalLeads },
    { count: enrolled },
    { count: coldWrong },
    { data: stageData },
    { data: counsellorData },
    { data: sourceData },
    { count: todayFollowUps },
    { count: staleLeads },
    { count: callsToday },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('current_lead_stage', 'Enrolled'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).in('current_lead_stage', ['Cold Lead', 'Wrong Lead']),
    supabase.from('leads').select('current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('users').select(`
      id, name,
      assigned_leads:leads(
        id, current_lead_stage, current_call_stage
      )
    `).eq('college_id', collegeId).eq('role', 'counsellor').eq('is_active', true),
    supabase.from('leads').select('source_name, current_lead_stage').eq('college_id', collegeId).eq('is_active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).eq('follow_up_date', today),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).lte('updated_at', threeDaysAgo).not('current_lead_stage', 'in', '("Enrolled","Cold Lead","Wrong Lead")'),
    supabase.from('call_diary').select('*', { count: 'exact', head: true }).eq('college_id', collegeId).gte('created_at', today),
  ])

  // Calculate stage distribution
  const stageCounts: Record<string, number> = {}
  stageData?.forEach((lead: { current_lead_stage: string }) => {
    stageCounts[lead.current_lead_stage] = (stageCounts[lead.current_lead_stage] || 0) + 1
  })

  const inProgress = (totalLeads || 0) - (enrolled || 0) - (coldWrong || 0)

  // Counsellor performance
  const counsellorStats = counsellorData?.map((c: {
    id: string;
    name: string;
    assigned_leads: { current_lead_stage: string; current_call_stage: string | null }[];
  }) => {
    const leads = c.assigned_leads || []
    const totalAssigned = leads.length
    const called = leads.filter((l: { current_call_stage: string | null }) => l.current_call_stage !== null).length
    const interested = leads.filter((l: { current_call_stage: string | null }) => l.current_call_stage === 'Interested').length
    const enrolledCount = leads.filter((l: { current_lead_stage: string }) => l.current_lead_stage === 'Enrolled').length
    const conversion = totalAssigned > 0 ? Math.round((enrolledCount / totalAssigned) * 100) : 0

    return {
      id: c.id,
      name: c.name,
      assigned: totalAssigned,
      called,
      interested,
      enrolled: enrolledCount,
      conversion,
    }
  }) || []

  // Source performance
  const sourceStats: Record<string, { total: number; enrolled: number }> = {}
  sourceData?.forEach((lead: { source_name: string | null; current_lead_stage: string }) => {
    const source = lead.source_name || 'Unknown'
    if (!sourceStats[source]) sourceStats[source] = { total: 0, enrolled: 0 }
    sourceStats[source].total++
    if (lead.current_lead_stage === 'Enrolled') sourceStats[source].enrolled++
  })

  return {
    totalLeads: totalLeads || 0,
    enrolled: enrolled || 0,
    inProgress,
    coldWrong: coldWrong || 0,
    stageCounts,
    counsellorStats,
    sourceStats,
    todayFollowUps: todayFollowUps || 0,
    staleLeads: staleLeads || 0,
    callsToday: callsToday || 0,
  }
}

export default async function AdminDashboard() {
  const user = await requireAdmin()
  const data = await getDashboardData(user.college_id!)

  const stageOrder = [
    'New Enquiry', 'Contacted', 'Visit Scheduled', 'Visit Done',
    'Application Started', 'Enrolled', 'Cold Lead', 'Wrong Lead',
  ]

  const funnelData = stageOrder.map(stage => ({
    stage,
    count: data.stageCounts[stage] || 0,
  }))

  const sourceArray = Object.entries(data.sourceStats)
    .map(([source, stats]) => ({
      source,
      total: stats.total,
      enrolled: stats.enrolled,
      rate: stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 space-y-6">
      <TopBar title="Analytics Dashboard" userName={user.name} userRole="Admin" />

      {/* Row 1: Big Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={data.totalLeads}
          icon={<Users className="h-6 w-6 text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Enrolled"
          value={data.enrolled}
          icon={<GraduationCap className="h-6 w-6 text-green-600" />}
          color="green"
          sub={data.totalLeads > 0 ? `${Math.round((data.enrolled / data.totalLeads) * 100)}% conversion` : undefined}
        />
        <StatCard
          title="In Progress"
          value={data.inProgress}
          icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
          color="orange"
        />
        <StatCard
          title="Cold / Wrong"
          value={data.coldWrong}
          icon={<UserCheck className="h-6 w-6 text-gray-600" />}
          color="gray"
        />
      </div>

      {/* Row 2 & Row 3: Charts */}
      <AdminDashboardCharts
        funnelData={funnelData}
        counsellorStats={data.counsellorStats}
        sourceData={sourceArray}
      />

      {/* Row 5: Daily Activity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <PhoneCall className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.callsToday}</p>
              <p className="text-sm text-gray-500">Calls Logged Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.todayFollowUps}</p>
              <p className="text-sm text-gray-500">Follow-ups Due Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.staleLeads}</p>
              <p className="text-sm text-gray-500">Stale Leads (3+ days)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  color,
  sub,
}: {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  sub?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    gray: 'bg-gray-50',
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
            {sub && <p className="text-xs text-green-600 mt-1">{sub}</p>}
          </div>
          <div className={`p-3 rounded-xl ${colorMap[color] || 'bg-gray-50'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
