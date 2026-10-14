-- ============================================================
-- RESET DATA: Arsip Pencairan + Arsip Anggota Masuk
-- ============================================================
-- Script ini menghapus semua data pencairan dan anggota masuk
-- serta mereset tanggal cek terkait di tabel arsip_digital.
-- Tabel arsip_digital (daftar cabang) TIDAK terhapus.
--
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Dibuat: 2026-10-08
-- ============================================================

-- Langkah 1: Hapus detail dokumen Pencairan
DELETE FROM public.arsip_pencairan_detail;

-- Langkah 2: Hapus data Pencairan
DELETE FROM public.arsip_pencairan;

-- Langkah 3: Hapus detail dokumen Anggota Masuk
DELETE FROM public.arsip_anggota_masuk_detail;

-- Langkah 4: Hapus data Anggota Masuk
DELETE FROM public.arsip_anggota_masuk;

-- Langkah 5: Reset tanggal cek Pencairan & Anggota Masuk
--            di tabel arsip_digital menjadi NULL
UPDATE public.arsip_digital
SET
  tanggal_cek_pencairan      = NULL,
  tanggal_cek_anggota_masuk  = NULL,
  updated_at                 = NOW();

-- ============================================================
-- VERIFIKASI (jalankan setelah reset untuk memastikan kosong)
-- ============================================================
-- SELECT COUNT(*) AS sisa_pencairan       FROM public.arsip_pencairan;
-- SELECT COUNT(*) AS sisa_pencairan_detail FROM public.arsip_pencairan_detail;
-- SELECT COUNT(*) AS sisa_masuk           FROM public.arsip_anggota_masuk;
-- SELECT COUNT(*) AS sisa_masuk_detail    FROM public.arsip_anggota_masuk_detail;
-- SELECT kode_cabang, nama_cabang, tanggal_cek_pencairan, tanggal_cek_anggota_masuk
--   FROM public.arsip_digital ORDER BY nama_cabang;
