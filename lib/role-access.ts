// lib/role-access.ts
// Shared utility for role-based data filtering across all modules

import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'superadmin' | 'admin' | 'hod' | 'faculty' | 'student'

export interface CurrentUser {
  id: string
  full_name: string
  role: UserRole
  institution_id: string
  department_id?: string | null
}

// Can this role edit/create data?
export function canEdit(role: UserRole): boolean {
  return ['superadmin', 'admin', 'faculty'].includes(role)
}

// Can this role only view data?
export function isViewOnly(role: UserRole): boolean {
  return role === 'hod' || role === 'student'
}

// Can this role see ALL data (no faculty filter)?
export function canSeeAll(role: UserRole): boolean {
  return ['superadmin', 'admin', 'hod'].includes(role)
}

// Can this role manage system settings?
export function canManageSystem(role: UserRole): boolean {
  return ['superadmin', 'admin'].includes(role)
}

// Get faculty's assigned subject IDs
export async function getFacultySubjectIds(supabase: SupabaseClient, facultyId: string): Promise<string[]> {
  const { data } = await supabase
    .from('faculty_assignments')
    .select('subject_id')
    .eq('faculty_id', facultyId)
  return [...new Set((data || []).map(a => a.subject_id))]
}

// Get faculty's assigned division IDs
export async function getFacultyDivisionIds(supabase: SupabaseClient, facultyId: string): Promise<string[]> {
  const { data } = await supabase
    .from('faculty_assignments')
    .select('division_id')
    .eq('faculty_id', facultyId)
  return [...new Set((data || []).map(a => a.division_id))]
}

// Get faculty's full assignments (subject + division pairs)
export async function getFacultyAssignments(supabase: SupabaseClient, facultyId: string) {
  const { data } = await supabase
    .from('faculty_assignments')
    .select('subject_id, division_id')
    .eq('faculty_id', facultyId)
  return data || []
}

// Check if entry is within editable period (10 days)
export function isEntryEditable(teachingDate: string, maxDays: number = 10): boolean {
  const entryDate = new Date(teachingDate)
  const now = new Date()
  const diffMs = now.getTime() - entryDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= maxDays
}
