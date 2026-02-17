-- ============================================================
-- FIX_STUDENTS_TABLE.sql
-- Run this in Supabase SQL Editor to fix student upload errors
-- ============================================================

-- Step 1: Check current students table structure
DO $$ 
DECLARE
  col_exists boolean;
BEGIN
  -- Check if full_name column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'full_name'
  ) INTO col_exists;
  
  IF col_exists THEN
    RAISE NOTICE '✅ full_name column already exists';
  ELSE
    RAISE NOTICE '❌ full_name column MISSING - will add it now';
    
    -- Check if 'name' column exists (common alternative)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'name') THEN
      -- Rename 'name' to 'full_name'
      ALTER TABLE students RENAME COLUMN name TO full_name;
      RAISE NOTICE '✅ Renamed "name" column to "full_name"';
    ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'student_name') THEN
      -- Rename 'student_name' to 'full_name'
      ALTER TABLE students RENAME COLUMN student_name TO full_name;
      RAISE NOTICE '✅ Renamed "student_name" column to "full_name"';
    ELSE
      -- Add full_name column
      ALTER TABLE students ADD COLUMN full_name text;
      RAISE NOTICE '✅ Added new "full_name" column';
    END IF;
  END IF;
END $$;

-- Step 2: Drop student_name if it's a GENERATED column (blocks inserts)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' 
    AND column_name = 'student_name' 
    AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE students DROP COLUMN student_name;
    RAISE NOTICE '✅ Dropped GENERATED student_name column (was blocking inserts)';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'student_name check: %', SQLERRM;
END $$;

-- Step 3: Ensure other required columns exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'gr_number') THEN
    ALTER TABLE students ADD COLUMN gr_number text;
    RAISE NOTICE '✅ Added gr_number column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'date_of_birth') THEN
    ALTER TABLE students ADD COLUMN date_of_birth date;
    RAISE NOTICE '✅ Added date_of_birth column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'roll_number') THEN
    ALTER TABLE students ADD COLUMN roll_number text;
    RAISE NOTICE '✅ Added roll_number column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_name') THEN
    ALTER TABLE students ADD COLUMN parent_name text;
    RAISE NOTICE '✅ Added parent_name column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_phone') THEN
    ALTER TABLE students ADD COLUMN parent_phone text;
    RAISE NOTICE '✅ Added parent_phone column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'email') THEN
    ALTER TABLE students ADD COLUMN email text;
    RAISE NOTICE '✅ Added email column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'phone') THEN
    ALTER TABLE students ADD COLUMN phone text;
    RAISE NOTICE '✅ Added phone column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'division_id') THEN
    ALTER TABLE students ADD COLUMN division_id uuid;
    RAISE NOTICE '✅ Added division_id column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'institution_id') THEN
    ALTER TABLE students ADD COLUMN institution_id uuid;
    RAISE NOTICE '✅ Added institution_id column';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'is_active') THEN
    ALTER TABLE students ADD COLUMN is_active boolean DEFAULT true;
    RAISE NOTICE '✅ Added is_active column';
  END IF;
END $$;

-- Step 4: Fix RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for students" ON students;
CREATE POLICY "Enable all access for students" ON students FOR ALL USING (true) WITH CHECK (true);

-- Step 5: Create unique index on gr_number per institution (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_gr_unique') THEN
    CREATE UNIQUE INDEX idx_students_gr_unique ON students(institution_id, gr_number) WHERE gr_number IS NOT NULL;
    RAISE NOTICE '✅ Created unique index on (institution_id, gr_number)';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index creation: %', SQLERRM;
END $$;

-- Step 6: Verify final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'students'
ORDER BY ordinal_position;

-- IMPORTANT: After running this SQL, reload the schema cache:
-- Go to Supabase Dashboard → Project Settings → API → Click "Reload schema cache"
-- Or wait 2-3 minutes for auto-refresh
