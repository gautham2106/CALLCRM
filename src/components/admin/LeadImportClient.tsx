'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react'

const LEAD_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'course_interest', label: 'Course Interest', required: false },
  { key: 'source_name', label: 'Source', required: false },
  { key: 'visit_date', label: 'Visit Date (YYYY-MM-DD)', required: false },
  { key: 'notes', label: 'Notes', required: false },
]

interface Props {
  collegeId: string
  adminId: string
  sources: { id: string; source_name: string }[]
  counsellors: { id: string; full_name: string }[]
}

type Step = 'upload' | 'map' | 'preview' | 'done'

export function LeadImportClient({ collegeId, adminId, sources, counsellors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState({ imported: 0, skipped: 0 })
  const [assignCounsellorId, setAssignCounsellorId] = useState<string>('__none__')

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || []
        const rows = result.data as Record<string, string>[]
        setCsvHeaders(headers)
        setCsvRows(rows)

        // Auto-map columns
        const autoMap: Record<string, string> = {}
        LEAD_FIELDS.forEach((field) => {
          const match = headers.find(
            (h) =>
              h.toLowerCase().includes(field.key.toLowerCase()) ||
              h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
          )
          if (match) autoMap[field.key] = match
        })
        setColumnMap(autoMap)
        setStep('map')
      },
      error: () => {
        toast({ title: 'Parse error', description: 'Could not read the CSV file.', variant: 'destructive' })
      },
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFileUpload(file)
  }

  const generatePreview = async () => {
    const nameCol = columnMap['name']
    const phoneCol = columnMap['phone']

    if (!nameCol || !phoneCol) {
      toast({ title: 'Required fields missing', description: 'You must map Name and Phone columns.', variant: 'destructive' })
      return
    }

    // Check for duplicates
    const phones = csvRows.map((r) => r[phoneCol]).filter(Boolean)
    const { data: existing } = await supabase
      .from('leads')
      .select('phone')
      .eq('college_id', collegeId)
      .in('phone', phones)

    const existingPhones = new Set((existing || []).map((l: { phone: string }) => l.phone))
    setDuplicates([...existingPhones])

    const preview = csvRows.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {}
      LEAD_FIELDS.forEach((field) => {
        if (columnMap[field.key]) {
          mapped[field.label] = row[columnMap[field.key]] || ''
        }
      })
      return mapped
    })

    setPreviewData(preview)
    setStep('preview')
  }

  const handleImport = async () => {
    setImporting(true)
    const nameCol = columnMap['name']
    const phoneCol = columnMap['phone']

    const toImport = csvRows.filter((row) => {
      const phone = row[phoneCol]
      return !duplicates.includes(phone)
    })

    const counsellorId = assignCounsellorId !== '__none__' ? assignCounsellorId : null

    const leadsToInsert = toImport.map((row) => ({
      college_id: collegeId,
      name: row[columnMap['name']] || 'Unknown',
      phone: row[columnMap['phone']],
      email: columnMap['email'] ? row[columnMap['email']] || null : null,
      city: columnMap['city'] ? row[columnMap['city']] || null : null,
      course_interest: columnMap['course_interest'] ? row[columnMap['course_interest']] || null : null,
      source_name: columnMap['source_name'] ? row[columnMap['source_name']] || null : null,
      visit_date: columnMap['visit_date'] ? row[columnMap['visit_date']] || null : null,
      notes: columnMap['notes'] ? row[columnMap['notes']] || null : null,
      created_by: adminId,
      ...(counsellorId ? { assigned_to: counsellorId } : {}),
    }))

    try {
      const batchSize = 100
      let imported = 0
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize)
        await supabase.from('leads').insert(batch)
        imported += batch.length
      }

      // Notify counsellor if directly assigned
      if (counsellorId && imported > 0) {
        await fetch('/api/admin/import-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counsellorId, count: imported }),
        })
      }

      setImportResult({ imported, skipped: duplicates.length })
      setStep('done')
    } catch {
      toast({ title: 'Import failed', description: 'Something went wrong during import.', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Leads from CSV</h1>
        <p className="text-gray-500 text-sm mt-1">Upload a CSV file to bulk import leads</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? 'bg-blue-600 text-white' :
              ['upload', 'map', 'preview', 'done'].indexOf(s) < ['upload', 'map', 'preview', 'done'].indexOf(step)
                ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx + 1}
            </div>
            <span className={`capitalize ${step === s ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {s === 'done' ? 'Complete' : s}
            </span>
            {idx < 3 && <ArrowRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Drop your CSV file here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">CSV Format Tips:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-blue-600">
                <li>First row should be headers</li>
                <li>Phone and Name are required</li>
                <li>Duplicate phones will be skipped automatically</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns</CardTitle>
            <p className="text-sm text-gray-500">{csvRows.length} rows found. Map your CSV columns to lead fields.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {LEAD_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <div className="w-44 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
                <Select
                  value={columnMap[field.key] || '__none__'}
                  onValueChange={(val) => setColumnMap({ ...columnMap, [field.key]: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not mapped —</SelectItem>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={generatePreview}>
                Preview Import
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">{csvRows.length - duplicates.length} leads to import</span>
                </div>
                {duplicates.length > 0 && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">{duplicates.length} duplicates will be skipped</span>
                  </div>
                )}
              </div>

              {/* Optional: assign directly to a counsellor */}
              {counsellors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Assign to counsellor <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Select value={assignCounsellorId} onValueChange={setAssignCounsellorId}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Leave unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Leave unassigned —</SelectItem>
                      {counsellors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignCounsellorId !== '__none__' && (
                    <p className="text-xs text-blue-600 mt-1.5">
                      All {csvRows.length - duplicates.length} leads will be assigned to this counsellor and they will be notified.
                    </p>
                  )}
                </div>
              )}

              {previewData.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {Object.keys(previewData[0]).map((h) => (
                          <th key={h} className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, i) => (
                            <td key={i} className="border border-gray-200 px-3 py-2 text-gray-700">{val || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 5 && (
                    <p className="text-xs text-gray-400 mt-2">Showing first 5 rows of {csvRows.length}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import {csvRows.length - duplicates.length} Leads
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
            {assignCounsellorId !== '__none__' && (
              <p className="text-sm text-blue-600 mb-2">
                Assigned to <strong>{counsellors.find(c => c.id === assignCounsellorId)?.full_name}</strong> — they've been notified.
              </p>
            )}
            <div className="flex items-center justify-center gap-8 my-6">
              <div>
                <p className="text-4xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-gray-500">Leads Imported</p>
              </div>
              {importResult.skipped > 0 && (
                <div>
                  <p className="text-4xl font-bold text-orange-500">{importResult.skipped}</p>
                  <p className="text-sm text-gray-500">Duplicates Skipped</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/admin/leads')}>
                View All Leads
              </Button>
              <Button onClick={() => router.push('/admin/assignment')}>
                Assign Leads
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
