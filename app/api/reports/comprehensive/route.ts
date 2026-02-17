// ✅ REPORTS API v3 - Proper filters + New report types
// Fixes: filters not working, adds division comparison report
// app/api/reports/comprehensive/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

let _supabase: any = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return _supabase
}

// Proxy so all existing `supabase.from(...)` calls work without refactoring
const supabase = new Proxy({} as any, {
  get(_target, prop) { return (getSupabase() as any)[prop] }
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { report_type, institution_id, academic_year_id, filters } = body

    console.log('📊 [API] Generating report:', report_type)
    console.log('🔍 [API] Filters:', filters)

    let reportData: any = {}

    switch (report_type) {
      case 'faculty-workload':
        reportData = await generateFacultyWorkloadReport(institution_id, academic_year_id, filters)
        break
      case 'faculty-details':
        reportData = await generateFacultyDetailsReport(institution_id, academic_year_id, filters)
        break
      case 'division-status':
        reportData = await generateDivisionStatusReport(institution_id, academic_year_id, filters)
        break
      case 'subject-completion':
        reportData = await generateSubjectCompletionReport(institution_id, academic_year_id, filters)
        break
      case 'topic-status':
        reportData = await generateTopicStatusReport(institution_id, academic_year_id, filters)
        break
      case 'lagging-topics':
        reportData = await generateLaggingTopicsReport(institution_id, academic_year_id, filters)
        break
      case 'division-comparison':
        reportData = await generateDivisionComparisonReport(institution_id, academic_year_id, filters)
        break
      case 'faculty-pace':
        reportData = await generateFacultyPaceReport(institution_id, academic_year_id, filters)
        break
      case 'monthly-progress':
        reportData = await generateMonthlyProgressReport(institution_id, academic_year_id, filters)
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    console.log('✅ [API] Report generated successfully')
    return NextResponse.json(reportData)
  } catch (error: any) {
    console.error('❌ [API] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ========================================================================
// Helper: Build lookup maps (avoids FK joins)
// ========================================================================
async function buildLookupMaps(institution_id: string) {
  const [topicsRes, subjectsRes, divisionsRes, usersRes, standardsRes] = await Promise.all([
    supabase.from('topics').select('id, topic_name, topic_number, default_lectures, subject_id, standard_id').eq('institution_id', institution_id),
    supabase.from('subjects').select('id, subject_name, subject_code').eq('institution_id', institution_id),
    supabase.from('divisions').select('id, division_name, standard_id, stream_id').eq('institution_id', institution_id),
    supabase.from('users').select('id, full_name').eq('institution_id', institution_id),
    supabase.from('standards').select('id, standard_name').eq('institution_id', institution_id),
  ])

  const topicsMap = new Map((topicsRes.data || []).map(t => [t.id, t]))
  const subjectsMap = new Map((subjectsRes.data || []).map(s => [s.id, s]))
  const divisionsMap = new Map((divisionsRes.data || []).map(d => [d.id, d]))
  const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]))
  const standardsMap = new Map((standardsRes.data || []).map(s => [s.id, s]))

  return {
    topicsMap, subjectsMap, divisionsMap, usersMap, standardsMap,
    topics: topicsRes.data || [],
    subjects: subjectsRes.data || [],
    divisions: divisionsRes.data || [],
    standards: standardsRes.data || []
  }
}

// ========================================================================
// Helper: Get faculty's assigned subjects from faculty_assignments
// ========================================================================
async function getFacultySubjectIds(faculty_id: string): Promise<string[]> {
  const { data } = await supabase
    .from('faculty_assignments')
    .select('subject_id')
    .eq('faculty_id', faculty_id)

  return Array.from(new Set((data || []).map(a => a.subject_id)))
}

// ========================================================================
// Helper: Get faculty's assigned divisions from faculty_assignments
// ========================================================================
async function getFacultyDivisionIds(faculty_id: string): Promise<string[]> {
  const { data } = await supabase
    .from('faculty_assignments')
    .select('division_id')
    .eq('faculty_id', faculty_id)

  return Array.from(new Set((data || []).map(a => a.division_id)))
}

// ========================================================================
// Helper: Build filtered entries query with ALL filters
// ========================================================================
function buildEntriesQuery(institution_id: string, filters: any, selectCols: string) {
  let query = supabase
    .from('syllabus_entries')
    .select(selectCols)
    .eq('institution_id', institution_id)

  if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)
  if (filters.division_id) query = query.eq('division_id', filters.division_id)
  if (filters.subject_id) query = query.eq('subject_id', filters.subject_id)

  return query
}

