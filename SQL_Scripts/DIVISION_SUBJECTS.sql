-- ============================================================
-- DIVISION_SUBJECTS.sql - Subject Allocation to Divisions
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create division_subjects mapping table
CREATE TABLE IF NOT EXISTS division_subjects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  institution_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Ensure unique constraint exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'division_subjects_division_id_subject_id_key'
  ) THEN
    ALTER TABLE division_subjects ADD CONSTRAINT division_subjects_division_id_subject_id_key UNIQUE (division_id, subject_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Unique constraint: %', SQLERRM;
END $$;

-- 2. Enable RLS
ALTER TABLE division_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for division_subjects" ON division_subjects;
CREATE POLICY "Enable all access for division_subjects" ON division_subjects FOR ALL USING (true) WITH CHECK (true);

-- 3. Auto-populate from EXISTING syllabus_entries (so current data shows immediately)
INSERT INTO division_subjects (division_id, subject_id, institution_id)
SELECT DISTINCT 
  se.division_id, 
  se.subject_id,
  d.institution_id
FROM syllabus_entries se
JOIN divisions d ON d.id = se.division_id
WHERE se.division_id IS NOT NULL AND se.subject_id IS NOT NULL
ON CONFLICT (division_id, subject_id) DO NOTHING;

-- 4. Also populate from faculty_assignments
INSERT INTO division_subjects (division_id, subject_id, institution_id)
SELECT DISTINCT 
  fa.division_id,
  fa.subject_id,
  d.institution_id
FROM faculty_assignments fa
JOIN divisions d ON d.id = fa.division_id
WHERE fa.division_id IS NOT NULL AND fa.subject_id IS NOT NULL
ON CONFLICT (division_id, subject_id) DO NOTHING;

-- 5. Verify
SELECT 'division_subjects populated:' as info, count(*) as total FROM division_subjects;
SELECT ds.id, d.division_name, s.subject_name 
FROM division_subjects ds
JOIN divisions d ON d.id = ds.division_id
JOIN subjects s ON s.id = ds.subject_id
ORDER BY d.division_name, s.subject_name
LIMIT 20;
