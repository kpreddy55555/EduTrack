'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InstitutionSettings() {
  const [institution, setInstitution] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '', board_name: 'Maharashtra State Board', board_code: 'MSB',
    affiliation_number: '', contact_email: '', contact_phone: '',
    address: '', city: '', state: '', principal_name: '',
    academic_start_month: 'June', academic_end_month: 'May', logo_url: '',
  })

  const supabase = createClient()

  useEffect(() => { fetchInstitutionSettings() }, [])

  const fetchInstitutionSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase.from('users').select('institution_id').eq('id', session.user.id).single()
      if (!userData) return
      const { data: inst } = await supabase.from('institutions').select('*').eq('id', userData.institution_id).single()
      if (inst) {
        setInstitution(inst)
        setFormData({
          name: inst.name || inst.institution_name || '',
          board_name: inst.board_name || 'Maharashtra State Board',
          board_code: inst.board_code || 'MSB',
          affiliation_number: inst.affiliation_number || '',
          contact_email: inst.contact_email || '',
          contact_phone: inst.contact_phone || '',
          address: inst.address || '',
          city: inst.city || '',
          state: inst.state || '',
          principal_name: inst.principal_name || '',
          academic_start_month: inst.academic_start_month || 'June',
          academic_end_month: inst.academic_end_month || 'May',
          logo_url: inst.logo_url || '',
        })
      }
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true); setMessage(null)
    try {
      const updateData: any = { ...formData }
      delete updateData.logo_url
      const { error } = await supabase.from('institutions').update(updateData).eq('id', institution.id)
      if (error) throw error
      setMessage({ type: 'success', text: '✓ Settings saved!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  // Robust logo upload using label+input approach
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !institution) return

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file (PNG, JPG, etc.)' }); return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 2MB' }); return
    }

    setUploadingLogo(true); setMessage(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${institution.id}-logo.${fileExt}`
      const filePath = `logos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('institution-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
          throw new Error('Storage bucket "institution-assets" not found. Run UPGRADE_V5.sql in Supabase SQL Editor first.')
        }
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('institution-assets')
        .getPublicUrl(filePath)

      // Update institution record
      const { error: updateError } = await supabase
        .from('institutions')
        .update({ logo_url: publicUrl })
        .eq('id', institution.id)

      if (updateError) throw updateError

      setFormData(prev => ({ ...prev, logo_url: publicUrl }))
      setMessage({ type: 'success', text: '✓ Logo uploaded successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Logo upload error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to upload logo' })
    } finally {
      setUploadingLogo(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const removeLogo = async () => {
    if (!confirm('Remove institution logo?') || !institution) return
    try {
      await supabase.from('institutions').update({ logo_url: null }).eq('id', institution.id)
      setFormData(prev => ({ ...prev, logo_url: '' }))
      setMessage({ type: 'success', text: 'Logo removed' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) { setMessage({ type: 'error', text: error.message }) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div></div>

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Institution Information</h2><p className="text-slate-400">Configure your institution, board details, and logo</p></div>

      {message && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{message.text}</div>
      )}

      {/* Logo Section - Using label+input for robust click handling */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🏫 Institution Logo</h3>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-white/20 flex-shrink-0">
            {formData.logo_url ? (
              <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-4xl">🏫</span>
            )}
          </div>
          <div className="space-y-2">
            {/* Using label htmlFor instead of ref.click() - more reliable across browsers */}
            <input
              type="file"
              id="logo-file-input"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />
            <div className="flex gap-2">
              <label
                htmlFor="logo-file-input"
                className={`px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors border border-amber-500/30 text-sm font-medium cursor-pointer inline-block ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploadingLogo ? '⏳ Uploading...' : '📤 Upload Logo'}
              </label>
              {formData.logo_url && (
                <button onClick={removeLogo} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm border border-red-500/20">Remove</button>
              )}
            </div>
            <p className="text-xs text-slate-500">PNG or JPG, max 2MB. Used on reports and printed documents.</p>
            <p className="text-xs text-slate-500">⚠️ Make sure to run UPGRADE_V5.sql first to create the storage bucket.</p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid md:grid-cols-2 gap-6">
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Institution Name</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="The Andhra Education Society" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Board Name</label>
          <select value={formData.board_name} onChange={e => setFormData({ ...formData, board_name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white">
            <option value="Maharashtra State Board">Maharashtra State Board</option><option value="CBSE">CBSE</option><option value="ICSE">ICSE</option><option value="IB">IB</option></select></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Board Code</label>
          <input type="text" value={formData.board_code} onChange={e => setFormData({ ...formData, board_code: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" placeholder="MSB" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Affiliation Number</label>
          <input type="text" value={formData.affiliation_number} onChange={e => setFormData({ ...formData, affiliation_number: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Principal Name</label>
          <input type="text" value={formData.principal_name} onChange={e => setFormData({ ...formData, principal_name: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Contact Email</label>
          <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Contact Phone</label>
          <input type="tel" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">City</label>
          <input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">State</label>
          <input type="text" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-2">Academic Start Month</label>
          <select value={formData.academic_start_month} onChange={e => setFormData({ ...formData, academic_start_month: e.target.value })} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white">
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
          <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white" /></div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl disabled:opacity-50">
          {saving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  )
}
