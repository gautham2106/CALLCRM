'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react'

// Static lead fields that are always mappable (source + course are batch-level dropdowns)
const STATIC_FIELDS = [
  { key: 'name',        label: 'Name',                    required: true  },
  { key: 'phone',       label: 'Phone',                   required: true  },
  { key: 'email',       label: 'Email',                   required: false },
  { key: 'city',        label: 'City',                    required: false },
  { key: 'school_name', label: 'School Name',             required: false },
  { key: 'visit_date',  label: 'Visit Date (YYYY-MM-DD)', required: false },
  { key: 'notes',       label: 'Notes',                   required: false },
]

interface CustomFieldDef {
  id: string
  field_name: string
  field_type: string
  is_required: boolean
}

interface Props {
  collegeId: string
  adminId: string
  sources: { id: string; source_name: string }[]
  courses: { id: string; course_name: string }[]
  counsellors: { id: string; name: string }[]
  customFields: CustomFieldDef[]
}

type Step = 'upload' | 'map' | 'preview' | 'done'

export function LeadImportClient({ collegeId, adminId, sources, courses, counsellors, customFields }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [importableCount, setImportableCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState({ imported: 0, skipped: 0 })
  const [assignCounsellorId, setAssignCounsellorId] = useState<string>('__none__')
  const [selectedSourceId, setSelectedSourceId] = useState<string>('__none__')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('__none__')

  // All mappable fields: static + custom
  const allFields = useMemo(() => [
    ...STATIC_FIELDS,
    ...customFields.map((f) => ({
      key: `custom_${f.id}`,
      label: f.field_name,
      required: f.is_required,
    })),
  ], [customFields])

  const applyParsedData = (headers: string[], rows: Record<string, string>[]) => {
    const trimmed = headers.map((h) => h.trim())
    setCsvHeaders(trimmed)
    setCsvRows(rows)

    const autoMap: Record<string, string> = {}
    allFields.forEach((field) => {
      const match = trimmed.find(
        (h) =>
          h.toLowerCase() === field.label.toLowerCase() ||
          h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
      )
      if (match) autoMap[field.key] = match
    })
    setColumnMap(autoMap)
    setStep('map')
  }

  const handleFileUpload = (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
          if (!raw.length) {
            toast({ title: 'Empty file', description: 'The Excel file has no data.', variant: 'destructive' })
            return
          }
          const headers = raw[0].map((h) => String(h ?? ''))
          const rows = raw
            .slice(1)
            .filter((r) => r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
            .map((r) => {
              const obj: Record<string, string> = {}
              headers.forEach((h, i) => { obj[h] = String(r[i] ?? '') })
              return obj
            })
          applyParsedData(headers, rows)
        } catch {
          toast({ title: 'Parse error', description: 'Could not read the Excel file.', variant: 'destructive' })
        }
      }
      reader.onerror = () => toast({ title: 'Read error', description: 'Could not open the file.', variant: 'destructive' })
      reader.readAsBinaryString(file)
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          applyParsedData(result.meta.fields || [], result.data as Record<string, string>[])
        },
        error: () => {
          toast({ title: 'Parse error', description: 'Could not read the CSV file.', variant: 'destructive' })
        },
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const n = file.name.toLowerCase()
      if (n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls')) handleFileUpload(file)
    }
  }

  const generatePreview = async () => {
    const nameCol = columnMap['name']
    const phoneCol = columnMap['phone']

    if (!nameCol || !phoneCol) {
      toast({ title: 'Required fields missing', description: 'You must map Name and Phone columns.', variant: 'destructive' })
      return
    }

    const seenInCsv = new Set<string>()
    const uniquePhones: string[] = []
    csvRows.forEach((r) => {
      const p = r[phoneCol]
      if (p && !seenInCsv.has(p)) { seenInCsv.add(p); uniquePhones.push(p) }
    })

    const { data: existing } = await supabase
      .from('leads')
      .select('phone')
      .eq('college_id', collegeId)
      .in('phone', uniquePhones)

    const existingPhones = new Set((existing || []).map((l: { phone: string }) => l.phone))
    setDuplicates([...existingPhones])
    setImportableCount(uniquePhones.length - existingPhones.size)

    const preview = csvRows.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {}
      allFields.forEach((field) => {
        if (columnMap[field.key]) mapped[field.label] = row[columnMap[field.key]] || ''
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

    const seenPhones = new Set<string>()
    const toImport = csvRows.filter((row) => {
      const phone = row[phoneCol]
      if (!phone || duplicates.includes(phone)) return false
      if (seenPhones.has(phone)) return false
      seenPhones.add(phone)
      return true
    })

    const counsellorId = assignCounsellorId !== '__none__' ? assignCounsellorId : null
    const sourceEntry = selectedSourceId !== '__none__' ? sources.find((s) => s.id === selectedSourceId) : null
    const courseEntry = selectedCourseId !== '__none__' ? courses.find((c) => c.id === selectedCourseId) : null

    const leadsToInsert = toImport.map((row) => ({
      college_id: collegeId,
      name: row[nameCol] || 'Unknown',
      phone: row[phoneCol],
      email:      columnMap['email']      ? row[columnMap['email']]      || null : null,
      city:        columnMap['city']        ? row[columnMap['city']]        || null : null,
      school_name: columnMap['school_name'] ? row[columnMap['school_name']] || null : null,
      visit_date:  columnMap['visit_date']  ? row[columnMap['visit_date']]  || null : null,
      notes:      columnMap['notes']      ? row[columnMap['notes']]      || null : null,
      source_id:      sourceEntry?.id          ?? null,
      source_name:    sourceEntry?.source_name ?? null,
      course_id:      courseEntry?.id          ?? null,
      course_interest: courseEntry?.course_name ?? null,
      created_by: adminId,
      ...(counsellorId ? { assigned_to: counsellorId } : {}),
    }))

    try {
      const batchSize = 100
      let imported = 0
      let failed = 0
      const insertedLeadMap: { leadId: string; row: Record<string, string> }[] = []

      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize)
        const batchRows = toImport.slice(i, i + batchSize)
        const { data: inserted, error: batchError } = await supabase
          .from('leads')
          .insert(batch)
          .select('id')
        if (batchError || !inserted) {
          failed += batch.length
        } else {
          imported += inserted.length
          inserted.forEach((lead, idx) => {
            insertedLeadMap.push({ leadId: lead.id, row: batchRows[idx] })
          })
        }
      }

      if (imported === 0 && failed > 0) {
        throw new Error(`All ${failed} leads failed to save. Please try again.`)
      }

      // Insert custom field values for all successfully imported leads
      if (customFields.length > 0 && insertedLeadMap.length > 0) {
        const customFieldValues = insertedLeadMap.flatMap(({ leadId, row }) =>
          customFields
            .filter((f) => columnMap[`custom_${f.id}`] && row[columnMap[`custom_${f.id}`]])
            .map((f) => ({
              lead_id: leadId,
              field_id: f.id,
              college_id: collegeId,
              value: row[columnMap[`custom_${f.id}`]] || null,
              updated_by: adminId,
            }))
        )
        if (customFieldValues.length > 0) {
          await supabase.from('custom_field_values').insert(customFieldValues)
        }
      }

      // Notify counsellor if directly assigned
      if (counsellorId && imported > 0) {
        await fetch('/api/admin/import-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counsellorId, count: imported }),
        })
      }

      if (failed > 0) {
        toast({ title: 'Partial import', description: `${imported} leads imported, ${failed} could not be saved.`, variant: 'destructive' })
      }

      setImportResult({ imported, skipped: csvRows.length - imported })
      setStep('done')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong during import.'
      toast({ title: 'Import failed', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Import Leads</h1>
        <p className="text-gray-500 text-sm mt-1">Upload a CSV or Excel file to bulk import leads</p>
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
              <p className="text-gray-600 font-medium">Drop your CSV or Excel file here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse (.csv, .xlsx, .xls)</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">Format Tips:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-blue-600">
                <li>Supports CSV, Excel (.xlsx) and older Excel (.xls)</li>
                <li>First row should be column headers</li>
                <li>Phone and Name are required</li>
                <li>Duplicate phones are skipped automatically</li>
                {customFields.length > 0 && (
                  <li>{customFields.length} custom field{customFields.length > 1 ? 's' : ''} available to map</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <p className="text-sm text-gray-500">{csvRows.length} rows found. Match your file columns to lead fields.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Standard fields */}
            {STATIC_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <div className="w-48 flex-shrink-0">
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
                    {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Custom fields section */}
            {customFields.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Custom Fields
                </p>
                {customFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-4 mb-3">
                    <div className="w-48 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-700">
                        {field.field_name}
                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <span className="ml-1.5 text-[10px] text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                        {field.field_type}
                      </span>
                    </div>
                    <Select
                      value={columnMap[`custom_${field.id}`] || '__none__'}
                      onValueChange={(val) =>
                        setColumnMap({ ...columnMap, [`custom_${field.id}`]: val === '__none__' ? '' : val })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not mapped —</SelectItem>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-3">
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
              <div className="flex items-center gap-6 mb-4 flex-wrap">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">{importableCount} leads to import</span>
                </div>
                {csvRows.length - importableCount > 0 && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">
                      {csvRows.length - importableCount} skipped ({duplicates.length} already in system
                      {csvRows.length - importableCount - duplicates.length > 0
                        ? `, ${csvRows.length - importableCount - duplicates.length} duplicate rows in file`
                        : ''})
                    </span>
                  </div>
                )}
              </div>

              {/* Batch-level options */}
              <div className="space-y-4 mt-4 pt-4 border-t border-gray-100">
                {sources.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Lead Source <span className="text-gray-400 font-normal">(optional — applied to all imported leads)</span>
                    </Label>
                    <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Select source..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No source —</SelectItem>
                        {sources.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {courses.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Course Interest <span className="text-gray-400 font-normal">(optional — applied to all imported leads)</span>
                    </Label>
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Select course..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No course —</SelectItem>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {counsellors.length > 0 && (
                  <div>
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
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignCounsellorId !== '__none__' && (
                      <p className="text-xs text-blue-600 mt-1.5">
                        All {importableCount} leads will be assigned to this counsellor and they will be notified.
                      </p>
                    )}
                  </div>
                )}
              </div>

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
                  Import {importableCount} Leads
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
                Assigned to <strong>{counsellors.find(c => c.id === assignCounsellorId)?.name}</strong> — they&apos;ve been notified.
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
              <Button onClick={() => router.push('/admin/leads')}>
                View All Leads
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
