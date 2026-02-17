// 📝 TOPIC MANAGEMENT - Add/Edit/Delete topics for subjects
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { downloadTemplate, downloadExcel, parseExcel, TOPIC_COLUMNS, TOPIC_SAMPLE_DATA } from '@/lib/excel-utils'

export default function TopicManagement() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [saving, setSaving] = useState(false)
  const [institutionId, setInstitutionId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [filterStandard, setFilterStandard] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [formData, setFormData] = useState({ topic_name: '', topic_number: 1, default_lectures: 1, topic_id_number: '', standard_id: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (selectedSubject) fetchTopics() }, [selectedSubject])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase.from('users').select('institution_id').eq('id', session.user.id).single()
      if (!userData) return
      setInstitutionId(userData.institution_id)
      const [subRes, stdRes] = await Promise.all([
        supabase.from('subjects').select('id, subject_name, subject_code, standard_id').eq('institution_id', userData.institution_id).order('subject_name'),
        supabase.from('standards').select('id, standard_name').eq('institution_id', userData.institution_id).order('standard_name'),
      ])
      setSubjects(subRes.data || [])
      setStandards(stdRes.data || [])
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  const fetchTopics = async () => {
    if (!selectedSubject) return
    setLoadingTopics(true)
    try {
      const { data, error } = await supabase.from('topics').select('*').eq('subject_id', selectedSubject).eq('institution_id', institutionId).order('topic_number', { ascending: true })
      if (error) { const { data: fb } = await supabase.from('topics').select('*').eq('subject_id', selectedSubject); setTopics(fb || []) }
      else { setTopics(data || []) }
    } catch { setTopics([]) }
    finally { setLoadingTopics(false) }
  }

  const handleAdd = () => {
    setEditingTopic(null)
    const sub = subjects.find(s => s.id === selectedSubject)
    setFormData({ topic_name: '', topic_number: topics.length + 1, default_lectures: 1, topic_id_number: '', standard_id: sub?.standard_id || '' })
    setShowModal(true)
  }

  const handleEdit = (topic: any) => {
    setEditingTopic(topic)
    setFormData({ topic_name: topic.topic_name || '', topic_number: topic.topic_number || 0, default_lectures: topic.default_lectures || 1, topic_id_number: topic.topic_id_number || '', standard_id: topic.standard_id || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.topic_name) { setMessage({ type: 'error', text: 'Topic name is required' }); return }
    setSaving(true); setMessage(null)
    try {
      const data: any = { topic_name: formData.topic_name, topic_number: formData.topic_number, default_lectures: formData.default_lectures, topic_id_number: formData.topic_id_number || '', standard_id: formData.standard_id || null }
      if (editingTopic) {
        const { error } = await supabase.from('topics').update(data).eq('id', editingTopic.id)
        if (error) throw error
        setMessage({ type: 'success', text: 'Topic updated!' })
      } else {
        data.institution_id = institutionId; data.subject_id = selectedSubject; data.is_active = true; data.created_at = new Date().toISOString()
        const { error } = await supabase.from('topics').insert([data])
        if (error) throw error
        setMessage({ type: 'success', text: 'Topic added!' })
      }
      setShowModal(false); fetchTopics(); setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this topic?')) return
    try {
      const { error } = await supabase.from('topics').delete().eq('id', id)
      if (error) throw error
      setMessage({ type: 'success', text: 'Topic deleted' }); fetchTopics(); setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedSubject) return
    setSaving(true); setMessage(null)
    try {
      const rows = await parseExcel(file); let success = 0, errors = 0
      const sub = subjects.find(s => s.id === selectedSubject)
      for (const row of rows) {
        try {
          await supabase.from('topics').insert({ institution_id: institutionId, subject_id: selectedSubject, topic_name: row['Topic Name'] || row['topic_name'] || '', topic_number: parseInt(row['Sequence Order'] || row['topic_number'] || String(success + 1)), default_lectures: parseFloat(row['Default Lectures'] || row['default_lectures'] || '1'), topic_id_number: row['Topic Number'] || row['topic_id_number'] || '', standard_id: sub?.standard_id || null, is_active: true, created_at: new Date().toISOString() })
          success++
        } catch { errors++ }
      }
      setMessage({ type: success > 0 ? 'success' : 'error', text: `Imported ${success} topics.${errors > 0 ? ` ${errors} failed.` : ''}` })
      setShowUploadModal(false); fetchTopics()
    } catch { setMessage({ type: 'error', text: 'Failed to parse file' }) }
    finally { setSaving(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const filteredSubjects = subjects.filter(s => { const matchStd = !filterStandard || s.standard_id === filterStandard; const matchSearch = !searchTerm || s.subject_name.toLowerCase().includes(searchTerm.toLowerCase()); return matchStd && matchSearch })
  const selectedSubjectInfo = subjects.find(s => s.id === selectedSubject)
  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Topic Management</h2><p className="text-slate-400">Add, edit, and manage syllabus topics for each subject</p></div>
      {message && <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

      {/* Subject Selection */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Standard</label>
            <select value={filterStandard} onChange={e => { setFilterStandard(e.target.value); setSelectedSubject('') }} className="w-full bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-white text-sm"><option value="">All Standards</option>{standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Search</label>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search subjects..." className="w-full bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-white text-sm placeholder-slate-500" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Select Subject *</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-lg py-2 px-3 text-white text-sm"><option value="">Choose Subject</option>{filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>)}</select></div>
        </div>
      </div>

      {/* Topics List */}
      {selectedSubject ? (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl">
          <div className="flex flex-wrap items-center justify-between p-4 border-b border-white/10 gap-2">
            <h3 className="text-lg font-semibold text-white">Topics — {selectedSubjectInfo?.subject_name} <span className="text-sm text-slate-500">({topics.length})</span></h3>
            <div className="flex gap-2">
              <button onClick={() => downloadTemplate(TOPIC_COLUMNS, `topics_${selectedSubjectInfo?.subject_code}`, TOPIC_SAMPLE_DATA)} className="px-3 py-2 bg-white/5 text-slate-300 rounded-lg text-sm border border-white/10">📄 Template</button>
              <button onClick={() => setShowUploadModal(true)} className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm border border-emerald-500/30">📤 Upload</button>
              {topics.length > 0 && <button onClick={() => downloadExcel(topics.map((t, i) => ({ 'Topic Number': t.topic_id_number || '', 'Topic Name': t.topic_name, 'Default Lectures': t.default_lectures, 'Sequence Order': t.topic_number || i + 1 })), TOPIC_COLUMNS, `topics_${selectedSubjectInfo?.subject_code}`)} className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm border border-blue-500/30">📥 Export</button>}
              <button onClick={handleAdd} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-lg text-sm">+ Add Topic</button>
            </div>
          </div>
          {loadingTopics ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div></div> : topics.length > 0 ? (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-white/10 bg-white/5"><th className="text-left py-3 px-4 text-sm font-semibold text-slate-300 w-16">#</th><th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Topic Name</th><th className="text-center py-3 px-4 text-sm font-semibold text-slate-300 w-20">ID</th><th className="text-center py-3 px-4 text-sm font-semibold text-slate-300 w-24">Lectures</th><th className="text-center py-3 px-4 text-sm font-semibold text-slate-300 w-32">Actions</th></tr></thead>
                <tbody>{topics.map((topic, i) => (
                  <tr key={topic.id} className="border-b border-white/5 hover:bg-white/5"><td className="py-3 px-4 text-slate-500 font-mono text-sm">{topic.topic_number || i + 1}</td><td className="py-3 px-4 text-white">{topic.topic_name}</td><td className="py-3 px-4 text-center text-slate-400 text-xs font-mono">{topic.topic_id_number || '-'}</td><td className="py-3 px-4 text-center text-amber-400 font-semibold">{topic.default_lectures}</td>
                    <td className="py-3 px-4 text-center"><div className="flex justify-center gap-1"><button onClick={() => handleEdit(topic)} className="px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded">Edit</button><button onClick={() => handleDelete(topic.id)} className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded">Delete</button></div></td></tr>
                ))}</tbody></table>
              <div className="p-3 text-xs text-slate-500 border-t border-white/5">Total: {topics.length} topics | {topics.reduce((a, t) => a + (t.default_lectures || 0), 0)} lectures</div></div>
          ) : (<div className="text-center py-12"><div className="text-4xl mb-4">📝</div><p className="text-slate-400">No topics yet for this subject</p><p className="text-xs text-slate-500 mt-1">Click &quot;+ Add Topic&quot; or &quot;📤 Upload&quot; to import from Excel</p></div>)}
        </div>
      ) : (<div className="bg-slate-700/30 border border-white/10 rounded-xl p-12 text-center"><div className="text-5xl mb-4">📝</div><h3 className="text-xl font-medium text-white mb-2">Select a Subject</h3><p className="text-slate-400">Choose a subject above to view and manage its topics</p></div>)}

      {/* Add/Edit Modal */}
      {showModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full"><h3 className="text-xl font-bold text-white mb-4">{editingTopic ? 'Edit Topic' : 'Add New Topic'}</h3>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Topic Name *</label><input type="text" value={formData.topic_name} onChange={e => setFormData({ ...formData, topic_name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., Atomic Structure" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Seq #</label><input type="number" value={formData.topic_number} onChange={e => setFormData({ ...formData, topic_number: parseInt(e.target.value) || 0 })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Lectures</label><input type="number" min="0.5" step="0.5" value={formData.default_lectures} onChange={e => setFormData({ ...formData, default_lectures: parseFloat(e.target.value) || 1 })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-1">Topic ID</label><input type="text" value={formData.topic_id_number} onChange={e => setFormData({ ...formData, topic_id_number: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="CH-01" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Standard</label><select value={formData.standard_id} onChange={e => setFormData({ ...formData, standard_id: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white"><option value="">Select Standard</option>{standards.map(s => <option key={s.id} value={s.id}>{s.standard_name}</option>)}</select></div>
          <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl">Cancel</button><button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving ? 'Saving...' : editingTopic ? 'Update' : 'Add Topic'}</button></div>
        </div></div></div>)}

      {/* Upload Modal */}
      {showUploadModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full"><h3 className="text-xl font-bold text-white mb-4">Upload Topics — {selectedSubjectInfo?.subject_name}</h3>
        <div className="space-y-4">
          <button onClick={() => downloadTemplate(TOPIC_COLUMNS, `topics_${selectedSubjectInfo?.subject_code}`, TOPIC_SAMPLE_DATA)} className="w-full px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10">📄 Download Template</button>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center"><input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} disabled={saving} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg disabled:opacity-50">{saving ? 'Uploading...' : 'Choose Excel File'}</button></div>
          <button onClick={() => setShowUploadModal(false)} className="w-full px-4 py-3 bg-slate-700 text-white rounded-xl">Close</button>
        </div></div></div>)}
    </div>
  )
}