// ========================================================================
// 1. FACULTY WORKLOAD REPORT
// ========================================================================
async function generateFacultyWorkloadReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('📅 [WORKLOAD] Starting...')

  const { data: faculty } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('institution_id', institution_id)
    .eq('role', 'faculty')
    .order('full_name')

  console.log(`✅ Found ${faculty?.length || 0} faculty members`)

  const months = ['March', 'April', 'June', 'July', 'August', 'Sept.', 'Octo.', 'Nove.', 'Dece.', 'Janu.', 'Febr.']
  const monthMap: Record<string, number> = {
    'March': 3, 'April': 4, 'June': 6, 'July': 7, 'August': 8,
    'Sept.': 9, 'Octo.': 10, 'Nove.': 11, 'Dece.': 12, 'Janu.': 1, 'Febr.': 2
  }

  const facultyData = await Promise.all(
    (faculty || []).map(async (f) => {
      const nameParts = f.full_name.toUpperCase().split(' ')
      const code = nameParts.map((part: string) => part.charAt(0)).join('')

      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('lectures_taken, teaching_date')
        .eq('faculty_id', f.id)
        .gte('lectures_taken', 0.5)

      console.log(`  Faculty ${f.full_name}: ${entries?.length || 0} entries`)

      const monthly_lectures: number[] = months.map((monthName) => {
        const monthNum = monthMap[monthName]
        const monthEntries = entries?.filter(e => {
          if (!e.teaching_date) return false
          const d = new Date(e.teaching_date)
          return d.getMonth() + 1 === monthNum
        }) || []
        return Math.round(monthEntries.reduce((sum, e) => sum + (e.lectures_taken || 0), 0) * 10) / 10
      })

      const total = Math.round(monthly_lectures.reduce((a, b) => a + b, 0) * 10) / 10
      return { name: f.full_name, code, monthly_lectures, total }
    })
  )

  return { months, faculty: facultyData }
}

// ========================================================================
// 2. FACULTY DETAILS REPORT — Filters by faculty's ASSIGNMENTS
// ========================================================================
async function generateFacultyDetailsReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('👨‍🏫 [FACULTY DETAILS] Starting...')
  console.log('   Filters:', filters)

  const { topicsMap, subjectsMap, divisionsMap, usersMap } = await buildLookupMaps(institution_id)

  let query = buildEntriesQuery(institution_id, filters,
    'id, teaching_date, lectures_taken, topic_id, division_id, subject_id, faculty_id')

  // If standard_id selected, find divisions in that standard and filter
  if (filters.standard_id) {
    const standardDivisions = [...divisionsMap.values()].filter(d => d.standard_id === filters.standard_id)
    const divIds = standardDivisions.map(d => d.id)
    if (divIds.length > 0) query = query.in('division_id', divIds)
  }

  query = query.order('teaching_date', { ascending: true })

  const { data: entries, error } = await query

  if (error) {
    console.error('❌ Query error:', error)
    return { entries: [] }
  }

  console.log(`✅ Found ${entries?.length || 0} entries`)

  const reportEntries = (entries || []).map((entry: any) => {
    const topic = topicsMap.get(entry.topic_id)
    const subject = subjectsMap.get(entry.subject_id)
    const division = divisionsMap.get(entry.division_id)
    const faculty = usersMap.get(entry.faculty_id)

    return {
      start_date: entry.teaching_date ? new Date(entry.teaching_date).toLocaleDateString('en-GB') : 'N/A',
      month: entry.teaching_date ? new Date(entry.teaching_date).toLocaleDateString('en-US', { month: 'long' }) : 'N/A',
      division: division?.division_name || 'N/A',
      subject: subject?.subject_name || 'N/A',
      subject_code: subject?.subject_code || 'N/A',
      topic_name: topic?.topic_name || 'N/A',
      lectures_allotted: topic?.default_lectures || 0,
      lectures_taken: entry.lectures_taken,
      faculty: faculty?.full_name || 'N/A',
      status: entry.lectures_taken >= (topic?.default_lectures || 1) ? 'Completed' : 'In Progress'
    }
  })

  return { entries: reportEntries }
}

