import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Trophy, AlertCircle, Users, ClipboardCheck, TrendingUp, Filter, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const MOCK_TREND_DATA = [
  { name: 'Jan', value: 75 },
  { name: 'Feb', value: 78 },
  { name: 'Mar', value: 80 },
  { name: 'Apr', value: 85 },
  { name: 'Mei', value: 83 },
  { name: 'Jun', value: 88 },
  { name: 'Jul', value: 92 },
];

const MOCK_ACTIVITY: any[] = [];

const COLORS = ['#EC4899', '#3B82F6', '#8B5CF6', '#06B6D4', '#F97316'];

const Dashboard = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentDate = new Date();
  const currentMonth = indonesianMonths[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [userRole, setUserRole] = useState('');
  const [summary, setSummary] = useState({
    avgKPI: 0,
    totalStaff: 0,
    totalTickets: 0,
    needSupport: 0
  });
  
  const [errorCategories, setErrorCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchSettingsAndData = async () => {
      try {
        const session = sessionStorage.getItem('msa_session');
        if (session) setUserRole(JSON.parse(session).role);

        const { data: settings } = await supabase
          .from('global_settings')
          .select('value')
          .eq('id', 'dashboard_period')
          .single();

        if (settings) {
          const activeMonth = settings.value.month;
          const activeYear = settings.value.year.toString();
          setSelectedMonth(activeMonth);
          setSelectedYear(activeYear);
          await fetchDashboardDataInternal(activeMonth, activeYear);
        } else {
          fetchDashboardData();
        }
      } catch (err) {
        console.error('Error fetching global settings:', err);
        fetchDashboardData();
      }
    };

    fetchSettingsAndData();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  const fetchDashboardData = () => {
    fetchDashboardDataInternal(selectedMonth, selectedYear);
  };

  const fetchDashboardDataInternal = async (month: string, year: string) => {
    try {
      setLoading(true);
      
      let query = supabase.from('v_staff_report').select('*');
        
      if (month !== 'Semua') query = query.eq('periode', month);
      if (year !== 'Semua') query = query.eq('tahun', parseInt(year));

      const { data: staff, error } = await query;

      if (error) throw error;

      if (staff) {
        const calcPts = (val: number, params: any) => {
          for (const p of params) {
            if (val >= p.min && val <= p.max) return p.pts;
          }
          return 0;
        };

        let errRV = 0, errUP = 0, errRD = 0, errTPC = 0, errSG = 0, errPPI = 0, errVAL = 0, errTP = 0, errLL = 0;

        const processedStaff = staff.map(s => {
          errRV += (s.release_voucher || 0);
          errUP += (s.unapprove_pengajuan || 0);
          errRD += (s.recalculate_delinquency || 0);
          errTPC += (s.transfer_pencairan || 0);
          errSG += (s.salah_generate || 0);
          errPPI += (s.ppi_not_entry || 0);
          errVAL += (s.validasi || 0);
          errTP += (s.tiket_perbaikan || 0);
          errLL += (s.lain_lain || 0);

          // Update: Gunakan perhitungan Base 100 agar sinkron dengan halaman Performance Review
          const deduction = 
            (s.release_voucher || 0) * ERROR_WEIGHTS.releaseVoucher +
            (s.unapprove_pengajuan || 0) * ERROR_WEIGHTS.unapprovePengajuan +
            (s.recalculate_delinquency || 0) * ERROR_WEIGHTS.recalculateDelinquency +
            (s.transfer_pencairan || 0) * ERROR_WEIGHTS.transferPencairan +
            (s.salah_generate || 0) * ERROR_WEIGHTS.salahGenerate +
            ((s.validasi || 0) > 0 ? 1 : 0) * ERROR_WEIGHTS.validasi +
            (s.tiket_perbaikan || 0) * ERROR_WEIGHTS.tiketPerbaikan;

          const isMinggon = s.tahun > 2026 || (s.tahun === 2026 && ['Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].includes(s.periode));
          const m_minggon = isMinggon ? (s.ppi_not_entry || 0) : 0;
          const m_ll = s.lain_lain || 0;

          const totalKPI = 100 - deduction + m_minggon + m_ll;
          const gradeInfo = getGradeAndStatus(totalKPI);
          
          let status = 'critical';
          if (gradeInfo.status === 'success' || gradeInfo.status === 'info') status = 'on-track';
          else if (gradeInfo.status === 'warning') status = 'delayed';

          return { ...s, totalKPI, status };
        });

        setData(processedStaff);
        
        setErrorCategories([
          { name: 'Rel. Voucher', value: errRV },
          { name: 'Unapprove', value: errUP },
          { name: 'Recalculate', value: errRD },
          { name: 'Trf Pencairan', value: errTPC },
          { name: 'Salah Gen.', value: errSG },
          { name: 'Minggon', value: errPPI },
          { name: 'Validasi', value: errVAL },
          { name: 'Tiket', value: errTP },
          { name: 'Lain-Lain', value: errLL }
        ]);

        const uniqueStaffIds = new Set(processedStaff.map(s => s.id));
        const totalStaff = uniqueStaffIds.size;
        const avgKPI = Math.round(processedStaff.reduce((acc, curr) => acc + (curr.totalKPI || 0), 0) / (processedStaff.length || 1));
        const totalTickets = errTP;
        const needSupport = processedStaff.filter(s => s.status === 'critical' || s.status === 'delayed').length;

        setSummary({ avgKPI, totalStaff, totalTickets, needSupport });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedData = [...data].sort((a, b) => (b.totalKPI || 0) - (a.totalKPI || 0));
  const top2 = sortedData.slice(0, 2);
  const bottom2 = [...sortedData].reverse().slice(0, 2);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Memuat data analitik...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-main">
        {/* Header Actions */}
        <div className="dashboard-header-modern">
          <div className="title-area">
            <h1 className="neon-text">STATISTICS</h1>
            <p className="subtitle-text">{selectedMonth} {selectedYear} Overview</p>
          </div>
          {userRole === 'Administrator' && (
            <div className="filter-area">
              <div className="glass-select-wrapper">
                <Filter size={14} className="cyan-icon" />
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="glass-select">
                  {indonesianMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="Semua">Semua Bulan</option>
                </select>
              </div>
              <div className="glass-select-wrapper">
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="glass-select">
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="Semua">Semua Tahun</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Top Metric Cards Grid */}
        <div className="modern-metrics-grid">
          <Card className="modern-metric-card">
            <div className="mmc-top">
              <span className="mmc-label">Rata-rata Poin</span>
              <div className="mmc-icon-box"><TrendingUp size={16} /></div>
            </div>
            <div className="mmc-value">{summary.avgKPI}%</div>
            <div className="mmc-bottom">
              <span className="mmc-badge positive"><TrendingUp size={12} /> +1.2%</span>
              <ProgressBar progress={summary.avgKPI} height={4} color="var(--color-primary)" />
            </div>
          </Card>

          <Card className="modern-metric-card">
            <div className="mmc-top">
              <span className="mmc-label">Staf Aktif</span>
              <div className="mmc-icon-box"><Users size={16} /></div>
            </div>
            <div className="mmc-value">{summary.totalStaff}</div>
            <div className="mmc-bottom">
              <span className="mmc-badge positive"><TrendingUp size={12} /> +5</span>
              <span className="mmc-sub">Dari bulan lalu</span>
            </div>
          </Card>

          <Card className="modern-metric-card">
            <div className="mmc-top">
              <span className="mmc-label">Tiket Perbaikan</span>
              <div className="mmc-icon-box"><ClipboardCheck size={16} /></div>
            </div>
            <div className="mmc-value">{summary.totalTickets}</div>
            <div className="mmc-bottom">
              <span className="mmc-badge negative"><TrendingUp size={12} style={{transform: 'rotate(180deg)'}} /> -2%</span>
              <span className="mmc-sub">Kasus ditutup</span>
            </div>
          </Card>

          <Card className="modern-metric-card">
            <div className="mmc-top">
              <span className="mmc-label">Butuh Support</span>
              <div className="mmc-icon-box"><AlertCircle size={16} /></div>
            </div>
            <div className="mmc-value">{summary.needSupport}</div>
            <div className="mmc-bottom">
              <span className="mmc-badge neutral"><TrendingUp size={12} style={{transform: 'rotate(90deg)'}} /> Stabil</span>
              <span className="mmc-sub">Staf delayed</span>
            </div>
          </Card>
        </div>

        {/* Main Charts Area */}
        <div className="charts-grid">
          {/* Line Chart Panel */}
          <Card className="chart-panel line-chart-panel">
            <div className="panel-header">
              <h3>Tren Poin Staf</h3>
              <button className="panel-more-btn">...</button>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '12px', color: '#1E293B' }}
                    itemStyle={{ color: '#6366F1' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--color-primary)" 
                    strokeWidth={3} 
                    dot={{ fill: '#FFFFFF', stroke: '#6366F1', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6, fill: '#6366F1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Donut Chart Panel */}
          <Card className="chart-panel donut-chart-panel">
            <div className="panel-header">
              <h3>Distribusi Kesalahan</h3>
              <span className="panel-subtitle">Bulan ini</span>
            </div>
            <div className="donut-container">
              <div className="donut-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={errorCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      cornerRadius={10}
                      dataKey="value"
                      stroke="none"
                    >
                      {errorCategories.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '12px', color: '#1E293B' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center-text">
                  <span>Total</span>
                  <strong>{errorCategories.reduce((a,b)=>a+b.value, 0)}</strong>
                </div>
              </div>
              <div className="donut-legend">
                {errorCategories.map((item, i) => (
                  <div key={i} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-val">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right Sidebar - Activities */}
      <div className="dashboard-sidebar desktop-only">
        {MOCK_ACTIVITY && MOCK_ACTIVITY.length > 0 && (
          <Card className="activity-panel">
            <div className="panel-header">
              <h3>Aktivitas Terbaru</h3>
              <Activity size={16} className="cyan-icon" />
            </div>
            <div className="activity-list">
              {MOCK_ACTIVITY.map(act => (
                <div key={act.id} className="activity-item">
                  <div className="act-avatar">{act.avatar}</div>
                  <div className="act-details">
                    <span className="act-desc"><strong>{act.user}</strong> {act.action}</span>
                    <span className="act-time">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="contacts-panel mt-4">
          <div className="panel-header">
            <h3>Top Performers</h3>
            <Trophy size={16} className="cyan-icon" />
          </div>
          <div className="contacts-list">
            {top2.map((staff) => (
              <div key={staff.id} className="contact-item">
                <div className="contact-avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2FF', color: '#6366F1', fontWeight: 'bold', fontSize: '14px', overflow: 'hidden'}}>
                  {staff.avatar_url ? (
                    <img src={staff.avatar_url} alt={staff.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : (
                    staff.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase()
                  )}
                </div>
                <div className="contact-info">
                  <span className="contact-name">{staff.name}</span>
                  <span className="contact-score">{staff.totalKPI}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="contacts-panel mt-4">
          <div className="panel-header">
            <h3>Butuh Support</h3>
            <AlertCircle size={16} style={{color: 'var(--color-warning)'}} />
          </div>
          <div className="contacts-list">
            {bottom2.map((staff) => (
              <div key={staff.id} className="contact-item">
                <div className="contact-avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF3C7', color: '#D97706', fontWeight: 'bold', fontSize: '14px', overflow: 'hidden'}}>
                  {staff.avatar_url ? (
                    <img src={staff.avatar_url} alt={staff.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : (
                    staff.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase()
                  )}
                </div>
                <div className="contact-info">
                  <span className="contact-name">{staff.name}</span>
                  <span className="contact-score" style={{color: 'var(--color-warning)'}}>{staff.totalKPI}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
