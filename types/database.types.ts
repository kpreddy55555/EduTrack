export interface User {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'institution_admin' | 'hod' | 'faculty'
  institution_id: string | null
  department_id: string | null
  phone: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  institution_code: string
  institution_name: string
  board_id: string | null
  subscription_plan_id: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  is_active: boolean
  max_users: number
  max_students: number
  subscription_start: string | null
  subscription_end: string | null
  created_at: string
  updated_at: string
}

export interface AcademicYear {
  id: string
  institution_id: string
  year_name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
}

export interface Standard {
  id: string
  institution_id: string
  standard_name: string
  standard_code: string
  sequence_order: number
  created_at: string
}

export interface Stream {
  id: string
  institution_id: string
  stream_name: string
  stream_code: string
  created_at: string
}

export interface Division {
  id: string
  institution_id: string
  standard_id: string
  stream_id: string | null
  division_name: string
  division_code: string
  student_count: number
  created_at: string
}

export interface Subject {
  id: string
  institution_id: string
  subject_code: string
  subject_name: string
  standard_id: string
  stream_id: string | null
  total_lectures: number
  is_practical: boolean
  created_at: string
}

export interface Topic {
  id: string
  institution_id: string
  subject_id: string
  topic_id_number: string
  topic_name: string
  default_lectures: number
  sequence_order: number
  is_active: boolean
  created_at: string
}

export interface FacultyAssignment {
  id: string
  institution_id: string
  faculty_id: string
  subject_id: string
  division_id: string
  academic_year_id: string
  is_active: boolean
  created_at: string
}

export interface SyllabusEntry {
  id: string
  institution_id: string
  faculty_id: string
  division_id: string
  subject_id: string
  topic_id: string
  academic_year_id: string | null
  month: string
  start_date: string | null
  lectures_allotted: number
  lectures_taken: number
  status: 'Not Started' | 'In Progress' | 'Completed'
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface Board {
  id: string
  board_code: string
  board_name: string
  country: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface SubscriptionPlan {
  id: string
  plan_name: string
  max_users: number
  max_students: number
  price_monthly: number | null
  price_yearly: number | null
  features: Record<string, any> | null
  is_active: boolean
  created_at: string
}
