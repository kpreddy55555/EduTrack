// ✅ UPDATED MILESTONES PAGE - HANDLES ALL EDGE CASES
// - Shows ALL milestone topics (not just matched assignments)
// - Graceful handling of unmatched topics
// - Better debugging and error messages
// app/(dashboard)/milestones/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function MilestonesPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
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

      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!userData) return

      setCurrentUser(userData)
      const userIsAdmin = userData.role === 'admin' || userData.role === 'superadmin'
      setIsAdmin(userIsAdmin)

      console.log('👤 Current user:', userData.role, userIsAdmin ? '(Admin)' : '(Faculty)')

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

      // Get milestones for this academic year
      const { data: milestonesData } = await supabase
        .from('exam_milestones')
        .select('*')
        .eq('academic_year_id', yearData.id)
        .eq('is_active', true)
        .order('milestone_date')

      console.log('📋 Milestones found:', milestonesData?.length)

      // Calculate progress for each milestone
      const milestonesWithProgress = await Promise.all(
        (milestonesData || []).map(async (milestone) => {
          let totalTopics = 0
          let completedTopics = 0

          if (userIsAdmin) {
            // ADMIN: Get ALL milestone topics
            const { data: allMilestoneTopics } = await supabase
              .from('milestone_topics')
              .select('*')
              .eq('milestone_id', milestone.id)

            console.log(`📝 [ADMIN] All milestone topics for ${milestone.milestone_name}:`, allMilestoneTopics?.length)

            totalTopics = allMilestoneTopics?.length || 0

            // Count completed across all faculty using API route
            for (const mt of allMilestoneTopics || []) {
              const response = await fetch('/api/milestones/check-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topic_id: mt.topic_id,
                  division_id: mt.division_id,
                  subject_id: mt.subject_id
                })
              })
              const result = await response.json()
              if (result.completed) completedTopics++
            }

          } else {
            // FACULTY: Get only milestone topics for MY assignments
            const { data: myAssignments } = await supabase
              .from('faculty_assignments')
              .select('division_id, subject_id')
              .eq('faculty_id', session.user.id)

            console.log(`👨‍🏫 [FACULTY] My assignments:`, myAssignments?.length)

            // Get milestone topics that match my assignments
            for (const assignment of myAssignments || []) {
              const { data: milestoneTopics } = await supabase
                .from('milestone_topics')
                .select('topic_id')
                .eq('milestone_id', milestone.id)
                .eq('division_id', assignment.division_id)
                .eq('subject_id', assignment.subject_id)

              totalTopics += milestoneTopics?.length || 0

              for (const mt of milestoneTopics || []) {
                const response = await fetch('/api/milestones/check-completion', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    faculty_id: session.user.id,
                    topic_id: mt.topic_id,
                    division_id: assignment.division_id
                  })
                })
                const result = await response.json()
                if (result.completed) completedTopics++
              }
            }
          }

          console.log(`✅ ${milestone.milestone_name}: ${completedTopics}/${totalTopics} completed`)

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
      console.log('🔍 Loading details for:', milestone.milestone_name)

      // SIMPLIFIED APPROACH: Load ALL milestone topics directly
      const { data: milestoneTopics } = await supabase
        .from('milestone_topics')
        .select('topic_id, division_id, subject_id')
        .eq('milestone_id', milestone.id)

      console.log('📝 Milestone topics found:', milestoneTopics?.length)

      if (!milestoneTopics || milestoneTopics.length === 0) {
        console.warn('⚠️ No milestone topics found')
        setMilestoneDetails([])
        return
      }

      // Group by division-subject
      const groupedMap = new Map<string, any>()

      for (const mt of milestoneTopics) {
        const key = `${mt.division_id}-${mt.subject_id}`
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            division_id: mt.division_id,
            subject_id: mt.subject_id,
            topic_ids: []
          })
        }
        groupedMap.get(key)!.topic_ids.push(mt.topic_id)
      }

      console.log('🗂️ Grouped into', groupedMap.size, 'division-subject pairs')

      // Get division and subject names for ALL groups
      const divisionIds = Array.from(new Set(milestoneTopics.map(mt => mt.division_id)))
      const subjectIds = Array.from(new Set(milestoneTopics.map(mt => mt.subject_id)))

      const { data: divisions } = await supabase
        .from('divisions')
        .select('id, division_name, standard_id')
        .in('id', divisionIds)

      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, subject_name, subject_code')
        .in('id', subjectIds)

      // Build details for each group
      const details: any[] = []

      for (const [key, group] of groupedMap.entries()) {
        const division = divisions?.find(d => d.id === group.division_id)
        const subject = subjects?.find(s => s.id === group.subject_id)

        // Get topic details
        const { data: topics } = await supabase
          .from('topics')
          .select('*')
          .in('id', group.topic_ids)
          .order('topic_number')

        if (!topics || topics.length === 0) {
          console.warn(`⚠️ No topics found for ${key}`)
          continue
        }

        console.log(`📖 Loaded ${topics.length} topics for ${subject?.subject_name} - ${division?.division_name}`)

        // Check completion status for each topic using API route
        const topicsWithStatus = await Promise.all(
          topics.map(async (topic) => {
            let completed = false
            let lecturesTaken = 0
            let teachingDate = null

            if (isAdmin) {
              // Admin: check if ANY faculty completed it
              const response = await fetch('/api/milestones/check-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topic_id: topic.id,
                  division_id: group.division_id
                })
              })
              const result = await response.json()
              completed = result.completed
              lecturesTaken = result.lectures_taken || 0
              teachingDate = result.teaching_date
            } else {
              // Faculty: check only their own entries
              const response = await fetch('/api/milestones/check-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  faculty_id: currentUser.id,
                  topic_id: topic.id,
                  division_id: group.division_id
                })
              })
              const result = await response.json()
              completed = result.completed
              lecturesTaken = result.lectures_taken || 0
              teachingDate = result.teaching_date
            }

            return {
              ...topic,
              isCompleted: completed,
              lecturesTaken: lecturesTaken,
              lastDate: teachingDate,
            }
          })
        )

        const completedCount = topicsWithStatus.filter(t => t.isCompleted).length
        const completionPercent = Math.round((completedCount / topicsWithStatus.length) * 100)

        details.push({
          division: division || { division_name: 'Unknown Division' },
          subject: subject || { subject_name: 'Unknown Subject' },
          topics: topicsWithStatus,
          totalTopics: topicsWithStatus.length,
          completedTopics: completedCount,
          completionPercentage: completionPercent,
        })
      }

      console.log('✅ Details loaded:', details.length, 'groups')
      setMilestoneDetails(details)

    } catch (error) {
      console.error('❌ Error loading milestone details:', error)
      setMilestoneDetails([])
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
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Milestones</h1>
            {isAdmin ? (
              <p className="text-gray-400">
                👤 <span className="text-amber-400">Admin View</span> - Viewing all faculty progress
              </p>
            ) : (
              <p className="text-gray-400">Track topics to complete for upcoming exams</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Upcoming Milestones</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMilestones.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                onViewDetails={openMilestoneDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Milestones */}
      {pastMilestones.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Past Milestones</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastMilestones.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                onViewDetails={openMilestoneDetails}
                isPast
              />
            ))}
          </div>
        </div>
      )}

      {milestones.length === 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-gray-400 text-lg">No milestones scheduled yet</p>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMilestone && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white">{selectedMilestone.milestone_name}</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setMilestoneDetails(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400">
                {new Date(selectedMilestone.milestone_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {' • '}
                {selectedMilestone.daysUntil > 0 ? `${selectedMilestone.daysUntil} days left` : 'Past due'}
              </p>

              {/* Overall Progress */}
              <div className="mt-4 bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Overall Progress</span>
                  <span className="text-2xl font-bold text-white">
                    {selectedMilestone.completedTopics} / {selectedMilestone.totalTopics} topics
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all"
                    style={{ width: `${selectedMilestone.completionPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{selectedMilestone.completionPercentage}% complete</span>
                  <span className="text-xs text-gray-500">
                    {selectedMilestone.totalTopics - selectedMilestone.completedTopics} remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!milestoneDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div>
                </div>
              ) : milestoneDetails.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📋</div>
                  <p className="text-gray-400 mb-2">No topics assigned for this milestone</p>
                  <p className="text-sm text-gray-500">Check the console for debugging information</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {milestoneDetails.map((detail: any, idx: number) => (
                    <div key={idx} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      {/* Division/Subject Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {detail.subject?.subject_name} - {detail.division?.division_name}
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">
                            {detail.completedTopics}/{detail.totalTopics} complete
                          </div>
                          <div className="text-xs text-gray-500">{detail.completionPercentage}%</div>
                        </div>
                      </div>

                      {/* Topics List */}
                      <div className="space-y-2">
                        {detail.topics.map((topic: any) => (
                          <div
                            key={topic.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              topic.isCompleted
                                ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-gray-700/30 border border-gray-600/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  topic.isCompleted ? 'bg-green-500' : 'bg-gray-600'
                                }`}
                              >
                                {topic.isCompleted ? '✓' : topic.topic_number}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{topic.topic_name}</div>
                                {topic.isCompleted && topic.lastDate && (
                                  <div className="text-xs text-gray-400">
                                    Completed on {new Date(topic.lastDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            {!topic.isCompleted && !isAdmin && (
                              <Link
                                href="/entries"
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black text-xs font-medium rounded transition"
                              >
                                Mark Complete
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-700 flex items-center justify-between">
              {!isAdmin && (
                <Link
                  href="/entries"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded transition"
                >
                  Go to Entry Page →
                </Link>
              )}
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setMilestoneDetails(null)
                }}
                className="ml-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
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

function MilestoneCard({ milestone, onViewDetails, isPast = false }: any) {
  const urgencyColor = isPast
    ? 'border-gray-600'
    : milestone.daysUntil <= 7
    ? 'border-red-500/50'
    : milestone.daysUntil <= 30
    ? 'border-amber-500/50'
    : 'border-blue-500/50'

  return (
    <div className={`bg-gray-800/50 border ${urgencyColor} rounded-xl p-6 hover:bg-gray-800/70 transition`}>
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">{milestone.milestone_name}</h3>
        <p className="text-sm text-gray-400">
          {new Date(milestone.milestone_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
          {' • '}
          {isPast ? (
            <span className="text-gray-500">Past</span>
          ) : (
            <span className={milestone.daysUntil <= 7 ? 'text-red-400' : 'text-gray-400'}>
              {milestone.daysUntil} days left
            </span>
          )}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress</span>
          <span className="text-sm font-medium text-white">
            {milestone.completedTopics}/{milestone.totalTopics} topics
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              milestone.completionPercentage === 100
                ? 'bg-green-500'
                : milestone.daysUntil <= 7
                ? 'bg-red-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${milestone.completionPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">{milestone.completionPercentage}% complete</span>
          {milestone.totalTopics > milestone.completedTopics && (
            <span className="text-xs text-gray-500">
              {milestone.totalTopics - milestone.completedTopics} remaining
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onViewDetails(milestone)}
        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm font-medium"
      >
        View Topics Details
      </button>
    </div>
  )
}
