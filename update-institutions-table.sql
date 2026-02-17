-- Run this SQL in Supabase SQL Editor to add new columns to institutions table

-- Add new columns to institutions table
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS short_name TEXT,
ADD COLUMN IF NOT EXISTS udise_number TEXT,
ADD COLUMN IF NOT EXISTS index_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'institutions'
ORDER BY ordinal_position;

-- Update existing institution with sample data (optional)
-- UPDATE institutions 
-- SET 
--   short_name = 'AES',
--   city = 'Mumbai',
--   state = 'Maharashtra',
--   contact_email = 'info@aesjc.edu.in'
-- WHERE id = 'INST-001';

-- Create storage bucket for logos (run this separately if needed)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('institution-assets', 'institution-assets', true)
-- ON CONFLICT (id) DO NOTHING;

-- Set up storage policy for public access
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'institution-assets');
-- CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'institution-assets' AND auth.role() = 'authenticated');
