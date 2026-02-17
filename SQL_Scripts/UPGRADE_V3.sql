-- ========================================
-- EDUTRACK UPGRADE SQL - Run in Supabase SQL Editor
-- Adds: student_notes table, institution logo_url
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

-- 3. Create student_notes table for student-faculty messaging
CREATE TABLE IF NOT EXISTS student_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES users(id),
  subject_id uuid REFERENCES subjects(id),
  note_text text NOT NULL,
  sent_by text NOT NULL CHECK (sent_by IN ('student', 'faculty')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_notes_faculty ON student_notes(faculty_id, created_at DESC);

-- Enable RLS
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Students can view their own notes" ON student_notes
  FOR SELECT USING (student_id::text = auth.uid()::text);

CREATE POLICY "Faculty can view notes for their students" ON student_notes
  FOR SELECT USING (faculty_id = auth.uid());

CREATE POLICY "Students can insert notes" ON student_notes
  FOR INSERT WITH CHECK (student_id::text = auth.uid()::text AND sent_by = 'student');

CREATE POLICY "Faculty can insert notes" ON student_notes
  FOR INSERT WITH CHECK (faculty_id = auth.uid() AND sent_by = 'faculty');

-- 4. Ensure superadmin role exists in users table check constraint
-- (Most setups already allow this, but just in case)
-- If your users table has a CHECK constraint on role, you may need to update it:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'hod', 'faculty'));

SELECT 'SQL upgrade complete!' as status;
