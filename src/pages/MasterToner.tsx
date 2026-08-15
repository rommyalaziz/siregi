import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit, X, Search, RefreshCw, Loader2,
  History, CheckCircle, XCircle, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './MasterToner.css';

export interface MasterProdukToner {
  id: string;
  nama_produk: string;
  kategori: 'Drum' | 'Toner Mono' | 'Paket Bundling';
  tipe_printer_kompatibel: string;
  harga_satuan: number;
  is_paket: boolean;
  isi_paket: { drum?: number; toner?: number; [key: string]: any };
  aktif: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LogHargaToner {
  id: string;
  produk_id: string;
  nama_produk: string;
  harga_lama: number;
  harga_baru: number;
  diubah_oleh: string;
  created_at: string;
}

const formatRupiah = (n: number) =>
  'Rp' + new Intl.NumberFormat('id-ID').format(n || 0);

const parseRupiahInput = (v: string) =>
  parseFloat(v.replace(/[^0-9]/g, '')) || 0;

const formatTanggal = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyProductForm = () => ({
  nama_produk: '',
  kategori: 'Toner Mono' as 'Drum' | 'Toner Mono' | 'Paket Bundling',
  tipe_printer_kompatibel: '',
  harga_satuan: 0,
  is_paket: false,
  isi_paket_drum: 1,
  isi_paket_toner: 8,
  aktif: true,
});

const MasterToner: React.FC = () => {
  const [products, setProducts] = useState<MasterProdukToner[]>([]);
  const [logs, setLogs] = useState<LogHargaToner[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOldPrice, setEditingOldPrice] = useState<number | null>(null);

  const [formData, setFormData] = useState(emptyProductForm());

  const sessionData = sessionStorage.getItem('msa_session');
  const currentUser = sessionData ? JSON.parse(sessionData) : null;

  useEffect(() => {
    fetchProducts();
    fetchLogs();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master_produk_toner')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('log_harga_produk_toner')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetch logs:', err);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), type === 'error' ? 8000 : 3000);
  };

  const handleOpenAddModal = () => {
    setFormData(emptyProductForm());
    setEditingId(null);
    setEditingOldPrice(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: MasterProdukToner) => {
    setFormData({
      nama_produk: p.nama_produk,
      kategori: p.kategori,
      tipe_printer_kompatibel: p.tipe_printer_kompatibel || '',
      harga_satuan: p.harga_satuan,
      is_paket: p.is_paket,
      isi_paket_drum: p.isi_paket?.drum ?? 1,
      isi_paket_toner: p.isi_paket?.toner ?? 8,
      aktif: p.aktif,
    });
    setEditingId(p.id);
    setEditingOldPrice(p.harga_satuan);
    setIsModalOpen(true);
  };

  const handleToggleAktif = async (p: MasterProdukToner) => {
    try {
      setLoading(true);
      const nextAktif = !p.aktif;
      const { error } = await supabase
        .from('master_produk_toner')
        .update({ aktif: nextAktif, updated_at: new Date().toISOString() })
        .eq('id', p.id);

      if (error) throw error;
      showMessage(`Produk "${p.nama_produk}" ${nextAktif ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
      fetchProducts();
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nama_produk.trim()) {
      showMessage('Nama produk wajib diisi', 'error'); return;
    }
    if (formData.harga_satuan <= 0) {
      showMessage('Harga satuan wajib diisi (> 0)', 'error'); return;
    }

    try {
      setLoading(true);

      const isi_paket = formData.is_paket
        ? { drum: formData.isi_paket_drum || 0, toner: formData.isi_paket_toner || 0 }
        : {};

      const payload = {
        nama_produk: formData.nama_produk.trim(),
        kategori: formData.kategori,
        tipe_printer_kompatibel: formData.tipe_printer_kompatibel.trim(),
        harga_satuan: formData.harga_satuan,
        is_paket: formData.is_paket,
        isi_paket,
        aktif: formData.aktif,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        // Check price change
        const oldPrice = editingOldPrice ?? 0;
        const newPrice = formData.harga_satuan;

        const { error } = await supabase
          .from('master_produk_toner')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        // Log price change if price changed
        if (oldPrice !== newPrice) {
          await supabase.from('log_harga_produk_toner').insert([{
            produk_id: editingId,
            nama_produk: formData.nama_produk.trim(),
            harga_lama: oldPrice,
            harga_baru: newPrice,
            diubah_oleh: currentUser?.full_name || 'Admin',
          }]);
          fetchLogs();
        }

        showMessage('Produk berhasil diperbarui!', 'success');
      } else {
        const { error } = await supabase
          .from('master_produk_toner')
          .insert([payload]);

        if (error) throw error;
        showMessage('Produk baru berhasil ditambahkan!', 'success');
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      showMessage('Gagal menyimpan: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered product list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterStatus === 'active' && !p.aktif) return false;
      if (filterStatus === 'inactive' && p.aktif) return false;
      if (filterKategori && p.kategori !== filterKategori) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = p.nama_produk.toLowerCase().includes(q);
        const matchPrinter = p.tipe_printer_kompatibel.toLowerCase().includes(q);
        if (!matchName && !matchPrinter) return false;
      }
      return true;
    });
  }, [products, filterStatus, filterKategori, searchQuery]);

  return (
    <div className="master-toner-container">
      {message.text && (
        <div className={`notification ${message.type}`}>{message.text}</div>
      )}

      {/* Header */}
      <div className="master-header">
        <div className="header-title-box">
          <Link to="/admin/rekap-pengeluaran" className="btn-back" title="Kembali ke Rekap Pengeluaran">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1>⚙️ Master Produk Toner & Paket</h1>
            <p className="header-sub">Kelola daftar produk toner, drum, paket bundling, serta log perubahan harga.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setIsLogModalOpen(true)}>
            <History size={15} /> Log Harga ({logs.length})
          </button>
          <button className="btn-primary" onClick={handleOpenAddModal}>
            <Plus size={15} /> Tambah Produk Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-item">
          <label>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Semua Status</option>
            <option value="active">🟢 Aktif</option>
            <option value="inactive">🔴 Non-Aktif</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Kategori</label>
          <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}>
            <option value="">Semua Kategori</option>
            <option value="Drum">Drum</option>
            <option value="Toner Mono">Toner Mono</option>
            <option value="Paket Bundling">Paket Bundling</option>
          </select>
        </div>

        <div className="filter-item filter-search">
          <label>Cari Produk / Printer</label>
          <div className="search-wrap">
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Cari nama produk / printer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-item filter-actions">
          <button className="btn-icon-sm" onClick={fetchProducts} title="Refresh"><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="master-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th>Tipe Printer Kompatibel</th>
              <th className="text-right">Harga Satuan</th>
              <th>Tipe Barang</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="loading-cell">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Memuat data master toner...</span>
                </td>
              </tr>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((p, idx) => (
                <tr key={p.id} className={!p.aktif ? 'inactive-row' : ''}>
                  <td>{idx + 1}</td>
                  <td className="bold">{p.nama_produk}</td>
                  <td>
                    <span className={`kategori-badge ${p.kategori.toLowerCase().replace(' ', '-')}`}>
                      {p.kategori}
                    </span>
                  </td>
                  <td>{p.tipe_printer_kompatibel || '—'}</td>
                  <td className="text-right bold num-cell">{formatRupiah(p.harga_satuan)}</td>
                  <td>
                    {p.is_paket ? (
                      <span className="badge-paket" title={`Isi: ${p.isi_paket?.drum || 0} Drum + ${p.isi_paket?.toner || 0} Toner`}>
                        📦 Paket ({p.isi_paket?.drum || 0} Drum + {p.isi_paket?.toner || 0} Toner)
                      </span>
                    ) : (
                      <span className="badge-biasa">Unit Biasa</span>
                    )}
                  </td>
                  <td>
                    {p.aktif ? (
                      <span className="status-badge-aktif"><CheckCircle size={12} /> Aktif</span>
                    ) : (
                      <span className="status-badge-nonaktif"><XCircle size={12} /> Non-Aktif</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon" title="Edit" onClick={() => handleOpenEditModal(p)}>
                        <Edit size={14} />
                      </button>
                      <button
                        className={`btn-icon ${p.aktif ? 'delete' : 'success'}`}
                        title={p.aktif ? 'Non-aktifkan' : 'Aktifkan'}
                        onClick={() => handleToggleAktif(p)}
                      >
                        {p.aktif ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="empty-cell">
                  Belum ada produk master toner.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Add/Edit Product ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? '✏️ Edit Produk Toner' : '➕ Tambah Produk Toner Baru'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group full-width">
                <label>Nama Produk <span className="req">*</span></label>
                <input
                  type="text"
                  placeholder="Contoh: COMPATIBLE AMAZINK BROTHER Mono TN 1080"
                  value={formData.nama_produk}
                  onChange={e => setFormData({ ...formData, nama_produk: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Kategori Produk <span className="req">*</span></label>
                <select
                  value={formData.kategori}
                  onChange={e => {
                    const kat = e.target.value as any;
                    const isP = kat === 'Paket Bundling';
                    setFormData({ ...formData, kategori: kat, is_paket: isP });
                  }}
                >
                  <option value="Toner Mono">Toner Mono</option>
                  <option value="Drum">Drum</option>
                  <option value="Paket Bundling">Paket Bundling</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tipe Printer Kompatibel</label>
                <input
                  type="text"
                  placeholder="Contoh: Brother HL 1110 / 1211"
                  value={formData.tipe_printer_kompatibel}
                  onChange={e => setFormData({ ...formData, tipe_printer_kompatibel: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Harga Satuan (Standar) <span className="req">*</span></label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input
                    type="text"
                    value={formData.harga_satuan ? new Intl.NumberFormat('id-ID').format(formData.harga_satuan) : ''}
                    placeholder="0"
                    onChange={e => setFormData({ ...formData, harga_satuan: parseRupiahInput(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status Produk</label>
                <select
                  value={formData.aktif ? 'true' : 'false'}
                  onChange={e => setFormData({ ...formData, aktif: e.target.value === 'true' })}
                >
                  <option value="true">🟢 Aktif</option>
                  <option value="false">🔴 Non-Aktif</option>
                </select>
              </div>

              {/* Checkbox / Toggle Paket Bundling */}
              <div className="form-group full-width paket-toggle-box">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_paket}
                    onChange={e => setFormData({ ...formData, is_paket: e.target.checked })}
                  />
                  <span>Barang ini adalah <strong>Paket Bundling</strong> (berisi beberapa unit drum/toner sekaligus)</span>
                </label>
              </div>

              {/* Sub-form Isi Paket Bundling */}
              {formData.is_paket && (
                <div className="form-group full-width isi-paket-box">
                  <label className="box-title">📦 Rincian Isi Paket (per 1 paket)</label>
                  <div className="isi-paket-grid">
                    <div className="sub-field">
                      <label>Jumlah Drum per paket</label>
                      <input
                        type="number" min={0}
                        value={formData.isi_paket_drum}
                        onChange={e => setFormData({ ...formData, isi_paket_drum: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="sub-field">
                      <label>Jumlah Toner per paket</label>
                      <input
                        type="number" min={0}
                        value={formData.isi_paket_toner}
                        onChange={e => setFormData({ ...formData, isi_paket_toner: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="preview-text">
                    💡 Setiap 1 paket yang diinput akan tercatat otomatis sebagai <strong>{formData.isi_paket_drum} Drum + {formData.isi_paket_toner} Toner</strong>.
                  </div>
                </div>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingId ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Log Perubahan Harga ── */}
      {isLogModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsLogModalOpen(false); }}>
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>📜 Log Perubahan Harga Produk Toner</h2>
              <button className="btn-close" onClick={() => setIsLogModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="log-subtitle">Catatan historis perubahan harga dari supplier untuk audit pengeluaran.</p>
              <div className="table-responsive">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal & Waktu</th>
                      <th>Nama Produk</th>
                      <th className="text-right">Harga Lama</th>
                      <th className="text-right">Harga Baru</th>
                      <th className="text-right">Selisih</th>
                      <th>Diubah Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length > 0 ? (
                      logs.map((log, idx) => {
                        const selisih = log.harga_baru - log.harga_lama;
                        return (
                          <tr key={log.id}>
                            <td>{idx + 1}</td>
                            <td>{formatTanggal(log.created_at)}</td>
                            <td className="bold">{log.nama_produk}</td>
                            <td className="text-right num-cell text-muted">{formatRupiah(log.harga_lama)}</td>
                            <td className="text-right num-cell bold">{formatRupiah(log.harga_baru)}</td>
                            <td className={`text-right num-cell bold ${selisih > 0 ? 'text-red' : 'text-green'}`}>
                              {selisih > 0 ? `+${formatRupiah(selisih)}` : formatRupiah(selisih)}
                            </td>
                            <td>{log.diubah_oleh || 'Admin'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="empty-cell">Belum ada catatan perubahan harga.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsLogModalOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterToner;