// ========================================================================
// 3. DIVISION STATUS REPORT — Now filters by faculty/standard/division/subject
// ========================================================================
async function generateDivisionStatusReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('🏫 [DIVISION STATUS] Starting...')

  const { topicsMap, subjectsMap, divisionsMap, usersMap, topics } = await buildLookupMaps(institution_id)

  // Filter topics by subject
  let filteredTopics = topics
  if (filters.subject_id) {
    filteredTopics = topics.filter(t => t.subject_id === filters.subject_id)
  }

  // If faculty selected, only show their assigned subjects' topics
  if (filters.faculty_id && !filters.subject_id) {
    const facultySubjectIds = await getFacultySubjectIds(filters.faculty_id)
    filteredTopics = filteredTopics.filter(t => facultySubjectIds.includes(t.subject_id))
  }

  // Filter by standard
  if (filters.standard_id) {
    filteredTopics = filteredTopics.filter(t => t.standard_id === filters.standard_id)
  }

  console.log(`✅ Found ${filteredTopics.length} topics after filtering`)

  const reportTopics: any[] = []

  for (const topic of filteredTopics) {
    const subject = subjectsMap.get(topic.subject_id)

    let entryQuery = supabase
      .from('syllabus_entries')
      .select('lectures_taken, teaching_date, division_id, faculty_id')
      .eq('topic_id', topic.id)
      .gte('lectures_taken', 0.5)

    if (filters.faculty_id) entryQuery = entryQuery.eq('faculty_id', filters.faculty_id)
    if (filters.division_id) entryQuery = entryQuery.eq('division_id', filters.division_id)

    const { data: entries } = await entryQuery

    // Group by division
    const divGroupMap = new Map()
    entries?.forEach((entry: any) => {
      const div = divisionsMap.get(entry.division_id)
      const divName = div?.division_name || 'Unknown'
      const stdName = div?.standard_id ? 'Class' : 'N/A'

      if (!divGroupMap.has(entry.division_id)) {
        divGroupMap.set(entry.division_id, {
          division: divName,
          faculty: usersMap.get(entry.faculty_id)?.full_name || 'N/A',
          lectures_taken: 0,
          start_date: entry.teaching_date
        })
      }
      divGroupMap.get(entry.division_id).lectures_taken += entry.lectures_taken
    })

    divGroupMap.forEach((divData: any) => {
      reportTopics.push({
        division: divData.division,
        subject: subject?.subject_name || 'N/A',
        subject_code: subject?.subject_code || 'N/A',
        topic_code: `${subject?.subject_code}-${topic.topic_number}`,
        topic_name: topic.topic_name,
        lectures_allotted: topic.default_lectures,
        start_date: divData.start_date ? new Date(divData.start_date).toLocaleDateString('en-GB') : 'N/A',
        lectures_taken: Math.round(divData.lectures_taken * 10) / 10,
        faculty: divData.faculty,
        status: divData.lectures_taken >= (topic.default_lectures || 1) ? 'Completed' : 'In Progress'
      })
    })
  }

  console.log(`✅ Generated ${reportTopics.length} entries`)
  return { topics: reportTopics }
}

