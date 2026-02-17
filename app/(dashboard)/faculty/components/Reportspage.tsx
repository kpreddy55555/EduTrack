// 📈 REPORTS PAGE - Generate Progress Reports
// Export to PDF and Excel with multiple report types

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [facultyId, setFacultyId] = useState('')
  const [facultyName, setFacultyName] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [reportConfig, setReportConfig] = useState({
    type: 'overall' as 'overall' | 'division' | 'subject' | 'timeline' | 'milestone',
    format: 'pdf' as 'pdf' | 'excel',
    divisionId: '',
    subjectId: '',
    dateFrom: '',
    dateTo: '',
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setFacultyId(session.user.id)

      const { data: userData } = await supabase
        .from('users')
        .select('full_name, institution_id, institutions(institution_name)')
        .eq('id', session.user.id)
        .single()

      if (!userData) return

      setFacultyName(userData.full_name)
      setInstitutionName((userData as any).institutions?.institution_name || '')

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)

      if (!yearData) {
        setLoading(false)
        return
      }

      // Get divisions
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select(`
          division_id,
          subject_id,
          divisions(id, division_name, standard_id),
          subjects(id, subject_name, subject_code)
        `)
        .eq('faculty_id', session.user.id)
        .eq('academic_year_id', yearData.id)

      const uniqueDivisions = Array.from(
        new Map(assignments?.map(a => [a.division_id, a.divisions])).values()
      )
      const uniqueSubjects = Array.from(
        new Map(assignments?.map(a => [a.subject_id, a.subjects])).values()
      )

      setDivisions(uniqueDivisions)
      setSubjects(uniqueSubjects)

      // Set default date range
      const today = new Date().toISOString().split('T')[0]
      const startOfYear = yearData.start_date
      setReportConfig(prev => ({
        ...prev,
        dateFrom: startOfYear,
        dateTo: today,
      }))

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (reportConfig.type === 'division' && !reportConfig.divisionId) {
      setMessage({ type: 'error', text: 'Please select a division' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if (reportConfig.type === 'subject' && !reportConfig.subjectId) {
      setMessage({ type: 'error', text: 'Please select a subject' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setGenerating(true)
    setMessage({ type: 'success', text: '⏳ Generating report... This may take a few moments.' })

    try {
      // Fetch report data based on type
      let reportData: any = {}

      if (reportConfig.type === 'overall') {
        reportData = await generateOverallReport()
      } else if (reportConfig.type === 'division') {
        reportData = await generateDivisionReport()
      } else if (reportConfig.type === 'subject') {
        reportData = await generateSubjectReport()
      } else if (reportConfig.type === 'timeline') {
        reportData = await generateTimelineReport()
      } else if (reportConfig.type === 'milestone') {
        reportData = await generateMilestoneReport()
      }

      // Generate file based on format
      if (reportConfig.format === 'pdf') {
        await generatePDF(reportData)
      } else {
        await generateExcel(reportData)
      }

      setMessage({ type: 'success', text: '✓ Report generated successfully!' })
      setTimeout(() => setMessage(null), 3000)

    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to generate report. Please try again.' })
    } finally {
      setGenerating(false)
    }
  }

  const generateOverallReport = async () => {
    const { data: assignments } = await supabase
      .from('faculty_assignments')
      .select(`
        *,
        divisions(division_name, standard_id),
        subjects(subject_name, subject_code)
      `)
      .eq('faculty_id', facultyId)
      .eq('academic_year_id', academicYear.id)

    let totalTopics = 0
    let completedTopics = 0
    const divisionData: any[] = []

    for (const assignment of assignments || []) {
      const { data: topics } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', assignment.subject_id)
        .eq('standard_id', assignment.divisions.standard_id)

      const topicCount = topics?.length || 0
      totalTopics += topicCount

      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('topic_id, lectures_taken, teaching_date')
        .eq('faculty_id', facultyId)
        .eq('division_id', assignment.division_id)
        .eq('subject_id', assignment.subject_id)
        .gte('teaching_date', reportConfig.dateFrom)
        .lte('teaching_date', reportConfig.dateTo)

      const completedTopicsForThis = new Set(
        entries?.filter(e => e.lectures_taken > 0).map(e => e.topic_id) || []
      )
      completedTopics += completedTopicsForThis.size

      const totalLectures = entries?.reduce((sum, e) => sum + e.lectures_taken, 0) || 0

      divisionData.push({
        division: assignment.divisions.division_name,
        subject: assignment.subjects.subject_name,
        totalTopics: topicCount,
        completedTopics: completedTopicsForThis.size,
        totalLectures,
        completionPercentage: topicCount > 0 ? Math.round((completedTopicsForThis.size / topicCount) * 100) : 0,
      })
    }

    return {
      type: 'Overall Progress Report',
      faculty: facultyName,
      institution: institutionName,
      academicYear: academicYear.year_name,
      dateRange: `${new Date(reportConfig.dateFrom).toLocaleDateString('en-IN')} - ${new Date(reportConfig.dateTo).toLocaleDateString('en-IN')}`,
      summary: {
        totalTopics,
        completedTopics,
        completionPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
      },
      details: divisionData,
    }
  }

  const generateDivisionReport = async () => {
    const division = divisions.find(d => d.id === reportConfig.divisionId)
    if (!division) throw new Error('Division not found')

    const { data: assignments } = await supabase
      .from('faculty_assignments')
      .select(`
        *,
        subjects(subject_name, subject_code)
      `)
      .eq('faculty_id', facultyId)
      .eq('division_id', reportConfig.divisionId)
      .eq('academic_year_id', academicYear.id)

    const subjectData: any[] = []

    for (const assignment of assignments || []) {
      const { data: topics } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', assignment.subject_id)
        .eq('standard_id', division.standard_id)
        .order('topic_number')

      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('*')
        .eq('faculty_id', facultyId)
        .eq('division_id', reportConfig.divisionId)
        .eq('subject_id', assignment.subject_id)
        .gte('teaching_date', reportConfig.dateFrom)
        .lte('teaching_date', reportConfig.dateTo)

      const topicsWithStatus = topics?.map(topic => {
        const topicEntries = entries?.filter(e => e.topic_id === topic.id) || []
        const totalLectures = topicEntries.reduce((sum, e) => sum + e.lectures_taken, 0)
        return {
          topicNumber: topic.topic_number,
          topicName: topic.topic_name,
          suggestedLectures: topic.default_lectures || 0,
          completedLectures: totalLectures,
          isCompleted: totalLectures > 0,
          lastDate: topicEntries[0]?.teaching_date,
        }
      }) || []

      const completedCount = topicsWithStatus.filter(t => t.isCompleted).length

      subjectData.push({
        subject: assignment.subjects.subject_name,
        subjectCode: assignment.subjects.subject_code,
        totalTopics: topics?.length || 0,
        completedTopics: completedCount,
        completionPercentage: topics?.length ? Math.round((completedCount / topics.length) * 100) : 0,
        topics: topicsWithStatus,
      })
    }

    return {
      type: 'Division Progress Report',
      division: division.division_name,
      faculty: facultyName,
      institution: institutionName,
      academicYear: academicYear.year_name,
      dateRange: `${new Date(reportConfig.dateFrom).toLocaleDateString('en-IN')} - ${new Date(reportConfig.dateTo).toLocaleDateString('en-IN')}`,
      subjects: subjectData,
    }
  }

  const generateSubjectReport = async () => {
    const subject = subjects.find(s => s.id === reportConfig.subjectId)
    if (!subject) throw new Error('Subject not found')

    const { data: assignments } = await supabase
      .from('faculty_assignments')
      .select(`
        *,
        divisions(division_name, standard_id)
      `)
      .eq('faculty_id', facultyId)
      .eq('subject_id', reportConfig.subjectId)
      .eq('academic_year_id', academicYear.id)

    const divisionData: any[] = []

    for (const assignment of assignments || []) {
      const { data: topics } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', reportConfig.subjectId)
        .eq('standard_id', assignment.divisions.standard_id)
        .order('topic_number')

      const { data: entries } = await supabase
        .from('syllabus_entries')
        .select('*')
        .eq('faculty_id', facultyId)
        .eq('division_id', assignment.division_id)
        .eq('subject_id', reportConfig.subjectId)
        .gte('teaching_date', reportConfig.dateFrom)
        .lte('teaching_date', reportConfig.dateTo)

      const topicsWithStatus = topics?.map(topic => {
        const topicEntries = entries?.filter(e => e.topic_id === topic.id) || []
        const totalLectures = topicEntries.reduce((sum, e) => sum + e.lectures_taken, 0)
        return {
          topicNumber: topic.topic_number,
          topicName: topic.topic_name,
          suggestedLectures: topic.default_lectures || 0,
          completedLectures: totalLectures,
          isCompleted: totalLectures > 0,
        }
      }) || []

      const completedCount = topicsWithStatus.filter(t => t.isCompleted).length

      divisionData.push({
        division: assignment.divisions.division_name,
        totalTopics: topics?.length || 0,
        completedTopics: completedCount,
        completionPercentage: topics?.length ? Math.round((completedCount / topics.length) * 100) : 0,
        topics: topicsWithStatus,
      })
    }

    return {
      type: 'Subject Progress Report',
      subject: subject.subject_name,
      subjectCode: subject.subject_code,
      faculty: facultyName,
      institution: institutionName,
      academicYear: academicYear.year_name,
      dateRange: `${new Date(reportConfig.dateFrom).toLocaleDateString('en-IN')} - ${new Date(reportConfig.dateTo).toLocaleDateString('en-IN')}`,
      divisions: divisionData,
    }
  }

  const generateTimelineReport = async () => {
    const { data: entries } = await supabase
      .from('syllabus_entries')
      .select(`
        *,
        topics(topic_name, topic_number),
        divisions(division_name),
        subjects(subject_name, subject_code)
      `)
      .eq('faculty_id', facultyId)
      .gte('teaching_date', reportConfig.dateFrom)
      .lte('teaching_date', reportConfig.dateTo)
      .order('teaching_date', { ascending: false })

    const timelineData = entries?.map(entry => ({
      date: entry.teaching_date,
      division: entry.divisions?.division_name,
      subject: entry.subjects?.subject_name,
      subjectCode: entry.subjects?.subject_code,
      topic: entry.topics?.topic_name,
      topicNumber: entry.topics?.topic_number,
      lectures: entry.lectures_taken,
      remarks: entry.remarks,
    })) || []

    return {
      type: 'Timeline Activity Report',
      faculty: facultyName,
      institution: institutionName,
      academicYear: academicYear.year_name,
      dateRange: `${new Date(reportConfig.dateFrom).toLocaleDateString('en-IN')} - ${new Date(reportConfig.dateTo).toLocaleDateString('en-IN')}`,
      totalEntries: timelineData.length,
      entries: timelineData,
    }
  }

  const generateMilestoneReport = async () => {
    const { data: milestones } = await supabase
      .from('exam_milestones')
      .select('*')
      .eq('academic_year_id', academicYear.id)
      .eq('is_active', true)
      .order('milestone_date')

    const milestoneData: any[] = []

    for (const milestone of milestones || []) {
      const { data: assignments } = await supabase
        .from('faculty_assignments')
        .select('division_id, subject_id')
        .eq('faculty_id', facultyId)
        .eq('academic_year_id', academicYear.id)

      let totalTopics = 0
      let completedTopics = 0

      for (const assignment of assignments || []) {
        const { data: milestoneTopics } = await supabase
          .from('milestone_topics')
          .select('topic_id')
          .eq('milestone_id', milestone.id)
          .eq('division_id', assignment.division_id)
          .eq('subject_id', assignment.subject_id)

        totalTopics += milestoneTopics?.length || 0

        for (const mt of milestoneTopics || []) {
          const { data: entry } = await supabase
            .from('syllabus_entries')
            .select('id')
            .eq('faculty_id', facultyId)
            .eq('topic_id', mt.topic_id)
            .eq('division_id', assignment.division_id)
            .gte('lectures_taken', 1)
            .single()

          if (entry) completedTopics++
        }
      }

      milestoneData.push({
        milestoneName: milestone.milestone_name,
        date: milestone.milestone_date,
        type: milestone.milestone_type,
        totalTopics,
        completedTopics,
        completionPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
        isPast: new Date(milestone.milestone_date) < new Date(),
      })
    }

    return {
      type: 'Milestone Readiness Report',
      faculty: facultyName,
      institution: institutionName,
      academicYear: academicYear.year_name,
      generatedDate: new Date().toLocaleDateString('en-IN'),
      milestones: milestoneData,
    }
  }

  const generatePDF = async (data: any) => {
    // Create a simple HTML report and convert to PDF using browser print
    const reportHTML = createReportHTML(data)
    
    // Open in new window and trigger print
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(reportHTML)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const generateExcel = async (data: any) => {
    // Convert data to CSV format
    let csv = ''
    
    if (data.type === 'Overall Progress Report') {
      csv = `${data.type}\n`
      csv += `Faculty: ${data.faculty}\n`
      csv += `Institution: ${data.institution}\n`
      csv += `Academic Year: ${data.academicYear}\n`
      csv += `Period: ${data.dateRange}\n\n`
      csv += `Overall Completion: ${data.summary.completionPercentage}%\n`
      csv += `Topics Completed: ${data.summary.completedTopics} / ${data.summary.totalTopics}\n\n`
      csv += `Division,Subject,Total Topics,Completed Topics,Total Lectures,Completion %\n`
      data.details.forEach((d: any) => {
        csv += `${d.division},${d.subject},${d.totalTopics},${d.completedTopics},${d.totalLectures},${d.completionPercentage}%\n`
      })
    } else if (data.type === 'Timeline Activity Report') {
      csv = `${data.type}\n`
      csv += `Faculty: ${data.faculty}\n`
      csv += `Period: ${data.dateRange}\n\n`
      csv += `Date,Division,Subject,Topic,Lectures,Remarks\n`
      data.entries.forEach((e: any) => {
        csv += `${new Date(e.date).toLocaleDateString('en-IN')},${e.division},${e.subject} (${e.subjectCode}),"${e.topic}",${e.lectures},"${e.remarks || ''}"\n`
      })
    }
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${data.type.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const createReportHTML = (data: any) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.type}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #1e293b; border-bottom: 3px solid #f59e0b; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    .header { margin-bottom: 30px; }
    .header p { margin: 5px 0; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f59e0b; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:hover { background: #f8fafc; }
    .summary { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${data.type}</h1>
  <div class="header">
    <p><strong>Faculty:</strong> ${data.faculty}</p>
    <p><strong>Institution:</strong> ${data.institution}</p>
    <p><strong>Academic Year:</strong> ${data.academicYear}</p>
    <p><strong>Period:</strong> ${data.dateRange || data.generatedDate}</p>
  </div>
  
  ${data.summary ? `
    <div class="summary">
      <h3>Summary</h3>
      <p><strong>Overall Completion:</strong> ${data.summary.completionPercentage}%</p>
      <p><strong>Topics Completed:</strong> ${data.summary.completedTopics} / ${data.summary.totalTopics}</p>
    </div>
  ` : ''}
  
  ${data.details ? `
    <h2>Division-wise Progress</h2>
    <table>
      <thead>
        <tr>
          <th>Division</th>
          <th>Subject</th>
          <th>Total Topics</th>
          <th>Completed</th>
          <th>Lectures</th>
          <th>Completion</th>
        </tr>
      </thead>
      <tbody>
        ${data.details.map((d: any) => `
          <tr>
            <td>${d.division}</td>
            <td>${d.subject}</td>
            <td>${d.totalTopics}</td>
            <td>${d.completedTopics}</td>
            <td>${d.totalLectures}</td>
            <td>${d.completionPercentage}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  ${data.entries ? `
    <h2>Activity Timeline (${data.totalEntries} entries)</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Division</th>
          <th>Subject</th>
          <th>Topic</th>
          <th>Lectures</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${data.entries.map((e: any) => `
          <tr>
            <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
            <td>${e.division}</td>
            <td>${e.subject}</td>
            <td>${e.topic}</td>
            <td>${e.lectures}</td>
            <td>${e.remarks || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  ${data.milestones ? `
    <h2>Milestone Readiness</h2>
    <table>
      <thead>
        <tr>
          <th>Milestone</th>
          <th>Date</th>
          <th>Type</th>
          <th>Total Topics</th>
          <th>Completed</th>
          <th>Readiness</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.milestones.map((m: any) => `
          <tr>
            <td>${m.milestoneName}</td>
            <td>${new Date(m.date).toLocaleDateString('en-IN')}</td>
            <td>${m.type}</td>
            <td>${m.totalTopics}</td>
            <td>${m.completedTopics}</td>
            <td>${m.completionPercentage}%</td>
            <td>${m.isPast ? 'Past' : 'Upcoming'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
    <p>EduTrack - Syllabus Management System</p>
  </div>
</body>
</html>
    `
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Generate Reports</h1>
        <p className="text-slate-400">Export your teaching progress to PDF or Excel</p>
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

      {/* Report Configuration */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-bold text-white">Report Configuration</h2>

        {/* Report Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Report Type *</label>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => setReportConfig({ ...reportConfig, type: 'overall' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.type === 'overall'
                  ? 'bg-amber-500/20 border-amber-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold mb-1">Overall Progress</div>
              <div className="text-xs text-slate-400">All divisions & subjects</div>
            </button>

            <button
              onClick={() => setReportConfig({ ...reportConfig, type: 'division' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.type === 'division'
                  ? 'bg-amber-500/20 border-amber-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-2xl mb-2">🏫</div>
              <div className="font-semibold mb-1">By Division</div>
              <div className="text-xs text-slate-400">Single division, all subjects</div>
            </button>

            <button
              onClick={() => setReportConfig({ ...reportConfig, type: 'subject' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.type === 'subject'
                  ? 'bg-amber-500/20 border-amber-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-2xl mb-2">📖</div>
              <div className="font-semibold mb-1">By Subject</div>
              <div className="text-xs text-slate-400">Single subject, all divisions</div>
            </button>

            <button
              onClick={() => setReportConfig({ ...reportConfig, type: 'timeline' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.type === 'timeline'
                  ? 'bg-amber-500/20 border-amber-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-2xl mb-2">📅</div>
              <div className="font-semibold mb-1">Timeline</div>
              <div className="text-xs text-slate-400">Activity log by date</div>
            </button>

            <button
              onClick={() => setReportConfig({ ...reportConfig, type: 'milestone' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.type === 'milestone'
                  ? 'bg-amber-500/20 border-amber-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-semibold mb-1">Milestones</div>
              <div className="text-xs text-slate-400">Exam readiness status</div>
            </button>
          </div>
        </div>

        {/* Conditional Fields */}
        {reportConfig.type === 'division' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Division *</label>
            <select
              value={reportConfig.divisionId}
              onChange={(e) => setReportConfig({ ...reportConfig, divisionId: e.target.value })}
              className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">Choose division...</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.division_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {reportConfig.type === 'subject' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Subject *</label>
            <select
              value={reportConfig.subjectId}
              onChange={(e) => setReportConfig({ ...reportConfig, subjectId: e.target.value })}
              className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">Choose subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} ({s.subject_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range (except milestone) */}
        {reportConfig.type !== 'milestone' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">From Date</label>
              <input
                type="date"
                value={reportConfig.dateFrom}
                onChange={(e) => setReportConfig({ ...reportConfig, dateFrom: e.target.value })}
                className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">To Date</label>
              <input
                type="date"
                value={reportConfig.dateTo}
                onChange={(e) => setReportConfig({ ...reportConfig, dateTo: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-700 border border-white/10 rounded-lg py-3 px-4 text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>
        )}

        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Export Format *</label>
          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={() => setReportConfig({ ...reportConfig, format: 'pdf' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.format === 'pdf'
                  ? 'bg-red-500/20 border-red-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📄</div>
                <div>
                  <div className="font-semibold mb-1">PDF Document</div>
                  <div className="text-xs text-slate-400">Formatted, printable report</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setReportConfig({ ...reportConfig, format: 'excel' })}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportConfig.format === 'excel'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                  : 'bg-slate-700/50 border-white/10 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📊</div>
                <div>
                  <div className="font-semibold mb-1">Excel / CSV</div>
                  <div className="text-xs text-slate-400">Spreadsheet data file</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateReport}
          disabled={generating}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-900 font-bold rounded-xl text-lg transition-all"
        >
          {generating ? '⏳ Generating Report...' : '📥 Generate & Download Report'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-1">About Reports</div>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• PDF reports open in a new window - use browser print to save</li>
              <li>• CSV files can be opened in Excel, Google Sheets, or Numbers</li>
              <li>• All reports include your name, institution, and date range</li>
              <li>• Reports reflect data within the selected date range</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}