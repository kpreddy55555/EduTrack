// 📊 ENHANCED Faculty Assignments API - TypeScript Error Free
// Fetches assignments, topics, and calculates comprehensive progress data

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const facultyId = searchParams.get('faculty_id')

    console.log('🔍 [API] Request received for faculty_id:', facultyId)

    if (!facultyId) {
      return NextResponse.json(
        { success: false, error: 'Faculty ID is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    console.log('🔑 [API] Using Supabase URL:', supabaseUrl)
    console.log('🔑 [API] Key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON')

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('✅ [API] Fetching complete data for faculty:', facultyId)

    // ========================================
    // STEP 1: Get Faculty Assignments
    // ========================================
    console.log('📋 [API] Step 1: Fetching assignments...')
    
    const { data: assignments, error: assignError } = await supabase
      .from('faculty_assignments')
      .select('id, subject_id, division_id, lectures_per_week, is_primary, institution_id')
      .eq('faculty_id', facultyId)

    console.log('📋 [API] Query executed')
    console.log('📋 [API] Error:', assignError)
    console.log('📋 [API] Data:', assignments)
    console.log('📋 [API] Count:', assignments?.length)

    if (assignError) {
      console.error('❌ [API] Assignment error:', assignError)
      throw new Error(`Failed to fetch assignments: ${assignError.message}`)
    }

    if (!assignments || assignments.length === 0) {
      console.log('⚠️ [API] No assignments found')
      return NextResponse.json({
        success: true,
        data: {
          total_assignments: 0,
          total_subjects: 0,
          total_divisions: 0,
          total_topics: 0,
          completed_topics: 0,
          in_progress_topics: 0,
          not_started_topics: 0,
          completion_percentage: 0,
          total_lectures_planned: 0,
          total_lectures_delivered: 0,
          subjects: [],
          divisions: [],
          assignments: [],
          recent_entries: []
        }
      })
    }

    console.log('✅ [API] Found assignments:', assignments.length)

    // ========================================
    // STEP 2: Get Related Data
    // ========================================
    const subjectIds = Array.from(new Set(assignments.map(a => a.subject_id)))
    const divisionIds = Array.from(new Set(assignments.map(a => a.division_id)))

    // Get Subjects
    const { data: subjects, error: subjError } = await supabase
      .from('subjects')
      .select('id, subject_code, subject_name')
      .in('id', subjectIds)

    if (subjError) console.error('❌ [API] Subjects error:', subjError)
    console.log('✅ [API] Found subjects:', subjects?.length)

    // Get Divisions (with standard_id for topic filtering)
    const { data: divisions, error: divError } = await supabase
      .from('divisions')
      .select('id, division_name, standard_id, stream_id')
      .in('id', divisionIds)

    if (divError) console.error('❌ [API] Divisions error:', divError)
    console.log('✅ [API] Found divisions:', divisions?.length)

    // ========================================
    // STEP 3: Get ALL Topics for Faculty
    // ========================================
    const allTopics: any[] = []
    const topicsBySubjectDivision = new Map<string, any[]>()

    for (const assignment of assignments) {
      const division = divisions?.find(d => d.id === assignment.division_id)
      const subject = subjects?.find(s => s.id === assignment.subject_id)
      
      if (!division?.standard_id || !subject) {
        console.log('⚠️ [API] Missing standard_id or subject for assignment:', assignment.id)
        continue
      }

      // Get topics filtered by subject_id AND standard_id
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('id, topic_number, topic_name, default_lectures, subject_id')
        .eq('subject_id', assignment.subject_id)
        .eq('standard_id', division.standard_id)
        .eq('is_active', true)

      if (topicsError) {
        console.error('❌ [API] Topics error:', topicsError)
      } else {
        console.log(`✅ [API] Topics for ${subject.subject_name} (${division.division_name}):`, topics?.length)
        
        if (topics && topics.length > 0) {
          // Store topics for this subject-division combo
          const key = `${assignment.subject_id}-${assignment.division_id}`
          topicsBySubjectDivision.set(key, topics)
          
          // Add to all topics (with assignment context)
          topics.forEach(topic => {
            allTopics.push({
              ...topic,
              assignment_id: assignment.id,
              subject_id: assignment.subject_id,
              division_id: assignment.division_id,
              subject_name: subject.subject_name,
              division_name: division.division_name
            })
          })
        }
      }
    }

    console.log('✅ [API] Total unique topics found:', allTopics.length)

    // ========================================
    // STEP 4: Get Syllabus Entries (Completion Data)
    // ========================================
    const { data: entries, error: entriesError } = await supabase
      .from('syllabus_entries')
      .select('id, topic_id, subject_id, division_id, lectures_taken, completion_percentage, status, teaching_date, created_at')
      .eq('faculty_id', facultyId)

    if (entriesError) {
      console.error('❌ [API] Entries error:', entriesError)
    } else {
      console.log('✅ [API] Found syllabus entries:', entries?.length)
    }

    // ========================================
    // STEP 5: Calculate Statistics
    // ========================================
    const completedTopicsSet = new Set<string>()
    const inProgressTopicsSet = new Set<string>()
    let totalLecturesPlanned = 0
    let totalLecturesDelivered = 0

    // Calculate planned lectures
    allTopics.forEach(topic => {
      totalLecturesPlanned += topic.default_lectures || 0
    })

    // Calculate completion status
    allTopics.forEach(topic => {
      const key = `${topic.subject_id}-${topic.division_id}-${topic.id}`
      
      const topicEntries = entries?.filter(e => 
        e.topic_id === topic.id && 
        e.subject_id === topic.subject_id &&
        e.division_id === topic.division_id
      ) || []

      const totalLecturesTaken = topicEntries.reduce((sum, e) => sum + (e.lectures_taken || 0), 0)
      totalLecturesDelivered += totalLecturesTaken

      if (topicEntries.length > 0 && totalLecturesTaken >= (topic.default_lectures || 0)) {
        completedTopicsSet.add(key)
      } else if (topicEntries.length > 0 && totalLecturesTaken > 0) {
        inProgressTopicsSet.add(key)
      }
    })

    const totalTopics = allTopics.length
    const completed = completedTopicsSet.size
    const inProgress = inProgressTopicsSet.size
    const notStarted = totalTopics - completed - inProgress
    const completionPercentage = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0

    // ========================================
    // STEP 6: Build Subject Statistics
    // ========================================
    const subjectsMap = new Map(subjects?.map(s => [s.id, s]) || [])
    const subjectStats: any[] = []

    subjectIds.forEach(subjectId => {
      const subject = subjectsMap.get(subjectId)
      if (!subject) return

      const subjectTopics = allTopics.filter(t => t.subject_id === subjectId)
      const subjectCompletedArray = subjectTopics.filter(t => 
        completedTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`)
      )
      const subjectCompleted = subjectCompletedArray.length

      const subjectInProgressArray = subjectTopics.filter(t => 
        inProgressTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`) &&
        !completedTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`)
      )
      const subjectInProgress = subjectInProgressArray.length

      const subjectLecturesPlanned = subjectTopics.reduce((sum, t) => sum + (t.default_lectures || 0), 0)
      
      const subjectLecturesDelivered = entries?.filter(e => e.subject_id === subjectId)
        .reduce((sum, e) => sum + (e.lectures_taken || 0), 0) || 0

      subjectStats.push({
        subject_id: subjectId,
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        total_topics: subjectTopics.length,
        completed_topics: subjectCompleted,
        in_progress_topics: subjectInProgress,
        not_started_topics: subjectTopics.length - subjectCompleted - subjectInProgress,
        completion_percentage: subjectTopics.length > 0 
          ? Math.round((subjectCompleted / subjectTopics.length) * 100) 
          : 0,
        lectures_planned: subjectLecturesPlanned,
        lectures_delivered: subjectLecturesDelivered
      })
    })

    // ========================================
    // STEP 7: Build Division Statistics
    // ========================================
    const divisionsMap = new Map(divisions?.map(d => [d.id, d]) || [])
    const divisionStats: any[] = []

    divisionIds.forEach(divisionId => {
      const division = divisionsMap.get(divisionId)
      if (!division) return

      const divisionTopics = allTopics.filter(t => t.division_id === divisionId)
      const divisionCompletedArray = divisionTopics.filter(t => 
        completedTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`)
      )
      const divisionCompleted = divisionCompletedArray.length

      const divisionInProgressArray = divisionTopics.filter(t => 
        inProgressTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`) &&
        !completedTopicsSet.has(`${t.subject_id}-${t.division_id}-${t.id}`)
      )
      const divisionInProgress = divisionInProgressArray.length

      const divisionSubjectIds = Array.from(new Set(divisionTopics.map(t => t.subject_id)))
      const divisionSubjects = divisionSubjectIds.length

      divisionStats.push({
        division_id: divisionId,
        division_name: division.division_name,
        subjects_count: divisionSubjects,
        total_topics: divisionTopics.length,
        completed_topics: divisionCompleted,
        in_progress_topics: divisionInProgress,
        not_started_topics: divisionTopics.length - divisionCompleted - divisionInProgress,
        completion_percentage: divisionTopics.length > 0 
          ? Math.round((divisionCompleted / divisionTopics.length) * 100) 
          : 0
      })
    })

    // ========================================
    // STEP 8: Get Recent Entries
    // ========================================
    const recentEntries = (entries || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(entry => {
        const topic = allTopics.find(t => t.id === entry.topic_id)
        return {
          id: entry.id,
          topic_name: topic?.topic_name || 'Unknown Topic',
          subject_name: topic?.subject_name || 'Unknown Subject',
          division_name: topic?.division_name || 'Unknown Division',
          lectures_taken: entry.lectures_taken,
          date: entry.teaching_date || entry.created_at,
          status: entry.status
        }
      })

    // ========================================
    // STEP 9: Prepare Response
    // ========================================
    const response = {
      success: true,
      data: {
        // Overall Statistics
        total_assignments: assignments.length,
        total_subjects: subjectIds.length,
        total_divisions: divisionIds.length,
        total_topics: totalTopics,
        completed_topics: completed,
        in_progress_topics: inProgress,
        not_started_topics: notStarted,
        completion_percentage: completionPercentage,
        total_lectures_planned: totalLecturesPlanned,
        total_lectures_delivered: totalLecturesDelivered,
        lecture_completion_percentage: totalLecturesPlanned > 0 
          ? Math.round((totalLecturesDelivered / totalLecturesPlanned) * 100) 
          : 0,

        // Detailed Breakdowns
        subjects: subjectStats.sort((a, b) => b.total_topics - a.total_topics),
        divisions: divisionStats.sort((a, b) => b.total_topics - a.total_topics),
        
        // Recent Activity
        recent_entries: recentEntries,

        // Quick Stats
        assignments_summary: assignments.map(a => {
          const subject = subjectsMap.get(a.subject_id)
          const division = divisionsMap.get(a.division_id)
          return {
            subject_code: subject?.subject_code || 'N/A',
            subject_name: subject?.subject_name || 'Unknown',
            division_name: division?.division_name || 'Unknown',
            is_primary: a.is_primary
          }
        })
      }
    }

    console.log('✅ [API] Response prepared successfully:', {
      total_topics: totalTopics,
      completed: completed,
      percentage: completionPercentage
    })

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ [API] Fatal error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}