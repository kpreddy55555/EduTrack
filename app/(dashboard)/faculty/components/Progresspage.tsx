// 📊 FIXED Progress Tracking Page
// Correct column names, no missing tables, proper calculations

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)
  const [facultyId, setFacultyId] = useState('')
  const [selectedView, setSelectedView] = useState<'overview' | 'division' | 'subject'>('overview')

  // Data
  const [overallStats, setOverallStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    totalLectures: 0,
    completedLectures: 0,
    completionPercentage: 0,
  })
  const [divisionProgress, setDivisionProgress] = useState<any[]>([])
  const [subjectProgress, setSubjectProgress] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchProgressData()
  }, [])

  const fetchProgressData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setFacultyId(session.user.id)

      // Use the same API endpoint as the dashboard
      const response = await fetch(`/api/faculty-assignments?faculty_id=${session.user.id}`)
      const result = await response.json()

      if (!result.success) {
        console.error('Failed to fetch data:', result.error)
        setLoading(false)
        return
      }

      const data = result.data

      setOverallStats({
        totalTopics: data.total_topics,
        completedTopics: data.completed_topics,
        totalLectures: data.total_lectures_planned,
        completedLectures: data.total_lectures_delivered,
        completionPercentage: data.completion_percentage,
      })

      setDivisionProgress(data.divisions || [])
      setSubjectProgress(data.subjects || [])

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading progress data...</p>
        </div>
      </div>
    )
  }

  // Show helpful message if no data
  if (overallStats.totalTopics === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-slate-700/30 border border-amber-500/20 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-white mb-2">No Progress Data Yet</h2>
          <p className="text-slate-400 mb-4">
            You have {divisionProgress.length} division(s) and {subjectProgress.length} subject(s) assigned,
            but no topics are available yet.
          </p>
          <div className="text-sm text-slate-500 mt-4">
            <p>Possible reasons:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Topics haven't been added to your subjects yet</li>
              <li>Topics aren't linked to the correct standard/stream</li>
              <li>No syllabus entries have been created</li>
            </ul>
          </div>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Progress Tracking</h1>
        <p className="text-slate-400">Monitor your teaching progress and completion rates</p>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm">Overall Progress</div>
            <div className="text-2xl">📊</div>
          </div>
          <div className="text-4xl font-bold text-amber-400 mb-1">
            {overallStats.completionPercentage}%
          </div>
          <div className="text-xs text-slate-500">
            {overallStats.completedTopics} of {overallStats.totalTopics} topics
          </div>
        </div>

        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm">Topics Completed</div>
            <div className="text-2xl">✅</div>
          </div>
          <div className="text-4xl font-bold text-emerald-400 mb-1">
            {overallStats.completedTopics}
          </div>
          <div className="text-xs text-slate-500">out of {overallStats.totalTopics}</div>
        </div>

        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm">Lectures Delivered</div>
            <div className="text-2xl">📚</div>
          </div>
          <div className="text-4xl font-bold text-blue-400 mb-1">
            {overallStats.completedLectures}
          </div>
          <div className="text-xs text-slate-500">out of {overallStats.totalLectures} planned</div>
        </div>

        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 text-sm">Topics Remaining</div>
            <div className="text-2xl">📝</div>
          </div>
          <div className="text-4xl font-bold text-amber-400 mb-1">
            {overallStats.totalTopics - overallStats.completedTopics}
          </div>
          <div className="text-xs text-slate-500">to complete</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">Overall Completion</h2>
          <span className="text-2xl font-bold text-amber-400">
            {overallStats.completionPercentage}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 transition-all duration-500"
            style={{ width: `${overallStats.completionPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-sm text-slate-400">
          <span>{overallStats.completedTopics} completed</span>
          <span>{overallStats.totalTopics - overallStats.completedTopics} remaining</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setSelectedView('overview')}
          className={`px-6 py-3 font-medium transition-colors ${
            selectedView === 'overview'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setSelectedView('division')}
          className={`px-6 py-3 font-medium transition-colors ${
            selectedView === 'division'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🏫 By Division
        </button>
        <button
          onClick={() => setSelectedView('subject')}
          className={`px-6 py-3 font-medium transition-colors ${
            selectedView === 'subject'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📖 By Subject
        </button>
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* By Division Summary */}
            <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Progress by Division</h3>
              {divisionProgress.length > 0 ? (
                <div className="space-y-3">
                  {divisionProgress.map((div) => (
                    <div key={div.division_id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{div.division_name}</div>
                        <div className="text-xs text-slate-400">
                          {div.completed_topics}/{div.total_topics} topics • {div.subjects_count} subjects
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          div.completion_percentage >= 75 ? 'text-emerald-400' :
                          div.completion_percentage >= 50 ? 'text-blue-400' :
                          div.completion_percentage >= 25 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {div.completion_percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No division data available</p>
              )}
            </div>

            {/* By Subject Summary */}
            <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Progress by Subject</h3>
              {subjectProgress.length > 0 ? (
                <div className="space-y-3">
                  {subjectProgress.map((subj) => (
                    <div key={subj.subject_id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{subj.subject_name}</div>
                        <div className="text-xs text-slate-400">
                          {subj.completed_topics}/{subj.total_topics} topics • {subj.subject_code}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          subj.completion_percentage >= 75 ? 'text-emerald-400' :
                          subj.completion_percentage >= 50 ? 'text-blue-400' :
                          subj.completion_percentage >= 25 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {subj.completion_percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No subject data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Division Tab */}
      {selectedView === 'division' && (
        <div className="space-y-4">
          {divisionProgress.map((div) => (
            <div key={div.division_id} className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{div.division_name}</h3>
                  <p className="text-sm text-slate-400">{div.subjects_count} subjects</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-amber-400">{div.completion_percentage}%</div>
                  <div className="text-xs text-slate-400">completed</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{div.completed_topics}</div>
                  <div className="text-xs text-slate-400">Topics Done</div>
                </div>
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">{div.total_topics - div.completed_topics}</div>
                  <div className="text-xs text-slate-400">Remaining</div>
                </div>
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{div.in_progress_topics || 0}</div>
                  <div className="text-xs text-slate-400">In Progress</div>
                </div>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                  style={{ width: `${div.completion_percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subject Tab */}
      {selectedView === 'subject' && (
        <div className="space-y-4">
          {subjectProgress.map((subj) => (
            <div key={subj.subject_id} className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{subj.subject_name}</h3>
                  <p className="text-sm text-slate-400">{subj.subject_code}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-amber-400">{subj.completion_percentage}%</div>
                  <div className="text-xs text-slate-400">completed</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{subj.completed_topics}</div>
                  <div className="text-xs text-slate-400">Topics Done</div>
                </div>
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">{subj.total_topics - subj.completed_topics}</div>
                  <div className="text-xs text-slate-400">Remaining</div>
                </div>
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{subj.lectures_delivered}</div>
                  <div className="text-xs text-slate-400">Lectures</div>
                </div>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                  style={{ width: `${subj.completion_percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}