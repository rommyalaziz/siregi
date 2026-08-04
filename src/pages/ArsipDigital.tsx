import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../components/Drawer';
import {
  Search, ArrowUpDown, Eye, Plus, Pencil, Trash2,
  Loader2, FolderArchive, Trophy, Download, ChevronDown,
  Users, FileText, Banknote, CheckCircle2, AlertTriangle,
  XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { utils, writeFile } from 'xlsx';
import './TableStyles.css';
import './ArsipDigital.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ArsipDigital {
  id: string;
  kode_cabang: string;
  nama_cabang: string;
  tanggal_cek: string | null;
  tanggal_cek_anggota?: string | null;
  tanggal_cek_pencairan?: string | null;
  tanggal_cek_anggota_masuk?: string | null;
  created_at: string;
  updated_at: string;
  arsip_anggota?: ArsipAnggota[];
  arsip_anggota_detail?: ArsipAnggotaDetail[];
  arsip_pencairan?: ArsipPencairan[];
  arsip_pencairan_detail?: ArsipPencairanDetail[];
  arsip_anggota_masuk?: ArsipAnggotaMasuk[];
  arsip_anggota_masuk_detail?: ArsipAnggotaMasukDetail[];
}

interface ArsipAnggota {
  id: string;
  arsip_id: string;
  member: number;
  lengkap: number;
  kurang: number;
  tidak_ditemukan: number;
  tidak_aktif: number;
  prosentase: number;
  toleransi_kk: number;
}

interface ArsipAnggotaMasuk {
  id: string;
  arsip_id: string;
  periode?: string;
  member: number;
  lengkap: number;
  kurang: number;
  tidak_ditemukan: number;
  tidak_aktif: number;
  prosentase: number;
}

interface ArsipAnggotaDetail {
  id: string;
  arsip_id: string;
  kode_dokumen: string;
  nama_dokumen: string;
  jumlah: number;
}

interface ArsipAnggotaMasukDetail {
  id: string;
  arsip_id: string;
  kode_dokumen: string;
  nama_dokumen: string;
  jumlah: number;
}

interface ArsipPencairan {
  id: string;
  arsip_id: string;
  periode: string;
  total_pinjaman: number;
  arsip_lengkap: number;
  nama_file_tidak_sesuai: number;
  file_tidak_lengkap: number;
}

interface ArsipPencairanDetail {
  id: string;
  arsip_id: string;
  kode_dokumen: string;
  nama_dokumen: string;
  jumlah: number;
}

type StatusType = 'good' | 'warn' | 'bad';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getStatus = (pct: number): StatusType => pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';

const getBarColor = (status: StatusType) => {
  if (status === 'good') return '#22c55e';
  if (status === 'warn') return '#f59e0b';
  return '#ef4444';
};

const getPctClass = (pct: number) =>
  pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';

const formatDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const formatPeriode = (periodeStr: string | undefined | null) => {
  if (!periodeStr) return '-';
  const parts = periodeStr.split(' sd ');
  if (parts.length !== 2) return periodeStr.replace(' sd ', ' - ');
  
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  const parsePart = (d: string) => {
    // Cek format DD-MM-YYYY
    const dmyMatch = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1]} ${MONTHS[parseInt(dmyMatch[2], 10) - 1]} ${dmyMatch[3]}`;
    }
    // Cek format YYYY-MM-DD
    const ymdMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      return `${ymdMatch[3]} ${MONTHS[parseInt(ymdMatch[2], 10) - 1]} ${ymdMatch[1]}`;
    }
    // Fallback Date parsing
    try {
      const dt = new Date(d + 'T00:00:00');
      if (!isNaN(dt.getTime())) return `${String(dt.getDate()).padStart(2,'0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {}
    
    return d;
  };

  return `${parsePart(parts[0])} - ${parsePart(parts[1])}`;
};

