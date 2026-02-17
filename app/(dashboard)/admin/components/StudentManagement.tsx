// 👨‍🎓 STUDENT MANAGEMENT - Admin Component
// Add students, manage, bulk upload (Excel), export, template
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { downloadTemplate, downloadExcel, parseExcel, parseDate } from '@/lib/excel-utils'

const STUDENT_COLUMNS = [
  { header: 'Full Name', key: 'full_name', width: 25 },
  { header: 'GR Number', key: 'gr_number', width: 15 },
  { header: 'Roll Number', key: 'roll_number', width: 12 },
  { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
  { header: 'Division', key: 'division_name', width: 20 },
  { header: 'Parent Name', key: 'parent_name', width: 20 },
  { header: 'Parent Phone', key: 'parent_phone', width: 15 },
  { header: 'Email', key: 'email', width: 20 },
  { header: 'Phone', key: 'phone', width: 15 },
]
const STUDENT_SAMPLE = [
  { full_name: 'Rahul Sharma', gr_number: 'GR2025001', roll_number: '1', date_of_birth: '2008-05-15', division_name: 'XI SCI A', parent_name: 'Mr. Sharma', parent_phone: '9876543210', email: '', phone: '' },
]

export default function StudentManagement() {
  const [students, setStudents] = useState<any[]>([])
  const [divisions, setDivisions] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [institutionId, setInstitutionId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [formData, setFormData] = useState({
    full_name: '', gr_number: '', roll_number: '', date_of_birth: '',
    division_id: '', email: '', phone: '', parent_name: '', parent_phone: '', address: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase.from('users').select('institution_id').eq('id', session.user.id).single()
      if (!userData) return
      setInstitutionId(userData.institution_id)

      const [divRes, stdRes] = await Promise.all([
        supabase.from('divisions').select('id, division_name, standard_id').eq('institution_id', userData.institution_id).order('division_name'),
        supabase.from('standards').select('id, standard_name').eq('institution_id', userData.institution_id).order('standard_name'),
      ])

      // Try fetching students - handle different column names
      let studRes = await supabase.from('students').select('*').eq('institution_id', userData.institution_id).order('created_at', { ascending: false })
      if (studRes.error) {
        // Try without order
        studRes = await supabase.from('students').select('*').eq('institution_id', userData.institution_id)
      }

      const divMap = new Map((divRes.data || []).map(d => [d.id, d.division_name]))
      const enriched = (studRes.data || []).map(s => ({
        ...s,
        // Normalize: ensure full_name is populated from whichever column exists
        full_name: s.full_name || s.name || s.student_name || '',
        division_name: divMap.get(s.division_id) || '-'
      }))
      setStudents(enriched)
      setDivisions(divRes.data || [])
      setStandards(stdRes.data || [])
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  const handleAdd = () => {
    setEditingStudent(null)
    setFormData({ full_name: '', gr_number: '', roll_number: '', date_of_birth: '', division_id: '', email: '', phone: '', parent_name: '', parent_phone: '', address: '' })
    setShowModal(true)
  }

  const handleEdit = (s: any) => {
    setEditingStudent(s)
    setFormData({ full_name: s.full_name || s.name || s.student_name || '', gr_number: s.gr_number || '', roll_number: s.roll_number || '', date_of_birth: s.date_of_birth || '', division_id: s.division_id || '', email: s.email || '', phone: s.phone || '', parent_name: s.parent_name || '', parent_phone: s.parent_phone || '', address: s.address || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.full_name || !formData.gr_number || !formData.division_id) {
      setMessage({ type: 'error', text: 'Name, GR Number, and Division are required' }); return
    }
    setSaving(true); setMessage(null)
    try {
      // Detect name column
      let nameColumn = 'full_name'
      const testQ = await supabase.from('students').select('full_name').limit(0)
      if (testQ.error?.message?.includes('full_name')) {
        const testN = await supabase.from('students').select('name').limit(0)
        nameColumn = testN.error ? 'student_name' : 'name'
      }

      const data: any = { ...formData, gr_number: formData.gr_number.toUpperCase().trim() }
      data.student_code = data.gr_number  // Populate student_code from GR number
      // Use detected column name
      if (nameColumn !== 'full_name') {
        data[nameColumn] = data.full_name
        delete data.full_name
      }

      if (editingStudent) {
        const { error } = await supabase.from('students').update(data).eq('id', editingStudent.id)
        if (error) throw error
        setMessage({ type: 'success', text: 'Student updated!' })
      } else {
        data.institution_id = institutionId; data.is_active = true
        const { error } = await supabase.from('students').insert([data])
        if (error) throw error
        setMessage({ type: 'success', text: 'Student added!' })
      }
      setShowModal(false); fetchData(); setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return
    try {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      setMessage({ type: 'success', text: 'Student deleted' }); fetchData(); setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setSaving(true); setMessage(null)
    try {
      const rows = await parseExcel(file); let success = 0, errors = 0, firstError = ''

      // Detect name column
      let nameColumn = 'full_name'
      const testQ = await supabase.from('students').select('full_name').limit(0)
      if (testQ.error?.message?.includes('full_name')) {
        const testN = await supabase.from('students').select('name').limit(0)
        nameColumn = testN.error ? 'student_name' : 'name'
      }

      for (const row of rows) {
        try {
          const fullName = (row['Full Name'] || row['full_name'] || row['Name'] || '').trim()
          if (!fullName) { errors++; continue }
          const div = divisions.find(d => d.division_name.toLowerCase().trim() === (row['Division'] || row['division_name'] || '').toLowerCase().trim())
          const rawDob = row['Date of Birth'] || row['date_of_birth'] || ''
          const dob = parseDate(rawDob)
          const grNum = String(row['GR Number'] || row['gr_number'] || '').toUpperCase().trim()

          const insertData: any = {
            [nameColumn]: fullName,
            institution_id: institutionId,
            is_active: true,
            student_code: grNum || `STU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          }
          if (div?.id) insertData.division_id = div.id
          if (grNum) insertData.gr_number = grNum
          if (dob) insertData.date_of_birth = dob
          const rollNum = String(row['Roll Number'] || row['roll_number'] || '').trim()
          if (rollNum) insertData.roll_number = rollNum
          const parentName = (row['Parent Name'] || row['parent_name'] || '').trim()
          if (parentName) insertData.parent_name = parentName
          const parentPhone = String(row['Parent Phone'] || row['parent_phone'] || '').trim()
          if (parentPhone) insertData.parent_phone = parentPhone
          const email = (row['Email'] || row['email'] || '').trim()
          if (email) insertData.email = email
          const phone = (row['Phone'] || row['phone'] || '').trim()
          if (phone) insertData.phone = phone

          const { error } = await supabase.from('students').insert(insertData)
          if (error) { if (!firstError) firstError = `${fullName}: ${error.message}`; errors++ }
          else success++
        } catch { errors++ }
      }
      const hint = firstError.includes('schema cache') ? ' Run FIX_STUDENTS_TABLE.sql then reload schema cache.' : ''
      setMessage({ type: success > 0 ? 'success' : 'error', text: `Imported ${success} students.${errors > 0 ? ` ${errors} failed.${firstError ? ' ' + firstError : ''}${hint}` : ''}` })
      setShowUploadModal(false); fetchData()
    } catch { setMessage({ type: 'error', text: 'Failed to parse file' }) }
    finally { setSaving(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const filtered = students.filter(s => {
    const name = s.full_name || s.name || s.student_name || ''
    const matchSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.gr_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchDiv = !filterDivision || s.division_id === filterDivision
    return matchSearch && matchDiv
  })

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-white mb-1">Student Management</h2><p className="text-slate-400">Add, edit, upload, and manage students ({students.length} total)</p></div>
        <div className="flex gap-2">
          <button onClick={() => downloadTemplate(STUDENT_COLUMNS, 'students', STUDENT_SAMPLE)} className="px-3 py-2 bg-white/5 text-slate-300 rounded-lg text-sm border border-white/10">📄 Template</button>
          <button onClick={() => setShowUploadModal(true)} className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm border border-emerald-500/30">📤 Upload</button>
          {students.length > 0 && <button onClick={() => downloadExcel(students.map(s => ({ full_name: s.full_name, gr_number: s.gr_number, roll_number: s.roll_number || '', date_of_birth: s.date_of_birth || '', division_name: s.division_name, parent_name: s.parent_name || '', parent_phone: s.parent_phone || '', email: s.email || '', phone: s.phone || '' })), STUDENT_COLUMNS, 'students_list')} className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm border border-blue-500/30">📥 Export</button>}
          <button onClick={handleAdd} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-lg text-sm">+ Add Student</button>
        </div>
      </div>

      {message && <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Search by name or GR number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-white text-sm placeholder-slate-500" />
          <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-white text-sm"><option value="">All Divisions</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.division_name}</option>)}</select>
        </div>
      </div>

      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full"><thead><tr className="border-b border-white/10 bg-slate-700/50">
          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">#</th>
          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Name</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">GR No.</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Roll</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Division</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">DOB</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300 w-28">Actions</th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">👨‍🎓</div>No students found. {students.length === 0 ? 'Click "+ Add Student" or "📤 Upload" to add students.' : 'Try a different search.'}</td></tr>
          ) : filtered.map((s, i) => (
            <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-3 px-4 text-slate-500">{i + 1}</td>
              <td className="py-3 px-4"><div className="text-white font-medium">{s.full_name}</div>{s.parent_name && <div className="text-xs text-slate-500">Parent: {s.parent_name}</div>}</td>
              <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-slate-700 text-amber-400 rounded font-mono text-sm">{s.gr_number}</span></td>
              <td className="py-3 px-4 text-center text-slate-400">{s.roll_number || '-'}</td>
              <td className="py-3 px-4 text-center text-white">{s.division_name}</td>
              <td className="py-3 px-4 text-center text-slate-400 text-sm">{s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('en-IN') : '-'}</td>
              <td className="py-3 px-4 text-center"><div className="flex justify-center gap-1"><button onClick={() => handleEdit(s)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded" title="Edit">✏️</button><button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded" title="Delete">🗑️</button></div></td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-4">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Full Name *</label><input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="Rahul Sharma" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">GR Number *</label><input type="text" value={formData.gr_number} onChange={e => setFormData({ ...formData, gr_number: e.target.value.toUpperCase() })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white uppercase font-mono" placeholder="GR2025001" /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Roll Number</label><input type="text" value={formData.roll_number} onChange={e => setFormData({ ...formData, roll_number: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="1" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Date of Birth</label><input type="date" value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Division *</label><select value={formData.division_id} onChange={e => setFormData({ ...formData, division_id: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white"><option value="">Select</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.division_name}</option>)}</select></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Parent Name</label><input type="text" value={formData.parent_name} onChange={e => setFormData({ ...formData, parent_name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Parent Phone</label><input type="tel" value={formData.parent_phone} onChange={e => setFormData({ ...formData, parent_phone: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Email</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Phone</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl">Cancel</button><button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving ? 'Saving...' : editingStudent ? 'Update' : 'Add Student'}</button></div>
        </div></div></div>)}

      {/* Upload Modal */}
      {showUploadModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Upload Students from Excel</h3>
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm text-blue-400">📋 Download template, fill in student data, then upload. Division column must match exactly.</div>
          <button onClick={() => downloadTemplate(STUDENT_COLUMNS, 'students', STUDENT_SAMPLE)} className="w-full px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10">📄 Download Template</button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center"><input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} disabled={saving} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg disabled:opacity-50">{saving ? 'Uploading...' : 'Choose Excel File'}</button></div>
          <button onClick={() => setShowUploadModal(false)} className="w-full px-4 py-3 bg-slate-700 text-white rounded-xl">Close</button>
        </div></div></div>)}
    </div>
  )
}
