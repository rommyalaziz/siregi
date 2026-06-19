import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Download, FileText, Plus, Edit, Trash2, X, Search, RefreshCw, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './RekapPengeluaran.css';

interface Cabang {
  id: string;
  nama_cabang: string;
  kode_cabang: string;
}

interface UserData {
  id: number;
  full_name: string;
  role: string;
  cabang_id: string;
}

interface Pengeluaran {
  id: string;
  kode_cabang: string;
  nama_cabang: string;
  msa_id: number | null;
  msa_nama: string;
  service: number;
  hdd: number;
  ram: number;
  toner: number;
  mainboard: number;
  monitor: number;
  ups: number;
  lain_lain: number;
  total: number;
  bulan: number;
  tahun: number;
  keterangan: string;
  created_at: string;
}

const formatNumber = (number: number) => {
  return new Intl.NumberFormat('id-ID').format(number);
};

const parseRupiahInput = (value: string) => {
  return parseFloat(value.replace(/[^0-9]/g, '')) || 0;
};

const RekapPengeluaran = () => {
  const [data, setData] = useState<Pengeluaran[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const sessionData = sessionStorage.getItem('msa_session');
  const currentUser = sessionData ? JSON.parse(sessionData) : null;
  const role = currentUser?.role?.toLowerCase() || '';
  const isSuperAdmin = role === 'administrator' || role === 'admin';
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Pengeluaran | null>(null);
  
  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    cabang_id: '',
    nama_cabang: '',
    kode_cabang: '',
    msa_id: null as number | null,
    msa_nama: '',
    bulan: currentMonth,
    tahun: currentYear,
    service: 0,
    hdd: 0,
    ram: 0,
    toner: 0,
    mainboard: 0,
    monitor: 0,
    ups: 0,
    lain_lain: 0,
    keterangan: ''
  });

  const months = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterBulan, filterTahun]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch cabangs
      const { data: cabangData, error: cabangError } = await supabase
        .from('cabang')
        .select('*')
        .order('nama_cabang');
      
      if (cabangError) throw cabangError;
      setCabangs(cabangData || []);

      // Fetch users mapping to get MSA/FSA per cabang
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('id, full_name, role, cabang_id');
      
      if (userError) throw userError;
      setUsers(userData || []);

    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tb_rekap_pengeluaran')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterBulan) query = query.eq('bulan', parseInt(filterBulan));
      if (filterTahun) query = query.eq('tahun', parseInt(filterTahun));

      const { data: rekapData, error } = await query;
      
      if (error) throw error;
      setData(rekapData || []);
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    const duration = type === 'error' ? 8000 : 3000;
    setTimeout(() => setMessage({ text: '', type: '' }), duration);
  };

  const checkForDuplicate = async (namaCabang: string, bulan: number, tahun: number) => {
    if (!namaCabang || editingId) return; // skip jika sedang edit
    try {
      const { data: existing } = await supabase
        .from('tb_rekap_pengeluaran')
        .select('*')
        .eq('nama_cabang', namaCabang)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .maybeSingle();
      
      setDuplicateWarning(existing || null);
    } catch {
      setDuplicateWarning(null);
    }
  };

  const handleCabangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cabName = e.target.value;
    const selectedCabang = cabangs.find(c => c.nama_cabang === cabName);
    
    if (selectedCabang) {
      // Find MSA/FSA user for this cabang
      const msaUser = users.find(u => u.cabang_id === selectedCabang.id && u.role?.toLowerCase().includes('msa'));
      const anyUser = users.find(u => u.cabang_id === selectedCabang.id);
      
      const targetUser = msaUser || anyUser;
      
      // Auto generate kode cabang dari database
      const code = selectedCabang.kode_cabang || '';

      const newFormData = {
        ...formData,
        cabang_id: selectedCabang.id,
        nama_cabang: selectedCabang.nama_cabang,
        kode_cabang: code,
        msa_id: targetUser ? targetUser.id : null,
        msa_nama: targetUser ? targetUser.full_name : ''
      };
      setFormData(newFormData);
      checkForDuplicate(selectedCabang.nama_cabang, formData.bulan, formData.tahun);
    } else {
      setFormData({
        ...formData,
        cabang_id: '',
        nama_cabang: '',
        kode_cabang: '',
        msa_id: null,
        msa_nama: ''
      });
      setDuplicateWarning(null);
    }
  };

  const handleBulanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bulan = parseInt(e.target.value);
    setFormData({ ...formData, bulan });
    if (formData.nama_cabang) {
      checkForDuplicate(formData.nama_cabang, bulan, formData.tahun);
    }
  };

  const handleTahunChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tahun = parseInt(e.target.value);
    setFormData({ ...formData, tahun });
    if (formData.nama_cabang) {
      checkForDuplicate(formData.nama_cabang, formData.bulan, tahun);
    }
  };

  const switchToEditMode = () => {
    if (!duplicateWarning) return;
    handleEdit(duplicateWarning);
    setDuplicateWarning(null);
  };

  const handleNumberInput = (field: string, value: string) => {
    const num = parseRupiahInput(value);
    setFormData({ ...formData, [field]: num });
  };

  // Calculate total automatically
  const calculateTotal = () => {
    return (
      formData.service + 
      formData.hdd + 
      formData.ram + 
      formData.toner + 
      formData.mainboard + 
      formData.monitor + 
      formData.ups + 
      formData.lain_lain
    );
  };

  const handleSave = async () => {
    try {
      if (!formData.nama_cabang) {
        showMessage('Pilih cabang terlebih dahulu', 'error');
        return;
      }

      setLoading(true);
      const sessionStr = sessionStorage.getItem('msa_session');
      const currentUser = sessionStr ? JSON.parse(sessionStr) : null;

      const payload = {
        kode_cabang: formData.kode_cabang,
        nama_cabang: formData.nama_cabang,
        msa_id: formData.msa_id || null,
        msa_nama: formData.msa_nama || '',
        service: formData.service || 0,
        hdd: formData.hdd || 0,
        ram: formData.ram || 0,
        toner: formData.toner || 0,
        mainboard: formData.mainboard || 0,
        monitor: formData.monitor || 0,
        ups: formData.ups || 0,
        lain_lain: formData.lain_lain || 0,
        total: calculateTotal(),
        bulan: formData.bulan,
        tahun: formData.tahun,
        keterangan: formData.keterangan || '',
        created_by: currentUser?.full_name || 'Admin',
      };

      console.log('[RekapPengeluaran] Saving payload:', payload);
      console.log('[RekapPengeluaran] editingId:', editingId);

      // Simpan periode sebelum operasi (untuk update filter nanti)
      const savedBulan = formData.bulan.toString();
      const savedTahun = formData.tahun.toString();

      if (editingId) {
        const { data: updateData, error } = await supabase
          .from('tb_rekap_pengeluaran')
          .update(payload)
          .eq('id', editingId)
          .select();
        console.log('[RekapPengeluaran] Update result:', { updateData, error });
        if (error) throw error;
        showMessage('Data berhasil diupdate', 'success');
      } else {
        const { data: insertData, error } = await supabase
          .from('tb_rekap_pengeluaran')
          .insert([payload])
          .select();
        console.log('[RekapPengeluaran] Insert result:', { insertData, error });
        if (error) {
          if (error.code === '23505') {
            throw new Error('Data untuk cabang ' + formData.nama_cabang + ' bulan ' + formData.bulan + '/' + formData.tahun + ' sudah ada. Silakan edit data yang sudah ada.');
          }
          throw new Error(`Error ${error.code}: ${error.message} - ${error.details || ''}`);
        }
        showMessage('Data berhasil ditambahkan!', 'success');
      }

      // Update filter agar langsung tampil di bulan/tahun yang disimpan
      setIsModalOpen(false);
      resetForm();
      // Update filter & fetch dengan filter baru
      setFilterBulan(savedBulan);
      setFilterTahun(savedTahun);
    } catch (err: any) {
      console.error('[RekapPengeluaran] Save error:', err);
      showMessage('Gagal menyimpan: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Pengeluaran) => {
    setFormData({
      cabang_id: '',
      nama_cabang: item.nama_cabang,
      kode_cabang: item.kode_cabang,
      msa_id: item.msa_id,
      msa_nama: item.msa_nama,
      bulan: item.bulan,
      tahun: item.tahun,
      service: item.service,
      hdd: item.hdd,
      ram: item.ram,
      toner: item.toner,
      mainboard: item.mainboard,
      monitor: item.monitor,
      ups: item.ups,
      lain_lain: item.lain_lain,
      keterangan: item.keterangan || ''
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus data ini?')) {
      try {
        setLoading(true);
        const { error } = await supabase.from('tb_rekap_pengeluaran').delete().eq('id', id);
        if (error) throw error;
        showMessage('Data berhasil dihapus', 'success');
        fetchData();
      } catch (err: any) {
        showMessage(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      cabang_id: '',
      nama_cabang: '',
      kode_cabang: '',
      msa_id: null,
      msa_nama: '',
      bulan: currentMonth,
      tahun: currentYear,
      service: 0,
      hdd: 0,
      ram: 0,
      toner: 0,
      mainboard: 0,
      monitor: 0,
      ups: 0,
      lain_lain: 0,
      keterangan: ''
    });
    setEditingId(null);
    setDuplicateWarning(null);
  };

  const exportToExcel = () => {
    if (data.length === 0) return;
    
    const exportData = filteredData.map((item, index) => ({
      'No': index + 1,
      'Code': item.kode_cabang,
      'Name': item.nama_cabang,
      'MSA/FSA': item.msa_nama,
      'Service': item.service,
      'HDD': item.hdd,
      'RAM': item.ram,
      'Toner': item.toner,
      'Mainboard': item.mainboard,
      'Monitor': item.monitor,
      'UPS': item.ups,
      'Lain-Lain': item.lain_lain,
      'Total': item.total,
      'Bulan': months.find(m => parseInt(m.value) === item.bulan)?.label,
      'Tahun': item.tahun,
      'Keterangan': item.keterangan
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Pengeluaran');
    XLSX.writeFile(workbook, `Rekap_Pengeluaran_${filterBulan || 'All'}_${filterTahun || 'All'}.xlsx`);
  };

  const exportToPDF = () => {
    if (data.length === 0) return;
    
    const doc = new jsPDF('l', 'pt', 'a4');
    doc.text(`Rekap Harga - Periode ${filterBulan ? months.find(m => m.value === filterBulan)?.label : 'Semua'} ${filterTahun}`, 40, 40);
    
    const tableColumn = ["No", "Code", "Name", "MSA/FSA", "Service", "HDD", "RAM", "Toner", "Mainboard", "Monitor", "UPS", "Lain", "Total"];
    const tableRows = filteredData.map((item, i) => [
      i + 1,
      item.kode_cabang,
      item.nama_cabang,
      item.msa_nama,
      formatNumber(item.service),
      formatNumber(item.hdd),
      formatNumber(item.ram),
      formatNumber(item.toner),
      formatNumber(item.mainboard),
      formatNumber(item.monitor),
      formatNumber(item.ups),
      formatNumber(item.lain_lain),
      formatNumber(item.total)
    ]);

    // Add Grand Total row
    tableRows.push([
      "", "", "TOTAL", "",
      formatNumber(grandTotals.service),
      formatNumber(grandTotals.hdd),
      formatNumber(grandTotals.ram),
      formatNumber(grandTotals.toner),
      formatNumber(grandTotals.mainboard),
      formatNumber(grandTotals.monitor),
      formatNumber(grandTotals.ups),
      formatNumber(grandTotals.lain_lain),
      formatNumber(grandTotals.total)
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 60,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`Rekap_Pengeluaran_${filterBulan || 'All'}_${filterTahun || 'All'}.pdf`);
  };

  // Process data for UI
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter(item => 
      item.nama_cabang.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.msa_nama.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const grandTotals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      service: acc.service + curr.service,
      hdd: acc.hdd + curr.hdd,
      ram: acc.ram + curr.ram,
      toner: acc.toner + curr.toner,
      mainboard: acc.mainboard + curr.mainboard,
      monitor: acc.monitor + curr.monitor,
      ups: acc.ups + curr.ups,
      lain_lain: acc.lain_lain + curr.lain_lain,
      total: acc.total + curr.total,
    }), {
      service: 0, hdd: 0, ram: 0, toner: 0, mainboard: 0, monitor: 0, ups: 0, lain_lain: 0, total: 0
    });
  }, [filteredData]);

  return (
    <div className="rekap-pengeluaran-container">
      {/* Removed fixed loading overlay */}

      {message.text && (
        <div className={`notification ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="rekap-header">
        <h1>Rekap Harga</h1>
        <div className="header-actions">
          <button className="btn-success" onClick={exportToExcel}>
            <Download size={18} /> Excel
          </button>
          <button className="btn-danger" onClick={exportToPDF}>
            <FileText size={18} /> PDF
          </button>
          {isSuperAdmin && (
            <button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
              <Plus size={18} /> Input Baru
            </button>
          )}
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Bulan</label>
          <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
            <option value="">Semua Bulan</option>
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Tahun</label>
          <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
            <option value="">Semua Tahun</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Cari Cabang / User</label>
          <div className="input-prefix" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Cari..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 35 }}
            />
          </div>
        </div>
        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={fetchData} title="Refresh Data">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="rekap-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Code</th>
              <th>Name</th>
              <th>MSA/FSA</th>
              <th className="text-right">Service</th>
              <th className="text-right">HDD</th>
              <th className="text-right">RAM</th>
              <th className="text-right">Toner</th>
              <th className="text-right">Mainboard</th>
              <th className="text-right">Monitor</th>
              <th className="text-right">UPS</th>
              <th className="text-right">Lain-Lain</th>
              <th className="text-right">Total</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--color-text-muted)' }}>
                    <Loader2 className="animate-spin" size={24} />
                    <span>Memuat data pengeluaran...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length > 0 ? (
              <>
                {filteredData.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.kode_cabang}</td>
                    <td>{item.nama_cabang}</td>
                    <td>{item.msa_nama}</td>
                    <td>{formatNumber(item.service)}</td>
                    <td>{formatNumber(item.hdd)}</td>
                    <td>{formatNumber(item.ram)}</td>
                    <td>{formatNumber(item.toner)}</td>
                    <td>{formatNumber(item.mainboard)}</td>
                    <td>{formatNumber(item.monitor)}</td>
                    <td>{formatNumber(item.ups)}</td>
                    <td>{formatNumber(item.lain_lain)}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatNumber(item.total)}</td>
                    <td>
                      <div className="action-buttons">
                        {isSuperAdmin ? (
                          <>
                            <button className="btn-icon" onClick={() => handleEdit(item)}><Edit size={16} /></button>
                            <button className="btn-icon delete" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
                          </>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="grand-total-row">
                  <td colSpan={4} style={{ textAlign: 'right', paddingRight: '20px' }}>TOTAL</td>
                  <td>{formatNumber(grandTotals.service)}</td>
                  <td>{formatNumber(grandTotals.hdd)}</td>
                  <td>{formatNumber(grandTotals.ram)}</td>
                  <td>{formatNumber(grandTotals.toner)}</td>
                  <td>{formatNumber(grandTotals.mainboard)}</td>
                  <td>{formatNumber(grandTotals.monitor)}</td>
                  <td>{formatNumber(grandTotals.ups)}</td>
                  <td>{formatNumber(grandTotals.lain_lain)}</td>
                  <td style={{ fontWeight: 'bold', color: '#000' }}>{formatNumber(grandTotals.total)}</td>
                  <td></td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '30px' }}>Belum ada data pengeluaran.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Pengeluaran' : 'Input Pengeluaran Baru'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              {/* Banner duplikat */}
              {duplicateWarning && !editingId && (
                <div className="duplicate-banner full-width">
                  <div className="duplicate-banner-icon">⚠️</div>
                  <div className="duplicate-banner-text">
                    <strong>Data sudah ada!</strong><br />
                    Data cabang <b>{duplicateWarning.nama_cabang}</b> untuk periode{' '}
                    <b>{months.find(m => parseInt(m.value) === duplicateWarning.bulan)?.label} {duplicateWarning.tahun}</b>{' '}
                    sudah tersimpan. Total: <b>Rp {formatNumber(duplicateWarning.total)}</b>
                  </div>
                  <button className="btn-edit-existing" onClick={switchToEditMode}>
                    ✏️ Edit Data Ini
                  </button>
                </div>
              )}
              <div className="form-group full-width">
                <label>Nama Cabang</label>
                <select 
                  value={formData.nama_cabang} 
                  onChange={handleCabangChange}
                  disabled={!!editingId}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {cabangs.map(c => (
                    <option key={c.id} value={c.nama_cabang}>{c.nama_cabang}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Periode Bulan</label>
                <select 
                  value={formData.bulan} 
                  onChange={handleBulanChange}
                  disabled={!!editingId}
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Periode Tahun</label>
                <select 
                  value={formData.tahun} 
                  onChange={handleTahunChange}
                  disabled={!!editingId}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>MSA/FSA Terhubung</label>
                {formData.msa_nama ? (
                  <input type="text" value={formData.msa_nama} readOnly style={{ backgroundColor: '#f0fdf4', color: '#166534' }} />
                ) : (
                  <select
                    value={formData.msa_id?.toString() || ''}
                    onChange={e => {
                      const selectedUser = users.find(u => u.id === parseInt(e.target.value));
                      setFormData({
                        ...formData,
                        msa_id: selectedUser ? selectedUser.id : null,
                        msa_nama: selectedUser ? selectedUser.full_name : ''
                      });
                    }}
                  >
                    <option value="">-- Pilih MSA/FSA (Opsional) --</option>
                    {users.filter(u => u.role?.includes('MSA') || u.role?.includes('FSA')).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>Service</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.service)} onChange={e => handleNumberInput('service', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>HDD</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.hdd)} onChange={e => handleNumberInput('hdd', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>RAM</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.ram)} onChange={e => handleNumberInput('ram', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Toner</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.toner)} onChange={e => handleNumberInput('toner', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Mainboard</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.mainboard)} onChange={e => handleNumberInput('mainboard', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Monitor</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.monitor)} onChange={e => handleNumberInput('monitor', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>UPS</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.ups)} onChange={e => handleNumberInput('ups', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Lain-Lain</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(formData.lain_lain)} onChange={e => handleNumberInput('lain_lain', e.target.value)} />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Total Keseluruhan</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input type="text" value={formatNumber(calculateTotal())} readOnly style={{ fontWeight: 'bold', backgroundColor: '#e2e8f0' }} />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Keterangan Tambahan</label>
                <input type="text" value={formData.keterangan} onChange={e => setFormData({...formData, keterangan: e.target.value})} placeholder="Opsional..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave}>Simpan Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RekapPengeluaran;
