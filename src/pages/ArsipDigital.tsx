import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/Drawer';
import {
  Search, ArrowUpDown, Eye, Plus, Pencil, Trash2,
  Loader2, FolderArchive, CheckCircle2, AlertCircle, XCircle, Trophy, Award, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
  created_at: string;
  updated_at: string;
  arsip_anggota?: ArsipAnggota[];
  arsip_anggota_detail?: ArsipAnggotaDetail[];
  arsip_pencairan?: ArsipPencairan[];
  arsip_pencairan_detail?: ArsipPencairanDetail[];
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

interface ArsipAnggotaDetail {
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



// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getPctClass = (pct: number) =>
  pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';

const getPctLabel = (pct: number) =>
  pct >= 85 ? 'Baik' : pct >= 70 ? 'Perhatian' : 'Tindak Lanjut';

const formatDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const calcPencairanPct = (p: ArsipPencairan | null): number => {
  if (!p || p.total_pinjaman === 0) return 0;
  return Math.round((p.arsip_lengkap / p.total_pinjaman) * 10000) / 100;
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const ArsipDigital = () => {
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
  const [sortBy, setSortBy] = useState<'anggota_desc' | 'non_kk_desc' | 'pencairan_desc' | 'nama_az' | 'tanggal'>('anggota_desc');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<ArsipDigital | null>(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ── Fetch ──────────────────────────────────
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
          arsip_pencairan_detail (*)
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

  // ── Navigate to Form ──────────────────────
  const openAdd  = () => navigate('/arsip-digital/tambah');
  const openEdit = (item: ArsipDigital) => navigate(`/arsip-digital/edit/${item.id}`);

  // ── Delete ─────────────────────────────────
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

  // ── Sorted + Filtered Data ─────────────────
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
      const penA = calcPencairanPct(a.arsip_pencairan?.[0] ?? null);
      const penB = calcPencairanPct(b.arsip_pencairan?.[0] ?? null);

      if (sortBy === 'anggota_desc') return pctB - pctA;
      if (sortBy === 'non_kk_desc') return pctNonKkB - pctNonKkA;
      if (sortBy === 'pencairan_desc') return penB - penA;
      if (sortBy === 'nama_az') return a.nama_cabang.localeCompare(b.nama_cabang);
      if (sortBy === 'tanggal') {
        const tA = a.tanggal_cek ?? '';
        const tB = b.tanggal_cek ?? '';
        return tB.localeCompare(tA);
      }
      return 0;
    });
    return rows;
  }, [data, searchQuery, sortBy]);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    const total = data.length;
    const good  = data.filter(d => (d.arsip_anggota?.[0]?.prosentase ?? 0) >= 85).length;
    const warn  = data.filter(d => { const p = d.arsip_anggota?.[0]?.prosentase ?? 0; return p >= 70 && p < 85; }).length;
    const bad   = data.filter(d => (d.arsip_anggota?.[0]?.prosentase ?? 0) < 70).length;
    return { total, good, warn, bad };
  }, [data]);

  // ── Top Performers ─────────────────────────
  const topPerformers = useMemo(() => {
    if (!data || data.length === 0) return { anggota: [], nonKK: [], pencairan: [] };

    // Sort descending for each category and take top 3
    const anggota = [...data].sort((a, b) => {
      const pA = b.arsip_anggota?.[0]?.prosentase ?? 0;
      const pB = a.arsip_anggota?.[0]?.prosentase ?? 0;
      return pA - pB;
    }).filter(d => (d.arsip_anggota?.[0]?.prosentase ?? 0) > 0).slice(0, 3).map(d => ({
      nama_cabang: d.nama_cabang,
      score: d.arsip_anggota?.[0]?.prosentase ?? 0
    }));

    const nonKK = [...data].sort((a, b) => {
      const pA = b.arsip_anggota?.[0]?.toleransi_kk ?? 0;
      const pB = a.arsip_anggota?.[0]?.toleransi_kk ?? 0;
      return pA - pB;
    }).filter(d => (d.arsip_anggota?.[0]?.toleransi_kk ?? 0) > 0).slice(0, 3).map(d => ({
      nama_cabang: d.nama_cabang,
      score: d.arsip_anggota?.[0]?.toleransi_kk ?? 0
    }));

    const pencairan = [...data].sort((a, b) => {
      const pA = calcPencairanPct(b.arsip_pencairan?.[0] ?? null);
      const pB = calcPencairanPct(a.arsip_pencairan?.[0] ?? null);
      return pA - pB;
    }).filter(d => calcPencairanPct(d.arsip_pencairan?.[0] ?? null) > 0).slice(0, 3).map(d => ({
      nama_cabang: d.nama_cabang,
      score: calcPencairanPct(d.arsip_pencairan?.[0] ?? null)
    }));

    return {
      anggota,
      nonKK,
      pencairan
    };
  }, [data]);

  // ── PctCell ────────────────────────────────
  const PctCell = ({ pct }: { pct: number }) => {
    const cls = getPctClass(pct);
    return (
      <div className="arsip-pct-cell">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="arsip-pct-label">{pct.toFixed(2)}%</span>
          <span className={`arsip-pct-status ${cls}`}>{getPctLabel(pct)}</span>
        </div>
        <div className="arsip-pct-bar-track">
          <div className={`arsip-pct-bar-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────
  return (
    <div className="arsip-container page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Arsip Digital</h1>
          <p>Monitoring kelengkapan arsip dokumen seluruh cabang</p>
        </div>
        {isSuperAdmin && (
          <div className="header-actions">
            <button className="btn btn-primary kj-btn-compact" onClick={openAdd}>
              <Plus size={14} />
              <span>Tambah Data</span>
            </button>
          </div>
        )}
      </div>

      {/* Notification */}
      {message.text && (
        <div className={`arsip-notification ${message.type}`}>{message.text}</div>
      )}

      {/* Keterangan */}
      <div className="arsip-info-box">
        <ul>
          <li><strong>Arsip Data Anggota</strong> Perhitungan berdasarkan keseluruhan data anggota aktif dengan kelengkapan dokumen wajib 01–08.</li>
          <li><strong>Arsip Data Anggota NON KK</strong> Perhitungan berdasarkan keseluruhan data anggota aktif, dengan ketentuan anggota yang bergabung sebelum tahun 2025 tidak diperhitungkan. Kelengkapan dokumen wajib 01–08, dengan pengecualian dokumen 02.</li>
          <li><strong>Arsip Pencairan</strong> Perhitungan berdasarkan keseluruhan data pencairan pada periode tahun 2026 sampai dengan 17 Juni 2026.</li>
        </ul>
      </div>

      {/* Top Performers Strip */}
      <div className="arsip-top-performers-container">
        <h3 className="arsip-section-title"><Trophy size={16} /> Cabang Terbaik (Top Performers)</h3>
        <div className="arsip-top-strip">
          {/* Anggota */}
          <div className="arsip-top-card">
            <div className="arsip-top-icon gold"><Award size={22} /></div>
            <div className="arsip-top-info">
              <div className="arsip-top-label">Arsip Data Anggota</div>
              {topPerformers.anggota.length > 0 ? (
                <div className="arsip-top-list">
                  {topPerformers.anggota.map((c, i) => (
                    <div key={i} className="arsip-top-list-item">
                      <span className="arsip-top-rank">{i + 1}.</span>
                      <span className="arsip-top-name">{c.nama_cabang}</span>
                      <span className="arsip-top-score-sm">{c.score.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="arsip-top-names empty">-</div>
              )}
            </div>
          </div>
          {/* Non-KK */}
          <div className="arsip-top-card">
            <div className="arsip-top-icon silver"><Star size={22} /></div>
            <div className="arsip-top-info">
              <div className="arsip-top-label">Arsip Anggota Non-KK</div>
              {topPerformers.nonKK.length > 0 ? (
                <div className="arsip-top-list">
                  {topPerformers.nonKK.map((c, i) => (
                    <div key={i} className="arsip-top-list-item">
                      <span className="arsip-top-rank">{i + 1}.</span>
                      <span className="arsip-top-name">{c.nama_cabang}</span>
                      <span className="arsip-top-score-sm">{c.score.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="arsip-top-names empty">-</div>
              )}
            </div>
          </div>
          {/* Pencairan */}
          <div className="arsip-top-card">
            <div className="arsip-top-icon bronze"><Award size={22} /></div>
            <div className="arsip-top-info">
              <div className="arsip-top-label">Arsip Pencairan</div>
              {topPerformers.pencairan.length > 0 ? (
                <div className="arsip-top-list">
                  {topPerformers.pencairan.map((c, i) => (
                    <div key={i} className="arsip-top-list-item">
                      <span className="arsip-top-rank">{i + 1}.</span>
                      <span className="arsip-top-name">{c.nama_cabang}</span>
                      <span className="arsip-top-score-sm">{c.score.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="arsip-top-names empty">-</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="arsip-stats-strip">
        <div className="arsip-stat-card">
          <div className="arsip-stat-icon blue"><FolderArchive size={18} /></div>
          <div className="arsip-stat-info">
            <div className="arsip-stat-label">Total Cabang</div>
            <div className="arsip-stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="arsip-stat-card">
          <div className="arsip-stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="arsip-stat-info">
            <div className="arsip-stat-label">≥ 85% (Baik)</div>
            <div className="arsip-stat-value">{stats.good}</div>
          </div>
        </div>
        <div className="arsip-stat-card">
          <div className="arsip-stat-icon yellow"><AlertCircle size={18} /></div>
          <div className="arsip-stat-info">
            <div className="arsip-stat-label">70–84% (Perhatian)</div>
            <div className="arsip-stat-value">{stats.warn}</div>
          </div>
        </div>
        <div className="arsip-stat-card">
          <div className="arsip-stat-icon red"><XCircle size={18} /></div>
          <div className="arsip-stat-info">
            <div className="arsip-stat-label">&lt; 70% (Tindak Lanjut)</div>
            <div className="arsip-stat-value">{stats.bad}</div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card className="table-card">
        {/* Toolbar */}
        <div className="arsip-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari cabang..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
            <ArrowUpDown size={14} />
            <select className="arsip-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="anggota_desc">Arsip Anggota Terbesar</option>
              <option value="non_kk_desc">Arsip Anggota Non KK Terbesar</option>
              <option value="pencairan_desc">Arsip Pencairan Terbesar</option>
              <option value="nama_az">Nama Cabang A–Z</option>
              <option value="tanggal">Tanggal Cek Terbaru</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center-text">No</th>
                <th>Kode Cabang</th>
                <th>Nama Cabang</th>
                <th>Arsip Data Anggota (%)</th>
                <th>Arsip Data Anggota (Non-KK) (%)</th>
                <th>Arsip Pencairan (%)</th>
                <th>Tanggal Cek</th>
                <th className="center-text">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'var(--color-text-muted)' }}>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Memuat data arsip...</span>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="arsip-empty">
                      <FolderArchive size={40} />
                      <p>{searchQuery ? 'Tidak ada cabang yang cocok.' : 'Belum ada data arsip.'}</p>
                    </div>
                  </td>
                </tr>
              ) : processedData.map((item, idx) => {
                const anggota = item.arsip_anggota?.[0];
                const pencairan = item.arsip_pencairan?.[0];
                const pctAnggota = anggota?.prosentase ?? 0;
                const pctPencairan = calcPencairanPct(pencairan ?? null);
                return (
                  <tr key={item.id}>
                    <td data-label="No" className="center-text mono">{idx + 1}</td>
                    <td data-label="Kode Cabang" className="mono fw-500">{item.kode_cabang}</td>
                    <td data-label="Nama Cabang" className="fw-500">{item.nama_cabang}</td>
                    <td data-label="Arsip Anggota">
                      <PctCell pct={pctAnggota} />
                    </td>
                    <td data-label="Arsip Anggota (Non-KK)">
                      <PctCell pct={anggota?.toleransi_kk ?? 0} />
                    </td>
                    <td data-label="Arsip Pencairan">
                      <PctCell pct={pctPencairan} />
                    </td>
                    <td data-label="Tanggal Cek" className="arsip-date-cell">
                      {formatDate(item.tanggal_cek)}
                    </td>
                    <td data-label="Aksi" className="center-text">
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          className="icon-btn"
                          title="Lihat Detail"
                          onClick={() => { setDrawerItem(item); setDrawerOpen(true); }}
                        >
                          <Eye size={14} />
                        </button>
                        {isSuperAdmin && (
                          <>
                            <button className="icon-btn" title="Edit" onClick={() => openEdit(item)}>
                              <Pencil size={14} />
                            </button>
                            <button className="icon-btn" title="Hapus" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(item)}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── DETAIL DRAWER ── */}
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Detail Arsip — ${drawerItem?.nama_cabang ?? ''}`}>
        {drawerItem && (() => {
          const ang = drawerItem.arsip_anggota?.[0];
          const pen = drawerItem.arsip_pencairan?.[0];
          const pctAng = ang?.prosentase ?? 0;
          const pctPen = calcPencairanPct(pen ?? null);
          const clsAng = getPctClass(pctAng);
          const clsPen = getPctClass(pctPen);

          return (
            <div className="arsip-detail-content">
              {/* Header info */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <span>Kode: <strong style={{ color: 'var(--color-text-main)' }}>{drawerItem.kode_cabang}</strong></span>
                <span>Tanggal Cek: <strong style={{ color: 'var(--color-text-main)' }}>{formatDate(drawerItem.tanggal_cek)}</strong></span>
              </div>

              {/* Section 1: Arsip Anggota */}
              <div className="arsip-detail-section">
                <div className="arsip-detail-section-title">1. Arsip Data Anggota</div>

                {/* Score bar */}
                <div className="arsip-score-bar">
                  <div className="arsip-score-bar-label">
                    <span>Prosentase Kelengkapan</span>
                    <span style={{ color: `var(--color-${clsAng === 'good' ? 'success' : clsAng === 'warn' ? 'warning' : 'danger'})` }}>
                      {pctAng.toFixed(2)}%
                    </span>
                  </div>
                  <div className="arsip-pct-bar-track">
                    <div className={`arsip-pct-bar-fill ${clsAng}`} style={{ width: `${Math.min(pctAng, 100)}%` }} />
                  </div>
                </div>

                {/* Summary grid */}
                <div className="arsip-summary-grid">
                  <div className="arsip-summary-item">
                    <div className="s-label">Member</div>
                    <div className="s-value">{ang?.member?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-green">
                    <div className="s-label">Lengkap</div>
                    <div className="s-value">{ang?.lengkap?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-yellow">
                    <div className="s-label">Kurang</div>
                    <div className="s-value">{ang?.kurang?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-red">
                    <div className="s-label">Tidak Ditemukan</div>
                    <div className="s-value">{ang?.tidak_ditemukan?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item">
                    <div className="s-label">Tidak Aktif</div>
                    <div className="s-value">{ang?.tidak_aktif?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item">
                    <div className="s-label">Toleransi KK 2025</div>
                    <div className="s-value">{ang?.toleransi_kk?.toFixed(2) ?? '-'}%</div>
                  </div>
                </div>

                {/* Document detail */}
                {(drawerItem.arsip_anggota_detail?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Detail Dokumen Anggota (Kurang)
                    </div>
                    <table className="arsip-detail-doc-table">
                      <thead>
                        <tr>
                          <th>Kode</th>
                          <th>Nama Dokumen</th>
                          <th style={{ textAlign: 'right' }}>Jumlah Kurang</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drawerItem.arsip_anggota_detail!
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

                {/* Score bar */}
                <div className="arsip-score-bar">
                  <div className="arsip-score-bar-label">
                    <span>Prosentase Arsip Pencairan</span>
                    <span style={{ color: `var(--color-${clsPen === 'good' ? 'success' : clsPen === 'warn' ? 'warning' : 'danger'})` }}>
                      {pctPen.toFixed(2)}%
                    </span>
                  </div>
                  <div className="arsip-pct-bar-track">
                    <div className={`arsip-pct-bar-fill ${clsPen}`} style={{ width: `${Math.min(pctPen, 100)}%` }} />
                  </div>
                </div>

                {pen?.periode && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                    Periode: <strong style={{ color: 'var(--color-text-main)' }}>{pen.periode}</strong>
                  </div>
                )}

                <div className="arsip-summary-grid">
                  <div className="arsip-summary-item">
                    <div className="s-label">Total Pinjaman</div>
                    <div className="s-value">{pen?.total_pinjaman?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-green">
                    <div className="s-label">Arsip Lengkap</div>
                    <div className="s-value">{pen?.arsip_lengkap?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-yellow">
                    <div className="s-label">Nama File Tdk Sesuai</div>
                    <div className="s-value">{pen?.nama_file_tidak_sesuai?.toLocaleString() ?? '-'}</div>
                  </div>
                  <div className="arsip-summary-item s-red">
                    <div className="s-label">File Tidak Lengkap</div>
                    <div className="s-value">{pen?.file_tidak_lengkap?.toLocaleString() ?? '-'}</div>
                  </div>
                </div>

                {(drawerItem.arsip_pencairan_detail?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Detail Dokumen Pencairan (Kurang File)
                    </div>
                    <table className="arsip-detail-doc-table">
                      <thead>
                        <tr>
                          <th>Kode</th>
                          <th>Nama Dokumen</th>
                          <th style={{ textAlign: 'right' }}>Jumlah Kurang File</th>
                        </tr>
                      </thead>
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

export default ArsipDigital;
