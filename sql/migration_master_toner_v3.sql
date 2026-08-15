-- ============================================================
-- SIREGI - Migration Master Produk Toner & Paket Bundling (v3)
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Buat Tabel Master Produk Toner
CREATE TABLE IF NOT EXISTS master_produk_toner (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_produk TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('Drum', 'Toner Mono', 'Paket Bundling')),
  tipe_printer_kompatibel TEXT DEFAULT '',
  harga_satuan NUMERIC NOT NULL DEFAULT 0,
  is_paket BOOLEAN DEFAULT FALSE,
  isi_paket JSONB DEFAULT '{}'::jsonb,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for master_produk_toner
ALTER TABLE master_produk_toner ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read master_produk_toner" ON master_produk_toner;
CREATE POLICY "Public read master_produk_toner" ON master_produk_toner FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert master_produk_toner" ON master_produk_toner;
CREATE POLICY "Public insert master_produk_toner" ON master_produk_toner FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update master_produk_toner" ON master_produk_toner;
CREATE POLICY "Public update master_produk_toner" ON master_produk_toner FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete master_produk_toner" ON master_produk_toner;
CREATE POLICY "Public delete master_produk_toner" ON master_produk_toner FOR DELETE USING (true);

-- 2. Buat Tabel Log Perubahan Harga Produk Toner
CREATE TABLE IF NOT EXISTS log_harga_produk_toner (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produk_id UUID REFERENCES master_produk_toner(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  harga_lama NUMERIC NOT NULL,
  harga_baru NUMERIC NOT NULL,
  diubah_oleh TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for log_harga_produk_toner
ALTER TABLE log_harga_produk_toner ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read log_harga_produk_toner" ON log_harga_produk_toner;
CREATE POLICY "Public read log_harga_produk_toner" ON log_harga_produk_toner FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert log_harga_produk_toner" ON log_harga_produk_toner;
CREATE POLICY "Public insert log_harga_produk_toner" ON log_harga_produk_toner FOR INSERT WITH CHECK (true);

-- 3. Tambah Kolom Rincian Paket ke tb_rekap_pengeluaran
ALTER TABLE tb_rekap_pengeluaran
  ADD COLUMN IF NOT EXISTS toner_produk_id UUID,
  ADD COLUMN IF NOT EXISTS toner_nama_produk TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS toner_is_paket BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS toner_isi_paket JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS toner_jumlah_paket INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toner_harga_override BOOLEAN DEFAULT FALSE;

-- 4. Seed Data Awal Master Toner
INSERT INTO master_produk_toner (nama_produk, kategori, tipe_printer_kompatibel, harga_satuan, is_paket, isi_paket, aktif)
VALUES
  (
    'COMPATIBLE AMAZINK BROTHER Drum unit DR1000/1070/HL 1110',
    'Drum',
    'Brother HL 1110 / DR1000 / DR1070',
    150000,
    FALSE,
    '{}'::jsonb,
    TRUE
  ),
  (
    'COMPATIBLE AMAZINK BROTHER Mono TN 1080 / HL 1211',
    'Toner Mono',
    'Brother HL 1211 / TN 1080',
    75000,
    FALSE,
    '{}'::jsonb,
    TRUE
  ),
  (
    'COMPATIBLE AMAZINK CANON Mono [CRG 325] LBP 6000/6030/6040 / ImageCLASS MF 3010',
    'Toner Mono',
    'Canon LBP 6000 / 6030 / 6040 / MF 3010',
    85000,
    FALSE,
    '{}'::jsonb,
    TRUE
  ),
  (
    'Paket Toner TN1080 dan Drum Cabang Lama',
    'Paket Bundling',
    'Brother HL 1110 / 1211',
    700000,
    TRUE,
    '{"drum": 1, "toner": 8}'::jsonb,
    TRUE
  )
ON CONFLICT DO NOTHING;
