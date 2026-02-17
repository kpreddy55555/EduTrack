// ✏️ SYLLABUS ENTRY PAGE - Faculty Daily Entry
// Faculty select division, subject, topic and mark lectures completed

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SyllabusEntryPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [facultyId, setFacultyId] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  
  // Dropdowns
  const [divisions, setDivisions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  
  // Selections
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Entry form
  const [entries, setEntries] = useState<Array<{
    topic_id: string
    lectures_taken: number
    remarks: string
  }>>([])
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [existingEntries, setExistingEntries] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedDivision && selectedSubject) {
      fetchTopics()
      fetchExistingEntries()
    }
  }, [selectedDivision, selectedSubject, selectedDate])

  const fetchInitialData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setFacultyId(session.user.id)

      // Get user institution
      const { data: userData } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) return
      setInstitutionId(userData.institution_id)

      // Get current academic year
      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      if (!yearData) {
        setMessage({ type: 'error', text: 'No active academic year found' })
        setLoading(false)
        return
      }

      // Get faculty assignments (divisions they teach)
      const { data: assignmentsData } = await supabase
        .from('faculty_assignments')
        .select(`
          division_id,
          divisions(*)
        `)
        .eq('faculty_id', session.user.id)
        .eq('academic_year_id', yearData.id)

      const uniqueDivisions = Array.from(
        new Map(assignmentsData?.map(a => [a.division_id, a.divisions])).values()
      )

      setDivisions(uniqueDivisions)

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubjects = async (divisionId: string) => {
    if (!divisionId || !academicYear) return

    try {
      const division = divisions.find(d => d.id === divisionId)
      if (!division || !division.standard_id || !division.stream_id) {
        console.error('Division missing standard_id or stream_id')
        return
      }

      // Get subjects from faculty_assignments
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('subject_id')
        .eq('faculty_id', facultyId)
        .eq('division_id', divisionId)
        .eq('academic_year_id', academicYear.id)

      const subjectIds = Array.from(new Set(assignments?.map(a => a.subject_id) || []))

      if (subjectIds.length === 0) {
        setSubjects([])
        return
      }

      // Filter using subject_mappings
      const { data: mappings } = await supabase
        .from('subject_mappings')
        .select('subject_id, subjects(*)')
        .eq('standard_id', division.standard_id)
        .eq('stream_id', division.stream_id)
        .in('subject_id', subjectIds)

      const filtered = mappings?.map(m => m.subjects).filter(Boolean) || []
      setSubjects(filtered)

    } catch (error) {
      console.error('Error fetching subjects:', error)
    }
  }

  const fetchTopics = async () => {
    if (!selectedSubject || !selectedDivision) return

    try {
      const division = divisions.find(d => d.id === selectedDivision)
      if (!division) return

      const { data: topicsData } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', selectedSubject)
        .eq('standard_id', division.standard_id)
        .order('topic_number')

      setTopics(topicsData || [])

    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  const fetchExistingEntries = async () => {
    if (!selectedDivision || !selectedSubject || !selectedDate) return

    try {
      const { data } = await supabase
        .from('syllabus_entries')
        .select('*, topics(topic_name, topic_number)')
        .eq('faculty_id', facultyId)
        .eq('division_id', selectedDivision)
        .eq('subject_id', selectedSubject)
        .eq('teaching_date', selectedDate)

      setExistingEntries(data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDivisionChange = async (divisionId: string) => {
    setSelectedDivision(divisionId)
    setSelectedSubject('')
    setTopics([])
    setEntries([])
    await fetchSubjects(divisionId)
  }

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId)
    setEntries([])
  }

  const addTopicEntry = (topicId: string) => {
    if (entries.find(e => e.topic_id === topicId)) {
      setMessage({ type: 'error', text: 'Topic already added' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setEntries([...entries, {
      topic_id: topicId,
      lectures_taken: 1,
      remarks: ''
    }])
  }

  const updateEntry = (index: number, field: string, value: any) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], [field]: value }
    setEntries(updated)
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (entries.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one topic' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)

    try {
      const inserts = entries.map(entry => ({
        institution_id: institutionId,
        faculty_id: facultyId,
        division_id: selectedDivision,
        subject_id: selectedSubject,
        topic_id: entry.topic_id,
        teaching_date: selectedDate,
        lectures_taken: entry.lectures_taken,
        remarks: entry.remarks || null,
        academic_year_id: academicYear.id,
      }))

      const { error } = await supabase
        .from('syllabus_entries')
        .insert(inserts)

      if (error) throw error

      setMessage({ type: 'success', text: `✓ Saved ${entries.length} entries successfully!` })
      setEntries([])
      fetchExistingEntries()
      setTimeout(() => setMessage(null), 3000)

    } catch (error: any) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const deleteExistingEntry = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return

    try {
      const { error } = await supabase
        .from('syllabus_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error
      
      setMessage({ type: 'success', text: '✓ Entry deleted!' })
      fetchExistingEntries()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  if (!academicYear) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-400">No active academic year found. Please contact admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Syllabus Entry</h1>
        <p className="text-slate-400">Log your daily teaching progress</p>
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

      {/* Selection Form */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <div className="grid md:grid-cols-3 gap-4">
          {/* Division */}
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

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Subject * ({subjects.length} available)
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={!selectedDivision}
              className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Topic Selection */}
      {selectedDivision && selectedSubject && topics.length > 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Select Topics Covered Today</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => addTopicEntry(topic.id)}
                disabled={entries.some(e => e.topic_id === topic.id)}
                className="p-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded-lg text-left transition-colors"
              >
                <div className="text-white font-medium text-sm mb-1">
                  {topic.topic_name}
                </div>
                <div className="text-xs text-slate-400">
                  {topic.topic_number} • {topic.default_lectures || 0} lectures
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entry Form */}
      {entries.length > 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Today's Entries ({entries.length})</h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {saving ? 'Saving...' : `💾 Save ${entries.length} Entries`}
            </button>
          </div>

          <div className="space-y-4">
            {entries.map((entry, index) => {
              const topic = topics.find(t => t.id === entry.topic_id)
              return (
                <div key={index} className="bg-slate-700/50 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="text-white font-medium mb-2">
                        {topic?.topic_name}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Lectures Completed *</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={entry.lectures_taken}
                            onChange={(e) => updateEntry(index, 'lectures_taken', parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-700 border border-white/10 rounded-lg py-2 px-3 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Remarks (Optional)</label>
                          <input
                            type="text"
                            value={entry.remarks}
                            onChange={(e) => updateEntry(index, 'remarks', e.target.value)}
                            placeholder="Any notes..."
                            className="w-full bg-slate-700 border border-white/10 rounded-lg py-2 px-3 text-white"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeEntry(index)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Existing Entries for Selected Date */}
      {existingEntries.length > 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Already Saved for {new Date(selectedDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </h2>
          <div className="space-y-3">
            {existingEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-white/10">
                <div className="flex-1">
                  <div className="text-white font-medium">{entry.topics?.topic_name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {entry.topics?.topic_number} • {entry.lectures_taken} lectures
                    {entry.remarks && ` • ${entry.remarks}`}
                  </div>
                </div>
                <button
                  onClick={() => deleteExistingEntry(entry.id)}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg ml-4"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedDivision && selectedSubject && topics.length === 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-slate-400">No topics found for this subject. Please contact admin.</p>
        </div>
      )}

      {!selectedDivision && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">👆</div>
          <p className="text-slate-400">Select a division and subject to start adding entries</p>
        </div>
      )}
    </div>
  )
}