import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import './TableStyles.css';
import './ArsipDigital.css';

// ─── Types ────────────────────────────────────
interface CabangOption { id: string; nama_cabang: string; kode_cabang: string; }

const DEFAULT_ANGGOTA_DOCS = [
  { kode_dokumen: '01', nama_dokumen: 'KTP', jumlah: 0 },
  { kode_dokumen: '02', nama_dokumen: 'KK', jumlah: 0 },
  { kode_dokumen: '03', nama_dokumen: 'PPI', jumlah: 0 },
  { kode_dokumen: '04', nama_dokumen: 'Form UK', jumlah: 0 },
  { kode_dokumen: '05', nama_dokumen: 'Form Keanggotaan', jumlah: 0 },
  { kode_dokumen: '06', nama_dokumen: 'Form Pengajuan', jumlah: 0 },
  { kode_dokumen: '07', nama_dokumen: 'Form Akad', jumlah: 0 },
  { kode_dokumen: '08', nama_dokumen: 'Form Monitoring', jumlah: 0 },
];

const DEFAULT_PENCAIRAN_DOCS = [
  { kode_dokumen: '03', nama_dokumen: 'Form PPI', jumlah: 0 },
  { kode_dokumen: '06', nama_dokumen: 'Form Pengajuan', jumlah: 0 },
  { kode_dokumen: '07', nama_dokumen: 'Akad Pencairan', jumlah: 0 },
  { kode_dokumen: '08', nama_dokumen: 'Form Monitoring', jumlah: 0 },
  { kode_dokumen: '10', nama_dokumen: 'Form Lainnya', jumlah: 0 },
];

