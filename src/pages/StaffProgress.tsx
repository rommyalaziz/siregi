import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Drawer } from '../components/Drawer';
import { Search, Filter, Eye, Loader2, Ticket, ShieldAlert, RefreshCw, Coins, FileX, ClipboardType, CheckCircle2, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TableStyles.css';

const StaffProgress = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [cumulativeData, setCumulativeData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStaffData();
  }, [selectedMonth]);

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

      const { data: staff, error } = await query;
      if (error) throw error;

      // Calculate Total KPI for each staff
      const calculatedData = (staff || []).map(s => {
        const totalKPI = (s.p_rv || 0) + (s.p_up || 0) + (s.p_rd || 0) + (s.p_tp || 0) + 
                         (s.p_sg || 0) + (s.p_ppi || 0) + (s.p_val || 0) + (s.p_tpk || 0);
        
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
      console.error('Error fetching staff data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      const { data: records, error } = await supabase
        .from('staff_progress')
        .select('*')
        .eq('id', staff.id);
      
      if (error) throw error;

      if (records) {
        const periodRank: Record<string, number> = { 'April': 3, 'Maret': 2, 'Februari': 1 };
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
        }), {});

        // Calculation logic to get points from totals
        const calcPts = (val: number, params: any) => {
          for (const p of params) {
            if (val >= p.min && val <= p.max) return p.pts;
          }
          return 0;
        };

        const p_rv = calcPts(totals.rv, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_up = calcPts(totals.up, [{min:0,max:0,pts:10},{min:1,max:1,pts:7},{min:2,max:3,pts:5},{min:4,max:5,pts:3},{min:6,max:7,pts:2},{min:8,max:10,pts:1},{min:11,max:999,pts:0}]);
        const p_rd = calcPts(totals.rd, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:10,pts:3},{min:11,max:13,pts:1},{min:14,max:999,pts:0}]);
        const p_tp = calcPts(totals.tp, [{min:0,max:0,pts:15},{min:1,max:1,pts:10},{min:2,max:3,pts:5},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
        const p_sg = calcPts(totals.sg, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:999,pts:0}]);
        const p_ppi = calcPts(totals.ppi, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:5,pts:7},{min:6,max:10,pts:5},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_val = calcPts(totals.val, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
        const p_tpk = calcPts(totals.tpk, [{min:0,max:0,pts:15},{min:1,max:1,pts:5},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);

        const totalPoints = p_rv + p_up + p_rd + p_tp + p_sg + p_ppi + p_val + p_tpk;
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
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="April">April</option>
              <option value="Maret">Maret</option>
              <option value="Februari">Februari</option>
              <option value="Semua">Semua Periode</option>
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
                    <Ticket size={12} />
                    <span>RV</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <ShieldAlert size={12} />
                    <span>UP</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <RefreshCw size={12} />
                    <span>RD</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <Coins size={12} />
                    <span>TP</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <FileX size={12} />
                    <span>SG</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <ClipboardType size={12} />
                    <span>PPI</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <CheckCircle2 size={12} />
                    <span>VAL</span>
                  </div>
                </th>
                <th className="center-text">
                  <div className="header-icon-wrapper">
                    <Wrench size={12} />
                    <span>TPK</span>
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
                  .map((staff, index) => {
                  const statusConfig = getStatusConfig(staff.status);
                  return (
                    <tr key={staff.id}>
                      <td className="center-text mono text-muted">{index + 1}</td>
                      <td className="center-text mono">{staff.id}</td>
                      <td className="fw-500">{staff.branch}</td>
                      <td style={{ width: '40px', paddingRight: 0 }}>
                        <div className="table-avatar">
                          <img 
                            src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff&bold=true`} 
                            alt={staff.name} 
                          />
                        </div>
                      </td>
                      <td className="fw-600">
                        <span>{staff.name}</span>
                      </td>
                      <td className="center-text mono">{staff.release_voucher === 0 ? '-' : staff.release_voucher}</td>
                      <td className="center-text mono">{staff.unapprove_pengajuan === 0 ? '-' : staff.unapprove_pengajuan}</td>
                      <td className="center-text mono">{staff.recalculate_delinquency === 0 ? '-' : staff.recalculate_delinquency}</td>
                      <td className="center-text mono">{staff.transfer_pencairan === 0 ? '-' : staff.transfer_pencairan}</td>
                      <td className="center-text mono">{staff.salah_generate === 0 ? '-' : staff.salah_generate}</td>
                      <td className="center-text mono">{staff.ppi_not_entry === 0 ? '-' : staff.ppi_not_entry}</td>
                      <td className="center-text mono">{staff.validasi === 0 ? '-' : staff.validasi}</td>
                      <td className="center-text mono">{staff.tiket_perbaikan === 0 ? '-' : staff.tiket_perbaikan}</td>
                      <td>
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
                      <td className="center-text">
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="center-text">
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
            </div>
            
            <div className="drawer-section">
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Performa {selectedMonth === 'Semua' ? 'Total' : selectedMonth}
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
                <h3>Akumulasi Kesalahan (Feb - Apr)</h3>
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
