// 🏫 DIVISIONS PAGE v2 - Role-based filtering + Fixed faculty allotment
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/app/(dashboard)/admin/components/Modal'
import { downloadTemplate, downloadExcel, parseExcel, DIVISION_COLUMNS, DIVISION_SAMPLE_DATA } from '@/lib/excel-utils'

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<any[]>([])
  const [streams, setStreams] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStream, setFilterStream] = useState('')
  const [filterStandard, setFilterStandard] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedDivision, setSelectedDivision] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({ division_code: '', division_name: '', stream_id: '', standard_id: '', student_count: 0 })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (!userData) return
      setInstitutionId(userData.institution_id)
      setUserRole(userData.role)
      setUserId(userData.id)

      const [streamsRes, standardsRes, divisionsRes] = await Promise.all([
        supabase.from('streams').select('id, stream_name, stream_code').eq('institution_id', userData.institution_id).order('stream_name'),
        supabase.from('standards').select('id, standard_name').eq('institution_id', userData.institution_id).order('standard_name'),
        supabase.from('divisions').select('*').eq('institution_id', userData.institution_id).order('division_name'),
      ])

      setStreams(streamsRes.data || [])
      setStandards(standardsRes.data || [])

      // ✅ ROLE-BASED: Faculty only sees their assigned divisions
      let visibleDivisionIds: string[] | null = null
      if (userData.role === 'faculty') {
        const { data: assignments } = await supabase.from('faculty_assignments').select('division_id').eq('faculty_id', userData.id)
        visibleDivisionIds = Array.from(new Set((assignments || []).map(a => a.division_id)))
      }

      const allDivisions = divisionsRes.data || []
      const filteredDivisions = visibleDivisionIds
        ? allDivisions.filter(d => visibleDivisionIds!.includes(d.id))
        : allDivisions

      // Enrich with faculty count and stream/standard names
      const enriched = await Promise.all(
        filteredDivisions.map(async (division) => {
          const { count } = await supabase.from('faculty_assignments').select('*', { count: 'exact', head: true }).eq('division_id', division.id)
          const stream = (streamsRes.data || []).find(s => s.id === division.stream_id)
          const standard = (standardsRes.data || []).find(s => s.id === division.standard_id)
          return { ...division, faculty_count: count || 0, stream_name: stream?.stream_name || '', standard_name: standard?.standard_name || '' }
        })
      )

      setDivisions(enriched)
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  // ✅ FIXED: Fetch faculty assignments without FK joins
  const handleViewDetails = async (division: any) => {
    setSelectedDivision(division)
    setShowDetailsModal(true)
    setLoadingAssignments(true)
    try {
      // Step 1: Get ALL assignments for this division (no academic_year filter to avoid empty)
      const { data: rawAssignments, error: asgError } = await supabase
        .from('faculty_assignments')
        .select('id, faculty_id, subject_id, academic_year_id')
        .eq('division_id', division.id)

      console.log('Division assignments:', division.id, rawAssignments?.length, asgError)

      if (!rawAssignments || rawAssignments.length === 0) {
        setAssignments([])
        setLoadingAssignments(false)
        return
      }

      // Step 2: Get faculty names
      const facultyIds = Array.from(new Set(rawAssignments.map(a => a.faculty_id)))
      const { data: facultyData } = await supabase.from('users').select('id, full_name').in('id', facultyIds)
      const facultyMap = new Map((facultyData || []).map(f => [f.id, f.full_name]))

      // Step 3: Get subject names
      const subjectIds = Array.from(new Set(rawAssignments.map(a => a.subject_id)))
      const { data: subjectData } = await supabase.from('subjects').select('id, subject_name, subject_code').in('id', subjectIds)
      const subjectMap = new Map((subjectData || []).map(s => [s.id, s]))

      // Step 4: Build display data (deduplicate by faculty+subject)
      const seen = new Set<string>()
      const formatted = rawAssignments
        .filter(a => {
          const key = `${a.faculty_id}-${a.subject_id}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(a => ({
          id: a.id,
          faculty_name: facultyMap.get(a.faculty_id) || 'Unknown',
          subject_name: subjectMap.get(a.subject_id)?.subject_name || 'Unknown',
          subject_code: subjectMap.get(a.subject_id)?.subject_code || ''
        }))
        .sort((a, b) => a.faculty_name.localeCompare(b.faculty_name))

      setAssignments(formatted)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      setAssignments([])
    } finally { setLoadingAssignments(false) }
  }

  const handleAddDivision = async () => {
    if (!formData.division_code || !formData.division_name) { setMessage({ type: 'error', text: 'Code and name required' }); return }
    setSaving(true); setMessage(null)
    try {
      const { error } = await supabase.from('divisions').insert({
        institution_id: institutionId, division_code: formData.division_code, division_name: formData.division_name,
        stream_id: formData.stream_id || null, standard_id: formData.standard_id || null,
        student_count: formData.student_count, is_active: true, created_at: new Date().toISOString()
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Division added!' }); setShowAddModal(false)
      setFormData({ division_code: '', division_name: '', stream_id: '', standard_id: '', student_count: 0 })
      fetchData()
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
    finally { setSaving(false) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setSaving(true); setMessage(null)
    try {
      const data = await parseExcel(file); let success = 0, errors = 0
      for (const row of data) {
        try {
          const stream = streams.find(s => s.stream_name.toLowerCase() === (row['Stream'] || '').toLowerCase())
          await supabase.from('divisions').insert({
            institution_id: institutionId, division_code: row['Division Code'], division_name: row['Division Name'],
            stream_id: stream?.id || null, student_count: parseInt(row['Student Count']) || 0,
            is_active: true, created_at: new Date().toISOString()
          })
          success++
        } catch { errors++ }
      }
      setMessage({ type: success > 0 ? 'success' : 'error', text: `Imported ${success} divisions. ${errors > 0 ? `${errors} failed.` : ''}` })
      setShowUploadModal(false); fetchData()
    } catch { setMessage({ type: 'error', text: 'Failed to parse Excel' }) }
    finally { setSaving(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const canManage = ['superadmin', 'admin'].includes(userRole)

  const filteredDivisions = divisions.filter(d => {
    const matchesSearch = (d.division_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.division_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStream = !filterStream || d.stream_id === filterStream
    const matchesStandard = !filterStandard || d.standard_id === filterStandard
    return matchesSearch && matchesStream && matchesStandard
  })

  const groupedDivisions = filteredDivisions.reduce((acc: any, div) => {
    const key = div.standard_name || div.stream_name || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(div)
    return acc
  }, {} as Record<string, any[]>)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Divisions {userRole === 'faculty' ? '(My Divisions)' : 'Management'}</h1>
          <p className="text-slate-400">{userRole === 'faculty' ? 'Your assigned divisions' : 'View and manage class divisions'}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadTemplate(DIVISION_COLUMNS, 'divisions', DIVISION_SAMPLE_DATA)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10">📄 Template</button>
            <button onClick={() => setShowUploadModal(true)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">📤 Upload</button>
            <button onClick={() => downloadExcel(divisions.map(d => ({ division_code: d.division_code, division_name: d.division_name, stream_name: d.stream_name, student_count: d.student_count })), DIVISION_COLUMNS, 'divisions_list')} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">📥 Export</button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl">+ Add Division</button>
          </div>
        )}
      </div>

      {message && <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-white">{divisions.length}</p><p className="text-sm text-slate-400">Divisions</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-emerald-400">{divisions.reduce((a, d) => a + (d.student_count || 0), 0)}</p><p className="text-sm text-slate-400">Students</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-amber-400">{streams.length}</p><p className="text-sm text-slate-400">Streams</p></div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search divisions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white placeholder-slate-500" />
          <select value={filterStandard} onChange={e => setFilterStandard(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Standards</option>
            {standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}
          </select>
          <select value={filterStream} onChange={e => setFilterStream(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Streams</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.stream_name}</option>)}
          </select>
        </div>
      </div>

      {/* Division Grid */}
      {Object.keys(groupedDivisions).length > 0 ? (
        Object.entries(groupedDivisions).map(([groupName, divs]: any) => (
          <div key={groupName} className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-sm">🎓</span>
              {groupName} <span className="text-sm font-normal text-slate-500">({divs.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {divs.map((division: any) => (
                <div key={division.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-500/30 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-2xl font-bold">{division.division_code?.split('-').pop() || division.division_name.split(' ').pop() || '?'}</span>
                    </div>
                    {division.standard_name && <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">{division.standard_name}</span>}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-amber-400 transition-colors">{division.division_name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Students</span><span className="text-white font-medium">{division.student_count || 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Faculty</span><span className="text-emerald-400 font-medium">{division.faculty_count || 0}</span></div>
                    {division.stream_name && <div className="flex justify-between"><span className="text-slate-400">Stream</span><span className="text-white">{division.stream_name}</span></div>}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button onClick={() => handleViewDetails(division)} className="w-full px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">View Details & Faculty</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center"><div className="text-4xl mb-4">🏫</div><p className="text-slate-400">No divisions found</p></div>
      )}

      {/* Add Division Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Division" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Code *</label><input type="text" value={formData.division_code} onChange={e => setFormData({ ...formData, division_code: e.target.value.toUpperCase() })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., XI-A" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Students</label><input type="number" value={formData.student_count} onChange={e => setFormData({ ...formData, student_count: parseInt(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Name *</label><input type="text" value={formData.division_name} onChange={e => setFormData({ ...formData, division_name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., XI Commerce A" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Standard</label><select value={formData.standard_id} onChange={e => setFormData({ ...formData, standard_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white"><option value="">Select</option>{standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Stream</label><select value={formData.stream_id} onChange={e => setFormData({ ...formData, stream_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white"><option value="">Select</option>{streams.map(s => <option key={s.id} value={s.id}>{s.stream_name}</option>)}</select></div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl">Cancel</button>
            <button onClick={handleAddDivision} disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Divisions" size="md">
        <div className="space-y-4">
          <button onClick={() => downloadTemplate(DIVISION_COLUMNS, 'divisions', DIVISION_SAMPLE_DATA)} className="w-full px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10">Download Template</button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg">Choose File</button>
          </div>
        </div>
      </Modal>

      {/* ✅ FIXED: Details Modal - shows faculty properly */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`${selectedDivision?.division_name || ''} - Details`} size="lg">
        {selectedDivision && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Code</p><p className="text-white font-medium">{selectedDivision.division_code || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Standard</p><p className="text-white">{selectedDivision.standard_name || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Students</p><p className="text-white font-medium">{selectedDivision.student_count || 0}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Faculty</p><p className="text-emerald-400 font-medium">{selectedDivision.faculty_count || 0}</p></div>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3">Faculty Assignments</h4>
              {loadingAssignments ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div></div>
              ) : assignments.length > 0 ? (
                <div className="bg-white/5 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Faculty</th><th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Subject</th><th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Code</th></tr></thead>
                    <tbody>
                      {assignments.map(a => (
                        <tr key={a.id} className="border-b border-white/5">
                          <td className="py-3 px-4 text-white">{a.faculty_name}</td>
                          <td className="py-3 px-4 text-slate-300">{a.subject_name}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-sm">{a.subject_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-white/5 rounded-lg"><p className="text-slate-400">No faculty assigned to this division</p><p className="text-xs text-slate-500 mt-1">Go to System Setup → Faculty Assignments to assign faculty</p><p className="text-xs text-slate-600 mt-1">Make sure assignments have the correct division_id</p></div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
