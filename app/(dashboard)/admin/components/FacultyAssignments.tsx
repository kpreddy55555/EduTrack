'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FacultyAssignments() {
    const [assignments, setAssignments] = useState<any[]>([])
  const [faculty, setFaculty] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [divisions, setDivisions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<any>(null)
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({
    faculty_id: '',
    subject_id: '',
    division_id: '',
    is_primary: true,
    lectures_per_week: 0,  // NEW FIELD
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

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      const { data: facultyData } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('institution_id', userData.institution_id)
        .eq('is_active', true)
        .order('full_name')

      setFaculty(facultyData || [])

      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('subject_name')

      setSubjects(subjectsData || [])

      const { data: divisionsData } = await supabase
        .from('divisions')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('division_name')

      setDivisions(divisionsData || [])

      if (yearData) {
        const { data: assignmentsData } = await supabase
          .from('faculty_assignments')
          .select('*')
          .eq('academic_year_id', yearData.id)
          .order('created_at', { ascending: false })

        if (assignmentsData && assignmentsData.length > 0) {
          const enriched = assignmentsData.map(assignment => {
            const user = facultyData?.find(f => f.id === assignment.faculty_id)
            const subject = subjectsData?.find(s => s.id === assignment.subject_id)
            const division = divisionsData?.find(d => d.id === assignment.division_id)

            return {
              ...assignment,
              users: user,
              subjects: subject,
              divisions: division
            }
          })

          setAssignments(enriched)
        } else {
          setAssignments([])
        }
      }

    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingAssignment(null)
    setFormData({
      faculty_id: '',
      subject_id: '',
      division_id: '',
      is_primary: true,
      lectures_per_week: 0,
    })
    setShowModal(true)
  }

  const handleEdit = (assignment: any) => {
    setEditingAssignment(assignment)
    setFormData({
      faculty_id: assignment.faculty_id,
      subject_id: assignment.subject_id,
      division_id: assignment.division_id,
      is_primary: assignment.is_primary,
      lectures_per_week: assignment.lectures_per_week || 0,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.faculty_id || !formData.subject_id || !formData.division_id) {
      setMessage({ type: 'error', text: 'Please fill all required fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if (!academicYear) {
      setMessage({ type: 'error', text: 'No active academic year found' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      const data = {
        faculty_id: formData.faculty_id,
        subject_id: formData.subject_id,
        division_id: formData.division_id,
        academic_year_id: academicYear.id,
        is_primary: formData.is_primary,
        lectures_per_week: formData.lectures_per_week || 0,  // SAVE NEW FIELD
        assigned_date: new Date().toISOString().split('T')[0],
      }

      if (editingAssignment) {
        const { error } = await supabase
          .from('faculty_assignments')
          .update(data)
          .eq('id', editingAssignment.id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Assignment updated successfully!' })
      } else {
        const { error } = await supabase
          .from('faculty_assignments')
          .insert([data])

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Assignment created successfully!' })
      }

      setShowModal(false)
      setTimeout(() => fetchData(), 500)
      setTimeout(() => setMessage(null), 5000)
    } catch (error: any) {
      console.error('❌ Save error:', error)
      setMessage({ 
        type: 'error', 
        text: `Failed to save: ${error.message || 'Unknown error'}` 
      })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    try {
      const { error } = await supabase
        .from('faculty_assignments')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setMessage({ type: 'success', text: '✓ Assignment deleted!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: `Failed to delete: ${error.message}` })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Faculty Assignments</h2>
          <p className="text-slate-400">Assign faculty to subjects and divisions</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Assignment
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

      {/* Assignments Table - WITH HORIZONTAL SCROLL */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">  {/* ← This enables horizontal scroll */}
          <table className="w-full min-w-[800px]">  {/* ← Minimum width ensures scroll kicks in */}
            <thead>
              <tr className="border-b border-white/10 bg-slate-700/50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300 min-w-[200px]">Faculty</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300 min-w-[120px]">Division</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300 min-w-[180px]">Subject</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 min-w-[100px]">Lectures/Week</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 min-w-[100px]">Primary</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No assignments yet. Click "Add Assignment" to create one.</p>
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">
                        {assignment.users?.full_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-400">{assignment.users?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-white">
                      {assignment.divisions?.division_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white">{assignment.subjects?.subject_name || 'N/A'}</div>
                      <div className="text-xs text-slate-400">{assignment.subjects?.subject_code}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg font-semibold">
                        {assignment.lectures_per_week || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {assignment.is_primary ? (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                          Primary
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-slate-700/50 text-slate-400 border border-slate-600">
                          Secondary
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(assignment)}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                          title="Delete"
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
        {/* Scroll hint */}
        {assignments.length > 0 && (
          <div className="bg-slate-800/50 border-t border-white/10 py-2 px-4 text-center text-xs text-slate-500">
            ← Scroll horizontally to see all columns →
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {editingAssignment ? 'Edit Assignment' : 'Add Assignment'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Faculty ({faculty.length} available)
                </label>
                <select
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Select Faculty</option>
                  {faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Division</label>
                <select
                  value={formData.division_id}
                  onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Select Division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.division_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name} ({s.subject_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* NEW: Lectures per Week field */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Lectures per Week
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.lectures_per_week}
                  onChange={(e) => setFormData({ ...formData, lectures_per_week: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="e.g., 4"
                />
                <p className="text-xs text-slate-500 mt-1">Number of lectures scheduled per week</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="w-5 h-5 rounded border-white/10 bg-slate-700"
                />
                <label htmlFor="is_primary" className="text-sm text-slate-300">
                  Primary Faculty (Main teacher for this subject)
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
                disabled={!formData.faculty_id || !formData.subject_id || !formData.division_id}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl disabled:opacity-50"
              >
                {editingAssignment ? 'Update' : 'Create'} Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}