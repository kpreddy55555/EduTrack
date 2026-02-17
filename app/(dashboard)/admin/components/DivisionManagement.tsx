'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DivisionManagement() {
    const [divisions, setDivisions] = useState<any[]>([])
    const [standards, setStandards] = useState<any[]>([])
    const [streams, setStreams] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDivision, setEditingDivision] = useState<any>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [institutionId, setInstitutionId] = useState('')

    const [formData, setFormData] = useState({
        division_name: '',
        standard_id: '',
        stream_id: '',
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

        // Get divisions with related data
        // CORRECT:
        const { data: divisionsData, error: divisionsError } = await supabase
            .from('divisions')
            .select(`
            *,
            standards (
                standard_name,
                standard_code
            ),
            streams (
                stream_name,
                stream_code
            )
            `)
            .eq('institution_id', userData.institution_id)
            .order('division_name')

        if (divisionsError) {
            console.error('Error fetching divisions:', divisionsError)
            setDivisions([])
        } else {
            setDivisions(divisionsData || [])
        }

        // Get standards and streams for dropdowns
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
        setEditingDivision(null)
        setFormData({
        division_name: '',
        standard_id: '',
        stream_id: '',
        })
        setShowModal(true)
    }

    const handleEdit = (division: any) => {
        setEditingDivision(division)
        setFormData({
        division_name: division.division_name,
        standard_id: division.standard_id || '',
        stream_id: division.stream_id || '',
        })
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!formData.division_name || !formData.standard_id || !formData.stream_id) {
        setMessage({ type: 'error', text: 'Please fill all fields' })
        setTimeout(() => setMessage(null), 3000)
        return
        }

        try {
        const data = {
            ...formData,
            institution_id: institutionId,
        }

        if (editingDivision) {
            const { error } = await supabase
            .from('divisions')
            .update(data)
            .eq('id', editingDivision.id)

            if (error) throw error
            setMessage({ type: 'success', text: '✓ Division updated!' })
        } else {
            const { error } = await supabase
            .from('divisions')
            .insert([data])

            if (error) throw error
            setMessage({ type: 'success', text: '✓ Division created!' })
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
        if (!confirm('Delete this division? This will affect faculty assignments and student records.')) return

        try {
        const { error } = await supabase
            .from('divisions')
            .delete()
            .eq('id', id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Division deleted!' })
        fetchData()
        setTimeout(() => setMessage(null), 3000)
        } catch (error) {
        console.error('Error:', error)
        setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const quickCreate = (standard: string, stream: string, section: string) => {
        const standardObj = standards.find(s => s.standard_code === standard)
        const streamObj = streams.find(s => s.stream_code === stream)
        
        if (!standardObj || !streamObj) {
        setMessage({ type: 'error', text: 'Please create standards and streams first' })
        setTimeout(() => setMessage(null), 3000)
        return
        }

        setFormData({
        division_name: `${standard} ${stream} ${section}`,
        standard_id: standardObj.id,
        stream_id: streamObj.id,
        })
        setShowModal(true)
    }

    if (loading) {
        return (
        <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
        </div>
        )
    }

    // Group divisions by standard and stream
    const groupedDivisions = divisions.reduce((acc: any, div) => {
        const key = `${div.standards?.standard_code || 'Unknown'}-${div.streams?.stream_code || 'Unknown'}`
        if (!acc[key]) acc[key] = []
        acc[key].push(div)
        return acc
    }, {})

    return (
        <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
            <h2 className="text-2xl font-bold text-white mb-2">Division Management</h2>
            <p className="text-slate-400">Manage class divisions and sections</p>
            </div>
            <button
            onClick={handleAdd}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
            >
            <span className="text-xl">+</span>
            Add Division
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

        {/* Quick Create */}
        {standards.length > 0 && streams.length > 0 && (
            <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
            <div className="text-sm font-medium text-slate-300 mb-3">Quick Create Divisions:</div>
            <div className="grid md:grid-cols-3 gap-4">
                <div>
                <div className="text-xs text-slate-400 mb-2">XI Science</div>
                <div className="flex gap-2">
                    <button onClick={() => quickCreate('XI', 'SCI', 'A')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XI SCI A
                    </button>
                    <button onClick={() => quickCreate('XI', 'SCI', 'B')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XI SCI B
                    </button>
                </div>
                </div>
                <div>
                <div className="text-xs text-slate-400 mb-2">XI Commerce</div>
                <div className="flex gap-2">
                    <button onClick={() => quickCreate('XI', 'COM', 'A')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XI COM A
                    </button>
                    <button onClick={() => quickCreate('XI', 'COM', 'B')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XI COM B
                    </button>
                </div>
                </div>
                <div>
                <div className="text-xs text-slate-400 mb-2">XII Science</div>
                <div className="flex gap-2">
                    <button onClick={() => quickCreate('XII', 'SCI', 'A')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XII SCI A
                    </button>
                    <button onClick={() => quickCreate('XII', 'SCI', 'B')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex-1">
                    XII SCI B
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* Divisions by Group */}
        {Object.keys(groupedDivisions).length === 0 ? (
            <div className="bg-slate-700/30 border border-white/10 rounded-xl p-12 text-center">
            <div className="text-4xl mb-2">🏫</div>
            <p className="text-slate-400">No divisions yet. Use Quick Create or click "Add Division".</p>
            </div>
        ) : (
            <div className="space-y-4">
            {Object.entries(groupedDivisions).map(([key, divs]: [string, any]) => (
                <div key={key} className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
                <div className="bg-slate-700/50 px-4 py-3 border-b border-white/10">
                    <div className="font-semibold text-white">
                    {divs[0]?.standards?.standard_name || 'Unknown'} - {divs[0]?.streams?.stream_name || 'Unknown'}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 bg-slate-700/30">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Division Name</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Standard</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Stream</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300 w-32">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {divs.map((division: any) => (
                        <tr key={division.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-4">
                            <div className="text-white font-medium">{division.division_name}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                                {division.standards?.standard_code || 'N/A'}
                            </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">
                                {division.streams?.stream_code || 'N/A'}
                            </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                onClick={() => handleEdit(division)}
                                className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                                title="Edit"
                                >
                                ✏️
                                </button>
                                <button
                                onClick={() => handleDelete(division.id)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                title="Delete"
                                >
                                🗑️
                                </button>
                            </div>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </div>
            ))}
            </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">
                    {editingDivision ? 'Edit Division' : 'Add Division'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">
                    ×
                </button>
                </div>

                <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Division Name *</label>
                    <input
                    type="text"
                    value={formData.division_name}
                    onChange={(e) => setFormData({ ...formData, division_name: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    placeholder="XI SCI A"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Standard *</label>
                    <select
                    value={formData.standard_id}
                    onChange={(e) => setFormData({ ...formData, standard_id: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    >
                    <option value="">Select Standard</option>
                    {standards.map((s) => (
                        <option key={s.id} value={s.id}>
                        {s.standard_name} ({s.standard_code})
                        </option>
                    ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Stream *</label>
                    <select
                    value={formData.stream_id}
                    onChange={(e) => setFormData({ ...formData, stream_id: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                    >
                    <option value="">Select Stream</option>
                    {streams.map((s) => (
                        <option key={s.id} value={s.id}>
                        {s.stream_name} ({s.stream_code})
                        </option>
                    ))}
                    </select>
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
                    {editingDivision ? 'Update' : 'Create'} Division
                </button>
                </div>
            </div>
            </div>
        )}
        </div>
    )
}