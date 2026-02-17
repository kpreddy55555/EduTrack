// 🏛️ INSTITUTIONS PAGE - Superadmin Only - Manage all institutions
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/app/(dashboard)/admin/components/Modal'

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInst, setSelectedInst] = useState<any>(null)
  const [instStats, setInstStats] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type:'success'|'error',text:string}|null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    institution_name: '', institution_code: '', address: '', city: '', state: '',
    phone: '', email: '', website: '', principal_name: '', logo_url: ''
  })

  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const { data } = await supabase.from('institutions').select('*').order('name')
      // Try both 'name' and 'institution_name' columns
      const enriched = await Promise.all(
        (data || []).map(async (inst) => {
          const [facRes, divRes, subRes, stdRes] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id).eq('role', 'faculty'),
            supabase.from('divisions').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
            supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
            supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
          ])
          return { ...inst, display_name: inst.name || inst.institution_name || 'Unknown', faculty_count: facRes.count || 0, division_count: divRes.count || 0, subject_count: subRes.count || 0, student_count: stdRes.count || 0 }
        })
      )
      setInstitutions(enriched)
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

  const handleAdd = async () => {
    if (!formData.institution_name) { setMessage({type:'error',text:'Name is required'}); return }
    setSaving(true); setMessage(null)
    try {
      const { error } = await supabase.from('institutions').insert({
        name: formData.institution_name,
        institution_name: formData.institution_name,
        institution_code: formData.institution_code || formData.institution_name.substring(0, 6).toUpperCase(),
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        principal_name: formData.principal_name || null,
        logo_url: formData.logo_url || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      setMessage({type:'success',text:'Institution added!'}); setShowAddModal(false)
      setFormData({ institution_name:'', institution_code:'', address:'', city:'', state:'', phone:'', email:'', website:'', principal_name:'', logo_url:'' })
      fetchData()
    } catch (error: any) { setMessage({type:'error',text: error.message}) }
    finally { setSaving(false) }
  }

  const handleViewDetail = async (inst: any) => {
    setSelectedInst(inst)
    setShowDetailModal(true)
    try {
      // Get admin users for this institution
      const { data: admins } = await supabase.from('users').select('id, full_name, email, role').eq('institution_id', inst.id).in('role', ['admin', 'hod']).order('role')
      // Get academic years
      const { data: years } = await supabase.from('academic_years').select('*').eq('institution_id', inst.id).order('is_current', { ascending: false })
      setInstStats({ admins: admins || [], years: years || [] })
    } catch (error) { console.error(error) }
  }

  const filtered = institutions.filter(i => !searchTerm || (i.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.city || '').toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏛️ Institution Management</h1>
          <p className="text-slate-400">Superadmin — Manage all registered institutions</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl shadow-lg">+ Add Institution</button>
      </div>

      {message && <div className={`p-4 rounded-xl border ${message.type==='success'?'bg-emerald-500/10 border-emerald-500/20 text-emerald-400':'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-white">{institutions.length}</p><p className="text-sm text-slate-400">Institutions</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-emerald-400">{institutions.reduce((a,i)=>a+i.faculty_count,0)}</p><p className="text-sm text-slate-400">Total Faculty</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-amber-400">{institutions.reduce((a,i)=>a+i.student_count,0)}</p><p className="text-sm text-slate-400">Total Students</p></div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-3xl font-bold text-blue-400">{institutions.reduce((a,i)=>a+i.division_count,0)}</p><p className="text-sm text-slate-400">Total Divisions</p></div>
      </div>

      <input type="text" placeholder="Search institutions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white placeholder-slate-500" />

      {/* Institution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(inst => (
          <div key={inst.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-500/30 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {(inst.institution_code || inst.display_name || 'I').substring(0, 2).toUpperCase()}
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${inst.is_active !== false ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {inst.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{inst.display_name}</h3>
            <p className="text-sm text-slate-500 mb-3">{[inst.city, inst.state].filter(Boolean).join(', ') || 'No address'}</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4">
              <div className="bg-white/5 rounded p-2"><p className="text-white font-bold">{inst.faculty_count}</p><p className="text-slate-500">Faculty</p></div>
              <div className="bg-white/5 rounded p-2"><p className="text-white font-bold">{inst.student_count}</p><p className="text-slate-500">Students</p></div>
              <div className="bg-white/5 rounded p-2"><p className="text-white font-bold">{inst.division_count}</p><p className="text-slate-500">Divisions</p></div>
              <div className="bg-white/5 rounded p-2"><p className="text-white font-bold">{inst.subject_count}</p><p className="text-slate-500">Subjects</p></div>
            </div>
            <button onClick={() => handleViewDetail(inst)} className="w-full px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 rounded-lg border border-amber-500/30">View Details</button>
          </div>
        ))}
      </div>

      {/* Add Institution Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Institution" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1">Institution Name *</label>
              <input type="text" value={formData.institution_name} onChange={e => setFormData({...formData, institution_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="e.g., XYZ Junior College" /></div>
            <div><label className="block text-sm text-slate-300 mb-1">Code</label>
              <input type="text" value={formData.institution_code} onChange={e => setFormData({...formData, institution_code: e.target.value.toUpperCase()})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="Auto-generated" /></div>
          </div>
          <div><label className="block text-sm text-slate-300 mb-1">Address</label>
            <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1">City</label><input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm text-slate-300 mb-1">State</label><input type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1">Phone</label><input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm text-slate-300 mb-1">Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-300 mb-1">Principal Name</label><input type="text" value={formData.principal_name} onChange={e => setFormData({...formData, principal_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
            <div><label className="block text-sm text-slate-300 mb-1">Logo URL</label><input type="text" value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="https://..." /></div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl disabled:opacity-50">{saving ? 'Adding...' : 'Add Institution'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={selectedInst?.display_name || ''} size="lg">
        {selectedInst && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Code</p><p className="text-white">{selectedInst.institution_code || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Phone</p><p className="text-white">{selectedInst.phone || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Email</p><p className="text-white">{selectedInst.email || '-'}</p></div>
              <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-slate-500">Principal</p><p className="text-white">{selectedInst.principal_name || '-'}</p></div>
            </div>
            {selectedInst.address && <p className="text-sm text-slate-400">📍 {selectedInst.address}{selectedInst.city ? `, ${selectedInst.city}` : ''}{selectedInst.state ? `, ${selectedInst.state}` : ''}</p>}

            {/* Admins */}
            {instStats.admins?.length > 0 && (
              <div><h4 className="text-white font-medium mb-2">👤 Administrators</h4>
                <div className="space-y-1">
                  {instStats.admins.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2 text-sm">
                      <span className="text-white">{a.full_name}</span>
                      <span className="text-slate-400">{a.role} — {a.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Years */}
            {instStats.years?.length > 0 && (
              <div><h4 className="text-white font-medium mb-2">📅 Academic Years</h4>
                <div className="space-y-1">
                  {instStats.years.map((y: any) => (
                    <div key={y.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2 text-sm">
                      <span className="text-white">{y.year_name}</span>
                      <span className={y.is_current ? 'text-emerald-400 font-medium' : 'text-slate-500'}>{y.is_current ? '✅ Current' : 'Archived'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
