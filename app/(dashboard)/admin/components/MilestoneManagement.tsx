'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MilestoneManagement() {
    const [milestones, setMilestones] = useState<any[]>([])
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTopicsModal, setShowTopicsModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<any>(null)
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null)
  
  // Topic selection states
  const [subjects, setSubjects] = useState<any[]>([])
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([])  // ← NEW
  const [divisions, setDivisions] = useState<any[]>([])
  const [standards, setStandards] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDivision, setSelectedDivision] = useState('')
  const [topics, setTopics] = useState<any[]>([])
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [loadingTopics, setLoadingTopics] = useState(false)
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState('')

  const [formData, setFormData] = useState({
    milestone_name: '',
    milestone_date: '',
    milestone_type: 'exam' as 'exam' | 'monthly',
    description: '',
    is_active: true,
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

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      if (yearData) {
        const { data: milestonesData } = await supabase
          .from('exam_milestones')
          .select('*')
          .eq('academic_year_id', yearData.id)
          .order('milestone_date')

        if (milestonesData) {
          const milestonesWithCounts = await Promise.all(
            milestonesData.map(async (m) => {
              const { count } = await supabase
                .from('milestone_topics')
                .select('*', { count: 'exact', head: true })
                .eq('milestone_id', m.id)
              
              return { ...m, topic_count: count || 0 }
            })
          )
          setMilestones(milestonesWithCounts)
        }
      }

      const { data: standardsData } = await supabase
        .from('standards')
        .select('*')
        .order('standard_name')

      setStandards(standardsData || [])

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

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // NEW: Fetch subjects for selected division using subject_mappings
  const fetchSubjectsForDivision = async (divisionId: string) => {
    if (!divisionId || !academicYear) return

    try {
      const division = divisions.find(d => d.id === divisionId)
      
      if (!division) {
        console.error('Division not found')
        setFilteredSubjects([])
        return
      }

      console.log('🔍 Fetching subjects for:', division.division_name)

      // ========================================
      // SIMPLE FIX: Just show ALL subjects!
      // No mappings, no assignments required!
      // ========================================
      
      const { data: allSubjects, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', institutionId)
        .order('subject_name')

      if (error) {
        console.error('Error fetching subjects:', error)
        setFilteredSubjects([])
        return
      }

      console.log('✅ Showing all', allSubjects?.length || 0, 'subjects')
      setFilteredSubjects(allSubjects || [])

    } catch (error) {
      console.error('Error:', error)
      setFilteredSubjects([])
    }
  }

  const handleAdd = () => {
    setEditingMilestone(null)
    setFormData({
      milestone_name: '',
      milestone_date: '',
      milestone_type: 'exam',
      description: '',
      is_active: true,
    })
    setShowModal(true)
  }

  const handleEdit = (milestone: any) => {
    setEditingMilestone(milestone)
    setFormData({
      milestone_name: milestone.milestone_name,
      milestone_date: milestone.milestone_date,
      milestone_type: milestone.milestone_type,
      description: milestone.description || '',
      is_active: milestone.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.milestone_name || !formData.milestone_date) {
      setMessage({ type: 'error', text: 'Please fill required fields' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      const data = {
        ...formData,
        institution_id: institutionId,
        academic_year_id: academicYear.id,
        target_completion_percentage: 0,
      }

      if (editingMilestone) {
        const { error } = await supabase
          .from('exam_milestones')
          .update(data)
          .eq('id', editingMilestone.id)

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Milestone updated!' })
      } else {
        const { error } = await supabase
          .from('exam_milestones')
          .insert([data])

        if (error) throw error
        setMessage({ type: 'success', text: '✓ Milestone created!' })
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
    if (!confirm('Delete this milestone? Associated topics will also be removed.')) return

    try {
      const { error } = await supabase
        .from('exam_milestones')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✓ Milestone deleted!' })
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('exam_milestones')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const openTopicsModal = async (milestone: any) => {
    setSelectedMilestone(milestone)
    setSelectedSubject('')
    setSelectedDivision('')
    setTopics([])
    setSelectedTopics(new Set())
    setFilteredSubjects([])
    setShowTopicsModal(true)
  }

  const handleDivisionChange = async (divisionId: string) => {
    setSelectedDivision(divisionId)
    setSelectedSubject('')
    setTopics([])
    setSelectedTopics(new Set())
    
    // Fetch filtered subjects for this division
    await fetchSubjectsForDivision(divisionId)
  }

  const fetchTopicsForSelection = async () => {
    if (!selectedSubject || !selectedDivision) return

    setLoadingTopics(true)
    try {
      const division = divisions.find(d => d.id === selectedDivision)
      
      if (!division || !division.standard_id) {
        console.error('Division has no standard_id:', division)
        setMessage({ type: 'error', text: 'Division has no standard assigned' })
        setTimeout(() => setMessage(null), 3000)
        setTopics([])
        setSelectedTopics(new Set())
        setLoadingTopics(false)
        return
      }

      console.log('📚 Fetching topics for:', {
        division: division.division_name,
        standard_id: division.standard_id,
        subject_id: selectedSubject
      })

      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', selectedSubject)
        .eq('standard_id', division.standard_id)
        .order('topic_number')

      if (topicsError) {
        console.error('Error fetching topics:', topicsError)
      }

      console.log('✅ Topics loaded:', topicsData?.length || 0)

      const { data: selectedData } = await supabase
        .from('milestone_topics')
        .select('topic_id')
        .eq('milestone_id', selectedMilestone.id)
        .eq('subject_id', selectedSubject)
        .eq('division_id', selectedDivision)

      const selected = new Set(selectedData?.map(s => s.topic_id) || [])
      
      setTopics(topicsData || [])
      setSelectedTopics(selected)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  useEffect(() => {
    if (selectedSubject && selectedDivision && selectedMilestone) {
      fetchTopicsForSelection()
    }
  }, [selectedSubject, selectedDivision])

  const toggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId)
    } else {
      newSelected.add(topicId)
    }
    setSelectedTopics(newSelected)
  }

  const selectAllTopics = () => {
    setSelectedTopics(new Set(topics.map(t => t.id)))
  }

  const deselectAllTopics = () => {
    setSelectedTopics(new Set())
  }

  const saveTopicSelection = async () => {
    if (!selectedMilestone || !selectedSubject || !selectedDivision) return

    setLoadingTopics(true)
    
    try {
      const subject = filteredSubjects.find(s => s.id === selectedSubject)
      const division = divisions.find(d => d.id === selectedDivision)

      await supabase
        .from('milestone_topics')
        .delete()
        .eq('milestone_id', selectedMilestone.id)
        .eq('subject_id', selectedSubject)
        .eq('division_id', selectedDivision)

      if (selectedTopics.size > 0) {
        const inserts = Array.from(selectedTopics).map(topicId => ({
          milestone_id: selectedMilestone.id,
          topic_id: topicId,
          subject_id: selectedSubject,
          division_id: selectedDivision,
        }))

        const { error } = await supabase
          .from('milestone_topics')
          .insert(inserts)

        if (error) throw error
      }

      setMessage({ 
        type: 'success', 
        text: `✓ Saved ${selectedTopics.size} topics for ${subject?.subject_name} - ${division?.division_name}!` 
      })
      
      setTimeout(() => setMessage(null), 3000)
      
      setSelectedSubject('')
      setTopics([])
      setSelectedTopics(new Set())
      
      fetchData()
    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to save topic selection' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setLoadingTopics(false)
    }
  }

  const quickCreatePreset = (preset: 'term1' | 'term2' | 'prelim' | 'final') => {
    const presets = {
      term1: { milestone_name: 'Term 1 Examination', description: 'First term examination' },
      term2: { milestone_name: 'Term 2 Examination', description: 'Second term examination' },
      prelim: { milestone_name: 'Preliminary Examination', description: 'Pre-board examination' },
      final: { milestone_name: 'Final Board Examination', description: 'Final board examination' },
    }

    setFormData({
      ...presets[preset],
      milestone_date: '',
      milestone_type: 'exam',
      is_active: true,
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

  const daysUntilNext = milestones.length > 0 && milestones[0].milestone_date
    ? Math.ceil((new Date(milestones[0].milestone_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Milestone Management</h2>
          <p className="text-slate-400">Set exam milestones and assign topics to cover</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Milestone
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

      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
        <div className="text-sm font-medium text-slate-300 mb-3">Quick Create:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => quickCreatePreset('term1')} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            📝 Term 1
          </button>
          <button onClick={() => quickCreatePreset('term2')} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            📝 Term 2
          </button>
          <button onClick={() => quickCreatePreset('prelim')} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            📝 Prelims
          </button>
          <button onClick={() => quickCreatePreset('final')} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            📝 Finals
          </button>
        </div>
      </div>

      {daysUntilNext !== null && daysUntilNext > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400 mb-1">Next Milestone</div>
              <div className="text-2xl font-bold text-white mb-2">{milestones[0].milestone_name}</div>
              <div className="text-sm text-slate-400">
                {new Date(milestones[0].milestone_date).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-400">{daysUntilNext}</div>
              <div className="text-sm text-slate-400">days left</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-700/50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300">Milestone</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Type</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Date</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Topics</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">🎯</div>
                    No milestones yet. Click "Add Milestone" or use Quick Create presets.
                  </td>
                </tr>
              ) : (
                milestones.map((milestone) => (
                  <tr key={milestone.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{milestone.milestone_name}</div>
                      {milestone.description && (
                        <div className="text-xs text-slate-400">{milestone.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        milestone.milestone_type === 'exam'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                      }`}>
                        {milestone.milestone_type === 'exam' ? '📝 Exam' : '📅 Monthly'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-white">
                      {new Date(milestone.milestone_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openTopicsModal(milestone)}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium"
                      >
                        📝 {milestone.topic_count || 0} Topics
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleActive(milestone.id, milestone.is_active)}
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          milestone.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                        }`}
                      >
                        {milestone.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(milestone)}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(milestone.id)}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Milestone Name *</label>
                <input
                  type="text"
                  value={formData.milestone_name}
                  onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Term 1 Examination"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.milestone_date}
                    onChange={(e) => setFormData({ ...formData, milestone_date: e.target.value })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                  <select
                    value={formData.milestone_type}
                    onChange={(e) => setFormData({ ...formData, milestone_type: e.target.value as 'exam' | 'monthly' })}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="exam">Exam</option>
                    <option value="monthly">Monthly Target</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-white/10 bg-slate-700"
                />
                <label htmlFor="is_active" className="text-sm text-slate-300">
                  Active (Show in faculty dashboard)
                </label>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-blue-400">
                  💡 After creating, click "Manage Topics" to select which topics to cover by this milestone.
                </p>
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
                {editingMilestone ? 'Update' : 'Create'} Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopicsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">
                  Select Topics for {selectedMilestone?.milestone_name}
                </h3>
                <p className="text-slate-400 text-sm mt-1">Choose topics to be covered by this milestone</p>
              </div>
              <button
                onClick={() => setShowTopicsModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Division *
                  </label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => handleDivisionChange(e.target.value)}
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Subject * ({filteredSubjects.length} available)
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value)
                      setTopics([])
                      setSelectedTopics(new Set())
                    }}
                    disabled={!selectedDivision}
                    className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
                  >
                    <option value="">Select Subject</option>
                    {filteredSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name} ({s.subject_code})
                      </option>
                    ))}
                  </select>
                  {selectedDivision && filteredSubjects.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">
                      ⚠️ No subjects assigned to this division. Check Faculty Assignments.
                    </p>
                  )}
                </div>
              </div>

              {selectedSubject && selectedDivision && (
                <>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="text-sm text-slate-400">
                      {selectedTopics.size} of {topics.length} topics selected
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllTopics}
                        disabled={topics.length === 0}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg disabled:opacity-50"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllTopics}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {loadingTopics ? (
                    <div className="text-center py-8 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400 mx-auto mb-2"></div>
                      Loading topics...
                    </div>
                  ) : topics.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <div className="text-4xl mb-2">📝</div>
                      <p>No topics found for this subject and division</p>
                      <p className="text-xs mt-2 text-slate-500">Make sure topics exist with the correct standard</p>
                    </div>
                  ) : (
                    <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {topics.map((topic) => (
                          <label
                            key={topic.id}
                            className="flex items-start gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTopics.has(topic.id)}
                              onChange={() => toggleTopic(topic.id)}
                              className="w-5 h-5 rounded border-white/10 bg-slate-700 mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="text-white font-medium">{topic.topic_name}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {topic.topic_number} • {topic.default_lectures || 0} lectures
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!selectedSubject || !selectedDivision ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">👆</div>
                  <p>Select a division and subject to view topics</p>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowTopicsModal(false)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Close
              </button>
              <button
                onClick={saveTopicSelection}
                disabled={!selectedSubject || !selectedDivision || loadingTopics}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl disabled:opacity-50"
              >
                {loadingTopics ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save & Add Another Subject ({selectedTopics.size} topics)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}