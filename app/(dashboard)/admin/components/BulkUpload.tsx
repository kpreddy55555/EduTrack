'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BulkUpload() {
    const [uploadType, setUploadType] = useState<'topics' | 'assignments' | 'milestones' | 'milestone-topics' | 'students'>('topics')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [academicYear, setAcademicYear] = useState<any>(null)
  const [institutionId, setInstitutionId] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchAcademicYear()
  }, [])

  const fetchAcademicYear = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', session.user.id)
        .single()

      if (!userData) return
      setInstitutionId(userData.institution_id)

      const { data: yearData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .eq('is_current', true)
        .single()

      setAcademicYear(yearData)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setPreview([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length === 0) {
          setMessage({ type: 'error', text: 'File is empty' })
          return
        }

        const headers = lines[0].split(',').map(h => h.trim())
        const rows = lines.slice(1, 11).map(line => {
          const values = line.split(',')
          const row: any = {}
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim() || ''
          })
          return row
        })

        console.log('📋 Preview data:', { headers, rowCount: rows.length, rows })
        setPreview(rows)
      } catch (error) {
        console.error('Preview error:', error)
        setMessage({ type: 'error', text: 'Failed to preview file' })
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleUploadTopics = async () => {
    if (!file) return

    setUploading(true)
    setMessage(null)

    try {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, subject_code')
        .eq('institution_id', institutionId)

      const { data: standards } = await supabase
        .from('standards')
        .select('id, standard_code, standard_name')

      const { data: streams } = await supabase
        .from('streams')
        .select('id, stream_name, stream_code')

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim())
          
          let successCount = 0
          let errorCount = 0
          const errors: string[] = []

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim())
            if (values.length < 3) continue

            const row: any = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })

            const subjectCode = row['Subject Code'] || row['SubjectCode']
            const standardName = row['Standard']
            const streamName = row['Stream']
            const topicNumber = row['Topic ID'] || row['TopicID'] || row['TopicNumber']
            const topicName = row['TopicName'] || row['Topic Name']
            const lectures = parseInt(row['DefaultLectures'] || row['Lectures'] || '1')

            const subject = subjects?.find(s => s.subject_code === subjectCode)
            if (!subject) {
              errors.push(`Row ${i + 1}: Subject code "${subjectCode}" not found`)
              errorCount++
              continue
            }

            const standard = standards?.find(s => 
              s.standard_name?.includes(standardName) || 
              s.standard_code === standardName
            )

            const stream = streams?.find(s => 
              s.stream_name === streamName || 
              s.stream_code === streamName
            )

            const topicData = {
              subject_id: subject.id,
              standard_id: standard?.id || null,
              stream_id: stream?.id || null,
              topic_number: topicNumber,
              topic_name: topicName,
              default_lectures: lectures,
              source: 'BULK_UPLOAD',
            }

            const { error } = await supabase.from('topics').insert([topicData])
            
            if (error) {
              errors.push(`Row ${i + 1}: ${error.message}`)
              errorCount++
            } else {
              successCount++
            }
          }

          setMessage({ 
            type: successCount > 0 ? 'success' : 'error', 
            text: `✓ Uploaded ${successCount} topics. ${errorCount > 0 ? `${errorCount} failed.` : ''}` 
          })
        } catch (error) {
          setMessage({ type: 'error', text: 'Failed to upload' })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsText(file)

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload' })
      setUploading(false)
    }
  }

  const handleUploadMilestoneTopics = async () => {
    if (!file || !academicYear) {
      setMessage({ type: 'error', text: 'No active academic year found' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Get reference data
      const { data: milestones } = await supabase
        .from('exam_milestones')
        .select('id, milestone_name')
        .eq('academic_year_id', academicYear.id)

      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, subject_code, subject_name')
        .eq('institution_id', institutionId)

      const { data: divisions } = await supabase
        .from('divisions')
        .select('id, division_name')
        .eq('institution_id', institutionId)

      const { data: allTopics } = await supabase
        .from('topics')
        .select('id, topic_number, subject_id')

      console.log('📚 Reference data:', { 
        milestones: milestones?.length, 
        subjects: subjects?.length,
        divisions: divisions?.length,
        topics: allTopics?.length 
      })

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim())
          
          let successCount = 0
          let errorCount = 0
          const errors: string[] = []

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim())
            if (values.length < 3) continue

            const row: any = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })

            // Parse row data
            const milestoneName = row['Milestone'] || row['MilestoneName']
            const divisionName = row['Division'] || row['DivisionName']
            const subjectCode = row['Subject Code'] || row['SubjectCode']
            const topicNumbers = (row['Topic IDs'] || row['TopicIDs'] || row['Topics'] || '').split(';').map((t: string) => t.trim()).filter((t: string) => t)

            // Find milestone
            const milestone = milestones?.find(m => m.milestone_name === milestoneName)
            if (!milestone) {
              errors.push(`Row ${i + 1}: Milestone "${milestoneName}" not found`)
              errorCount++
              continue
            }

            // Find division
            const division = divisions?.find(d => d.division_name === divisionName)
            if (!division) {
              errors.push(`Row ${i + 1}: Division "${divisionName}" not found`)
              errorCount++
              continue
            }

            // Find subject
            const subject = subjects?.find(s => s.subject_code === subjectCode)
            if (!subject) {
              errors.push(`Row ${i + 1}: Subject "${subjectCode}" not found`)
              errorCount++
              continue
            }

            // Find topics by topic numbers
            const topicsToAdd = allTopics?.filter(t => 
              t.subject_id === subject.id && 
              topicNumbers.includes(t.topic_number)
            ) || []

            if (topicsToAdd.length === 0) {
              errors.push(`Row ${i + 1}: No matching topics found`)
              errorCount++
              continue
            }

            // Delete existing entries for this combination
            await supabase
              .from('milestone_topics')
              .delete()
              .eq('milestone_id', milestone.id)
              .eq('subject_id', subject.id)
              .eq('division_id', division.id)

            // Insert new milestone topics
            const inserts = topicsToAdd.map(topic => ({
              milestone_id: milestone.id,
              topic_id: topic.id,
              subject_id: subject.id,
              division_id: division.id,
            }))

            const { error } = await supabase
              .from('milestone_topics')
              .insert(inserts)
            
            if (error) {
              console.error(`Row ${i + 1} error:`, error)
              errors.push(`Row ${i + 1}: ${error.message}`)
              errorCount++
            } else {
              successCount += topicsToAdd.length
            }
          }

          if (errors.length > 0) {
            console.log('❌ Errors:', errors.slice(0, 5)) // Show first 5 errors
          }

          setMessage({ 
            type: successCount > 0 ? 'success' : 'error', 
            text: `✓ Uploaded ${successCount} milestone topics. ${errorCount > 0 ? `${errorCount} rows failed.` : ''}` 
          })
        } catch (error) {
          console.error('Upload error:', error)
          setMessage({ type: 'error', text: 'Failed to upload' })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsText(file)

    } catch (error) {
      console.error('Error:', error)
      setMessage({ type: 'error', text: 'Failed to upload' })
      setUploading(false)
    }
  }

  const handleUploadAssignments = async () => {
    if (!file || !academicYear) {
      setMessage({ type: 'error', text: 'No active academic year found' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('institution_id', institutionId)

      const { data: divisions } = await supabase
        .from('divisions')
        .select('id, division_name')
        .eq('institution_id', institutionId)

      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, subject_code')
        .eq('institution_id', institutionId)

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim())
          
          let successCount = 0
          let errorCount = 0

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim())
            const row: any = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })

            const facultyEmail = row['FacultyEmail'] || row['Faculty Email']
            const divisionName = row['Division'] || row['DivisionName']
            const subjectCode = row['SubjectCode'] || row['Subject Code']
            const isPrimary = (row['IsPrimary'] || row['Primary'] || 'true').toLowerCase() === 'true'
            const lecturesPerWeek = parseInt(row['LecturesPerWeek'] || row['NoOfLecturesPerWeek'] || '0')

            const user = users?.find(u => u.email === facultyEmail)
            const division = divisions?.find(d => d.division_name === divisionName)
            const subject = subjects?.find(s => s.subject_code === subjectCode)

            if (!user || !division || !subject) {
              errorCount++
              continue
            }

            const assignmentData = {
              faculty_id: user.id,
              division_id: division.id,
              subject_id: subject.id,
              academic_year_id: academicYear.id,
              is_primary: isPrimary,
              lectures_per_week: lecturesPerWeek,
              assigned_date: new Date().toISOString().split('T')[0],
            }

            const { error } = await supabase
              .from('faculty_assignments')
              .insert([assignmentData])
            
            if (error) {
              errorCount++
            } else {
              successCount++
            }
          }

          setMessage({ 
            type: 'success', 
            text: `✓ Uploaded ${successCount} assignments. ${errorCount > 0 ? `${errorCount} failed.` : ''}` 
          })
        } catch (error) {
          setMessage({ type: 'error', text: 'Failed to upload' })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsText(file)

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload' })
      setUploading(false)
    }
  }

  const handleUploadMilestones = async () => {
    if (!file || !academicYear) {
      setMessage({ type: 'error', text: 'No active academic year found' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim())
          
          let successCount = 0
          let errorCount = 0

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim())
            const row: any = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })

            const milestoneName = row['Milestone Name'] || row['MilestoneName']
            const date = row['Date']
            const type = (row['Type'] || 'exam').toLowerCase()
            const description = row['Description'] || ''

            const milestoneData = {
              institution_id: institutionId,
              academic_year_id: academicYear.id,
              milestone_name: milestoneName,
              milestone_date: date,
              target_completion_percentage: 0,
              milestone_type: type,
              description: description,
              is_active: true,
            }

            const { error } = await supabase
              .from('exam_milestones')
              .insert([milestoneData])
            
            if (error) {
              errorCount++
            } else {
              successCount++
            }
          }

          setMessage({ 
            type: 'success', 
            text: `✓ Uploaded ${successCount} milestones. ${errorCount > 0 ? `${errorCount} failed.` : ''}` 
          })
        } catch (error) {
          setMessage({ type: 'error', text: 'Failed to upload' })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsText(file)

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload' })
      setUploading(false)
    }
  }

  // Parse various date formats to YYYY-MM-DD
  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === '') return null
    const s = dateStr.trim()

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (dmy) {
      const [, d, m, y] = dmy
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // DD/MM/YY or DD-MM-YY (2-digit year)
    const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
    if (dmy2) {
      const [, d, m, yy] = dmy2
      const y = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // DD-Mon-YY (e.g., 23-Dec-08)
    const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' }
    const dmy3 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})$/)
    if (dmy3) {
      const [, d, mon, yr] = dmy3
      const m = months[mon.toLowerCase()] || '01'
      const y = yr.length === 2 ? (parseInt(yr) > 50 ? `19${yr}` : `20${yr}`) : yr
      return `${y}-${m}-${d.padStart(2, '0')}`
    }

    // Try native Date parsing as last resort
    try {
      const dt = new Date(s)
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().split('T')[0]
      }
    } catch {}

    return null
  }

  const handleUploadStudents = async () => {
    if (!file || !preview.length) return
    setUploading(true); setMessage(null)
    try {
      let success = 0, errors = 0, errorMessages: string[] = []

      // Step 1: Detect which name column exists in the students table
      let nameColumn = 'full_name' // default
      const { data: testRow, error: testErr } = await supabase.from('students').select('*').limit(0)
      if (testErr) {
        console.error('Table access error:', testErr.message)
      }
      // Try inserting with full_name first, if fails try 'name'
      const testInsert = await supabase.from('students').select('full_name').limit(0)
      if (testInsert.error?.message?.includes('full_name')) {
        // full_name doesn't exist, try 'name'
        const testName = await supabase.from('students').select('name').limit(0)
        if (!testName.error) {
          nameColumn = 'name'
          console.log('📋 Using "name" column instead of "full_name"')
        } else {
          // Try student_name
          const testSN = await supabase.from('students').select('student_name').limit(0)
          if (!testSN.error) {
            nameColumn = 'student_name'
            console.log('📋 Using "student_name" column')
          }
        }
      }
      console.log('📋 Name column detected:', nameColumn)

      // Step 2: Get divisions for name-to-id mapping
      const { data: divData } = await supabase.from('divisions').select('id, division_name').eq('institution_id', institutionId)
      const divMap = new Map((divData || []).map((d: any) => [d.division_name.toLowerCase().trim(), d.id]))
      console.log('📋 Division map:', Object.fromEntries(divMap))

      // Step 3: Detect all available columns
      const { data: colTest } = await supabase.from('students').select('*').limit(0)
      // We'll build insert objects with only columns that exist

      for (const row of preview) {
        try {
          const fullName = (row['Full Name'] || row['full_name'] || row['Name'] || row['name'] || '').trim()
          if (!fullName) { errors++; continue }

          const divName = (row['Division'] || row['division_name'] || '').toLowerCase().trim()
          const divId = divMap.get(divName) || null
          const rawDob = row['Date of Birth'] || row['date_of_birth'] || ''
          const dob = parseDate(rawDob)
          const grNum = String(row['GR Number'] || row['gr_number'] || '').toUpperCase().trim()

          // Build insert data with detected name column
          const insertData: any = {
            [nameColumn]: fullName,
            is_active: true,
            student_code: grNum || `STU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          }

          // Add optional fields
          if (institutionId) insertData.institution_id = institutionId
          if (divId) insertData.division_id = divId
          if (grNum) insertData.gr_number = grNum
          if (dob) insertData.date_of_birth = dob

          const rollNum = String(row['Roll Number'] || row['roll_number'] || '').trim()
          if (rollNum) insertData.roll_number = rollNum

          const parentName = (row['Parent Name'] || row['parent_name'] || '').trim()
          if (parentName) insertData.parent_name = parentName

          const parentPhone = String(row['Parent Phone'] || row['parent_phone'] || '').trim()
          if (parentPhone) insertData.parent_phone = parentPhone

          const email = (row['Email'] || row['email'] || '').trim()
          if (email) insertData.email = email

          const phone = (row['Phone'] || row['phone'] || '').trim()
          if (phone) insertData.phone = phone

          const { error } = await supabase.from('students').insert(insertData)
          if (error) {
            console.error(`❌ Failed "${fullName}":`, error.message)
            // If first error is about a column not existing, try without that column
            if (error.message.includes('column') && error.message.includes('schema cache') && errorMessages.length === 0) {
              // Extract the problematic column name and retry without it
              const match = error.message.match(/the '(\w+)' column/)
              if (match) {
                const badCol = match[1]
                console.warn(`🔄 Removing "${badCol}" column and retrying...`)
                delete insertData[badCol]
                const retry = await supabase.from('students').insert(insertData)
                if (!retry.error) { success++; continue }
                console.error(`❌ Retry also failed:`, retry.error.message)
              }
            }
            errorMessages.push(`${fullName}: ${error.message}`)
            errors++
          } else {
            success++
          }
        } catch (e: any) {
          errors++
          console.error('Row error:', e)
        }
      }

      const msg = `Imported ${success} of ${preview.length} students.`
      const errDetail = errors > 0 ? ` ${errors} failed.` : ''
      const errHint = errorMessages.length > 0 
        ? errorMessages[0].includes('schema cache') 
          ? ' Run FIX_STUDENTS_TABLE.sql in Supabase, then reload schema cache (Settings → API → Reload).'
          : ` First error: ${errorMessages[0]}`
        : ''
      setMessage({ type: success > 0 ? 'success' : 'error', text: msg + errDetail + errHint })
      if (success > 0) { setFile(null); setPreview([]) }
    } catch (error: any) {
      console.error('Upload error:', error)
      setMessage({ type: 'error', text: 'Failed to upload: ' + (error.message || 'Unknown error') })
    } finally { setUploading(false) }
  }

  const handleUpload = () => {
    if (uploadType === 'topics') handleUploadTopics()
    else if (uploadType === 'assignments') handleUploadAssignments()
    else if (uploadType === 'milestones') handleUploadMilestones()
    else if (uploadType === 'milestone-topics') handleUploadMilestoneTopics()
    else if (uploadType === 'students') handleUploadStudents()
  }

  const downloadTemplate = (type: 'topics' | 'assignments' | 'milestones' | 'milestone-topics' | 'students') => {
    let csv = ''
    
    if (type === 'topics') {
      csv = 'Standard,Stream,Subject Code,Topic ID,TopicName,DefaultLectures\n'
      csv += 'XI,Science,HIN,HIN-11-01,प्रेरणा,5\n'
      csv += 'XI,Science,MATH,MATH-11-01,Relations and Functions,6\n'
      csv += 'XII,Science,PHY,PHY-12-01,Electric Charges and Fields,8\n'
    } else if (type === 'assignments') {
      csv = 'FacultyEmail,Division,SubjectCode,Primary,NoOfLecturesPerWeek\n'
      csv += 'teacher@school.edu,XI SCI A,MATH,TRUE,4\n'
      csv += 'teacher@school.edu,XII SCI B,PHY,TRUE,3\n'
    } else if (type === 'milestones') {
      csv = 'Milestone Name,Date,Type,Description\n'
      csv += 'Term 1 Exam,2025-12-15,exam,First term examination\n'
      csv += 'Term 2 Exam,2026-03-15,exam,Second term examination\n'
    } else if (type === 'milestone-topics') {
      csv = 'Milestone,Division,Subject Code,Topic IDs\n'
      csv += 'Term 1 Exam,XI SCI A,MATH,MATH-11-01;MATH-11-02;MATH-11-03\n'
      csv += 'Term 1 Exam,XI SCI A,PHY,PHY-11-01;PHY-11-02\n'
    } else if (type === 'students') {
      csv = 'Full Name,GR Number,Roll Number,Date of Birth,Division,Parent Name,Parent Phone,Email,Phone\n'
      csv += 'Rahul Sharma,GR2025001,1,2008-05-15,XI SCI A,Mr. Sharma,9876543210,,\n'
      csv += 'Priya Patel,GR2025002,2,2008-08-22,XI SCI A,Mr. Patel,9876543211,,\n'
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template-${type}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Bulk Upload</h2>
        <p className="text-slate-400">Import data from CSV files</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? '✓' : '✕'} {message.text}
        </div>
      )}

      {/* Upload Type Selection - 5 OPTIONS */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <div className="text-sm font-medium text-slate-300 mb-3">Select Upload Type:</div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          <button
            onClick={() => { setUploadType('topics'); setFile(null); setPreview([]) }}
            className={`p-6 rounded-xl border text-left transition-all ${
              uploadType === 'topics'
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-slate-700/30 border-white/10 hover:bg-slate-700/50'
            }`}
          >
            <div className="text-3xl mb-2">📝</div>
            <div className="font-semibold text-white mb-1">Topics</div>
            <div className="text-xs text-slate-400">Upload syllabus topics</div>
          </button>

          <button
            onClick={() => { setUploadType('assignments'); setFile(null); setPreview([]) }}
            className={`p-6 rounded-xl border text-left transition-all ${
              uploadType === 'assignments'
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-slate-700/30 border-white/10 hover:bg-slate-700/50'
            }`}
          >
            <div className="text-3xl mb-2">👨‍🏫</div>
            <div className="font-semibold text-white mb-1">Assignments</div>
            <div className="text-xs text-slate-400">Faculty assignments</div>
          </button>

          <button
            onClick={() => { setUploadType('milestones'); setFile(null); setPreview([]) }}
            className={`p-6 rounded-xl border text-left transition-all ${
              uploadType === 'milestones'
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-slate-700/30 border-white/10 hover:bg-slate-700/50'
            }`}
          >
            <div className="text-3xl mb-2">🎯</div>
            <div className="font-semibold text-white mb-1">Milestones</div>
            <div className="text-xs text-slate-400">Exam schedules</div>
          </button>

          <button
            onClick={() => { setUploadType('milestone-topics'); setFile(null); setPreview([]) }}
            className={`p-6 rounded-xl border text-left transition-all ${
              uploadType === 'milestone-topics'
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-slate-700/30 border-white/10 hover:bg-slate-700/50'
            }`}
          >
            <div className="text-3xl mb-2">✅</div>
            <div className="font-semibold text-white mb-1">Milestone Topics</div>
            <div className="text-xs text-slate-400">Assign topics to milestones</div>
          </button>

          <button
            onClick={() => { setUploadType('students'); setFile(null); setPreview([]) }}
            className={`p-6 rounded-xl border text-left transition-all ${
              uploadType === 'students'
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-slate-700/30 border-white/10 hover:bg-slate-700/50'
            }`}
          >
            <div className="text-3xl mb-2">👨‍🎓</div>
            <div className="font-semibold text-white mb-1">Students</div>
            <div className="text-xs text-slate-400">Student enrollment data</div>
          </button>
        </div>
      </div>

      {/* Template Download */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">ℹ️</div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-2">Download Template</div>
            <p className="text-sm text-slate-400 mb-4">
              Download CSV template with correct column format for {uploadType.replace('-', ' ')}.
            </p>
            <button
              onClick={() => downloadTemplate(uploadType)}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg flex items-center gap-2"
            >
              📥 Download {uploadType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Template
            </button>
          </div>
        </div>
      </div>

      {/* Special Instructions for Milestone Topics */}
      {uploadType === 'milestone-topics' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div className="flex-1">
              <div className="font-semibold text-white mb-2">Milestone Topics Format</div>
              <div className="text-sm text-slate-400 space-y-2">
                <p>• <strong>Milestone:</strong> Exact name (e.g., "Term 1 Exam")</p>
                <p>• <strong>Division:</strong> Exact name (e.g., "XI SCI A")</p>
                <p>• <strong>Subject Code:</strong> Subject code (e.g., "MATH", "PHY")</p>
                <p>• <strong>Topic IDs:</strong> Semicolon-separated list (e.g., "MATH-11-01;MATH-11-02;MATH-11-03")</p>
                <p className="pt-2 text-amber-400">⚠️ Names must match exactly! Create milestones first.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">📤</div>
          <h3 className="text-lg font-semibold text-white mb-2">Upload CSV File</h3>
          <p className="text-sm text-slate-400 mb-6">
            Select a CSV file to upload. We'll validate and preview before importing.
          </p>
          
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-block px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl cursor-pointer"
          >
            Choose File
          </label>
          
          {file && (
            <div className="mt-4 text-sm text-emerald-400">
              ✓ Selected: {file.name}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Preview (First 10 rows)</div>
              <div className="text-sm text-slate-400">Review data before uploading</div>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Uploading...
                </>
              ) : (
                <>
                  ✓ Import Data
                </>
              )}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-slate-700/50">
                  {Object.keys(preview[0] || {}).map((header) => (
                    <th key={header} className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5">
                    {Object.values(row).map((value: any, i) => (
                      <td key={i} className="py-2 px-4 text-sm text-slate-300">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-slate-700/30 border border-white/10 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Upload Instructions:</h3>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2">
            <span className="text-amber-400">1.</span>
            <span>Download the template for your data type</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">2.</span>
            <span>Fill in the data following the column format exactly</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">3.</span>
            <span>Save as CSV file (UTF-8 encoding for Hindi/multilingual text)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">4.</span>
            <span>Upload and preview your data</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">5.</span>
            <span>Click "Import Data" to complete the upload</span>
          </li>
        </ol>
      </div>
    </div>
  )
}