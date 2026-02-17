// 🎓 STUDENT DASHBOARD - Standalone (no admin layout)
// Shows ONLY subjects assigned to student's division with real progress
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [topicDetails, setTopicDetails] = useState<any[]>([])
  const [expandedMilestone, setExpandedMilestone] = useState<string>('')
  const [overall, setOverall] = useState({ total: 0, completed: 0, pct: 0 })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const session = localStorage.getItem('student_session')
    if (!session) { router.push('/student-portal/login'); return }
    const s = JSON.parse(session)
    setStudent(s)
    fetchDashboard(s)
  }, [])

  const fetchDashboard = async (stu: any) => {
    try {
      if (!stu.divisionId) { setLoading(false); return }

      // 1. Get division → standard_id
      const { data: divData } = await supabase
        .from('divisions')
        .select('id, division_name, standard_id')
        .eq('id', stu.divisionId)
        .single()
      if (!divData?.standard_id) { setLoading(false); return }

      console.log('📋 Student division:', divData.division_name, 'standard:', divData.standard_id)

      // 2. Get subjects assigned to THIS division
      //    Priority: division_subjects table → syllabus_entries → faculty_assignments
      let assignedSubjectIds: string[] = []
      const facultyMap = new Map<string, string>()

      // Try division_subjects first (Subject Allocation in System Setup)
      try {
        const { data: divSubjects } = await supabase
          .from('division_subjects')
          .select('subject_id')
          .eq('division_id', stu.divisionId)
          .eq('is_active', true)
        if (divSubjects && divSubjects.length > 0) {
          assignedSubjectIds = Array.from(new Set(divSubjects.map(ds => ds.subject_id)))
          console.log('📋 Source: division_subjects →', assignedSubjectIds.length, 'subjects')
        }
      } catch { /* table may not exist yet */ }

      // Fallback: syllabus_entries (topics already being taught)
      if (assignedSubjectIds.length === 0) {
        const { data: entrySubjects } = await supabase
          .from('syllabus_entries')
          .select('subject_id')
          .eq('division_id', stu.divisionId)
        if (entrySubjects && entrySubjects.length > 0) {
          assignedSubjectIds = Array.from(new Set(entrySubjects.map(e => e.subject_id)))
          console.log('📋 Source: syllabus_entries →', assignedSubjectIds.length, 'subjects')
        }
      }

      // Fallback: faculty_assignments
      if (assignedSubjectIds.length === 0) {
        const { data: assignments } = await supabase
          .from('faculty_assignments')
          .select('subject_id')
          .eq('division_id', stu.divisionId)
        if (assignments && assignments.length > 0) {
          assignedSubjectIds = Array.from(new Set(assignments.map(a => a.subject_id)))
          console.log('📋 Source: faculty_assignments →', assignedSubjectIds.length, 'subjects')
        }
      }

      // Get faculty names for display (no FK join - query separately)
      try {
        const { data: assignments } = await supabase
          .from('faculty_assignments')
          .select('subject_id, faculty_id')
          .eq('division_id', stu.divisionId)
        if (assignments && assignments.length > 0) {
          const facultyIds = Array.from(new Set(assignments.map(a => a.faculty_id)))
          const { data: facultyUsers } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', facultyIds)
          const userMap = new Map((facultyUsers || []).map(u => [u.id, u.full_name]))
          for (const a of assignments) {
            if (!facultyMap.has(a.subject_id)) {
              facultyMap.set(a.subject_id, userMap.get(a.faculty_id) || '-')
            }
          }
        }
      } catch {}

      if (assignedSubjectIds.length === 0) {
        setSubjects([])
        setOverall({ total: 0, completed: 0, pct: 0 })
        setLoading(false)
        return
      }

      const assignedSet = new Set(assignedSubjectIds)

      // 3. Get subject details for assigned subjects ONLY
      let subjectData: any[] = []
      // Fetch all subjects for institution to avoid .in() URL issues
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('id, subject_name, subject_code')
        .eq('institution_id', stu.institutionId)
      subjectData = (allSubjects || []).filter(s => assignedSet.has(s.id))

      const subjLookup = new Map(subjectData.map(s => [s.id, s]))

      // 4. Get topics for assigned subjects - ONLY for student's standard (XII not XI)
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id, topic_name, topic_number, default_lectures, subject_id, standard_id')
        .eq('standard_id', divData.standard_id)
        .order('topic_number')
      const topicsData = (allTopics || []).filter(t => assignedSet.has(t.subject_id))

      console.log('📋 Topics for assigned subjects:', topicsData?.length)

      // 5. Get ALL syllabus entries for THIS division
      const { data: allEntries, error: entriesError } = await supabase
        .from('syllabus_entries')
        .select('topic_id, subject_id, lectures_taken, status, completion_percentage')
        .eq('division_id', stu.divisionId)

      if (entriesError) {
        console.warn('📋 Entries query error:', entriesError.message)
      }
      // Filter to assigned subjects client-side
      const entriesData = (allEntries || []).filter(e => assignedSet.has(e.subject_id))
      console.log('📋 Entries for division:', allEntries?.length, '→ filtered:', entriesData.length)

      // 6. Build progress per subject
      const subjectMap = new Map<string, any>()

      // Initialize subjects from assignments
      for (const subjId of assignedSubjectIds) {
        const subj = subjLookup.get(subjId)
        if (!subj) continue
        subjectMap.set(subjId, {
          id: subjId,
          name: subj.subject_name,
          code: subj.subject_code,
          faculty: facultyMap.get(subjId) || '-',
          totalTopics: 0,
          completedTopics: 0,
          totalLectures: 0,
          takenLectures: 0,
          pct: 0,
          topics: [],
        })
      }

      // Add topics to subjects
      for (const t of (topicsData || [])) {
        const s = subjectMap.get(t.subject_id)
        if (!s) continue
        s.totalTopics++
        s.topics.push({
          id: t.id,
          name: t.topic_name,
          number: t.topic_number,
          defaultLectures: t.default_lectures || 0,
          takenLectures: 0,
          allottedLectures: 0,
          status: 'Not Started',
        })
      }

      // Apply entry data (use default_lectures from topics, lectures_taken from entries)
      // Build topic lookup for default_lectures
      const topicLookup = new Map((topicsData || []).map(t => [t.id, t.default_lectures || 0]))

      for (const e of (entriesData || [])) {
        const s = subjectMap.get(e.subject_id)
        if (!s) continue
        const defaultL = topicLookup.get(e.topic_id) || 0
        s.totalLectures += defaultL
        s.takenLectures += e.lectures_taken || 0

        const topic = s.topics.find((t: any) => t.id === e.topic_id)
        if (topic) {
          topic.takenLectures += e.lectures_taken || 0
          // Use status from entry if available, else calculate
          if (e.status === 'completed' || (e.lectures_taken > 0 && e.lectures_taken >= topic.defaultLectures)) {
            topic.status = 'Completed'
          } else if (e.lectures_taken > 0 || e.status === 'in_progress') {
            topic.status = 'In Progress'
          }
        }
      }

      // For subjects with no entries yet, count total lectures from default_lectures
      subjectMap.forEach(s => {
        if (s.totalLectures === 0) {
          s.totalLectures = s.topics.reduce((sum: number, t: any) => sum + (t.defaultLectures || 0), 0)
        }
      })

      // Calculate percentages
      let totalT = 0, completedT = 0
      const subjectList: any[] = []
      subjectMap.forEach(s => {
        s.completedTopics = s.topics.filter((t: any) => t.status === 'Completed').length
        const inProgress = s.topics.filter((t: any) => t.status === 'In Progress').length
        // Use weighted: completed = 100%, in-progress = partial
        const pctFromTopics = s.totalTopics > 0
          ? Math.round(((s.completedTopics + inProgress * 0.5) / s.totalTopics) * 100)
          : 0
        s.pct = Math.min(pctFromTopics, 100)
        totalT += s.totalTopics
        completedT += s.completedTopics
        subjectList.push(s)
      })

      subjectList.sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(subjectList)
      setOverall({
        total: totalT,
        completed: completedT,
        pct: totalT > 0 ? Math.round((completedT / totalT) * 100) : 0,
      })

      // 7. Milestones with topic details
      try {
        const today = new Date().toISOString().split('T')[0]
        // Fetch upcoming milestones
        const { data: m1, error: e1 } = await supabase
          .from('exam_milestones')
          .select('*')
          .eq('is_active', true)
          .gte('milestone_date', today)
          .order('milestone_date')
          .limit(10)
        
        let mData = (!e1 && m1) ? m1 : []
        if (mData.length === 0) {
          const { data: m2 } = await supabase
            .from('milestones')
            .select('*')
            .eq('is_active', true)
            .gte('milestone_date', today)
            .order('milestone_date')
            .limit(10)
          mData = m2 || []
        }

        // Fetch milestone_topics for student's division
        if (mData.length > 0) {
          const milestoneIds = mData.map(m => m.id)
          try {
            const { data: mtData } = await supabase
              .from('milestone_topics')
              .select('milestone_id, topic_id, subject_id')
              .eq('division_id', stu.divisionId)
            
            if (mtData && mtData.length > 0) {
              // Group topics by milestone → subject
              const topicById = new Map((topicsData || []).map(t => [t.id, t]))
              
              for (const m of mData) {
                const mTopics = mtData.filter(mt => mt.milestone_id === m.id)
                // Group by subject
                const subjGroups = new Map<string, any[]>()
                for (const mt of mTopics) {
                  if (!subjGroups.has(mt.subject_id)) subjGroups.set(mt.subject_id, [])
                  const topic = topicById.get(mt.topic_id)
                  if (topic) {
                    subjGroups.get(mt.subject_id)!.push(topic)
                  }
                }
                // Convert to array with subject names
                m._subjectTopics = Array.from(subjGroups.entries()).map(([subjId, topics]) => ({
                  subjectId: subjId,
                  subjectName: subjLookup.get(subjId)?.subject_name || subjId,
                  subjectCode: subjLookup.get(subjId)?.subject_code || '',
                  topics: topics.sort((a: any, b: any) => (a.topic_number || 0) - (b.topic_number || 0)),
                })).sort((a, b) => a.subjectName.localeCompare(b.subjectName))
                m._totalTopics = mTopics.length
              }
            }
          } catch { /* milestone_topics may not exist */ }
        }

        setMilestones(mData)
      } catch {}

    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleTopics = (subjectId: string) => {
    if (selectedSubject === subjectId) {
      setSelectedSubject('')
      setTopicDetails([])
    } else {
      const subj = subjects.find(s => s.id === subjectId)
      if (subj) {
        setSelectedSubject(subjectId)
        setTopicDetails(subj.topics.sort((a: any, b: any) => (a.number || 0) - (b.number || 0)))
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('student_session')
    router.push('/student-portal/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {student?.logoUrl ? (
              <img src={student.logoUrl} alt="" className="w-10 h-10 object-contain rounded-lg" />
            ) : (
              <div className="text-3xl">🎓</div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{student?.name || 'Student'}</h1>
              <p className="text-xs text-slate-400">
                {student?.division || ''} {student?.institution ? `• ${student.institution}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:block">GR: {student?.grNumber}</span>
            <button onClick={handleLogout}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Progress */}
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">📊 Overall Syllabus Progress</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{overall.pct}%</div>
              <div className="text-xs text-slate-400 mt-1">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{overall.completed}</div>
              <div className="text-xs text-slate-400 mt-1">Topics Done</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-300">{overall.total}</div>
              <div className="text-xs text-slate-400 mt-1">Total Topics</div>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className="h-3 rounded-full transition-all bg-gradient-to-r from-amber-500 to-emerald-500"
              style={{ width: `${Math.min(overall.pct, 100)}%` }} />
          </div>
        </div>

        {/* Subjects */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">📚 My Subjects ({subjects.length})</h2>
          {subjects.length === 0 ? (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-slate-400">No subjects assigned to your division yet.</p>
              <p className="text-xs text-slate-500 mt-2">Faculty assignments will appear here once set up.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map(s => (
                <div key={s.id} className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-white/5 transition" onClick={() => toggleTopics(s.id)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <h3 className="font-bold text-white truncate">{s.name}</h3>
                        <p className="text-xs text-slate-400">{s.code} • {s.faculty}</p>
                      </div>
                      <div className={`text-2xl font-bold shrink-0 ${s.pct >= 80 ? 'text-emerald-400' : s.pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.pct}%
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full transition-all ${s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{s.completedTopics}/{s.totalTopics} topics</span>
                      <span>{s.takenLectures}/{s.totalLectures} lectures</span>
                      <span className="text-slate-600">{selectedSubject === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded topic list */}
                  {selectedSubject === s.id && topicDetails.length > 0 && (
                    <div className="border-t border-white/10 bg-slate-900/50 max-h-72 overflow-y-auto">
                      <div className="px-4 py-2 bg-slate-800/50 border-b border-white/5 flex text-[10px] text-slate-500 uppercase font-semibold">
                        <div className="flex-1">Topic</div>
                        <div className="w-20 text-center">Lectures</div>
                        <div className="w-20 text-right">Status</div>
                      </div>
                      {topicDetails.map((t: any, i: number) => (
                        <div key={t.id || i} className="flex items-center px-4 py-2 border-b border-white/5 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-500 mr-2">{t.number || (i+1)}.</span>
                            <span className="text-sm text-slate-300">{t.name}</span>
                          </div>
                          <div className="w-20 text-center text-xs text-slate-400">
                            {t.takenLectures}/{t.allottedLectures || t.defaultLectures}
                          </div>
                          <div className="w-20 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              t.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              t.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                              {t.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Milestones / Exam Preparation */}
        {milestones.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4">🎯 Upcoming Exams & Milestones</h2>
            <div className="space-y-4">
              {milestones.map((m, i) => {
                const daysLeft = Math.ceil((new Date(m.milestone_date).getTime() - Date.now()) / 86400000)
                const isExpanded = expandedMilestone === m.id
                const hasTopics = m._subjectTopics && m._subjectTopics.length > 0
                return (
                  <div key={m.id || i} className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                    {/* Milestone header */}
                    <div
                      className={`p-4 flex items-center gap-4 ${hasTopics ? 'cursor-pointer hover:bg-white/5' : ''}`}
                      onClick={() => hasTopics && setExpandedMilestone(isExpanded ? '' : m.id)}
                    >
                      <div className="text-3xl">{daysLeft <= 7 ? '🔴' : daysLeft <= 30 ? '🟡' : '🟢'}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{m.milestone_name}</h3>
                        <p className="text-xs text-slate-400">
                          {new Date(m.milestone_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                          {m.description && <span className="ml-2 text-slate-500">— {m.description}</span>}
                        </p>
                        {hasTopics && (
                          <p className="text-xs text-amber-400/70 mt-1">
                            📖 {m._totalTopics} topics across {m._subjectTopics.length} subjects
                            <span className="text-slate-600 ml-2">{isExpanded ? '▲ collapse' : '▼ view syllabus'}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>{daysLeft}</div>
                        <div className="text-[10px] text-slate-500">days left</div>
                      </div>
                    </div>

                    {/* Expanded: topics per subject */}
                    {isExpanded && hasTopics && (
                      <div className="border-t border-white/10 bg-slate-900/50">
                        {m._subjectTopics.map((sg: any, si: number) => (
                          <div key={sg.subjectId || si} className="border-b border-white/5 last:border-0">
                            <div className="px-4 py-2 bg-slate-800/40 flex items-center justify-between">
                              <span className="text-sm font-semibold text-amber-400">{sg.subjectName}</span>
                              <span className="text-xs text-slate-500">{sg.subjectCode} • {sg.topics.length} topics</span>
                            </div>
                            <div className="px-4 py-1">
                              {sg.topics.map((t: any, ti: number) => {
                                // Check if this topic has progress
                                const subj = subjects.find(s => s.id === sg.subjectId)
                                const topicProgress = subj?.topics?.find((st: any) => st.id === t.id)
                                const isDone = topicProgress?.status === 'Completed'
                                const inProg = topicProgress?.status === 'In Progress'
                                return (
                                  <div key={t.id || ti} className="flex items-center py-1.5 text-sm border-b border-white/5 last:border-0">
                                    <span className="text-xs text-slate-600 w-8">{t.topic_number || (ti+1)}.</span>
                                    <span className={`flex-1 ${isDone ? 'text-emerald-400 line-through opacity-70' : inProg ? 'text-amber-300' : 'text-slate-300'}`}>
                                      {t.topic_name}
                                    </span>
                                    <span className="text-xs ml-2">
                                      {isDone ? '✅' : inProg ? '🔄' : '📝'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Student Info */}
        <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Division:</span> <span className="text-white">{student?.division || '-'}</span></div>
            <div><span className="text-slate-500">GR Number:</span> <span className="text-amber-400 font-mono">{student?.grNumber || '-'}</span></div>
            <div><span className="text-slate-500">Institution:</span> <span className="text-white">{student?.institution || '-'}</span></div>
            <div><span className="text-slate-500">Login:</span> <span className="text-slate-300">{student?.loginTime ? new Date(student.loginTime).toLocaleString('en-IN') : '-'}</span></div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-600 border-t border-white/5 mt-8">
        EduTrack Student Portal • {student?.institution || ''}
      </footer>
    </div>
  )
}
