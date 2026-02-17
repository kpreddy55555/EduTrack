// lib/excel-utils.ts
import * as XLSX from 'xlsx'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
}

// Download data as Excel file
export function downloadExcel(data: any[], columns: ExcelColumn[], filename: string) {
  const wsData = [
    columns.map(col => col.header),
    ...data.map(row => columns.map(col => row[col.key] ?? ''))
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Download empty template with headers
export function downloadTemplate(columns: ExcelColumn[], filename: string, sampleData?: any[]) {
  const wsData = [
    columns.map(col => col.header),
    ...(sampleData || []).map(row => columns.map(col => row[col.key] ?? ''))
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')

  XLSX.writeFile(wb, `${filename}_template.xlsx`)
}

// Parse Excel file and return data
export function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// Faculty Excel columns
export const FACULTY_COLUMNS: ExcelColumn[] = [
  { header: 'Full Name', key: 'full_name', width: 25 },
  { header: 'Email', key: 'email', width: 35 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Role (faculty/hod)', key: 'role', width: 15 },
  { header: 'Department', key: 'department_name', width: 20 },
]

export const FACULTY_SAMPLE_DATA = [
  { full_name: 'John Doe', email: 'john.doe@school.org', phone: '9876543210', role: 'faculty', department_name: 'Science' },
  { full_name: 'Jane Smith', email: 'jane.smith@school.org', phone: '9876543211', role: 'hod', department_name: 'Commerce' },
]

// Subject Excel columns - Using "No. of Lectures" instead of "Hours"
export const SUBJECT_COLUMNS: ExcelColumn[] = [
  { header: 'Subject Code', key: 'subject_code', width: 15 },
  { header: 'Subject Name', key: 'subject_name', width: 30 },
  { header: 'Department', key: 'department_name', width: 20 },
  { header: 'No. of Lectures', key: 'total_lectures', width: 15 },
  { header: 'Board Subject Code', key: 'board_subject_code', width: 18 },
]

export const SUBJECT_SAMPLE_DATA = [
  { subject_code: 'PHY', subject_name: 'Physics', department_name: 'Science', total_lectures: 160, board_subject_code: 'PHY101' },
  { subject_code: 'CHE', subject_name: 'Chemistry', department_name: 'Science', total_lectures: 160, board_subject_code: 'CHE101' },
]

// Division Excel columns
export const DIVISION_COLUMNS: ExcelColumn[] = [
  { header: 'Division Code', key: 'division_code', width: 15 },
  { header: 'Division Name', key: 'division_name', width: 25 },
  { header: 'Stream', key: 'stream_name', width: 20 },
  { header: 'Student Count', key: 'student_count', width: 15 },
]

export const DIVISION_SAMPLE_DATA = [
  { division_code: 'XI-A', division_name: 'XI Commerce A', stream_name: 'Commerce', student_count: 45 },
  { division_code: 'XI-B', division_name: 'XI Science B', stream_name: 'Science', student_count: 40 },
]

// Topics Excel columns
export const TOPIC_COLUMNS: ExcelColumn[] = [
  { header: 'Topic Number', key: 'topic_id_number', width: 15 },
  { header: 'Topic Name', key: 'topic_name', width: 40 },
  { header: 'Default Lectures', key: 'default_lectures', width: 15 },
  { header: 'Sequence Order', key: 'sequence_order', width: 15 },
]

export const TOPIC_SAMPLE_DATA = [
  { topic_id_number: '1.1', topic_name: 'Introduction to Physics', default_lectures: 2, sequence_order: 1 },
  { topic_id_number: '1.2', topic_name: 'Units and Measurements', default_lectures: 3, sequence_order: 2 },
]

// Parse various date formats (DD/MM/YYYY, DD-MM-YY, DD-Mon-YY, etc.) to YYYY-MM-DD
export function parseDate(dateStr: string | number | null | undefined): string | null {
  if (dateStr == null || String(dateStr).trim() === '') return null
  const s = String(dateStr).trim()

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Excel serial date number (e.g., 39814)
  if (/^\d{5}$/.test(s)) {
    const excelEpoch = new Date(1899, 11, 30)
    const dt = new Date(excelEpoch.getTime() + parseInt(s) * 86400000)
    return dt.toISOString().split('T')[0]
  }

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

  // DD-Mon-YY or DD/Mon/YY (e.g., 23-Dec-08, 1-Nov-08)
  const months: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12'
  }
  const dmy3 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})$/)
  if (dmy3) {
    const [, d, mon, yr] = dmy3
    const m = months[mon.toLowerCase()] || '01'
    const y = yr.length === 2 ? (parseInt(yr) > 50 ? `19${yr}` : `20${yr}`) : yr
    return `${y}-${m}-${d.padStart(2, '0')}`
  }

  // Try JS Date parsing as last resort
  try {
    const dt = new Date(s)
    if (!isNaN(dt.getTime()) && dt.getFullYear() > 1900) {
      return dt.toISOString().split('T')[0]
    }
  } catch {}

  console.warn('Could not parse date:', s)
  return null
}

// Student Excel columns
export const STUDENT_COLUMNS: ExcelColumn[] = [
  { header: 'Full Name', key: 'full_name', width: 25 },
  { header: 'GR Number', key: 'gr_number', width: 15 },
  { header: 'Roll Number', key: 'roll_number', width: 12 },
  { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
  { header: 'Division', key: 'division_name', width: 20 },
  { header: 'Parent Name', key: 'parent_name', width: 20 },
  { header: 'Parent Phone', key: 'parent_phone', width: 15 },
  { header: 'Email', key: 'email', width: 20 },
  { header: 'Phone', key: 'phone', width: 15 },
]

export const STUDENT_SAMPLE_DATA = [
  { full_name: 'Rahul Sharma', gr_number: 'GR2025001', roll_number: '1', date_of_birth: '2008-05-15', division_name: 'XI SCI A', parent_name: 'Mr. Sharma', parent_phone: '9876543210', email: '', phone: '' },
  { full_name: 'Priya Patel', gr_number: 'GR2025002', roll_number: '2', date_of_birth: '2008-08-22', division_name: 'XI SCI A', parent_name: 'Mr. Patel', parent_phone: '9876543211', email: '', phone: '' },
]
