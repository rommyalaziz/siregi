import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Trophy, AlertCircle, Users, ClipboardCheck, MessageSquare, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    avgKPI: 0,
    totalStaff: 0,
    totalTickets: 0,
    needSupport: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch dynamic KPI from VIEW for April
      const { data: staff, error } = await supabase
        .from('v_staff_report')
        .select('*')
        .eq('periode', 'April');

      if (error) throw error;

      if (staff) {
        const processedStaff = staff.map(s => {
          const totalKPI = (s.p_rv || 0) + (s.p_up || 0) + (s.p_rd || 0) + (s.p_tp || 0) + 
                           (s.p_sg || 0) + (s.p_ppi || 0) + (s.p_val || 0) + (s.p_tpk || 0);
          
          let status = 'critical';
          if (totalKPI >= 90) status = 'on-track';
          else if (totalKPI >= 70) status = 'delayed';
          
          return { ...s, totalKPI, status };
        });

        setData(processedStaff);
        
        // Calculate Summary
        const totalStaff = processedStaff.length;
        const avgKPI = Math.round(processedStaff.reduce((acc, curr) => acc + (curr.totalKPI || 0), 0) / (totalStaff || 1));
        const totalTickets = processedStaff.reduce((acc, curr) => acc + (curr.tpk || 0), 0);
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
        <p>Menyiapkan data performa...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Ringkasan Beranda</h1>
        <p>Analisis pencapaian dan dukungan untuk progres staf regional.</p>
      </div>

      <div className="highlights-grid">
        {/* BEST PERFORMERS */}
        <Card className="highlight-card success-gradient">
          <div className="highlight-header">
            <Trophy size={24} className="icon-gold" />
            <div>
              <h3>Apresiasi Kinerja Terbaik</h3>
              <p className="welcome-msg">Selamat atas pencapaian luar biasa Anda!</p>
            </div>
          </div>
          <div className="highlight-list">
            {top2.map(staff => (
              <div key={staff.id} className="highlight-item">
                <div className="avatar-wrapper highlight-avatar">
                   <img 
                     src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=A8E6CF&color=2E7D61&bold=true`} 
                     alt={staff.name} 
                   />
                </div>
                <div className="item-info">
                  <span className="name">{staff.name}</span>
                </div>
                <div className="item-score">
                  <span className="score">{staff.totalKPI}%</span>
                  <ProgressBar progress={staff.totalKPI} color="#ffffff" height={6} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* NEEDS SUPPORT */}
        <Card className="highlight-card warning-gradient">
          <div className="highlight-header">
            <AlertCircle size={24} className="icon-white" />
            <div>
              <h3>Butuh Fokus Tambahan</h3>
              <p className="welcome-msg">Tetap semangat, mari kita tingkatkan progres!</p>
            </div>
          </div>
          <div className="highlight-list">
            {bottom2.map(staff => (
              <div key={staff.id} className="highlight-item">
                <div className="avatar-wrapper highlight-avatar">
                   <img 
                     src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=fee2e2&color=991b1b&bold=true`} 
                     alt={staff.name} 
                   />
                </div>
                <div className="item-info">
                  <span className="name">{staff.name}</span>
                </div>
                <div className="item-score">
                  <span className="score">{staff.totalKPI}%</span>
                  <ProgressBar progress={staff.totalKPI} color="rgba(255,255,255,0.6)" height={6} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <h2 className="section-title">Informasi Penting Performance Review</h2>
      <div className="metrics-grid">
        <Card className="metric-card">
          <div className="metric-header">
            <h3>Rata-rata Point Regional</h3>
            <div className="metric-icon teal">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="metric-value">{summary.avgKPI}%</div>
          <div className="metric-progress">
             <ProgressBar progress={summary.avgKPI} />
          </div>
        </Card>

        <Card className="metric-card">
          <div className="metric-header">
            <h3>FSA/MSA Aktif</h3>
            <div className="metric-icon green-deep">
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{summary.totalStaff}</div>
          <div className="metric-subtitle">Staf terdaftar di database</div>
        </Card>

        <Card className="metric-card">
          <div className="metric-header">
            <h3>Tiket Perbaikan</h3>
            <div className="metric-icon pink">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{summary.totalTickets}</div>
          <div className="metric-subtitle">Total anomali yang ditemukan</div>
        </Card>

        <Card className="metric-card">
          <div className="metric-header">
            <h3>Butuh Bimbingan</h3>
            <div className="metric-icon orange">
              <MessageSquare size={20} />
            </div>
          </div>
          <div className="metric-value">{summary.needSupport}</div>
          <div className="metric-subtitle">Staf dengan status Non-Track</div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
