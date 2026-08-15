-- ============================================================
-- SIREGI - Migration Rekap Pengeluaran v2
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Drop unique constraint lama (agar 1 cabang bisa punya multi-transaksi per bulan)
ALTER TABLE tb_rekap_pengeluaran
  DROP CONSTRAINT IF EXISTS unique_cabang_periode;

-- 2. Tambah kolom-kolom baru
ALTER TABLE tb_rekap_pengeluaran
  ADD COLUMN IF NOT EXISTS tanggal DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Disetujui', 'Ditolak')),
  ADD COLUMN IF NOT EXISTS no_referensi TEXT,
  ADD COLUMN IF NOT EXISTS toner_jenis TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS toner_merk TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS toner_unit INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toner_harga_satuan NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catatan TEXT DEFAULT '';

-- 3. Tambah unique index pada no_referensi
CREATE UNIQUE INDEX IF NOT EXISTS idx_rekap_no_referensi
  ON tb_rekap_pengeluaran (no_referensi)
  WHERE no_referensi IS NOT NULL;

-- 4. Index untuk pencarian berdasarkan tanggal & status
CREATE INDEX IF NOT EXISTS idx_rekap_tanggal ON tb_rekap_pengeluaran (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_rekap_status  ON tb_rekap_pengeluaran (status);

-- 5. Backfill: isi tanggal dari created_at untuk data lama
UPDATE tb_rekap_pengeluaran
SET tanggal = created_at::DATE
WHERE tanggal IS NULL;

-- 6. Backfill: generate no_referensi untuk data lama yang belum punya
-- (window function harus dibungkus CTE karena tidak bisa langsung di UPDATE)
WITH numbered AS (
  SELECT
    id,
    'TRX-' ||
      TO_CHAR(created_at, 'YYYY') || '-' ||
      LPAD(bulan::TEXT, 2, '0') || '-' ||
      LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0') AS ref_baru
  FROM tb_rekap_pengeluaran
  WHERE no_referensi IS NULL OR no_referensi = ''
)
UPDATE tb_rekap_pengeluaran t
SET no_referensi = n.ref_baru
FROM numbered n
WHERE t.id = n.id;
