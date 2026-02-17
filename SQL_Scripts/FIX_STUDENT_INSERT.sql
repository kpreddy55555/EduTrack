-- ========================================
-- QUICK FIX: Run this FIRST if student uploads give 400 errors
-- This drops the GENERATED student_name column that blocks INSERT operations
-- ========================================

-- Drop the generated column if it exists (it blocks all INSERTs)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'student_name'
  ) THEN
    ALTER TABLE students DROP COLUMN student_name;
    RAISE NOTICE 'Dropped student_name generated column';
  END IF;
END $$;

-- Ensure gr_number and date_of_birth columns exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'gr_number') THEN
    ALTER TABLE students ADD COLUMN gr_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'date_of_birth') THEN
    ALTER TABLE students ADD COLUMN date_of_birth date;
  END IF;
END $$;

-- Fix RLS on students table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for students" ON students;
CREATE POLICY "Enable all access for students" ON students FOR ALL USING (true) WITH CHECK (true);

SELECT 'FIX applied! student_name dropped, gr_number + date_of_birth ensured, RLS fixed.' as status;
