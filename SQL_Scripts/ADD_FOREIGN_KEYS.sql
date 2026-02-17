-- ========================================================
-- ADD MISSING FOREIGN KEY RELATIONSHIPS
-- Run this in Supabase SQL Editor
-- ========================================================
-- These FKs are needed for Supabase PostgREST joins to work
-- ========================================================

-- 1. syllabus_entries → topics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'syllabus_entries_topic_id_fkey'
    AND table_name = 'syllabus_entries'
  ) THEN
    ALTER TABLE syllabus_entries 
    ADD CONSTRAINT syllabus_entries_topic_id_fkey 
    FOREIGN KEY (topic_id) REFERENCES topics(id);
    RAISE NOTICE '✅ Added FK: syllabus_entries.topic_id → topics.id';
  ELSE
    RAISE NOTICE '⏭️ FK syllabus_entries_topic_id_fkey already exists';
  END IF;
END $$;

-- 2. syllabus_entries → subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'syllabus_entries_subject_id_fkey'
    AND table_name = 'syllabus_entries'
  ) THEN
    ALTER TABLE syllabus_entries 
    ADD CONSTRAINT syllabus_entries_subject_id_fkey 
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
    RAISE NOTICE '✅ Added FK: syllabus_entries.subject_id → subjects.id';
  ELSE
    RAISE NOTICE '⏭️ FK syllabus_entries_subject_id_fkey already exists';
  END IF;
END $$;

-- 3. syllabus_entries → divisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'syllabus_entries_division_id_fkey'
    AND table_name = 'syllabus_entries'
  ) THEN
    ALTER TABLE syllabus_entries 
    ADD CONSTRAINT syllabus_entries_division_id_fkey 
    FOREIGN KEY (division_id) REFERENCES divisions(id);
    RAISE NOTICE '✅ Added FK: syllabus_entries.division_id → divisions.id';
  ELSE
    RAISE NOTICE '⏭️ FK syllabus_entries_division_id_fkey already exists';
  END IF;
END $$;

-- 4. syllabus_entries → users (faculty_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'syllabus_entries_faculty_id_fkey'
    AND table_name = 'syllabus_entries'
  ) THEN
    ALTER TABLE syllabus_entries 
    ADD CONSTRAINT syllabus_entries_faculty_id_fkey 
    FOREIGN KEY (faculty_id) REFERENCES users(id);
    RAISE NOTICE '✅ Added FK: syllabus_entries.faculty_id → users.id';
  ELSE
    RAISE NOTICE '⏭️ FK syllabus_entries_faculty_id_fkey already exists';
  END IF;
END $$;

-- 5. topics → subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'topics_subject_id_fkey'
    AND table_name = 'topics'
  ) THEN
    ALTER TABLE topics 
    ADD CONSTRAINT topics_subject_id_fkey 
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
    RAISE NOTICE '✅ Added FK: topics.subject_id → subjects.id';
  ELSE
    RAISE NOTICE '⏭️ FK topics_subject_id_fkey already exists';
  END IF;
END $$;

-- 6. divisions → standards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'divisions_standard_id_fkey'
    AND table_name = 'divisions'
  ) THEN
    ALTER TABLE divisions 
    ADD CONSTRAINT divisions_standard_id_fkey 
    FOREIGN KEY (standard_id) REFERENCES standards(id);
    RAISE NOTICE '✅ Added FK: divisions.standard_id → standards.id';
  ELSE
    RAISE NOTICE '⏭️ FK divisions_standard_id_fkey already exists';
  END IF;
END $$;

-- 7. faculty_assignments → subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'faculty_assignments_subject_id_fkey'
    AND table_name = 'faculty_assignments'
  ) THEN
    ALTER TABLE faculty_assignments 
    ADD CONSTRAINT faculty_assignments_subject_id_fkey 
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
    RAISE NOTICE '✅ Added FK: faculty_assignments.subject_id → subjects.id';
  ELSE
    RAISE NOTICE '⏭️ FK already exists';
  END IF;
END $$;

-- 8. faculty_assignments → divisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'faculty_assignments_division_id_fkey'
    AND table_name = 'faculty_assignments'
  ) THEN
    ALTER TABLE faculty_assignments 
    ADD CONSTRAINT faculty_assignments_division_id_fkey 
    FOREIGN KEY (division_id) REFERENCES divisions(id);
    RAISE NOTICE '✅ Added FK: faculty_assignments.division_id → divisions.id';
  ELSE
    RAISE NOTICE '⏭️ FK already exists';
  END IF;
END $$;

-- ========================================================
-- VERIFY ALL FKs
-- ========================================================
SELECT 
  tc.table_name, 
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('syllabus_entries', 'topics', 'divisions', 'faculty_assignments')
ORDER BY tc.table_name, tc.constraint_name;
