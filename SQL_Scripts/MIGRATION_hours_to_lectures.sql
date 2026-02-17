-- ========================================================
-- MIGRATION: Rename "hours" columns to "lectures"
-- Run this in Supabase SQL Editor BEFORE deploying new code
-- ========================================================
-- Date: 2026-02-13
-- Purpose: Standardize terminology from "hours" to "lectures"
-- ========================================================

-- ⚠️ IMPORTANT: Run this FIRST, then deploy the updated code.
-- The new code expects these column names.

-- ========================================================
-- 1. TOPICS TABLE: suggested_hours → default_lectures
-- ========================================================
-- Check if column exists before renaming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topics' AND column_name = 'suggested_hours'
  ) THEN
    ALTER TABLE topics RENAME COLUMN suggested_hours TO default_lectures;
    RAISE NOTICE '✅ topics.suggested_hours → default_lectures';
  ELSE
    RAISE NOTICE '⏭️ topics.suggested_hours not found (may already be renamed)';
  END IF;
END $$;

-- Also rename hours_allotted if it exists (some setups have this)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topics' AND column_name = 'hours_allotted'
  ) THEN
    -- If default_lectures already exists (from above rename), drop hours_allotted
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'topics' AND column_name = 'default_lectures'
    ) THEN
      -- Copy data from hours_allotted to default_lectures where default_lectures is null/0
      UPDATE topics 
      SET default_lectures = hours_allotted 
      WHERE (default_lectures IS NULL OR default_lectures = 0) 
        AND hours_allotted IS NOT NULL AND hours_allotted > 0;
      
      ALTER TABLE topics DROP COLUMN hours_allotted;
      RAISE NOTICE '✅ topics.hours_allotted merged into default_lectures and dropped';
    ELSE
      ALTER TABLE topics RENAME COLUMN hours_allotted TO default_lectures;
      RAISE NOTICE '✅ topics.hours_allotted → default_lectures';
    END IF;
  ELSE
    RAISE NOTICE '⏭️ topics.hours_allotted not found (OK)';
  END IF;
END $$;

-- ========================================================
-- 2. SYLLABUS_ENTRIES TABLE: hours_taken → lectures_taken
-- ========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'syllabus_entries' AND column_name = 'hours_taken'
  ) THEN
    ALTER TABLE syllabus_entries RENAME COLUMN hours_taken TO lectures_taken;
    RAISE NOTICE '✅ syllabus_entries.hours_taken → lectures_taken';
  ELSE
    RAISE NOTICE '⏭️ syllabus_entries.hours_taken not found (may already be renamed)';
  END IF;
END $$;

-- ========================================================
-- 3. SUBJECTS TABLE: total_hours → total_lectures
-- ========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'total_hours'
  ) THEN
    ALTER TABLE subjects RENAME COLUMN total_hours TO total_lectures;
    RAISE NOTICE '✅ subjects.total_hours → total_lectures';
  ELSE
    RAISE NOTICE '⏭️ subjects.total_hours not found (may already be renamed)';
  END IF;
END $$;

-- ========================================================
-- 4. VERIFY CHANGES
-- ========================================================
SELECT 'topics' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'topics' 
  AND column_name IN ('default_lectures', 'suggested_hours', 'hours_allotted')
UNION ALL
SELECT 'syllabus_entries', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'syllabus_entries' 
  AND column_name IN ('lectures_taken', 'hours_taken')
UNION ALL
SELECT 'subjects', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subjects' 
  AND column_name IN ('total_lectures', 'total_hours')
ORDER BY table_name, column_name;

-- ========================================================
-- Expected output after migration:
-- topics         | default_lectures  | numeric/decimal
-- syllabus_entries | lectures_taken  | numeric/decimal  
-- subjects       | total_lectures    | integer/numeric
-- ========================================================
