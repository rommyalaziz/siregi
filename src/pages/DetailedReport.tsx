import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Search, Printer, Loader2, Ticket, ShieldAlert, RefreshCw, Coins, FileX, ClipboardType, CheckCircle2, Wrench, MoreHorizontal, Filter, Download } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { ERROR_WEIGHTS, getGradeAndStatus } from './StaffProgress';
import './TableStyles.css';

const DetailedReport = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('Semua');
  const [selectedQuarter, setSelectedQuarter] = useState('Semua');

  useEffect(() => {
    fetchCumulativeData();
  }, [selectedYear, selectedQuarter]);

  const fetchCumulativeData = async () => {
    try {
      setLoading(true);
      let query = supabase.from('staff_progress').select('*');
      if (selectedYear !== 'Semua') {
        query = query.eq('tahun', parseInt(selectedYear));
      }
      const { data: records, error } = await query;
      
      if (error) throw error;

      if (records) {
        // Define months for each quarter
        const quarterMonths: Record<string, string[]> = {
          '1': ['Januari', 'Februari', 'Maret'],
          '2': ['April', 'Mei', 'Juni'],
          '3': ['Juli', 'Agustus', 'September'],
          '4': ['Oktober', 'November', 'Desember']
        };

        // Filter records by Quarter if selected
        const finalRecords = selectedQuarter === 'Semua' 
          ? records 
          : records.filter(r => (quarterMonths[selectedQuarter] || []).includes(r.periode));

        // Group by Staff ID
        const grouped = finalRecords.reduce((acc: any, curr: any) => {
          if (!acc[curr.id]) {
            acc[curr.id] = {
              id: curr.id,
              name: curr.name,
              branch: curr.branch,
              avatar_url: null, // Initialize to null, will be resolved below
              rv: 0, up: 0, rd: 0, tp: 0, sg: 0, ppi: 0, val: 0, tpk: 0, ll: 0,
              lastValPeriode: '',
              monthlyHistory: {}, // To store KPI per month
              keteranganHistory: [] // To store history of lain_lain_keterangan
            };
          }

          // Always prefer any valid avatar_url found in any period record
          if (curr.avatar_url && curr.avatar_url.trim() !== '') {
            acc[curr.id].avatar_url = curr.avatar_url;
          }

          acc[curr.id].rv += curr.release_voucher || 0;
          acc[curr.id].up += curr.unapprove_pengajuan || 0;
          acc[curr.id].rd += curr.recalculate_delinquency || 0;
          acc[curr.id].tp += curr.transfer_pencairan || 0;
          acc[curr.id].sg += curr.salah_generate || 0;
          
          const isMinggonMonth = Number(curr.tahun) > 2026 || (Number(curr.tahun) === 2026 && ['Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].includes(curr.periode));
          
          // Store raw sum for display only for valid Minggon months
          acc[curr.id].ppi += isMinggonMonth ? (curr.ppi_not_entry || 0) : 0; 
          
          // Logic for Validasi: Take latest month's value instead of sum
          const periodRank: Record<string, number> = {
            'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4,
            'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8,
            'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
          };
          const currentPeriod = curr.periode || '';
          const existingPeriod = acc[curr.id].lastValPeriode || '';
          
          if (!acc[curr.id].lastValPeriode || periodRank[currentPeriod] >= periodRank[existingPeriod]) {
            acc[curr.id].val = curr.validasi || 0;
            acc[curr.id].lastValPeriode = currentPeriod;
          }
          
          acc[curr.id].tpk += curr.tiket_perbaikan || 0;
          acc[curr.id].ll  += curr.lain_lain || 0;

          if (curr.lain_lain_keterangan && curr.lain_lain_keterangan.trim() !== '') {
            acc[curr.id].keteranganHistory.push(`${curr.periode}: ${curr.lain_lain_keterangan}`);
          }

          // Calculate KPI for THIS specific month record
          const deduction = 
            (curr.release_voucher || 0) * ERROR_WEIGHTS.releaseVoucher +
            (curr.unapprove_pengajuan || 0) * ERROR_WEIGHTS.unapprovePengajuan +
            (curr.recalculate_delinquency || 0) * ERROR_WEIGHTS.recalculateDelinquency +
            (curr.transfer_pencairan || 0) * ERROR_WEIGHTS.transferPencairan +
            (curr.salah_generate || 0) * ERROR_WEIGHTS.salahGenerate +
            ((curr.validasi || 0) > 0 ? 1 : 0) * ERROR_WEIGHTS.validasi +
            (curr.tiket_perbaikan || 0) * ERROR_WEIGHTS.tiketPerbaikan;

          const p_ppi = isMinggonMonth ? (curr.ppi_not_entry || 0) : 0;
          const p_ll  = curr.lain_lain || 0;
          
          const monthKpi = 100 - deduction + p_ppi + p_ll;
          acc[curr.id].monthlyHistory[curr.periode] = monthKpi;

          return acc;
        }, {});

        const result = Object.values(grouped).map((s: any) => {
          // Hitung rata-rata nilai bulanan alih-alih mengurangi total kesalahan dari 100
          const monthlyKeys = Object.keys(s.monthlyHistory);
          const totalScore = monthlyKeys.reduce((sum, key) => sum + s.monthlyHistory[key], 0);
          const totalKPI = monthlyKeys.length > 0 ? Math.round(totalScore / monthlyKeys.length) : 100;
          
          // Format trend data for sparkline (last 3 months dynamically)
          const monthOrder = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
          const availableMonths = monthOrder.filter(m => s.monthlyHistory[m] !== undefined);
          const last3 = availableMonths.slice(-3);
          const trendData = last3.length >= 2
            ? last3.map(m => ({ score: s.monthlyHistory[m] || 0 }))
            : [{ score: 100 }, { score: 100 }, { score: 100 }];

          // Calculate trend status (comparing last two available months)
          const prevVal = last3.length >= 2 ? (s.monthlyHistory[last3[last3.length - 2]] || 100) : 100;
          const lastVal = last3.length >= 1 ? (s.monthlyHistory[last3[last3.length - 1]] || 100) : 100;
          let trendStatus = 'stable';
          if (lastVal > prevVal) trendStatus = 'up';
          else if (lastVal < prevVal) trendStatus = 'down';

          const gradeInfo = getGradeAndStatus(totalKPI);

          return { ...s, totalKPI, kpiColor: gradeInfo.color, grade: gradeInfo.grade, status: gradeInfo.status, statusVariant: gradeInfo.variant, trendData, trendStatus, keteranganHistory: s.keteranganHistory };
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

  const handleExportCSV = () => {
    if (data.length === 0) return;
    
        const headers = ["No", "Kode", "Cabang", "Nama Staf", "RV", "UP", "RD", "TP", "SG", "MINGGON", "VAL", "TPK", "LL", "Grade Rata-rata", "Point Rata-rata (%)", "Tren"];
    
    const rows = data.map((s, index) => [
      index + 1,
      `"${s.id}"`,
      `"${s.branch}"`,
      `"${s.name}"`,
      s.rv || 0,
      s.up || 0,
      s.rd || 0,
      s.tp || 0,
      s.sg || 0,
      s.ppi || 0,
      s.val || 0,
      s.tpk || 0,
      s.ll || 0,
      s.grade,
      s.totalKPI,
      s.trendStatus.toUpperCase()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `MSA_Laporan_Detail_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container report-view">
      <div className="page-header no-print">
        <div>
          <h1>Laporan Detail Akumulatif</h1>
          <p>Rekapitulasi total kesalahan dan performa staff {selectedYear !== 'Semua' ? `tahun ${selectedYear}` : 'semua tahun'}{selectedQuarter !== 'Semua' ? ` (Triwulan ${selectedQuarter})` : ''}.</p>
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
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
            >
              <option value="Semua">Semua Triwulan</option>
              <option value="1">Triwulan 1 (Jan-Mar)</option>
              <option value="2">Triwulan 2 (Apr-Jun)</option>
              <option value="3">Triwulan 3 (Jul-Sep)</option>
              <option value="4">Triwulan 4 (Okt-Des)</option>
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
          <button className="btn btn-outline" onClick={handleExportCSV}>
            <Download size={16} />
            <span>Ekspor CSV</span>
          </button>
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
                    <span>MINGGON</span>
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
                <th className="center-text">PROGRES TREN</th>
                <th className="center-text">GRADE RATA-RATA</th>
                <th style={{ minWidth: '70px' }}>POINT RATA-RATA</th>
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
                    <td className="center-text mono" data-label="Release Voucher">{staff.rv || '-'}</td>
                    <td className="center-text mono" data-label="Unapprove Pengajuan">{staff.up || '-'}</td>
                    <td className="center-text mono" data-label="Recalculate Delinquency">{staff.rd || '-'}</td>
                    <td className="center-text mono" data-label="Transfer Pencairan">{staff.tp || '-'}</td>
                    <td className="center-text mono" data-label="Salah Generate">{staff.sg || '-'}</td>
                    <td className="center-text mono" data-label="Minggon">{staff.ppi === 0 ? '-' : staff.ppi}</td>
                    <td className="center-text mono" data-label="Validasi">{staff.val || '-'}</td>
                    <td className="center-text mono" data-label="Tiket Perbaikan">{staff.tpk || '-'}</td>
                    <td className="center-text mono" data-label="Lain-lain">
                      <div>
                        {staff.ll === 0 
                          ? '-' 
                          : staff.ll > 0 
                            ? `+${staff.ll}` 
                            : staff.ll}
                      </div>
                      {staff.keteranganHistory && staff.keteranganHistory.length > 0 && (
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
                        }} title={staff.keteranganHistory.join('; ')}>
                          {staff.keteranganHistory.join('; ')}
                        </div>
                      )}
                    </td>
                    <td className="center-text" data-label="Progres Tren" style={{ padding: '4px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <div style={{ width: '80px', height: '28px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={staff.trendData}>
                                <YAxis domain={[0, 100]} hide />
                                <Line 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke={staff.trendStatus === 'up' ? '#22c55e' : staff.trendStatus === 'down' ? 'var(--color-danger)' : '#94a3b8'} 
                                  strokeWidth={3} 
                                  dot={{ r: 2, fill: staff.trendStatus === 'up' ? '#22c55e' : staff.trendStatus === 'down' ? 'var(--color-danger)' : '#94a3b8' }} 
                                  animationDuration={1000}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                    </td>
                    <td className="center-text" data-label="Grade">
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: staff.kpiColor }}>
                        {staff.grade}
                      </div>
                    </td>
                    <td data-label="Point">
                      <span className="mono fw-600" style={{ fontSize: '14px', color: staff.kpiColor }}>
                        {staff.totalKPI}
                      </span>
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
        @media (max-width: 1024px) {
          .report-view .data-table th span { font-size: 7px; }
          .report-view .data-table td[data-label="Progres Tren"] { min-width: 120px; }
        }
      `}</style>
    </div>
  );
};

export default DetailedReport;
