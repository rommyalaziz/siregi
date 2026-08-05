-- =========================================================================
-- MIGRATION: ADD locked_center COLUMN TO mdisgo_branches
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- Add locked_center column (jumlah center yang terkunci / lock penarikan)
ALTER TABLE mdisgo_branches
ADD COLUMN IF NOT EXISTS locked_center INTEGER DEFAULT 0;

-- Optional: verify
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'mdisgo_branches' ORDER BY ordinal_position;
