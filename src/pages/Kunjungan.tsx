import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, Plus, Pencil, Trash2,
  X, Loader2, CheckCircle2, Save, Printer, Eye, ClipboardCheck, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Kunjungan.css';

interface KunjunganCabang {
  id: string;
  cabang_id: string;
  nama_cabang: string;
  nama_msa: string;
  tanggal_kunjungan: string;
  c_folder_d_rapi: boolean;
  c_dok_surat_ceklist: boolean;
  n_kurang_surat_ceklist: number;
  c_dok_data_anggota: boolean;
  n_kurang_data_anggota: number;
  c_dok_anggota_keluar: boolean;
  n_kurang_anggota_keluar: number;
  c_dok_dana_resiko: boolean;
  n_kurang_dana_resiko: number;
  c_dok_sihara: boolean;
  n_kurang_sihara: number;
  c_dok_laporan_bulanan: boolean;
  n_kurang_laporan_bulanan: number;
  c_dok_lwk: boolean;
  n_kurang_lwk: number;
  c_pending_mdis: boolean;
  c_briefing_buku_tamu: boolean;
  c_kpa_akad: boolean;
  c_stok_formulir: boolean;
  c_sampling_phone: boolean;
  c_penyimpangan_ada: boolean;
  c_maintenance_komputer: boolean;
  c_stok_toner: boolean;
  c_fixed_asset: boolean;
  catatan_kendala: string;
  tindak_lanjut: string;
  kesimpulan: string;
  catatan_cabang_terdekat: string;
  status_laporan: string;
}

const defaultFormState: Omit<KunjunganCabang, 'id'> = {
  cabang_id: '',
  nama_cabang: '',
  nama_msa: '',
  tanggal_kunjungan: '',
  c_folder_d_rapi: false,
  c_dok_surat_ceklist: false,
  n_kurang_surat_ceklist: 0,
  c_dok_data_anggota: false,
  n_kurang_data_anggota: 0,
  c_dok_anggota_keluar: false,
  n_kurang_anggota_keluar: 0,
  c_dok_dana_resiko: false,
  n_kurang_dana_resiko: 0,
  c_dok_sihara: false,
  n_kurang_sihara: 0,
  c_dok_laporan_bulanan: false,
  n_kurang_laporan_bulanan: 0,
  c_dok_lwk: false,
  n_kurang_lwk: 0,
  c_pending_mdis: false,
  c_briefing_buku_tamu: false,
  c_kpa_akad: false,
  c_stok_formulir: false,
  c_sampling_phone: false,
  c_penyimpangan_ada: false,
  c_maintenance_komputer: false,
  c_stok_toner: false,
  c_fixed_asset: false,
  catatan_kendala: '',
  tindak_lanjut: '',
  kesimpulan: '',
  catatan_cabang_terdekat: '',
  status_laporan: 'Draft'
};

