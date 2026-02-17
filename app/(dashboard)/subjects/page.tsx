// 📚 SUBJECTS PAGE v2 - Role-based filtering + Fixed topics query
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/app/(dashboard)/admin/components/Modal'
import { downloadTemplate, downloadExcel, parseExcel, TOPIC_COLUMNS, TOPIC_SAMPLE_DATA } from '@/lib/excel-utils'

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterStandard, setFilterStandard] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTopicsModal, setShowTopicsModal] = useState(false)
  const [showTopicsUploadModal, setShowTopicsUploadModal] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<any>(null)
  const [topics, setTopics] = useState<any[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({
    subject_code: '', subject_name: '', department_id: '', total_lectures: 160, board_subject_code: ''
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const topicsFileInputRef = useRef<HTMLInputElement>(null)
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

      const { data: deptData } = await supabase.from('departments').select('id, department_name')
        .eq('institution_id', userData.institution_id).order('department_name')
      setDepartments(deptData || [])

      // Fetch standards for filter
      const { data: stdData } = await supabase.from('standards').select('id, standard_name')
        .eq('institution_id', userData.institution_id).order('standard_name')
      setStandards(stdData || [])

      // Get ALL subjects for institution
      const { data: allSubjects } = await supabase.from('subjects').select('*')
        .eq('institution_id', userData.institution_id).order('subject_name')

      // ✅ ROLE-BASED FILTER: Faculty only sees their assigned subjects
      let visibleSubjectIds: string[] | null = null
      if (userData.role === 'faculty') {
        const { data: assignments } = await supabase.from('faculty_assignments').select('subject_id').eq('faculty_id', userData.id)
        visibleSubjectIds = Array.from(new Set((assignments || []).map(a => a.subject_id)))
      }

      const filteredSubjects = visibleSubjectIds
        ? (allSubjects || []).filter(s => visibleSubjectIds!.includes(s.id))
        : allSubjects || []

      // Enrich with topic count and department name
      const enriched = await Promise.all(
        filteredSubjects.map(async (subject) => {
          const { count } = await supabase.from('topics').select('*', { count: 'exact', head: true }).eq('subject_id', subject.id)
          const dept = deptData?.find(d => d.id === subject.department_id)
          const std = stdData?.find(s => s.id === subject.standard_id)
          return { ...subject, topics_count: count || 0, department_name: dept?.department_name || '', standard_name: std?.standard_name || '' }
        })
      )

      setSubjects(enriched)
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  // ✅ FIXED: Topics query uses correct columns + institution filter
  const handleViewTopics = async (subject: any) => {
    setSelectedSubject(subject)
    setShowTopicsModal(true)
    setLoadingTopics(true)
    try {
      // Query by subject_id AND institution_id for safety
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subject.id)
        .eq('institution_id', institutionId)
        .order('topic_number', { ascending: true })

      if (error) {
        console.error('Topics query error:', error)
        // Fallback: try without order
        const { data: fallbackData } = await supabase
          .from('topics')
          .select('*')
          .eq('subject_id', subject.id)
          .eq('institution_id', institutionId)
        setTopics(fallbackData || [])
      } else {
        setTopics(data || [])
      }

      if (!data?.length) {
        console.log('No topics found. subject_id:', subject.id, 'institution_id:', institutionId)
      }
    } catch (error) { console.error('Error fetching topics:', error) }
    finally { setLoadingTopics(false) }
  }

  const handleAddSubject = async () => {
    if (!formData.subject_code || !formData.subject_name) { setMessage({ type: 'error', text: 'Subject code and name are required' }); return }
    setSaving(true); setMessage(null)
    try {
      const { error } = await supabase.from('subjects').insert({
        institution_id: institutionId, subject_code: formData.subject_code, subject_name: formData.subject_name,
        department_id: formData.department_id || null, total_lectures: formData.total_lectures,
        board_subject_code: formData.board_subject_code || null, is_active: true, created_at: new Date().toISOString()
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Subject added!' }); setShowAddModal(false)
      setFormData({ subject_code: '', subject_name: '', department_id: '', total_lectures: 160, board_subject_code: '' })
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
          const dept = departments.find(d => d.department_name.toLowerCase() === (row['Department'] || '').toLowerCase())
          await supabase.from('subjects').insert({
            institution_id: institutionId, subject_code: row['Subject Code'], subject_name: row['Subject Name'],
            department_id: dept?.id || null, total_lectures: parseInt(row['No. of Lectures']) || 160,
            board_subject_code: row['Board Subject Code'] || null, is_active: true, created_at: new Date().toISOString()
          })
          success++
        } catch { errors++ }
      }
      setMessage({ type: success > 0 ? 'success' : 'error', text: `Imported ${success} subjects. ${errors > 0 ? `${errors} failed.` : ''}` })
      setShowUploadModal(false); fetchData()
    } catch { setMessage({ type: 'error', text: 'Failed to parse Excel file' }) }
    finally { setSaving(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleTopicsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedSubject) return
    setSaving(true)
    try {
      const data = await parseExcel(file); let success = 0
      for (const row of data) {
        try {
          await supabase.from('topics').insert({
            institution_id: institutionId, subject_id: selectedSubject.id,
            topic_id_number: row['Topic Number'] || '', topic_name: row['Topic Name'],
            default_lectures: parseFloat(row['Default Lectures']) || 1,
            topic_number: parseInt(row['Sequence Order']) || success + 1,
            is_active: true, created_at: new Date().toISOString()
          })
          success++
        } catch (err) { console.error(err) }
      }
      setMessage({ type: 'success', text: `Imported ${success} topics!` })
      setShowTopicsUploadModal(false); handleViewTopics(selectedSubject); fetchData()
    } catch { setMessage({ type: 'error', text: 'Failed to parse Excel' }) }
    finally { setSaving(false); if (topicsFileInputRef.current) topicsFileInputRef.current.value = '' }
  }

  const SUBJECT_COLUMNS = [
    { header: 'Subject Code', key: 'subject_code', width: 15 }, { header: 'Subject Name', key: 'subject_name', width: 30 },
    { header: 'Department', key: 'department_name', width: 20 }, { header: 'No. of Lectures', key: 'total_lectures', width: 15 },
    { header: 'Board Subject Code', key: 'board_subject_code', width: 18 },
  ]
  const SUBJECT_SAMPLE_DATA = [
    { subject_code: 'PHY', subject_name: 'Physics', department_name: 'Science', total_lectures: 160, board_subject_code: 'PHY101' },
  ]

  const canManage = ['superadmin', 'admin'].includes(userRole)

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = (s.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (s.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = !filterDepartment || s.department_id === filterDepartment
    const matchesStandard = !filterStandard || s.standard_id === filterStandard
    return matchesSearch && matchesDept && matchesStandard
  })

  const stats = {
    total: subjects.length,
    totalTopics: subjects.reduce((a, s) => a + (s.topics_count || 0), 0),
    totalLectures: subjects.reduce((a, s) => a + (s.total_lectures || 0), 0),
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Subjects {userRole === 'faculty' ? '(My Subjects)' : 'Management'}</h1>
          <p className="text-slate-400">{userRole === 'faculty' ? 'Your assigned subjects and curriculum' : 'View and manage subjects and curriculum'}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadTemplate(SUBJECT_COLUMNS, 'subjects', SUBJECT_SAMPLE_DATA)} className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl transition-all border border-white/10">📄 Template</button>
            <button onClick={() => setShowUploadModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium rounded-xl transition-all border border-emerald-500/30">📤 Upload</button>
            <button onClick={() => downloadExcel(subjects.map(s => ({ subject_code: s.subject_code, subject_name: s.subject_name, department_name: s.department_name, total_lectures: s.total_lectures, board_subject_code: s.board_subject_code || '' })), SUBJECT_COLUMNS, 'subjects_list')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-xl transition-all border border-blue-500/30">📥 Export</button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl shadow-lg shadow-amber-500/25">+ Add Subject</button>
          </div>
        )}
      </div>

      {message && <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-white">{stats.total}</p><p className="text-sm text-slate-400">Subjects</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-emerald-400">{stats.totalTopics}</p><p className="text-sm text-slate-400">Topics</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-amber-400">{stats.totalLectures}</p><p className="text-sm text-slate-400">Lectures</p></div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search subjects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-4 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50" />
          <select value={filterStandard} onChange={(e) => setFilterStandard(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Standards</option>
            {standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}
          </select>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.length > 0 ? filteredSubjects.map(subject => (
          <div key={subject.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-500/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {(subject.subject_code || 'NA').substring(0, 2)}
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">{subject.subject_name}</h3>
            <p className="text-sm text-slate-500 mb-4">{subject.subject_code}</p>
            <div className="space-y-2 text-sm">
              {subject.standard_name && <div className="flex justify-between"><span className="text-slate-400">Standard</span><span className="text-blue-400">{subject.standard_name}</span></div>}
              <div className="flex justify-between"><span className="text-slate-400">Department</span><span className="text-white">{subject.department_name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Topics</span><span className="text-emerald-400 font-medium">{subject.topics_count || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Lectures</span><span className="text-white">{subject.total_lectures || 0}</span></div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
              <button onClick={() => handleViewTopics(subject)} className="flex-1 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">View Topics</button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center"><div className="text-4xl mb-4">📚</div><p className="text-slate-400">No subjects found</p></div>
        )}
      </div>

      {/* Add Subject Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Subject" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Subject Code *</label>
              <input type="text" value={formData.subject_code} onChange={(e) => setFormData({ ...formData, subject_code: e.target.value.toUpperCase() })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., PHY" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Board Code</label>
              <input type="text" value={formData.board_subject_code} onChange={(e) => setFormData({ ...formData, board_subject_code: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Subject Name *</label>
            <input type="text" value={formData.subject_name} onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., Physics" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
              <select value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white">
                <option value="">Select</option>{departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Lectures</label>
              <input type="number" value={formData.total_lectures} onChange={(e) => setFormData({ ...formData, total_lectures: parseInt(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl">Cancel</button>
            <button onClick={handleAddSubject} disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving ? 'Adding...' : 'Add Subject'}</button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Subjects from Excel" size="md">
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"><p className="text-blue-400 text-sm">📋 Download template, fill in details, then upload.</p></div>
          <button onClick={() => downloadTemplate(SUBJECT_COLUMNS, 'subjects', SUBJECT_SAMPLE_DATA)} className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10">Download Template</button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg">Choose Excel File</button>
          </div>
        </div>
      </Modal>

      {/* Topics Modal - ✅ FIXED: shows topics correctly */}
      <Modal isOpen={showTopicsModal} onClose={() => setShowTopicsModal(false)} title={`Topics - ${selectedSubject?.subject_name || ''}`} size="lg">
        <div className="space-y-4">
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => downloadTemplate(TOPIC_COLUMNS, `topics_${selectedSubject?.subject_code || 'template'}`, TOPIC_SAMPLE_DATA)} className="flex items-center gap-2 px-3 py-2 bg-white/5 text-slate-300 rounded-lg text-sm">📄 Template</button>
              <button onClick={() => setShowTopicsUploadModal(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">📤 Upload Topics</button>
            </div>
          )}
          {loadingTopics ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div></div>
          ) : topics.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">#</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Topic</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Lectures</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic, index) => (
                    <tr key={topic.id} className="border-b border-white/5">
                      <td className="py-3 px-4 text-slate-500">{topic.topic_number || topic.topic_id_number || index + 1}</td>
                      <td className="py-3 px-4 text-white">{topic.topic_name}</td>
                      <td className="py-3 px-4 text-center text-slate-400">{topic.default_lectures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12"><div className="text-4xl mb-4">📝</div><p className="text-slate-400">No topics found for this subject</p><p className="text-sm text-slate-500 mt-1">{canManage ? 'Upload topics using Excel template above' : 'Topics may not have been uploaded yet. Contact admin.'}</p><p className="text-xs text-slate-600 mt-2">If topics exist but don&apos;t appear, check that subject_id matches in the topics table.</p></div>
          )}
        </div>
      </Modal>

      {/* Topics Upload Modal */}
      <Modal isOpen={showTopicsUploadModal} onClose={() => setShowTopicsUploadModal(false)} title="Upload Topics" size="md">
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"><p className="text-blue-400 text-sm">📋 For: <strong>{selectedSubject?.subject_name}</strong></p></div>
          <button onClick={() => downloadTemplate(TOPIC_COLUMNS, `topics_${selectedSubject?.subject_code}`, TOPIC_SAMPLE_DATA)} className="w-full px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10">Download Template</button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
            <input type="file" ref={topicsFileInputRef} accept=".xlsx,.xls" onChange={handleTopicsUpload} className="hidden" />
            <button onClick={() => topicsFileInputRef.current?.click()} disabled={saving} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg disabled:opacity-50">{saving ? 'Uploading...' : 'Choose Excel File'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
