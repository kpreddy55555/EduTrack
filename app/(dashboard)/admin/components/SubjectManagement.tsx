'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SubjectManagement() {
    const [subjects, setSubjects] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<any>(null)
  const [selectedSubject, setSelectedSubject] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState('')

  const [formData, setFormData] = useState({
    subject_name: '',
    subject_code: '',
  })

  const [mappings, setMappings] = useState<any[]>([])
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set())

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

      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('subject_name')

      setSubjects(subjectsData || [])

      const { data: standardsData } = await supabase
        .from('standards')
        .select('*')
        .order('standard_name')

      const { data: streamsData } = await supabase
        .from('streams')
        .select('*')
        .order('stream_name')

      setStandards(standardsData || [])
      setStreams(streamsData || [])

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingSubject(null)
    setFormData({
      subject_name: '',
      subject_code: '',
    })
    setShowModal(true)
  }

  const handleEdit = (subject: any) => {
    setEditingSubject(subject)
    setFormData({
      subject_name: subject.subject_name,
      subject_code: subject.subject_code,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.subject_name || !formData.subject_code) {
      setMessage({ type: 'error', text: 'Please fill all fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      const data = {
        ...formData,
        institution_id: institutionId,
      }

      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update(data)
          .eq('id', editingSubject.id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Subject updated!' })
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([data])

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Subject created! Now set up mappings.' })
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
    if (!confirm('Delete this subject? This will affect all related data.')) return

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✓ Subject deleted!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const openMappingModal = async (subject: any) => {
    setSelectedSubject(subject)
    
    // Fetch existing mappings for this subject
    const { data: existingMappings } = await supabase
      .from('subject_mappings')
      .select('standard_id, stream_id')
      .eq('subject_id', subject.id)

    const mappingKeys = new Set(
      existingMappings?.map(m => `${m.standard_id}-${m.stream_id}`) || []
    )
    setSelectedMappings(mappingKeys)

    // Generate all possible mappings
    const allMappings = standards.flatMap(standard =>
      streams.map(stream => ({
        standard,
        stream,
        key: `${standard.id}-${stream.id}`
      }))
    )
    setMappings(allMappings)

    setShowMappingModal(true)
  }

  const toggleMapping = (key: string) => {
    const newSelected = new Set(selectedMappings)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedMappings(newSelected)
  }

  const saveMappings = async () => {
    if (!selectedSubject) return

    try {
      // Delete all existing mappings
      await supabase
        .from('subject_mappings')
        .delete()
        .eq('subject_id', selectedSubject.id)

      // Insert new mappings
      if (selectedMappings.size > 0) {
        const inserts = Array.from(selectedMappings).map(key => {
          const [standard_id, stream_id] = key.split('-')
          return {
            subject_id: selectedSubject.id,
            standard_id,
            stream_id,
          }
        })

        const { error } = await supabase
          .from('subject_mappings')
          .insert(inserts)

        if (error) throw error
      }

      setMessage({ type: 'success', text: `✓ Saved ${selectedMappings.size} mappings for ${selectedSubject.subject_name}!` })
      setShowMappingModal(false)
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to save mappings' })
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
          <h2 className="text-2xl font-bold text-white mb-2">Subject Management</h2>
          <p className="text-slate-400">Manage subjects and their standard-stream mappings</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Subject
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

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <div className="font-semibold text-white mb-1">About Subject Mappings</div>
            <p className="text-sm text-slate-400">
              Each subject can be mapped to multiple Standard-Stream combinations. For example, "Mathematics" can be available for both "XI-Science" and "XI-Commerce".
            </p>
          </div>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-700/50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300">Subject Name</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Code</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Mappings</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">📖</div>
                    No subjects yet. Click "Add Subject" to create one.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => (
                  <tr key={subject.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{subject.subject_name}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg text-sm font-mono">
                        {subject.subject_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openMappingModal(subject)}
                        className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium"
                      >
                        🔗 Setup Mappings
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(subject.id)}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject Name *</label>
                <input
                  type="text"
                  value={formData.subject_name}
                  onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Mathematics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject Code *</label>
                <input
                  type="text"
                  value={formData.subject_code}
                  onChange={(e) => setFormData({ ...formData, subject_code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
                  placeholder="MATH"
                />
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
                {editingSubject ? 'Update' : 'Create'} Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mappings Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">
                  Setup Mappings for {selectedSubject?.subject_name}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Select which Standard-Stream combinations this subject applies to
                </p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="text-sm text-slate-400">
                  {selectedMappings.size} of {mappings.length} combinations selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedMappings(new Set(mappings.map(m => m.key)))}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedMappings(new Set())}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {mappings.map((mapping) => (
                  <label
                    key={mapping.key}
                    className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg cursor-pointer border border-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMappings.has(mapping.key)}
                      onChange={() => toggleMapping(mapping.key)}
                      className="w-5 h-5 rounded border-white/10 bg-slate-700"
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {mapping.standard.standard_name} - {mapping.stream.stream_name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {mapping.standard.standard_code} / {mapping.stream.stream_code}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={saveMappings}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl"
              >
                💾 Save Mappings ({selectedMappings.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}