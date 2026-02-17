// 📋 SUBJECT ALLOCATION - Assign subjects to divisions
// Maps which subjects are taught in which divisions
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SubjectAllocation() {
  const [divisions, setDivisions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [allocations, setAllocations] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [institutionId, setInstitutionId] = useState('')
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase.from('users').select('institution_id').eq('id', session.user.id).single()
      if (!userData) return
      setInstitutionId(userData.institution_id)

      // Fetch divisions with standard info
      const { data: divData } = await supabase
        .from('divisions')
        .select('id, division_name, standard_id, standards(standard_name)')
        .eq('institution_id', userData.institution_id)
        .order('division_name')

      // Fetch all subjects
      const { data: subjData } = await supabase
        .from('subjects')
        .select('id, subject_name, subject_code, standard_id, standards(standard_name)')
        .eq('institution_id', userData.institution_id)
        .order('subject_name')

      // Fetch existing allocations
      const { data: allocData } = await supabase
        .from('division_subjects')
        .select('division_id, subject_id')
        .eq('institution_id', userData.institution_id)
        .eq('is_active', true)

      // Build allocation map: division_id -> Set of subject_ids
      const allocMap = new Map<string, Set<string>>()
      for (const a of (allocData || [])) {
        if (!allocMap.has(a.division_id)) allocMap.set(a.division_id, new Set())
        allocMap.get(a.division_id)!.add(a.subject_id)
      }

      setDivisions(divData || [])
      setSubjects(subjData || [])
      setAllocations(allocMap)

      // Auto-select first division
      if (divData && divData.length > 0 && !selectedDivision) {
        setSelectedDivision(divData[0].id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSubject = async (divisionId: string, subjectId: string) => {
    setSaving(true)
    setMessage(null)
    try {
      const currentAllocs = allocations.get(divisionId) || new Set()
      const isAllocated = currentAllocs.has(subjectId)

      if (isAllocated) {
        // Remove allocation
        const { error } = await supabase
          .from('division_subjects')
          .delete()
          .eq('division_id', divisionId)
          .eq('subject_id', subjectId)
        if (error) throw error
        currentAllocs.delete(subjectId)
      } else {
        // Add allocation
        const { error } = await supabase
          .from('division_subjects')
          .upsert({
            division_id: divisionId,
            subject_id: subjectId,
            institution_id: institutionId,
            is_active: true,
          }, { onConflict: 'division_id,subject_id' })
        if (error) throw error
        currentAllocs.add(subjectId)
      }

      const newMap = new Map(allocations)
      newMap.set(divisionId, new Set(currentAllocs))
      setAllocations(newMap)
      setMessage({ type: 'success', text: isAllocated ? 'Subject removed' : 'Subject assigned' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const assignAllForStandard = async (divisionId: string) => {
    const div = divisions.find(d => d.id === divisionId)
    if (!div?.standard_id) return

    setSaving(true)
    setMessage(null)
    try {
      const standardSubjects = subjects.filter(s => s.standard_id === div.standard_id)
      const currentAllocs = allocations.get(divisionId) || new Set()
      let added = 0

      for (const subj of standardSubjects) {
        if (!currentAllocs.has(subj.id)) {
          const { error } = await supabase
            .from('division_subjects')
            .upsert({
              division_id: divisionId,
              subject_id: subj.id,
              institution_id: institutionId,
              is_active: true,
            }, { onConflict: 'division_id,subject_id' })
          if (!error) {
            currentAllocs.add(subj.id)
            added++
          }
        }
      }

      const newMap = new Map(allocations)
      newMap.set(divisionId, new Set(currentAllocs))
      setAllocations(newMap)
      setMessage({ type: 'success', text: `Assigned ${added} subjects to ${div.division_name}` })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const removeAllForDivision = async (divisionId: string) => {
    const div = divisions.find(d => d.id === divisionId)
    if (!confirm(`Remove all subject assignments from ${div?.division_name}?`)) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('division_subjects')
        .delete()
        .eq('division_id', divisionId)
      if (error) throw error

      const newMap = new Map(allocations)
      newMap.set(divisionId, new Set())
      setAllocations(newMap)
      setMessage({ type: 'success', text: 'All subjects removed' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
    </div>
  )

  const currentDiv = divisions.find(d => d.id === selectedDivision)
  const currentAllocs = allocations.get(selectedDivision) || new Set()
  
  // Filter subjects: show matching standard first, then all
  const standardSubjects = subjects.filter(s => currentDiv && s.standard_id === currentDiv.standard_id)
  const otherSubjects = subjects.filter(s => !currentDiv || s.standard_id !== currentDiv.standard_id)
  const filteredStandard = searchTerm 
    ? standardSubjects.filter(s => s.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : standardSubjects
  const filteredOther = searchTerm
    ? otherSubjects.filter(s => s.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : otherSubjects

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Subject Allocation</h2>
          <p className="text-sm text-slate-400">Assign subjects to divisions. Students will see these in their portal.</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Division List */}
        <div className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Divisions</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {divisions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No divisions found. Create divisions first.</p>
            ) : divisions.map(div => {
              const count = (allocations.get(div.id) || new Set()).size
              return (
                <button
                  key={div.id}
                  onClick={() => setSelectedDivision(div.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedDivision === div.id
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-slate-800/50 border-white/5 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{div.division_name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-400">{(div as any).standards?.standard_name || '-'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {count} subjects
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Subject checkboxes */}
        <div className="lg:col-span-2 bg-slate-700/30 border border-white/10 rounded-xl p-4">
          {!selectedDivision ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👈</div>
              <p className="text-slate-400">Select a division to assign subjects</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{currentDiv?.division_name}</h3>
                  <p className="text-xs text-slate-400">{currentAllocs.size} subjects assigned</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => assignAllForStandard(selectedDivision)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    ✅ Assign All ({(currentDiv as any)?.standards?.standard_name || 'Standard'})
                  </button>
                  <button
                    onClick={() => removeAllForDivision(selectedDivision)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-500/30 disabled:opacity-50"
                  >
                    ✕ Clear All
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search subjects..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg py-2 px-3 text-white text-sm placeholder-slate-500 mb-4"
              />

              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {/* Standard-matched subjects first */}
                {filteredStandard.length > 0 && (
                  <>
                    <div className="text-xs text-slate-500 uppercase font-semibold px-2 py-1 bg-slate-800/30 rounded sticky top-0">
                      {(currentDiv as any)?.standards?.standard_name || 'Standard'} Subjects ({filteredStandard.length})
                    </div>
                    {filteredStandard.map(subj => (
                      <SubjectCheckbox
                        key={subj.id}
                        subject={subj}
                        checked={currentAllocs.has(subj.id)}
                        disabled={saving}
                        onToggle={() => toggleSubject(selectedDivision, subj.id)}
                      />
                    ))}
                  </>
                )}

                {/* Other subjects */}
                {filteredOther.length > 0 && (
                  <>
                    <div className="text-xs text-slate-500 uppercase font-semibold px-2 py-1 bg-slate-800/30 rounded sticky top-0 mt-3">
                      Other Subjects ({filteredOther.length})
                    </div>
                    {filteredOther.map(subj => (
                      <SubjectCheckbox
                        key={subj.id}
                        subject={subj}
                        checked={currentAllocs.has(subj.id)}
                        disabled={saving}
                        onToggle={() => toggleSubject(selectedDivision, subj.id)}
                      />
                    ))}
                  </>
                )}

                {filteredStandard.length === 0 && filteredOther.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    {subjects.length === 0 ? 'No subjects found. Create subjects first.' : 'No matching subjects.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SubjectCheckbox({ subject, checked, disabled, onToggle }: {
  subject: any; checked: boolean; disabled: boolean; onToggle: () => void
}) {
  return (
    <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
      checked ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-slate-700/50 border border-transparent'
    } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className="w-4 h-4 rounded bg-slate-700 border-white/20 text-amber-500 focus:ring-amber-500/50 accent-amber-500"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white">{subject.subject_name}</span>
        <span className="text-xs text-slate-500 ml-2">{subject.subject_code}</span>
      </div>
      <span className="text-xs text-slate-500">{(subject as any).standards?.standard_name || ''}</span>
    </label>
  )
}
