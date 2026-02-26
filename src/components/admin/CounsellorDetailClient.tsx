'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LeadSlidePanel } from '@/components/shared/LeadSlidePanel'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Mail, Phone, Users, GraduationCap, TrendingUp, MessageCircle, Pencil,
} from 'lucide-react'

interface CounsellorInfo {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
}

interface CounsellorLead {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  course_interest: string | null
  source_name: string | null
  current_lead_stage: string
  current_call_stage: string | null
  follow_up_date: string | null
  created_at: string
}

interface Props {
  counsellor: CounsellorInfo
  initialLeads: CounsellorLead[]
  collegeId: string
  adminId: string
}

const STAGE_PILL: Record<string, string> = {
  'New Enquiry': 'bg-blue-50 text-blue-700',
  'Contacted': 'bg-amber-50 text-amber-700',
  'Visit Scheduled': 'bg-purple-50 text-purple-700',
  'Visit Done': 'bg-indigo-50 text-indigo-700',
  'Application Started': 'bg-orange-50 text-orange-700',
  'Enrolled': 'bg-green-50 text-green-700',
  'Cold Lead': 'bg-gray-100 text-gray-500',
  'Wrong Lead': 'bg-red-50 text-red-500',
}

const CALL_PILL: Record<string, string> = {
  'Interested': 'text-green-600',
  'Not Interested': 'text-red-500',
  'Call Back': 'text-orange-500',
  'No Answer': 'text-gray-400',
  'Busy': 'text-yellow-600',
  'Wrong Number': 'text-red-400',
  'Switched Off': 'text-gray-400',
}

const today = new Date().toISOString().split('T')[0]

export function CounsellorDetailClient({ counsellor, initialLeads, collegeId, adminId }: Props) {
  const [leads, setLeads] = useState<CounsellorLead[]>(initialLeads)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)

  const handleLeadUpdated = (id: string, updated: Partial<CounsellorLead>) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updated } : l))
  }

  const enrolled = leads.filter((l) => l.current_lead_stage === 'Enrolled').length
  const interested = leads.filter((l) => l.current_call_stage === 'Interested').length
  const notCalled = leads.filter((l) => !l.current_call_stage).length
  const conversion = leads.length > 0 ? Math.round((enrolled / leads.length) * 100) : 0

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
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl shrink-0">
            {counsellor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{counsellor.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{counsellor.email}</span>
              {counsellor.phone && (
                <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{counsellor.phone}</span>
              )}
            </div>
          </div>
          <Badge variant={counsellor.is_active ? 'success' : 'secondary'}>
            {counsellor.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length, icon: Users },
          { label: 'Enrolled', value: enrolled, icon: GraduationCap },
          { label: 'Not Called', value: notCalled, icon: Phone },
          { label: 'Conversion', value: `${conversion}%`, icon: TrendingUp },
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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Assigned Leads ({leads.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No leads assigned yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isOverdue = lead.follow_up_date && lead.follow_up_date < today &&
                    !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                  return (
                    <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div>{lead.name}</div>
                        {(lead.city || lead.course_interest) && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {[lead.city, lead.course_interest].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STAGE_PILL[lead.current_lead_stage] || 'bg-gray-100 text-gray-600'}`}>
                          {lead.current_lead_stage}
                        </span>
                        {lead.current_call_stage && (
                          <div className={`text-[10px] mt-0.5 font-medium ${CALL_PILL[lead.current_call_stage] || 'text-gray-400'}`}>
                            {lead.current_call_stage}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.follow_up_date ? (
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-600'}`}>
                            {isOverdue && <span className="mr-0.5">⚠</span>}
                            {formatDate(lead.follow_up_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <a
                            href={`tel:${lead.phone}`}
                            title="Call"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => setEditingLeadId(lead.id)}
                            title="Edit lead"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full-featured Lead Slide Panel */}
      <LeadSlidePanel
        leadId={editingLeadId}
        collegeId={collegeId}
        currentUserId={adminId}
        onClose={() => setEditingLeadId(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </div>
  )
}
