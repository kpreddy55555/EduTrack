'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AcademicYearManagement() {
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingYear, setEditingYear] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState('')

  const [formData, setFormData] = useState({
    year_name: '',
    start_date: '',
    end_date: '',
    is_current: false,
  })

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

      const { data: yearsData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('start_date', { ascending: false })

      setAcademicYears(yearsData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingYear(null)
    setFormData({
      year_name: '',
      start_date: '',
      end_date: '',
      is_current: false,
    })
    setShowModal(true)
  }

  const handleEdit = (year: any) => {
    setEditingYear(year)
    setFormData({
      year_name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.year_name || !formData.start_date || !formData.end_date) {
      setMessage({ type: 'error', text: 'Please fill all fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      if (formData.is_current) {
        await supabase
          .from('academic_years')
          .update({ is_current: false })
          .eq('institution_id', institutionId)
      }

      const data = {
        ...formData,
        institution_id: institutionId,
      }

      if (editingYear) {
        const { error } = await supabase
          .from('academic_years')
          .update(data)
          .eq('id', editingYear.id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Academic year updated!' })
      } else {
        const { error } = await supabase
          .from('academic_years')
          .insert([data])

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Academic year created!' })
      }

      setShowModal(false)
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this academic year? This will affect all related data.')) return

    try {
      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✓ Academic year deleted!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const setAsCurrent = async (id: string) => {
    try {
      await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('institution_id', institutionId)

      const { error } = await supabase
        .from('academic_years')
        .update({ is_current: true })
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✓ Set as current academic year!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to set as current' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  const currentYear = academicYears.find(y => y.is_current)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Academic Year Management</h2>
          <p className="text-slate-400">Manage academic years and set current year</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Academic Year
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Current Year Card */}
      {currentYear && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400 mb-1">Current Academic Year</div>
              <div className="text-2xl font-bold text-white mb-2">{currentYear.year_name}</div>
              <div className="text-sm text-slate-400">
                {new Date(currentYear.start_date).toLocaleDateString('en-IN')} - {new Date(currentYear.end_date).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div className="text-5xl">🎓</div>
          </div>
        </div>
      )}

      {/* Academic Years Table */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-700/50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300">Academic Year</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Start Date</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">End Date</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {academicYears.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">📅</div>
                    No academic years yet. Click "Add Academic Year" to create one.
                  </td>
                </tr>
              ) : (
                academicYears.map((year) => (
                  <tr key={year.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{year.year_name}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-white">
                      {new Date(year.start_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-center text-white">
                      {new Date(year.end_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {year.is_current ? (
                        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                          ✓ Current
                        </span>
                      ) : (
                        <button
                          onClick={() => setAsCurrent(year.id)}
                          className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600"
                        >
                          Set as Current
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(year)}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(year.id)}
                          disabled={year.is_current}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title={year.is_current ? "Cannot delete current year" : "Delete"}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Year Name *</label>
                <input
                  type="text"
                  value={formData.year_name}
                  onChange={(e) => setFormData({ ...formData, year_name: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="2025-26"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_current"
                  checked={formData.is_current}
                  onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                  className="w-5 h-5 rounded border-white/10 bg-slate-700"
                />
                <label htmlFor="is_current" className="text-sm text-slate-300">
                  Set as current academic year (will unset other years)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl"
              >
                {editingYear ? 'Update' : 'Create'} Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
