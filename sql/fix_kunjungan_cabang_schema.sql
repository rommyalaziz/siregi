-- ============================================================
-- SIREGI - Fix Schema & Policy Tabel kunjungan_cabang
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Pastikan tabel kunjungan_cabang ada
CREATE TABLE IF NOT EXISTS kunjungan_cabang (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_cabang        TEXT NOT NULL,
  nama_msa           TEXT NOT NULL,
  tanggal_kunjungan  DATE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan kolom-kolom baru jika belum ada
ALTER TABLE kunjungan_cabang
  ADD COLUMN IF NOT EXISTS cabang_id UUID REFERENCES cabang(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS periode_start DATE,
  ADD COLUMN IF NOT EXISTS periode_end DATE,
  ADD COLUMN IF NOT EXISTS c_folder_d_rapi BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_dok_surat_ceklist BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_surat_ceklist NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_data_anggota BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_data_anggota NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_anggota_keluar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_anggota_keluar NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_dana_resiko BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_dana_resiko NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_sihara BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_sihara NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_laporan_bulanan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_laporan_bulanan NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_dok_lwk BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n_kurang_lwk NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c_pending_mdis BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_briefing_buku_tamu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_kpa_akad BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_stok_formulir BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_sampling_phone BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_penyimpangan_ada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_maintenance_komputer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_stok_toner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_fixed_asset BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_backup_owncloud BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_sinkron_mdismo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS c_email_arsip BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS catatan_kendala TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tindak_lanjut TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kesimpulan TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS catatan_cabang_terdekat TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_laporan TEXT DEFAULT 'Draft';

-- 3. Update Policy RLS untuk Akses Penuh (Insert/Update/Delete/Select)
ALTER TABLE kunjungan_cabang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access kunjungan" ON kunjungan_cabang;
DROP POLICY IF EXISTS "Public full access kunjungan" ON kunjungan_cabang;

CREATE POLICY "Public full access kunjungan" ON kunjungan_cabang
  FOR ALL
  USING (true)
  WITH CHECK (true);
