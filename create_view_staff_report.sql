-- SQL View untuk perhitungan KPI otomatis sesuai parameter MSA
-- UPDATE: Versi terbaru dengan kategori Lain-lain (9 kategori, total 100 poin)
-- Jalankan ini di SQL Editor Supabase Anda

DROP VIEW IF EXISTS v_staff_report;

CREATE VIEW v_staff_report AS
SELECT 
  *,
  -- 1. Release Voucher (Max 10)
  CASE 
    WHEN release_voucher = 0 THEN 10 
    WHEN release_voucher = 1 THEN 8
    WHEN release_voucher BETWEEN 2 AND 3 THEN 7 
    WHEN release_voucher BETWEEN 4 AND 5 THEN 6
    WHEN release_voucher BETWEEN 6 AND 7 THEN 5 
    WHEN release_voucher BETWEEN 8 AND 10 THEN 4
    WHEN release_voucher BETWEEN 11 AND 13 THEN 3 
    WHEN release_voucher BETWEEN 14 AND 16 THEN 2
    WHEN release_voucher BETWEEN 17 AND 20 THEN 1 
    ELSE 0 
  END as p_rv,
  
  -- 2. Unapprove Pengajuan (Max 10)
  CASE 
    WHEN unapprove_pengajuan = 0 THEN 10 
    WHEN unapprove_pengajuan = 1 THEN 7
    WHEN unapprove_pengajuan BETWEEN 2 AND 3 THEN 5 
    WHEN unapprove_pengajuan BETWEEN 4 AND 5 THEN 3
    WHEN unapprove_pengajuan BETWEEN 6 AND 7 THEN 2 
    WHEN unapprove_pengajuan BETWEEN 8 AND 10 THEN 1 
    ELSE 0 
  END as p_up,
  
  -- 3. Recalculate Delinquency (Max 10)
  CASE 
    WHEN recalculate_delinquency = 0 THEN 10 
    WHEN recalculate_delinquency = 1 THEN 8
    WHEN recalculate_delinquency BETWEEN 2 AND 3 THEN 7 
    WHEN recalculate_delinquency BETWEEN 4 AND 5 THEN 6
    WHEN recalculate_delinquency BETWEEN 6 AND 7 THEN 4 
    WHEN recalculate_delinquency BETWEEN 8 AND 10 THEN 3
    WHEN recalculate_delinquency BETWEEN 11 AND 13 THEN 1 
    ELSE 0 
  END as p_rd,
  
  -- 4. Transfer Pencairan (Max 15)
  CASE 
    WHEN transfer_pencairan = 0 THEN 15 
    WHEN transfer_pencairan = 1 THEN 10
    WHEN transfer_pencairan BETWEEN 2 AND 3 THEN 5 
    WHEN transfer_pencairan BETWEEN 4 AND 5 THEN 1 
    ELSE 0 
  END as p_tp,
  
  -- 5. Salah Generate (Max 10)
  CASE 
    WHEN salah_generate = 0 THEN 10 
    WHEN salah_generate = 1 THEN 11
    WHEN salah_generate BETWEEN 2 AND 3 THEN 9 
    WHEN salah_generate BETWEEN 4 AND 5 THEN 7
    WHEN salah_generate BETWEEN 6 AND 7 THEN 5 
    ELSE 0 
  END as p_sg,
  
  -- 6. PPI Not Entry (Max 10)
  CASE 
    WHEN ppi_not_entry = 0 THEN 10 
    WHEN ppi_not_entry = 1 THEN 8
    WHEN ppi_not_entry BETWEEN 2 AND 3 THEN 7 
    WHEN ppi_not_entry BETWEEN 4 AND 5 THEN 7
    WHEN ppi_not_entry BETWEEN 6 AND 7 THEN 5 
    WHEN ppi_not_entry BETWEEN 8 AND 10 THEN 5
    WHEN ppi_not_entry BETWEEN 11 AND 13 THEN 3 
    WHEN ppi_not_entry BETWEEN 14 AND 16 THEN 2
    WHEN ppi_not_entry BETWEEN 17 AND 20 THEN 1 
    ELSE 0 
  END as p_ppi,
  
  -- 7. Validasi (Max 10)
  CASE 
    WHEN validasi = 0 THEN 10 
    WHEN validasi = 1 THEN 8
    WHEN validasi BETWEEN 2 AND 3 THEN 7 
    WHEN validasi BETWEEN 4 AND 5 THEN 6
    WHEN validasi BETWEEN 6 AND 7 THEN 5 
    WHEN validasi BETWEEN 8 AND 10 THEN 4
    WHEN validasi BETWEEN 11 AND 13 THEN 3 
    WHEN validasi BETWEEN 14 AND 16 THEN 2
    WHEN validasi BETWEEN 17 AND 20 THEN 1 
    ELSE 0 
  END as p_val,
  
  -- 8. Tiket Perbaikan (Max 15)
  CASE 
    WHEN tiket_perbaikan = 0 THEN 15 
    WHEN tiket_perbaikan = 1 THEN 5
    WHEN tiket_perbaikan BETWEEN 2 AND 3 THEN 2 
    WHEN tiket_perbaikan BETWEEN 4 AND 5 THEN 1 
    ELSE 0 
  END as p_tpk,

  -- 9. Lain-lain (Base 10, adjustment)
  (10 + lain_lain) as p_ll

FROM staff_progress;
