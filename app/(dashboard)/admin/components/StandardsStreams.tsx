'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StandardsStreams() {
  const [activeTab, setActiveTab] = useState<'standards' | 'streams'>('standards')
  const [standards, setStandards] = useState<any[]>([])
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState<string>('')

  const [formData, setFormData] = useState({
    name: '',
    code: '',
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Get current user's institution
      let instId = institutionId
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: userData } = await supabase.from('users').select('institution_id').eq('id', session.user.id).single()
        if (userData) {
          instId = userData.institution_id
          setInstitutionId(userData.institution_id)
        }
      }

      const { data: standardsData } = await supabase
        .from('standards')
        .select('*')
        .eq('institution_id', instId)
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
    setEditingItem(null)
    setFormData({ name: '', code: '' })
    setShowModal(true)
  }

  const handleEdit = (item: any) => {
    setEditingItem(item)
    setFormData({
      name: activeTab === 'standards' ? item.standard_name : item.stream_name,
      code: activeTab === 'standards' ? item.standard_code : item.stream_code,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      setMessage({ type: 'error', text: 'Please fill all fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      const table = activeTab === 'standards' ? 'standards' : 'streams'
      const nameField = activeTab === 'standards' ? 'standard_name' : 'stream_name'
      const codeField = activeTab === 'standards' ? 'standard_code' : 'stream_code'

      const data: any = {
        [nameField]: formData.name,
        [codeField]: formData.code.toUpperCase(),
      }

      if (editingItem) {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', editingItem.id)

        if (error) throw error
        setMessage({ type: 'success', text: `✓ ${activeTab === 'standards' ? 'Standard' : 'Stream'} updated!` })
      } else {
        // Include institution_id for new inserts (required by RLS)
        data.institution_id = institutionId
        data.created_at = new Date().toISOString()

        const { error } = await supabase
          .from(table)
          .insert([data])

        if (error) throw error
        setMessage({ type: 'success', text: `✓ ${activeTab === 'standards' ? 'Standard' : 'Stream'} created!` })
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
    if (!confirm(`Delete this ${activeTab === 'standards' ? 'standard' : 'stream'}?`)) return

    try {
      const table = activeTab === 'standards' ? 'standards' : 'streams'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: `✓ ${activeTab === 'standards' ? 'Standard' : 'Stream'} deleted!` })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  const currentData = activeTab === 'standards' ? standards : streams

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Standards & Streams</h2>
        <p className="text-slate-400">Manage academic standards (XI, XII) and streams (Science, Commerce, Arts)</p>
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

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('standards')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            activeTab === 'standards'
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          📚 Standards ({standards.length})
        </button>
        <button
          onClick={() => setActiveTab('streams')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            activeTab === 'streams'
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          🎓 Streams ({streams.length})
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {activeTab === 'standards' ? 'Academic Standards' : 'Academic Streams'}
          </h3>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-lg"
          >
            + Add {activeTab === 'standards' ? 'Standard' : 'Stream'}
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentData.map((item) => (
            <div
              key={item.id}
              className="bg-slate-700/50 border border-white/10 rounded-lg p-4 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-1">
                    {activeTab === 'standards' ? item.standard_name : item.stream_name}
                  </h4>
                  <p className="text-sm text-slate-400">
                    Code: {activeTab === 'standards' ? item.standard_code : item.stream_code}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {currentData.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">{activeTab === 'standards' ? '📚' : '🎓'}</div>
            <p>No {activeTab} yet. Click "Add {activeTab === 'standards' ? 'Standard' : 'Stream'}" to create one.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-6">
              {editingItem ? 'Edit' : 'Add'} {activeTab === 'standards' ? 'Standard' : 'Stream'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {activeTab === 'standards' ? 'Standard' : 'Stream'} Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white"
                  placeholder={activeTab === 'standards' ? 'XI' : 'Science'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white uppercase"
                  placeholder={activeTab === 'standards' ? 'XI' : 'SCI'}
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
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}