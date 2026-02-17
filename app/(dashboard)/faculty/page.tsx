'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/app/(dashboard)/admin/components/Modal'
import { downloadTemplate, downloadExcel, parseExcel, FACULTY_COLUMNS, FACULTY_SAMPLE_DATA } from '@/lib/excel-utils'

interface Faculty {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  department_id: string | null
  created_at: string
  assignments_count?: number
  department_name?: string
}

interface Department {
  id: string
  department_name: string
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [institutionId, setInstitutionId] = useState('')
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'faculty',
    department_id: '',
    password: ''
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) return
      setInstitutionId(userData.institution_id)

      // Fetch departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, department_name')
        .eq('institution_id', userData.institution_id)
        .order('department_name')

      setDepartments(deptData || [])

      // Fetch faculty
      const { data: facultyData } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .in('role', ['faculty', 'hod'])
        .order('full_name')

      // Add assignment counts and department names
      const facultyWithDetails = await Promise.all(
        (facultyData || []).map(async (f) => {
          const { count } = await supabase
            .from('faculty_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('faculty_id', f.id)

          const dept = deptData?.find(d => d.id === f.department_id)

          return {
            ...f,
            assignments_count: count || 0,
            department_name: dept?.department_name || ''
          }
        })
      )

      setFaculty(facultyWithDetails)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFaculty = async () => {
    if (!formData.full_name || !formData.email || !formData.password) {
      setMessage({ type: 'error', text: 'Name, email and password are required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      })

      // If admin API not available, use signUp
      let userId: string | null = null
      
      if (authError) {
        // Try regular signup
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })
        
        if (signUpError) throw signUpError
        userId = signUpData.user?.id || null
      } else {
        userId = authData.user?.id || null
      }

      if (!userId) {
        // Create user record without auth (manual entry)
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: crypto.randomUUID(),
            institution_id: institutionId,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            role: formData.role,
            department_id: formData.department_id || null,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) throw insertError
      } else {
        // Create user record with auth ID
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            institution_id: institutionId,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            role: formData.role,
            department_id: formData.department_id || null,
            is_active: true,
            created_at: new Date().toISOString()
          })

        if (insertError) throw insertError
      }

      setMessage({ type: 'success', text: 'Faculty added successfully!' })
      setShowAddModal(false)
      setFormData({ full_name: '', email: '', phone: '', role: 'faculty', department_id: '', password: '' })
      fetchData()
    } catch (error: any) {
      console.error('Error adding faculty:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to add faculty' })
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSaving(true)
    setMessage(null)

    try {
      const data = await parseExcel(file)
      
      let successCount = 0
      let errorCount = 0

      for (const row of data) {
        try {
          // Find department by name
          const dept = departments.find(d => 
            d.department_name.toLowerCase() === (row['Department'] || '').toLowerCase()
          )

          await supabase.from('users').insert({
            id: crypto.randomUUID(),
            institution_id: institutionId,
            full_name: row['Full Name'],
            email: row['Email'],
            phone: row['Phone'] || null,
            role: (row['Role (faculty/hod)'] || 'faculty').toLowerCase(),
            department_id: dept?.id || null,
            is_active: true,
            created_at: new Date().toISOString()
          })
          successCount++
        } catch (err) {
          errorCount++
        }
      }

      setMessage({ 
        type: successCount > 0 ? 'success' : 'error', 
        text: `Imported ${successCount} faculty. ${errorCount > 0 ? `${errorCount} failed.` : ''}` 
      })
      setShowUploadModal(false)
      fetchData()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to parse Excel file' })
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownloadTemplate = () => {
    downloadTemplate(FACULTY_COLUMNS, 'faculty', FACULTY_SAMPLE_DATA)
  }

  const handleExportData = () => {
    const exportData = faculty.map(f => ({
      full_name: f.full_name,
      email: f.email,
      phone: f.phone || '',
      role: f.role,
      department_name: f.department_name || ''
    }))
    downloadExcel(exportData, FACULTY_COLUMNS, 'faculty_list')
  }

  const filteredFaculty = faculty.filter(f => {
    const matchesSearch = f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         f.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = !filterDepartment || f.department_id === filterDepartment
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && f.is_active) ||
                         (filterStatus === 'inactive' && !f.is_active)
    return matchesSearch && matchesDepartment && matchesStatus
  })

  const stats = {
    total: faculty.length,
    active: faculty.filter(f => f.is_active).length,
    hods: faculty.filter(f => f.role === 'hod').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty Management</h1>
          <p className="text-slate-400">View and manage faculty members</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl transition-all border border-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium rounded-xl transition-all border border-emerald-500/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Excel
          </button>
          <button
            onClick={handleExportData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-xl transition-all border border-blue-500/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Faculty
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-slate-400">Total Faculty</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-3xl font-bold text-emerald-400">{stats.active}</p>
          <p className="text-sm text-slate-400">Active</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-3xl font-bold text-amber-400">{stats.hods}</p>
          <p className="text-sm text-slate-400">HODs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
            />
          </div>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.department_name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Faculty</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Email</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Department</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Role</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Assignments</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Status</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFaculty.length > 0 ? (
                filteredFaculty.map((f) => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {f.full_name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{f.full_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400 text-sm">{f.email}</td>
                    <td className="py-4 px-6 text-slate-400 text-sm">{f.department_name || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        f.role === 'hod' 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {f.role === 'hod' ? 'HOD' : 'Faculty'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-white">{f.assignments_count || 0}</span>
                      <span className="text-slate-500 text-sm"> subjects</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        f.is_active 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => { setSelectedFaculty(f); setShowViewModal(true); }}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-4xl mb-4">👨‍🏫</div>
                    <p className="text-slate-400">No faculty found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Faculty Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Faculty" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              placeholder="Enter password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              placeholder="Enter phone number"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="faculty">Faculty</option>
                <option value="hod">HOD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFaculty}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Faculty'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Faculty from Excel" size="md">
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm">
              📋 Download the template first, fill in the faculty details, then upload the file.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <svg className="w-12 h-12 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
            >
              Choose Excel File
            </button>
            <p className="text-slate-500 text-sm mt-2">Supports .xlsx and .xls files</p>
          </div>
        </div>
      </Modal>

      {/* View Faculty Modal */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Faculty Details" size="md">
        {selectedFaculty && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {selectedFaculty.full_name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedFaculty.full_name}</h3>
                <p className="text-slate-400">{selectedFaculty.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Phone</p>
                <p className="text-white">{selectedFaculty.phone || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Role</p>
                <p className="text-white capitalize">{selectedFaculty.role}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Department</p>
                <p className="text-white">{selectedFaculty.department_name || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Assignments</p>
                <p className="text-white">{selectedFaculty.assignments_count} subjects</p>
              </div>
            </div>
            <button
              onClick={() => setShowViewModal(false)}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
