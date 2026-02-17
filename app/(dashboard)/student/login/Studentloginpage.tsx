// 🎓 STUDENT LOGIN PAGE
// Login with GR Number and Date of Birth
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function StudentLoginPage() {
  const [grNumber, setGrNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!grNumber || !dateOfBirth) {
        setError('Please enter both GR Number and Date of Birth')
        setLoading(false)
        return
      }

      // Simple query - no FK joins (works even without FK relationships)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('gr_number', grNumber.toUpperCase().trim())
        .eq('date_of_birth', dateOfBirth)
        .eq('is_active', true)
        .single()

      if (studentError || !student) {
        setError('Invalid GR Number or Date of Birth. Please check and try again.')
        setLoading(false)
        return
      }

      // Get division name separately (no FK dependency)
      let divisionName = ''
      if (student.division_id) {
        const { data: div } = await supabase
          .from('divisions')
          .select('division_name')
          .eq('id', student.division_id)
          .single()
        divisionName = div?.division_name || ''
      }

      // Get institution name separately
      let institutionName = ''
      if (student.institution_id) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('name, institution_name')
          .eq('id', student.institution_id)
          .single()
        institutionName = inst?.institution_name || inst?.name || ''
      }

      // Store student session in localStorage
      localStorage.setItem('student_session', JSON.stringify({
        id: student.id,
        name: student.full_name || student.student_name || '',
        grNumber: student.gr_number,
        divisionId: student.division_id,
        division: divisionName,
        institutionId: student.institution_id,
        institution: institutionName,
        loginTime: new Date().toISOString()
      }))

      // Log session (ignore errors - table might not exist)
      try {
        await supabase.from('student_sessions').insert([{
          student_id: student.id,
          login_time: new Date().toISOString(),
          ip_address: '',
          user_agent: navigator.userAgent
        }])
      } catch {}

      // Redirect to student dashboard
      router.push('/student/dashboard')

    } catch (err: any) {
      console.error('Login error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎓</div>
          <h1 className="text-3xl font-bold text-white mb-2">Student Portal</h1>
          <p className="text-slate-400">Track your syllabus progress</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 border border-white/10 rounded-xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Student Login</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* GR Number */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                GR Number *
              </label>
              <input
                type="text"
                value={grNumber}
                onChange={(e) => setGrNumber(e.target.value)}
                placeholder="GR2025001"
                className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-transparent uppercase"
                required
                disabled={loading}
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter your General Register Number
              </p>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date of Birth *
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                required
                disabled={loading}
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter your date of birth
              </p>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-lg transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Logging in...
                </span>
              ) : (
                'Login to Portal'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-xs text-slate-400 space-y-2">
              <p className="flex items-start gap-2">
                <span>💡</span>
                <span>Use your GR Number and Date of Birth to login</span>
              </p>
              <p className="flex items-start gap-2">
                <span>🔒</span>
                <span>Your data is secure and private</span>
              </p>
              <p className="flex items-start gap-2">
                <span>❓</span>
                <span>Having trouble? Contact your class teacher</span>
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-slate-500 text-sm">
          <p>EduTrack - Syllabus Management System</p>
        </div>
      </div>
    </div>
  )
}
