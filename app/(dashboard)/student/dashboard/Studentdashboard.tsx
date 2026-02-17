// 🎓 STUDENT DASHBOARD - Syllabus Progress Overview
// Shows division subjects, progress, milestones based on student's division
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
  const [overallProgress, setOverallProgress] = useState({ total: 0, completed: 0, pct: 0 })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const session = localStorage.getItem('student_session')
    if (!session) { router.push('/student/login'); return }
    const s = JSON.parse(session)
    setStudent(s)
    fetchDashboard(s)
  }, [])

  const fetchDashboard = async (studentData: any) => {
    try {
      if (!studentData.divisionId) { setLoading(false); return }

      // Get division info
      const { data: divData } = await supabase
        .from('divisions')
        .select('id, division_name, standard_id')
        .eq('id', studentData.divisionId)
        .single()

      if (!divData) { setLoading(false); return }

      // Get faculty assignments for this division
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('subject_id, users(full_name)')
        .eq('division_id', studentData.divisionId)

      // Get all subjects for the institution
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('id, subject_name, subject_code')
        .eq('institution_id', studentData.institutionId)

      // Get all topics for this standard
      const { data: topics } = await supabase
        .from('topics')
        .select('id, topic_name, topic_number, default_lectures, subject_id')
        .eq('standard_id', divData.standard_id)
        .order('topic_number')

      // Get all syllabus entries for this division
      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('*')
        .eq('division_id', studentData.divisionId)

      // Build subject-wise progress
      const subjectMap = new Map<string, any>()
      const subjLookup = new Map((allSubjects || []).map(s => [s.id, s]))
      const assignMap = new Map<string, string>()
      if (assignments) {
        for (const a of assignments) {
          assignMap.set(a.subject_id, (a as any).users?.full_name || '-')
        }
      }

      // Group topics by subject
      if (topics) {
        for (const t of topics) {
          const subj = subjLookup.get(t.subject_id)
          if (!subj) continue
          if (!subjectMap.has(t.subject_id)) {
            subjectMap.set(t.subject_id, {
              id: t.subject_id,
              name: subj.subject_name,
              code: subj.subject_code,
              faculty: assignMap.get(t.subject_id) || '-',
              totalTopics: 0, completedTopics: 0,
              totalLectures: 0, takenLectures: 0,
              topics: [],
            })
          }
          const s = subjectMap.get(t.subject_id)!
          s.totalTopics++
          s.topics.push({
            id: t.id, name: t.topic_name,
            number: t.topic_number,
            defaultLectures: t.default_lectures || 0,
            takenLectures: 0, status: 'Not Started'
          })
        }
      }

      // Calc lectures from entries
      if (entries) {
        for (const e of entries) {
          const s = subjectMap.get(e.subject_id)
          if (!s) continue
          s.totalLectures += e.lectures_allotted || 0
          s.takenLectures += e.lectures_taken || 0
          const topic = s.topics.find((t: any) => t.id === e.topic_id)
          if (topic) {
            topic.takenLectures += e.lectures_taken || 0
            topic.status = (e.lectures_taken >= e.lectures_allotted) ? 'Completed' : 'In Progress'
          }
        }
      }

      // Finalize
      let totalT = 0, completedT = 0
      const subjectList: any[] = []
      subjectMap.forEach(s => {
        s.completedTopics = s.topics.filter((t: any) => t.status === 'Completed').length
        s.pct = s.totalTopics > 0 ? Math.round((s.completedTopics / s.totalTopics) * 100) : 0
        totalT += s.totalTopics; completedT += s.completedTopics
        subjectList.push(s)
      })
      subjectList.sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(subjectList)
      setOverallProgress({ total: totalT, completed: completedT, pct: totalT > 0 ? Math.round((completedT / totalT) * 100) : 0 })

      // Milestones
      try {
        const { data: mData } = await supabase.from('milestones')
          .select('*').eq('is_active', true)
          .gte('milestone_date', new Date().toISOString().split('T')[0])
          .order('milestone_date').limit(5)
        setMilestones(mData || [])
      } catch {}

    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const viewSubjectTopics = (subjectId: string) => {
    if (selectedSubject === subjectId) { setSelectedSubject(''); setTopicDetails([]); return }
    const subj = subjects.find(s => s.id === subjectId)
    if (subj) {
      setSelectedSubject(subjectId)
      setTopicDetails(subj.topics.sort((a: any, b: any) => (a.number || 0) - (b.number || 0)))
    }
  }

  const handleLogout = () => { localStorage.removeItem('student_session'); router.push('/student/login') }

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
            <div className="text-3xl">🎓</div>
            <div>
              <h1 className="text-lg font-bold text-white">{student?.name || 'Student'}</h1>
              <p className="text-xs text-slate-400">{student?.division || ''} {student?.institution ? `• ${student.institution}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:block">GR: {student?.grNumber}</span>
            <button onClick={handleLogout} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Progress */}
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">📊 Overall Syllabus Progress</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{overallProgress.pct}%</div>
              <div className="text-xs text-slate-400 mt-1">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{overallProgress.completed}</div>
              <div className="text-xs text-slate-400 mt-1">Topics Done</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-300">{overallProgress.total}</div>
              <div className="text-xs text-slate-400 mt-1">Total Topics</div>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className="h-3 rounded-full transition-all bg-gradient-to-r from-amber-500 to-emerald-500" style={{ width: `${Math.min(overallProgress.pct, 100)}%` }} />
          </div>
        </div>

        {/* Subjects */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">📚 Subjects</h2>
          {subjects.length === 0 ? (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-slate-400">No subject data found for your division.</p>
              <p className="text-xs text-slate-500 mt-2">Your faculty will update the syllabus progress.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map(s => (
                <div key={s.id} className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-white/5 transition" onClick={() => viewSubjectTopics(s.id)}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white">{s.name}</h3>
                        <p className="text-xs text-slate-400">{s.code} • {s.faculty}</p>
                      </div>
                      <div className={`text-2xl font-bold ${s.pct >= 80 ? 'text-emerald-400' : s.pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.pct}%
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full transition-all ${s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{s.completedTopics}/{s.totalTopics} topics</span>
                      <span>{s.takenLectures}/{s.totalLectures} lectures</span>
                    </div>
                  </div>
                  {selectedSubject === s.id && topicDetails.length > 0 && (
                    <div className="border-t border-white/10 bg-slate-900/50 max-h-64 overflow-y-auto">
                      {topicDetails.map((t: any, i: number) => (
                        <div key={t.id || i} className="flex items-center justify-between px-4 py-2 border-b border-white/5 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-500 mr-2">{t.number || (i+1)}.</span>
                            <span className="text-sm text-slate-300">{t.name}</span>
                          </div>
                          <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-medium border ${
                            t.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            t.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                            'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4">🎯 Upcoming Milestones</h2>
            <div className="space-y-3">
              {milestones.map((m, i) => {
                const daysLeft = Math.ceil((new Date(m.milestone_date).getTime() - Date.now()) / (86400000))
                return (
                  <div key={m.id || i} className="bg-slate-800/50 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                    <div className="text-3xl">{daysLeft <= 7 ? '🔴' : daysLeft <= 30 ? '🟡' : '🟢'}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{m.milestone_name}</h3>
                      <p className="text-xs text-slate-400">{new Date(m.milestone_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>{daysLeft}</div>
                      <div className="text-[10px] text-slate-500">days left</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Division:</span><span className="text-white ml-2">{student?.division || '-'}</span></div>
            <div><span className="text-slate-500">GR Number:</span><span className="text-amber-400 ml-2 font-mono">{student?.grNumber || '-'}</span></div>
            <div><span className="text-slate-500">Institution:</span><span className="text-white ml-2">{student?.institution || '-'}</span></div>
            <div><span className="text-slate-500">Login:</span><span className="text-slate-300 ml-2">{student?.loginTime ? new Date(student.loginTime).toLocaleString('en-IN') : '-'}</span></div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-600 border-t border-white/5 mt-8">
        EduTrack Student Portal • {student?.institution || ''}
      </footer>
    </div>
  )
}
