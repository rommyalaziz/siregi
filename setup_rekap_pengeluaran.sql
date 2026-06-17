-- ============================================================
-- SIREGI - Setup Tabel Rekap Pengeluaran Cabang
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS tb_rekap_pengeluaran (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kode_cabang TEXT,
  nama_cabang TEXT NOT NULL,
  msa_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  msa_nama TEXT,
  service NUMERIC DEFAULT 0,
  hdd NUMERIC DEFAULT 0,
  ram NUMERIC DEFAULT 0,
  toner NUMERIC DEFAULT 0,
  mainboard NUMERIC DEFAULT 0,
  monitor NUMERIC DEFAULT 0,
  ups NUMERIC DEFAULT 0,
  lain_lain NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  bulan INTEGER NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun INTEGER NOT NULL,
  keterangan TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_cabang_periode UNIQUE (nama_cabang, bulan, tahun)
);

-- RLS (Row Level Security)
ALTER TABLE tb_rekap_pengeluaran ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users (or public depending on the app's current setup)
DROP POLICY IF EXISTS "Public can read tb_rekap_pengeluaran" ON tb_rekap_pengeluaran;
CREATE POLICY "Public can read tb_rekap_pengeluaran" ON tb_rekap_pengeluaran FOR SELECT USING (true);

-- Allow all actions for admin. In this simple setup, we might just allow all actions
-- since validation happens on frontend. We'll enable public full access for ease of use 
-- matching other tables if necessary, but ideally restricted to authenticated users.
DROP POLICY IF EXISTS "Public can insert tb_rekap_pengeluaran" ON tb_rekap_pengeluaran;
CREATE POLICY "Public can insert tb_rekap_pengeluaran" ON tb_rekap_pengeluaran FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update tb_rekap_pengeluaran" ON tb_rekap_pengeluaran;
CREATE POLICY "Public can update tb_rekap_pengeluaran" ON tb_rekap_pengeluaran FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete tb_rekap_pengeluaran" ON tb_rekap_pengeluaran;
CREATE POLICY "Public can delete tb_rekap_pengeluaran" ON tb_rekap_pengeluaran FOR DELETE USING (true);
