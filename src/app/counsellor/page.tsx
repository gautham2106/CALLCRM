import { createClient } from '@/lib/supabase/server'
import { requireCounsellor } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { TopBar } from '@/components/layout/TopBar'
import {
  PhoneCall,
  Users,
  TrendingUp,
  GraduationCap,
  Clock,
  AlertTriangle,
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
    { count: unreadNotifs },
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
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  const allLeads = leads || []
  const totalAssigned = allLeads.length
  const enrolled = allLeads.filter((l) => l.current_lead_stage === 'Enrolled').length
  const interested = allLeads.filter((l) => l.current_call_stage === 'Interested').length
  const todayFollowUps = allLeads.filter((l) => l.follow_up_date === today)
  const notCalled = allLeads.filter((l) => !l.current_call_stage)
  const conversion = totalAssigned > 0 ? Math.round((enrolled / totalAssigned) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <TopBar
        title="My Dashboard"
        userName={user.name}
        userRole="Counsellor"
        showNotifications
        unreadCount={unreadNotifs || 0}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAssigned}</p>
                <p className="text-xs text-gray-500">My Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <GraduationCap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{enrolled}</p>
                <p className="text-xs text-gray-500">Enrolled ({conversion}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600">{interested}</p>
                <p className="text-xs text-gray-500">Interested</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <PhoneCall className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{todayCalls || 0}</p>
                <p className="text-xs text-gray-500">Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Today's Follow-ups</h2>
            </div>
            <span className="text-sm text-orange-600 font-medium">{todayFollowUps.length} due</span>
          </div>
          <CardContent className="p-4">
            {todayFollowUps.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No follow-ups due today 🎉</p>
            ) : (
              <div className="space-y-2">
                {todayFollowUps.slice(0, 6).map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/counsellor/leads/${lead.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{lead.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{lead.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                      {lead.current_lead_stage}
                    </span>
                  </Link>
                ))}
                {todayFollowUps.length > 6 && (
                  <Link href="/counsellor/leads?filter=today" className="text-blue-600 text-sm hover:underline block text-center pt-1">
                    +{todayFollowUps.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Not Called */}
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="font-semibold text-gray-900">Not Called Yet</h2>
            </div>
            <span className="text-sm text-red-500 font-medium">{notCalled.length} pending</span>
          </div>
          <CardContent className="p-4">
            {notCalled.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">All leads have been called ✓</p>
            ) : (
              <div className="space-y-2">
                {notCalled.slice(0, 6).map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/counsellor/leads/${lead.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{lead.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{lead.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lead.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                      lead.priority === 'Warm' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {lead.priority}
                    </span>
                  </Link>
                ))}
                {notCalled.length > 6 && (
                  <Link href="/counsellor/leads?filter=not-called" className="text-blue-600 text-sm hover:underline block text-center pt-1">
                    +{notCalled.length - 6} more
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
