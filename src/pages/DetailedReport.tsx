import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Search, Printer, Loader2, TrendingUp, TrendingDown, Ticket, ShieldAlert, RefreshCw, Coins, FileX, ClipboardType, CheckCircle2, Wrench } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import './TableStyles.css';

const DetailedReport = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCumulativeData();
  }, []);

  const fetchCumulativeData = async () => {
    try {
      setLoading(true);
      const { data: records, error } = await supabase
        .from('staff_progress')
        .select('*');
      
      if (error) throw error;

      if (records) {
        // Group by Staff ID
        const grouped = records.reduce((acc: any, curr: any) => {
          if (!acc[curr.id]) {
            acc[curr.id] = {
              id: curr.id,
              name: curr.name,
              branch: curr.branch,
              avatar_url: curr.avatar_url, // Masukkan URL foto di sini
              rv: 0, up: 0, rd: 0, tp: 0, sg: 0, ppi: 0, val: 0, tpk: 0,
              lastValPeriode: '',
              monthlyHistory: {} // To store KPI per month
            };
          }
          acc[curr.id].rv += curr.release_voucher || 0;
          acc[curr.id].up += curr.unapprove_pengajuan || 0;
          acc[curr.id].rd += curr.recalculate_delinquency || 0;
          acc[curr.id].tp += curr.transfer_pencairan || 0;
          acc[curr.id].sg += curr.salah_generate || 0;
          acc[curr.id].ppi += curr.ppi_not_entry || 0;
          // Logic for Validasi: Take latest month's value instead of sum
          const periodRank: Record<string, number> = { 'April': 3, 'Maret': 2, 'Februari': 1 };
          const currentPeriod = curr.periode || '';
          const existingPeriod = acc[curr.id].lastValPeriode || '';
          
          if (!acc[curr.id].lastValPeriode || periodRank[currentPeriod] >= periodRank[existingPeriod]) {
            acc[curr.id].val = curr.validasi || 0;
            acc[curr.id].lastValPeriode = currentPeriod;
          }
          
          acc[curr.id].tpk += curr.tiket_perbaikan || 0;

          // Calculate KPI for THIS specific month record
          const calcPts = (val: number, params: any) => {
            for (const p of params) {
              if (val >= p.min && val <= p.max) return p.pts;
            }
            return 0;
          };

          const p_rv = calcPts(curr.release_voucher || 0, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_up = calcPts(curr.unapprove_pengajuan || 0, [{min:0,max:0,pts:10},{min:1,max:1,pts:7},{min:2,max:3,pts:5},{min:4,max:5,pts:3},{min:6,max:7,pts:2},{min:8,max:10,pts:1},{min:11,max:999,pts:0}]);
          const p_rd = calcPts(curr.recalculate_delinquency || 0, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:10,pts:3},{min:11,max:13,pts:1},{min:14,max:999,pts:0}]);
          const p_tp = calcPts(curr.transfer_pencairan || 0, [{min:0,max:0,pts:15},{min:1,max:1,pts:10},{min:2,max:3,pts:5},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
          const p_sg = calcPts(curr.salah_generate || 0, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:999,pts:0}]);
          const p_ppi = calcPts(curr.ppi_not_entry || 0, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:5,pts:7},{min:6,max:10,pts:5},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_val = calcPts(curr.validasi || 0, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_tpk = calcPts(curr.tiket_perbaikan || 0, [{min:0,max:0,pts:15},{min:1,max:1,pts:5},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
          
          const monthKpi = p_rv + p_up + p_rd + p_tp + p_sg + p_ppi + p_val + p_tpk;
          acc[curr.id].monthlyHistory[curr.periode] = monthKpi;

          // Sync avatar_url across all records for this staff
          if (!acc[curr.id].avatar_url && curr.avatar_url) {
            acc[curr.id].avatar_url = curr.avatar_url;
          }

          return acc;
        }, {});

        // Calculate KPI for each group
        const calcPts = (val: number, params: any) => {
          for (const p of params) {
            if (val >= p.min && val <= p.max) return p.pts;
          }
          return 0;
        };

        const result = Object.values(grouped).map((s: any) => {
          const p_rv = calcPts(s.rv, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_up = calcPts(s.up, [{min:0,max:0,pts:10},{min:1,max:1,pts:7},{min:2,max:3,pts:5},{min:4,max:5,pts:3},{min:6,max:7,pts:2},{min:8,max:10,pts:1},{min:11,max:999,pts:0}]);
          const p_rd = calcPts(s.rd, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:10,pts:3},{min:11,max:13,pts:1},{min:14,max:999,pts:0}]);
          const p_tp = calcPts(s.tp, [{min:0,max:0,pts:15},{min:1,max:1,pts:10},{min:2,max:3,pts:5},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);
          const p_sg = calcPts(s.sg, [{min:0,max:0,pts:15},{min:1,max:1,pts:11},{min:2,max:3,pts:9},{min:4,max:5,pts:7},{min:6,max:7,pts:5},{min:8,max:999,pts:0}]);
          const p_ppi = calcPts(s.ppi, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:5,pts:7},{min:6,max:10,pts:5},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_val = calcPts(s.val, [{min:0,max:0,pts:10},{min:1,max:1,pts:8},{min:2,max:3,pts:7},{min:4,max:5,pts:6},{min:6,max:7,pts:5},{min:8,max:10,pts:4},{min:11,max:13,pts:3},{min:14,max:16,pts:2},{min:17,max:20,pts:1},{min:21,max:999,pts:0}]);
          const p_tpk = calcPts(s.tpk, [{min:0,max:0,pts:15},{min:1,max:1,pts:5},{min:2,max:3,pts:2},{min:4,max:5,pts:1},{min:6,max:999,pts:0}]);

          const totalKPI = p_rv + p_up + p_rd + p_tp + p_sg + p_ppi + p_val + p_tpk;
          
          // Format trend data for sparkline (Feb -> Mar -> Apr)
          const trendData = [
            { score: s.monthlyHistory['Februari'] || 100 },
            { score: s.monthlyHistory['Maret'] || 100 },
            { score: s.monthlyHistory['April'] || 100 }
          ];

          // Calculate trend status (comparing last two months)
          const maretVal = s.monthlyHistory['Maret'] || 100;
          const aprilVal = s.monthlyHistory['April'] || 100;
          let trendStatus = 'stable';
          if (aprilVal > maretVal) trendStatus = 'up';
          else if (aprilVal < maretVal) trendStatus = 'down';

          let color = '#ef4444';
          if (totalKPI >= 90) color = '#22c55e';
          else if (totalKPI >= 70) color = '#f59e0b';

          return { ...s, totalKPI, kpiColor: color, trendData, trendStatus };
        });

        setData(result.sort((a, b) => b.totalKPI - a.totalKPI));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container report-view">
      <div className="page-header no-print">
        <div>
          <h1>Laporan Detail Akumulatif</h1>
          <p>Rekapitulasi total kesalahan dan performa staff periode Februari - April.</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Cari staf..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={handlePrint}>
            <Printer size={16} />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      <Card className="table-card">
        <div className="table-wrapper">
          <table className="data-table report-table">
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
                <th className="center-text">PROGRES TREN</th>
                <th style={{ minWidth: '85px' }}>Point (%)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="center-text" style={{ padding: '40px' }}>
                    <Loader2 className="animate-spin" size={24} />
                  </td>
                </tr>
              ) : (
                data
                  .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.branch.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((staff, index) => (
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
                    <td className="fw-600">{staff.name}</td>
                    <td className="center-text mono">{staff.rv || '-'}</td>
                    <td className="center-text mono">{staff.up || '-'}</td>
                    <td className="center-text mono">{staff.rd || '-'}</td>
                    <td className="center-text mono">{staff.tp || '-'}</td>
                    <td className="center-text mono">{staff.sg || '-'}</td>
                    <td className="center-text mono">{staff.ppi || '-'}</td>
                    <td className="center-text mono">{staff.val || '-'}</td>
                    <td className="center-text mono">{staff.tpk || '-'}</td>
                    <td className="center-text" style={{ padding: '4px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <div style={{ width: '60px', height: '28px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={staff.trendData}>
                                <YAxis domain={[0, 100]} hide />
                                <Line 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke={staff.trendStatus === 'up' ? '#22c55e' : staff.trendStatus === 'down' ? '#ef4444' : '#94a3b8'} 
                                  strokeWidth={3} 
                                  dot={{ r: 2, fill: staff.trendStatus === 'up' ? '#22c55e' : staff.trendStatus === 'down' ? '#ef4444' : '#94a3b8' }} 
                                  animationDuration={1000}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                           {staff.trendStatus === 'up' && <TrendingUp size={16} color="#22c55e" />}
                           {staff.trendStatus === 'down' && <TrendingDown size={16} color="#ef4444" />}
                           {staff.trendStatus === 'stable' && <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>STABIL</span>}
                         </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar progress={staff.totalKPI} color={staff.kpiColor} />
                        </div>
                        <span className="mono fw-600" style={{ fontSize: '12px', color: staff.kpiColor }}>{staff.totalKPI}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <style>{`
        @media print {
          .no-print, .sidebar, .sidebar-header, .sidebar-footer { display: none !important; }
          .main-content { padding: 0 !important; margin: 0 !important; }
          .page-container { gap: 0; }
          .table-card { border: none; box-shadow: none; }
          .report-table th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
          @page { margin: 1cm; }
        }
        .report-view .data-table th { font-size: 9px; padding: 6px 4px; }
        .report-view .data-table td { padding: 4px 4px; }
      `}</style>
    </div>
  );
};

export default DetailedReport;