const Kunjungan = () => {
  const sessionData = sessionStorage.getItem('msa_session');
  const sessionUser = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = sessionUser?.role?.toLowerCase().includes('admin');
  const userCabangId = sessionUser?.cabang_id;

  const [data, setData] = useState<KunjunganCabang[]>([]);
  const [cabangOptions, setCabangOptions] = useState<{id: string, nama_cabang: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBulan, setFilterBulan] = useState('');
  const [filterCabang, setFilterCabang] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KunjunganCabang | null>(null);
  const [formData, setFormData] = useState<Omit<KunjunganCabang, 'id'>>(defaultFormState);
  const [saving, setSaving] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCabangOptions();
    fetchData();
  }, []);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchCabangOptions = async () => {
    try {
      const { data, error } = await supabase.from('cabang').select('id, nama_cabang').order('nama_cabang');
      if (error) throw error;
      setCabangOptions(data || []);
    } catch (err) {
      console.error('Error fetching cabang:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('kunjungan_cabang')
        .select('*')
        .order('tanggal_kunjungan', { ascending: false });

      if (!isAdmin && userCabangId) {
        query = query.eq('cabang_id', userCabangId);
      }

      const { data: list, error } = await query;

      if (error) throw error;
      setData(list || []);
    } catch (err: any) {
      console.error('Error fetching kunjungan:', err);
      setMessage({ type: 'error', text: 'Gagal mengambil data kunjungan.' });
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    const defaultCabangId = !isAdmin && userCabangId ? userCabangId : '';
    // We can't immediately rely on finding the name if cabangOptions hasn't loaded yet,
    // but assuming it's loaded:
    const defaultNamaCabang = defaultCabangId ? (cabangOptions.find(c => c.id === defaultCabangId)?.nama_cabang || '') : '';

    setFormData({
      ...defaultFormState,
      cabang_id: defaultCabangId,
      nama_cabang: defaultNamaCabang,
      nama_msa: sessionUser?.fullName || ''
    });
    setShowModal(true);
  };

  const openEditModal = (item: KunjunganCabang) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const openDetailModal = (item: KunjunganCabang) => {
    setEditingItem(item);
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowDetailModal(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    if (!formData.cabang_id || !formData.nama_msa || !formData.tanggal_kunjungan) {
      setMessage({ type: 'error', text: 'Cabang, MSA, dan Tanggal wajib diisi!' });
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('kunjungan_cabang')
          .update(formData)
          .eq('id', editingItem.id);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Data kunjungan berhasil diupdate.' });
      } else {
        const { error } = await supabase
          .from('kunjungan_cabang')
          .insert([formData]);
        if (error) {
          if (error.code === '23505') { // unique violation
            throw new Error('Data kunjungan untuk cabang dan tanggal tersebut sudah ada.');
          }
          throw error;
        }
        setMessage({ type: 'success', text: 'Data kunjungan berhasil ditambahkan.' });
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan data.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: KunjunganCabang) => {
    if (!window.confirm(`Hapus laporan kunjungan cabang ${item.nama_cabang} tanggal ${item.tanggal_kunjungan}?`)) return;
    try {
      const { error } = await supabase
        .from('kunjungan_cabang')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Data kunjungan berhasil dihapus.' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus data.' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintItem = (item: KunjunganCabang) => {
    setEditingItem(item);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const calculateScore = (item: KunjunganCabang | Omit<KunjunganCabang, 'id'>) => {
    let score = 0;
    if (item.c_folder_d_rapi) score++;
    if (item.c_dok_surat_ceklist) score++;
    if (item.c_dok_data_anggota) score++;
    if (item.c_dok_anggota_keluar) score++;
    if (item.c_dok_dana_resiko) score++;
    if (item.c_dok_sihara) score++;
    if (item.c_dok_laporan_bulanan) score++;
    if (item.c_dok_lwk) score++;
    if (item.c_pending_mdis) score++;
    if (item.c_briefing_buku_tamu) score++;
    if (item.c_kpa_akad) score++;
    if (item.c_stok_formulir) score++;
    if (item.c_sampling_phone) score++;
    if (!item.c_penyimpangan_ada) score++; // Terbalik
    if (item.c_maintenance_komputer) score++;
    if (item.c_stok_toner) score++;
    if (item.c_fixed_asset) score++;
    return score;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Selesai': return 'selesai';
      case 'Draft': return 'draft';
      case 'Perlu Tindak Lanjut': return 'perlu-tindak';
      default: return 'draft';
    }
  };

  const filteredData = data.filter(item => {
    const matchSearch = item.nama_cabang.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.nama_msa.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBulan = filterBulan ? item.tanggal_kunjungan.startsWith(filterBulan) : true;
    const matchCabang = filterCabang ? item.nama_cabang === filterCabang : true;
    const matchStatus = filterStatus ? item.status_laporan === filterStatus : true;
    return matchSearch && matchBulan && matchCabang && matchStatus;
  });

  const uniqueCabang = Array.from(new Set(data.map(d => d.nama_cabang))).sort();
  const totalKunjungan = data.length;
  const uniqueCabangVisited = uniqueCabang.length;
  const selesaiCount = data.filter(d => d.status_laporan === 'Selesai').length;
  const perluTindakCount = data.filter(d => d.status_laporan === 'Perlu Tindak Lanjut').length;

  const handleCheckboxChange = (field: keyof KunjunganCabang) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field as keyof typeof prev] }));
  };

  const renderChecklistItem = (label: string, field: keyof KunjunganCabang, isWarningLogic = false) => {
    const isChecked = Boolean(formData[field as keyof typeof formData]);
    const checkedClass = isWarningLogic ? (isChecked ? 'checked-warn' : '') : (isChecked ? 'checked' : '');
    return (
      <div className={`kj-checklist-item ${checkedClass}`} onClick={() => handleCheckboxChange(field)}>
        <div className="kj-checklist-checkbox">
          {isChecked && <CheckCircle2 size={12} color="#fff" />}
        </div>
        <div className="kj-checklist-label">{label}</div>
      </div>
    );
  };

  const handleKurangChange = (field: keyof KunjunganCabang, value: string) => {
    const num = parseInt(value, 10);
    setFormData(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  };

  const renderDocChecklistItem = (label: string, boolField: keyof KunjunganCabang, numField: keyof KunjunganCabang) => {
    const isChecked = Boolean(formData[boolField as keyof typeof formData]);
    const checkedClass = isChecked ? 'checked' : '';
    return (
      <div className="kj-doc-checklist-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div className={`kj-checklist-item ${checkedClass}`} style={{ flex: 1, marginBottom: 0 }} onClick={() => handleCheckboxChange(boolField)}>
          <div className="kj-checklist-checkbox">
            {isChecked && <CheckCircle2 size={12} color="#fff" />}
          </div>
          <div className="kj-checklist-label">{label}</div>
        </div>
        {!isChecked && (
          <div className="kj-checklist-input-kurang" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input 
              type="number" 
              min="0" 
              placeholder="Jml" 
              value={(formData[numField as keyof typeof formData] as number) || ''}
              onChange={(e) => handleKurangChange(numField, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '40px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <span style={{ fontSize: '10px', color: '#64748b' }}>krg</span>
          </div>
        )}
      </div>
    );
  };

  const renderDetailChecklist = (label: string, field: keyof KunjunganCabang, isWarningLogic = false) => {
    if (!editingItem) return null;
    const isChecked = Boolean(editingItem[field as keyof typeof editingItem]);
    let statusClass = 'no';
    if (isWarningLogic) {
      statusClass = isChecked ? 'warn' : 'yes';
    } else {
      statusClass = isChecked ? 'yes' : 'no';
    }
    
    return (
      <div className={`kj-detail-checklist-row ${statusClass}`}>
        {statusClass === 'yes' ? <CheckCircle2 size={14} /> : (statusClass === 'warn' ? <AlertTriangle size={14} /> : <X size={14} />)}
        <span>{label}</span>
      </div>
    );
  };

  const renderDetailDocChecklist = (label: string, boolField: keyof KunjunganCabang, numField: keyof KunjunganCabang) => {
    if (!editingItem) return null;
    const isChecked = Boolean(editingItem[boolField as keyof typeof editingItem]);
    const kurangCount = Number(editingItem[numField as keyof typeof editingItem]) || 0;
    
    return (
      <div className={`kj-detail-checklist-row ${isChecked ? 'yes' : 'no'}`}>
        {isChecked ? <CheckCircle2 size={14} /> : <X size={14} />}
        <span>{label} {(!isChecked && kurangCount > 0) ? `(Kurang: ${kurangCount} file)` : ''}</span>
      </div>
    );
  };

  return (
    <div className="kunjungan-container kj-print-hide">
      <div className="kunjungan-header">
        <div className="kunjungan-header-titles">
          <h1>Laporan Kunjungan</h1>
          <span className="kunjungan-subtitle">Monitoring dan pencatatan hasil kunjungan cabang MSA.</span>
        </div>
        <div className="kunjungan-header-actions">
          <button className="btn btn-outline kj-btn-compact" onClick={handlePrint}>
            <Printer size={14} />
            <span>Cetak Rekap</span>
          </button>
          <button className="btn btn-primary kj-btn-compact" onClick={openAddModal}>
            <Plus size={14} />
            <span>Tambah Kunjungan</span>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`kunjungan-toast ${message.type}`}>
          <CheckCircle2 size={13} />
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="kunjungan-stats-grid">
        <Card className="kunjungan-stat-card">
          <div className="kunjungan-stat-icon blue">
            <ClipboardCheck size={20} />
          </div>
          <div className="kunjungan-stat-info">
            <h4>Total Kunjungan</h4>
            <div className="kunjungan-stat-value">{totalKunjungan}</div>
            <div className="kunjungan-stat-sub">Semua data terinput</div>
          </div>
        </Card>
        <Card className="kunjungan-stat-card">
          <div className="kunjungan-stat-icon green">
            <Building2 size={20} />
          </div>
          <div className="kunjungan-stat-info">
            <h4>Cabang Dikunjungi</h4>
            <div className="kunjungan-stat-value">{uniqueCabangVisited}</div>
            <div className="kunjungan-stat-sub">Cabang unik</div>
          </div>
        </Card>
        <Card className="kunjungan-stat-card">
          <div className="kunjungan-stat-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div className="kunjungan-stat-info">
            <h4>Laporan Selesai</h4>
            <div className="kunjungan-stat-value">{selesaiCount}</div>
            <div className="kunjungan-stat-sub">Status Selesai</div>
          </div>
        </Card>
        <Card className="kunjungan-stat-card">
          <div className="kunjungan-stat-icon orange">
            <AlertTriangle size={20} />
          </div>
          <div className="kunjungan-stat-info">
            <h4>Perlu Tindak Lanjut</h4>
            <div className="kunjungan-stat-value">{perluTindakCount}</div>
            <div className="kunjungan-stat-sub">Menunggu perbaikan</div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="kunjungan-filter-bar">
        <div className="kunjungan-search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari cabang atau nama MSA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="kunjungan-filter-group">
          <label>Bulan Kunjungan</label>
          <input 
            type="month" 
            value={filterBulan} 
            onChange={(e) => setFilterBulan(e.target.value)} 
          />
        </div>
        <div className="kunjungan-filter-group">
          <label>Cabang</label>
          <select value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)}>
            <option value="">Semua Cabang</option>
            {uniqueCabang.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="kunjungan-filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="Selesai">Selesai</option>
            <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
        {(searchQuery || filterBulan || filterCabang || filterStatus) && (
          <button 
            className="kunjungan-filter-reset"
            onClick={() => { setSearchQuery(''); setFilterBulan(''); setFilterCabang(''); setFilterStatus(''); }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <Card className="kunjungan-table-card">
        <div className="kunjungan-table-card-header">
          <h3>Daftar Hasil Kunjungan Cabang</h3>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{filteredData.length} data ditemukan</span>
        </div>
        <div className="kunjungan-table-wrapper">
          {loading ? (
             <div className="kj-loading">
               <Loader2 className="animate-spin" size={24} />
               <span>Memuat data kunjungan...</span>
             </div>
          ) : filteredData.length === 0 ? (
            <div className="kj-empty">
              <ClipboardCheck size={40} className="kj-empty-icon" />
              <h4>Belum Ada Data</h4>
              <p>Belum ada laporan kunjungan yang sesuai dengan filter.</p>
            </div>
          ) : (
            <table className="kunjungan-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th>Tanggal</th>
                  <th>Cabang</th>
                  <th>Nama MSA</th>
                  <th>Skor Evaluasi</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => {
                  const score = calculateScore(item);
                  const total = 17;
                  const pct = Math.round((score / total) * 100);
                  const scoreClass = pct >= 80 ? 'good' : (pct >= 50 ? 'warn' : 'bad');
                  
                  return (
                    <tr key={item.id}>
                      <td data-label="No">{index + 1}</td>
                      <td data-label="Cabang">
                        {item.nama_cabang}
                        <br/>
                        <span className="kj-date-sub">{formatDate(item.tanggal_kunjungan)}</span>
                      </td>
                      <td data-label="Nama MSA">
                        {item.nama_msa}
                      </td>
                      <td data-label="Skor">
                        <div className="kj-score">
                          <div className="kj-score-bar">
                            <div className={`kj-score-fill ${scoreClass}`} style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="kj-score-label">{score}/17 ({pct}%)</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`kj-status ${getStatusClass(item.status_laporan)}`}>
                          <span className="kj-status-dot"></span>
                          {item.status_laporan}
                        </span>
                      </td>
                      <td data-label="Aksi">
                        <div className="kj-action-buttons">
                          <button className="kj-action-btn view" title="Lihat Detail" onClick={() => openDetailModal(item)}>
                            <Eye size={14} />
                          </button>
                          <button className="kj-action-btn print" title="Cetak" onClick={() => handlePrintItem(item)}>
                            <Printer size={14} />
                          </button>
                          <button className="kj-action-btn edit" title="Edit" onClick={() => openEditModal(item)}>
                            <Pencil size={14} />
                          </button>
                          <button className="kj-action-btn delete" title="Hapus" onClick={() => handleDelete(item)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* FORM MODAL */}
      {showModal && (
        <div className="kj-modal-overlay" onClick={closeModal}>
          <div className="kj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kj-modal-header">
              <h3>{editingItem ? 'Edit Data Kunjungan' : 'Tambah Kunjungan Cabang'}</h3>
              <div className="kj-modal-close" onClick={closeModal}><X size={18} /></div>
            </div>
            <div className="kj-modal-body">
              <div className="kj-form-section">
                <div className="kj-form-section-title">Informasi Dasar</div>
                <div className="kj-form-row three">
                  <div className="kj-form-group">
                    <label>Nama Cabang <span className="required">*</span></label>
                    <select 
                      value={formData.cabang_id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedCabang = cabangOptions.find(c => c.id === selectedId);
                        setFormData({
                          ...formData,
                          cabang_id: selectedId,
                          nama_cabang: selectedCabang ? selectedCabang.nama_cabang : ''
                        });
                      }}
                      disabled={!isAdmin && !!userCabangId}
                      style={{ height: '34px' }}
                    >
                      <option value="">Pilih Cabang...</option>
                      {cabangOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.nama_cabang}</option>
                      ))}
                    </select>
                  </div>
                  <div className="kj-form-group">
                    <label>Nama MSA/FSA <span className="required">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Nama petugas..." 
                      value={formData.nama_msa}
                      onChange={(e) => setFormData({...formData, nama_msa: e.target.value})}
                    />
                  </div>
                  <div className="kj-form-group">
                    <label>Tanggal Kunjungan <span className="required">*</span></label>
                    <input 
                      type="date" 
                      value={formData.tanggal_kunjungan}
                      onChange={(e) => setFormData({...formData, tanggal_kunjungan: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="kj-form-section">
                <div className="kj-form-section-title">Checklist Evaluasi</div>
                
                <div className="kj-form-row">
                  {/* Kategori 1 */}
                  <div className="kj-checklist-grid">
                    <div className="kj-checklist-sub-title">A. Backup & Arsip Digital</div>
                    {renderChecklistItem('Struktur folder D:\\ sudah rapi sesuai ketentuan?', 'c_folder_d_rapi')}
                    
                    <div className="kj-checklist-sub-title" style={{ marginTop: '8px', fontSize: '10px' }}>Dokumen Harian Sudah Discan:</div>
                    {renderDocChecklistItem('Data Surat Ceklist', 'c_dok_surat_ceklist', 'n_kurang_surat_ceklist')}
                    {renderDocChecklistItem('Data Anggota', 'c_dok_data_anggota', 'n_kurang_data_anggota')}
                    {renderDocChecklistItem('Anggota Keluar', 'c_dok_anggota_keluar', 'n_kurang_anggota_keluar')}
                    {renderDocChecklistItem('Dana Resiko', 'c_dok_dana_resiko', 'n_kurang_dana_resiko')}
                    {renderDocChecklistItem('SIHARA', 'c_dok_sihara', 'n_kurang_sihara')}
                    {renderDocChecklistItem('Laporan Bulanan', 'c_dok_laporan_bulanan', 'n_kurang_laporan_bulanan')}
                    {renderDocChecklistItem('Data LWK', 'c_dok_lwk', 'n_kurang_lwk')}
                  </div>

                  {/* Kategori 2, 3, 4, 5 */}
                  <div className="kj-checklist-grid">
                    <div className="kj-checklist-sub-title">B. MDISMO & Sistem</div>
                    {renderChecklistItem('Inputan Pending mdis', 'c_pending_mdis')}

                    <div className="kj-checklist-sub-title" style={{marginTop: '12px'}}>C. Operasional Harian</div>
                    {renderChecklistItem('Laporan harian briefing', 'c_briefing_buku_tamu')}
                    {renderChecklistItem('Print KPA', 'c_kpa_akad')}
                    {renderChecklistItem('Stok Formulir', 'c_stok_formulir')}

                    <div className="kj-checklist-sub-title" style={{marginTop: '12px'}}>D. Kontrol & Kepatuhan</div>
                    {renderChecklistItem('Sampling by phone (pencairan/penarikan) dilakukan?', 'c_sampling_phone')}
                    {renderChecklistItem('Ada penyimpangan data belum dilaporkan?', 'c_penyimpangan_ada', true)}

                    <div className="kj-checklist-sub-title" style={{marginTop: '12px'}}>E. Aset & IT</div>
                    {renderChecklistItem('Maintenance komputer bulan ini dilakukan?', 'c_maintenance_komputer')}
                    {renderChecklistItem('Stok toner masih aman?', 'c_stok_toner')}
                    {renderChecklistItem('Nomor & kondisi fixed asset dicek bulan ini?', 'c_fixed_asset')}
                  </div>
                </div>
              </div>

              <div className="kj-form-section">
                <div className="kj-form-section-title">Catatan & Kesimpulan</div>
                <div className="kj-form-group">
                  <label>Catatan Kendala Utama</label>
                  <textarea 
                    placeholder="Tuliskan kendala yang ditemukan..."
                    value={formData.catatan_kendala}
                    onChange={(e) => setFormData({...formData, catatan_kendala: e.target.value})}
                  />
                </div>
                <div className="kj-form-group">
                  <label>Tindak Lanjut / Rekomendasi</label>
                  <textarea 
                    placeholder="Tindakan yang perlu dilakukan..."
                    value={formData.tindak_lanjut}
                    onChange={(e) => setFormData({...formData, tindak_lanjut: e.target.value})}
                  />
                </div>
                <div className="kj-form-row">
                  <div className="kj-form-group">
                    <label>Kesimpulan Akhir</label>
                    <textarea 
                      placeholder="Kesimpulan kunjungan..."
                      value={formData.kesimpulan}
                      style={{ minHeight: '40px' }}
                      onChange={(e) => setFormData({...formData, kesimpulan: e.target.value})}
                    />
                  </div>
                  <div className="kj-form-group">
                    <label>Informasi 3 Cabang Terdekat</label>
                    <textarea 
                      placeholder="Tuliskan informasi 3 cabang terdekat..."
                      value={formData.catatan_cabang_terdekat}
                      style={{ minHeight: '40px' }}
                      onChange={(e) => setFormData({...formData, catatan_cabang_terdekat: e.target.value})}
                    />
                  </div>
                  <div className="kj-form-group">
                    <label>Status Laporan <span className="required">*</span></label>
                    <select 
                      value={formData.status_laporan}
                      onChange={(e) => setFormData({...formData, status_laporan: e.target.value})}
                      style={{ height: '100%' }}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
            <div className="kj-modal-footer">
              <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Simpan Kunjungan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Also used for individual print) */}
      {showDetailModal && editingItem && (
        <div className="kj-modal-overlay" onClick={closeModal}>
          <div className="kj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kj-modal-header kj-print-hide">
              <h3>Detail Kunjungan</h3>
              <div className="kj-modal-close" onClick={closeModal}><X size={18} /></div>
            </div>
            <div className="kj-modal-body" ref={printRef}>
              
              {/* Layout Print Khusus */}
              <div className="kj-print-area">
                <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>FORM EVALUASI KUNJUNGAN CABANG</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Sistem Informasi Regional (SIREGI)</p>
                </div>

                <div className="kj-detail-section" style={{ marginBottom: '16px' }}>
                  <div className="kj-detail-row">
                    <div className="kj-detail-field">
                      <span>Cabang</span>
                      <span>{editingItem.nama_cabang}</span>
                    </div>
                    <div className="kj-detail-field">
                      <span>Tanggal Kunjungan</span>
                      <span>{formatDate(editingItem.tanggal_kunjungan)}</span>
                    </div>
                    <div className="kj-detail-field">
                      <span>Nama MSA/FSA</span>
                      <span>{editingItem.nama_msa}</span>
                    </div>
                    <div className="kj-detail-field">
                      <span>Status Laporan</span>
                      <span className={`kj-status ${getStatusClass(editingItem.status_laporan)}`} style={{ display: 'inline-flex', width: 'fit-content' }}>
                        {editingItem.status_laporan}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="kj-detail-section" style={{ marginBottom: '16px' }}>
                  <div className="kj-detail-section-title">Hasil Evaluasi Checklist</div>
                  <div className="kj-checklist-score-bar" style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Skor: {calculateScore(editingItem)} / 17</span>
                    <div className="bar-track">
                      <div className={`bar-fill ${(calculateScore(editingItem)/17) >= 0.8 ? 'good' : ((calculateScore(editingItem)/17) >= 0.5 ? 'warn' : 'bad')}`} style={{ width: `${(calculateScore(editingItem)/17)*100}%` }}></div>
                    </div>
                  </div>

                  <div className="kj-detail-row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>A. Backup & Arsip Digital</strong>
                      {renderDetailChecklist('Folder D:\\ rapi', 'c_folder_d_rapi')}
                      <span style={{ fontSize: '10px', color: '#666', marginTop: '6px', display: 'block' }}>Dokumen Harian Discan:</span>
                      {renderDetailDocChecklist('Data Surat Ceklist', 'c_dok_surat_ceklist', 'n_kurang_surat_ceklist')}
                      {renderDetailDocChecklist('Data Anggota', 'c_dok_data_anggota', 'n_kurang_data_anggota')}
                      {renderDetailDocChecklist('Anggota Keluar', 'c_dok_anggota_keluar', 'n_kurang_anggota_keluar')}
                      {renderDetailDocChecklist('Dana Resiko', 'c_dok_dana_resiko', 'n_kurang_dana_resiko')}
                      {renderDetailDocChecklist('SIHARA', 'c_dok_sihara', 'n_kurang_sihara')}
                      {renderDetailDocChecklist('Laporan Bulanan', 'c_dok_laporan_bulanan', 'n_kurang_laporan_bulanan')}
                      {renderDetailDocChecklist('Data LWK', 'c_dok_lwk', 'n_kurang_lwk')}
                      
                      <strong style={{ fontSize: '11px', display: 'block', margin: '12px 0 4px' }}>B. MDISMO & Sistem</strong>
                      {renderDetailChecklist('Inputan Pending mdis', 'c_pending_mdis')}
                    </div>
                    <div>
                      <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>C. Operasional Harian</strong>
                      {renderDetailChecklist('Laporan harian briefing', 'c_briefing_buku_tamu')}
                      {renderDetailChecklist('Print KPA', 'c_kpa_akad')}
                      {renderDetailChecklist('Stok Formulir', 'c_stok_formulir')}

                      <strong style={{ fontSize: '11px', display: 'block', margin: '12px 0 4px' }}>D. Kontrol & Kepatuhan</strong>
                      {renderDetailChecklist('Sampling by Phone', 'c_sampling_phone')}
                      {renderDetailChecklist('Ada Penyimpangan', 'c_penyimpangan_ada', true)}

                      <strong style={{ fontSize: '11px', display: 'block', margin: '12px 0 4px' }}>E. Aset & IT</strong>
                      {renderDetailChecklist('Maintenance Komputer', 'c_maintenance_komputer')}
                      {renderDetailChecklist('Stok Toner Aman', 'c_stok_toner')}
                      {renderDetailChecklist('Cek Fixed Asset', 'c_fixed_asset')}
                    </div>
                  </div>
                </div>

                <div className="kj-detail-section">
                  <div className="kj-detail-section-title">Catatan Kunjungan</div>
                  <div className="kj-form-group">
                    <label>Kendala Utama</label>
                    <div className="kj-detail-text">{editingItem.catatan_kendala || '-'}</div>
                  </div>
                  <div className="kj-form-group">
                    <label>Tindak Lanjut / Rekomendasi</label>
                    <div className="kj-detail-text">{editingItem.tindak_lanjut || '-'}</div>
                  </div>
                  <div className="kj-form-group">
                    <label>Kesimpulan Akhir</label>
                    <div className="kj-detail-text">{editingItem.kesimpulan || '-'}</div>
                  </div>
                  <div className="kj-form-group">
                    <label>Informasi 3 Cabang Terdekat</label>
                    <div className="kj-detail-text">{editingItem.catatan_cabang_terdekat || '-'}</div>
                  </div>
                </div>
                
                {/* Print Signatures Placeholder */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px', padding: '0 20px' }} className="print-signatures">
                  <div style={{ textAlign: 'center', width: '200px' }}>
                    <p style={{ marginBottom: '50px', fontSize: '12px' }}>Mengetahui,<br/>MSA / FSA</p>
                    <p style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '12px', width: '120px', margin: '0 auto' }}>{editingItem.nama_msa}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="kj-modal-footer kj-print-hide">
              <button className="btn btn-outline" onClick={closeModal}>Tutup</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Cetak Laporan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Kunjungan;
