import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Users,
  GraduationCap,
  TrendingUp,
} from 'lucide-react'
import { LEAD_STAGE_COLORS, formatDate } from '@/lib/utils'

export default async function CounsellorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAdmin()
  const supabase = await createClient()

  const [
    { data: counsellor },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, phone, is_active, created_at')
      .eq('id', id)
      .eq('college_id', user.college_id!)
      .eq('role', 'counsellor')
      .single(),
    supabase
      .from('leads')
      .select('id, name, phone, current_lead_stage, current_call_stage, priority, follow_up_date, created_at')
      .eq('assigned_to', id)
      .eq('college_id', user.college_id!)
      .order('created_at', { ascending: false }),
  ])

  if (!counsellor) notFound()

  type CounsellorRow = { id: string; name: string; email: string; phone: string | null; is_active: boolean; created_at: string }
  type LeadRow = { id: string; name: string; phone: string; current_lead_stage: string; current_call_stage: string | null; priority: string; follow_up_date: string | null; created_at: string }

  const c = counsellor as CounsellorRow
  const allLeads = (leads || []) as LeadRow[]
  const enrolled = allLeads.filter((l) => l.current_lead_stage === 'Enrolled').length
  const interested = allLeads.filter((l) => l.current_call_stage === 'Interested').length
  const notCalled = allLeads.filter((l) => !l.current_call_stage).length
  const conversion = allLeads.length > 0 ? Math.round((enrolled / allLeads.length) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/counsellors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{c.email}</span>
              {c.phone && (
                <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{c.phone}</span>
              )}
            </div>
          </div>
          <Badge variant={c.is_active ? 'success' : 'secondary'}>
            {c.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: allLeads.length, icon: Users, color: 'blue' },
          { label: 'Enrolled', value: enrolled, icon: GraduationCap, color: 'green' },
          { label: 'Interested', value: interested, icon: TrendingUp, color: 'indigo' },
          { label: 'Conversion', value: `${conversion}%`, icon: TrendingUp, color: 'purple' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned Leads ({allLeads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Follow-up</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No leads assigned
                    </td>
                  </tr>
                ) : (
                  allLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STAGE_COLORS[lead.current_lead_stage] || 'bg-gray-100'}`}>
                          {lead.current_lead_stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(lead.follow_up_date)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/leads/${lead.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
