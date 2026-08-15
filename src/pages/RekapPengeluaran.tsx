import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Download, FileText, Plus, Edit, Trash2, X, Search, RefreshCw,
  Loader2, ChevronDown, ChevronRight, Printer, RotateCcw,
  ListFilter, Building2, Package, Settings, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import './RekapPengeluaran.css';

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface MasterProdukToner {
  id: string;
  nama_produk: string;
  kategori: 'Drum' | 'Toner Mono' | 'Paket Bundling';
  tipe_printer_kompatibel: string;
  harga_satuan: number;
  is_paket: boolean;
  isi_paket: { drum?: number; toner?: number; [key: string]: any };
  aktif: boolean;
}

type StatusType = 'Pending' | 'Disetujui' | 'Ditolak';
type ViewMode = 'transaksi' | 'akumulatif';

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
  tanggal: string;
  status: StatusType;
  no_referensi: string;
  toner_jenis: string;
  toner_merk: string;
  toner_unit: number;
  toner_harga_satuan: number;
  toner_produk_id?: string;
  toner_nama_produk?: string;
  toner_is_paket?: boolean;
  toner_isi_paket?: { drum?: number; toner?: number };
  toner_jumlah_paket?: number;
  toner_harga_override?: boolean;
  keterangan: string;
  catatan: string;
  created_at: string;
}

interface GroupedCabang {
  kode_cabang: string;
  nama_cabang: string;
  count: number;
  service: number;
  hdd: number;
  ram: number;
  toner: number;
  mainboard: number;
  monitor: number;
  ups: number;
  lain_lain: number;
  total: number;
  items: Pengeluaran[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatRupiah = (n: number) =>
  'Rp' + new Intl.NumberFormat('id-ID').format(n || 0);

const parseRupiahInput = (v: string) =>
  parseFloat(v.replace(/[^0-9]/g, '')) || 0;

const formatTanggal = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const generateNoRef = (bulan: number, tahun: number, seq: number) => {
  const mm  = String(bulan).padStart(2, '0');
  const seq3 = String(seq).padStart(3, '0');
  return `TRX-${tahun}-${mm}-${seq3}`;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },   { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },     { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },    { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },{ value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },{ value: '12', label: 'Desember' }
];

const STATUS_CONFIG: Record<StatusType, { label: string; cls: string }> = {
  Pending:   { label: 'Pending',   cls: 'badge-pending' },
  Disetujui: { label: 'Disetujui', cls: 'badge-disetujui' },
  Ditolak:   { label: 'Ditolak',   cls: 'badge-ditolak' },
};

const CHART_COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#ef4444'];

const KATEGORI_KEYS: (keyof Pick<Pengeluaran,'service'|'hdd'|'ram'|'toner'|'mainboard'|'monitor'|'ups'|'lain_lain'>)[] =
  ['service','hdd','ram','toner','mainboard','monitor','ups','lain_lain'];

const KATEGORI_LABELS: Record<string, string> = {
  service:'Service', hdd:'HDD', ram:'RAM', toner:'Toner',
  mainboard:'Mainboard', monitor:'Monitor', ups:'UPS', lain_lain:'Lain-lain'
};

// ─── Empty form ──────────────────────────────────────────────────────────────

const emptyForm = (currentMonth: number, currentYear: number) => ({
  cabang_id: '',
  nama_cabang: '',
  kode_cabang: '',
  msa_id: null as number | null,
  msa_nama: '',
  bulan: currentMonth,
  tahun: currentYear,
  tanggal: todayISO(),
  status: 'Pending' as StatusType,
  service: 0, hdd: 0, ram: 0, toner: 0,
  mainboard: 0, monitor: 0, ups: 0, lain_lain: 0,
  // Toner fields
  toner_produk_id: '',
  toner_nama_produk: '',
  toner_jenis: '',
  toner_merk: '',
  toner_unit: 0,
  toner_harga_satuan: 0,
  toner_is_paket: false,
  toner_isi_paket: { drum: 0, toner: 0 },
  toner_jumlah_paket: 1,
  isManualPrice: false,
  keterangan: '',
  catatan: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

const RekapPengeluaran = () => {
  const [data, setData] = useState<Pengeluaran[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [masterToners, setMasterToners] = useState<MasterProdukToner[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const sessionData = sessionStorage.getItem('msa_session');
  const currentUser = sessionData ? JSON.parse(sessionData) : null;
  const role = currentUser?.role?.toLowerCase() || '';
  const isSuperAdmin = role === 'administrator' || role === 'admin';
  const isAdmin = isSuperAdmin || role === 'admin';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Pengeluaran | null>(null);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // ── Mode & Filters ────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('transaksi');
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterCabang, setFilterCabang] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChart, setShowChart] = useState(true);

  const [formData, setFormData] = useState(emptyForm(currentMonth, currentYear));

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchData(); }, [filterBulan, filterTahun, filterCabang]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [
        { data: cabangData, error: cErr },
        { data: userData, error: uErr },
        { data: tonerData, error: tErr }
      ] = await Promise.all([
        supabase.from('cabang').select('*').order('nama_cabang'),
        supabase.from('app_users').select('id, full_name, role, cabang_id'),
        supabase.from('master_produk_toner').select('*').eq('aktif', true).order('nama_produk')
      ]);

      if (cErr) throw cErr;
      if (uErr) throw uErr;
      if (tErr) console.warn('master_produk_toner fetch warn:', tErr);

      setCabangs(cabangData || []);
      setUsers(userData || []);
      setMasterToners(tonerData || []);
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
        .order('tanggal', { ascending: false });

      if (filterBulan)  query = query.eq('bulan', parseInt(filterBulan));
      if (filterTahun)  query = query.eq('tahun', parseInt(filterTahun));
      if (filterCabang) query = query.eq('nama_cabang', filterCabang);

      const { data: rekapData, error } = await query;
      if (error) throw error;
      setData(rekapData || []);
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), type === 'error' ? 8000 : 3000);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetAllFilters = () => {
    setFilterBulan('');
    setFilterTahun(currentYear.toString());
    setFilterCabang('');
    setSearchQuery('');
  };

  // ── Form handlers ─────────────────────────────────────────────────────────

