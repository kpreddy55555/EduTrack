// 🎯 MILESTONES VIEW PAGE - Faculty Exam Targets
// View milestones, see assigned topics, track completion status

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function MilestonesPage() {
  const [loading, setLoading] = useState(true)
  const [facultyId, setFacultyId] = useState('')
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null)
  const [milestoneDetails, setMilestoneDetails] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchMilestones()
  }, [])

  const fetchMilestones = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setFacultyId(session.user.id)

      const { data: userData } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) return

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

      const { data: milestonesData } = await supabase
        .from('exam_milestones')
        .select('*')
        .eq('academic_year_id', yearData.id)
        .eq('is_active', true)
        .order('milestone_date')

      const milestonesWithProgress = await Promise.all(
        (milestonesData || []).map(async (milestone) => {
          const { data: assignments } = await supabase
            .from('faculty_assignments')
            .select('division_id, subject_id')
            .eq('faculty_id', session.user.id)
            .eq('academic_year_id', yearData.id)

          let totalTopics = 0
          let completedTopics = 0

          for (const assignment of assignments || []) {
            const { data: milestoneTopics } = await supabase
              .from('milestone_topics')
              .select('topic_id')
              .eq('milestone_id', milestone.id)
              .eq('division_id', assignment.division_id)
              .eq('subject_id', assignment.subject_id)

            totalTopics += milestoneTopics?.length || 0

            for (const mt of milestoneTopics || []) {
              const { data: entry } = await supabase
                .from('syllabus_entries')
                .select('id')
                .eq('faculty_id', session.user.id)
                .eq('topic_id', mt.topic_id)
                .eq('division_id', assignment.division_id)
                .gte('lectures_taken', 1)
                .single()

              if (entry) completedTopics++
            }
          }

          const isPast = new Date(milestone.milestone_date) < new Date()
          const daysUntil = Math.ceil(
            (new Date(milestone.milestone_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          )

          const completionPercentage = totalTopics > 0 
            ? Math.round((completedTopics / totalTopics) * 100)
            : 0

          return {
            ...milestone,
            totalTopics,
            completedTopics,
            completionPercentage,
            isPast,
            daysUntil,
          }
        })
      )

      setMilestones(milestonesWithProgress)

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const openMilestoneDetails = async (milestone: any) => {
    setSelectedMilestone(milestone)
    setShowDetailsModal(true)

    try {
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select(`
          division_id,
          subject_id,
          divisions(division_name, standard_id),
          subjects(subject_name, subject_code)
        `)
        .eq('faculty_id', facultyId)
        .eq('academic_year_id', academicYear.id)

      const details: any[] = []

      for (const assignment of assignments || []) {
        const { data: milestoneTopics } = await supabase
          .from('milestone_topics')
          .select('topic_id')
          .eq('milestone_id', milestone.id)
          .eq('division_id', assignment.division_id)
          .eq('subject_id', assignment.subject_id)

        if (!milestoneTopics || milestoneTopics.length === 0) continue

        const topicIds = milestoneTopics.map(mt => mt.topic_id)
        const { data: topics } = await supabase
          .from('topics')
          .select('*')
          .in('id', topicIds)
          .order('topic_number')

        const topicsWithStatus = await Promise.all(
          (topics || []).map(async (topic) => {
            const { data: entry } = await supabase
              .from('syllabus_entries')
              .select('lectures_taken, teaching_date, remarks')
              .eq('faculty_id', facultyId)
              .eq('topic_id', topic.id)
              .eq('division_id', assignment.division_id)
              .order('teaching_date', { ascending: false })
              .limit(1)
              .single()

            return {
              ...topic,
              isCompleted: !!entry && entry.lectures_taken > 0,
              lecturesCompleted: entry?.lectures_taken || 0,
              lastDate: entry?.teaching_date,
              lastRemarks: entry?.remarks,
            }
          })
        )

        const completedCount = topicsWithStatus.filter(t => t.isCompleted).length
        const completionPercent = Math.round((completedCount / topicsWithStatus.length) * 100)

        details.push({
          division: assignment.divisions,
          subject: assignment.subjects,
          topics: topicsWithStatus,
          totalTopics: topicsWithStatus.length,
          completedTopics: completedCount,
          completionPercentage: completionPercent,
        })
      }

      setMilestoneDetails(details)

    } catch (error) {
      console.error('Error:', error)
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

  const upcomingMilestones = milestones.filter(m => !m.isPast)
  const pastMilestones = milestones.filter(m => m.isPast)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Exam Milestones</h1>
        <p className="text-slate-400">Track topics to complete for upcoming exams</p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-1">About Milestones</div>
            <p className="text-sm text-slate-400">
              Milestones show which topics need to be completed by specific exam dates. 
              Click on any milestone to see your assigned topics and completion status.
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Upcoming Milestones</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {upcomingMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`border rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.02] ${
                  milestone.daysUntil <= 7
                    ? 'bg-red-500/10 border-red-500/20'
                    : milestone.daysUntil <= 30
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}
                onClick={() => openMilestoneDetails(milestone)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        milestone.milestone_type === 'exam'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {milestone.milestone_type === 'exam' ? '📝 Exam' : '📅 Monthly'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {milestone.milestone_name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {new Date(milestone.milestone_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${
                      milestone.daysUntil <= 7 ? 'text-red-400' :
                      milestone.daysUntil <= 30 ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {milestone.daysUntil}
                    </div>
                    <div className="text-xs text-slate-400">days left</div>
                  </div>
                </div>

                {milestone.description && (
                  <p className="text-sm text-slate-400 mb-4">{milestone.description}</p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Your Progress</span>
                    <span className="text-white font-semibold">
                      {milestone.completedTopics} / {milestone.totalTopics} topics
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        milestone.completionPercentage >= 100 ? 'bg-emerald-500' :
                        milestone.completionPercentage >= 75 ? 'bg-blue-500' :
                        milestone.completionPercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(milestone.completionPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{milestone.completionPercentage}% complete</span>
                    {milestone.completionPercentage < 100 && (
                      <span>{milestone.totalTopics - milestone.completedTopics} remaining</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <button className="text-sm text-amber-400 hover:text-amber-300 font-medium">
                    View Topics Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingMilestones.length === 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-slate-400">No upcoming milestones scheduled</p>
        </div>
      )}

      {/* Past Milestones */}
      {pastMilestones.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Past Milestones</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="bg-slate-700/30 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => openMilestoneDetails(milestone)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-sm">{milestone.milestone_name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    milestone.completionPercentage === 100
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {milestone.completionPercentage === 100 ? '✓ Done' : `${milestone.completionPercentage}%`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {new Date(milestone.milestone_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
                <div className="text-xs text-slate-500">
                  {milestone.completedTopics} / {milestone.totalTopics} topics completed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestone Details Modal */}
      {showDetailsModal && selectedMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-6xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {selectedMilestone.milestone_name}
                </h2>
                <p className="text-slate-400 text-sm">
                  {new Date(selectedMilestone.milestone_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                  {!selectedMilestone.isPast && (
                    <span className="ml-3">
                      • {selectedMilestone.daysUntil} days {selectedMilestone.daysUntil > 0 ? 'left' : 'overdue'}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Overall Progress */}
            <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Overall Progress</span>
                <span className="text-xl font-bold text-white">
                  {selectedMilestone.completedTopics} / {selectedMilestone.totalTopics} topics
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    selectedMilestone.completionPercentage >= 100 ? 'bg-emerald-500' :
                    selectedMilestone.completionPercentage >= 75 ? 'bg-blue-500' :
                    selectedMilestone.completionPercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(selectedMilestone.completionPercentage, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>{selectedMilestone.completionPercentage}% complete</span>
                <span>{selectedMilestone.totalTopics - selectedMilestone.completedTopics} remaining</span>
              </div>
            </div>

            {/* Topics by Division & Subject */}
            {milestoneDetails && milestoneDetails.length > 0 ? (
              <div className="space-y-6">
                {milestoneDetails.map((detail: any, index: number) => (
                  <div key={index} className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
                    <div className="bg-slate-700/50 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">
                          {detail.division.division_name} - {detail.subject.subject_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {detail.completedTopics} of {detail.totalTopics} topics completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          detail.completionPercentage >= 75 ? 'text-emerald-400' :
                          detail.completionPercentage >= 50 ? 'text-blue-400' :
                          detail.completionPercentage >= 25 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {detail.completionPercentage}%
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-2">
                        {detail.topics.map((topic: any) => (
                          <div
                            key={topic.id}
                            className={`p-3 rounded-lg border ${
                              topic.isCompleted
                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                : 'bg-slate-700/50 border-white/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {topic.isCompleted ? (
                                  <span className="text-emerald-400 text-xl">✓</span>
                                ) : (
                                  <span className="text-slate-600 text-xl">○</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-white font-medium">{topic.topic_name}</div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {topic.topic_number} • {topic.default_lectures || 0} lectures suggested
                                </div>
                                {topic.isCompleted && topic.lastDate && (
                                  <div className="text-xs text-emerald-400 mt-2">
                                    Completed: {new Date(topic.lastDate).toLocaleDateString('en-IN')}
                                    {topic.lastRemarks && ` • ${topic.lastRemarks}`}
                                  </div>
                                )}
                              </div>
                              {!topic.isCompleted && (
                                <Link
                                  href="/entry"
                                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-medium rounded-lg"
                                >
                                  Mark Complete
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">📝</div>
                <p>No topics assigned for this milestone</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              {!selectedMilestone.isPast && selectedMilestone.completionPercentage < 100 && (
                <Link
                  href="/entry"
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl"
                >
                  Go to Entry →
                </Link>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}