// ========================================================================
// 4. SUBJECT COMPLETION — Filters by faculty assignments + standard + division
// ========================================================================
async function generateSubjectCompletionReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('📚 [SUBJECT COMPLETION] Starting...')

  const { topicsMap, subjects, topics, divisionsMap } = await buildLookupMaps(institution_id)

  let filteredSubjects = subjects
  if (filters.subject_id) {
    filteredSubjects = subjects.filter(s => s.id === filters.subject_id)
  }

  // If faculty selected, only show their assigned subjects
  if (filters.faculty_id && !filters.subject_id) {
    const facultySubjectIds = await getFacultySubjectIds(filters.faculty_id)
    filteredSubjects = filteredSubjects.filter(s => facultySubjectIds.includes(s.id))
  }

  console.log(`✅ Found ${filteredSubjects.length} subjects`)

  const subjectData = await Promise.all(
    filteredSubjects.map(async (subject) => {
      let subjectTopics = topics.filter(t => t.subject_id === subject.id)
      if (filters.standard_id) {
        subjectTopics = subjectTopics.filter(t => t.standard_id === filters.standard_id)
      }
      const total_topics = subjectTopics.length

      if (total_topics === 0) {
        return {
          subject_name: subject.subject_name,
          subject_code: subject.subject_code,
          total_topics: 0, completed_topics: 0, remaining_topics: 0, completion_percentage: 0
        }
      }

      // Get entries with filters
      let query = supabase
        .from('syllabus_entries')
        .select('topic_id, lectures_taken')
        .eq('subject_id', subject.id)
        .eq('institution_id', institution_id)

      if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)
      if (filters.division_id) query = query.eq('division_id', filters.division_id)

      // If standard but no division, filter by all divisions in that standard
      if (filters.standard_id && !filters.division_id) {
        const stdDivs = [...divisionsMap.values()].filter(d => d.standard_id === filters.standard_id)
        if (stdDivs.length > 0) query = query.in('division_id', stdDivs.map(d => d.id))
      }

      const { data: entries } = await query

      const topicLecturesMap = new Map<string, number>()
      entries?.forEach((e: any) => {
        const existing = topicLecturesMap.get(e.topic_id) || 0
        topicLecturesMap.set(e.topic_id, existing + (e.lectures_taken || 0))
      })

      let completed = 0
      // Only count topics that belong to this subject
      const subjectTopicIds = new Set(subjectTopics.map(t => t.id))
      topicLecturesMap.forEach((totalLectures, topicId) => {
        if (!subjectTopicIds.has(topicId)) return
        const topic = topicsMap.get(topicId)
        if (topic && totalLectures >= (topic.default_lectures || 1)) {
          completed++
        }
      })

      return {
        subject_name: subject.subject_name,
        subject_code: subject.subject_code,
        total_topics,
        completed_topics: completed,
        remaining_topics: total_topics - completed,
        completion_percentage: Math.round((completed / total_topics) * 100)
      }
    })
  )

  // Filter out subjects with 0 topics (irrelevant)
  const filtered = subjectData.filter(s => s.total_topics > 0)
  return { subjects: filtered }
}

