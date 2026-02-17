'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  institution_id: string
}

interface Institution {
  id: string
  name: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/')
          return
        }

        // Fetch user details (without join)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (userError || !userData) {
          console.error('Error fetching user:', userError)
          // Still allow access but with limited data
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.email?.split('@')[0] || 'User',
            role: 'faculty',
            institution_id: ''
          })
          setLoading(false)
          return
        }

        setUser(userData)

        // Fetch institution details separately
        if (userData.institution_id) {
          const { data: instData } = await supabase
            .from('institutions')
            .select('id, name')
            .eq('id', userData.institution_id)
            .single()
          
          if (instData) {
            setInstitution(instData)
          }
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
    { name: 'Syllabus Entry', href: '/entries', icon: '✍️', roles: ['superadmin', 'admin', 'faculty', 'hod'] },
    { name: 'My Progress', href: '/progress', icon: '📈', roles: ['superadmin', 'admin', 'faculty', 'hod'] },
    { name: 'Milestones', href: '/milestones', icon: '🎯', roles: ['superadmin', 'admin', 'faculty', 'hod'] },
    { name: 'Reports', href: '/reports', icon: '📄', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
    { name: 'Faculty', href: '/faculty', icon: '👨‍🏫', roles: ['superadmin', 'admin', 'hod'] },
    { name: 'Subjects', href: '/subjects', icon: '📚', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
    { name: 'Divisions', href: '/divisions', icon: '🏫', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
    { name: 'Students', href: '/students', icon: '👨‍🎓', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
    { name: 'Institutions', href: '/institutions', icon: '🏛️', roles: ['superadmin'] },
    { name: 'System Setup', href: '/admin', icon: '🔧', roles: ['superadmin', 'admin'] },
    { name: 'Settings', href: '/settings', icon: '⚙️', roles: ['superadmin', 'admin', 'hod', 'faculty'] },
  ]

  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 
        bg-slate-900/95 backdrop-blur-xl border-r border-white/10
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        flex flex-col
        print:hidden
      `}>
        {/* Logo - Fixed at top */}
        <div className="flex-shrink-0 p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25 transform -rotate-6">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">EduTrack</h1>
              <p className="text-xs text-amber-400 font-medium tracking-wider uppercase">Syllabus Manager</p>
            </div>
          </div>
        </div>

        {/* Institution Info */}
        <div className="flex-shrink-0 p-4">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Institution</p>
            <p className="text-sm font-medium text-white truncate">
              {institution?.name || 'The Andhra Education Society'}
            </p>
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Info & Logout - Fixed at bottom */}
        
        <div className="flex-shrink-0 p-4 border-t border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
              <p className="text-xs text-slate-500">
                {user?.role === 'superadmin' ? 'Super Administrator' : 
                 user?.role === 'admin' ? 'Administrator' : 
                 user?.role === 'hod' ? 'Head of Department' :
                 user?.role || 'Faculty'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72 print:pl-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 print:hidden">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Page Title */}
            <div className="hidden lg:block">
              <h2 className="text-xl font-bold text-white">
                {filteredNavigation.find(n => n.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-4">
              {/* Academic Year Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-sm text-emerald-400 font-medium">2025-26</span>
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Quick Add Entry - Faculty Only */}
              {(user?.role === 'faculty' || user?.role === 'hod') && (
                <Link
                  href="/entries"
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">New Entry</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}