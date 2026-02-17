// 👨‍🎓 STUDENT MANAGEMENT - Admin Component
// Add students, manage enrollments, bulk upload
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function StudentManagement() {
  const [students, setStudents] = useState<any[]>([])
  const [divisions, setDivisions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState('')
  const [academicYear, setAcademicYear] = useState<any>(null)

  const [formData, setFormData] = useState({
    student_name: '',
    gr_number: '',
    date_of_birth: '',
    email: '',
    mobile: '',
    primary_division_id: '',
  })

  const [bulkData, setBulkData] = useState<any[]>([])
  const [bulkPreview, setBulkPreview] = useState(false)

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

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      // Get students
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          *,
          divisions(division_name)
        `)
        .eq('institution_id', userData.institution_id)
        .eq('academic_year_id', yearData?.id)
        .order('student_name')

      setStudents(studentsData || [])

      // Get divisions
      const { data: divisionsData } = await supabase
        .from('divisions')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('division_name')

      setDivisions(divisionsData || [])

      // Get subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('subject_name')

      setSubjects(subjectsData || [])

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingStudent(null)
    setFormData({
      student_name: '',
      gr_number: '',
      date_of_birth: '',
      email: '',
      mobile: '',
      primary_division_id: '',
    })
    setShowModal(true)
  }

  const handleEdit = (student: any) => {
    setEditingStudent(student)
    setFormData({
      student_name: student.student_name,
      gr_number: student.gr_number,
      date_of_birth: student.date_of_birth,
      email: student.email || '',
      mobile: student.mobile || '',
      primary_division_id: student.primary_division_id,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.student_name || !formData.gr_number || !formData.date_of_birth || !formData.primary_division_id) {
      setMessage({ type: 'error', text: 'Please fill required fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      const data: any = {
        ...formData,
        gr_number: formData.gr_number.toUpperCase(),
        student_code: formData.gr_number.toUpperCase(),
        full_name: formData.student_name,
        institution_id: institutionId,
        academic_year_id: academicYear.id,
      }

      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(data)
          .eq('id', editingStudent.id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Student updated!' })
      } else {
        const { error, data: newStudent } = await supabase
          .from('students')
          .insert([data])
          .select()
          .single()

        if (error) throw error

        // Auto-enroll in all subjects of primary division
        await autoEnrollStudent(newStudent.id, data.primary_division_id)

        setMessage({ type: 'success', text: '✓ Student added and auto-enrolled!' })
      }

      setShowModal(false)
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save' })
    }
  }

  const autoEnrollStudent = async (studentId: string, divisionId: string) => {
    try {
      // Get division info
      const division = divisions.find(d => d.id === divisionId)
      if (!division) return

      // Get subjects assigned to this division
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('subject_id')
        .eq('division_id', divisionId)
        .eq('academic_year_id', academicYear.id)

      const uniqueSubjects = Array.from(new Set(assignments?.map(a => a.subject_id) || []))

      // Enroll student in all these subjects
      const enrollments = uniqueSubjects.map(subjectId => ({
        student_id: studentId,
        subject_id: subjectId,
        division_id: divisionId,
        academic_year_id: academicYear.id,
      }))

      if (enrollments.length > 0) {
        await supabase
          .from('student_subject_enrollments')
          .insert(enrollments)
      }
    } catch (error) {
      console.error('Auto-enroll error:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student? This will also remove their enrollments.')) return

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✓ Student deleted!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const openEnrollmentModal = async (student: any) => {
    setSelectedStudent(student)
    
    // Get current enrollments
    const { data: enrollmentsData } = await supabase
      .from('student_subject_enrollments')
      .select(`
        *,
        subjects(subject_name, subject_code),
        divisions(division_name)
      `)
      .eq('student_id', student.id)

    setEnrollments(enrollmentsData || [])
    setShowEnrollmentModal(true)
  }

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()))
      
      // Skip header row
      const dataRows = rows.slice(1).filter(row => row.length >= 4 && row[0])
      
      const parsed = dataRows.map(row => ({
        student_name: row[0],
        gr_number: row[1]?.toUpperCase(),
        date_of_birth: row[2],
        division_name: row[3],
        email: row[4] || '',
        mobile: row[5] || '',
      }))

      setBulkData(parsed)
      setBulkPreview(true)
    }
    reader.readAsText(file)
  }

  const processBulkUpload = async () => {
    try {
      let successCount = 0
      let errorCount = 0

      for (const row of bulkData) {
        try {
          const division = divisions.find(d => d.division_name === row.division_name)
          if (!division) {
            errorCount++
            continue
          }

          const { data: newStudent, error: studentError } = await supabase
            .from('students')
            .insert([{
              student_name: row.student_name,
              full_name: row.student_name,
              student_code: row.gr_number || `STU-${Date.now()}`,
              gr_number: row.gr_number,
              date_of_birth: row.date_of_birth,
              email: row.email,
              mobile: row.mobile,
              primary_division_id: division.id,
              division_id: division.id,
              institution_id: institutionId,
              academic_year_id: academicYear.id,
            }])
            .select()
            .single()

          if (studentError) {
            errorCount++
            continue
          }

          await autoEnrollStudent(newStudent.id, division.id)
          successCount++
        } catch (err) {
          errorCount++
        }
      }

      setMessage({ 
        type: 'success', 
        text: `✓ Uploaded ${successCount} students! ${errorCount > 0 ? `${errorCount} errors.` : ''}` 
      })
      setShowBulkUpload(false)
      setBulkPreview(false)
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Bulk upload failed' })
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
          <h2 className="text-2xl font-bold text-white mb-2">Student Management</h2>
          <p className="text-slate-400">Add students and manage their subject enrollments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            📤 Bulk Upload
          </button>
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add Student
          </button>
        </div>
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

      {/* Students Table */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-700/50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300">Student Name</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">GR Number</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Division</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">DOB</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Enrollments</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">👨‍🎓</div>
                    No students yet. Click "Add Student" to create one.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{student.student_name}</div>
                      {student.email && (
                        <div className="text-xs text-slate-400">{student.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded font-mono text-sm">
                        {student.gr_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-white">
                      {student.divisions?.division_name}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 text-sm">
                      {new Date(student.date_of_birth).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openEnrollmentModal(student)}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm"
                      >
                        📝 Manage
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
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
      </div>

      {/* CSV Template Download */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1 text-sm text-slate-400">
            <p className="mb-2"><strong className="text-white">Bulk Upload Format:</strong></p>
            <p>CSV with columns: StudentName, GRNumber, DateOfBirth (YYYY-MM-DD), Division, Email, Mobile</p>
            <p className="mt-2">Students will be auto-enrolled in all subjects of their primary division.</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {editingStudent ? 'Edit Student' : 'Add Student'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Student Name *</label>
                  <input
                    type="text"
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Rahul Sharma"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">GR Number *</label>
                  <input
                    type="text"
                    value={formData.gr_number}
                    onChange={(e) => setFormData({ ...formData, gr_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 uppercase font-mono"
                    placeholder="GR2025001"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Primary Division *</label>
                  <select
                    value={formData.primary_division_id}
                    onChange={(e) => setFormData({ ...formData, primary_division_id: e.target.value })}
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
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    placeholder="student@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mobile (Optional)</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    placeholder="9876543210"
                  />
                </div>
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
                {editingStudent ? 'Update' : 'Add'} Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal - Simplified for brevity */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Bulk Upload Students</h3>
              <button onClick={() => { setShowBulkUpload(false); setBulkPreview(false) }} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            {!bulkPreview ? (
              <div>
                <p className="text-slate-400 mb-4">Upload a CSV file with student data</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  className="w-full text-white"
                />
              </div>
            ) : (
              <div>
                <p className="text-emerald-400 mb-4">Preview: {bulkData.length} students</p>
                <div className="max-h-64 overflow-y-auto mb-4">
                  {bulkData.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="text-sm text-slate-400 mb-1">
                      {row.student_name} • {row.gr_number} • {row.division_name}
                    </div>
                  ))}
                  {bulkData.length > 5 && <div className="text-xs text-slate-500">...and {bulkData.length - 5} more</div>}
                </div>
                <button
                  onClick={processBulkUpload}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl"
                >
                  Upload {bulkData.length} Students
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}