// ========================================================================
// 5. TOPIC STATUS — Filters by faculty/standard/division/subject
// ========================================================================
async function generateTopicStatusReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('📝 [TOPIC STATUS] Starting...')

  const { subjectsMap, topics, divisionsMap } = await buildLookupMaps(institution_id)

  let filteredTopics = topics
  if (filters.subject_id) {
    filteredTopics = topics.filter(t => t.subject_id === filters.subject_id)
  }
  if (filters.standard_id) {
    filteredTopics = filteredTopics.filter(t => t.standard_id === filters.standard_id)
  }
  if (filters.faculty_id && !filters.subject_id) {
    const facultySubjectIds = await getFacultySubjectIds(filters.faculty_id)
    filteredTopics = filteredTopics.filter(t => facultySubjectIds.includes(t.subject_id))
  }

  console.log(`✅ Found ${filteredTopics.length} topics`)

  const topicData = await Promise.all(
    filteredTopics.map(async (topic: any) => {
      const subject = subjectsMap.get(topic.subject_id)

      let query = supabase
        .from('syllabus_entries')
        .select('lectures_taken')
        .eq('topic_id', topic.id)
        .gte('lectures_taken', 0.5)

      if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)
      if (filters.division_id) query = query.eq('division_id', filters.division_id)
      if (filters.standard_id && !filters.division_id) {
        const stdDivs = [...divisionsMap.values()].filter(d => d.standard_id === filters.standard_id)
        if (stdDivs.length > 0) query = query.in('division_id', stdDivs.map(d => d.id))
      }

      const { data: entries } = await query

      const total_lectures = entries?.reduce((sum, e) => sum + (e.lectures_taken || 0), 0) || 0
      const completed = total_lectures >= (topic.default_lectures || 1)

      return {
        subject: subject?.subject_name || 'N/A',
        topic_code: `${subject?.subject_code || ''}-${String(topic.topic_number).padStart(2, '0')}`,
        topic_name: topic.topic_name,
        allotted_lectures: topic.default_lectures,
        completed_in: completed ? Math.round(total_lectures * 10) / 10 : null,
        status: completed ? 'Completed' : 'In Progress'
      }
    })
  )

  return { topics: topicData }
}

// ========================================================================
// 6. LAGGING TOPICS — Filters by all criteria
// ========================================================================
async function generateLaggingTopicsReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('⚠️ [LAGGING TOPICS] Starting...')

  const { subjectsMap, divisionsMap, usersMap, topics } = await buildLookupMaps(institution_id)

  let filteredTopics = topics
  if (filters.subject_id) filteredTopics = filteredTopics.filter(t => t.subject_id === filters.subject_id)
  if (filters.standard_id) filteredTopics = filteredTopics.filter(t => t.standard_id === filters.standard_id)
  if (filters.faculty_id && !filters.subject_id) {
    const fSubjectIds = await getFacultySubjectIds(filters.faculty_id)
    filteredTopics = filteredTopics.filter(t => fSubjectIds.includes(t.subject_id))
  }

  console.log(`✅ Found ${filteredTopics.length} topics to check`)

  const laggingTopics: any[] = []

  for (const topic of filteredTopics) {
    const subject = subjectsMap.get(topic.subject_id)

    let query = supabase
      .from('syllabus_entries')
      .select('lectures_taken, faculty_id, division_id, teaching_date')
      .eq('topic_id', topic.id)
      .gte('lectures_taken', 0.5)

    if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)
    if (filters.division_id) query = query.eq('division_id', filters.division_id)

    const { data: entries } = await query

    const total_lectures = entries?.reduce((sum: number, e: any) => sum + (e.lectures_taken || 0), 0) || 0
    const completed = total_lectures >= (topic.default_lectures || 1)

    // Topic is lagging if it has some entries but isn't completed
    if (!completed && entries && entries.length > 0) {
      const firstEntry = entries[0]
      const progress = (topic.default_lectures || 1) > 0 ? total_lectures / topic.default_lectures : 0
      const remaining = (topic.default_lectures || 0) - total_lectures

      laggingTopics.push({
        division: divisionsMap.get(firstEntry.division_id)?.division_name || 'N/A',
        subject: subject?.subject_name || 'N/A',
        topic_name: topic.topic_name,
        allotted: topic.default_lectures,
        taken: Math.round(total_lectures * 10) / 10,
        remaining: Math.round(remaining * 10) / 10,
        progress_pct: Math.round(progress * 100),
        faculty: usersMap.get(firstEntry.faculty_id)?.full_name || 'N/A',
        last_date: entries.length > 0 ? entries[entries.length - 1].teaching_date : null,
        priority: progress < 0.3 ? 'High' : progress < 0.7 ? 'Medium' : 'Low'
      })
    }
  }

  // Sort: High priority first
  laggingTopics.sort((a, b) => {
    const p = { High: 0, Medium: 1, Low: 2 }
    return (p[a.priority as keyof typeof p] || 0) - (p[b.priority as keyof typeof p] || 0)
  })

  console.log(`✅ Found ${laggingTopics.length} lagging topics`)
  return { lagging_topics: laggingTopics }
}

