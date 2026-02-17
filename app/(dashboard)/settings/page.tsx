'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
  phone: string | null
  institution_id: string
}

interface Institution {
  id: string
  name: string
  short_name: string | null
  udise_number: string | null
  index_number: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  logo_url: string | null
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'institution' | 'security'>('profile')
  const supabase = createClient()

  // Profile form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Institution form
  const [instForm, setInstForm] = useState({
    name: '',
    short_name: '',
    udise_number: '',
    index_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    logo_url: ''
  })

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (userData) {
        setUser(userData)
        setFullName(userData.full_name || '')
        setPhone(userData.phone || '')

        const { data: instData } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userData.institution_id)
          .single()

        if (instData) {
          setInstitution(instData)
          setInstForm({
            name: instData.name || '',
            short_name: instData.short_name || '',
            udise_number: instData.udise_number || '',
            index_number: instData.index_number || '',
            address: instData.address || '',
            city: instData.city || '',
            state: instData.state || '',
            pincode: instData.pincode || '',
            contact_email: instData.contact_email || '',
            contact_phone: instData.contact_phone || '',
            website: instData.website || '',
            logo_url: instData.logo_url || ''
          })
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!user) return
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          phone: phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setUser({ ...user, full_name: fullName, phone })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateInstitution = async () => {
    if (!institution || !user || !['admin', 'superadmin', 'institution_admin', 'super_admin'].includes(user.role)) {
      setMessage({ type: 'error', text: 'Only admins can update institution settings' })
      return
    }
    
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('institutions')
        .update({
          name: instForm.name,
          short_name: instForm.short_name || null,
          udise_number: instForm.udise_number || null,
          index_number: instForm.index_number || null,
          address: instForm.address || null,
          city: instForm.city || null,
          state: instForm.state || null,
          pincode: instForm.pincode || null,
          contact_email: instForm.contact_email || null,
          contact_phone: instForm.contact_phone || null,
          website: instForm.website || null,
          logo_url: instForm.logo_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', institution.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Institution details updated successfully!' })
      setInstitution({ ...institution, ...instForm })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update institution' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !institution) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 2MB' })
      return
    }

    setUploadingLogo(true)
    setMessage(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${institution.id}-logo.${fileExt}`
      const filePath = `logos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('institution-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('institution-assets')
        .getPublicUrl(filePath)

      // Update institution with logo URL
      const { error: updateError } = await supabase
        .from('institutions')
        .update({ logo_url: publicUrl })
        .eq('id', institution.id)

      if (updateError) throw updateError

      setInstForm({ ...instForm, logo_url: publicUrl })
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' })
    } catch (error: any) {
      console.error('Upload error:', error)
      setMessage({ type: 'error', text: 'Failed to upload logo. Make sure storage is configured.' })
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Password changed successfully!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'institution_admin' || user?.role === 'super_admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Manage your profile and institution settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'profile'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('institution')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'institution'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Institution
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'security'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Security
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user?.full_name}</h2>
              <p className="text-slate-400">{user?.email}</p>
              <span className="inline-block mt-2 px-3 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 capitalize">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleUpdateProfile}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Institution Tab */}
      {activeTab === 'institution' && (
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Institution Logo</h3>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-white/20">
                {instForm.logo_url ? (
                  <img src={instForm.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-4xl">🏫</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo || !isAdmin}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 disabled:opacity-50"
                >
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-xs text-slate-500 mt-2">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </div>

          {/* Institution Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Institution Details</h3>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Institution Name</label>
                <input
                  type="text"
                  value={instForm.name}
                  onChange={(e) => setInstForm({ ...instForm, name: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white disabled:text-slate-400 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Short Name</label>
                  <input
                    type="text"
                    value={instForm.short_name}
                    onChange={(e) => setInstForm({ ...instForm, short_name: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="e.g., AES"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                  <input
                    type="url"
                    value={instForm.website}
                    onChange={(e) => setInstForm({ ...instForm, website: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    UDISE Number
                    <span className="ml-2 text-xs text-slate-500">(Unique ID)</span>
                  </label>
                  <input
                    type="text"
                    value={instForm.udise_number}
                    onChange={(e) => setInstForm({ ...instForm, udise_number: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="Enter UDISE Number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Index Number
                    <span className="ml-2 text-xs text-slate-500">(Board Index)</span>
                  </label>
                  <input
                    type="text"
                    value={instForm.index_number}
                    onChange={(e) => setInstForm({ ...instForm, index_number: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="Enter Index Number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Contact Details</h3>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                <textarea
                  value={instForm.address}
                  onChange={(e) => setInstForm({ ...instForm, address: e.target.value })}
                  disabled={!isAdmin}
                  rows={2}
                  placeholder="Street address"
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                  <input
                    type="text"
                    value={instForm.city}
                    onChange={(e) => setInstForm({ ...instForm, city: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
                  <input
                    type="text"
                    value={instForm.state}
                    onChange={(e) => setInstForm({ ...instForm, state: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Pincode</label>
                  <input
                    type="text"
                    value={instForm.pincode}
                    onChange={(e) => setInstForm({ ...instForm, pincode: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={instForm.contact_email}
                    onChange={(e) => setInstForm({ ...instForm, contact_email: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={instForm.contact_phone}
                    onChange={(e) => setInstForm({ ...instForm, contact_phone: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="e.g., 022-12345678"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {isAdmin ? (
              <button
                onClick={handleUpdateInstitution}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Institution Details'}
              </button>
            ) : (
              <p className="text-sm text-slate-500">
                Contact your institution administrator to update these details.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Change Password</h2>
            <p className="text-sm text-slate-400">Update your password to keep your account secure</p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      )}
    </div>
  )
}
