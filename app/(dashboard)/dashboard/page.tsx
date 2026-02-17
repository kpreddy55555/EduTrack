'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface DashboardStats {
  totalSubjects: number
  totalTopics: number
  completedTopics: number
  inProgressTopics: number
  pendingTopics: number
  completionPercentage: number
}

interface RecentEntry {
  id: string
  topic_name: string
  subject_name: string
  division_name: string
  status: string
  lectures_taken: number
  updated_at: string
}

interface SubjectProgress {
  subject_name: string
  subject_code: string
  total_topics: number
  completed: number
  in_progress: number
  percentage: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubjects: 0,
    totalTopics: 0,
    completedTopics: 0,
    inProgressTopics: 0,
    pendingTopics: 0,
    completionPercentage: 0,
  })
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, role, institution_id')
        .eq('id', session.user.id)
        .single()

      if (userError) {
        console.error('Error fetching user:', userError)
        setUser({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.email?.split('@')[0] || 'User',
          role: 'faculty',
          institution_id: 'INST-001'
        })
      } else {
        setUser(userData)
      }

      const currentUser = userData || { 
        id: session.user.id, 
        role: 'faculty', 
        institution_id: 'INST-001' 
      }

      console.log('👤 Current user:', currentUser.role, currentUser.id)

      // Fetch stats based on role
      if (currentUser.role === 'faculty' || currentUser.role === 'hod') {
        await fetchFacultyStatsFromAPI(currentUser.id)
      } else {
        await fetchAdminStats(currentUser.institution_id)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Faculty: Use API route
  const fetchFacultyStatsFromAPI = async (userId: string) => {
    try {
      console.log('📊 Fetching faculty data from API for:', userId)
      
      const response = await fetch(`/api/faculty-assignments?faculty_id=${userId}`)
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ API response:', result)

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
      }

      const data = result.data

      // Set overall stats
      setStats({
        totalSubjects: data.total_subjects || 0,
        totalTopics: data.total_topics || 0,
        completedTopics: data.completed_topics || 0,
        inProgressTopics: data.in_progress_topics || 0,
        pendingTopics: data.not_started_topics || 0,
        completionPercentage: data.completion_percentage || 0,
      })

      console.log('📈 Stats set:', {
        topics: data.total_topics,
        completed: data.completed_topics,
        percentage: data.completion_percentage
      })

      // Set recent entries (using correct column name: lectures_taken -> lectures_taken)
      const recent = (data.recent_entries || []).slice(0, 5).map((e: any) => ({
        id: e.id,
        topic_name: e.topic_name,
        subject_name: e.subject_name,
        division_name: e.division_name,
        status: e.status || 'Not Started',
        lectures_taken: e.lectures_taken || 0,
        updated_at: e.date,
      }))
      setRecentEntries(recent)

      // Set subject progress
      const subjects = (data.subjects || []).map((s: any) => ({
        subject_name: s.subject_name,
        subject_code: s.subject_code,
        total_topics: s.total_topics,
        completed: s.completed_topics,
        in_progress: s.in_progress_topics,
        percentage: s.completion_percentage,
      }))
      setSubjectProgress(subjects)

    } catch (error: any) {
      console.error('❌ Error fetching faculty stats from API:', error)
      console.error('Error details:', error.message)
    }
  }

  // ✅ Admin: Direct queries (CORRECTED with proper column names)
  const fetchAdminStats = async (institutionId: string) => {
    try {
      console.log('📊 Fetching admin stats for institution:', institutionId)

      // Get all subjects count
      const { count: subjectsCount } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)

      // Get all topics count
      const { count: topicsCount } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)

      // ✅ FIXED: Use correct column names
      const { data: entriesData } = await supabase
        .from('syllabus_entries')
        .select('id, status, completion_percentage, lectures_taken')
        .eq('institution_id', institutionId)

      console.log('📊 Admin Dashboard Stats:', {
        subjects: subjectsCount,
        topics: topicsCount,
        entries: entriesData?.length,
      })

      // Count by status
      const completed = entriesData?.filter(e => 
        e.status?.toLowerCase() === 'completed' || e.completion_percentage === 100
      ).length || 0
      
      const inProgress = entriesData?.filter(e => 
        e.status?.toLowerCase() === 'in progress' || 
        (e.completion_percentage && e.completion_percentage > 0 && e.completion_percentage < 100)
      ).length || 0
      
      const notStarted = (topicsCount || 0) - completed - inProgress

      // Calculate average completion
      const avgCompletion = entriesData && entriesData.length > 0
        ? Math.round(
            entriesData.reduce((sum, e) => sum + (e.completion_percentage || 0), 0) / entriesData.length
          )
        : 0

      setStats({
        totalSubjects: subjectsCount || 0,
        totalTopics: topicsCount || 0,
        completedTopics: completed,
        inProgressTopics: inProgress,
        pendingTopics: Math.max(0, notStarted),
        completionPercentage: avgCompletion
      })

      // ✅ Fetch recent entries (simple queries, no joins)
      const { data: recentData } = await supabase
        .from('syllabus_entries')
        .select('id, lectures_taken, status, updated_at, topic_id, subject_id, division_id')
        .eq('institution_id', institutionId)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (recentData && recentData.length > 0) {
        // Get related data separately (no joins)
        const topicIds = Array.from(new Set(recentData.map(e => e.topic_id).filter(Boolean)))
        const subjectIds = Array.from(new Set(recentData.map(e => e.subject_id).filter(Boolean)))
        const divisionIds = Array.from(new Set(recentData.map(e => e.division_id).filter(Boolean)))
       

        const { data: topics } = await supabase
          .from('topics')
          .select('id, topic_name')
          .in('id', topicIds)

        const { data: subjects } = await supabase
          .from('subjects')
          .select('id, subject_name')
          .in('id', subjectIds)

        const { data: divisions } = await supabase
          .from('divisions')
          .select('id, division_name')
          .in('id', divisionIds)

        const topicsMap = new Map(topics?.map(t => [t.id, t.topic_name]))
        const subjectsMap = new Map(subjects?.map(s => [s.id, s.subject_name]))
        const divisionsMap = new Map(divisions?.map(d => [d.id, d.division_name]))

        const formattedRecent = recentData.map((entry: any) => ({
          id: entry.id,
          topic_name: topicsMap.get(entry.topic_id) || 'Unknown Topic',
          subject_name: subjectsMap.get(entry.subject_id) || 'Unknown Subject',
          division_name: divisionsMap.get(entry.division_id) || 'Unknown Division',
          status: entry.status || 'Not Started',
          lectures_taken: entry.lectures_taken || 0,
          updated_at: entry.updated_at
        }))
        setRecentEntries(formattedRecent)
      }

    } catch (error) {
      console.error('❌ Error fetching admin stats:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || ''
    if (statusLower === 'completed') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (statusLower === 'in progress') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-white/10 rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Welcome back, {user?.full_name?.split(' ')[0] || 'User'}! 👋
            </h1>
            <p className="text-slate-400">
              {user?.role === 'faculty' || user?.role === 'hod'
                ? "Here's your syllabus progress overview for this academic year."
                : "Here's the institution-wide syllabus tracking overview."
              }
            </p>
          </div>
          {(user?.role === 'faculty' || user?.role === 'hod') && (
            <Link
              href="/entries"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Syllabus Entry
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Topics"
          value={stats.totalTopics}
          icon="📚"
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Completed"
          value={stats.completedTopics}
          icon="✅"
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgressTopics}
          icon="🔄"
          gradient="from-amber-500 to-amber-600"
        />
        <StatCard
          title="Completion"
          value={`${stats.completionPercentage}%`}
          icon="📊"
          gradient="from-purple-500 to-purple-600"
          isPercentage
          percentage={stats.completionPercentage}
        />
      </div>

      {/* Progress Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Overall Progress</h3>
          <span className="text-2xl font-bold text-amber-400">{stats.completionPercentage}%</span>
        </div>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000"
            style={{ width: `${stats.completionPercentage}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between mt-4 text-sm gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
            <span className="text-slate-400">Completed: {stats.completedTopics}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
            <span className="text-slate-400">In Progress: {stats.inProgressTopics}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-slate-500 rounded-full"></span>
            <span className="text-slate-400">Pending: {stats.pendingTopics}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <Link href="/entries" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
              View All →
            </Link>
          </div>
          
          {recentEntries.length > 0 ? (
            <div className="space-y-4">
              {recentEntries.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-lg">
                    📖
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{entry.topic_name}</p>
                    <p className="text-sm text-slate-500">{entry.subject_name} • {entry.division_name}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-slate-400">No syllabus entries yet</p>
              <p className="text-sm text-slate-500 mt-2">Start adding entries to track progress</p>
            </div>
          )}
        </div>

        {/* Subject Progress */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Subject-wise Progress</h3>
            <Link href="/reports" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
              Details →
            </Link>
          </div>
          
          {subjectProgress.length > 0 ? (
            <div className="space-y-4">
              {subjectProgress.slice(0, 5).map((subject, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium truncate">{subject.subject_name}</span>
                    <span className="text-sm text-slate-400">{subject.percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        subject.percentage >= 75 ? 'bg-emerald-500' :
                        subject.percentage >= 50 ? 'bg-amber-500' :
                        subject.percentage >= 25 ? 'bg-orange-500' : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.max(subject.percentage, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{subject.completed} completed</span>
                    <span>{subject.total_topics} topics</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-slate-400">No subject progress data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            href="/entries"
            icon="📝"
            title="Syllabus Entry"
            description="Add or view entries"
          />
          <QuickActionCard
            href="/reports"
            icon="📋"
            title="Reports"
            description="View detailed reports"
          />
          <QuickActionCard
            href="/faculty"
            icon="👨‍🏫"
            title="Faculty"
            description="Manage faculty"
          />
          <QuickActionCard
            href="/subjects"
            icon="📚"
            title="Subjects"
            description="Manage subjects"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  icon, 
  gradient,
  isPercentage = false,
  percentage = 0
}: { 
  title: string
  value: string | number
  icon: string
  gradient: string
  isPercentage?: boolean
  percentage?: number
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {isPercentage && (
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-slate-700"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${(percentage / 100) * 125.6} 125.6`}
                className="text-amber-400"
              />
            </svg>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-400">{title}</p>
    </div>
  )
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-amber-500/30 transition-all"
    >
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{icon}</div>
      <h4 className="font-medium text-white mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </Link>
  )
}