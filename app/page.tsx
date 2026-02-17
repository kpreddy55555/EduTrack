'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setCheckingAuth(false)
      }
    }
    checkUser()
  }, [router, supabase.auth])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else if (data.session) {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl"></div>
        
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        ></div>

        <div className="absolute top-[15%] left-[10%] text-4xl opacity-20 animate-float">📚</div>
        <div className="absolute top-[25%] right-[15%] text-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }}>🎓</div>
        <div className="absolute bottom-[30%] left-[20%] text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>✏️</div>
        <div className="absolute bottom-[20%] right-[25%] text-4xl opacity-20 animate-float" style={{ animationDelay: '1.5s' }}>📊</div>
        <div className="absolute top-[60%] left-[8%] text-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>🔬</div>
        <div className="absolute top-[40%] right-[8%] text-3xl opacity-20 animate-float" style={{ animationDelay: '0.8s' }}>📐</div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        
        {/* Left Panel - Branding */}
        <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-16">
          <div className="max-w-md text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25 transform -rotate-6">
                <span className="text-3xl">🎓</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  EduTrack
                </h1>
                <p className="text-amber-400 text-sm font-medium tracking-widest uppercase">
                  Syllabus Manager
                </p>
              </div>
            </div>

            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Track Progress.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-emerald-400">
                Achieve Excellence.
              </span>
            </h2>

            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
              Comprehensive syllabus tracking for educational institutions. 
              Monitor curriculum completion, faculty progress, and student outcomes.
            </p>

            <div className="hidden lg:grid grid-cols-2 gap-4">
              <FeatureCard icon="📈" title="Real-time Tracking" />
              <FeatureCard icon="👥" title="Multi-Board Support" />
              <FeatureCard icon="📱" title="Mobile Friendly" />
              <FeatureCard icon="🔒" title="Secure & Private" />
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Welcome Back</h3>
                <p className="text-slate-400">Sign in to continue to your dashboard</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                      placeholder="you@institution.edu"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 block">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-white/5 text-amber-500 focus:ring-amber-500/50" />
                    <span className="text-sm text-slate-400">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold py-3.5 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-amber-500/25"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Student Portal Link */}
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-sm text-slate-400 mb-3">Are you a student?</p>
                <a href="/student-portal/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition text-sm font-medium">
                  🎓 Student Portal Login
                </a>
              </div>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-slate-500">Supported Boards</span>
                </div>
              </div>

              <div className="flex justify-center gap-4 flex-wrap opacity-50">
                <span className="text-xs text-slate-400 px-3 py-1 border border-white/10 rounded-full">CBSE</span>
                <span className="text-xs text-slate-400 px-3 py-1 border border-white/10 rounded-full">ICSE</span>
                <span className="text-xs text-slate-400 px-3 py-1 border border-white/10 rounded-full">State Board</span>
                <span className="text-xs text-slate-400 px-3 py-1 border border-white/10 rounded-full">IB</span>
              </div>
            </div>

            <p className="text-center text-slate-500 text-sm mt-8">
              Need help? Contact your institution administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
      <span className="text-2xl">{icon}</span>
      <span className="text-slate-300 text-sm font-medium">{title}</span>
    </div>
  )
}