  const handleCabangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cabName = e.target.value;
    const sel = cabangs.find(c => c.nama_cabang === cabName);
    if (sel) {
      const msaUser = users.find(u => u.cabang_id === sel.id && u.role?.toLowerCase().includes('msa'));
      const anyUser = users.find(u => u.cabang_id === sel.id);
      const target = msaUser || anyUser;
      setFormData(f => ({
        ...f,
        cabang_id: sel.id,
        nama_cabang: sel.nama_cabang,
        kode_cabang: sel.kode_cabang || '',
        msa_id: target?.id ?? null,
        msa_nama: target?.full_name ?? '',
      }));
    } else {
      setFormData(f => ({ ...f, cabang_id: '', nama_cabang: '', kode_cabang: '', msa_id: null, msa_nama: '' }));
    }
    setDuplicateWarning(null);
  };

  const handleTanggalChange = (val: string) => {
    const d = new Date(val);
    const b = !isNaN(d.getTime()) ? d.getMonth() + 1 : formData.bulan;
    const y = !isNaN(d.getTime()) ? d.getFullYear() : formData.tahun;
    setFormData(f => ({ ...f, tanggal: val, bulan: b, tahun: y }));
  };

  const handleNumberInput = (field: string, value: string) => {
    const num = parseRupiahInput(value);
    setFormData(f => ({ ...f, [field]: num }));
  };

  // ── Toner Master Selection & Auto-calc ──────────────────────────────────────

  const selectedMasterProduct = useMemo(() => {
    if (!formData.toner_produk_id) return null;
    return masterToners.find(m => m.id === formData.toner_produk_id) || null;
  }, [formData.toner_produk_id, masterToners]);

  const handleSelectMasterToner = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prodId = e.target.value;
    if (!prodId) {
      setFormData(f => ({
        ...f,
        toner_produk_id: '',
        toner_nama_produk: '',
        toner_jenis: '',
        toner_merk: '',
        toner_unit: 0,
        toner_harga_satuan: 0,
        toner_is_paket: false,
        toner_isi_paket: { drum: 0, toner: 0 },
        toner_jumlah_paket: 1,
        toner: 0,
        isManualPrice: false,
      }));
      return;
    }

    const prod = masterToners.find(m => m.id === prodId);
    if (!prod) return;

    const isPaket = !!prod.is_paket;
    const isiPaket = prod.isi_paket || { drum: 0, toner: 0 };
    const price = prod.harga_satuan || 0;

    if (isPaket) {
      const jmlPaket = 1;
      const totalToner = jmlPaket * price;
      const totalUnits = ((isiPaket.drum || 0) + (isiPaket.toner || 0)) * jmlPaket;
      setFormData(f => ({
        ...f,
        toner_produk_id: prod.id,
        toner_nama_produk: prod.nama_produk,
        toner_jenis: prod.kategori,
        toner_merk: prod.tipe_printer_kompatibel || '',
        toner_harga_satuan: price,
        toner_is_paket: true,
        toner_isi_paket: { drum: isiPaket.drum ?? 0, toner: isiPaket.toner ?? 0 },
        toner_jumlah_paket: jmlPaket,
        toner_unit: totalUnits,
        toner: totalToner,
        isManualPrice: false,
      }));
    } else {
      const unit = 1;
      const totalToner = unit * price;
      setFormData(f => ({
        ...f,
        toner_produk_id: prod.id,
        toner_nama_produk: prod.nama_produk,
        toner_jenis: prod.kategori,
        toner_merk: prod.tipe_printer_kompatibel || '',
        toner_harga_satuan: price,
        toner_is_paket: false,
        toner_isi_paket: { drum: 0, toner: 0 },
        toner_jumlah_paket: 0,
        toner_unit: unit,
        toner: totalToner,
        isManualPrice: false,
      }));
    }
  };

  const handleTonerUnitOrPaketChange = (val: string) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    const price = formData.toner_harga_satuan;

    if (formData.toner_is_paket) {
      const drumPerPaket = formData.toner_isi_paket?.drum || 0;
      const tonerPerPaket = formData.toner_isi_paket?.toner || 0;
      const totalUnits = (drumPerPaket + tonerPerPaket) * qty;

      setFormData(f => ({
        ...f,
        toner_jumlah_paket: qty,
        toner_unit: totalUnits,
        toner: qty * price,
      }));
    } else {
      setFormData(f => ({
        ...f,
        toner_unit: qty,
        toner: qty * price,
      }));
    }
  };

  const handleTonerHargaChange = (val: string) => {
    const harga = parseRupiahInput(val);
    const qty = formData.toner_is_paket ? formData.toner_jumlah_paket : formData.toner_unit;
    setFormData(f => ({
      ...f,
      toner_harga_satuan: harga,
      toner: qty * harga,
    }));
  };

  const calculateTotal = (f = formData) =>
    f.service + f.hdd + f.ram + f.toner + f.mainboard + f.monitor + f.ups + f.lain_lain;

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = () => {
    if (!formData.nama_cabang) { showMessage('Pilih cabang terlebih dahulu', 'error'); return false; }
    if (!formData.tanggal)     { showMessage('Tanggal transaksi wajib diisi', 'error'); return false; }
    
    // If toner product chosen or toner nominal > 0
    if (formData.toner_produk_id || formData.toner > 0) {
      if (!formData.toner_produk_id) {
        showMessage('Pilih produk toner dari dropdown master', 'error'); return false;
      }
      const qty = formData.toner_is_paket ? formData.toner_jumlah_paket : formData.toner_unit;
      if (!qty || qty <= 0) {
        showMessage(`Jumlah ${formData.toner_is_paket ? 'paket' : 'unit'} toner wajib diisi (> 0)`, 'error'); return false;
      }
      if (!formData.toner_harga_satuan || formData.toner_harga_satuan <= 0) {
        showMessage('Harga satuan toner wajib diisi (> 0)', 'error'); return false;
      }
    }

    if (formData.lain_lain > 0 && !formData.catatan?.trim()) {
      showMessage('Catatan wajib diisi saat ada pengeluaran Lain-lain', 'error'); return false;
    }
    return true;
  };

  // ── Generate No Ref ───────────────────────────────────────────────────────

  const generateRef = async (bulan: number, tahun: number): Promise<string> => {
    const mm = String(bulan).padStart(2, '0');
    const prefix = `TRX-${tahun}-${mm}-`;
    const { data: existingRefs } = await supabase
      .from('tb_rekap_pengeluaran')
      .select('no_referensi')
      .like('no_referensi', `${prefix}%`);

    let maxSeq = 0;
    if (existingRefs && existingRefs.length > 0) {
      existingRefs.forEach(r => {
        if (r.no_referensi) {
          const parts = r.no_referensi.split('-');
          const seqNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      });
    }
    return generateNoRef(bulan, tahun, maxSeq + 1);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const sessionStr = sessionStorage.getItem('msa_session');
      const cu = sessionStr ? JSON.parse(sessionStr) : null;

      // Sync bulan and tahun with tanggal
      const tDate = new Date(formData.tanggal);
      const bulanVal = !isNaN(tDate.getTime()) ? tDate.getMonth() + 1 : formData.bulan;
      const tahunVal = !isNaN(tDate.getTime()) ? tDate.getFullYear() : formData.tahun;

      const no_ref = editingId ? undefined : await generateRef(bulanVal, tahunVal);

      const isOverride = formData.isManualPrice && selectedMasterProduct && formData.toner_harga_satuan !== selectedMasterProduct.harga_satuan;

      const payload: Record<string, any> = {
        kode_cabang: formData.kode_cabang,
        nama_cabang: formData.nama_cabang,
        msa_id: formData.msa_id || null,
        msa_nama: formData.msa_nama || '',
        tanggal: formData.tanggal,
        status: formData.status,
        service: formData.service || 0,
        hdd: formData.hdd || 0,
        ram: formData.ram || 0,
        toner: formData.toner || 0,
        mainboard: formData.mainboard || 0,
        monitor: formData.monitor || 0,
        ups: formData.ups || 0,
        lain_lain: formData.lain_lain || 0,
        total: calculateTotal(),
        bulan: bulanVal,
        tahun: tahunVal,

        // Master Toner fields
        toner_produk_id: formData.toner_produk_id || null,
        toner_nama_produk: formData.toner_nama_produk || '',
        toner_jenis: formData.toner_jenis || '',
        toner_merk: formData.toner_merk || '',
        toner_unit: formData.toner_unit || 0,
        toner_harga_satuan: formData.toner_harga_satuan || 0,
        toner_is_paket: formData.toner_is_paket || false,
        toner_isi_paket: formData.toner_isi_paket || {},
        toner_jumlah_paket: formData.toner_jumlah_paket || 0,
        toner_harga_override: isOverride,

        keterangan: formData.keterangan || '',
        catatan: formData.catatan || '',
        created_by: cu?.full_name || 'Admin',
      };
      if (no_ref) payload.no_referensi = no_ref;

      if (editingId) {
        const { error } = await supabase.from('tb_rekap_pengeluaran').update(payload).eq('id', editingId);
        if (error) throw error;
        showMessage('Data berhasil diupdate', 'success');
      } else {
        let { error } = await supabase.from('tb_rekap_pengeluaran').insert([payload]);
        if (error && error.code === '23505') {
          // Retry with higher sequence if collision occurs
          const mm = String(bulanVal).padStart(2, '0');
          const randomSeq = Math.floor(Math.random() * 800) + 100;
          payload.no_referensi = `TRX-${tahunVal}-${mm}-${randomSeq}`;
          const retryRes = await supabase.from('tb_rekap_pengeluaran').insert([payload]);
          error = retryRes.error;
        }
        if (error) {
          throw new Error(`${error.code}: ${error.message}`);
        }
        showMessage('Data berhasil ditambahkan!', 'success');
      }

      setIsModalOpen(false);
      resetForm();
      setFilterBulan(bulanVal.toString());
      setFilterTahun(tahunVal.toString());
    } catch (err: any) {
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
      tanggal: item.tanggal || todayISO(),
      status: item.status || 'Pending',
      service: item.service, hdd: item.hdd, ram: item.ram, toner: item.toner,
      mainboard: item.mainboard, monitor: item.monitor, ups: item.ups, lain_lain: item.lain_lain,
      
      toner_produk_id: item.toner_produk_id || '',
      toner_nama_produk: item.toner_nama_produk || '',
      toner_jenis: item.toner_jenis || 'Original',
      toner_merk:  item.toner_merk  || '',
      toner_unit:  item.toner_unit  || 0,
      toner_harga_satuan: item.toner_harga_satuan || 0,
      toner_is_paket: item.toner_is_paket || false,
      toner_isi_paket: { drum: item.toner_isi_paket?.drum ?? 0, toner: item.toner_isi_paket?.toner ?? 0 },
      toner_jumlah_paket: item.toner_jumlah_paket || 0,
      isManualPrice: !!item.toner_harga_override,

      keterangan: item.keterangan || '',
      catatan: item.catatan || '',
    });
    setEditingId(item.id);
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data ini?')) return;
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
  };

  const resetForm = () => {
    setFormData(emptyForm(currentMonth, currentYear));
    setEditingId(null);
    setDuplicateWarning(null);
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (filterCabang && item.nama_cabang !== filterCabang) {
        return false;
      }
      if (filterBulan) {
        const targetB = parseInt(filterBulan);
        const dateB = item.tanggal ? new Date(item.tanggal).getMonth() + 1 : null;
        if (item.bulan !== targetB && dateB !== targetB) return false;
      }
      if (filterTahun) {
        const targetY = parseInt(filterTahun);
        const dateY = item.tanggal ? new Date(item.tanggal).getFullYear() : null;
        if (item.tahun !== targetY && dateY !== targetY) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = item.no_referensi?.toLowerCase().includes(q);
        const matchPic = item.msa_nama?.toLowerCase().includes(q);
        const matchToner = item.toner_nama_produk?.toLowerCase().includes(q);
        if (!matchRef && !matchPic && !matchToner) return false;
      }
      return true;
    });
  }, [data, filterBulan, filterTahun, filterCabang, searchQuery]);

  const groupedCabangData = useMemo<GroupedCabang[]>(() => {
    const map = new Map<string, GroupedCabang>();

    filteredData.forEach(item => {
      const key = item.nama_cabang || item.kode_cabang || 'Lainnya';
      if (!map.has(key)) {
        map.set(key, {
          kode_cabang: item.kode_cabang || '-',
          nama_cabang: item.nama_cabang || '-',
          count: 0,
          service: 0, hdd: 0, ram: 0, toner: 0,
          mainboard: 0, monitor: 0, ups: 0, lain_lain: 0,
          total: 0,
          items: [],
        });
      }
      const grp = map.get(key)!;
      grp.count += 1;
      grp.service += item.service || 0;
      grp.hdd += item.hdd || 0;
      grp.ram += item.ram || 0;
      grp.toner += item.toner || 0;
      grp.mainboard += item.mainboard || 0;
      grp.monitor += item.monitor || 0;
      grp.ups += item.ups || 0;
      grp.lain_lain += item.lain_lain || 0;
      grp.total += item.total || 0;
      grp.items.push(item);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const grandTotals = useMemo(() =>
    filteredData.reduce((acc, cur) => ({
      service:   acc.service   + cur.service,
      hdd:       acc.hdd       + cur.hdd,
      ram:       acc.ram       + cur.ram,
      toner:     acc.toner     + cur.toner,
      mainboard: acc.mainboard + cur.mainboard,
      monitor:   acc.monitor   + cur.monitor,
      ups:       acc.ups       + cur.ups,
      lain_lain: acc.lain_lain + cur.lain_lain,
      total:     acc.total     + cur.total,
    }), { service:0,hdd:0,ram:0,toner:0,mainboard:0,monitor:0,ups:0,lain_lain:0,total:0 }),
  [filteredData]);

  const chartData = useMemo(() =>
    KATEGORI_KEYS.map((k, i) => ({
      name: KATEGORI_LABELS[k],
      value: grandTotals[k],
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })).filter(d => d.value > 0),
  [grandTotals]);

  const isAnyFilterActive = !!(filterBulan || filterTahun !== currentYear.toString() || filterCabang || searchQuery);

  // ── Export ────────────────────────────────────────────────────────────────

  const exportToExcel = () => {
    if (!filteredData.length) return;
    const rows = filteredData.map((item, i) => ({
      'No':           i + 1,
      'No. Referensi': item.no_referensi,
      'Tanggal':      formatTanggal(item.tanggal),
      'Code':         item.kode_cabang,
      'Nama Cabang':  item.nama_cabang,
      'PIC Input':    item.msa_nama,
      'Service':      item.service,
      'HDD':          item.hdd,
      'RAM':          item.ram,
      'Toner':        item.toner,
      'Toner Produk': item.toner_nama_produk || item.toner_jenis,
      'Toner Merk':   item.toner_merk,
      'Toner Unit/Paket': item.toner_is_paket ? `${item.toner_jumlah_paket} Paket` : item.toner_unit,
      'Mainboard':    item.mainboard,
      'Monitor':      item.monitor,
      'UPS':          item.ups,
      'Lain-Lain':    item.lain_lain,
      'Total':        item.total,
      'Status':       item.status,
      'Catatan':      item.catatan,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Pengeluaran');
    XLSX.writeFile(wb, `Rekap_Pengeluaran_${filterBulan || 'All'}_${filterTahun || 'All'}.xlsx`);
  };

  const exportToPDF = () => {
    if (!filteredData.length) return;
    const doc = new jsPDF('l', 'pt', 'a4');
    const periodeLabel = filterBulan
      ? `${MONTHS.find(m => m.value === filterBulan)?.label} ${filterTahun}`
      : `Semua ${filterTahun}`;
    doc.text(`Rekap Harga — Periode ${periodeLabel}`, 40, 35);

    const cols = ["No","Ref#","Tgl","Code","Nama Cabang","PIC","Service","HDD","RAM","Toner","Mainboard","Monitor","UPS","Lain","Total","Status"];
    const rows = filteredData.map((d, i) => [
      i+1, d.no_referensi, formatTanggal(d.tanggal), d.kode_cabang, d.nama_cabang, d.msa_nama,
      formatRupiah(d.service), formatRupiah(d.hdd), formatRupiah(d.ram), formatRupiah(d.toner),
      formatRupiah(d.mainboard), formatRupiah(d.monitor), formatRupiah(d.ups), formatRupiah(d.lain_lain),
      formatRupiah(d.total), d.status
    ]);
    rows.push(['','','','','TOTAL','',
      formatRupiah(grandTotals.service), formatRupiah(grandTotals.hdd), formatRupiah(grandTotals.ram),
      formatRupiah(grandTotals.toner), formatRupiah(grandTotals.mainboard), formatRupiah(grandTotals.monitor),
      formatRupiah(grandTotals.ups), formatRupiah(grandTotals.lain_lain), formatRupiah(grandTotals.total), ''
    ]);

    (doc as any).autoTable({
      head: [cols], body: rows, startY: 55,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    doc.save(`Rekap_Pengeluaran_${filterBulan || 'All'}_${filterTahun || 'All'}.pdf`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const colSpanDetail = 17;
  const colSpanAkum = 15;

  return (
    <div className="rekap-pengeluaran-container">

      {/* ── Notification ── */}
      {message.text && (
        <div className={`notification ${message.type}`}>{message.text}</div>
      )}

      {/* ── Header ── */}
      <div className="rekap-header">
        <h1>Rekap Harga</h1>
        <div className="header-actions">
          <button className="btn-success" onClick={exportToExcel}><Download size={15} /> Excel</button>
          <button className="btn-danger"  onClick={exportToPDF}><FileText size={15} /> PDF</button>
          {isAdmin && (
            <Link to="/admin/master-toner" className="btn-secondary" title="Kelola Master Produk Toner & Paket">
              <Package size={15} /> Master Toner
            </Link>
          )}
          {isSuperAdmin && (
            <button className="btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
              <Plus size={15} /> Input Baru
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Section ── */}
      <div className="filters-section">
        {/* Bulan */}
        <div className="filter-item">
          <label>Bulan</label>
          <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
            <option value="">Semua Bulan</option>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Tahun */}
        <div className="filter-item">
          <label>Tahun</label>
          <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
            <option value="">Semua Tahun</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Filter Cabang */}
        <div className="filter-item">
          <label>Filter Cabang</label>
          <select value={filterCabang} onChange={e => setFilterCabang(e.target.value)}>
            <option value="">Semua Cabang</option>
            {cabangs.map(c => (
              <option key={c.id} value={c.nama_cabang}>
                {c.kode_cabang ? `[${c.kode_cabang}] ` : ''}{c.nama_cabang}
              </option>
            ))}
          </select>
        </div>

        {/* Search Query */}
        <div className="filter-item filter-search">
          <label>Cari No.Ref / PIC / Toner</label>
          <div className="search-wrap">
            <Search size={13} className="search-icon" />
            <input
              type="text" placeholder="No.Ref (TRX-...) / PIC / Toner..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="filter-item filter-actions">
          <button className="btn-icon-sm" onClick={fetchData} title="Refresh Data"><RefreshCw size={15} /></button>
          {isAnyFilterActive && (
            <button className="btn-icon-sm btn-reset" onClick={resetAllFilters} title="Reset Filter">
              <RotateCcw size={14} />
            </button>
          )}
          <button className="btn-icon-sm" onClick={() => setShowChart(v => !v)} title="Toggle Chart">
            {showChart ? '📊' : '📉'}
          </button>
        </div>
      </div>

      {/* ── Chart Ringkasan ── */}
      {showChart && chartData.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <span className="chart-title">Breakdown Pengeluaran per Kategori</span>
            <span className="chart-subtitle">Total: {formatRupiah(grandTotals.total)}</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 80, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `Rp${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(v) => formatRupiah(typeof v === 'number' ? v : 0)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Summary Badges ── */}
      <div className="summary-badges">
        <div className="summary-badge">
          <span className="sb-label">Total Transaksi</span>
          <span className="sb-value">{filteredData.length}</span>
        </div>
        <div className="summary-badge">
          <span className="sb-label">Total Pengeluaran</span>
          <span className="sb-value accent">{formatRupiah(grandTotals.total)}</span>
        </div>
        {(['Pending','Disetujui','Ditolak'] as StatusType[]).map(s => (
          <div key={s} className="summary-badge">
            <span className="sb-label">{s}</span>
            <span className={`sb-value ${STATUS_CONFIG[s].cls}`}>
              {filteredData.filter(d => d.status === s).length}
            </span>
          </div>
        ))}
      </div>

      {/* ── Toolbar: Mode Tampilan & Indikator Result ── */}
      <div className="table-toolbar">
        <div className="view-mode-toggle">
          <button
            className={`mode-btn ${viewMode === 'transaksi' ? 'active' : ''}`}
            onClick={() => { setViewMode('transaksi'); setExpandedRows(new Set()); }}
          >
            <ListFilter size={14} />
            <span>Per Transaksi</span>
          </button>
          <button
            className={`mode-btn ${viewMode === 'akumulatif' ? 'active' : ''}`}
            onClick={() => { setViewMode('akumulatif'); setExpandedRows(new Set()); }}
          >
            <Building2 size={14} />
            <span>Akumulatif per Cabang</span>
          </button>
        </div>

        <div className="filter-indicator">
          {viewMode === 'transaksi' ? (
            <span>
              Menampilkan <strong>{filteredData.length}</strong> dari <strong>{data.length}</strong> transaksi
            </span>
          ) : (
            <span>
              Menampilkan <strong>{groupedCabangData.length}</strong> cabang (total <strong>{filteredData.length}</strong> transaksi)
            </span>
          )}
          {isAnyFilterActive && (
            <button className="btn-link-reset" onClick={resetAllFilters}>
              <RotateCcw size={12} /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-responsive">
        {viewMode === 'transaksi' ? (
          /* Mode 1: PER TRANSAKSI */
          <table className="rekap-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>No</th>
                <th>Ref#</th>
                <th>Code</th>
                <th>Name</th>
                <th>PIC Input</th>
                <th className="text-right">Service</th>
                <th className="text-right">HDD</th>
                <th className="text-right">RAM</th>
                <th className="text-right">Toner</th>
                <th className="text-right">Mainboard</th>
                <th className="text-right">Monitor</th>
                <th className="text-right">UPS</th>
                <th className="text-right">Lain-lain</th>
                <th className="text-right col-total">Total</th>
                <th>Status</th>
                {isSuperAdmin && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpanDetail} className="loading-cell">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Memuat data...</span>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                <>
                  {filteredData.map((item, index) => {
                    const expanded = expandedRows.has(item.id);
                    const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['Pending'];
                    return (
                      <React.Fragment key={item.id}>
                        <tr className={expanded ? 'row-expanded' : ''}>
                          <td className="expand-cell" onClick={() => toggleRow(item.id)}>
                            {expanded
                              ? <ChevronDown size={13} className="expand-icon open" />
                              : <ChevronRight size={13} className="expand-icon" />
                            }
                          </td>
                          <td>{index + 1}</td>
                          <td className="ref-cell" title={item.no_referensi}>{item.no_referensi || '—'}</td>
                          <td>{item.kode_cabang}</td>
                          <td className="name-cell">{item.nama_cabang}</td>
                          <td>{item.msa_nama || '—'}</td>
                          <td className="text-right num-cell">{item.service ? formatRupiah(item.service) : '—'}</td>
                          <td className="text-right num-cell">{item.hdd ? formatRupiah(item.hdd) : '—'}</td>
                          <td className="text-right num-cell">{item.ram ? formatRupiah(item.ram) : '—'}</td>
                          <td className="text-right num-cell">
                            {item.toner ? (
                              <div className="toner-cell-box">
                                <span>{formatRupiah(item.toner)}</span>
                                {item.toner_is_paket && (
                                  <span className="badge-paket-micro" title={`Paket: ${item.toner_jumlah_paket ?? 0}x (${(item.toner_isi_paket?.drum||0)*(item.toner_jumlah_paket ?? 0)} Drum + ${(item.toner_isi_paket?.toner||0)*(item.toner_jumlah_paket ?? 0)} Toner)`}>
                                    📦 {item.toner_jumlah_paket} Paket
                                  </span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="text-right num-cell">{item.mainboard ? formatRupiah(item.mainboard) : '—'}</td>
                          <td className="text-right num-cell">{item.monitor ? formatRupiah(item.monitor) : '—'}</td>
                          <td className="text-right num-cell">{item.ups ? formatRupiah(item.ups) : '—'}</td>
                          <td className="text-right num-cell">{item.lain_lain ? formatRupiah(item.lain_lain) : '—'}</td>
                          <td className="text-right num-cell col-total">{formatRupiah(item.total)}</td>
                          <td>
                            <span className={`status-badge ${sc.cls}`}>{sc.label}</span>
                          </td>
                          {isSuperAdmin && (
                            <td>
                              <div className="action-buttons">
                                <button className="btn-icon" title="Edit" onClick={() => handleEdit(item)}><Edit size={13} /></button>
                                <button className="btn-icon delete" title="Hapus" onClick={() => handleDelete(item.id)}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expanded Detail Row */}
                        {expanded && (
                          <tr className="detail-row">
                            <td colSpan={colSpanDetail}>
                              <div className="detail-grid">
                                <div className="detail-item">
                                  <span className="det-label">Tanggal</span>
                                  <span className="det-value">{formatTanggal(item.tanggal)}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="det-label">Bulan/Tahun</span>
                                  <span className="det-value">{MONTHS.find(m=>parseInt(m.value)===item.bulan)?.label} {item.tahun}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="det-label">Dibuat oleh</span>
                                  <span className="det-value">{(item as any).created_by || '—'}</span>
                                </div>
                                {item.toner > 0 && (
                                  <>
                                    <div className="detail-item detail-full">
                                      <span className="det-label">Detail Produk Toner</span>
                                      <span className="det-value bold">
                                        {item.toner_nama_produk || item.toner_jenis || 'Toner'}
                                        {item.toner_merk ? ` (${item.toner_merk})` : ''}
                                      </span>
                                    </div>
                                    {item.toner_is_paket ? (
                                      <div className="detail-item detail-full highlight-paket">
                                        <span className="det-label">Rincian Paket Bundling</span>
                                        <span className="det-value">
                                          📦 <strong>{item.toner_jumlah_paket} Paket</strong> × {formatRupiah(item.toner_harga_satuan)}/paket = <strong>{formatRupiah(item.toner)}</strong>
                                          <br />
                                          <small>
                                            (Isi per paket: {item.toner_isi_paket?.drum || 0} Drum + {item.toner_isi_paket?.toner || 0} Toner. Total rincian fisik: <strong>{(item.toner_isi_paket?.drum || 0) * (item.toner_jumlah_paket || 1)} Drum + {(item.toner_isi_paket?.toner || 0) * (item.toner_jumlah_paket || 1)} Toner</strong>)
                                          </small>
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="detail-item">
                                        <span className="det-label">Unit × Harga</span>
                                        <span className="det-value">
                                          {item.toner_unit} unit × {formatRupiah(item.toner_harga_satuan)} = {formatRupiah(item.toner)}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {item.catatan && (
                                  <div className="detail-item detail-full">
                                    <span className="det-label">Catatan</span>
                                    <span className="det-value">{item.catatan}</span>
                                  </div>
                                )}
                                {item.keterangan && (
                                  <div className="detail-item detail-full">
                                    <span className="det-label">Keterangan Tambahan</span>
                                    <span className="det-value">{item.keterangan}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <tr className="grand-total-row">
                    <td colSpan={6} className="total-label-cell">TOTAL KESELURUHAN</td>
                    <td className="text-right">{formatRupiah(grandTotals.service)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.hdd)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.ram)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.toner)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.mainboard)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.monitor)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.ups)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.lain_lain)}</td>
                    <td className="text-right col-total">{formatRupiah(grandTotals.total)}</td>
                    <td colSpan={isSuperAdmin ? 2 : 1}></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={colSpanDetail} className="empty-cell">
                    <div className="empty-state">
                      <div className="empty-icon">📭</div>
                      <div className="empty-title">Tidak ada transaksi ditemukan</div>
                      <div className="empty-desc">
                        {isAnyFilterActive
                          ? 'Tidak ada data pengeluaran yang sesuai dengan kombinasi filter Anda.'
                          : 'Belum ada data pengeluaran yang tercatat.'}
                      </div>
                      {isAnyFilterActive && (
                        <button className="btn-secondary btn-sm" onClick={resetAllFilters}>
                          <RotateCcw size={13} /> Reset Semua Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* Mode 2: AKUMULATIF PER CABANG */
          <table className="rekap-table akumulatif-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>No</th>
                <th>Code</th>
                <th>Nama Cabang</th>
                <th className="text-center">Jml Transaksi</th>
                <th className="text-right">Service</th>
                <th className="text-right">HDD</th>
                <th className="text-right">RAM</th>
                <th className="text-right">Toner</th>
                <th className="text-right">Mainboard</th>
                <th className="text-right">Monitor</th>
                <th className="text-right">UPS</th>
                <th className="text-right">Lain-lain</th>
                <th className="text-right col-total">Total Akumulasi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpanAkum} className="loading-cell">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Memuat data akumulasi...</span>
                  </td>
                </tr>
              ) : groupedCabangData.length > 0 ? (
                <>
                  {groupedCabangData.map((grp, index) => {
                    const rowKey = `grp-${grp.nama_cabang}`;
                    const expanded = expandedRows.has(rowKey);
                    return (
                      <React.Fragment key={rowKey}>
                        <tr className={`akum-row ${expanded ? 'row-expanded' : ''}`} onClick={() => toggleRow(rowKey)}>
                          <td className="expand-cell">
                            {expanded
                              ? <ChevronDown size={14} className="expand-icon open" />
                              : <ChevronRight size={14} className="expand-icon" />
                            }
                          </td>
                          <td>{index + 1}</td>
                          <td><span className="code-badge">{grp.kode_cabang}</span></td>
                          <td className="name-cell bold">{grp.nama_cabang}</td>
                          <td className="text-center">
                            <span className="count-badge" title="Klik row untuk lihat rincian transaksi">
                              {grp.count} Transaksi
                            </span>
                          </td>
                          <td className="text-right num-cell">{grp.service ? formatRupiah(grp.service) : '—'}</td>
                          <td className="text-right num-cell">{grp.hdd ? formatRupiah(grp.hdd) : '—'}</td>
                          <td className="text-right num-cell">{grp.ram ? formatRupiah(grp.ram) : '—'}</td>
                          <td className="text-right num-cell">{grp.toner ? formatRupiah(grp.toner) : '—'}</td>
                          <td className="text-right num-cell">{grp.mainboard ? formatRupiah(grp.mainboard) : '—'}</td>
                          <td className="text-right num-cell">{grp.monitor ? formatRupiah(grp.monitor) : '—'}</td>
                          <td className="text-right num-cell">{grp.ups ? formatRupiah(grp.ups) : '—'}</td>
                          <td className="text-right num-cell">{grp.lain_lain ? formatRupiah(grp.lain_lain) : '—'}</td>
                          <td className="text-right num-cell col-total bold">{formatRupiah(grp.total)}</td>
                        </tr>

                        {/* Sub-table Drill-down */}
                        {expanded && (
                          <tr className="detail-row">
                            <td colSpan={colSpanAkum}>
                              <div className="subtable-container">
                                <div className="subtable-header">
                                  <span>🔍 Rincian Transaksi untuk Cabang <strong>{grp.nama_cabang}</strong> ({grp.items.length} item)</span>
                                </div>
                                <table className="sub-rekap-table">
                                  <thead>
                                    <tr>
                                      <th>Ref#</th>
                                      <th>Tanggal</th>
                                      <th>PIC Input</th>
                                      <th className="text-right">Service</th>
                                      <th className="text-right">HDD</th>
                                      <th className="text-right">RAM</th>
                                      <th className="text-right">Toner</th>
                                      <th className="text-right">Mainboard</th>
                                      <th className="text-right">Monitor</th>
                                      <th className="text-right">UPS</th>
                                      <th className="text-right">Lain</th>
                                      <th className="text-right">Total</th>
                                      <th>Status</th>
                                      <th>Rincian Toner / Catatan</th>
                                      {isSuperAdmin && <th>Aksi</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grp.items.map(t => {
                                      const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG['Pending'];
                                      return (
                                        <tr key={t.id}>
                                          <td className="ref-cell">{t.no_referensi || '—'}</td>
                                          <td>{formatTanggal(t.tanggal)}</td>
                                          <td>{t.msa_nama || '—'}</td>
                                          <td className="text-right">{t.service ? formatRupiah(t.service) : '—'}</td>
                                          <td className="text-right">{t.hdd ? formatRupiah(t.hdd) : '—'}</td>
                                          <td className="text-right">{t.ram ? formatRupiah(t.ram) : '—'}</td>
                                          <td className="text-right">{t.toner ? formatRupiah(t.toner) : '—'}</td>
                                          <td className="text-right">{t.mainboard ? formatRupiah(t.mainboard) : '—'}</td>
                                          <td className="text-right">{t.monitor ? formatRupiah(t.monitor) : '—'}</td>
                                          <td className="text-right">{t.ups ? formatRupiah(t.ups) : '—'}</td>
                                          <td className="text-right">{t.lain_lain ? formatRupiah(t.lain_lain) : '—'}</td>
                                          <td className="text-right bold">{formatRupiah(t.total)}</td>
                                          <td><span className={`status-badge ${sc.cls}`}>{sc.label}</span></td>
                                          <td className="catatan-cell">
                                            {t.toner_is_paket ? (
                                              <span className="badge-paket-micro">
                                                📦 {t.toner_jumlah_paket ?? 0} Paket ({(t.toner_isi_paket?.drum||0)*(t.toner_jumlah_paket ?? 0)} Drum + {(t.toner_isi_paket?.toner||0)*(t.toner_jumlah_paket ?? 0)} Toner)
                                              </span>
                                            ) : (
                                              t.catatan || t.keterangan || '—'
                                            )}
                                          </td>
                                          {isSuperAdmin && (
                                            <td>
                                              <div className="action-buttons">
                                                <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(t); }}><Edit size={12} /></button>
                                                <button className="btn-icon delete" title="Hapus" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}><Trash2 size={12} /></button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <tr className="grand-total-row">
                    <td colSpan={5} className="total-label-cell">TOTAL AKUMULASI KESELURUHAN</td>
                    <td className="text-right">{formatRupiah(grandTotals.service)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.hdd)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.ram)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.toner)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.mainboard)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.monitor)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.ups)}</td>
                    <td className="text-right">{formatRupiah(grandTotals.lain_lain)}</td>
                    <td className="text-right col-total">{formatRupiah(grandTotals.total)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={colSpanAkum} className="empty-cell">
                    <div className="empty-state">
                      <div className="empty-icon">🏢</div>
                      <div className="empty-title">Tidak ada data akumulasi cabang</div>
                      <div className="empty-desc">
                        {isAnyFilterActive
                          ? 'Tidak ada data yang sesuai dengan kombinasi filter Anda.'
                          : 'Belum ada data pengeluaran cabang.'}
                      </div>
                      {isAnyFilterActive && (
                        <button className="btn-secondary btn-sm" onClick={resetAllFilters}>
                          <RotateCcw size={13} /> Reset Semua Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Modal Input / Edit
      ══════════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? '✏️ Edit Pengeluaran' : '➕ Input Pengeluaran Baru'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">

              {duplicateWarning && !editingId && (
                <div className="duplicate-banner full-width">
                  <div className="duplicate-banner-icon">⚠️</div>
                  <div className="duplicate-banner-text">
                    <strong>Peringatan!</strong> Ada data serupa untuk cabang ini.<br />
                    Ref: <b>{duplicateWarning.no_referensi}</b> — Total: <b>{formatRupiah(duplicateWarning.total)}</b>
                  </div>
                </div>
              )}

              {/* Cabang */}
              <div className="form-group full-width">
                <label>Nama Cabang <span className="req">*</span></label>
                <select value={formData.nama_cabang} onChange={handleCabangChange} disabled={!!editingId}>
                  <option value="">-- Pilih Cabang --</option>
                  {cabangs.map(c => <option key={c.id} value={c.nama_cabang}>{c.nama_cabang}</option>)}
                </select>
              </div>

              {/* Tanggal */}
              <div className="form-group">
                <label>Tanggal Transaksi <span className="req">*</span></label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={e => handleTanggalChange(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="form-group">
                <label>Status Approval</label>
                <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as StatusType }))}>
                  <option value="Pending">Pending</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>

              {/* Periode */}
              <div className="form-group">
                <label>Periode Bulan (Auto from Tanggal)</label>
                <select
                  value={formData.bulan}
                  onChange={e => setFormData(f => ({ ...f, bulan: parseInt(e.target.value) }))}
                  disabled={!!editingId}
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Periode Tahun (Auto from Tanggal)</label>
                <select
                  value={formData.tahun}
                  onChange={e => setFormData(f => ({ ...f, tahun: parseInt(e.target.value) }))}
                  disabled={!!editingId}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* PIC */}
              <div className="form-group full-width">
                <label>PIC Input (Penanggung Jawab)</label>
                {formData.msa_nama ? (
                  <input type="text" value={formData.msa_nama} readOnly className="readonly-green" />
                ) : (
                  <select
                    value={formData.msa_id?.toString() || ''}
                    onChange={e => {
                      const u = users.find(u => u.id === parseInt(e.target.value));
                      setFormData(f => ({ ...f, msa_id: u?.id ?? null, msa_nama: u?.full_name ?? '' }));
                    }}
                  >
                    <option value="">-- Pilih PIC (Opsional) --</option>
                    {users.filter(u => u.role?.toUpperCase().includes('MSA') || u.role?.toUpperCase().includes('FSA'))
                      .map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                  </select>
                )}
              </div>

              {/* Section Divider */}
              <div className="section-divider full-width">💰 Rincian Pengeluaran</div>

              {/* Service / HDD / RAM */}
              {(['service','hdd','ram','mainboard','monitor','ups'] as const).map(field => (
                <div className="form-group" key={field}>
                  <label>{KATEGORI_LABELS[field]}</label>
                  <div className="input-prefix">
                    <span>Rp</span>
                    <input
                      type="text"
                      value={new Intl.NumberFormat('id-ID').format(formData[field] as number)}
                      onChange={e => handleNumberInput(field, e.target.value)}
                    />
                  </div>
                </div>
              ))}

              {/* ── Sub-Form Toner dengan Master Produk Dropdown & Package Logic ── */}
              <div className="form-group toner-group full-width">
                <div className="toner-header">
                  <Printer size={14} />
                  <label>Pengeluaran Toner / Drum / Paket Bundling</label>
                  {isAdmin && (
                    <Link to="/admin/master-toner" target="_blank" className="link-master-toner">
                      <Settings size={12} /> Kelola Master Produk
                    </Link>
                  )}
                </div>

                <div className="toner-subform">
                  {/* Step 1: Dropdown Master Produk Toner */}
                  <div className="toner-field full-width">
                    <label>Step 1 — Pilih Produk Toner / Paket <span className="req">*</span></label>
                    <select
                      value={formData.toner_produk_id}
                      onChange={handleSelectMasterToner}
                    >
                      <option value="">-- Pilih Produk Master Toner --</option>
                      {masterToners.map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.kategori}] {t.nama_produk} ({formatRupiah(t.harga_satuan)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Form Reaksi Otomatis */}
                  <div className="toner-field">
                    <div className="harga-label-box">
                      <label>Harga Satuan / Paket <span className="req">*</span></label>
                      {formData.toner_produk_id && (
                        <button
                          type="button"
                          className="btn-text-edit"
                          onClick={() => setFormData(f => ({ ...f, isManualPrice: !f.isManualPrice }))}
                        >
                          {formData.isManualPrice ? '🔒 Standar' : '✏️ Edit Manual'}
                        </button>
                      )}
                    </div>
                    <div className="input-prefix">
                      <span>Rp</span>
                      <input
                        type="text"
                        value={formData.toner_harga_satuan ? new Intl.NumberFormat('id-ID').format(formData.toner_harga_satuan) : ''}
                        placeholder="0"
                        readOnly={!formData.isManualPrice}
                        disabled={!formData.toner_produk_id}
                        className={formData.isManualPrice ? 'manual-price-active' : ''}
                        onChange={e => handleTonerHargaChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Input Qty: Unit vs Jumlah Paket */}
                  {formData.toner_is_paket ? (
                    <div className="toner-field">
                      <label>Jumlah Paket <span className="req">*</span></label>
                      <input
                        type="number" min={1}
                        disabled={!formData.toner_produk_id}
                        placeholder="1"
                        value={formData.toner_jumlah_paket || ''}
                        onChange={e => handleTonerUnitOrPaketChange(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="toner-field">
                      <label>Jumlah Unit <span className="req">*</span></label>
                      <input
                        type="number" min={1}
                        disabled={!formData.toner_produk_id}
                        placeholder="1"
                        value={formData.toner_unit || ''}
                        onChange={e => handleTonerUnitOrPaketChange(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Total Nominal Toner */}
                  <div className="toner-field toner-total">
                    <label>Total Nominal Toner (auto)</label>
                    <div className="input-prefix">
                      <span>Rp</span>
                      <input
                        type="text"
                        value={new Intl.NumberFormat('id-ID').format(formData.toner)}
                        readOnly
                        className="readonly-blue"
                      />
                    </div>
                  </div>

                  {/* Warning Override Harga */}
                  {formData.isManualPrice && selectedMasterProduct && formData.toner_harga_satuan !== selectedMasterProduct.harga_satuan && (
                    <div className="override-warning full-width">
                      <AlertCircle size={13} />
                      <span>
                        Harga beda dari standar master (Standar Master: <strong>{formatRupiah(selectedMasterProduct.harga_satuan)}</strong>)
                      </span>
                    </div>
                  )}

                  {/* Live Preview Bundling Breakdown */}
                  {formData.toner_is_paket && formData.toner_produk_id && (
                    <div className="paket-breakdown-preview full-width">
                      <div className="preview-header">
                        📦 Rincian Otomatis Paket Bundling
                      </div>
                      <div className="preview-body">
                        Paket ini berisi <strong>{formData.toner_isi_paket?.drum || 0} Drum + {formData.toner_isi_paket?.toner || 0} Toner</strong> per paket.
                        <br />
                        Total <strong>{formData.toner_jumlah_paket || 0} paket</strong> = <strong>{(formData.toner_isi_paket?.drum || 0) * (formData.toner_jumlah_paket || 0)} Drum + {(formData.toner_isi_paket?.toner || 0) * (formData.toner_jumlah_paket || 0)} Toner</strong>.
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Lain-lain */}
              <div className="form-group">
                <label>Lain-Lain</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input
                    type="text"
                    value={new Intl.NumberFormat('id-ID').format(formData.lain_lain)}
                    onChange={e => handleNumberInput('lain_lain', e.target.value)}
                  />
                </div>
              </div>

              {/* Total */}
              <div className="form-group">
                <label>Total Keseluruhan</label>
                <div className="input-prefix">
                  <span>Rp</span>
                  <input
                    type="text"
                    value={new Intl.NumberFormat('id-ID').format(calculateTotal())}
                    readOnly className="readonly-blue bold-val"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div className="section-divider full-width">📝 Catatan & Keterangan</div>

              <div className="form-group full-width">
                <label>
                  Catatan {formData.lain_lain > 0 && <span className="req">* (wajib untuk Lain-lain)</span>}
                </label>
                <textarea
                  rows={2}
                  placeholder={formData.lain_lain > 0 ? 'Jelaskan keperluan lain-lain...' : 'Opsional...'}
                  value={formData.catatan}
                  onChange={e => setFormData(f => ({ ...f, catatan: e.target.value }))}
                />
              </div>

              <div className="form-group full-width">
                <label>Keterangan Tambahan</label>
                <input
                  type="text"
                  placeholder="Keterangan opsional..."
                  value={formData.keterangan}
                  onChange={e => setFormData(f => ({ ...f, keterangan: e.target.value }))}
                />
              </div>

            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingId ? 'Update Data' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RekapPengeluaran;
