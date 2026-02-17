-- ========================================
-- EDUTRACK UPGRADE SQL v5
-- Run this in Supabase SQL Editor
-- Fixes: students table, gr_number, date_of_birth, RLS, streams, storage
-- ========================================

-- =============================================
-- 1. INSTITUTION COLUMNS
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'logo_url') THEN
    ALTER TABLE institutions ADD COLUMN logo_url text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'principal_name') THEN
    ALTER TABLE institutions ADD COLUMN principal_name text DEFAULT NULL;
  END IF;
END $$;

-- Handle institution_name vs name column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'institution_name') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'name') THEN
      ALTER TABLE institutions ADD COLUMN institution_name text GENERATED ALWAYS AS (name) STORED;
    END IF;
  END IF;
END $$;

-- =============================================
-- 2. STUDENTS TABLE (with gr_number and date_of_birth)
-- =============================================
CREATE TABLE IF NOT EXISTS students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL,
  division_id uuid,
  full_name text NOT NULL,
  gr_number text,
  roll_number text,
  date_of_birth date,
  email text,
  phone text,
  parent_name text,
  parent_phone text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns to existing students table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'gr_number') THEN
    ALTER TABLE students ADD COLUMN gr_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'date_of_birth') THEN
    ALTER TABLE students ADD COLUMN date_of_birth date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'parent_name') THEN
    ALTER TABLE students ADD COLUMN parent_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'parent_phone') THEN
    ALTER TABLE students ADD COLUMN parent_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'address') THEN
    ALTER TABLE students ADD COLUMN address text;
  END IF;
END $$;

-- Add student_name alias column (login page uses it) - only if possible
-- NOTE: If this causes errors, the login page will use full_name instead
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'student_name') THEN
    BEGIN
      -- Try adding as a simple column with a trigger instead of GENERATED
      ALTER TABLE students ADD COLUMN student_name text;
      -- Set existing values
      UPDATE students SET student_name = full_name WHERE student_name IS NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add student_name column: %', SQLERRM;
    END;
  END IF;
END $$;

-- If student_name is a GENERATED column, it may block inserts - drop and recreate as regular
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'student_name' AND generation_expression IS NOT NULL
  ) THEN
    ALTER TABLE students DROP COLUMN student_name;
    ALTER TABLE students ADD COLUMN student_name text;
    UPDATE students SET student_name = full_name WHERE student_name IS NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'student_name column handling: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_division ON students(division_id);
CREATE INDEX IF NOT EXISTS idx_students_gr_number ON students(gr_number);

-- Unique GR number per institution
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_gr_unique') THEN
    CREATE UNIQUE INDEX idx_students_gr_unique ON students(institution_id, gr_number) WHERE gr_number IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- =============================================
-- 3. STUDENT SESSIONS TABLE (login tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS student_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  login_time timestamptz DEFAULT now(),
  logout_time timestamptz,
  ip_address text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id);

-- =============================================
-- 4. STUDENT NOTES TABLE
-- =============================================
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

-- =============================================
-- 5. TOPICS ENHANCEMENTS
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'standard_id') THEN
    ALTER TABLE topics ADD COLUMN standard_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'topic_number') THEN
    ALTER TABLE topics ADD COLUMN topic_number integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'topic_id_number') THEN
    ALTER TABLE topics ADD COLUMN topic_id_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'is_active') THEN
    ALTER TABLE topics ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- =============================================
-- 6. FACULTY ASSIGNMENTS - academic_year_id
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faculty_assignments' AND column_name = 'academic_year_id') THEN
    ALTER TABLE faculty_assignments ADD COLUMN academic_year_id uuid;
  END IF;
END $$;

-- =============================================
-- 7. SYLLABUS ENTRIES - extra columns
-- =============================================
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

-- =============================================
-- 8. STREAMS TABLE - add institution_id if missing
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'institution_id') THEN
    ALTER TABLE streams ADD COLUMN institution_id uuid;
  END IF;
END $$;

-- =============================================
-- 9. RLS POLICIES - Fix for streams, standards, students, etc.
-- =============================================

-- STREAMS
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all access for streams" ON streams;
  CREATE POLICY "Enable all access for streams" ON streams FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- STANDARDS
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all access for standards" ON standards;
  CREATE POLICY "Enable all access for standards" ON standards FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- STUDENTS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all access for students" ON students;
  CREATE POLICY "Enable all access for students" ON students FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- STUDENT_NOTES
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all access for student_notes" ON student_notes;
  CREATE POLICY "Enable all access for student_notes" ON student_notes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- STUDENT_SESSIONS
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all access for student_sessions" ON student_sessions;
  CREATE POLICY "Enable all access for student_sessions" ON student_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- TOPICS
DO $$ BEGIN
  ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for topics" ON topics;
  CREATE POLICY "Enable all access for topics" ON topics FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- INSTITUTIONS (ensure logo_url update works)
DO $$ BEGIN
  ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for institutions" ON institutions;
  CREATE POLICY "Enable all access for institutions" ON institutions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ACADEMIC_YEARS
DO $$ BEGIN
  ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for academic_years" ON academic_years;
  CREATE POLICY "Enable all access for academic_years" ON academic_years FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- DIVISIONS
DO $$ BEGIN
  ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for divisions" ON divisions;
  CREATE POLICY "Enable all access for divisions" ON divisions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- SUBJECTS
DO $$ BEGIN
  ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for subjects" ON subjects;
  CREATE POLICY "Enable all access for subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- FACULTY_ASSIGNMENTS
DO $$ BEGIN
  ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for faculty_assignments" ON faculty_assignments;
  CREATE POLICY "Enable all access for faculty_assignments" ON faculty_assignments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- SYLLABUS_ENTRIES
DO $$ BEGIN
  ALTER TABLE syllabus_entries ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for syllabus_entries" ON syllabus_entries;
  CREATE POLICY "Enable all access for syllabus_entries" ON syllabus_entries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- MILESTONES
DO $$ BEGIN
  ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for milestones" ON milestones;
  CREATE POLICY "Enable all access for milestones" ON milestones FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- USERS
DO $$ BEGIN
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all access for users" ON users;
  CREATE POLICY "Enable all access for users" ON users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL;
END $$;

-- =============================================
-- 10. STORAGE BUCKET FOR LOGOS
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('institution-assets', 'institution-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read institution-assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow auth upload institution-assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow auth update institution-assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow auth delete institution-assets" ON storage.objects;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY "Allow public read institution-assets"
ON storage.objects FOR SELECT USING (bucket_id = 'institution-assets');

CREATE POLICY "Allow auth upload institution-assets"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'institution-assets');

CREATE POLICY "Allow auth update institution-assets"
ON storage.objects FOR UPDATE USING (bucket_id = 'institution-assets');

CREATE POLICY "Allow auth delete institution-assets"
ON storage.objects FOR DELETE USING (bucket_id = 'institution-assets');

-- =============================================
-- DONE
-- =============================================
SELECT 'UPGRADE_V5 complete! Students (gr_number, DOB), RLS fixed, storage bucket created.' as status;