// ─── Component ────────────────────────────────
const ArsipDigitalForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [cabangOptions, setCabangOptions] = useState<CabangOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ── Form fields ──────────────────────────────
  const [selectedCabangId, setSelectedCabangId] = useState('');
  const [formKodeCabang, setFormKodeCabang]     = useState('');
  const [formNamaCabang, setFormNamaCabang]     = useState('');
  const [formTanggalCek, setFormTanggalCek]     = useState('');

  // Arsip Anggota
  const [member, setMember]                   = useState(0);
  const [lengkap, setLengkap]                 = useState(0);
  const [kurang, setKurang]                   = useState(0);
  const [tidakDitemukan, setTidakDitemukan]   = useState(0);
  const [tidakAktif, setTidakAktif]           = useState(0);
  const [prosentase, setProsentase]           = useState<number | string>(0);
  const [toleransiKk, setToleransiKk]         = useState<number | string>(85.50);
  const [anggotaDocs, setAnggotaDocs]         = useState(DEFAULT_ANGGOTA_DOCS.map(d => ({ ...d })));

  // Arsip Pencairan
  const [periode, setPeriode]                               = useState('');
  const [totalPinjaman, setTotalPinjaman]                   = useState(0);
  const [arsipLengkap, setArsipLengkap]                     = useState(0);
  const [namaFileTidakSesuai, setNamaFileTidakSesuai]       = useState(0);
  const [fileTidakLengkap, setFileTidakLengkap]             = useState(0);
  const [pencairanDocs, setPencairanDocs]                   = useState(DEFAULT_PENCAIRAN_DOCS.map(d => ({ ...d })));

  // ── Computed pencairan pct ─────────────────
  const pencairanPct = totalPinjaman > 0
    ? ((arsipLengkap / totalPinjaman) * 100).toFixed(2)
    : '0.00';

  // ── Load options & existing data ─────────────
  useEffect(() => {
    const loadAll = async () => {
      // Load cabang options
      try {
        const { data: cb, error: cbErr } = await supabase
          .from('cabang')
          .select('id, nama_cabang, kode_cabang')
          .order('nama_cabang');
        if (cbErr) throw cbErr;
        setCabangOptions(cb || []);
      } catch (err) {
        console.error('Error fetching cabang:', err);
      }

      // If editing, load existing data
      if (isEdit && id) {
        try {
          const { data: row, error } = await supabase
            .from('arsip_digital')
            .select(`*, arsip_anggota(*), arsip_anggota_detail(*), arsip_pencairan(*), arsip_pencairan_detail(*)`)
            .eq('id', id)
            .single();
          if (error) throw error;

          setFormKodeCabang(row.kode_cabang);
          setFormNamaCabang(row.nama_cabang);
          setFormTanggalCek(row.tanggal_cek || '');

          const ang = row.arsip_anggota?.[0];
          if (ang) {
            setMember(ang.member); setLengkap(ang.lengkap);
            setKurang(ang.kurang); setTidakDitemukan(ang.tidak_ditemukan);
            setTidakAktif(ang.tidak_aktif); setProsentase(ang.prosentase);
            setToleransiKk(ang.toleransi_kk);
          }

          setAnggotaDocs(DEFAULT_ANGGOTA_DOCS.map(def => {
            const ex = row.arsip_anggota_detail?.find((d: any) => d.kode_dokumen === def.kode_dokumen);
            return { ...def, jumlah: ex?.jumlah || 0 };
          }));

          const pen = row.arsip_pencairan?.[0];
          if (pen) {
            setPeriode(pen.periode || '');
            setTotalPinjaman(pen.total_pinjaman);
            setArsipLengkap(pen.arsip_lengkap);
            setNamaFileTidakSesuai(pen.nama_file_tidak_sesuai);
            setFileTidakLengkap(pen.file_tidak_lengkap);
          }

          setPencairanDocs(DEFAULT_PENCAIRAN_DOCS.map(def => {
            const ex = row.arsip_pencairan_detail?.find((d: any) => d.kode_dokumen === def.kode_dokumen);
            return { ...def, jumlah: ex?.jumlah || 0 };
          }));
        } catch (err) {
          setMessage({ type: 'error', text: 'Gagal memuat data.' });
        } finally { setLoading(false); }
      } else { setLoading(false); }
    };
    loadAll();
  }, []);

  // Auto-fill when cabang selected — kode_cabang is fetched from database
  const handleCabangSelect = (cabangId: string) => {
    const sel = cabangOptions.find(c => c.id === cabangId);
    setSelectedCabangId(cabangId);
    if (sel) {
      setFormNamaCabang(sel.nama_cabang);
      // Kode cabang = kolom kode_cabang dari tabel (3-digit angka)
      setFormKodeCabang(sel.kode_cabang || '');
    } else {
      setFormNamaCabang('');
      setFormKodeCabang('');
    }
  };

  // Update doc jumlah
  const updateAnggotaDoc = (idx: number, val: number) => {
    const updated = [...anggotaDocs];
    updated[idx] = { ...updated[idx], jumlah: val };
    setAnggotaDocs(updated);
  };
  const updatePencairanDoc = (idx: number, val: number) => {
    const updated = [...pencairanDocs];
    updated[idx] = { ...updated[idx], jumlah: val };
    setPencairanDocs(updated);
  };

  // ── Save ─────────────────────────────────────
  const handleSave = async () => {
    if (!formKodeCabang || !formNamaCabang) {
      setMessage({ type: 'error', text: 'Kode dan Nama Cabang wajib diisi!' });
      return;
    }
    setSaving(true);
    try {
      let arsipId: string;
      if (isEdit && id) {
        const { error } = await supabase
          .from('arsip_digital')
          .update({ kode_cabang: formKodeCabang, nama_cabang: formNamaCabang, tanggal_cek: formTanggalCek || null, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        arsipId = id;
        await Promise.all([
          supabase.from('arsip_anggota').delete().eq('arsip_id', arsipId),
          supabase.from('arsip_anggota_detail').delete().eq('arsip_id', arsipId),
          supabase.from('arsip_pencairan').delete().eq('arsip_id', arsipId),
          supabase.from('arsip_pencairan_detail').delete().eq('arsip_id', arsipId),
        ]);
      } else {
        const { data: newRow, error } = await supabase
          .from('arsip_digital')
          .insert([{ kode_cabang: formKodeCabang, nama_cabang: formNamaCabang, tanggal_cek: formTanggalCek || null }])
          .select()
          .single();
        if (error) throw error;
        arsipId = newRow.id;
      }

      await Promise.all([
        supabase.from('arsip_anggota').insert([{
          arsip_id: arsipId, member, lengkap, kurang,
          tidak_ditemukan: tidakDitemukan, tidak_aktif: tidakAktif,
          prosentase: Number(prosentase), toleransi_kk: Number(toleransiKk),
        }]),
        supabase.from('arsip_anggota_detail').insert(
          anggotaDocs.map(d => ({ arsip_id: arsipId, kode_dokumen: d.kode_dokumen, nama_dokumen: d.nama_dokumen, jumlah: d.jumlah }))
        ),
        supabase.from('arsip_pencairan').insert([{
          arsip_id: arsipId, periode, total_pinjaman: totalPinjaman,
          arsip_lengkap: arsipLengkap, nama_file_tidak_sesuai: namaFileTidakSesuai,
          file_tidak_lengkap: fileTidakLengkap,
        }]),
        supabase.from('arsip_pencairan_detail').insert(
          pencairanDocs.map(d => ({ arsip_id: arsipId, kode_dokumen: d.kode_dokumen, nama_dokumen: d.nama_dokumen, jumlah: d.jumlah }))
        ),
      ]);

      navigate(-1);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan data.' });
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: 'var(--color-text-muted)' }}>
      <Loader2 size={20} className="animate-spin" />
      <span>Memuat data...</span>
    </div>
  );

  const numInput = (val: number, onChange: (n: number) => void, placeholder = '0') => (
    <input
      type="number" min="0" value={val} placeholder={placeholder}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
    />
  );

  return (
    <div className="arsip-container page-container">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '0 10px', height: '34px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={14} />
            <span>Kembali</span>
          </button>
          <div>
            <h1>{isEdit ? 'Edit Data Arsip' : 'Tambah Data Arsip'}</h1>
            <p>Isi data kelengkapan arsip cabang</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Simpan Data</span>
          </button>
        </div>
      </div>

      {/* Notification */}
      {message.text && (
        <div className={`arsip-notification ${message.type}`}>{message.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* ── SECTION: Info Cabang ── */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <div className="arsip-form-section">
            <div className="arsip-form-section-title">Informasi Cabang</div>
            <div className="arsip-form-grid three">
              <div className="arsip-form-group">
                <label>Pilih dari Daftar Cabang</label>
                <select value={selectedCabangId} onChange={e => handleCabangSelect(e.target.value)}>
                  <option value="">-- Pilih Cabang --</option>
                  {cabangOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.nama_cabang}</option>
                  ))}
                </select>
              </div>
              <div className="arsip-form-group">
                <label>Kode Cabang *</label>
                <input type="text" value={formKodeCabang} onChange={e => setFormKodeCabang(e.target.value)} placeholder="Contoh: 001" readOnly style={{ background: 'var(--color-bg-subtle)', cursor: 'not-allowed' }} />
              </div>
              <div className="arsip-form-group">
                <label>Tanggal Cek</label>
                <input type="date" value={formTanggalCek} onChange={e => setFormTanggalCek(e.target.value)} />
              </div>
            </div>
            <div className="arsip-form-group">
              <label>Nama Cabang *</label>
              <input type="text" value={formNamaCabang} onChange={e => setFormNamaCabang(e.target.value)} placeholder="Nama cabang (otomatis terisi jika pilih dari daftar)" readOnly style={{ background: 'var(--color-bg-subtle)', cursor: 'not-allowed' }} />
            </div>
          </div>
        </Card>

        {/* ── SECTION: Arsip Anggota ── */}
        <Card>
          <div className="arsip-form-section">
            <div className="arsip-form-section-title">Arsip Data Anggota</div>
            <div className="arsip-form-grid">
              <div className="arsip-form-group">
                <label>Member</label>
                {numInput(member, setMember)}
              </div>
              <div className="arsip-form-group">
                <label>Lengkap</label>
                {numInput(lengkap, setLengkap)}
              </div>
              <div className="arsip-form-group">
                <label>Kurang</label>
                {numInput(kurang, setKurang)}
              </div>
              <div className="arsip-form-group">
                <label>Tidak Ditemukan</label>
                {numInput(tidakDitemukan, setTidakDitemukan)}
              </div>
              <div className="arsip-form-group">
                <label>Tidak Aktif</label>
                {numInput(tidakAktif, setTidakAktif)}
              </div>
              <div className="arsip-form-group">
                <label>Prosentase (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={prosentase}
                  onChange={e => setProsentase(e.target.value)} placeholder="31.85" />
              </div>
              <div className="arsip-form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Toleransi KK 2025 (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={toleransiKk}
                  onChange={e => setToleransiKk(e.target.value)} placeholder="85.50" />
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Detail Dokumen Anggota (Jumlah Kurang)
            </div>
            <table className="arsip-doc-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Dokumen</th>
                  <th style={{ textAlign: 'right' }}>Jml Kurang</th>
                </tr>
              </thead>
              <tbody>
                {anggotaDocs.map((d, i) => (
                  <tr key={d.kode_dokumen}>
                    <td className="mono">{d.kode_dokumen.padStart(2, '0')}</td>
                    <td>{d.nama_dokumen}</td>
                    <td>
                      <input type="number" min="0" value={d.jumlah}
                        onChange={e => updateAnggotaDoc(i, parseInt(e.target.value) || 0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── SECTION: Arsip Pencairan ── */}
        <Card>
          <div className="arsip-form-section">
            <div className="arsip-form-section-title">Arsip Pencairan</div>

            {/* Auto-computed preview */}
            <div style={{ background: 'var(--color-badge-blue)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Prosentase (otomatis): </span>
              <strong style={{ color: 'var(--color-icon-blue)', fontSize: '16px' }}>{pencairanPct}%</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginLeft: '6px' }}>
                = {arsipLengkap} / {totalPinjaman} × 100
              </span>
            </div>

            <div className="arsip-form-group" style={{ marginBottom: '12px' }}>
              <label>Periode</label>
              <input type="text" value={periode} onChange={e => setPeriode(e.target.value)}
                placeholder="Contoh: 01-01-2025 sd 10-06-2026" />
            </div>
            <div className="arsip-form-grid">
              <div className="arsip-form-group">
                <label>Total Data Pinjaman</label>
                {numInput(totalPinjaman, setTotalPinjaman)}
              </div>
              <div className="arsip-form-group">
                <label>Arsip Lengkap</label>
                {numInput(arsipLengkap, setArsipLengkap)}
              </div>
              <div className="arsip-form-group">
                <label>Nama File Tidak Sesuai</label>
                {numInput(namaFileTidakSesuai, setNamaFileTidakSesuai)}
              </div>
              <div className="arsip-form-group">
                <label>File Tidak Lengkap</label>
                {numInput(fileTidakLengkap, setFileTidakLengkap)}
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Detail Dokumen Pencairan (Jumlah Kurang File)
            </div>
            <table className="arsip-doc-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Dokumen</th>
                  <th style={{ textAlign: 'right' }}>Jml Kurang File</th>
                </tr>
              </thead>
              <tbody>
                {pencairanDocs.map((d, i) => (
                  <tr key={d.kode_dokumen}>
                    <td className="mono">{d.kode_dokumen.padStart(2, '0')}</td>
                    <td>{d.nama_dokumen}</td>
                    <td>
                      <input type="number" min="0" value={d.jumlah}
                        onChange={e => updatePencairanDoc(i, parseInt(e.target.value) || 0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>{/* end grid */}

      {/* Bottom save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={saving}>Batal</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Simpan Data</span>
        </button>
      </div>
    </div>
  );
};

export default ArsipDigitalForm;
