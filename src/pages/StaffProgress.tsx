import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Drawer } from '../components/Drawer';
import { Search, Filter, Eye, Loader2, Ticket, ShieldAlert, RefreshCw, Coins, FileX, ClipboardType, CheckCircle2, Wrench, MoreHorizontal, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TableStyles.css';

const StaffProgress = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState('Semua');
  const [selectedYear, setSelectedYear] = useState('Semua');
  const [cumulativeData, setCumulativeData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const { data: settings } = await supabase
          .from('global_settings')
          .select('value')
          .eq('id', 'dashboard_period')
          .single();

        if (settings) {
          setSelectedMonth(settings.value.month);
          setSelectedYear(settings.value.year.toString());
        }
      } catch (err) {
        console.error('Error fetching global settings:', err);
      }
    };
    fetchDefaults();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const fetchStaffData = async () => {
      try {
        setLoading(true);
        // Fetch from VIEW instead of table for automatic KPI calculation
        let query = supabase
          .from('v_staff_report')
          .select('*');
        
        if (selectedMonth !== 'Semua') {
          query = query.eq('periode', selectedMonth);
        }
        if (selectedYear !== 'Semua') {
          query = query.eq('tahun', parseInt(selectedYear));
        }

        const { data: staff, error } = await query;
        if (error) throw error;
        if (isCancelled) return;

        // Deduplicate staff records by ID (in case database has redundant entries for the same period)
        const uniqueMap = new Map();
        (staff || []).forEach(s => {
          // If we have duplicates, we prefer the one that might have been updated last or just the first one
          if (!uniqueMap.has(s.id)) {
            uniqueMap.set(s.id, s);
          }
        });
        const uniqueStaffList = Array.from(uniqueMap.values());

        // Calculate Total KPI for each staff
        const calcPts = (val: number, params: any) => {
          for (const p of params) {
            if (val >= p.min && val <= p.max) return p.pts;
          }
          return 0;
        };

        const calculatedData = uniqueStaffList.map(s => {
          // Fix p_sg locally to override the faulty SQL view value (which returns 11 for 1 error)
          const p_sg_fixed = calcPts(s.salah_generate || 0, [{min:0,max:0,pts:10},{min:1,max:1,pts:6},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);

          const totalKPI = (s.p_rv || 0) + (s.p_up || 0) + (s.p_rd || 0) + (s.p_tp || 0) + 
                           p_sg_fixed + (s.p_ppi || 0) + (s.p_val || 0) + (s.p_tpk || 0) + (s.p_ll || 0);
          
          // Determine Status based on Total KPI (New Thresholds)
          let status = 'critical';
          let color = '#ef4444'; // Red
          
          if (totalKPI >= 90) {
            status = 'on-track';
            color = '#22c55e'; // Green
          } else if (totalKPI >= 70) {
            status = 'delayed';
            color = '#f59e0b'; // Yellow/Orange
          }

          return { ...s, totalKPI, status, kpiColor: color };
        });

        // Sort by Total KPI descending
        setData(calculatedData.sort((a, b) => b.totalKPI - a.totalKPI));
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching staff data:', error);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchStaffData();

    return () => {
      isCancelled = true;
    };
  }, [selectedMonth, selectedYear]);

  const getStatusConfig = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'on track' || s === 'on-track') {
      return { variant: 'on-track' as BadgeVariant, label: 'On Track' };
    }
    if (s === 'delayed' || s === 'needs focus' || s === 'needs-focus') {
      return { variant: 'delayed' as BadgeVariant, label: 'Need Focus' };
    }
    return { variant: 'critical' as BadgeVariant, label: 'Critical' };
  };

  const openDrawer = async (staff: any) => {
    setSelectedStaff(staff);
    setCumulativeData(null);
    
    // Fetch cumulative data (sum across all months)
    try {
      let drawerQuery = supabase
        .from('staff_progress')
        .select('*')
        .eq('id', staff.id);

      if (selectedYear !== 'Semua') {
        drawerQuery = drawerQuery.eq('tahun', parseInt(selectedYear));
      }

      const { data: records, error } = await drawerQuery;
      
      if (error) throw error;

      if (records) {
        const periodRank: Record<string, number> = {
          'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4,
          'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8,
          'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
        };
        const sortedRecords = [...records].sort((a, b) => (periodRank[b.periode] || 0) - (periodRank[a.periode] || 0));
        const latestVal = sortedRecords[0]?.validasi || 0;

        const totals = records.reduce((acc, curr) => ({
          rv: (acc.rv || 0) + (curr.release_voucher || 0),
          up: (acc.up || 0) + (curr.unapprove_pengajuan || 0),
          rd: (acc.rd || 0) + (curr.recalculate_delinquency || 0),
          tp: (acc.tp || 0) + (curr.transfer_pencairan || 0),
          sg: (acc.sg || 0) + (curr.salah_generate || 0),
          ppi: (acc.ppi || 0) + (curr.ppi_not_entry || 0),
          val: latestVal, // Correct: Use latest value instead of sum
          tpk: (acc.tpk || 0) + (curr.tiket_perbaikan || 0),
          ll: (acc.ll || 0) + (curr.lain_lain || 0),
        }), {});

        // Calculation logic to get points from totals
        const calcPts = (val: number, params: any) => {
          for (const p of params) {
            if (val >= p.min && val <= p.max) return p.pts;
          }
          return 0;
        };

        const p_rv  = calcPts(totals.rv,  [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_up  = calcPts(totals.up,  [{min:0,max:0,pts:10},{min:1,max:1,pts:7},{min:2,max:3,pts:5},{min:4,max:5,pts:3},{min:6,max:7,pts:2},{min:8,max:10,pts:1},{min:11,max:999,pts:0}]);
        const p_rd  = calcPts(totals.rd,  [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:4},{min:8,max:10,pts:3},{min:11,max:13,pts:1},{min:14,max:999,pts:0}]);
        const p_tp  = calcPts(totals.tp,  [{min:0,max:0,pts:15},{min:1,max:1,pts:10},{min:2,max:3,pts:5},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
        const p_sg  = calcPts(totals.sg,  [{min:0,max:0,pts:10},{min:1,max:1,pts:6},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
        const p_ppi = calcPts(totals.ppi, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:10,pts:5},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_val = calcPts(totals.val, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_tpk = calcPts(totals.tpk, [{min:0,max:0,pts:15},{min:1,max:1,pts:5},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
        const p_ll  = 10 + (totals.ll || 0);

        const totalPoints = p_rv + p_up + p_rd + p_tp + p_sg + p_ppi + p_val + p_tpk + p_ll;
        setCumulativeData({ ...totals, totalPoints });
      }
    } catch (err) {
      console.error('Error fetching cumulative data:', err);
    }
  };

  const closeDrawer = () => {
    setSelectedStaff(null);
    setCumulativeData(null);
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    
    // Header for CSV
    const headers = ["No", "Kode", "Cabang", "Nama Staf", "RV", "UP", "RD", "TP", "SG", "PPI", "VAL", "TPK", "LL", "Point", "Status"];
    
    // Map data to rows
    const rows = data.map((s, index) => [
      index + 1,
      `"${s.id}"`, // Quote ID to prevent Excel from dropping leading zeros
      `"${s.branch}"`,
      `"${s.name}"`,
      s.release_voucher || 0,
      s.unapprove_pengajuan || 0,
      s.recalculate_delinquency || 0,
      s.transfer_pencairan || 0,
      s.salah_generate || 0,
      s.ppi_not_entry || 0,
      s.validasi || 0,
      s.tiket_perbaikan || 0,
      s.lain_lain || 0,
      s.totalKPI,
      s.status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `MSA_Performance_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>MSA Performance Review</h1>
          <p>Live tracking</p>
        </div>
        <div className="header-actions">
          <div className="filter-group">
              <Filter size={16} />
              <select 
                className="month-select" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="Semua">Semua Tahun</option>
              </select>
            </div>
          <div className="filter-group">
            <Filter size={16} />
            <select 
              className="month-select" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="Januari">Januari</option>
              <option value="Februari">Februari</option>
              <option value="Maret">Maret</option>
              <option value="April">April</option>
              <option value="Mei">Mei</option>
              <option value="Juni">Juni</option>
              <option value="Juli">Juli</option>
              <option value="Agustus">Agustus</option>
              <option value="September">September</option>
              <option value="Oktober">Oktober</option>
              <option value="November">November</option>
              <option value="Desember">Desember</option>
              <option value="Semua">Semua Bulan</option>
            </select>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Cari staf..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={handleExportCSV} title="Unduh Spreadsheet (CSV)">
            <Download size={16} />
            <span className="desktop-only">Ekspor CSV</span>
          </button>
        </div>
      </div>

      <Card className="table-card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center-text">No</th>
                <th className="center-text">Kode</th>
                <th>Cabang</th>
                <th colSpan={2}>Nama Staf</th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <Ticket size={11} />
                    <span>RELEASE VOUCHER</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <ShieldAlert size={11} />
                    <span>UNAPPROVE PENGAJUAN</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <RefreshCw size={11} />
                    <span>RECALCULATE DELINQUENCY</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <Coins size={11} />
                    <span>TRANSFER PENCAIRAN</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <FileX size={11} />
                    <span>SALAH GENERATE</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <ClipboardType size={11} />
                    <span>PPI NOT ENTRY</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <CheckCircle2 size={11} />
                    <span>VALIDASI</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <Wrench size={11} />
                    <span>TIKET PERBAIKAN</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <MoreHorizontal size={11} />
                    <span>LAIN-LAIN</span>
                  </div>
                </th>
                <th style={{ minWidth: '85px' }}>Point</th>
                <th className="center-text">STATUS</th>
                <th className="center-text">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="center-text" style={{ padding: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--color-text-muted)' }}>
                      <Loader2 className="animate-spin" size={24} />
                      <span>Memuat data KPI...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={16} className="center-text" style={{ padding: '40px', color: 'var(--color-text-muted)' }}>
                    Data KPI tidak ditemukan.
                  </td>
                </tr>
              ) : (
                data
                  .filter(s => 
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    s.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.id.includes(searchQuery)
                  )
                  // Apply 20 staff limit for default view (specific month, no search)
                  .slice(0, (!searchQuery && selectedMonth !== 'Semua') ? 20 : undefined)
                  .map((staff, index) => {
                  const statusConfig = getStatusConfig(staff.status);
                  return (
                    <tr key={staff.id}>
                      <td className="center-text mono text-muted" data-label="No">{index + 1}</td>
                      <td className="center-text mono" data-label="Kode">{staff.id}</td>
                      <td className="fw-500" data-label="Cabang">{staff.branch}</td>
                      <td style={{ width: '40px', paddingRight: 0 }} className="desktop-only">
                        <div className="table-avatar">
                          <img 
                            src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff&bold=true`} 
                            alt={staff.name} 
                          />
                        </div>
                      </td>
                      <td className="fw-600" data-label="Nama Staf">
                        <div className="name-cell-wrapper">
                          <div className="table-avatar mobile-only">
                            <img 
                              src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff&bold=true`} 
                              alt={staff.name} 
                            />
                          </div>
                          <span>{staff.name}</span>
                        </div>
                      </td>
                      <td className="center-text mono" data-label="Release Voucher">{staff.release_voucher === 0 ? '-' : staff.release_voucher}</td>
                      <td className="center-text mono" data-label="Unapprove Pengajuan">{staff.unapprove_pengajuan === 0 ? '-' : staff.unapprove_pengajuan}</td>
                      <td className="center-text mono" data-label="Recalculate Delinquency">{staff.recalculate_delinquency === 0 ? '-' : staff.recalculate_delinquency}</td>
                      <td className="center-text mono" data-label="Transfer Pencairan">{staff.transfer_pencairan === 0 ? '-' : staff.transfer_pencairan}</td>
                      <td className="center-text mono" data-label="Salah Generate">{staff.salah_generate === 0 ? '-' : staff.salah_generate}</td>
                      <td className="center-text mono" data-label="PPI Not Entry">{staff.ppi_not_entry === 0 ? '-' : staff.ppi_not_entry}</td>
                      <td className="center-text mono" data-label="Validasi">{staff.validasi === 0 ? '-' : staff.validasi}</td>
                      <td className="center-text mono" data-label="Tiket Perbaikan">{staff.tiket_perbaikan === 0 ? '-' : staff.tiket_perbaikan}</td>
                      <td className="center-text mono" data-label="Lain-lain">
                        <div>
                          {staff.lain_lain === 0 
                            ? '-' 
                            : staff.lain_lain > 0 
                              ? `+${staff.lain_lain}` 
                              : staff.lain_lain}
                        </div>
                        {staff.lain_lain_keterangan && (
                          <div style={{ 
                            fontSize: '7.5px', 
                            color: 'var(--color-text-muted)', 
                            marginTop: '2px', 
                            fontStyle: 'italic',
                            lineHeight: '1',
                            maxWidth: '70px',
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            fontWeight: 'normal',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '-0.2px'
                          }} title={staff.lain_lain_keterangan}>
                            {staff.lain_lain_keterangan}
                          </div>
                        )}
                      </td>
                      <td data-label="Point">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <ProgressBar 
                              progress={staff.totalKPI} 
                              color={staff.kpiColor}
                            />
                          </div>
                          <span className="mono fw-600" style={{ fontSize: '12px', minWidth: '35px', color: staff.kpiColor }}>
                            {staff.totalKPI}%
                          </span>
                        </div>
                      </td>
                      <td className="center-text" data-label="Status">
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="center-text" data-label="Aksi">
                        <button className="icon-btn" title="Lihat Poin Detail" onClick={() => openDrawer(staff)}>
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data.length > 20 && !searchQuery && selectedMonth !== 'Semua' && (
          <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '13px', background: 'var(--color-bg-alt)' }}>
            Menampilkan 20 staf terbaik. Gunakan fitur <strong>Cari</strong> atau pilih <strong>Semua Bulan</strong> untuk melihat data selengkapnya.
          </div>
        )}
      </Card>

      <Drawer 
        isOpen={!!selectedStaff} 
        onClose={closeDrawer} 
        title={selectedStaff ? `Profil ${selectedStaff.name}` : 'Laporan'}
      >
        {selectedStaff && (
          <div className="drawer-content">
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="fw-500" style={{ fontSize: '18px' }}>{selectedStaff.name}</span>
                <span className="mono text-muted">{selectedStaff.id}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{selectedStaff.branch}</p>

              {selectedStaff.lain_lain_keterangan && (
                <div style={{ 
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#FEF3C7',
                  borderLeft: '4px solid #F59E0B',
                  borderRadius: '6px',
                  color: '#92400E',
                  fontSize: '12px',
                  fontWeight: 500,
                  lineHeight: '1.4'
                }}>
                  <strong>Catatan Khusus ({selectedStaff.periode}):</strong> {selectedStaff.lain_lain_keterangan}
                </div>
              )}
            </div>
            
            <div className="drawer-section">
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Akumulasi Kesalahan {selectedYear !== 'Semua' ? selectedYear : ''}
                <Badge variant={getStatusConfig(selectedStaff.status).variant}>
                  {selectedStaff.totalKPI}%
                </Badge>
              </h3>
              <div style={{ marginTop: '12px' }}>
                <ProgressBar 
                  progress={selectedStaff.totalKPI} 
                  color={selectedStaff.kpiColor}
                  height="8px"
                />
              </div>
            </div>

            {cumulativeData && (
              <div className="drawer-section">
                <h3>Akumulasi Kesalahan ({selectedMonth === 'Semua' ? 'Semua Bulan' : selectedMonth} {selectedYear !== 'Semua' ? selectedYear : 'Semua Tahun'})</h3>
                <div className="cumulative-grid">
                  <div className="cum-item">
                    <span className="label">Release Voucher</span>
                    <span className="value">{cumulativeData.rv}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Unapprove Pengajuan</span>
                    <span className="value">{cumulativeData.up}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Recalculate Delinquency</span>
                    <span className="value">{cumulativeData.rd}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Transfer Pencairan</span>
                    <span className="value">{cumulativeData.tp}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Salah Generate</span>
                    <span className="value">{cumulativeData.sg}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">PPI Not Entry</span>
                    <span className="value">{cumulativeData.ppi}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Validasi</span>
                    <span className="value">{cumulativeData.val}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Tiket Perbaikan</span>
                    <span className="value">{cumulativeData.tpk}</span>
                  </div>
                  <div className="cum-item">
                    <span className="label">Lain-lain</span>
                    <span className="value">
                      {cumulativeData.ll === 0 
                        ? '-' 
                        : cumulativeData.ll > 0 
                          ? `+${cumulativeData.ll}` 
                          : cumulativeData.ll}
                    </span>
                  </div>
                </div>
                
                <div className="cum-footer" style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                   <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Estimasi Skor Akumulatif</div>
                   <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{cumulativeData.totalPoints}%</div>
                </div>
              </div>
            )}

            <div className="drawer-section" style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <button 
                className="btn btn-primary w-full justify-center"
                onClick={() => window.print()}
              >
                Cetak Laporan
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default StaffProgress;
