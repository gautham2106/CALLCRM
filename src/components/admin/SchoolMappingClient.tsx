'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import {
  School, UserCheck, Trash2, Plus, Info,
  Upload, FileText, CheckCircle, AlertCircle, Download, Loader2, ArrowRight,
} from 'lucide-react'

interface Mapping {
  school_name: string
  counsellor_id: string | null
}

interface Counsellor {
  id: string
  name: string
  email: string
}

interface Props {
  initialMappings: Mapping[]
  counsellors: Counsellor[]
  knownSchools: string[]
  schoolCounts: Record<string, number>
}

interface SchoolCsvRow {
  school_name: string
  counsellor_email: string
  counsellor_id: string | null
  counsellor_name: string | null
  error: string | null
}

export function SchoolMappingClient({ initialMappings, counsellors, knownSchools, schoolCounts }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings)
  const [newSchool, setNewSchool] = useState('')
  const [newCounsellorId, setNewCounsellorId] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingSchool, setDeletingSchool] = useState<string | null>(null)

  // CSV import state
  const [activeTab, setActiveTab] = useState<'rules' | 'csv'>('rules')
  const csvFileRef = useRef<HTMLInputElement>(null)
  const [csvStep, setCsvStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [csvRows, setCsvRows] = useState<SchoolCsvRow[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState({ saved: 0, skipped: 0 })

  const mappedSchools = new Set(mappings.map((m) => m.school_name))
  const suggestions = knownSchools.filter((s) => !mappedSchools.has(s))
  const counsellorName = (id: string | null) =>
    counsellors.find((c) => c.id === id)?.name || 'Unassigned'

  // ── Single rule handlers ──────────────────────────────────────────────────

  const handleAdd = async () => {
    const school = newSchool.trim()
    if (!school) { toast({ title: 'School name required', variant: 'destructive' }); return }
    if (!newCounsellorId) { toast({ title: 'Select a counsellor', variant: 'destructive' }); return }
    setAdding(true)
    try {
      const counsellorId = newCounsellorId === '__none__' ? null : newCounsellorId
      const res = await fetch('/api/admin/school-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: [{ school_name: school, counsellor_id: counsellorId }] }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setMappings((prev) =>
        [...prev.filter((m) => m.school_name !== school), { school_name: school, counsellor_id: counsellorId }]
          .sort((a, b) => a.school_name.localeCompare(b.school_name))
      )
      setNewSchool('')
      setNewCounsellorId('')
      toast({ title: 'Mapping saved', description: `${school} → ${counsellorName(counsellorId)}`, variant: 'success' })
    } catch (err: unknown) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : 'Something went wrong.', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleChangeCounsellor = async (mapping: Mapping, newId: string) => {
    const counsellorId = newId === '__none__' ? null : newId
    const res = await fetch('/api/admin/school-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings: [{ school_name: mapping.school_name, counsellor_id: counsellorId }] }),
    })
    if (res.ok) {
      setMappings((prev) => prev.map((m) => m.school_name === mapping.school_name ? { ...m, counsellor_id: counsellorId } : m))
      toast({ title: 'Updated', description: `${mapping.school_name} → ${counsellorName(counsellorId)}`, variant: 'success' })
    } else {
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  const handleDelete = async (mapping: Mapping) => {
    setDeletingSchool(mapping.school_name)
    try {
      const res = await fetch(`/api/admin/school-mapping?school=${encodeURIComponent(mapping.school_name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setMappings((prev) => prev.filter((m) => m.school_name !== mapping.school_name))
      toast({ title: 'Mapping removed', description: mapping.school_name })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingSchool(null)
    }
  }

  // ── CSV import handlers ───────────────────────────────────────────────────

  const resetCsv = () => {
    setCsvStep('upload')
    setCsvRows([])
    if (csvFileRef.current) csvFileRef.current.value = ''
  }

  const handleCsvFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const raw = result.data as Record<string, string>[]
        if (!raw.length) {
          toast({ title: 'Empty file', description: 'No rows found.', variant: 'destructive' })
          return
        }
        const origHeaders = result.meta.fields || []
        const lower = origHeaders.map((h) => h.trim().toLowerCase())
        const schoolCol = origHeaders[lower.findIndex((h) => h === 'school_name' || h.includes('school'))] || ''
        const emailCol  = origHeaders[lower.findIndex((h) => h === 'counsellor_email' || h.includes('email'))] || ''

        if (!schoolCol || !emailCol) {
          toast({ title: 'Wrong columns', description: 'CSV must have school_name and counsellor_email columns.', variant: 'destructive' })
          return
        }

        const parsed: SchoolCsvRow[] = raw.map((row) => {
          const school_name      = (row[schoolCol]  || '').trim()
          const counsellor_email = (row[emailCol]   || '').trim().toLowerCase()
          if (!school_name)      return { school_name, counsellor_email, counsellor_id: null, counsellor_name: null, error: 'School name required' }
          if (!counsellor_email) return { school_name, counsellor_email, counsellor_id: null, counsellor_name: null, error: 'Counsellor email required' }
          const match = counsellors.find((c) => c.email.toLowerCase() === counsellor_email)
          if (!match)            return { school_name, counsellor_email, counsellor_id: null, counsellor_name: null, error: `No counsellor with email "${counsellor_email}"` }
          return { school_name, counsellor_email, counsellor_id: match.id, counsellor_name: match.name, error: null }
        })

        setCsvRows(parsed)
        setCsvStep('preview')
      },
      error: () => toast({ title: 'Parse error', description: 'Could not read the CSV.', variant: 'destructive' }),
    })
  }

  const handleCsvImport = async () => {
    const valid = csvRows.filter((r) => !r.error)
    if (!valid.length) return
    setCsvImporting(true)
    try {
      const res = await fetch('/api/admin/school-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: valid.map((r) => ({ school_name: r.school_name, counsellor_id: r.counsellor_id })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      // Update local state
      setMappings((prev) => {
        const updated = prev.map((m) => {
          const match = valid.find((r) => r.school_name === m.school_name)
          return match ? { ...m, counsellor_id: match.counsellor_id } : m
        })
        for (const r of valid.filter((r) => !prev.some((m) => m.school_name === r.school_name))) {
          updated.push({ school_name: r.school_name, counsellor_id: r.counsellor_id })
        }
        return updated.sort((a, b) => a.school_name.localeCompare(b.school_name))
      })

      setCsvResult({ saved: valid.length, skipped: csvRows.length - valid.length })
      setCsvStep('done')
    } catch (err: unknown) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Something went wrong.', variant: 'destructive' })
    } finally {
      setCsvImporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <School className="h-6 w-6 text-blue-600" />
          School → Counsellor Mapping
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Set these rules once. When you import leads with a{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">school_name</code> column,
          leads are auto-assigned — no manual step every time.
        </p>
      </div>

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">How it works during lead CSV import</p>
          <ul className="space-y-0.5 text-xs text-blue-700">
            <li>• Add a <strong>school_name</strong> column to your leads CSV</li>
            <li>• Schools that match a rule here are <strong>auto-assigned instantly</strong></li>
            <li>• Schools with no rule still ask you to assign manually (just for that batch)</li>
          </ul>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rules' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Saved Rules ({mappings.length})
        </button>
        <button
          onClick={() => { setActiveTab('csv'); resetCsv() }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'csv' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Upload className="h-3.5 w-3.5" />
          Import Schools CSV
        </button>
      </div>

      {/* ── Tab: Saved Rules ── */}
      {activeTab === 'rules' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{mappings.length} saved rule{mappings.length !== 1 ? 's' : ''}</p>
              {mappings.length > 0 && <p className="text-xs text-gray-400">Change counsellor inline or delete the rule</p>}
            </div>

            {mappings.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <School className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No mappings yet. Add a rule below or import a CSV.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {mappings.map((m) => (
                  <div key={m.school_name} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{m.school_name}</p>
                      {schoolCounts[m.school_name] != null && (
                        <p className="text-xs text-gray-400">{schoolCounts[m.school_name]} leads in system</p>
                      )}
                    </div>
                    <UserCheck className="h-4 w-4 text-gray-300 shrink-0" />
                    <Select value={m.counsellor_id || '__none__'} onValueChange={(v) => handleChangeCounsellor(m, v)}>
                      <SelectTrigger className="h-8 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Unassigned —</SelectItem>
                        {counsellors.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                      onClick={() => handleDelete(m)}
                      disabled={deletingSchool === m.school_name}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add single rule */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" /> Add a rule
            </p>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Schools from your leads without a rule yet:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 12).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewSchool(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        newSchool === s
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {s}{schoolCounts[s] != null && <span className="ml-1 opacity-60">({schoolCounts[s]})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-xs text-gray-500 font-medium">School Name</label>
                <Input
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  placeholder="e.g. Delhi Public School"
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="w-48 space-y-1 shrink-0">
                <label className="text-xs text-gray-500 font-medium">Assign To</label>
                <Select value={newCounsellorId} onValueChange={setNewCounsellorId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select counsellor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unassigned —</SelectItem>
                    {counsellors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={adding} className="h-9 shrink-0">
                <Plus className="h-4 w-4 mr-1" />Add Rule
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Import Schools CSV ── */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {(['upload', 'preview', 'done'] as const).map((s, idx, arr) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  csvStep === s ? 'bg-blue-600 text-white' :
                  arr.indexOf(s) < arr.indexOf(csvStep) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{idx + 1}</div>
                <span className={csvStep === s ? 'text-blue-600 font-medium capitalize' : 'text-gray-400 capitalize'}>{s}</span>
                {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300" />}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {csvStep === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f?.name.toLowerCase().endsWith('.csv')) handleCsvFile(f)
                  else toast({ title: 'CSV only', variant: 'destructive' })
                }}
                onClick={() => csvFileRef.current?.click()}
              >
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium text-sm">Drop CSV or click to browse</p>
                <p className="text-gray-400 text-xs mt-1">.csv only</p>
              </div>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
              />

              {/* Format guide */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">CSV Format</p>
                  <button
                    onClick={() => {
                      const emails = counsellors.slice(0, 2).map((c) => c.email)
                      const csv = [
                        'school_name,counsellor_email',
                        `Delhi Public School,${emails[0] || 'priya@college.edu'}`,
                        `Loreto Convent,${emails[0] || 'priya@college.edu'}`,
                        `Cathedral & John Connon,${emails[1] || 'rahul@college.edu'}`,
                      ].join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = 'school_mapping_template.csv'; a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Download className="h-3 w-3" /> Download template
                  </button>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700">school_name *</th>
                      <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700">counsellor_email *</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">Delhi Public School</td>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">priya@college.edu</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">Loreto Convent</td>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">priya@college.edu</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">Cathedral & John Connon</td>
                      <td className="border border-gray-200 px-2 py-1 text-gray-500">rahul@college.edu</td>
                    </tr>
                  </tbody>
                </table>

                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li>• One row per school — multiple schools can point to the same counsellor email</li>
                  <li>• Email must match an active counsellor in this college</li>
                  <li>• Existing rules for the same school are overwritten</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {csvStep === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 font-semibold">{csvRows.filter((r) => !r.error).length} valid</span>
                {csvRows.filter((r) => r.error).length > 0 && (
                  <span className="text-red-500 font-semibold">{csvRows.filter((r) => r.error).length} with errors (will be skipped)</span>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 w-6">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">School Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Counsellor Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Resolved As</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className={row.error ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.school_name || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.counsellor_email || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{row.counsellor_name || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-3 py-2">
                            {row.error
                              ? <span className="flex items-center gap-1 text-red-600"><AlertCircle className="h-3 w-3 shrink-0" />{row.error}</span>
                              : <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />Ready</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCsvStep('upload')}>Back</Button>
                <Button
                  size="sm"
                  onClick={handleCsvImport}
                  disabled={csvImporting || csvRows.filter((r) => !r.error).length === 0}
                >
                  {csvImporting
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving...</>
                    : <>Save {csvRows.filter((r) => !r.error).length} rules</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {csvStep === 'done' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-bold text-gray-900">Import Complete</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="text-green-600 font-semibold">{csvResult.saved} rules saved</span>
                  {csvResult.skipped > 0 && <> · <span className="text-orange-500">{csvResult.skipped} rows skipped</span></>}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={resetCsv}>Import another</Button>
                <Button size="sm" onClick={() => setActiveTab('rules')}>View saved rules</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