// ========================================================================
// 7. ⭐ NEW: DIVISION COMPARISON REPORT
//    Compare topic progress across divisions of the SAME standard
// ========================================================================
async function generateDivisionComparisonReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('📊 [DIVISION COMPARISON] Starting...')

  const { topicsMap, subjectsMap, divisionsMap, standardsMap, topics, divisions } = await buildLookupMaps(institution_id)

  // Must have at least a standard selected for meaningful comparison
  let targetDivisions = divisions
  if (filters.standard_id) {
    targetDivisions = divisions.filter(d => d.standard_id === filters.standard_id)
  }
  if (filters.division_id) {
    // If specific division selected, get all divisions in same standard
    const selectedDiv = divisionsMap.get(filters.division_id)
    if (selectedDiv) {
      targetDivisions = divisions.filter(d => d.standard_id === selectedDiv.standard_id)
    }
  }

  console.log(`✅ Comparing ${targetDivisions.length} divisions`)

  // Get relevant topics
  let filteredTopics = topics
  if (filters.subject_id) {
    filteredTopics = topics.filter(t => t.subject_id === filters.subject_id)
  }
  if (filters.standard_id) {
    filteredTopics = filteredTopics.filter(t => t.standard_id === filters.standard_id)
  }
  if (filters.faculty_id && !filters.subject_id) {
    const fSubjectIds = await getFacultySubjectIds(filters.faculty_id)
    filteredTopics = filteredTopics.filter(t => fSubjectIds.includes(t.subject_id))
  }

  console.log(`✅ Checking ${filteredTopics.length} topics across divisions`)

  // Group topics by subject for cleaner output
  const subjectGroupMap = new Map<string, any[]>()

  for (const topic of filteredTopics) {
    const subject = subjectsMap.get(topic.subject_id)
    const subjectKey = subject?.subject_name || topic.subject_id

    // For each division, get lectures taken for this topic
    const divisionProgress: Record<string, { taken: number; status: string }> = {}

    for (const div of targetDivisions) {
      let query = supabase
        .from('syllabus_entries')
        .select('lectures_taken')
        .eq('topic_id', topic.id)
        .eq('division_id', div.id)
        .gte('lectures_taken', 0.5)

      if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)

      const { data: entries } = await query

      const totalTaken = entries?.reduce((sum, e) => sum + (e.lectures_taken || 0), 0) || 0
      const completed = totalTaken >= (topic.default_lectures || 1)

      divisionProgress[div.division_name] = {
        taken: Math.round(totalTaken * 10) / 10,
        status: completed ? 'Done' : totalTaken > 0 ? 'In Progress' : 'Not Started'
      }
    }

    // Check if divisions are misaligned
    const statuses = Object.values(divisionProgress).map(d => d.status)
    const allSame = statuses.every(s => s === statuses[0])
    const alignment = allSame ? 'Aligned' : 'Misaligned'

    const topicRow = {
      subject: subjectKey,
      subject_code: subject?.subject_code || '',
      topic_name: topic.topic_name,
      topic_number: topic.topic_number,
      allotted: topic.default_lectures,
      divisions: divisionProgress,
      alignment
    }

    if (!subjectGroupMap.has(subjectKey)) {
      subjectGroupMap.set(subjectKey, [])
    }
    subjectGroupMap.get(subjectKey)!.push(topicRow)
  }

  // Build final structure
  const comparison: any[] = []
  subjectGroupMap.forEach((topicRows, subjectName) => {
    comparison.push({
      subject: subjectName,
      topics: topicRows
    })
  })

  // Summary stats
  let totalTopics = 0, alignedCount = 0, misalignedCount = 0
  comparison.forEach(s => {
    s.topics.forEach((t: any) => {
      totalTopics++
      if (t.alignment === 'Aligned') alignedCount++
      else misalignedCount++
    })
  })

  return {
    division_names: targetDivisions.map(d => d.division_name),
    standard: filters.standard_id ? standardsMap.get(filters.standard_id)?.standard_name : 'All Standards',
    comparison,
    summary: {
      total_topics: totalTopics,
      aligned: alignedCount,
      misaligned: misalignedCount,
      alignment_pct: totalTopics > 0 ? Math.round((alignedCount / totalTopics) * 100) : 0
    }
  }
}

