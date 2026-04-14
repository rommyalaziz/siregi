import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Drawer } from '../components/Drawer';
import { Search, Filter, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TableStyles.css';

const StaffProgress = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  useEffect(() => {
    fetchStaffData();
  }, []);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      const { data: staff, error } = await supabase
        .from('staff_progress')
        .select('*')
        .order('performance', { ascending: false });

      if (error) throw error;
      setData(staff || []);
    } catch (error) {
      console.error('Error fetching staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'on track' || s === 'on-track') {
      return { variant: 'on-track' as BadgeVariant, label: 'On Track', color: 'var(--color-secondary)' };
    }
    if (s === 'delayed' || s === 'needs focus' || s === 'needs-focus') {
      return { variant: 'delayed' as BadgeVariant, label: 'Needs Focus', color: 'var(--color-warning)' };
    }
    return { variant: 'critical' as BadgeVariant, label: 'Critical', color: 'var(--color-danger)' };
  };

  const openDrawer = (staff: any) => setSelectedStaff(staff);
  const closeDrawer = () => setSelectedStaff(null);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Progres Staf</h1>
          <p>Pantau KPI dan target kinerja individu.</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="Cari staf..." />
          </div>
          <button className="btn btn-outline">
            <Filter size={16} /> Saring
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
                <th>FSA/MSA</th>
                <th className="center-text">Rel.<br/>Vouch</th>
                <th className="center-text">Unappr.<br/>Peng.</th>
                <th className="center-text">Recalc.<br/>Delinq.</th>
                <th className="center-text">Trans.<br/>Penc.</th>
                <th className="center-text">Salah<br/>Gen.</th>
                <th className="center-text">PPI Not<br/>Ent.</th>
                <th className="center-text">Validasi</th>
                <th className="center-text">Tiket<br/>Perb.</th>
                <th style={{ minWidth: '60px' }}>KPI</th>
                <th className="center-text">Status</th>
                <th className="center-text">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="center-text" style={{ padding: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--color-text-muted)' }}>
                      <Loader2 className="animate-spin" size={24} />
                      <span>Memuat data dari database...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={15} className="center-text" style={{ padding: '40px', color: 'var(--color-text-muted)' }}>
                    Data tidak ditemukan. Silakan tambahkan data di Supabase.
                  </td>
                </tr>
              ) : (
                data.map((staff, index) => {
                  const statusConfig = getStatusConfig(staff.status);
                  return (
                    <tr key={staff.id}>
                      <td className="center-text mono text-muted">{index + 1}</td>
                      <td className="center-text mono">{staff.id}</td>
                      <td className="fw-500">{staff.branch}</td>
                      <td>{staff.name}</td>
                      <td className="center-text">{staff.release_voucher === 0 ? <span className="text-muted">-</span> : staff.release_voucher}</td>
                      <td className="center-text">{staff.unapprove_pengajuan === 0 ? <span className="text-muted">-</span> : staff.unapprove_pengajuan}</td>
                      <td className="center-text">{staff.recalculate_delinquency === 0 ? <span className="text-muted">-</span> : staff.recalculate_delinquency}</td>
                      <td className="center-text">{staff.transfer_pencairan === 0 ? <span className="text-muted">-</span> : staff.transfer_pencairan}</td>
                      <td className="center-text">{staff.salah_generate === 0 ? <span className="text-muted">-</span> : staff.salah_generate}</td>
                      <td className="center-text">{staff.ppi_not_entry === 0 ? <span className="text-muted">-</span> : staff.ppi_not_entry}</td>
                      <td className="center-text">{staff.validasi === 0 ? <span className="text-muted">-</span> : staff.validasi}</td>
                      <td className="center-text">{staff.tiket_perbaikan === 0 ? <span className="text-muted">-</span> : staff.tiket_perbaikan}</td>
                      <td>
                        <ProgressBar 
                          progress={staff.performance} 
                          color={statusConfig.color}
                        />
                      </td>
                      <td className="center-text">
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="center-text">
                        <button className="icon-btn" title="Lihat Detail" onClick={() => openDrawer(staff)}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="fw-500" style={{ fontSize: '18px' }}>{selectedStaff.role}</span>
                <span className="mono">{selectedStaff.id}</span>
              </div>
              <p><strong>Cabang Utama:</strong> {selectedStaff.branch}</p>
            </div>
            
            <div className="drawer-section">
              <h3>Evaluasi KPI</h3>
              <div style={{ marginTop: '8px' }}>
                <ProgressBar 
                  progress={selectedStaff.performance} 
                  label="Pencapaian Target"
                  color={getStatusConfig(selectedStaff.status).color}
                />
              </div>
            </div>

            <div className="drawer-section" style={{ marginTop: '24px' }}>
              <button className="btn btn-primary w-full justify-center">
                Unduh Laporan Lengkap
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default StaffProgress;
