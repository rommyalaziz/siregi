import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Users, Banknote, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TableStyles.css';
import './ArsipDigital.css';

type FormType = 'anggota' | 'pencairan' | 'anggota-masuk';
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
  { kode_dokumen: '09', nama_dokumen: 'Form Simpanan Hari Raya', jumlah: 0 },
  { kode_dokumen: '10', nama_dokumen: 'Form Lainnya', jumlah: 0 },
  { kode_dokumen: '11', nama_dokumen: 'Form Cuti', jumlah: 0 },
];
const DEFAULT_ANGGOTA_MASUK_DOCS = [
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

/* ─── Compact shared styles ─────────────────── */
const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '14px 16px',
};
const sectionTitle = (color: string): React.CSSProperties => ({
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.5px', color,
  borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', marginBottom: '10px',
});
const label: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '2px',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px',
  height: '30px', fontSize: '12px', fontFamily: 'inherit',
  background: '#fff', color: '#1e293b', outline: 'none', width: '100%',
};
const readonlyStyle: React.CSSProperties = {
  ...inputStyle, background: '#f8fafc', cursor: 'not-allowed', color: '#64748b',
};
const numInputStyle: React.CSSProperties = { ...inputStyle, width: '100%' };

/* --- Reusable Components (Extracted to prevent re-mounting and allow partial updates) --- */
const Inp = ({ val, onChange, type = 'number', placeholder = '0', readonly = false, metaColor = '#6366f1' }: { val: string | number; onChange?: (v: string) => void; type?: string; placeholder?: string; readonly?: boolean; metaColor?: string }) => (
  <input type={type} value={val} placeholder={placeholder} readOnly={readonly}
    style={readonly ? readonlyStyle : inputStyle}
    onChange={e => onChange?.(e.target.value)}
    onFocus={e => !readonly && (e.currentTarget.style.borderColor = metaColor)}
    onBlur={e => !readonly && (e.currentTarget.style.borderColor = '#e2e8f0')}
  />
);

const DocTableRow = ({ d, i, onUpdate }: { d: any, i: number, onUpdate: (i: number, v: any) => void }) => {
  const [localVal, setLocalVal] = useState<number | string>(d.jumlah);
  
  useEffect(() => {
    setLocalVal(d.jumlah);
  }, [d.jumlah]);

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#475569' }}>{d.kode_dokumen.padStart(2, '0')}</td>
      <td style={{ padding: '4px 8px', color: '#334155', fontSize: '12px' }}>{d.nama_dokumen}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
        <input type="number" min="0" value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => {
            const parsed = localVal === '' ? '' : parseInt(localVal as string, 10);
            setLocalVal(parsed);
            onUpdate(i, parsed);
          }}
          style={{ border: '1px solid #e2e8f0', borderRadius: '5px', padding: '2px 6px', width: '72px', fontFamily: 'inherit', fontSize: '12px', background: '#fff', color: '#1e293b', outline: 'none', height: '24px', textAlign: 'right' }}
        />
      </td>
    </tr>
  );
};

