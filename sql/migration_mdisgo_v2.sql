-- =========================================================================
-- MIGRATION: ADD NEW COLUMNS FOR MONITORING MDISGO
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- 1. Add total_members column if not exists
ALTER TABLE mdisgo_branches 
ADD COLUMN IF NOT EXISTS total_members INTEGER DEFAULT 0;

-- 2. Add total_center column if not exists
ALTER TABLE mdisgo_branches 
ADD COLUMN IF NOT EXISTS total_center INTEGER DEFAULT 0;

-- 3. Add accessed_center column if not exists
ALTER TABLE mdisgo_branches 
ADD COLUMN IF NOT EXISTS accessed_center INTEGER DEFAULT 0;
