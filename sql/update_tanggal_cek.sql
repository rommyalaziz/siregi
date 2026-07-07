-- Jalankan script ini di SQL Editor pada dashboard Supabase Anda

-- 1. Tambahkan 3 kolom baru ke tabel arsip_digital
ALTER TABLE public.arsip_digital
ADD COLUMN IF NOT EXISTS tanggal_cek_anggota DATE,
ADD COLUMN IF NOT EXISTS tanggal_cek_pencairan DATE,
ADD COLUMN IF NOT EXISTS tanggal_cek_anggota_masuk DATE;

-- 2. Migrasikan data lama dari kolom tanggal_cek (opsional, agar data yang sudah ada tidak hilang)
UPDATE public.arsip_digital
SET 
  tanggal_cek_anggota = CASE WHEN arsip_digital.tanggal_cek IS NOT NULL THEN (arsip_digital.tanggal_cek::DATE) ELSE NULL END,
  tanggal_cek_pencairan = CASE WHEN arsip_digital.tanggal_cek IS NOT NULL THEN (arsip_digital.tanggal_cek::DATE) ELSE NULL END,
  tanggal_cek_anggota_masuk = CASE WHEN arsip_digital.tanggal_cek IS NOT NULL THEN (arsip_digital.tanggal_cek::DATE) ELSE NULL END
WHERE tanggal_cek IS NOT NULL;

-- 3. (Opsional) Jika Anda ingin menghapus kolom tanggal_cek lama agar tidak membingungkan, 
-- hapus komentar pada baris di bawah ini dan jalankan.
-- ALTER TABLE public.arsip_digital DROP COLUMN IF EXISTS tanggal_cek;
