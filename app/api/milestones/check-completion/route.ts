export const dynamic = 'force-dynamic'
// API Route to check topic completion (bypasses all RLS and 406 errors)
// app/api/milestones/check-completion/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

let _supabase: any = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return _supabase
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { faculty_id, topic_id, division_id, subject_id } = body

    console.log('🔍 [API] Checking completion:', { faculty_id, topic_id, division_id, subject_id })

    // Build query
    let query = supabase
      .from('syllabus_entries')
      .select('id, lectures_taken, teaching_date, remarks, faculty_id')
      .eq('topic_id', topic_id)
      .eq('division_id', division_id)
      .gte('lectures_taken', 1)

    // If faculty_id provided, filter by faculty (for faculty users)
    if (faculty_id) {
      query = query.eq('faculty_id', faculty_id)
    }

    // If subject_id provided, add it to query
    if (subject_id) {
      query = query.eq('subject_id', subject_id)
    }

    // Order by date and get the most recent one
    query = query.order('teaching_date', { ascending: false }).limit(1)

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [API] Error:', error)
      // Return false instead of error to keep frontend working
      return NextResponse.json({ 
        completed: false,
        lectures_taken: 0
      }, { status: 200 })
    }

    const completed = !!data && data.lectures_taken >= 1

    console.log('✅ [API] Result:', completed, data?.lectures_taken || 0)

    return NextResponse.json({ 
      completed,
      lectures_taken: data?.lectures_taken || 0,
      teaching_date: data?.teaching_date,
      remarks: data?.remarks,
      faculty_id: data?.faculty_id
    })

  } catch (error: any) {
    console.error('❌ [API] Exception:', error)
    // Return false instead of error to keep frontend working
    return NextResponse.json({ 
      completed: false,
      lectures_taken: 0
    }, { status: 200 })
  }
}
