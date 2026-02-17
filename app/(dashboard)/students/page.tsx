// 👨‍🎓 STUDENTS PAGE - View student progress, subjects, topics, milestones + notes
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/app/(dashboard)/admin/components/Modal'

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])

  // Filters
  const [filterDivision, setFilterDivision] = useState('')
  const [filterStandard, setFilterStandard] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Student detail modal
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [studentSubjects, setStudentSubjects] = useState<any[]>([])
  const [studentMilestones, setStudentMilestones] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Notes modal
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [noteStudentId, setNoteStudentId] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (!userData) return
      setUser(userData)

      // Load divisions and standards
      const [divRes, stdRes] = await Promise.all([
        supabase.from('divisions').select('*').eq('institution_id', userData.institution_id).order('division_name'),
        supabase.from('standards').select('*').eq('institution_id', userData.institution_id).order('standard_name'),
      ])
      setDivisions(divRes.data || [])
      setStandards(stdRes.data || [])

      // Load students
      let studRes = await supabase.from('students').select('*').eq('institution_id', userData.institution_id).order('full_name')
      if (studRes.error) {
        // Try without order (column might not exist yet)
        studRes = await supabase.from('students').select('*').eq('institution_id', userData.institution_id)
      }
      const studentsData = studRes.data
      const studError = studRes.error

      if (studError) {
        console.error('Students table error:', studError)
        // Table might not exist
        setStudents([])
        setLoading(false)
        return
      }

      if (!studentsData || studentsData.length === 0) {
        setStudents([])
        setLoading(false)
        return
      }

      // Faculty filter: only show students in their assigned divisions
      let visibleDivIds: string[] | null = null
      if (userData.role === 'faculty') {
        const { data: asgn } = await supabase.from('faculty_assignments').select('division_id').eq('faculty_id', userData.id)
        visibleDivIds = Array.from(new Set((asgn || []).map(a => a.division_id)))
      }

      const filtered = visibleDivIds
        ? studentsData.filter(s => visibleDivIds!.includes(s.division_id))
        : studentsData

      // Enrich with division name and normalize column names
      const enriched = filtered.map(s => ({
        ...s,
        full_name: s.full_name || s.name || s.student_name || '',
        division_name: (divRes.data || []).find(d => d.id === s.division_id)?.division_name || '-',
        standard_name: (divRes.data || []).find(d => d.id === s.division_id)?.standard_id
          ? (stdRes.data || []).find(st => st.id === (divRes.data || []).find(d => d.id === s.division_id)?.standard_id)?.standard_name || '-'
          : '-'
      }))

      setStudents(enriched)
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  // View student detail - subjects, topic status, milestones
  const handleViewDetail = async (student: any) => {
    setSelectedStudent(student)
    setShowDetailModal(true)
    setLoadingDetail(true)
    try {
      const div = divisions.find(d => d.id === student.division_id)

      // Get subjects for this division via faculty_assignments
      const { data: asgn } = await supabase.from('faculty_assignments').select('subject_id').eq('division_id', student.division_id)
      const subjectIds = Array.from(new Set((asgn || []).map(a => a.subject_id)))

      if (subjectIds.length === 0) { setStudentSubjects([]); setStudentMilestones([]); setLoadingDetail(false); return }

      // Get subjects
      const { data: subjects } = await supabase.from('subjects').select('*').in('id', subjectIds)

      // For each subject, get topics and completion
      const subjectProgress = await Promise.all(
        (subjects || []).map(async (subj) => {
          const { data: topics } = await supabase.from('topics').select('id, topic_name, topic_number, default_lectures')
            .eq('subject_id', subj.id).eq('standard_id', div?.standard_id).order('topic_number')

          const { data: entries } = await supabase.from('syllabus_entries').select('topic_id, lectures_taken')
            .eq('division_id', student.division_id).eq('subject_id', subj.id)

          const entryMap = new Map<string, number>()
          entries?.forEach(e => entryMap.set(e.topic_id, (entryMap.get(e.topic_id) || 0) + (e.lectures_taken || 0)))

          const topicStatus = (topics || []).map(t => {
            const taken = entryMap.get(t.id) || 0
            return { ...t, taken, status: taken >= (t.default_lectures || 1) ? 'Completed' : taken > 0 ? 'In Progress' : 'Not Started' }
          })

          const completed = topicStatus.filter(t => t.status === 'Completed').length
          return { ...subj, topics: topicStatus, total: topicStatus.length, completed, pct: topicStatus.length > 0 ? Math.round((completed / topicStatus.length) * 100) : 0 }
        })
      )

      setStudentSubjects(subjectProgress)

      // Get milestones
      const { data: milestones } = await supabase.from('milestones').select('*').eq('institution_id', user!.institution_id).order('target_date')
      setStudentMilestones(milestones || [])
    } catch (error) { console.error('Error:', error) }
    finally { setLoadingDetail(false) }
  }

  // Notes/Messaging
  const openNotes = async (studentId: string) => {
    setNoteStudentId(studentId)
    setShowNotesModal(true)
    setNewNote('')
    try {
      const { data } = await supabase.from('student_notes').select('*')
        .eq('student_id', studentId).eq('faculty_id', user!.id)
        .order('created_at', { ascending: true })
      setNotes(data || [])
    } catch {
      setNotes([])
    }
  }

  const sendNote = async () => {
    if (!newNote.trim() || !noteStudentId) return
    setSavingNote(true)
    try {
      const { error } = await supabase.from('student_notes').insert({
        institution_id: user!.institution_id,
        student_id: noteStudentId,
        faculty_id: user!.id,
        subject_id: null,
        note_text: newNote.trim(),
        sent_by: 'faculty',
        is_read: false,
      })
      if (error) throw error
      setNewNote('')
      // Refresh notes
      const { data } = await supabase.from('student_notes').select('*')
        .eq('student_id', noteStudentId).eq('faculty_id', user!.id)
        .order('created_at', { ascending: true })
      setNotes(data || [])
    } catch (error: any) {
      console.error('Error sending note:', error)
      alert('Could not send note. Run SQL_Scripts/UPGRADE_V3.sql to create the student_notes table.')
    } finally { setSavingNote(false) }
  }

  // Filtering
  const filteredStudents = students.filter(s => {
    const matchSearch = !searchTerm || (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.roll_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchDiv = !filterDivision || s.division_id === filterDivision
    const matchStd = !filterStandard || (divisions.find(d => d.id === s.division_id)?.standard_id === filterStandard)
    return matchSearch && matchDiv && matchStd
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Students {user?.role === 'faculty' ? '(My Students)' : ''}</h1>
          <p className="text-slate-400">View student details, subject progress, milestones & send notes</p>
        </div>
        <div className="text-sm text-slate-500">{filteredStudents.length} students found</div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search by name or roll..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white placeholder-slate-500" />
          <select value={filterStandard} onChange={e => { setFilterStandard(e.target.value); setFilterDivision('') }} className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Standards</option>
            {standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}
          </select>
          <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white">
            <option value="">All Divisions</option>
            {divisions.filter(d => !filterStandard || d.standard_id === filterStandard).map(d => <option key={d.id} value={d.id}>{d.division_name}</option>)}
          </select>
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10 bg-white/5">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">#</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Roll No</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Division</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Standard</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Actions</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-4 text-white font-medium">{s.full_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-400">{s.roll_number || '-'}</td>
                    <td className="py-3 px-4 text-slate-300">{s.division_name}</td>
                    <td className="py-3 px-4 text-slate-300">{s.standard_name}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleViewDetail(s)} className="px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg border border-amber-500/30">📊 View Progress</button>
                        {user?.role === 'faculty' && (
                          <button onClick={() => openNotes(s.id)} className="px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg border border-blue-500/30">💬 Notes</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">👨‍🎓</div>
          <h3 className="text-xl font-medium text-white mb-2">No Students Found</h3>
          <p className="text-slate-400 mb-4">Students need to be added first.</p>
          <div className="space-y-2 text-sm text-slate-500">
            <p>1. Run <code className="bg-white/10 px-2 py-0.5 rounded text-amber-400">SQL_Scripts/UPGRADE_V4.sql</code> in Supabase SQL Editor to create the students table</p>
            <p>2. Add students via System Setup → Student Management or bulk upload</p>
            <p>3. Make sure each student has a <code className="bg-white/10 px-2 py-0.5 rounded text-amber-400">division_id</code> assigned</p>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`${selectedStudent?.full_name || 'Student'} — Progress`} size="lg">
        {loadingDetail ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div></div>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Student info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Division</p><p className="text-white">{selectedStudent?.division_name}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Roll No</p><p className="text-white">{selectedStudent?.roll_number || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Standard</p><p className="text-white">{selectedStudent?.standard_name || '-'}</p></div>
            </div>

            {/* Subject progress */}
            <div>
              <h4 className="text-white font-semibold mb-3">📚 Subject Progress</h4>
              {studentSubjects.length > 0 ? (
                <div className="space-y-3">
                  {studentSubjects.map((subj, i) => (
                    <details key={i} className="bg-white/5 rounded-lg border border-white/10">
                      <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
                        <div>
                          <span className="text-white font-medium">{subj.subject_name}</span>
                          <span className="text-xs text-slate-500 ml-2">({subj.subject_code})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-700 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${subj.pct}%` }} /></div>
                          <span className={`text-sm font-bold ${subj.pct >= 75 ? 'text-emerald-400' : subj.pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{subj.pct}%</span>
                        </div>
                      </summary>
                      <div className="px-4 pb-3 border-t border-white/5">
                        <table className="w-full mt-2 text-sm">
                          <thead><tr className="text-slate-500 text-xs"><th className="text-left py-1">#</th><th className="text-left py-1">Topic</th><th className="text-center py-1">Allotted</th><th className="text-center py-1">Taken</th><th className="text-center py-1">Status</th></tr></thead>
                          <tbody>
                            {subj.topics?.map((t: any, j: number) => (
                              <tr key={j} className="border-t border-white/5">
                                <td className="py-1 text-slate-500">{t.topic_number}</td>
                                <td className="py-1 text-white">{t.topic_name}</td>
                                <td className="py-1 text-center text-slate-400">{t.default_lectures}</td>
                                <td className="py-1 text-center text-slate-300">{t.taken || 0}</td>
                                <td className="py-1 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : t.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{t.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-xs text-slate-500 mt-2">{subj.completed}/{subj.total} topics completed</p>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No subjects found for this student's division</p>
              )}
            </div>

            {/* Milestones */}
            {studentMilestones.length > 0 && (
              <div>
                <h4 className="text-white font-semibold mb-3">🎯 Milestones</h4>
                <div className="space-y-2">
                  {studentMilestones.map((m, i) => {
                    const isPast = new Date(m.target_date) < new Date()
                    return (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${isPast ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                        <div>
                          <p className="text-white text-sm font-medium">{m.milestone_name || m.title}</p>
                          <p className="text-xs text-slate-500">{m.description || ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-300">{m.target_date ? new Date(m.target_date).toLocaleDateString('en-IN') : '-'}</p>
                          <span className={`text-xs ${isPast ? 'text-emerald-400' : 'text-amber-400'}`}>{isPast ? 'Past' : 'Upcoming'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Notes/Messaging Modal */}
      <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="💬 Notes & Messages" size="md">
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto space-y-2">
            {notes.length > 0 ? notes.map((n, i) => (
              <div key={i} className={`p-3 rounded-lg ${n.sent_by === 'faculty' ? 'bg-blue-500/10 border border-blue-500/20 ml-4' : 'bg-white/5 border border-white/10 mr-4'}`}>
                <p className="text-white text-sm">{n.note_text}</p>
                <p className="text-xs text-slate-500 mt-1">{n.sent_by === 'faculty' ? 'You' : 'Student'} • {new Date(n.created_at).toLocaleString('en-IN')}</p>
              </div>
            )) : (
              <p className="text-slate-400 text-sm text-center py-4">No notes yet. Send the first one!</p>
            )}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Type a note..."
              onKeyDown={e => e.key === 'Enter' && sendNote()}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm placeholder-slate-500" />
            <button onClick={sendNote} disabled={savingNote || !newNote.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
              {savingNote ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
