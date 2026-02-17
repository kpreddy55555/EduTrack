// 📊 Enhanced Faculty Dashboard
// Shows comprehensive statistics with topics, lectures, and progress tracking

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function FacultyDashboard() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState('')
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError)
        router.push('/login')
        return
      }

      console.log('✅ Faculty ID:', session.user.id)

      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, institution_id')
        .eq('id', session.user.id)
        .single()

      if (userData) {
        setUserName(userData.full_name || 'Faculty')
      }

      // Fetch comprehensive faculty data
      const response = await fetch(`/api/faculty-assignments?faculty_id=${session.user.id}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
      }

      console.log('✅ Dashboard data loaded:', result.data)
      setStats(result.data)

    } catch (err: any) {
      console.error('❌ Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!stats || stats.total_topics === 0) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Topics Assigned Yet</h2>
            <p className="text-slate-400 mb-4">
              You have {stats?.total_assignments || 0} assignment(s), but no topics are available yet.
            </p>
            <p className="text-sm text-slate-500">
              Topics may not be configured for your subjects, or they might not be linked to the correct standard.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Refresh Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                Welcome back, {userName}! 👋
              </h1>
              <p className="text-slate-400">
                Here's your syllabus progress overview • {stats.total_assignments} teaching assignments
              </p>
            </div>
            <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors">
              Menu
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Action Button */}
        <button
          onClick={() => router.push('/update-syllabus')}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-xl mb-8 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Syllabus Entry
        </button>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Topics */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-blue-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-400 text-sm font-medium">Total Topics</div>
              <div className="text-3xl">📚</div>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {stats.total_topics}
            </div>
            <div className="text-xs text-slate-500">
              Across {stats.total_subjects} subjects
            </div>
          </div>

          {/* Completed */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-emerald-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-400 text-sm font-medium">Completed</div>
              <div className="text-3xl">✅</div>
            </div>
            <div className="text-4xl font-bold text-emerald-400 mb-1">
              {stats.completed_topics}
            </div>
            <div className="text-xs text-slate-500">
              {stats.in_progress_topics} in progress
            </div>
          </div>

          {/* Lectures Delivered */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-purple-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-400 text-sm font-medium">Lectures Delivered</div>
              <div className="text-3xl">🎓</div>
            </div>
            <div className="text-4xl font-bold text-purple-400 mb-1">
              {stats.total_lectures_delivered}
            </div>
            <div className="text-xs text-slate-500">
              of {stats.total_lectures_planned} planned
            </div>
          </div>

          {/* Overall Progress */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-amber-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-400 text-sm font-medium">Completion</div>
              <div className="text-3xl">📊</div>
            </div>
            <div className="text-4xl font-bold text-amber-400 mb-1">
              {stats.completion_percentage}%
            </div>
            <div className="text-xs text-slate-500">
              {stats.not_started_topics} not started
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Overall Progress</h3>
            <span className="text-2xl font-bold text-amber-400">
              {stats.completion_percentage}%
            </span>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${stats.completion_percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-slate-400">
            <span>{stats.completed_topics} completed</span>
            <span>{stats.in_progress_topics} in progress</span>
            <span>{stats.not_started_topics} pending</span>
          </div>
        </div>

        {/* Subject & Division Breakdown */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Subjects */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📖</span> Progress by Subject
            </h3>
            <div className="space-y-4">
              {stats.subjects.map((subject: any) => (
                <div key={subject.subject_id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-white font-semibold">{subject.subject_name}</div>
                      <div className="text-sm text-slate-400">
                        {subject.completed_topics}/{subject.total_topics} topics • {subject.lectures_delivered}/{subject.lectures_planned} lectures
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        subject.completion_percentage >= 75 ? 'text-emerald-400' :
                        subject.completion_percentage >= 50 ? 'text-blue-400' :
                        subject.completion_percentage >= 25 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {subject.completion_percentage}%
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        subject.completion_percentage >= 75 ? 'bg-emerald-500' :
                        subject.completion_percentage >= 50 ? 'bg-blue-500' :
                        subject.completion_percentage >= 25 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${subject.completion_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divisions */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🏫</span> Progress by Division
            </h3>
            <div className="space-y-4">
              {stats.divisions.map((division: any) => (
                <div key={division.division_id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-white font-semibold">{division.division_name}</div>
                      <div className="text-sm text-slate-400">
                        {division.completed_topics}/{division.total_topics} topics • {division.subjects_count} subjects
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        division.completion_percentage >= 75 ? 'text-emerald-400' :
                        division.completion_percentage >= 50 ? 'text-blue-400' :
                        division.completion_percentage >= 25 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {division.completion_percentage}%
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        division.completion_percentage >= 75 ? 'bg-emerald-500' :
                        division.completion_percentage >= 50 ? 'bg-blue-500' :
                        division.completion_percentage >= 25 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${division.completion_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {stats.recent_entries && stats.recent_entries.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📝</span> Recent Activity
            </h3>
            <div className="space-y-3">
              {stats.recent_entries.slice(0, 5).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{entry.topic_name}</div>
                    <div className="text-xs text-slate-400">
                      {entry.subject_name} • {entry.division_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-sm font-medium">
                      {entry.lectures_taken} {entry.lectures_taken === 1 ? 'lecture' : 'lectures'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.date).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/faculty/progress')}
            className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📊</div>
            <h4 className="text-white font-semibold mb-1">Progress Tracking</h4>
            <p className="text-slate-400 text-sm">View detailed progress by subject and division</p>
          </button>

          <button
            onClick={() => router.push('/update-syllabus')}
            className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">✏️</div>
            <h4 className="text-white font-semibold mb-1">Update Syllabus</h4>
            <p className="text-slate-400 text-sm">Add or edit syllabus completion entries</p>
          </button>

          <button
            onClick={() => router.push('/faculty/reports')}
            className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-6 text-left transition-all group"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📈</div>
            <h4 className="text-white font-semibold mb-1">Reports</h4>
            <p className="text-slate-400 text-sm">Generate and export progress reports</p>
          </button>
        </div>
      </div>
    </div>
  )
}