// ========================================================================
// 8. ⭐ NEW: FACULTY PACE REPORT
//    Shows how fast each faculty is completing syllabus vs expected pace
// ========================================================================
async function generateFacultyPaceReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('🏃 [FACULTY PACE] Starting...')

  const { subjectsMap, topicsMap, topics } = await buildLookupMaps(institution_id)

  // Get faculty list
  let facultyQuery = supabase
    .from('users')
    .select('id, full_name')
    .eq('institution_id', institution_id)
    .eq('role', 'faculty')
    .order('full_name')

  if (filters.faculty_id) {
    facultyQuery = facultyQuery.eq('id', filters.faculty_id)
  }

  const { data: faculty } = await facultyQuery

  // Academic year: March to Feb (approx 11 months, ~220 working days)
  const now = new Date()
  const academicStart = new Date(now.getFullYear(), 2, 1) // March 1
  if (now.getMonth() < 2) academicStart.setFullYear(academicStart.getFullYear() - 1)
  const totalDays = 300 // Total working days in academic year
  const daysPassed = Math.floor((now.getTime() - academicStart.getTime()) / (1000 * 60 * 60 * 24))
  const expectedPct = Math.min(100, Math.round((daysPassed / totalDays) * 100))

  const paceData = await Promise.all(
    (faculty || []).map(async (f) => {
      // Get faculty's assignments
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('subject_id, division_id')
        .eq('faculty_id', f.id)

      const assignedSubjectIds = Array.from(new Set((assignments || []).map(a => a.subject_id)))

      // Count total topics assigned and completed
      const assignedTopics = topics.filter(t => assignedSubjectIds.includes(t.subject_id))
      const totalAssigned = assignedTopics.length

      if (totalAssigned === 0) {
        return {
          faculty: f.full_name,
          total_topics: 0, completed: 0, in_progress: 0, not_started: 0,
          completion_pct: 0, expected_pct: expectedPct, pace: 'N/A',
          subjects: []
        }
      }

      // Get entries
      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('topic_id, lectures_taken')
        .eq('faculty_id', f.id)

      const topicLectures = new Map<string, number>()
      entries?.forEach(e => {
        topicLectures.set(e.topic_id, (topicLectures.get(e.topic_id) || 0) + (e.lectures_taken || 0))
      })

      let completed = 0, inProgress = 0, notStarted = 0
      const subjectStats = new Map<string, { total: number; completed: number }>()

      assignedTopics.forEach(topic => {
        const subjName = subjectsMap.get(topic.subject_id)?.subject_name || 'Unknown'
        if (!subjectStats.has(subjName)) subjectStats.set(subjName, { total: 0, completed: 0 })
        subjectStats.get(subjName)!.total++

        const taken = topicLectures.get(topic.id) || 0
        if (taken >= (topic.default_lectures || 1)) {
          completed++
          subjectStats.get(subjName)!.completed++
        } else if (taken > 0) {
          inProgress++
        } else {
          notStarted++
        }
      })

      const completionPct = Math.round((completed / totalAssigned) * 100)
      let pace = 'On Track'
      if (completionPct < expectedPct - 15) pace = 'Behind'
      else if (completionPct > expectedPct + 10) pace = 'Ahead'

      const subjectBreakdown: any[] = []
      subjectStats.forEach((stats, name) => {
        subjectBreakdown.push({
          subject: name,
          total: stats.total,
          completed: stats.completed,
          pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        })
      })

      return {
        faculty: f.full_name,
        total_topics: totalAssigned,
        completed,
        in_progress: inProgress,
        not_started: notStarted,
        completion_pct: completionPct,
        expected_pct: expectedPct,
        pace,
        subjects: subjectBreakdown
      }
    })
  )

  return {
    expected_pct: expectedPct,
    days_passed: daysPassed,
    total_days: totalDays,
    faculty: paceData.filter(f => f.total_topics > 0)
  }
}