const calcPencairanPct = (p: ArsipPencairan | null): number => {
  if (!p || p.total_pinjaman === 0) return 0;
  return Math.round((p.arsip_lengkap / p.total_pinjaman) * 10000) / 100;
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const InfoAccordion = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: '#f8fafc', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={13} style={{ color: '#6366f1' }} />
          Panduan Perhitungan Arsip
        </span>
        <ChevronDown size={14} style={{ color: '#94a3b8', transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {isOpen && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Arsip Data Anggota', color: '#6366f1', desc: 'Keseluruhan data anggota aktif. Kelengkapan dokumen wajib 01–11.' },
            { label: 'Arsip Anggota (Non-KK)', color: '#6366f1', desc: 'Anggota aktif bergabung mulai 2025. Wajib dok 01–11, kecuali dok 02.' },
            { label: 'Arsip Pencairan', color: '#0ea5e9', desc: 'Data pencairan tahun 2026 s.d. 30 Juni 2026.' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 12px', borderRadius: '6px', background: '#f8fafc', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Reusable metric badge + progress bar cell — stacked vertically for consistent alignment */
const MetricCell = ({ value, label }: { value: number; label?: string }) => {
  const status = getStatus(value);
  const barColor = getBarColor(status);
  // Label tidak perlu disingkat lagi karena sudah vertical stack
  const badgeShort = status === 'good' ? 'Baik' : status === 'warn' ? 'Perhatian' : 'Tindak Lanjut';
  const badgeBg = status === 'good' ? '#dcfce7' : status === 'warn' ? '#fef9c3' : '#fee2e2';
  const badgeFg = status === 'good' ? '#15803d' : status === 'warn' ? '#92400e' : '#b91c1c';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      {label && <div style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>}
      {/* Percentage — always centered on its own line */}
      <div style={{ fontWeight: 700, fontSize: '11px', color: '#111827', lineHeight: 1, whiteSpace: 'nowrap', textAlign: 'center' }}>
        {value.toFixed(2)}%
      </div>
      {/* Badge — below the percentage */}
      <div style={{ padding: '0 4px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: '12px', height: '12px', display: 'inline-flex', alignItems: 'center', background: badgeBg, color: badgeFg }}>
        {badgeShort}
      </div>
      {/* Progress bar */}
      <div style={{ width: '85px', background: '#f1f5f9', borderRadius: '9999px', height: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '9999px', width: `${Math.min(value, 100)}%`, background: barColor, transition: 'width 0.7s ease-out' }} />
      </div>
    </div>
  );
};

/** KPI stat card */
const StatCard = ({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) => (
  <div style={{ borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{ width: 32, height: 32, borderRadius: '8px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
type ArsipView = 'anggota' | 'pencairan' | 'anggota-masuk';

const ArsipDigital = ({ view = 'anggota' }: { view?: ArsipView }) => {
  const sessionData = sessionStorage.getItem('msa_session');
  const sessionUser = sessionData ? JSON.parse(sessionData) : null;
  const role = sessionUser?.role?.toLowerCase() || '';
  const isAdmin = role.includes('admin');
  const isSuperAdmin = role === 'administrator' || role === 'admin';
  const userNamaCabang = sessionUser?.nama_cabang;

  const [data, setData] = useState<ArsipDigital[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const defaultSort: Record<ArsipView, string> = {
    anggota: 'anggota_desc',
    pencairan: 'pencairan_desc',
    'anggota-masuk': 'anggota_masuk_desc',
  };
  const [sortBy, setSortBy] = useState<string>(defaultSort[view]);

  useEffect(() => {
    setSortBy(defaultSort[view]);
  }, [view]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<ArsipDigital | null>(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
      return () => clearTimeout(t);
    }
  }, [message]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('arsip_digital')
        .select(`
          *,
          arsip_anggota (*),
          arsip_anggota_detail (*),
          arsip_pencairan (*),
          arsip_pencairan_detail (*),
          arsip_anggota_masuk (*),
          arsip_anggota_masuk_detail (*)
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin && userNamaCabang) {
        query = query.eq('nama_cabang', userNamaCabang);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      setData(rows || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Gagal mengambil data arsip.' });
    } finally { setLoading(false); }
  };

  const openAdd  = () => navigate(`/arsip-digital/tambah/${view}`);
  const openEdit = (item: ArsipDigital) => navigate(`/arsip-digital/edit/${item.id}/${view}`);

  const handleDelete = async (item: ArsipDigital) => {
    if (!window.confirm(`Hapus data arsip cabang ${item.nama_cabang}?`)) return;
    try {
      const { error } = await supabase.from('arsip_digital').delete().eq('id', item.id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Data arsip berhasil dihapus.' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus data.' });
    }
  };

  const processedData = useMemo(() => {
    let rows = data.filter(item =>
      item.nama_cabang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kode_cabang.toLowerCase().includes(searchQuery.toLowerCase())
    );

    rows = [...rows].sort((a, b) => {
      const pctA = a.arsip_anggota?.[0]?.prosentase ?? 0;
      const pctB = b.arsip_anggota?.[0]?.prosentase ?? 0;
      const pctNonKkA = a.arsip_anggota?.[0]?.toleransi_kk ?? 0;
      const pctNonKkB = b.arsip_anggota?.[0]?.toleransi_kk ?? 0;
      const pctMasukA = a.arsip_anggota_masuk?.[0]?.prosentase ?? 0;
      const pctMasukB = b.arsip_anggota_masuk?.[0]?.prosentase ?? 0;
      const penA = calcPencairanPct(a.arsip_pencairan?.[0] ?? null);
      const penB = calcPencairanPct(b.arsip_pencairan?.[0] ?? null);

      if (sortBy === 'anggota_desc') return pctB - pctA;
      if (sortBy === 'non_kk_desc') return pctNonKkB - pctNonKkA;
      if (sortBy === 'anggota_masuk_desc') return pctMasukB - pctMasukA;
      if (sortBy === 'pencairan_desc') return penB - penA;
      if (sortBy === 'nama_az') return a.nama_cabang.localeCompare(b.nama_cabang);
      if (sortBy === 'tanggal') {
        const getTgl = (item: ArsipDigital) => {
          if (view === 'anggota') return item.tanggal_cek_anggota ?? item.tanggal_cek ?? '';
          if (view === 'pencairan') return item.tanggal_cek_pencairan ?? item.tanggal_cek ?? '';
          if (view === 'anggota-masuk') return item.tanggal_cek_anggota_masuk ?? item.tanggal_cek ?? '';
          return item.tanggal_cek ?? '';
        };
        const tA = getTgl(a);
        const tB = getTgl(b);
        return tB.localeCompare(tA);
      }
      return 0;
    });
    return rows;
  }, [data, searchQuery, sortBy]);

  const exportToExcel = () => {
    if (processedData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diexport.' });
      return;
    }

    const anggotaDocKeys = new Set<string>();
    const pencairanDocKeys = new Set<string>();

    processedData.forEach(item => {
      item.arsip_anggota_detail?.forEach(d => {
        anggotaDocKeys.add(`[Anggota] ${d.kode_dokumen} - ${d.nama_dokumen}`);
      });
      item.arsip_pencairan_detail?.forEach(d => {
        pencairanDocKeys.add(`[Pencairan] ${d.kode_dokumen} - ${d.nama_dokumen}`);
      });
    });

    const sortedAnggotaDocKeys = Array.from(anggotaDocKeys).sort();
    const sortedPencairanDocKeys = Array.from(pencairanDocKeys).sort();

    const exportData = processedData.map((item, idx) => {
      const anggota = item.arsip_anggota?.[0];
      const pencairan = item.arsip_pencairan?.[0];
      const pctAnggota = anggota?.prosentase ?? 0;
      const pctNonKK = anggota?.toleransi_kk ?? 0;
      const pctPencairan = calcPencairanPct(pencairan ?? null);

      const row: any = {
        'No': idx + 1,
        'Kode Cabang': item.kode_cabang,
        'Nama Cabang': item.nama_cabang,
        'Tgl Cek (Anggota)': formatDate(item.tanggal_cek_anggota ?? item.tanggal_cek),
        'Tgl Cek (Anggota Masuk)': formatDate(item.tanggal_cek_anggota_masuk ?? item.tanggal_cek),
        'Tgl Cek (Pencairan)': formatDate(item.tanggal_cek_pencairan ?? item.tanggal_cek),
        'Arsip Data Anggota (%)': pctAnggota.toFixed(2) + '%',
        'Member': anggota?.member ?? 0,
        'Lengkap (Anggota)': anggota?.lengkap ?? 0,
        'Kurang (Anggota)': anggota?.kurang ?? 0,
        'Tdk Ditemukan': anggota?.tidak_ditemukan ?? 0,
        'Tdk Aktif': anggota?.tidak_aktif ?? 0,
        'Arsip Anggota (Non-KK) (%)': pctNonKK.toFixed(2) + '%',
        'Arsip Pencairan (%)': pctPencairan.toFixed(2) + '%',
        'Periode': pencairan?.periode ?? '-',
        'Total Pinjaman': pencairan?.total_pinjaman ?? 0,
        'Arsip Lengkap': pencairan?.arsip_lengkap ?? 0,
        'Nama File Tdk Sesuai': pencairan?.nama_file_tidak_sesuai ?? 0,
        'File Tdk Lengkap': pencairan?.file_tidak_lengkap ?? 0,
      };

      sortedAnggotaDocKeys.forEach(key => row[key] = 0);
      item.arsip_anggota_detail?.forEach(d => {
        row[`[Anggota] ${d.kode_dokumen} - ${d.nama_dokumen}`] = d.jumlah;
      });

      sortedPencairanDocKeys.forEach(key => row[key] = 0);
      item.arsip_pencairan_detail?.forEach(d => {
        row[`[Pencairan] ${d.kode_dokumen} - ${d.nama_dokumen}`] = d.jumlah;
      });

      return row;
    });

    const workbook = utils.book_new();
    const wsSummary = utils.json_to_sheet(exportData);
    const baseCols = [
      { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
      { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
    ];
    const docCols = [
      ...sortedAnggotaDocKeys.map(() => ({ wch: 25 })),
      ...sortedPencairanDocKeys.map(() => ({ wch: 25 }))
    ];
    wsSummary['!cols'] = [...baseCols, ...docCols];
    utils.book_append_sheet(workbook, wsSummary, "Summary");
    writeFile(workbook, `Arsip_Digital_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Stats per view ──
  const stats = useMemo(() => {
    const total = data.length;
    const getPct = (d: ArsipDigital) => {
      if (view === 'pencairan') return calcPencairanPct(d.arsip_pencairan?.[0] ?? null);
      if (view === 'anggota-masuk') return d.arsip_anggota_masuk?.[0]?.prosentase ?? 0;
      return d.arsip_anggota?.[0]?.prosentase ?? 0;
    };
    const good = data.filter(d => getPct(d) >= 85).length;
    const warn = data.filter(d => { const p = getPct(d); return p >= 70 && p < 85; }).length;
    const bad  = data.filter(d => getPct(d) < 70).length;
    return { total, good, warn, bad };
  }, [data, view]);

  const topPerformers = useMemo(() => {
    if (!data || data.length === 0) return [];
    const getPct = (d: ArsipDigital) => {
      if (view === 'pencairan') return calcPencairanPct(d.arsip_pencairan?.[0] ?? null);
      if (view === 'anggota-masuk') return d.arsip_anggota_masuk?.[0]?.prosentase ?? 0;
      return d.arsip_anggota?.[0]?.prosentase ?? 0;
    };
    return [...data].sort((a, b) => getPct(b) - getPct(a)).filter(d => getPct(d) > 0).slice(0, 3);
  }, [data, view]);

  // ── View config ──
  const viewConfig: Record<ArsipView, { title: string; description: string; sortOptions: { value: string; label: string }[] }> = {
    anggota: {
      title: 'Arsip Anggota',
      description: 'Monitoring kelengkapan arsip dokumen seluruh cabang — Data Anggota',
      sortOptions: [
        { value: 'anggota_desc', label: 'Arsip Anggota (%) Terbesar' },
        { value: 'non_kk_desc', label: 'Arsip Non-KK (%) Terbesar' },
        { value: 'nama_az', label: 'Nama Cabang A–Z' },
        { value: 'tanggal', label: 'Tanggal Cek Terbaru' },
      ],
    },
    pencairan: {
      title: 'Arsip Pencairan',
      description: 'Monitoring kelengkapan arsip dokumen seluruh cabang — Data Pencairan',
      sortOptions: [
        { value: 'pencairan_desc', label: 'Pencairan (%) Terbesar' },
        { value: 'nama_az', label: 'Nama Cabang A–Z' },
        { value: 'tanggal', label: 'Tanggal Cek Terbaru' },
      ],
    },
    'anggota-masuk': {
      title: 'Arsip Anggota Masuk',
      description: 'Monitoring kelengkapan arsip dokumen seluruh cabang — Data Anggota Masuk',
      sortOptions: [
        { value: 'anggota_masuk_desc', label: 'Arsip Anggota Masuk (%) Terbesar' },
        { value: 'nama_az', label: 'Nama Cabang A–Z' },
        { value: 'tanggal', label: 'Tanggal Cek Terbaru' },
      ],
    },
  };
  const { title: pageTitle, description: pageDesc, sortOptions } = viewConfig[view];

  // ── Table columns per view ──
  const colCount = view === 'anggota' ? 23 : view === 'pencairan' ? 16 : 19;

  // ── Toolbar colors per view ──
  const accentColor = view === 'pencairan' ? '#0ea5e9' : '#6366f1';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '8px',
              background: accentColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {view === 'pencairan' ? <Banknote size={16} color={accentColor} /> : <Users size={16} color={accentColor} />}
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{pageTitle}</h1>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, paddingLeft: '40px' }}>{pageDesc}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={exportToExcel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', background: '#fff', color: '#374151',
              fontSize: '12px', fontWeight: 600, borderRadius: '8px',
              border: '1px solid #d1d5db', cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontFamily: 'inherit',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <Download size={13} />Export Excel
          </button>
          {isSuperAdmin && (
            <button
              onClick={openAdd}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', background: accentColor, color: '#fff',
                fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)', fontFamily: 'inherit',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={13} />Tambah Data
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: message.type === 'error' ? '#b91c1c' : '#15803d',
          border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {message.text}
        </div>
      )}

      {/* ── Info Accordion ── */}
          <InfoAccordion />

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {/* Top Performers */}
            <div style={{
              borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff',
              padding: '10px 12px', gridColumn: 'span 2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Trophy size={14} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                  Top 3 Cabang
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {topPerformers.length > 0 ? topPerformers.map((item, idx) => {
                  const pct = view === 'pencairan'
                    ? calcPencairanPct(item.arsip_pencairan?.[0] ?? null)
                    : view === 'anggota-masuk'
                      ? (item.arsip_anggota_masuk?.[0]?.prosentase ?? 0)
                      : (item.arsip_anggota?.[0]?.prosentase ?? 0);
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '14px' }}>{medals[idx]}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama_cabang}</span>
                      </div>
                      <span style={{
                        flexShrink: 0, padding: '2px 8px', borderRadius: '9999px',
                        fontSize: '11px', fontWeight: 700, background: '#dcfce7',
                        color: '#15803d', border: '1px solid #bbf7d0'
                      }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                }) : <div style={{ fontSize: '12px', color: '#9ca3af' }}>—</div>}
              </div>
            </div>

            <StatCard label="Total Cabang" value={stats.total} icon={<FolderArchive size={16} />} color="#6366f1" />
            <StatCard label="≥ 85% Baik" value={stats.good} icon={<CheckCircle2 size={16} />} color="#22c55e" />
            <StatCard label="70–84% Perhatian" value={stats.warn} icon={<AlertTriangle size={16} />} color="#f59e0b" />
            <StatCard label="< 70% Tindak Lanjut" value={stats.bad} icon={<XCircle size={16} />} color="#ef4444" />
          </div>

          {/* ── Table Card ── */}
          <div style={{ borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '12px', background: '#fafafa', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Cari cabang..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      paddingLeft: '30px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px',
                      border: '1px solid #e5e7eb', borderRadius: '7px', fontSize: '12px',
                      width: '200px', outline: 'none', background: '#fff', color: '#1f2937',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#6b7280' }}>
                  <ArrowUpDown size={13} />
                  <select
                    style={{
                      background: '#fff', border: '1px solid #e5e7eb', borderRadius: '7px',
                      padding: '6px 10px', fontSize: '12px', outline: 'none',
                      color: '#374151', fontFamily: 'inherit', cursor: 'pointer'
                    }}
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                  >
                    {sortOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Record count */}
              <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {processedData.length} cabang ditemukan
              </span>
            </div>

            {/* Table */}
            <div className="arsip-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              <table style={{
                width: 'max-content',
                minWidth: '100%',
                tableLayout: 'fixed',
                textAlign: 'left',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 30 }}>
                  {view === 'anggota' ? (
                    <>
                      <tr style={{ background: '#f8fafc' }}>
                        <th colSpan={3} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', left: 0, zIndex: 31, boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Informasi Cabang</th>
                        <th colSpan={7} style={thStyle({ textAlign: 'center', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' })}>Progress Arsip</th>
                        <th colSpan={11} style={thStyle({ textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #cbd5e1' })}>Kategori Kekurangan</th>
                        <th colSpan={2} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' })}>Informasi</th>
                      </tr>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={thStyle({ width: '30px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 31, background: '#f8fafc' })}>No</th>
                        <th style={thStyle({ width: '44px', textAlign: 'center', position: 'sticky', left: '30px', zIndex: 31, background: '#f8fafc' })}>Kode</th>
                        <th style={thStyle({ width: '150px', position: 'sticky', left: '74px', zIndex: 31, background: '#f8fafc', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Nama Cabang</th>
                        {/* Progress cols */}
                        <th style={thStyle({ width: '105px', textAlign: 'center', background: '#f1f5f9' })}>Arsip %</th>
                        <th style={thStyle({ width: '46px', textAlign: 'center', background: '#e0f2fe' })}>Total<br/>Member</th>
                        <th style={thStyle({ width: '52px', textAlign: 'center', background: '#dcfce7' })}>Arsip<br/>Lengkap</th>
                        <th style={thStyle({ width: '46px', textAlign: 'center', background: '#fef9c3' })}>File<br/>Kurang</th>
                        <th style={thStyle({ width: '58px', textAlign: 'center', background: '#fee2e2' })}>Tidak<br/>Ditemukan</th>
                        <th style={thStyle({ width: '58px', textAlign: 'center', background: '#f3f4f6' })}>Tidak<br/>Aktif</th>
                        {/* Kategori cols: 38px each × 11 */}
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>01<br/>KTP</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>02<br/>KK</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>03<br/>PPI</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>04<br/>UK</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>05<br/>Anggt</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>06<br/>Peng</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>07<br/>Akad</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>08<br/>Mon</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>09<br/>SHR</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>10<br/>Lain</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>11<br/>Cuti</th>
                        {/* Info cols */}
                        <th style={thStyle({ width: '74px', textAlign: 'center', background: '#f8fafc' })}>Tgl Cek</th>
                        <th style={thStyle({ width: '50px', textAlign: 'center', background: '#f8fafc' })}>Aksi</th>
                      </tr>
                    </>
                  ) : view === 'anggota-masuk' ? (
                    <>
                      <tr style={{ background: '#f8fafc' }}>
                        <th colSpan={3} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', left: 0, zIndex: 31, boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Informasi Cabang</th>
                        <th colSpan={6} style={thStyle({ textAlign: 'center', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' })}>Progress Arsip</th>
                        <th colSpan={8} style={thStyle({ textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #cbd5e1' })}>Kategori Kekurangan</th>
                        <th colSpan={2} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' })}>Informasi</th>
                      </tr>
                      <tr style={{ background: '#f8fafc' }}>
                        {/* NO: 30px | KODE: 44px → sticky ends at 74px */}
                        <th style={thStyle({ width: '30px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 31, background: '#f8fafc' })}>No</th>
                        <th style={thStyle({ width: '44px', textAlign: 'center', position: 'sticky', left: '30px', zIndex: 31, background: '#f8fafc' })}>Kode</th>
                        {/* Nama Cabang: 150px, sticky at left:74px */}
                        <th style={thStyle({ width: '150px', position: 'sticky', left: '74px', zIndex: 31, background: '#f8fafc', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Nama Cabang</th>
                        {/* Arsip%: 105px | Periode: 160px (fits "01 Jan 2026 – 30 Jun 2026" on 1 line) */}
                        <th style={thStyle({ width: '105px', textAlign: 'center', background: '#f1f5f9' })}>Arsip %</th>
                        <th style={thStyle({ width: '160px', textAlign: 'center', background: '#f1f5f9' })}>Periode Cek</th>
                        {/* Progress cols */}
                        <th style={thStyle({ width: '46px', textAlign: 'center', background: '#e0f2fe' })}>Total<br/>Masuk</th>
                        <th style={thStyle({ width: '52px', textAlign: 'center', background: '#dcfce7' })}>Arsip<br/>Lengkap</th>
                        <th style={thStyle({ width: '46px', textAlign: 'center', background: '#fef9c3' })}>File<br/>Kurang</th>
                        <th style={thStyle({ width: '58px', textAlign: 'center', background: '#fee2e2' })}>Tidak<br/>Ditemukan</th>
                        {/* Kategori cols: 38px each × 8 */}
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>01<br/>KTP</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>02<br/>KK</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>03<br/>PPI</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>04<br/>UK</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>05<br/>Anggt</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>06<br/>Peng</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>07<br/>Akad</th>
                        <th style={thStyle({ width: '38px', textAlign: 'center', background: '#f0fdf4' })}>08<br/>Mon</th>
                        {/* Info cols */}
                        <th style={thStyle({ width: '74px', textAlign: 'center', background: '#f8fafc' })}>Tgl Cek</th>
                        <th style={thStyle({ width: '50px', textAlign: 'center', background: '#f8fafc' })}>Aksi</th>
                      </tr>
                    </>
                  ) : view === 'pencairan' ? (
                    <>
                      <tr style={{ background: '#f8fafc' }}>
                        <th colSpan={3} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', left: 0, zIndex: 31, boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Informasi Cabang</th>
                        <th colSpan={6} style={thStyle({ textAlign: 'center', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' })}>Progress Pencairan</th>
                        <th colSpan={5} style={thStyle({ textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #cbd5e1' })}>Kategori Kekurangan</th>
                        <th colSpan={2} style={thStyle({ textAlign: 'center', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' })}>Informasi</th>
                      </tr>
                      <tr style={{ background: '#f8fafc' }}>
                        {/* NO: 30px | KODE: 44px → sticky ends at 74px */}
                        <th style={thStyle({ width: '30px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 31, background: '#f8fafc' })}>No</th>
                        <th style={thStyle({ width: '44px', textAlign: 'center', position: 'sticky', left: '30px', zIndex: 31, background: '#f8fafc' })}>Kode</th>
                        {/* Nama Cabang: 150px, sticky at left:74px */}
                        <th style={thStyle({ width: '150px', position: 'sticky', left: '74px', zIndex: 31, background: '#f8fafc', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' })}>Nama Cabang</th>
                        {/* Arsip%: 105px | Periode: 160px */}
                        <th style={thStyle({ width: '105px', textAlign: 'center', background: '#f1f5f9' })}>Arsip %</th>
                        <th style={thStyle({ width: '160px', textAlign: 'center', background: '#f1f5f9' })}>Periode Cek</th>
                        {/* Progress cols */}
                        <th style={thStyle({ width: '52px', textAlign: 'center', background: '#e0f2fe' })}>Total<br/>Pinjaman</th>
                        <th style={thStyle({ width: '52px', textAlign: 'center', background: '#dcfce7' })}>Arsip<br/>Lengkap</th>
                        <th style={thStyle({ width: '54px', textAlign: 'center', background: '#fef9c3' })}>File Tdk<br/>Sesuai</th>
                        <th style={thStyle({ width: '54px', textAlign: 'center', background: '#fee2e2' })}>File Tdk<br/>Lengkap</th>
                        {/* Kategori cols: 40px each × 5 */}
                        <th style={thStyle({ width: '40px', textAlign: 'center', background: '#f0fdf4' })}>03<br/>PPI</th>
                        <th style={thStyle({ width: '40px', textAlign: 'center', background: '#f0fdf4' })}>06<br/>Peng</th>
                        <th style={thStyle({ width: '40px', textAlign: 'center', background: '#f0fdf4' })}>07<br/>Akad</th>
                        <th style={thStyle({ width: '40px', textAlign: 'center', background: '#f0fdf4' })}>08<br/>Mon</th>
                        <th style={thStyle({ width: '40px', textAlign: 'center', background: '#f0fdf4' })}>10<br/>Lain</th>
                        {/* Info cols */}
                        <th style={thStyle({ width: '74px', textAlign: 'center', background: '#f8fafc' })}>Tgl Cek</th>
                        <th style={thStyle({ width: '50px', textAlign: 'center', background: '#f8fafc' })}>Aksi</th>
                      </tr>
                    </>
                  ) : (
                    <tr style={{ background: '#f8fafc' }}>
                      <th colSpan={colCount} style={thStyle({ textAlign: 'center', background: '#f8fafc' })}>Invalid View</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={colCount} style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                          <Loader2 size={22} className="animate-spin" />
                          <span style={{ fontSize: '13px' }}>Memuat data arsip...</span>
                        </div>
                      </td>
                    </tr>
                  ) : processedData.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                          <FolderArchive size={36} />
                          <span style={{ fontSize: '13px' }}>{searchQuery ? 'Tidak ada cabang yang cocok.' : 'Belum ada data arsip.'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : processedData.map((item, idx) => {
                    const anggota = item.arsip_anggota?.[0];
                    const pencairan = item.arsip_pencairan?.[0];
                    const anggotaMasuk = item.arsip_anggota_masuk?.[0];
                    const pctAnggota = anggota?.prosentase ?? 0;
                    const pctMasuk = anggotaMasuk?.prosentase ?? 0;
                    const pctPencairan = calcPencairanPct(pencairan ?? null);
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s', background: isEven ? '#fff' : '#fafafa', verticalAlign: 'middle' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#f0f9ff';
                          Array.from(e.currentTarget.children).forEach((c: any) => { if(c.style.position === 'sticky') c.style.background = '#f0f9ff'; });
                        }}
                        onMouseLeave={e => {
                          const bg = isEven ? '#fff' : '#fafafa';
                          e.currentTarget.style.background = bg;
                          Array.from(e.currentTarget.children).forEach((c: any) => { if(c.style.position === 'sticky') c.style.background = bg; });
                        }}
                      >
                        {/* Sticky cells — offsets: NO=30, KODE=30+44=74, NAMA=30+44+150=224 */}
                        <td style={{ padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', color: '#64748b', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, position: 'sticky', left: 0, zIndex: 20, background: isEven ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>{idx + 1}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', color: '#334155', fontSize: '11px', fontWeight: 700, position: 'sticky', left: '30px', zIndex: 20, background: isEven ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>{item.kode_cabang}</td>
                        {/* Nama Cabang: NO maxWidth, NO overflow:hidden — let column width control it */}
                        <td style={{ padding: '2px 6px', fontWeight: 800, color: '#020617', fontSize: '11px', verticalAlign: 'middle', position: 'sticky', left: '74px', zIndex: 20, background: isEven ? '#fff' : '#fafafa', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{item.nama_cabang}</td>
                        {view === 'anggota' && (() => {
                          const obj = item.arsip_anggota?.[0];
                          const getMD = (k: string) => item.arsip_anggota_detail?.find(d => d.kode_dokumen === k)?.jumlah ?? 0;
                          const renderMDVal = (kode: string) => {
                            const val = getMD(kode);
                            if (val === 0) return <span className="arsip-zero-badge" style={{ padding: '0 4px', fontSize: '9px', lineHeight: '14px', height: '14px' }} title="Clear">✓ 0</span>;
                            return <span className="arsip-nonzero-val" style={{ fontSize: '12px' }}>{val}</span>;
                          };
                          return (
                            <>
                              <td style={{ padding: '2px 4px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle' }}><MetricCell value={pctAnggota} /></td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{obj?.member ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#15803d', borderBottom: '1px solid #f1f5f9' }}>{obj?.lengkap ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#d97706', borderBottom: '1px solid #f1f5f9' }}>{obj?.kurang ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#dc2626', borderBottom: '1px solid #f1f5f9' }}>{obj?.tidak_ditemukan ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{obj?.tidak_aktif ?? 0}</td>
                              <td className={getMD('01') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('01')}</td>
                              <td className={getMD('02') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('02')}</td>
                              <td className={getMD('03') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('03')}</td>
                              <td className={getMD('04') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('04')}</td>
                              <td className={getMD('05') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('05')}</td>
                              <td className={getMD('06') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('06')}</td>
                              <td className={getMD('07') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('07')}</td>
                              <td className={getMD('08') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('08')}</td>
                              <td className={getMD('09') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('09')}</td>
                              <td className={getMD('10') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('10')}</td>
                              <td className={getMD('11') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('11')}</td>
                            </>
                          );
                        })()}
                        {view === 'anggota-masuk' && (() => {
                          const getMD = (k: string) => item.arsip_anggota_masuk_detail?.find(d => d.kode_dokumen === k)?.jumlah ?? 0;
                          const renderMDVal = (kode: string) => {
                            const val = getMD(kode);
                            if (val === 0) return <span className="arsip-zero-badge" style={{ padding: '0 4px', fontSize: '9px', lineHeight: '14px', height: '14px' }} title="Clear">✓ 0</span>;
                            return <span className="arsip-nonzero-val" style={{ fontSize: '12px' }}>{val}</span>;
                          };
                          return (
                            <>
                              <td style={{ padding: '2px 4px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle' }}><MetricCell value={pctMasuk} /></td>
                              {/* Periode Cek: whiteSpace nowrap — col is 160px, fits "01 Jan 2026 – 30 Jun 2026" on 1 line */}
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '10px', textAlign: 'center', lineHeight: 1.2, color: '#475569', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {formatPeriode(anggotaMasuk?.periode)}
                              </td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{anggotaMasuk?.member ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#15803d', borderBottom: '1px solid #f1f5f9' }}>{anggotaMasuk?.lengkap ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#d97706', borderBottom: '1px solid #f1f5f9' }}>{anggotaMasuk?.kurang ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 700, fontSize: '11px', textAlign: 'center', color: '#dc2626', borderBottom: '1px solid #f1f5f9' }}>{anggotaMasuk?.tidak_ditemukan ?? 0}</td>
                              <td className={getMD('01') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('01')}</td>
                              <td className={getMD('02') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('02')}</td>
                              <td className={getMD('03') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('03')}</td>
                              <td className={getMD('04') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('04')}</td>
                              <td className={getMD('05') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('05')}</td>
                              <td className={getMD('06') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('06')}</td>
                              <td className={getMD('07') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('07')}</td>
                              <td className={getMD('08') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderMDVal('08')}</td>
                            </>
                          );
                        })()}
                        {view === 'pencairan' && (() => {
                          const getDoc = (k: string) => item.arsip_pencairan_detail?.find(d => d.kode_dokumen === k)?.jumlah ?? 0;
                          const renderArsipVal = (kode: string) => {
                            const val = getDoc(kode);
                            if (val === 0) return <span className="arsip-zero-badge" style={{ padding: '0 4px', fontSize: '9px', lineHeight: '14px', height: '14px' }} title="Clear — tidak ada tunggakan">✓ 0</span>;
                            return <span className="arsip-nonzero-val" style={{ fontSize: '12px' }}>{val}</span>;
                          };

                          return (
                            <>
                              <td style={{ padding: '2px 4px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle' }}><MetricCell value={pctPencairan} /></td>
                              {/* Periode Cek: whiteSpace nowrap — col is 160px */}
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '10px', textAlign: 'center', lineHeight: 1.2, color: '#475569', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {formatPeriode(pencairan?.periode).replace(' - ', '–')}
                              </td>
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '11px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{pencairan?.total_pinjaman ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '11px', color: '#15803d', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{pencairan?.arsip_lengkap ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '11px', color: '#f59e0b', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{pencairan?.nama_file_tidak_sesuai ?? 0}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '11px', color: '#ef4444', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{pencairan?.file_tidak_lengkap ?? 0}</td>
                              <td className={getDoc('03') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderArsipVal('03')}</td>
                              <td className={getDoc('06') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderArsipVal('06')}</td>
                              <td className={getDoc('07') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderArsipVal('07')}</td>
                              <td style={{ padding: '2px 4px', fontWeight: 600, fontSize: '12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{getDoc('08')}</td>
                              <td className={getDoc('10') === 0 ? 'clear-arsip-cell' : undefined} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{renderArsipVal('10')}</td>
                            </>
                          );
                        })()}
                        <td style={{ padding: '2px 4px', color: '#64748b', fontSize: '10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                          {formatDate(
                            view === 'anggota' ? (item.tanggal_cek_anggota ?? item.tanggal_cek) :
                            view === 'pencairan' ? (item.tanggal_cek_pencairan ?? item.tanggal_cek) :
                            (item.tanggal_cek_anggota_masuk ?? item.tanggal_cek)
                          )}
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <ActionBtn onClick={() => { setDrawerItem(item); setDrawerOpen(true); }} title="Detail" hoverColor="#6366f1">
                              <Eye size={14} />
                            </ActionBtn>
                            {isSuperAdmin && <>
                              <ActionBtn onClick={() => openEdit(item)} title="Edit" hoverColor="#6366f1">
                                <Pencil size={14} />
                              </ActionBtn>
                              <ActionBtn onClick={() => handleDelete(item)} title="Hapus" hoverColor="#ef4444">
                                <Trash2 size={14} />
                              </ActionBtn>
                            </>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
      {/* ── Detail Drawer ── */}
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Detail Arsip — ${drawerItem?.nama_cabang ?? ''}`}>
        {drawerItem && (() => {
          const ang = drawerItem.arsip_anggota?.[0];
          const pen = drawerItem.arsip_pencairan?.[0];
          const angMasuk = drawerItem.arsip_anggota_masuk?.[0];
          const pctAng = ang?.prosentase ?? 0;
          const pctMasuk = angMasuk?.prosentase ?? 0;
          const pctPen = calcPencairanPct(pen ?? null);
          const clsAng = getPctClass(pctAng);
          const clsMasuk = getPctClass(pctMasuk);
          const clsPen = getPctClass(pctPen);

          const ScoreBar = ({ pct, cls, label }: { pct: number; cls: string; label: string }) => (
            <div className="arsip-score-bar">
              <div className="arsip-score-bar-label">
                <span>{label}</span>
                <span style={{ color: `var(--color-${cls === 'good' ? 'success' : cls === 'warn' ? 'warning' : 'danger'})`, fontWeight: 700 }}>
                  {pct.toFixed(2)}%
                </span>
              </div>
              <div className="arsip-pct-bar-track">
                <div className={`arsip-pct-bar-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );

          return (
            <div className="arsip-detail-content">
              {/* Header */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                <span>Kode: <strong style={{ color: 'var(--color-text-main)' }}>{drawerItem.kode_cabang}</strong></span>
                <span>Tgl Cek: <strong style={{ color: 'var(--color-text-main)' }}>{formatDate(drawerItem.tanggal_cek)}</strong></span>
              </div>

              {/* Section 1: Arsip Data Anggota */}
              <div className="arsip-detail-section">
                <div className="arsip-detail-section-title">1. Arsip Data Anggota</div>
                <ScoreBar pct={pctAng} cls={clsAng} label="Prosentase Kelengkapan" />
                <div className="arsip-summary-grid">
                  {[
                    { label: 'Member', val: ang?.member, color: '' },
                    { label: 'Lengkap', val: ang?.lengkap, color: 's-green' },
                    { label: 'Kurang', val: ang?.kurang, color: 's-yellow' },
                    { label: 'Tdk Ditemukan', val: ang?.tidak_ditemukan, color: 's-red' },
                    { label: 'Tdk Aktif', val: ang?.tidak_aktif, color: '' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`arsip-summary-item ${color}`}>
                      <div className="s-label">{label}</div>
                      <div className="s-value">{val?.toLocaleString() ?? '-'}</div>
                    </div>
                  ))}
                </div>
                {(drawerItem.arsip_anggota_detail?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Detail Dokumen Anggota (Kurang)
                    </div>
                    <table className="arsip-detail-doc-table">
                      <thead><tr><th>Kode</th><th>Nama Dokumen</th><th style={{ textAlign: 'right' }}>Jumlah Kurang</th></tr></thead>
                      <tbody>
                        {drawerItem.arsip_anggota_detail!
                          .sort((a, b) => a.kode_dokumen.localeCompare(b.kode_dokumen))
                          .map(d => (
                          <tr key={d.id}>
                            <td className="mono">{d.kode_dokumen}</td>
                            <td>{d.nama_dokumen}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: d.jumlah > 0 ? 'var(--color-danger)' : 'inherit' }}>
                              {d.jumlah}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Section 2: Arsip Anggota Masuk */}
              <div className="arsip-detail-section" style={{ marginTop: '16px' }}>
                <div className="arsip-detail-section-title">2. Arsip Anggota Masuk</div>
                <ScoreBar pct={pctMasuk} cls={clsMasuk} label="Prosentase Kelengkapan" />
                {angMasuk?.periode && (() => {
                  // Format periode dari "YYYY-MM-DD sd YYYY-MM-DD" ke "01 Jan - 30 Jun 2026"
                  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
                  const fmtD = (s: string) => { try { const dt = new Date(s + 'T00:00:00'); return `${String(dt.getDate()).padStart(2,'0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`; } catch { return s; } };
                  const parts = angMasuk.periode.split(' sd ');
                  const labelPeriode = parts.length === 2 ? `${fmtD(parts[0])} - ${fmtD(parts[1])}` : angMasuk.periode;
                  return (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                      Periode Cek: <strong style={{ color: 'var(--color-text-main)' }}>{labelPeriode}</strong>
                    </div>
                  );
                })()}
                <div className="arsip-summary-grid">
                  {[
                    { label: 'Anggota Masuk', val: angMasuk?.member, color: '' },
                    { label: 'Lengkap', val: angMasuk?.lengkap, color: 's-green' },
                    { label: 'Kurang', val: angMasuk?.kurang, color: 's-yellow' },
                    { label: 'Tdk Ditemukan', val: angMasuk?.tidak_ditemukan, color: 's-red' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`arsip-summary-item ${color}`}>
                      <div className="s-label">{label}</div>
                      <div className="s-value">{val?.toLocaleString() ?? '-'}</div>
                    </div>
                  ))}
                </div>
                {(drawerItem.arsip_anggota_masuk_detail?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '12px' }}>
                      Detail Dokumen Anggota Masuk (Kurang)
                    </div>
                    <table className="arsip-detail-doc-table">
                      <thead><tr><th>Kode</th><th>Nama Dokumen</th><th style={{ textAlign: 'right' }}>Jumlah Kurang</th></tr></thead>
                      <tbody>
                        {drawerItem.arsip_anggota_masuk_detail!
                          .sort((a, b) => a.kode_dokumen.localeCompare(b.kode_dokumen))
                          .map(d => (
                            <tr key={d.id}>
                              <td className="mono">{d.kode_dokumen.padStart(2, '0')}</td>
                              <td>{d.nama_dokumen}</td>
                              <td className={`num ${d.jumlah === 0 ? 'zero' : ''}`}>{d.jumlah.toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Section 2: Arsip Pencairan */}
              <div className="arsip-detail-section">
                <div className="arsip-detail-section-title">2. Arsip Pencairan</div>
                <ScoreBar pct={pctPen} cls={clsPen} label="Prosentase Arsip Pencairan" />
                {pen?.periode && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                    Periode: <strong style={{ color: 'var(--color-text-main)' }}>{pen.periode}</strong>
                  </div>
                )}
                <div className="arsip-summary-grid">
                  {[
                    { label: 'Total Pinjaman', val: pen?.total_pinjaman, color: '' },
                    { label: 'Arsip Lengkap', val: pen?.arsip_lengkap, color: 's-green' },
                    { label: 'Nama File Tdk Sesuai', val: pen?.nama_file_tidak_sesuai, color: 's-yellow' },
                    { label: 'File Tidak Lengkap', val: pen?.file_tidak_lengkap, color: 's-red' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`arsip-summary-item ${color}`}>
                      <div className="s-label">{label}</div>
                      <div className="s-value">{val?.toLocaleString() ?? '-'}</div>
                    </div>
                  ))}
                </div>
                {(drawerItem.arsip_pencairan_detail?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Detail Dokumen Pencairan (Kurang File)
                    </div>
                    <table className="arsip-detail-doc-table">
                      <thead><tr><th>Kode</th><th>Nama Dokumen</th><th style={{ textAlign: 'right' }}>Jumlah Kurang</th></tr></thead>
                      <tbody>
                        {drawerItem.arsip_pencairan_detail!
                          .sort((a, b) => a.kode_dokumen.localeCompare(b.kode_dokumen))
                          .map(d => (
                            <tr key={d.id}>
                              <td className="mono">{d.kode_dokumen.padStart(2, '0')}</td>
                              <td>{d.nama_dokumen}</td>
                              <td className={`num ${d.jumlah === 0 ? 'zero' : ''}`}>{d.jumlah.toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
};

// ─── Tiny helpers ───────────────────────────────────────
const thStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding: '4px 4px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.2px',
  lineHeight: 1.2,
  color: '#64748b',
  verticalAlign: 'middle',
  borderBottom: '1px solid #e5e7eb',
  ...extra,
});

const ActionBtn = ({
  onClick, title, hoverColor, children
}: {
  onClick: () => void; title: string; hoverColor: string; children: React.ReactNode;
}) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '2px', border: 'none', background: hover ? hoverColor + '14' : 'none',
        color: hover ? hoverColor : '#cbd5e1', borderRadius: '4px',
        cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
};

export default ArsipDigital;
