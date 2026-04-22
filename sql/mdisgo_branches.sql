-- =============================================
-- MDISGO BRANCHES TABLE - Run in Supabase SQL Editor
-- =============================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS mdisgo_branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_name TEXT NOT NULL,
  training_date DATE NOT NULL,
  members_accessed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS with open policy (same pattern as staff_progress)
ALTER TABLE mdisgo_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to mdisgo_branches"
  ON mdisgo_branches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Seed data - 20 branches (same as performance review, alphabetical)
-- NOTE: Adjust branch names to match YOUR actual staff_progress data.
-- Adjust training_date and members_accessed as needed.

INSERT INTO mdisgo_branches (branch_name, training_date, members_accessed, status) VALUES
  ('KC Balikpapan',       '2026-02-10', 150, 'Completed'),
  ('KC Banjarmasin',      '2026-02-12', 200, 'Completed'),
  ('KC Bontang',          '2026-02-15', 120, 'Completed'),
  ('KC Palangka Raya',    '2026-02-17', 180, 'Completed'),
  ('KC Pontianak',        '2026-02-19', 160, 'Completed'),
  ('KC Samarinda',        '2026-02-21', 210, 'Completed'),
  ('KC Singkawang',       '2026-02-24', 90,  'Completed'),
  ('KC Tarakan',          '2026-02-26', 130, 'Completed'),
  ('KCP Banjar',          '2026-03-03', 75,  'Completed'),
  ('KCP Batulicin',       '2026-03-05', 85,  'Completed'),
  ('KCP Buntok',          '2026-03-07', 60,  'Active'),
  ('KCP Kapuas',          '2026-03-10', 95,  'Active'),
  ('KCP Ketapang',        '2026-03-12', 70,  'Active'),
  ('KCP Kotabaru',        '2026-03-14', 80,  'Active'),
  ('KCP Muara Teweh',     '2026-03-17', 65,  'Active'),
  ('KCP Nunukan',         '2026-03-19', 55,  'Active'),
  ('KCP Sampit',          '2026-03-21', 100, 'Active'),
  ('KCP Sangatta',        '2026-03-24', 110, 'Active'),
  ('KCP Sintang',         '2026-03-26', 70,  'Active'),
  ('KCP Tanjung Redeb',   '2026-03-28', 95,  'Active');
