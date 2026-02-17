// ✍️ SYLLABUS ENTRY v2 - Role-based + 10-day edit lock
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EntriesPage() {
  const [divisions, setDivisions] = useState<any[]>([])
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([])
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [entries, setEntries] = useState<any[]>([])
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type:'success'|'error',text:string}|null>(null)
  const [user, setUser] = useState<any>(null)
  const [subjectInfo, setSubjectInfo] = useState<any>(null)
  const [allSubjects, setAllSubjects] = useState<any[]>([])
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [viewMode, setViewMode] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchInitialData() }, [])
  useEffect(() => { if (selectedDivision && selectedSubject) fetchTopicsAndEntries(); else { setEntries([]); setSubjectInfo(null) } }, [selectedDivision, selectedSubject])
  useEffect(() => { if (selectedDivision && academicYear) fetchSubjectsForDivision() }, [selectedDivision, academicYear, selectedFaculty])

  const isAdminRole = (role: string) => ['superadmin','admin'].includes(role)
  const canEditEntries = () => !viewMode && (user?.role === 'faculty' || isAdminRole(user?.role))

  const fetchInitialData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (!userData) return
      setUser(userData)
      if (userData.role === 'hod') setViewMode(true)

      const { data: yearData } = await supabase.from('academic_years').select('*').eq('institution_id', userData.institution_id).eq('is_current', true).single()
      setAcademicYear(yearData)

      const { data: subData } = await supabase.from('subjects').select('*').eq('institution_id', userData.institution_id).order('subject_name')
      setAllSubjects(subData || [])

      if (isAdminRole(userData.role) || userData.role === 'hod') {
        const { data: divData } = await supabase.from('divisions').select('*').eq('institution_id', userData.institution_id).order('division_name')
        setDivisions(divData || [])
        const { data: facData } = await supabase.from('users').select('id, full_name').eq('institution_id', userData.institution_id).eq('role', 'faculty').order('full_name')
        setFacultyList(facData || [])
      } else {
        const { data: asgn } = await supabase.from('faculty_assignments').select('division_id').eq('faculty_id', userData.id)
        const divIds = Array.from(new Set((asgn||[]).map(a => a.division_id)))
        if (divIds.length > 0) {
          const { data: divData } = await supabase.from('divisions').select('*').in('id', divIds).order('division_name')
          setDivisions(divData || [])
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchSubjectsForDivision = async () => {
    try {
      const fid = isAdminRole(user?.role) || user?.role === 'hod' ? selectedFaculty : user?.id
      let q = supabase.from('faculty_assignments').select('subject_id').eq('division_id', selectedDivision)
      if (academicYear?.id) q = q.eq('academic_year_id', academicYear.id)
      if (fid) q = q.eq('faculty_id', fid)
      const { data: asgn } = await q
      if (!asgn?.length) { setFilteredSubjects([]); return }
      const sids = Array.from(new Set(asgn.map(a => a.subject_id)))
      setFilteredSubjects(allSubjects.filter(s => sids.includes(s.id)))
    } catch { setFilteredSubjects([]) }
    setSelectedSubject(''); setEntries([]); setSubjectInfo(null)
  }

  const fetchTopicsAndEntries = async () => {
    if (!selectedSubject || !selectedDivision || !user || !academicYear) return
    try {
      const div = divisions.find(d => d.id === selectedDivision)
      setSubjectInfo(allSubjects.find(s => s.id === selectedSubject))
      const { data: topics } = await supabase.from('topics').select('*').eq('subject_id', selectedSubject).eq('standard_id', div?.standard_id).order('topic_number')
      if (!topics?.length) { setEntries([]); setMessage({type:'error',text:'No topics found for this standard.'}); setTimeout(()=>setMessage(null),3000); return }
      const { data: allE } = await supabase.from('syllabus_entries').select('*').eq('institution_id', user.institution_id).eq('academic_year_id', academicYear.id).eq('division_id', selectedDivision).in('topic_id', topics.map(t=>t.id))
      const merged = topics.map(topic => {
        const ex = allE?.find(e => e.topic_id === topic.id)
        const entry: any = { id: ex?.id, topic_id: topic.id, topic_name: topic.topic_name||'', topic_number: topic.topic_number||'', default_lectures: topic.default_lectures||1, lectures_taken: ex?.lectures_taken||0, status: ex?.status||'not_started', teaching_date: ex?.teaching_date||'', remarks: ex?.remarks||'', completion_percentage: ex?.completion_percentage||0, _locked: false }
        // 10-day lock for completed entries (faculty only)
        if (!isAdminRole(user.role) && entry.status === 'completed' && entry.teaching_date) {
          const diff = (Date.now() - new Date(entry.teaching_date).getTime()) / (1000*60*60*24)
          entry._locked = diff > 10
        }
        return entry
      })
      setEntries(merged)
    } catch (e) { console.error(e) }
  }

  const updateEntry = (i: number, field: string, value: any) => {
    const u = [...entries]; u[i] = {...u[i],[field]:value}
    if (field === 'lectures_taken') {
      const t = parseFloat(value)||0, r = u[i].default_lectures||1
      u[i].status = t===0?'not_started':t>=r?'completed':'in_progress'
      u[i].completion_percentage = t===0?0:t>=r?100:Math.round((t/r)*100)
    }
    setEntries(u)
  }

  const handleQuickComplete = (i: number) => {
    const u = [...entries]; u[i].lectures_taken = u[i].default_lectures; u[i].status = 'completed'; u[i].completion_percentage = 100; u[i].teaching_date = new Date().toISOString().split('T')[0]; setEntries(u)
  }

  const handleSaveAll = async () => {
    if (!user || !selectedDivision || !selectedSubject) return
    setSaving(true); setMessage(null)
    try {
      let saved=0,errs=0
      const fid = isAdminRole(user.role) && selectedFaculty ? selectedFaculty : user.id
      for (const entry of entries) {
        if (entry._locked) continue
        if (entry.lectures_taken > 0 || entry.remarks) {
          const d: any = { institution_id: user.institution_id, faculty_id: fid, division_id: selectedDivision, subject_id: selectedSubject, topic_id: entry.topic_id, lectures_taken: entry.lectures_taken, status: entry.status, teaching_date: entry.teaching_date || new Date().toISOString().split('T')[0], remarks: entry.remarks||null, completion_percentage: entry.completion_percentage, updated_at: new Date().toISOString() }
          if (academicYear?.id) d.academic_year_id = academicYear.id
          const r = entry.id ? await supabase.from('syllabus_entries').update(d).eq('id', entry.id) : await supabase.from('syllabus_entries').insert([{...d, created_at: new Date().toISOString()}])
          if (r.error) { errs++ } else saved++
        }
      }
      if (errs) setMessage({type:'error',text:`Saved ${saved}, ${errs} failed`})
      else if (saved) { setMessage({type:'success',text:`Saved ${saved} entries!`}); await fetchTopicsAndEntries() }
      else setMessage({type:'error',text:'No entries to save'})
    } catch { setMessage({type:'error',text:'Failed to save'}) }
    finally { setSaving(false); setTimeout(()=>setMessage(null),5000) }
  }

  const sc = (s:string) => s==='completed'?'bg-emerald-500/20 text-emerald-400 border-emerald-500/50':s==='in_progress'?'bg-amber-500/20 text-amber-400 border-amber-500/50':'bg-slate-700/50 text-slate-400 border-slate-600'
  const sl = (s:string) => s==='completed'?'Completed':s==='in_progress'?'In Progress':'Not Started'

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-400 mx-auto"></div></div>

  const p = { total: entries.length, completed: entries.filter(e=>e.status==='completed').length, inProgress: entries.filter(e=>e.status==='in_progress').length, notStarted: entries.filter(e=>e.status==='not_started').length, totalL: entries.reduce((s,e)=>s+e.lectures_taken,0), totalR: entries.reduce((s,e)=>s+e.default_lectures,0), pct: entries.length>0?Math.round((entries.reduce((s,e)=>s+e.lectures_taken,0)/entries.reduce((s,e)=>s+e.default_lectures,0))*100):0 }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">📝</span>
            <h1 className="text-3xl font-bold text-white">Syllabus Entry</h1>
            {viewMode && <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full border border-blue-500/30">View Only</span>}
          </div>
          <p className="text-slate-400">{isAdminRole(user?.role)?'Admin mode — Select faculty to enter on their behalf':user?.role==='hod'?'HOD mode — View progress (read-only)':'Record your teaching progress'}</p>
        </div>

        <div className={`grid gap-6 ${(isAdminRole(user?.role)||user?.role==='hod')?'md:grid-cols-3':'md:grid-cols-2'}`}>
          {(isAdminRole(user?.role)||user?.role==='hod') && (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-5">
              <label className="block mb-3"><span className="text-sm font-medium text-amber-400">👨‍🏫 Faculty</span></label>
              <select value={selectedFaculty} onChange={e=>{setSelectedFaculty(e.target.value);setSelectedDivision('');setSelectedSubject('');setEntries([])}} className="w-full bg-slate-800 border border-white/10 rounded-xl py-3 px-4 text-white">
                <option value="">All Faculty</option>
                {facultyList.map(f=><option key={f.id} value={f.id}>{f.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-5">
            <label className="block mb-3"><span className="text-sm font-medium text-amber-400">1️⃣ Division</span></label>
            <select value={selectedDivision} onChange={e=>{setSelectedDivision(e.target.value);setSelectedSubject('');setEntries([])}} className="w-full bg-slate-800 border border-white/10 rounded-xl py-3 px-4 text-white">
              <option value="">Select Division</option>
              {divisions.map(d=><option key={d.id} value={d.id}>{d.division_name}</option>)}
            </select>
          </div>
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-5">
            <label className="block mb-3"><span className="text-sm font-medium text-amber-400">2️⃣ Subject ({filteredSubjects.length})</span></label>
            <select value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)} disabled={!selectedDivision} className="w-full bg-slate-800 border border-white/10 rounded-xl py-3 px-4 text-white disabled:opacity-50">
              <option value="">{selectedDivision?'Select Subject':'Select Division First'}</option>
              {filteredSubjects.map(s=><option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>)}
            </select>
          </div>
        </div>

        {message && <div className={`p-4 rounded-xl border ${message.type==='success'?'bg-emerald-500/10 border-emerald-500/20 text-emerald-400':'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

        {entries.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-white/10 rounded-xl p-5">
            <div className="flex lg:items-center lg:justify-between gap-4 mb-4 flex-col lg:flex-row">
              <div><h3 className="text-lg font-semibold text-white">{subjectInfo?.subject_name}</h3><p className="text-sm text-slate-400">{p.totalL}/{p.totalR} lectures</p></div>
              <span className="text-3xl font-bold text-amber-400">{p.pct}%</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-4"><div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" style={{width:`${p.pct}%`}}/></div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold text-emerald-400">{p.completed}</p><p className="text-xs text-slate-400">Completed</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold text-amber-400">{p.inProgress}</p><p className="text-xs text-slate-400">In Progress</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold text-slate-400">{p.notStarted}</p><p className="text-xs text-slate-400">Not Started</p></div>
            </div>
          </div>
        )}

        {selectedDivision && selectedSubject ? (
          entries.length > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300 w-24">#</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300">Topic</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-20">Req.</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-28">Taken</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-28">Status</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-36">Date</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-300 w-40">Remarks</th>
                    {canEditEntries() && <th className="text-center py-4 px-4 text-sm font-semibold text-slate-300 w-16">✓</th>}
                  </tr></thead>
                  <tbody>
                    {entries.map((e,i)=>(
                      <tr key={e.topic_id} className={`border-b border-white/5 hover:bg-white/5 ${e.status==='completed'?'bg-emerald-500/5':''} ${e._locked?'opacity-60':''}`}>
                        <td className="py-3 px-4 text-slate-500 text-xs font-mono">{e.topic_number}</td>
                        <td className="py-3 px-4"><span className={`text-white text-sm ${e.status==='completed'?'line-through opacity-60':''}`}>{e.topic_name}</span>{e._locked && <span className="ml-2 text-xs text-red-400">🔒</span>}</td>
                        <td className="py-3 px-4 text-center text-amber-400 font-semibold">{e.default_lectures}</td>
                        <td className="py-3 px-4">{canEditEntries()&&!e._locked?<input type="number" min="0" step="0.5" value={e.lectures_taken||''} onChange={ev=>updateEntry(i,'lectures_taken',parseFloat(ev.target.value)||0)} className="w-full bg-slate-700 border border-white/10 rounded-lg py-2 px-3 text-white text-center text-sm"/>:<span className="text-white text-center block">{e.lectures_taken||0}</span>}</td>
                        <td className="py-3 px-4 text-center"><span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${sc(e.status)}`}>{sl(e.status)}</span></td>
                        <td className="py-3 px-4">{canEditEntries()&&!e._locked?<input type="date" value={e.teaching_date} onChange={ev=>updateEntry(i,'teaching_date',ev.target.value)} className="w-full bg-slate-700 border border-white/10 rounded-lg py-2 px-2 text-white text-sm"/>:<span className="text-slate-400 text-sm">{e.teaching_date?new Date(e.teaching_date).toLocaleDateString('en-IN'):'-'}</span>}</td>
                        <td className="py-3 px-4">{canEditEntries()&&!e._locked?<input type="text" value={e.remarks} onChange={ev=>updateEntry(i,'remarks',ev.target.value)} placeholder="..." className="w-full bg-slate-700 border border-white/10 rounded-lg py-2 px-2 text-white text-sm placeholder-slate-600"/>:<span className="text-slate-500 text-sm">{e.remarks||'-'}</span>}</td>
                        {canEditEntries() && <td className="py-3 px-4 text-center">{e.status!=='completed'&&!e._locked?<button onClick={()=>handleQuickComplete(i)} className="w-8 h-8 text-emerald-400 hover:bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto">✓</button>:e.status==='completed'?<span className="text-emerald-400">✓</span>:null}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEditEntries() && (
                <div className="p-4 border-t border-white/10 bg-slate-800/50 flex items-center justify-between">
                  <p className="text-xs text-slate-500">🔒 Completed topics locked after 10 days</p>
                  <button onClick={handleSaveAll} disabled={saving} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving?'⏳ Saving...':'💾 Save All'}</button>
                </div>
              )}
            </div>
          ) : (<div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center"><div className="text-4xl mb-4">📚</div><h3 className="text-lg font-medium text-white mb-2">No Topics Found</h3><p className="text-slate-400">Topics may not have standard_id set</p></div>)
        ) : (<div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center"><div className="text-5xl mb-4">📝</div><h3 className="text-xl font-medium text-white mb-2">Select Division & Subject</h3><p className="text-slate-400">Choose above to start tracking</p></div>)}
      </div>
    </div>
  )
}
