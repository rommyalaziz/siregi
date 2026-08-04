-- =============================================
-- SURVEY MDISGO TABLE - Run in Supabase SQL Editor
-- =============================================

-- 1. Create the survey table
CREATE TABLE IF NOT EXISTS survey_mdisgo (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  kode_cabang     TEXT          NOT NULL,
  nama_cabang     TEXT          NOT NULL,
  msa             TEXT,                          -- Nama MSA dari app_users.full_name
  status_submit   TEXT          DEFAULT 'draft'
                                CHECK (status_submit IN ('draft', 'submitted')),

  -- === 10 Pertanyaan Survey ===
  -- Q1: Tingkat implementasi (radio: Sangat Baik/Baik/Cukup/Kurang/Sangat Kurang)
  question_1      TEXT,
  -- Q2: Membantu anggota (radio: Sangat Membantu/Membantu/Cukup/Kurang/Tidak Membantu)
  question_2      TEXT,
  -- Q3: Kendala anggota (multi-select, disimpan sebagai text JSON array)
  question_3      TEXT,
  -- Q4: Kemampuan edukasi staff (skala 1-5)
  question_4      INTEGER       CHECK (question_4 >= 1 AND question_4 <= 5),
  -- Q5: Fitur paling sering digunakan (text)
  question_5      TEXT,
  -- Q6: Kendala dari staff lapang ke MSA (textarea)
  question_6      TEXT,
  -- Q7: Penyebab anggota belum aktif (textarea)
  question_7      TEXT,
  -- Q8: Fitur yang perlu dikembangkan (textarea)
  question_8      TEXT,
  -- Q9: Prioritas perbaikan (textarea)
  question_9      TEXT,
  -- Q10: Saran dan masukan (textarea)
  question_10     TEXT,

  -- === Timestamps ===
  tanggal_input   TIMESTAMPTZ,
  tanggal_update  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now(),
  created_by      TEXT,
  updated_by      TEXT,

  -- Constraint: satu cabang hanya boleh satu record survey
  CONSTRAINT survey_mdisgo_kode_cabang_unique UNIQUE (kode_cabang)
);

-- 2. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_survey_mdisgo_kode_cabang ON survey_mdisgo (kode_cabang);
CREATE INDEX IF NOT EXISTS idx_survey_mdisgo_status_submit ON survey_mdisgo (status_submit);

-- 3. Enable RLS with open policy (sesuai pola existing di mdisgo_branches)
ALTER TABLE survey_mdisgo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to survey_mdisgo"
  ON survey_mdisgo
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Periode Survey & Default Pertanyaan di app_settings
INSERT INTO app_settings (key, value) VALUES
  ('survey_mdisgo_period_start', TO_CHAR(NOW(), 'YYYY-MM-DD')),
  ('survey_mdisgo_period_end',   TO_CHAR(NOW() + INTERVAL '30 days', 'YYYY-MM-DD')),
  ('survey_mdisgo_questions', '["Bagaimana tingkat implementasi MDisgo di cabang Anda?", "Apakah MDisgo membantu anggota dalam melihat informasi simpanan dan pinjaman?", "Kendala apa yang paling sering dialami anggota?", "Menurut Anda apakah staff lapang sudah mampu melakukan edukasi penggunaan MDisgo kepada anggota?", "Fitur apa yang paling sering digunakan anggota?", "Kendala apa yang paling sering disampaikan staff lapang kepada MSA?", "Apa penyebab utama anggota belum menggunakan MDisgo secara aktif?", "Fitur apa yang paling perlu dikembangkan?", "Apa prioritas perbaikan MDisgo menurut Anda?", "Saran dan masukan untuk pengembangan MDisgo."]')
ON CONFLICT (key) DO NOTHING;
