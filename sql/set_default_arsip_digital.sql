-- ============================================================
-- SET DEFAULT: Arsip Pencairan + Arsip Anggota Masuk
-- ============================================================
-- Update tanggal cek & periode default untuk SEMUA cabang
-- yang sudah ada di tabel arsip_digital.
--
-- Arsip Pencairan:
--   - Tanggal Cek    : 01 Oktober 2026
--   - Periode Dari   : 01 Juli 2026
--   - Periode Sampai : 30 September 2026
--
-- Arsip Anggota Masuk:
--   - Tanggal Cek    : 01 Oktober 2026
--   - Periode Dari   : 01 Januari 2026
--   - Periode Sampai : 30 September 2026
--
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Dibuat: 2026-10-12
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- LANGKAH 1: Update tanggal cek di tabel arsip_digital
--            untuk Pencairan & Anggota Masuk (semua cabang)
-- ────────────────────────────────────────────────────────────
UPDATE public.arsip_digital
SET
  tanggal_cek_pencairan     = '2026-10-01',
  tanggal_cek_anggota_masuk = '2026-10-01',
  updated_at                = NOW();


-- ────────────────────────────────────────────────────────────
-- LANGKAH 2: Update periode di arsip_pencairan
--            (hanya untuk baris yang sudah ada)
-- ────────────────────────────────────────────────────────────
UPDATE public.arsip_pencairan
SET periode = '2026-07-01 sd 2026-09-30'
WHERE TRUE;


-- ────────────────────────────────────────────────────────────
-- LANGKAH 3: Update periode di arsip_anggota_masuk
--            (hanya untuk baris yang sudah ada)
-- ────────────────────────────────────────────────────────────
UPDATE public.arsip_anggota_masuk
SET periode = '2026-01-01 sd 2026-09-30'
WHERE TRUE;


-- ────────────────────────────────────────────────────────────
-- LANGKAH 4: INSERT arsip_pencairan untuk cabang yang BELUM
--            memiliki data pencairan sama sekali
-- ────────────────────────────────────────────────────────────
INSERT INTO public.arsip_pencairan (arsip_id, periode, total_pinjaman, arsip_lengkap, nama_file_tidak_sesuai, file_tidak_lengkap)
SELECT
  ad.id,
  '2026-07-01 sd 2026-09-30',
  0, 0, 0, 0
FROM public.arsip_digital ad
WHERE NOT EXISTS (
  SELECT 1 FROM public.arsip_pencairan ap WHERE ap.arsip_id = ad.id
);


-- ────────────────────────────────────────────────────────────
-- LANGKAH 5: INSERT arsip_anggota_masuk untuk cabang yang
--            BELUM memiliki data anggota masuk sama sekali
-- ────────────────────────────────────────────────────────────
INSERT INTO public.arsip_anggota_masuk (arsip_id, periode, member, lengkap, kurang, tidak_ditemukan, prosentase)
SELECT
  ad.id,
  '2026-01-01 sd 2026-09-30',
  0, 0, 0, 0, 0
FROM public.arsip_digital ad
WHERE NOT EXISTS (
  SELECT 1 FROM public.arsip_anggota_masuk am WHERE am.arsip_id = ad.id
);


-- ============================================================
-- VERIFIKASI — jalankan setelah update untuk memastikan benar
-- ============================================================
-- SELECT
--   ad.kode_cabang,
--   ad.nama_cabang,
--   ad.tanggal_cek_pencairan,
--   ad.tanggal_cek_anggota_masuk,
--   ap.periode  AS periode_pencairan,
--   am.periode  AS periode_anggota_masuk
-- FROM public.arsip_digital ad
-- LEFT JOIN public.arsip_pencairan      ap ON ap.arsip_id = ad.id
-- LEFT JOIN public.arsip_anggota_masuk  am ON am.arsip_id = ad.id
-- ORDER BY ad.nama_cabang;
