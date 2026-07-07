-- Create arsip_anggota_masuk table
CREATE TABLE IF NOT EXISTS public.arsip_anggota_masuk (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arsip_id UUID REFERENCES public.arsip_digital(id) ON DELETE CASCADE,
    member INTEGER DEFAULT 0,
    lengkap INTEGER DEFAULT 0,
    kurang INTEGER DEFAULT 0,
    tidak_ditemukan INTEGER DEFAULT 0,
    tidak_aktif INTEGER DEFAULT 0,
    prosentase NUMERIC DEFAULT 0
);

-- Create arsip_anggota_masuk_detail table
CREATE TABLE IF NOT EXISTS public.arsip_anggota_masuk_detail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arsip_id UUID REFERENCES public.arsip_digital(id) ON DELETE CASCADE,
    kode_dokumen VARCHAR(50),
    nama_dokumen VARCHAR(255),
    jumlah INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.arsip_anggota_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arsip_anggota_masuk_detail ENABLE ROW LEVEL SECURITY;

-- Allow all access to all authenticated users (similar to general policies)
CREATE POLICY "Allow all access to authenticated users on arsip_anggota_masuk" ON public.arsip_anggota_masuk FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users on arsip_anggota_masuk_detail" ON public.arsip_anggota_masuk_detail FOR ALL TO authenticated USING (true) WITH CHECK (true);