const DocTable = ({ docs, onUpdate, footerNote }: { docs: any[]; onUpdate: (i: number, v: any) => void; footerNote?: string }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
    <thead>
      <tr style={{ background: '#f8fafc' }}>
        <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e5e7eb', width: '48px' }}>Kode</th>
        <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e5e7eb' }}>Nama Dokumen</th>
        <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e5e7eb', width: '90px' }}>Jml Kurang</th>
      </tr>
    </thead>
    <tbody>
      {docs.map((d, i) => (
        <DocTableRow key={d.kode_dokumen} d={d} i={i} onUpdate={onUpdate} />
      ))}
    </tbody>
    {footerNote && (
      <tfoot>
        <tr><td colSpan={3} style={{ padding: '4px 8px', fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>{footerNote}</td></tr>
      </tfoot>
    )}
  </table>
);

const NumField = ({ lbl, val, set, metaColor }: { lbl: string; val: number | string; set: (n: any) => void; metaColor: string }) => {
  const [localVal, setLocalVal] = useState<number | string>(val);
  
  useEffect(() => {
    setLocalVal(val);
  }, [val]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={label}>{lbl}</div>
      <input type="number" min="0" value={localVal} style={numInputStyle}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={e => {
          e.currentTarget.style.borderColor = '#e2e8f0';
          const parsed = localVal === '' ? '' : parseInt(localVal as string, 10);
          setLocalVal(parsed);
          set(parsed);
        }}
        onFocus={e => e.currentTarget.style.borderColor = metaColor}
      />
    </div>
  );
};

const ArsipDigitalForm = () => {
  const navigate = useNavigate();
  const { id, type } = useParams<{ id?: string; type?: string }>();
  const formType = (type as FormType) || 'anggota';
  const isEdit = Boolean(id);

  const META: Record<FormType, { label: string; color: string; icon: React.ReactNode }> = {
    'anggota':       { label: 'Arsip Data Anggota',  color: '#6366f1', icon: <Users size={16} /> },
    'pencairan':     { label: 'Arsip Pencairan',      color: '#0ea5e9', icon: <Banknote size={16} /> },
    'anggota-masuk': { label: 'Arsip Anggota Masuk',  color: '#8b5cf6', icon: <UserPlus size={16} /> },
  };
  const meta = META[formType];

  const [cabangOptions, setCabangOptions] = useState<CabangOption[]>([]);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState({ type: '', text: '' });

  const [selectedCabangId, setSelectedCabangId] = useState('');
  const [kode, setKode]         = useState('');
  const [nama, setNama]         = useState('');
  const [tglCek, setTglCek]     = useState('');

  /* anggota */
  const [member, setMember] = useState<number | string>(0);
  const [lengkap, setLengkap] = useState<number | string>(0);
  const [kurang, setKurang] = useState<number | string>(0);
  const [tidakDitemukan, setTidakDitemukan] = useState<number | string>(0);
  const [tidakAktif, setTidakAktif] = useState<number | string>(0);
  const [prosentase, setProsentase] = useState<string | number>(0);
  const [anggotaDocs, setAnggotaDocs] = useState(DEFAULT_ANGGOTA_DOCS.map(d => ({ ...d })));

  /* anggota masuk */
  const [mMasuk, setMMasuk] = useState<number | string>(0);  // Anggota Masuk
  const [lMasuk, setLMasuk] = useState<number | string>(0);
  const [kMasuk, setKMasuk] = useState<number | string>(0);
  const [tdMasuk, setTdMasuk] = useState<number | string>(0);
  const [periodeAMFrom, setPeriodeAMFrom] = useState('');
  const [periodeAMTo, setPeriodeAMTo] = useState('');
  const [masukDocs, setMasukDocs] = useState(DEFAULT_ANGGOTA_MASUK_DOCS.map(d => ({ ...d })));
  // Prosentase otomatis: Lengkap / Anggota Masuk × 100
  const pctMasuk = Number(mMasuk) > 0 ? ((Number(lMasuk) / Number(mMasuk)) * 100).toFixed(2) : '0.00';
  // Format periode: "01 Jan - 30 Jun 2026"
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const formatDateLabel = (d: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS_ID[dt.getMonth()]} ${dt.getFullYear()}`;
  };
  const periodeAMLabel = periodeAMFrom && periodeAMTo
    ? `${formatDateLabel(periodeAMFrom)} - ${formatDateLabel(periodeAMTo)}`
    : periodeAMFrom ? formatDateLabel(periodeAMFrom)
    : '';

  /* pencairan */
  const [periodePencairanFrom, setPeriodePencairanFrom] = useState('');
  const [periodePencairanTo, setPeriodePencairanTo] = useState('');
  const periodePencairanLabel = periodePencairanFrom && periodePencairanTo
    ? `${formatDateLabel(periodePencairanFrom)} - ${formatDateLabel(periodePencairanTo)}`
    : periodePencairanFrom ? formatDateLabel(periodePencairanFrom)
    : '';
  const [totalPinjaman, setTotalPinjaman] = useState<number | string>(0);
  const [arsipLengkap, setArsipLengkap] = useState<number | string>(0);
  const [namaFileTS, setNamaFileTS] = useState<number | string>(0);
  const [fileTL, setFileTL] = useState<number | string>(0);
  const [pencairanDocs, setPencairanDocs] = useState(DEFAULT_PENCAIRAN_DOCS.map(d => ({ ...d })));
  const pencairanPct = Number(totalPinjaman) > 0 ? ((Number(arsipLengkap) / Number(totalPinjaman)) * 100).toFixed(2) : '0.00';

  useEffect(() => {
    const load = async () => {
      const { data: cb } = await supabase.from('cabang').select('id,nama_cabang,kode_cabang').order('nama_cabang');
      setCabangOptions(cb || []);
      if (isEdit && id) {
        try {
          const { data: row, error } = await supabase
            .from('arsip_digital')
            .select('*, arsip_anggota(*), arsip_anggota_detail(*), arsip_pencairan(*), arsip_pencairan_detail(*), arsip_anggota_masuk(*), arsip_anggota_masuk_detail(*)')
            .eq('id', id).single();
          if (error) throw error;
          setKode(row.kode_cabang); setNama(row.nama_cabang);
          if (formType === 'anggota') setTglCek(row.tanggal_cek_anggota || row.tanggal_cek || '');
          else if (formType === 'pencairan') setTglCek(row.tanggal_cek_pencairan || row.tanggal_cek || '');
          else if (formType === 'anggota-masuk') setTglCek(row.tanggal_cek_anggota_masuk || row.tanggal_cek || '');
          else setTglCek(row.tanggal_cek || '');
          if (formType === 'anggota') {
            const a = row.arsip_anggota?.[0];
            if (a) { setMember(a.member); setLengkap(a.lengkap); setKurang(a.kurang); setTidakDitemukan(a.tidak_ditemukan); setTidakAktif(a.tidak_aktif); setProsentase(a.prosentase); }
            setAnggotaDocs(DEFAULT_ANGGOTA_DOCS.map(def => { const ex = row.arsip_anggota_detail?.find((d: any) => d.kode_dokumen === def.kode_dokumen); return { ...def, jumlah: ex?.jumlah || 0 }; }));
          }
          if (formType === 'anggota-masuk') {
            const am = row.arsip_anggota_masuk?.[0];
            if (am) {
              setMMasuk(am.member); setLMasuk(am.lengkap); setKMasuk(am.kurang); setTdMasuk(am.tidak_ditemukan);
              // Load periode: simpan sebagai "YYYY-MM-DD sd YYYY-MM-DD"
              if (am.periode) {
                const parts = am.periode.split(' sd ');
                if (parts.length === 2) { setPeriodeAMFrom(parts[0]); setPeriodeAMTo(parts[1]); }
              }
            }
            setMasukDocs(DEFAULT_ANGGOTA_MASUK_DOCS.map(def => { const ex = row.arsip_anggota_masuk_detail?.find((d: any) => d.kode_dokumen === def.kode_dokumen); return { ...def, jumlah: ex?.jumlah || 0 }; }));
          }
          if (formType === 'pencairan') {
            const p = row.arsip_pencairan?.[0];
            if (p) {
              setTotalPinjaman(p.total_pinjaman); setArsipLengkap(p.arsip_lengkap); setNamaFileTS(p.nama_file_tidak_sesuai); setFileTL(p.file_tidak_lengkap);
              if (p.periode) {
                const parts = p.periode.split(' sd ');
                if (parts.length === 2) { setPeriodePencairanFrom(parts[0]); setPeriodePencairanTo(parts[1]); }
              }
            }
            setPencairanDocs(DEFAULT_PENCAIRAN_DOCS.map(def => { const ex = row.arsip_pencairan_detail?.find((d: any) => d.kode_dokumen === def.kode_dokumen); return { ...def, jumlah: ex?.jumlah || 0 }; }));
          }
        } catch { setMessage({ type: 'error', text: 'Gagal memuat data.' }); }
        finally { setLoading(false); }
      } else { setLoading(false); }
    };
    load();
  }, []);

  const pickCabang = (cabangId: string) => {
    const sel = cabangOptions.find(c => c.id === cabangId);
    setSelectedCabangId(cabangId);
    setNama(sel?.nama_cabang || ''); setKode(sel?.kode_cabang || '');
  };

  const updDoc = (arr: any[], setArr: (v: any[]) => void) => (i: number, v: any) => {
    const u = [...arr]; u[i] = { ...u[i], jumlah: v }; setArr(u);
  };

  const handleSave = async () => {
    if (!kode || !nama) { setMessage({ type: 'error', text: 'Pilih cabang terlebih dahulu!' }); return; }
    setSaving(true);
    try {
      let arsipId: string;
      
      const arsipPayload: any = { kode_cabang: kode, nama_cabang: nama };
      if (formType === 'anggota') arsipPayload.tanggal_cek_anggota = tglCek || null;
      if (formType === 'pencairan') arsipPayload.tanggal_cek_pencairan = tglCek || null;
      if (formType === 'anggota-masuk') arsipPayload.tanggal_cek_anggota_masuk = tglCek || null;

      if (isEdit && id) {
        arsipPayload.updated_at = new Date().toISOString();
        const { error } = await supabase.from('arsip_digital').update(arsipPayload).eq('id', id);
        if (error) throw error;
        arsipId = id;
        
        if (formType === 'anggota') {
          const [d1, d2] = await Promise.all([supabase.from('arsip_anggota').delete().eq('arsip_id', arsipId), supabase.from('arsip_anggota_detail').delete().eq('arsip_id', arsipId)]);
          if (d1.error) throw d1.error; if (d2.error) throw d2.error;
        }
        if (formType === 'anggota-masuk') {
          const [d1, d2] = await Promise.all([supabase.from('arsip_anggota_masuk').delete().eq('arsip_id', arsipId), supabase.from('arsip_anggota_masuk_detail').delete().eq('arsip_id', arsipId)]);
          if (d1.error) throw d1.error; if (d2.error) throw d2.error;
        }
        if (formType === 'pencairan') {
          const [d1, d2] = await Promise.all([supabase.from('arsip_pencairan').delete().eq('arsip_id', arsipId), supabase.from('arsip_pencairan_detail').delete().eq('arsip_id', arsipId)]);
          if (d1.error) throw d1.error; if (d2.error) throw d2.error;
        }
      } else {
        const { data: nr, error } = await supabase.from('arsip_digital').insert([arsipPayload]).select().single();
        if (error) throw error;
        arsipId = nr.id;
      }
      if (formType === 'anggota') {
        const [r1, r2] = await Promise.all([
          supabase.from('arsip_anggota').insert([{ arsip_id: arsipId, member: Number(member)||0, lengkap: Number(lengkap)||0, kurang: Number(kurang)||0, tidak_ditemukan: Number(tidakDitemukan)||0, tidak_aktif: Number(tidakAktif)||0, prosentase: Number(prosentase)||0, toleransi_kk: 0 }]),
          supabase.from('arsip_anggota_detail').insert(anggotaDocs.map(d => ({ arsip_id: arsipId, kode_dokumen: d.kode_dokumen, nama_dokumen: d.nama_dokumen, jumlah: Number(d.jumlah)||0 }))),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
      }
      if (formType === 'anggota-masuk') {
        const periodeAMVal = periodeAMFrom && periodeAMTo ? `${periodeAMFrom} sd ${periodeAMTo}` : (periodeAMFrom || '');
        const [r1, r2] = await Promise.all([
          supabase.from('arsip_anggota_masuk').insert([{ arsip_id: arsipId, periode: periodeAMVal, member: Number(mMasuk)||0, lengkap: Number(lMasuk)||0, kurang: Number(kMasuk)||0, tidak_ditemukan: Number(tdMasuk)||0, prosentase: Number(pctMasuk)||0 }]),
          supabase.from('arsip_anggota_masuk_detail').insert(masukDocs.map(d => ({ arsip_id: arsipId, kode_dokumen: d.kode_dokumen, nama_dokumen: d.nama_dokumen, jumlah: Number(d.jumlah)||0 }))),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
      }
      if (formType === 'pencairan') {
        const periodePenVal = periodePencairanFrom && periodePencairanTo ? `${periodePencairanFrom} sd ${periodePencairanTo}` : (periodePencairanFrom || '');
        const [r1, r2] = await Promise.all([
          supabase.from('arsip_pencairan').insert([{ arsip_id: arsipId, periode: periodePenVal, total_pinjaman: Number(totalPinjaman)||0, arsip_lengkap: Number(arsipLengkap)||0, nama_file_tidak_sesuai: Number(namaFileTS)||0, file_tidak_lengkap: Number(fileTL)||0 }]),
          supabase.from('arsip_pencairan_detail').insert(pencairanDocs.map(d => ({ arsip_id: arsipId, kode_dokumen: d.kode_dokumen, nama_dokumen: d.nama_dokumen, jumlah: Number(d.jumlah)||0 }))),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
      }
      navigate(-1);
    } catch (err: any) {
      console.error("Save Error:", err);
      const errMsg = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setMessage({ type: 'error', text: `Gagal menyimpan: ${errMsg}` });
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '10px', color: '#94a3b8' }}>
      <Loader2 size={18} className="animate-spin" /><span style={{ fontSize: '13px' }}>Memuat data...</span>
    </div>
  );

  /* ── Reusable components removed to top level ── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '960px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
            <ArrowLeft size={13} />Kembali
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color }}>{meta.icon}</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{isEdit ? 'Edit' : 'Tambah'} — {meta.label}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1 }}>Data kelengkapan arsip cabang</div>
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: meta.color, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Simpan
        </button>
      </div>

      {/* ── Notification ── */}
      {message.text && (
        <div style={{ padding: '8px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#b91c1c' : '#15803d', border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
          {message.text}
        </div>
      )}

      {/* ── 2-column layout: Informasi Cabang | Data Arsip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '10px', alignItems: 'start' }}>

        {/* LEFT — Informasi Cabang */}
        <div style={panel}>
          <div style={sectionTitle('#475569')}>Informasi Cabang</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={label}>Pilih Cabang</div>
              <select value={selectedCabangId} onChange={e => pickCabang(e.target.value)}
                style={{ ...inputStyle, height: '30px' }}
                onFocus={e => e.currentTarget.style.borderColor = meta.color}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                <option value="">-- Pilih --</option>
                {cabangOptions.map(c => <option key={c.id} value={c.id}>{c.nama_cabang}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '80px' }}>
                <div style={label}>Kode</div>
                <Inp val={kode} readonly metaColor={meta.color} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <div style={label}>Tanggal Cek</div>
                <Inp val={tglCek} onChange={setTglCek} type="date" placeholder="" metaColor={meta.color} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={label}>Nama Cabang</div>
              <Inp val={nama} readonly metaColor={meta.color} />
            </div>
          </div>
        </div>

        {/* RIGHT — Data Arsip (sesuai type) */}
        <div style={panel}>

          {/* === ANGGOTA === */}
          {formType === 'anggota' && (<>
            <div style={sectionTitle(meta.color)}>Arsip Data Anggota</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '4px' }}>
              <NumField lbl="Member" val={member} set={setMember} metaColor={meta.color} />
              <NumField lbl="Lengkap" val={lengkap} set={setLengkap} metaColor={meta.color} />
              <NumField lbl="Kurang" val={kurang} set={setKurang} metaColor={meta.color} />
              <NumField lbl="Tdk Ditemukan" val={tidakDitemukan} set={setTidakDitemukan} metaColor={meta.color} />
              <NumField lbl="Tdk Aktif" val={tidakAktif} set={setTidakAktif} metaColor={meta.color} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={label}>Prosentase (%)</div>
                <input type="number" min="0" max="100" step="0.01" value={prosentase} placeholder="0.00"
                  style={numInputStyle}
                  onChange={e => setProsentase(e.target.value)}
                  onFocus={e => e.currentTarget.style.borderColor = meta.color}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '8px 0 2px' }}>Detail Dokumen (Jumlah Kurang)</div>
            <DocTable docs={anggotaDocs} onUpdate={updDoc(anggotaDocs, setAnggotaDocs)} />
          </>)}

          {/* === ANGGOTA MASUK === */}
          {formType === 'anggota-masuk' && (<>
            <div style={sectionTitle(meta.color)}>Arsip Anggota Masuk</div>
            {/* Banner prosentase otomatis */}
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '10px' }}>
              <span style={{ color: '#64748b' }}>Prosentase otomatis: </span>
              <strong style={{ color: meta.color, fontSize: '15px' }}>{pctMasuk}%</strong>
              <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>= {lMasuk} / {mMasuk} × 100</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '4px' }}>
              <NumField lbl="Anggota Masuk" val={mMasuk} set={setMMasuk} metaColor={meta.color} />
              <NumField lbl="Lengkap" val={lMasuk} set={setLMasuk} metaColor={meta.color} />
              <NumField lbl="Kurang" val={kMasuk} set={setKMasuk} metaColor={meta.color} />
              <NumField lbl="Tdk Ditemukan" val={tdMasuk} set={setTdMasuk} metaColor={meta.color} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={label}>Prosentase (%)</div>
                <input type="text" readOnly value={pctMasuk}
                  style={{ ...readonlyStyle, color: meta.color, fontWeight: 700 }}
                />
              </div>
            </div>

            {/* ── Periode Cek ── */}
            <div style={{ marginTop: '10px', marginBottom: '6px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                📅 Periode Cek
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={label}>Dari Tanggal</div>
                  <input type="date" value={periodeAMFrom}
                    style={{ ...inputStyle }}
                    onChange={e => setPeriodeAMFrom(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = meta.color}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={label}>Sampai Tanggal</div>
                  <input type="date" value={periodeAMTo}
                    style={{ ...inputStyle }}
                    onChange={e => setPeriodeAMTo(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = meta.color}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>
              {periodeAMLabel && (
                <div style={{ marginTop: '8px', padding: '6px 10px', background: meta.color + '12', borderRadius: '6px', border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Periode:</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: meta.color }}>{periodeAMLabel}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '8px 0 2px' }}>Detail Dokumen Wajib 01–08 (Jumlah Kurang)</div>
            <DocTable docs={masukDocs} onUpdate={updDoc(masukDocs, setMasukDocs)} />
          </>)}

          {/* === PENCAIRAN === */}
          {formType === 'pencairan' && (<>
            <div style={sectionTitle(meta.color)}>Arsip Pencairan</div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '10px' }}>
              <span style={{ color: '#64748b' }}>Prosentase otomatis: </span>
              <strong style={{ color: '#0ea5e9', fontSize: '15px' }}>{pencairanPct}%</strong>
              <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>= {arsipLengkap} / {totalPinjaman} × 100</span>
            </div>

            {/* ── Periode Cek Pencairan ── */}
            <div style={{ marginTop: '10px', marginBottom: '6px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                📅 Periode Cek
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={label}>Dari Tanggal</div>
                  <input type="date" value={periodePencairanFrom}
                    style={{ ...inputStyle }}
                    onChange={e => setPeriodePencairanFrom(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = meta.color}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={label}>Sampai Tanggal</div>
                  <input type="date" value={periodePencairanTo}
                    style={{ ...inputStyle }}
                    onChange={e => setPeriodePencairanTo(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = meta.color}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>
              {periodePencairanLabel && (
                <div style={{ marginTop: '8px', padding: '6px 10px', background: meta.color + '12', borderRadius: '6px', border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Periode:</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: meta.color }}>{periodePencairanLabel}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '4px' }}>
              <NumField lbl="Total Data Pinjaman" val={totalPinjaman} set={setTotalPinjaman} metaColor={meta.color} />
              <NumField lbl="Arsip Lengkap" val={arsipLengkap} set={setArsipLengkap} metaColor={meta.color} />
              <NumField lbl="Nama File Tidak Sesuai" val={namaFileTS} set={setNamaFileTS} metaColor={meta.color} />
              <NumField lbl="File Tidak Lengkap" val={fileTL} set={setFileTL} metaColor={meta.color} />
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', margin: '8px 0 2px' }}>Detail Dokumen (Jumlah Kurang File)</div>
            <DocTable docs={pencairanDocs} onUpdate={updDoc(pencairanDocs, setPencairanDocs)} />
          </>)}

        </div>
      </div>

      {/* ── Bottom save ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={() => navigate(-1)} disabled={saving}
          style={{ padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
          Batal
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: meta.color, color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Simpan Data
        </button>
      </div>
    </div>
  );
};

export default ArsipDigitalForm;
