// ✅ MY PROGRESS PAGE - FACULTY DASHBOARD
// Shows personal teaching progress across all subjects
// app/(dashboard)/progress/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function MyProgressPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [progressData, setProgressData] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchProgress()
  }, [])

  const fetchProgress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!userData) return

      setCurrentUser(userData)
      console.log('👤 Current user:', userData.full_name, '(Faculty)')

      // Get current academic year
      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      if (!yearData) {
        setLoading(false)
        return
      }

      // Get my assignments
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('division_id, subject_id')
        .eq('faculty_id', session.user.id)

      console.log('📚 My assignments:', assignments?.length)

      if (!assignments || assignments.length === 0) {
        setProgressData({
          totalSubjects: 0,
          totalTopics: 0,
          completedTopics: 0,
          remainingTopics: 0,
          totalLectures: 0,
          completionPercentage: 0,
          subjects: []
        })
        setLoading(false)
        return
      }

      // Get unique subjects
      const subjectIds = Array.from(new Set(assignments.map(a => a.subject_id)))
      
      // Get subject details
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, subject_name, subject_code')
        .in('id', subjectIds)

      console.log('📖 Subjects:', subjects?.length)

      // Get all topics for my subjects
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id, subject_id, topic_name, topic_number')
        .in('subject_id', subjectIds)

      const totalTopics = allTopics?.length || 0
      console.log('📝 Total topics:', totalTopics)

      // Get my syllabus entries
      const { data: myEntries } = await supabase
        .from('syllabus_entries')
        .select('topic_id, division_id, lectures_taken, teaching_date')
        .eq('faculty_id', session.user.id)
        .gte('lectures_taken', 0.5)

      console.log('✍️ My entries:', myEntries?.length)

      // Count DISTINCT completed topics
      const completedTopicSet = new Set<string>()
      let totalLectures = 0

      myEntries?.forEach(entry => {
        if (entry.lectures_taken >= 1) {
          completedTopicSet.add(entry.topic_id)
        }
        totalLectures += entry.lectures_taken
      })

      const completedTopics = completedTopicSet.size
      const remainingTopics = totalTopics - completedTopics
      const completionPercentage = totalTopics > 0 
        ? Math.round((completedTopics / totalTopics) * 100)
        : 0

      console.log('✅ Completed topics:', completedTopics)
      console.log('📊 Completion:', completionPercentage + '%')

      // Calculate subject-wise progress
      const subjectProgress = await Promise.all(
        (subjects || []).map(async (subject) => {
          // Get topics for this subject
          const subjectTopics = allTopics?.filter(t => t.subject_id === subject.id) || []
          const subjectTopicCount = subjectTopics.length

          // Count completed topics for this subject
          let subjectCompletedSet = new Set<string>()
          let subjectLectures = 0

          myEntries?.forEach(entry => {
            const topic = subjectTopics.find(t => t.id === entry.topic_id)
            if (topic) {
              if (entry.lectures_taken >= 1) {
                subjectCompletedSet.add(entry.topic_id)
              }
              subjectLectures += entry.lectures_taken
            }
          })

          const subjectCompleted = subjectCompletedSet.size
          const subjectRemaining = subjectTopicCount - subjectCompleted
          const subjectPercentage = subjectTopicCount > 0 
            ? Math.round((subjectCompleted / subjectTopicCount) * 100)
            : 0

          // Get divisions I teach this subject in
          const subjectAssignments = assignments.filter(a => a.subject_id === subject.id)
          const divisionIds = subjectAssignments.map(a => a.division_id)

          const { data: divisions } = await supabase
            .from('divisions')
            .select('id, division_name')
            .in('id', divisionIds)

          return {
            subject_name: subject.subject_name,
            subject_code: subject.subject_code,
            total_topics: subjectTopicCount,
            completed_topics: subjectCompleted,
            remaining_topics: subjectRemaining,
            completion_percentage: subjectPercentage,
            total_lectures: Math.round(subjectLectures * 10) / 10,
            divisions: divisions || []
          }
        })
      )

      // Sort by completion percentage (lowest first - needs attention)
      subjectProgress.sort((a, b) => a.completion_percentage - b.completion_percentage)

      setProgressData({
        totalSubjects: subjects?.length || 0,
        totalTopics,
        completedTopics,
        remainingTopics,
        totalLectures: Math.round(totalLectures * 10) / 10,
        completionPercentage,
        subjects: subjectProgress
      })

    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  if (!academicYear) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-400">No active academic year found. Please contact admin.</p>
        </div>
      </div>
    )
  }

  if (!progressData) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-gray-400">Unable to load progress data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Progress</h1>
        <p className="text-gray-400">Track teaching progress across all subjects</p>
      </div>

      {/* Overall Progress Card */}
      <div className="mb-8 bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-white mb-6">Overall Progress</h2>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm mb-1">
              {progressData.completedTopics} of {progressData.totalTopics} topics completed across {progressData.totalSubjects} subjects
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-white mb-1">
              {progressData.completionPercentage}%
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-4 mb-8">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-4 rounded-full transition-all"
            style={{ width: `${progressData.completionPercentage}%` }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            value={progressData.totalSubjects}
            label="Subjects"
            icon="📚"
            color="bg-gray-700"
          />
          <StatCard
            value={progressData.completedTopics}
            label="Completed"
            icon="✅"
            color="bg-green-500/20"
          />
          <StatCard
            value={progressData.remainingTopics}
            label="Remaining"
            icon="⏳"
            color="bg-amber-500/20"
          />
          <StatCard
            value={progressData.totalLectures}
            label="Lectures Taken"
            icon="🎓"
            color="bg-blue-500/20"
          />
        </div>
      </div>

      {/* Subject-wise Progress */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Subject-wise Progress</h2>

        {progressData.subjects.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-400 text-lg mb-2">No subjects assigned yet</p>
            <p className="text-sm text-gray-500">Contact admin to assign subjects</p>
          </div>
        ) : (
          <div className="space-y-4">
            {progressData.subjects.map((subject: any, idx: number) => (
              <SubjectCard key={idx} subject={subject} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/entries"
          className="flex-1 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl transition text-center"
        >
          ➕ Add New Entry
        </Link>
        <Link
          href="/milestones"
          className="flex-1 px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition text-center"
        >
          📅 View Milestones
        </Link>
      </div>
    </div>
  )
}

function StatCard({ value, label, icon, color }: any) {
  return (
    <div className={`${color} border border-gray-600 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-3xl">{icon}</div>
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

function SubjectCard({ subject }: any) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">
            {subject.subject_name}
          </h3>
          <p className="text-sm text-gray-400">
            {subject.divisions.map((d: any) => d.division_name).join(', ')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white mb-1">
            {subject.completion_percentage}%
          </div>
          <div className="text-xs text-gray-400">
            {subject.completed_topics}/{subject.total_topics} topics
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
        <div
          className={`h-3 rounded-full transition-all ${
            subject.completion_percentage === 100
              ? 'bg-green-500'
              : subject.completion_percentage >= 75
              ? 'bg-blue-500'
              : subject.completion_percentage >= 50
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${subject.completion_percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">{subject.completed_topics}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-400">{subject.remaining_topics}</div>
          <div className="text-xs text-gray-500">Remaining</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">{subject.total_lectures}</div>
          <div className="text-xs text-gray-500">Lectures</div>
        </div>
      </div>
    </div>
  )
}
