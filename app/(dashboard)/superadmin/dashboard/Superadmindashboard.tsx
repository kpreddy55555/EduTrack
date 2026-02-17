// 👑 SUPERADMIN DASHBOARD - Multi-Institution Management
// Manage multiple colleges, view aggregated data, system-wide settings

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SuperadminDashboard() {
  const [loading, setLoading] = useState(true)
  const [institutions, setInstitutions] = useState<any[]>([])
  const [systemStats, setSystemStats] = useState({
    totalInstitutions: 0,
    totalFaculty: 0,
    totalStudents: 0,
    totalDivisions: 0,
    activeUsers: 0,
  })
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    institution_name: '',
    institution_code: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    website: '',
    principal_name: '',
  })

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get all institutions
      const { data: institutionsData } = await supabase
        .from('institutions')
        .select('*')
        .order('institution_name')

      setInstitutions(institutionsData || [])

      // Get system-wide statistics
      const { count: facultyCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'faculty')

      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })

      const { count: divisionCount } = await supabase
        .from('divisions')
        .select('*', { count: 'exact', head: true })

      const { count: activeUserCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      setSystemStats({
        totalInstitutions: institutionsData?.length || 0,
        totalFaculty: facultyCount || 0,
        totalStudents: studentCount || 0,
        totalDivisions: divisionCount || 0,
        activeUsers: activeUserCount || 0,
      })

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddInstitution = async () => {
    try {
      const { error } = await supabase
        .from('institutions')
        .insert([formData])

      if (error) throw error

      alert('✓ Institution added successfully!')
      setShowAddModal(false)
      setFormData({
        institution_name: '',
        institution_code: '',
        address: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        website: '',
        principal_name: '',
      })
      fetchDashboardData()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const viewInstitution = async (institution: any) => {
    try {
      // Get detailed stats for this institution
      const { count: facultyCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institution.id)
        .eq('role', 'faculty')

      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institution.id)

      const { count: divisionCount } = await supabase
        .from('divisions')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institution.id)

      const { data: academicYears } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', institution.id)
        .order('start_date', { ascending: false })

      setSelectedInstitution({
        ...institution,
        facultyCount,
        studentCount,
        divisionCount,
        academicYears: academicYears || [],
      })
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">👑 Superadmin Dashboard</h1>
            <p className="text-slate-400">Manage all institutions and system-wide settings</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl"
          >
            + Add Institution
          </button>
        </div>

        {/* System Stats */}
        <div className="grid md:grid-cols-5 gap-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Institutions</div>
              <div className="text-2xl">🏛️</div>
            </div>
            <div className="text-3xl font-bold text-white">{systemStats.totalInstitutions}</div>
          </div>

          <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Total Faculty</div>
              <div className="text-2xl">👨‍🏫</div>
            </div>
            <div className="text-3xl font-bold text-blue-400">{systemStats.totalFaculty}</div>
          </div>

          <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Total Students</div>
              <div className="text-2xl">👨‍🎓</div>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{systemStats.totalStudents}</div>
          </div>

          <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Divisions</div>
              <div className="text-2xl">🏫</div>
            </div>
            <div className="text-3xl font-bold text-purple-400">{systemStats.totalDivisions}</div>
          </div>

          <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Active Users</div>
              <div className="text-2xl">✅</div>
            </div>
            <div className="text-3xl font-bold text-amber-400">{systemStats.activeUsers}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Link
            href="/superadmin/institutions"
            className="bg-slate-800 border border-white/10 rounded-xl p-6 hover:bg-slate-700 transition-colors"
          >
            <div className="text-3xl mb-3">🏛️</div>
            <div className="font-semibold text-white mb-1">Institutions</div>
            <div className="text-sm text-slate-400">Manage all institutions</div>
          </Link>

          <Link
            href="/superadmin/users"
            className="bg-slate-800 border border-white/10 rounded-xl p-6 hover:bg-slate-700 transition-colors"
          >
            <div className="text-3xl mb-3">👥</div>
            <div className="font-semibold text-white mb-1">Users</div>
            <div className="text-sm text-slate-400">Manage all users</div>
          </Link>

          <Link
            href="/superadmin/reports"
            className="bg-slate-800 border border-white/10 rounded-xl p-6 hover:bg-slate-700 transition-colors"
          >
            <div className="text-3xl mb-3">📊</div>
            <div className="font-semibold text-white mb-1">System Reports</div>
            <div className="text-sm text-slate-400">Aggregated analytics</div>
          </Link>

          <Link
            href="/superadmin/settings"
            className="bg-slate-800 border border-white/10 rounded-xl p-6 hover:bg-slate-700 transition-colors"
          >
            <div className="text-3xl mb-3">⚙️</div>
            <div className="font-semibold text-white mb-1">System Settings</div>
            <div className="text-sm text-slate-400">Global configuration</div>
          </Link>
        </div>

        {/* Institutions Grid */}
        <div className="bg-slate-800 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">All Institutions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {institutions.map((institution) => (
              <div
                key={institution.id}
                className="bg-slate-700/50 border border-white/10 rounded-lg p-4 hover:bg-slate-700 transition-colors cursor-pointer"
                onClick={() => viewInstitution(institution)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{institution.institution_name}</h3>
                    <p className="text-xs text-slate-400">{institution.institution_code}</p>
                  </div>
                  <div className="text-2xl">🏛️</div>
                </div>
                <div className="space-y-1 text-sm text-slate-400">
                  {institution.city && <div>📍 {institution.city}, {institution.state}</div>}
                  {institution.principal_name && <div>👤 {institution.principal_name}</div>}
                </div>
              </div>
            ))}
          </div>

          {institutions.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">🏛️</div>
              <p>No institutions yet. Click "Add Institution" to create one.</p>
            </div>
          )}
        </div>

        {/* Add Institution Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Add New Institution</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Institution Name *
                    </label>
                    <input
                      type="text"
                      value={formData.institution_name}
                      onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="AES Junior College"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Institution Code *
                    </label>
                    <input
                      type="text"
                      value={formData.institution_code}
                      onChange={(e) => setFormData({ ...formData, institution_code: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 uppercase"
                      placeholder="AES-MUM"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Street address"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="Mumbai"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="Maharashtra"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="022-12345678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="info@college.edu"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="https://college.edu"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Principal Name</label>
                    <input
                      type="text"
                      value={formData.principal_name}
                      onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                      className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                      placeholder="Dr. Principal Name"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddInstitution}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl"
                >
                  Add Institution
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Institution Detail Modal */}
        {selectedInstitution && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-3xl w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">{selectedInstitution.institution_name}</h3>
                <button
                  onClick={() => setSelectedInstitution(null)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400">{selectedInstitution.facultyCount}</div>
                  <div className="text-sm text-slate-400">Faculty Members</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-400">{selectedInstitution.studentCount}</div>
                  <div className="text-sm text-slate-400">Students</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-400">{selectedInstitution.divisionCount}</div>
                  <div className="text-sm text-slate-400">Divisions</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="text-sm text-slate-400">Code</div>
                  <div className="text-white">{selectedInstitution.institution_code}</div>
                </div>
                {selectedInstitution.address && (
                  <div>
                    <div className="text-sm text-slate-400">Address</div>
                    <div className="text-white">
                      {selectedInstitution.address}, {selectedInstitution.city}, {selectedInstitution.state}
                    </div>
                  </div>
                )}
                {selectedInstitution.principal_name && (
                  <div>
                    <div className="text-sm text-slate-400">Principal</div>
                    <div className="text-white">{selectedInstitution.principal_name}</div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/admin?institution=${selectedInstitution.id}`}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl text-center"
                >
                  Manage Institution →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}