import { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Activity, TrendingUp, Users, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './VisualStyles.css';

const VisualDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [errorDistribution, setErrorDistribution] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [stats, setStats] = useState({ avgKpi: 0, totalErrors: 0, activeStaff: 0 });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data: records, error } = await supabase
        .from('v_staff_report')
        .select('*');
      
      if (error) throw error;

      if (records) {
        // 1. Process Trend Data (Average KPI per Month)
        const months = ['Februari', 'Maret', 'April'];
        const trend = months.map(m => {
          const monthRecords = records.filter(r => r.periode === m);
          const avg = monthRecords.length > 0
            ? monthRecords.reduce((acc, curr) => {
                const kpi = (curr.p_rv || 0) + (curr.p_up || 0) + (curr.p_rd || 0) + (curr.p_tp || 0) + 
                            (curr.p_sg || 0) + (curr.p_ppi || 0) + (curr.p_val || 0) + (curr.p_tpk || 0);
                return acc + kpi;
              }, 0) / monthRecords.length
            : 0;
          return { name: m, kpi: Math.round(avg) };
        });
        setPerformanceData(trend);

        // 2. Process Error Distribution (Radar)
        const errTotals = records.reduce((acc, curr) => ({
          'Voucher': acc['Voucher'] + (curr.release_voucher || 0),
          'Unapprove': acc['Unapprove'] + (curr.unapprove_pengajuan || 0),
          'Delinquency': acc['Delinquency'] + (curr.recalculate_delinquency || 0),
          'Transfer': acc['Transfer'] + (curr.transfer_pencairan || 0),
          'Generate': acc['Generate'] + (curr.salah_generate || 0),
          'Minggon': acc['Minggon'] + (curr.ppi_not_entry || 0),
          'Validasi': acc['Validasi'] + (curr.validasi || 0),
        }), { 'Voucher': 0, 'Unapprove': 0, 'Delinquency': 0, 'Transfer': 0, 'Generate': 0, 'Minggon': 0, 'Validasi': 0 });

        const radarData = Object.keys(errTotals).map(key => ({
          subject: key,
          A: errTotals[key as keyof typeof errTotals],
          fullMark: Math.max(...Object.values(errTotals) as number[]) + 5
        }));
        setErrorDistribution(radarData);

        // 3. Process Top Performers (April only)
        const aprilStaff = records.filter(r => r.periode === 'April').map(s => {
          const kpi = (s.p_rv || 0) + (s.p_up || 0) + (s.p_rd || 0) + (s.p_tp || 0) + 
                      (s.p_sg || 0) + (s.p_ppi || 0) + (s.p_val || 0) + (s.p_tpk || 0);
          return { ...s, totalKPI: kpi };
        });
        setTopPerformers(aprilStaff.sort((a, b) => b.totalKPI - a.totalKPI).slice(0, 5));

        // 4. Global Stats
        const totalKpi = trend.reduce((acc, curr) => acc + curr.kpi, 0) / trend.length;
        const totalErrCount = records.reduce((acc, curr) => 
          acc + (curr.release_voucher || 0) + (curr.unapprove_pengajuan || 0) + 
          (curr.recalculate_delinquency || 0) + (curr.validasi || 0), 0);
        
        setStats({
          avgKpi: Math.round(totalKpi),
          totalErrors: totalErrCount,
          activeStaff: new Set(records.map(r => r.id)).size
        });
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="visual-dashboard justify-center items-center">
        <Loader2 className="animate-spin text-neon-green" size={48} />
        <p className="mt-4 text-gray-400">Loading Pulse Data...</p>
      </div>
    );
  }

  return (
    <div className="visual-dashboard">
      <div className="visual-header">
        <h1>THE SIREGI PULSE</h1>
        <p className="text-gray-400">Visual analytics of individual & team performance metrics.</p>
      </div>

      <div className="stats-row">
        {[
          { label: 'Avg KPI Score', value: `${stats.avgKpi}%`, icon: Activity, color: 'var(--neon-green)' },
          { label: 'Active Staff', value: stats.activeStaff, icon: Users, color: 'var(--neon-blue)' },
          { label: 'Total Errors', value: stats.totalErrors, icon: AlertCircle, color: 'var(--color-danger)' },
          { label: 'Trend Factor', value: '+12.4%', icon: TrendingUp, color: 'var(--neon-purple)' },
        ].map((s, i) => (
          <div key={i} className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <s.icon size={20} style={{ color: s.color }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>LIVE</span>
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="visual-grid">
        <div className="glass-card">
          <h3><TrendingUp size={16} /> Performance Wave (Quarterly)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorKpi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--neon-green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="kpi" 
                  stroke="var(--neon-green)" 
                  fillOpacity={1} 
                  fill="url(#colorKpi)" 
                  strokeWidth={3}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card">
          <h3><Activity size={16} /> Error Radar</h3>
          <div className="radar-section">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={errorDistribution}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 10}} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <Radar
                   
                  dataKey="A"
                  stroke="var(--neon-purple)"
                  fill="var(--neon-purple)"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="visual-grid">
        <div className="glass-card">
          <h3><Users size={16} /> Elite Performers (Monthly Apex)</h3>
          <div className="top-performers">
            {topPerformers.map((s, i) => (
              <div key={i} className="performer-card">
                <div className="performer-rank">0{i+1}</div>
                <div className="performer-info">
                  <div className="performer-name">{s.name}</div>
                  <div className="performer-branch">{s.branch}</div>
                </div>
                <div className="performer-score">{s.totalKPI}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
           <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(45deg, var(--neon-green), var(--neon-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)' }}>
              <TrendingUp size={40} color="white" />
           </div>
           <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Peak Performance</h2>
           <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', maxWidth: '200px', marginTop: '8px' }}>
              Your team reached a milestone of 92% efficiency in April.
           </p>
           <button className="btn btn-primary" style={{ marginTop: '24px', background: 'var(--neon-blue)', border: 'none' }}>
              Full Insight
           </button>
        </div>
      </div>
    </div>
  );
};

export default VisualDashboard;
