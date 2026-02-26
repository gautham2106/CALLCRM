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
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 25

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
  visit_date: string | null
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
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(leads.length / PAGE_SIZE)
  const pageLeads = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Course / Source</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No leads assigned yet.
                  </td>
                </tr>
              ) : (
                pageLeads.map((lead) => {
                  const isOverdue = lead.follow_up_date && lead.follow_up_date <= today &&
                    !['Enrolled', 'Cold Lead', 'Wrong Lead'].includes(lead.current_lead_stage)
                  return (
                    <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Lead */}
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <div>{lead.name}</div>
                        {lead.city && (
                          <div className="text-xs text-gray-400 mt-0.5">{lead.city}</div>
                        )}
                      </td>
                      {/* Contact */}
                      <td className="px-4 py-3">
                        <p className="font-mono text-gray-700 text-[13px]">{lead.phone}</p>
                        {lead.email && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{lead.email}</p>
                        )}
                      </td>
                      {/* Course / Source */}
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-[13px]">{lead.course_interest || <span className="text-gray-300">—</span>}</p>
                        {lead.source_name && (
                          <p className="text-xs text-gray-400 mt-0.5">{lead.source_name}</p>
                        )}
                      </td>
                      {/* Stage */}
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
                      {/* Visit Date */}
                      <td className="px-4 py-3">
                        {lead.visit_date ? (
                          <span className="text-xs font-medium text-gray-600">{formatDate(lead.visit_date)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      {/* Follow-up */}
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
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${lead.phone}`}
                            title="Call"
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={`https://wa.me/91${lead.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => setEditingLeadId(lead.id)}
                            title="Edit lead"
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500">
            <span>
              Showing <span className="font-medium text-gray-700">{pageLeads.length}</span> of{' '}
              <span className="font-medium text-gray-700">{leads.length}</span> leads
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-medium text-gray-700">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
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
