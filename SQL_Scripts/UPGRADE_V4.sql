-- ========================================
-- EDUTRACK UPGRADE SQL v4 - Run in Supabase SQL Editor
-- Ensures: students table, student_notes, logo_url, principal_name
-- ========================================

-- 1. Add logo_url to institutions (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'logo_url') THEN
    ALTER TABLE institutions ADD COLUMN logo_url text DEFAULT NULL;
  END IF;
END $$;

-- 2. Add principal_name to institutions (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'principal_name') THEN
    ALTER TABLE institutions ADD COLUMN principal_name text DEFAULT NULL;
  END IF;
END $$;

-- 3. Add institution_name if table uses 'name' instead
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'institution_name') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'name') THEN
      ALTER TABLE institutions ADD COLUMN institution_name text GENERATED ALWAYS AS (name) STORED;
    END IF;
  END IF;
END $$;

-- 4. Ensure students table exists
CREATE TABLE IF NOT EXISTS students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL,
  division_id uuid,
  full_name text NOT NULL,
  roll_number text,
  email text,
  phone text,
  parent_name text,
  parent_phone text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_division ON students(division_id);

-- 5. Create student_notes table for student-faculty messaging
CREATE TABLE IF NOT EXISTS student_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL,
  student_id uuid NOT NULL,
  faculty_id uuid NOT NULL,
  subject_id uuid,
  note_text text NOT NULL,
  sent_by text NOT NULL CHECK (sent_by IN ('student', 'faculty')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_notes_faculty ON student_notes(faculty_id, created_at DESC);

-- 6. Add standard_id to topics if missing (needed for entries/reports)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'standard_id') THEN
    ALTER TABLE topics ADD COLUMN standard_id uuid;
  END IF;
END $$;

-- 7. Add topic_number to topics if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'topic_number') THEN
    ALTER TABLE topics ADD COLUMN topic_number integer DEFAULT 0;
  END IF;
END $$;

-- 8. Ensure faculty_assignments has academic_year_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faculty_assignments' AND column_name = 'academic_year_id') THEN
    ALTER TABLE faculty_assignments ADD COLUMN academic_year_id uuid;
  END IF;
END $$;

-- 9. Ensure syllabus_entries has key columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'syllabus_entries' AND column_name = 'teaching_date') THEN
    ALTER TABLE syllabus_entries ADD COLUMN teaching_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'syllabus_entries' AND column_name = 'completion_percentage') THEN
    ALTER TABLE syllabus_entries ADD COLUMN completion_percentage integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'syllabus_entries' AND column_name = 'remarks') THEN
    ALTER TABLE syllabus_entries ADD COLUMN remarks text;
  END IF;
END $$;

-- 10. Ensure role check allows all needed roles
-- Uncomment if your users table has a strict check constraint on role:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'hod', 'faculty'));

-- 11. Enable RLS on student tables (optional - depends on your setup)
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Institution members can view students" ON students FOR SELECT USING (true);
-- CREATE POLICY "Admin can manage students" ON students FOR ALL USING (true);

-- CREATE POLICY "Faculty and students can view notes" ON student_notes FOR SELECT USING (true);
-- CREATE POLICY "Faculty and students can insert notes" ON student_notes FOR INSERT WITH CHECK (true);

SELECT 'UPGRADE_V4 complete! All tables and columns verified.' as status;