// ========================================================================
// 9. ⭐ NEW: MONTHLY PROGRESS TREND
//    Shows month-over-month syllabus progress for tracking momentum
// ========================================================================
async function generateMonthlyProgressReport(institution_id: string, academic_year_id: string, filters: any) {
  console.log('📈 [MONTHLY PROGRESS] Starting...')

  const { topicsMap, subjectsMap, divisionsMap, topics } = await buildLookupMaps(institution_id)

  const months = [
    { name: 'March', num: 3 }, { name: 'April', num: 4 },
    { name: 'June', num: 6 }, { name: 'July', num: 7 },
    { name: 'August', num: 8 }, { name: 'September', num: 9 },
    { name: 'October', num: 10 }, { name: 'November', num: 11 },
    { name: 'December', num: 12 }, { name: 'January', num: 1 },
    { name: 'February', num: 2 }
  ]

  // Get entries with filters
  let query = supabase
    .from('syllabus_entries')
    .select('lectures_taken, teaching_date, topic_id, subject_id, division_id')
    .eq('institution_id', institution_id)
    .gte('lectures_taken', 0.5)
    .order('teaching_date', { ascending: true })

  if (filters.faculty_id) query = query.eq('faculty_id', filters.faculty_id)
  if (filters.division_id) query = query.eq('division_id', filters.division_id)
  if (filters.subject_id) query = query.eq('subject_id', filters.subject_id)
  if (filters.standard_id && !filters.division_id) {
    const stdDivs = [...divisionsMap.values()].filter(d => d.standard_id === filters.standard_id)
    if (stdDivs.length > 0) query = query.in('division_id', stdDivs.map(d => d.id))
  }

  const { data: entries } = await query

  // Determine relevant topics
  let relevantTopics = topics
  if (filters.subject_id) relevantTopics = topics.filter(t => t.subject_id === filters.subject_id)
  if (filters.standard_id) relevantTopics = relevantTopics.filter(t => t.standard_id === filters.standard_id)
  const totalTopicCount = relevantTopics.length
  const totalLecturesExpected = relevantTopics.reduce((sum, t) => sum + (t.default_lectures || 0), 0)

  // Cumulative per month
  const monthlyData: any[] = []
  let cumulativeLectures = 0
  const completedTopicSet = new Map<string, number>()

  for (const month of months) {
    const monthEntries = entries?.filter(e => {
      if (!e.teaching_date) return false
      const d = new Date(e.teaching_date)
      return d.getMonth() + 1 === month.num
    }) || []

    const monthLectures = monthEntries.reduce((sum, e) => sum + (e.lectures_taken || 0), 0)
    cumulativeLectures += monthLectures

    // Track completed topics cumulatively
    monthEntries.forEach(e => {
      completedTopicSet.set(e.topic_id, (completedTopicSet.get(e.topic_id) || 0) + (e.lectures_taken || 0))
    })

    let cumulativeCompleted = 0
    completedTopicSet.forEach((taken, topicId) => {
      const topic = topicsMap.get(topicId)
      if (topic && taken >= (topic.default_lectures || 1)) cumulativeCompleted++
    })

    monthlyData.push({
      month: month.name,
      lectures_this_month: Math.round(monthLectures * 10) / 10,
      entries_count: monthEntries.length,
      cumulative_lectures: Math.round(cumulativeLectures * 10) / 10,
      cumulative_topics_completed: cumulativeCompleted,
      completion_pct: totalTopicCount > 0 ? Math.round((cumulativeCompleted / totalTopicCount) * 100) : 0,
      lectures_pct: totalLecturesExpected > 0 ? Math.round((cumulativeLectures / totalLecturesExpected) * 100) : 0
    })
  }

  return {
    total_topics: totalTopicCount,
    total_lectures_expected: totalLecturesExpected,
    months: monthlyData
  }
}
