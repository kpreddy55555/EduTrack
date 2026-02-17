// 📊 COMPREHENSIVE REPORTS DASHBOARD v4
// Features: Institution logo/details, role-based filters, 9 report types, print-ready
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReportType = 'faculty-workload' | 'faculty-details' | 'division-status' | 'subject-completion' | 'topic-status' | 'lagging-topics' | 'division-comparison' | 'faculty-pace' | 'monthly-progress'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [institution, setInstitution] = useState<any>(null)
  const [selectedReport, setSelectedReport] = useState<ReportType>('faculty-workload')
  const [reportData, setReportData] = useState<any>(null)

  // Filters
  const [selectedFaculty, setSelectedFaculty] = useState<string>('')
  const [selectedStandard, setSelectedStandard] = useState<string>('')
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')

  // Options
  const [facultyOptions, setFacultyOptions] = useState<any[]>([])
  const [standardOptions, setStandardOptions] = useState<any[]>([])
  const [divisionOptions, setDivisionOptions] = useState<any[]>([])
  const [subjectOptions, setSubjectOptions] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => { initializePage() }, [])

  const initializePage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (!userData) return
      setUser(userData)

      const { data: inst } = await supabase.from('institutions').select('*').eq('id', userData.institution_id).single()
      if (inst) setInstitution(inst)

      const { data: yearData } = await supabase.from('academic_years').select('*').eq('institution_id', userData.institution_id).eq('is_current', true).single()
      setAcademicYear(yearData)

      await loadFilterOptions(userData)
    } catch (error) { console.error('Error:', error) }
  }

  const loadFilterOptions = async (userData: any) => {
    const instId = userData.institution_id
    const isAdmin = ['superadmin', 'admin'].includes(userData.role)
    const isHOD = userData.role === 'hod'

    // Faculty dropdown - visible to admin/superadmin/hod
    if (isAdmin || isHOD) {
      const { data } = await supabase.from('users').select('id, full_name').eq('institution_id', instId).eq('role', 'faculty').order('full_name')
      setFacultyOptions(data || [])
    }

    // Standards, Divisions, Subjects
    const [std, div, sub] = await Promise.all([
      supabase.from('standards').select('id, standard_name').eq('institution_id', instId).order('standard_name'),
      supabase.from('divisions').select('id, division_name, standard_id').eq('institution_id', instId).order('division_name'),
      supabase.from('subjects').select('id, subject_name, subject_code').eq('institution_id', instId).order('subject_name'),
    ])

    setStandardOptions(std.data || [])

    // Faculty: filter divisions and subjects to their assignments
    if (userData.role === 'faculty') {
      const { data: asgn } = await supabase.from('faculty_assignments').select('division_id, subject_id').eq('faculty_id', userData.id)
      const divIds = Array.from(new Set((asgn || []).map(a => a.division_id)))
      const subIds = Array.from(new Set((asgn || []).map(a => a.subject_id)))
      setDivisionOptions((div.data || []).filter(d => divIds.includes(d.id)))
      setSubjectOptions((sub.data || []).filter(s => subIds.includes(s.id)))
    } else {
      setDivisionOptions(div.data || [])
      setSubjectOptions(sub.data || [])
    }
  }

  const generateReport = async () => {
    if (!user || !academicYear) return
    setLoading(true)
    setReportData(null)
    try {
      // For faculty users, auto-set faculty_id filter
      const facultyFilter = user.role === 'faculty' ? user.id : (selectedFaculty || null)

      const response = await fetch('/api/reports/comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: selectedReport,
          institution_id: user.institution_id,
          academic_year_id: academicYear.id,
          filters: {
            faculty_id: facultyFilter,
            standard_id: selectedStandard || null,
            division_id: selectedDivision || null,
            subject_id: selectedSubject || null
          }
        })
      })
      const data = await response.json()
      setReportData(data)
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  const printReport = () => { window.print() }

  const isAdmin = user && ['superadmin', 'admin'].includes(user.role)
  const isHOD = user?.role === 'hod'
  const isFaculty = user?.role === 'faculty'
  const showFacultyFilter = isAdmin || isHOD

  const reportTypes: { key: ReportType; title: string; icon: string; desc: string }[] = [
    { key: 'faculty-workload', title: 'Monthly Workload', icon: '📅', desc: 'Faculty lectures per month' },
    { key: 'faculty-details', title: 'Faculty Wise Data', icon: '👨‍🏫', desc: 'Detailed entry log' },
    { key: 'division-status', title: 'Division Status', icon: '🏫', desc: 'Topic progress by division' },
    { key: 'subject-completion', title: 'Subject Completion', icon: '📚', desc: 'Topics completed per subject' },
    { key: 'topic-status', title: 'Topic-wise Status', icon: '📝', desc: 'Individual topic status' },
    { key: 'lagging-topics', title: 'Lagging Topics', icon: '⚠️', desc: 'Incomplete topics needing attention' },
    { key: 'division-comparison', title: 'Division Comparison', icon: '⚖️', desc: 'Compare divisions in same standard' },
    { key: 'faculty-pace', title: 'Faculty Pace', icon: '🏃', desc: 'Completion vs expected pace' },
    { key: 'monthly-progress', title: 'Monthly Progress', icon: '📈', desc: 'Cumulative month-over-month trend' },
  ]

  // Selected report label for header
  const selectedReportLabel = reportTypes.find(r => r.key === selectedReport)?.title || ''

  // Get active filter labels for print header
  const getFilterSummary = () => {
    const parts: string[] = []
    if (selectedFaculty) {
      const f = facultyOptions.find(x => x.id === selectedFaculty)
      if (f) parts.push(`Faculty: ${f.full_name}`)
    }
    if (isFaculty) parts.push(`Faculty: ${user.full_name}`)
    if (selectedStandard) {
      const s = standardOptions.find(x => x.id === selectedStandard)
      if (s) parts.push(`Standard: ${s.standard_name}`)
    }
    if (selectedDivision) {
      const d = divisionOptions.find(x => x.id === selectedDivision)
      if (d) parts.push(`Division: ${d.division_name}`)
    }
    if (selectedSubject) {
      const s = subjectOptions.find(x => x.id === selectedSubject)
      if (s) parts.push(`Subject: ${s.subject_name}`)
    }
    return parts.join(' | ')
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
      {/* =============== PRINT HEADER (visible only on print) =============== */}
      <div id="report-print-header" className="hidden print:block mb-6 report-print-header">
        <div className="flex items-center gap-4 border-b-2 border-black pb-3 mb-3" style={{ background: 'white' }}>
          {institution?.logo_url && (
            <img src={institution.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
          )}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold" style={{ color: 'black' }}>{institution?.institution_name || institution?.name || 'Institution'}</h1>
            {(institution?.address || institution?.city) && (
              <p className="text-xs" style={{ color: '#333' }}>
                {[institution?.address, institution?.city, institution?.state].filter(Boolean).join(', ')}
              </p>
            )}
            {institution?.phone && <p className="text-xs" style={{ color: '#666' }}>Ph: {institution.phone} {institution?.email ? ` | ${institution.email}` : ''}</p>}
          </div>
          {institution?.logo_url && <div className="w-16" />}
        </div>
        <div className="text-center mb-2" style={{ background: 'white' }}>
          <h2 className="text-lg font-bold" style={{ color: 'black' }}>{selectedReportLabel} Report</h2>
          <p className="text-xs" style={{ color: '#666' }}>Academic Year: {academicYear?.year_name || '-'} | Generated: {new Date().toLocaleDateString('en-IN')}</p>
          {getFilterSummary() && <p className="text-xs mt-1" style={{ color: '#444' }}>{getFilterSummary()}</p>}
        </div>
      </div>

      {/* =============== SCREEN HEADER (hidden on print) =============== */}
      <div className="mb-6 print:hidden" style={{}} data-print-hide="true">
        <div className="flex items-center gap-4 mb-2">
          {institution?.logo_url && (
            <img src={institution.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-white/10" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{institution?.institution_name || institution?.name || 'Loading...'}</h1>
            <p className="text-sm text-slate-400">
              {user?.role === 'faculty' ? 'My Reports' : user?.role === 'hod' ? 'HOD Reports (View Only)' : 'Reports Dashboard'}
              {academicYear && ` — ${academicYear.year_name}`}
            </p>
          </div>
        </div>
      </div>

      {/* =============== CONTROLS (hidden on print) =============== */}
      <div className="mb-6 space-y-4 print:hidden">
        {/* Report Type Grid */}
        <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
          <label className="block text-sm font-medium text-slate-300 mb-3">Select Report Type</label>
          <div className="grid grid-cols-3 lg:grid-cols-3 gap-2">
            {reportTypes.map(rt => (
              <button
                key={rt.key}
                onClick={() => { setSelectedReport(rt.key); setReportData(null) }}
                className={`px-3 py-3 rounded-lg border-2 transition text-left ${
                  selectedReport === rt.key
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:border-emerald-400/50'
                }`}
              >
                <div className="text-xl mb-1">{rt.icon}</div>
                <div className={`text-sm font-medium ${selectedReport === rt.key ? 'text-emerald-400' : 'text-slate-300'}`}>{rt.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 hidden lg:block">{rt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Filters {isFaculty && <span className="text-xs text-slate-500 font-normal">(Showing your assigned data only)</span>}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Faculty filter: visible to admin/superadmin/hod */}
            {showFacultyFilter && (
              <FilterSelect
                label="Faculty"
                value={selectedFaculty}
                onChange={setSelectedFaculty}
                options={facultyOptions.map(f => ({ value: f.id, label: f.full_name }))}
                placeholder="All Faculty"
              />
            )}
            <FilterSelect
              label="Standard"
              value={selectedStandard}
              onChange={(v: string) => { setSelectedStandard(v); setSelectedDivision('') }}
              options={standardOptions.map(s => ({ value: s.id, label: s.standard_name }))}
              placeholder="All Standards"
            />
            <FilterSelect
              label="Division"
              value={selectedDivision}
              onChange={setSelectedDivision}
              options={divisionOptions
                .filter(d => !selectedStandard || d.standard_id === selectedStandard)
                .map(d => ({ value: d.id, label: d.division_name }))}
              placeholder="All Divisions"
            />
            <FilterSelect
              label="Subject"
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={subjectOptions.map(s => ({ value: s.id, label: s.subject_name }))}
              placeholder="All Subjects"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={generateReport} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition disabled:opacity-50">
            {loading ? '⏳ Generating...' : '📊 Generate Report'}
          </button>
          <button onClick={printReport} disabled={!reportData}
            className="px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg transition disabled:opacity-50">
            🖨️ Print
          </button>
        </div>
      </div>

      {/* =============== REPORT OUTPUT =============== */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
        </div>
      ) : !reportData ? (
        <div className="bg-slate-800/50 rounded-xl border border-white/10 p-12 text-center print:hidden">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-400 text-lg mb-2">Select report type and click &quot;Generate Report&quot;</p>
          <p className="text-sm text-slate-500">Use filters to narrow results</p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-xl border border-white/10 print:bg-white print:border-gray-300 print:rounded-none">
          {selectedReport === 'faculty-workload' && <FacultyWorkloadReport data={reportData} />}
          {selectedReport === 'faculty-details' && <FacultyDetailsReport data={reportData} />}
          {selectedReport === 'division-status' && <DivisionStatusReport data={reportData} />}
          {selectedReport === 'subject-completion' && <SubjectCompletionReport data={reportData} />}
          {selectedReport === 'topic-status' && <TopicStatusReport data={reportData} />}
          {selectedReport === 'lagging-topics' && <LaggingTopicsReport data={reportData} />}
          {selectedReport === 'division-comparison' && <DivisionComparisonReport data={reportData} />}
          {selectedReport === 'faculty-pace' && <FacultyPaceReport data={reportData} />}
          {selectedReport === 'monthly-progress' && <MonthlyProgressReport data={reportData} />}
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block mt-4 pt-2 border-t border-gray-300 text-xs text-gray-500 text-center">
        {institution?.institution_name || institution?.name} — EduTrack Report — Printed on {new Date().toLocaleString('en-IN')}
      </div>
    </div>
  )
}

// ========================================================================
// Shared Components
// ========================================================================
function FilterSelect({ label, value, onChange, options, placeholder }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm">
        <option value="">{placeholder}</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { screen: string, printColor: string }> = {
    'Completed': { screen: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', printColor: '#059669' },
    'Done': { screen: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', printColor: '#059669' },
    'In Progress': { screen: 'bg-amber-500/20 text-amber-400 border-amber-500/30', printColor: '#d97706' },
    'Not Started': { screen: 'bg-slate-500/20 text-slate-400 border-slate-500/30', printColor: '#6b7280' },
    'High': { screen: 'bg-red-500/20 text-red-400 border-red-500/30', printColor: '#dc2626' },
    'Medium': { screen: 'bg-amber-500/20 text-amber-400 border-amber-500/30', printColor: '#d97706' },
    'Low': { screen: 'bg-blue-500/20 text-blue-400 border-blue-500/30', printColor: '#2563eb' },
    'Aligned': { screen: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', printColor: '#059669' },
    'Misaligned': { screen: 'bg-red-500/20 text-red-400 border-red-500/30', printColor: '#dc2626' },
    'Ahead': { screen: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', printColor: '#059669' },
    'On Track': { screen: 'bg-blue-500/20 text-blue-400 border-blue-500/30', printColor: '#2563eb' },
    'Behind': { screen: 'bg-red-500/20 text-red-400 border-red-500/30', printColor: '#dc2626' },
  }
  const c = colors[status] || { screen: 'bg-slate-500/20 text-slate-400', printColor: '#6b7280' }
  return (
    <span
      className={`status-badge px-2 py-0.5 rounded text-xs font-medium border ${c.screen}`}
      style={{ ['--print-color' as any]: c.printColor }}
    >
      {status}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-slate-400 print:text-gray-500"><div className="text-3xl mb-2">📭</div><p>{message}</p></div>
}

const TH = ({ children, className = '' }: any) => (
  <th className={`border border-slate-600/30 px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider print:text-black print:border-gray-400 print:bg-gray-100 print:text-[9pt] ${className}`}>{children}</th>
)
const TD = ({ children, className = '' }: any) => (
  <td className={`border border-slate-600/30 px-2 py-1.5 text-sm text-slate-300 print:text-black print:border-gray-300 print:text-[9pt] print:py-1 ${className}`}>{children}</td>
)

// ========================================================================
// 1. Faculty Workload
// ========================================================================
function FacultyWorkloadReport({ data }: any) {
  if (!data.faculty?.length) return <EmptyState message="No faculty data found" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-emerald-600/20 print:bg-gray-200">
            <TH>Sr</TH><TH>Faculty Name</TH><TH className="text-center">Code</TH>
            {data.months?.map((m: string) => <TH key={m} className="text-center">{m}</TH>)}
            <TH className="text-center">Total</TH>
          </tr>
        </thead>
        <tbody>
          {data.faculty.map((f: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD>{i + 1}</TD>
              <TD className="font-medium whitespace-nowrap">{f.name}</TD>
              <TD className="text-center">{f.code}</TD>
              {f.monthly_lectures?.map((l: number, j: number) => (
                <TD key={j} className="text-center">{l || '-'}</TD>
              ))}
              <TD className="text-center font-bold text-emerald-400 print:text-black">{f.total}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ========================================================================
// 2. Faculty Details
// ========================================================================
function FacultyDetailsReport({ data }: any) {
  if (!data.entries?.length) return <EmptyState message="No entries found. Try adjusting filters." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-emerald-600/20 print:bg-gray-200">
            <TH>Date</TH><TH>Month</TH><TH>Division</TH><TH>Subject</TH>
            <TH>Topic</TH><TH className="text-center">Allotted</TH>
            <TH className="text-center">Taken</TH><TH>Status</TH>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((e: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD className="whitespace-nowrap">{e.start_date}</TD>
              <TD>{e.month}</TD><TD>{e.division}</TD><TD>{e.subject}</TD>
              <TD>{e.topic_name}</TD>
              <TD className="text-center">{e.lectures_allotted}</TD>
              <TD className="text-center">{e.lectures_taken}</TD>
              <TD><StatusBadge status={e.status} /></TD>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 text-xs text-slate-500 print:text-gray-500">Total entries: {data.entries.length}</div>
    </div>
  )
}

// ========================================================================
// 3. Division Status
// ========================================================================
function DivisionStatusReport({ data }: any) {
  if (!data.topics?.length) return <EmptyState message="No topic data found. Try adjusting filters." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-emerald-600/20 print:bg-gray-200">
            <TH>Division</TH><TH>Subject</TH><TH>Code</TH><TH>Topic</TH>
            <TH className="text-center">Allotted</TH><TH className="text-center">Date</TH>
            <TH className="text-center">Taken</TH><TH>Faculty</TH><TH>Status</TH>
          </tr>
        </thead>
        <tbody>
          {data.topics.map((t: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD>{t.division}</TD><TD>{t.subject}</TD>
              <TD className="font-mono text-xs">{t.topic_code}</TD>
              <TD>{t.topic_name}</TD>
              <TD className="text-center">{t.lectures_allotted}</TD>
              <TD className="text-center whitespace-nowrap">{t.start_date}</TD>
              <TD className="text-center">{t.lectures_taken}</TD>
              <TD>{t.faculty}</TD>
              <TD><StatusBadge status={t.status} /></TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ========================================================================
// 4. Subject Completion
// ========================================================================
function SubjectCompletionReport({ data }: any) {
  if (!data.subjects?.length) return <EmptyState message="No subjects found" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-emerald-600/20 print:bg-gray-200">
            <TH>Subject</TH><TH>Code</TH>
            <TH className="text-center">Total</TH><TH className="text-center">Done</TH>
            <TH className="text-center">Remaining</TH><TH className="text-center">Progress</TH>
          </tr>
        </thead>
        <tbody>
          {data.subjects.map((s: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD className="font-medium">{s.subject_name}</TD>
              <TD>{s.subject_code}</TD>
              <TD className="text-center">{s.total_topics}</TD>
              <TD className="text-center text-emerald-400 print:text-black">{s.completed_topics}</TD>
              <TD className="text-center text-amber-400 print:text-black">{s.remaining_topics}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2 print:bg-gray-200">
                    <div className="bg-emerald-500 h-2 rounded-full print:bg-green-600" style={{ width: `${Math.min(s.completion_percentage, 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold w-10 text-right">{s.completion_percentage}%</span>
                </div>
              </TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ========================================================================
// 5. Topic Status
// ========================================================================
function TopicStatusReport({ data }: any) {
  if (!data.topics?.length) return <EmptyState message="No topics found. Try adjusting filters." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-emerald-600/20 print:bg-gray-200">
            <TH>Subject</TH><TH>Code</TH><TH>Topic</TH>
            <TH className="text-center">Allotted</TH><TH className="text-center">Completed In</TH><TH>Status</TH>
          </tr>
        </thead>
        <tbody>
          {data.topics.map((t: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD>{t.subject}</TD>
              <TD className="font-mono text-xs">{t.topic_code}</TD>
              <TD>{t.topic_name}</TD>
              <TD className="text-center">{t.allotted_lectures}</TD>
              <TD className="text-center">{t.completed_in || '-'}</TD>
              <TD><StatusBadge status={t.status} /></TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ========================================================================
// 6. Lagging Topics
// ========================================================================
function LaggingTopicsReport({ data }: any) {
  if (!data.lagging_topics?.length) return <EmptyState message="🎉 No lagging topics! All on track." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="bg-red-600/20 print:bg-gray-200">
            <TH>Division</TH><TH>Subject</TH><TH>Topic</TH>
            <TH className="text-center">Allotted</TH><TH className="text-center">Taken</TH>
            <TH className="text-center">Remaining</TH><TH className="text-center">Progress</TH>
            <TH>Faculty</TH><TH>Priority</TH>
          </tr>
        </thead>
        <tbody>
          {data.lagging_topics.map((t: any, i: number) => (
            <tr key={i} className="hover:bg-white/5">
              <TD>{t.division}</TD><TD>{t.subject}</TD><TD>{t.topic_name}</TD>
              <TD className="text-center">{t.allotted}</TD>
              <TD className="text-center">{t.taken}</TD>
              <TD className="text-center text-red-400 print:text-black">{t.remaining}</TD>
              <TD className="text-center">
                <div className="w-full bg-slate-700 rounded-full h-2 print:bg-gray-200">
                  <div className={`h-2 rounded-full ${t.progress_pct < 30 ? 'bg-red-500' : t.progress_pct < 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${t.progress_pct}%` }} />
                </div>
                <span className="text-xs text-slate-500">{t.progress_pct}%</span>
              </TD>
              <TD>{t.faculty}</TD>
              <TD><StatusBadge status={t.priority} /></TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ========================================================================
// 7. Division Comparison
// ========================================================================
function DivisionComparisonReport({ data }: any) {
  if (!data.comparison?.length) return <EmptyState message="No data. Select a standard to compare its divisions." />
  const divNames = data.division_names || []
  return (
    <div>
      <div className="p-4 border-b border-white/10 print:border-gray-300">
        <div className="flex flex-wrap gap-6 items-center text-sm">
          <span className="text-slate-400 print:text-gray-600"><span className="text-white print:text-black font-semibold">{data.standard}</span> — {divNames.length} divisions</span>
          <span className="text-emerald-400 print:text-black">Aligned: {data.summary?.aligned}</span>
          <span className="text-red-400 print:text-black">Misaligned: {data.summary?.misaligned}</span>
          <span className="text-white print:text-black font-bold">Alignment: {data.summary?.alignment_pct}%</span>
        </div>
      </div>
      {data.comparison.map((subj: any, si: number) => (
        <div key={si} className="border-b border-white/10 print:border-gray-300">
          <div className="px-4 py-2 bg-slate-700/30 print:bg-gray-100">
            <h3 className="font-semibold text-emerald-400 print:text-black">{subj.subject}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm print:text-[9pt]">
              <thead>
                <tr className="bg-slate-700/20 print:bg-gray-50">
                  <TH>Topic</TH><TH className="text-center">Allotted</TH>
                  {divNames.map((d: string) => <TH key={d} className="text-center">{d}</TH>)}
                  <TH className="text-center">Alignment</TH>
                </tr>
              </thead>
              <tbody>
                {subj.topics?.map((t: any, ti: number) => (
                  <tr key={ti} className={`hover:bg-white/5 ${t.alignment === 'Misaligned' ? 'bg-red-500/5' : ''}`}>
                    <TD>{t.topic_name}</TD><TD className="text-center">{t.allotted}</TD>
                    {divNames.map((d: string) => {
                      const dp = t.divisions?.[d]
                      return <TD key={d} className="text-center"><div>{dp?.taken || 0}</div><StatusBadge status={dp?.status || 'Not Started'} /></TD>
                    })}
                    <TD className="text-center"><StatusBadge status={t.alignment} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ========================================================================
// 8. Faculty Pace
// ========================================================================
function FacultyPaceReport({ data }: any) {
  if (!data.faculty?.length) return <EmptyState message="No faculty data found" />
  return (
    <div>
      <div className="p-4 border-b border-white/10 print:border-gray-300 text-sm">
        <span className="text-slate-400 print:text-gray-600">Days: <span className="text-white print:text-black font-semibold">{data.days_passed}/{data.total_days}</span></span>
        <span className="text-slate-400 print:text-gray-600 ml-6">Expected: <span className="text-amber-400 print:text-black font-semibold">{data.expected_pct}%</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm print:text-[9pt]">
          <thead>
            <tr className="bg-emerald-600/20 print:bg-gray-200">
              <TH>Faculty</TH><TH className="text-center">Topics</TH>
              <TH className="text-center">Done</TH><TH className="text-center">In Prog.</TH>
              <TH className="text-center">Not Started</TH><TH className="text-center">Actual %</TH>
              <TH className="text-center">Expected %</TH><TH className="text-center">Gap</TH><TH>Pace</TH>
            </tr>
          </thead>
          <tbody>
            {data.faculty.map((f: any, i: number) => {
              const gap = f.completion_pct - f.expected_pct
              return (
                <tr key={i} className="hover:bg-white/5">
                  <TD className="font-medium">{f.faculty}</TD>
                  <TD className="text-center">{f.total_topics}</TD>
                  <TD className="text-center text-emerald-400 print:text-black">{f.completed}</TD>
                  <TD className="text-center text-amber-400 print:text-black">{f.in_progress}</TD>
                  <TD className="text-center text-slate-500">{f.not_started}</TD>
                  <TD className="text-center font-bold">{f.completion_pct}%</TD>
                  <TD className="text-center text-slate-400">{f.expected_pct}%</TD>
                  <TD className={`text-center font-medium ${gap >= 0 ? 'text-emerald-400' : 'text-red-400'} print:text-black`}>{gap >= 0 ? '+' : ''}{gap}%</TD>
                  <TD><StatusBadge status={f.pace} /></TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ========================================================================
// 9. Monthly Progress
// ========================================================================
function MonthlyProgressReport({ data }: any) {
  if (!data.months?.length) return <EmptyState message="No monthly data found" />
  const maxL = Math.max(...data.months.map((m: any) => m.lectures_this_month), 1)
  return (
    <div>
      <div className="p-4 border-b border-white/10 print:border-gray-300 text-sm">
        <span className="text-slate-400 print:text-gray-600">Total Topics: <span className="text-white print:text-black font-semibold">{data.total_topics}</span></span>
        <span className="text-slate-400 print:text-gray-600 ml-6">Lectures Expected: <span className="text-white print:text-black font-semibold">{data.total_lectures_expected}</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm print:text-[9pt]">
          <thead>
            <tr className="bg-emerald-600/20 print:bg-gray-200">
              <TH>Month</TH><TH className="text-center">Entries</TH>
              <TH className="text-center">Lectures</TH><TH>Activity</TH>
              <TH className="text-center">Cumulative</TH><TH className="text-center">Topics Done</TH>
              <TH className="text-center">Completion %</TH>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m: any, i: number) => (
              <tr key={i} className="hover:bg-white/5">
                <TD className="font-medium">{m.month}</TD>
                <TD className="text-center">{m.entries_count}</TD>
                <TD className="text-center">{m.lectures_this_month}</TD>
                <TD>
                  <div className="w-full bg-slate-700 rounded-full h-2.5 print:bg-gray-200">
                    <div className="bg-blue-500 h-2.5 rounded-full print:bg-blue-600" style={{ width: `${(m.lectures_this_month / maxL) * 100}%` }} />
                  </div>
                </TD>
                <TD className="text-center font-medium">{m.cumulative_lectures}</TD>
                <TD className="text-center text-emerald-400 print:text-black">{m.cumulative_topics_completed}</TD>
                <TD className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-12 bg-slate-700 rounded-full h-2 print:bg-gray-200">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(m.completion_pct, 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold">{m.completion_pct}%</span>
                  </div>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
