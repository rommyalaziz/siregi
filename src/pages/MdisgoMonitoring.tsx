import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, Users, Plus, Pencil, Trash2,
  X, Loader2, CheckCircle2, GraduationCap, Save, Clock, Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './MdisgoMonitoring.css';

interface MdisgoBranch {
  id: string;
  branch_code: string;
  branch_name: string;
  training_date: string | null;
  members_accessed: number;
  total_members: number;
  total_center: number;
  accessed_center: number;
  status: string;
}

const MdisgoMonitoring = () => {
  const [data, setData] = useState<MdisgoBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Last updated info
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState('');
  const [_savingInfo, setSavingInfo] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MdisgoBranch | null>(null);
  const [formData, setFormData] = useState({
    branch_code: '',
    branch_name: '',
    training_date: '',
    members_accessed: 0,
    total_members: 0,
    total_center: 0,
    accessed_center: 0,
    status: 'Belum'
  });
  const [saving, setSaving] = useState(false);

  // Check admin role
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: branches, error } = await supabase
        .from('mdisgo_branches')
        .select('*')
        .order('members_accessed', { ascending: false });

      if (error) throw error;
      setData(branches || []);

      // Fetch last updated info
      try {
        const { data: settingData, error: settingError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'mdisgo_last_updated')
          .single();

        if (!settingError && settingData) {
          setLastUpdatedInfo(settingData.value);
        }
      } catch (err) {
        // Silently fail if table doesn't exist yet
        console.warn('Could not fetch app_settings, maybe table not created yet.');
      }

    } catch (err) {
      console.error('Error fetching MDISGO data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Summary calculations
  const totalBranches = data.length;
  const trainedBranches = data.filter(b => b.status !== 'Belum').length;
  const totalMembers = data.reduce((acc, curr) => acc + (curr.members_accessed || 0), 0);
  const targetReachedBranches = data.filter(b => b.total_members && b.status !== 'Belum' && ((b.members_accessed / b.total_members) * 100) >= 20).length;
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Modal handlers
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ branch_code: '', branch_name: '', training_date: '', members_accessed: 0, total_members: 0, total_center: 0, accessed_center: 0, status: 'Belum' });
    setShowModal(true);
  };

  const openEditModal = (item: MdisgoBranch) => {
    setEditingItem(item);
    setFormData({
      branch_code: item.branch_code,
      branch_name: item.branch_name,
      training_date: item.training_date || '',
      members_accessed: item.members_accessed,
      total_members: item.total_members || 0,
      total_center: item.total_center || 0,
      accessed_center: item.accessed_center || 0,
      status: item.status
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    if (!formData.branch_name || !formData.branch_code) {
      setMessage({ type: 'error', text: 'Kode dan nama cabang wajib diisi.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branch_code: formData.branch_code,
        branch_name: formData.branch_name,
        training_date: formData.training_date || null,
        members_accessed: formData.members_accessed,
        total_members: formData.total_members,
        total_center: formData.total_center,
        accessed_center: formData.accessed_center,
        status: formData.status
      };

      if (editingItem) {
        const { error } = await supabase
          .from('mdisgo_branches')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        setMessage({ type: 'success', text: `Data "${formData.branch_name}" berhasil diperbarui.` });
      } else {
        const { error } = await supabase
          .from('mdisgo_branches')
          .insert(payload);
        if (error) throw error;
        setMessage({ type: 'success', text: `Cabang "${formData.branch_name}" berhasil ditambahkan.` });
      }

      closeModal();
      fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan data.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: MdisgoBranch) => {
    if (!window.confirm(`Hapus data cabang "${item.branch_name}"?`)) return;
    try {
      const { error } = await supabase
        .from('mdisgo_branches')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      setMessage({ type: 'success', text: `"${item.branch_name}" berhasil dihapus.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus data.' });
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'mdisgo_last_updated', value: newDate, updated_at: new Date().toISOString() });

      if (error) throw error;

      setLastUpdatedInfo(newDate);
      setMessage({ type: 'success', text: 'Tanggal update berhasil disimpan.' });
    } catch (err: any) {
      console.error('Error saving update info:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan info update.' });
    } finally {
      setSavingInfo(false);
    }
  };

  // Filtered + sorted by members accessed descending
  const filteredData = data
    .filter(b =>
      b.branch_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branch_code.includes(searchQuery)
    )
    .sort((a, b) => b.members_accessed - a.members_accessed || a.branch_name.localeCompare(b.branch_name, 'id'));

  return (
    <div className="mdisgo-container">
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px', marginTop: '2px' }}>
          <button className="btn btn-primary mdisgo-btn-add" onClick={openAddModal}>
            <Plus size={12} />
            <span>Tambah Cabang</span>
          </button>
        </div>
      )}
      {/* Header */}
      <div className="mdisgo-header">
        <div className="mdisgo-header-titles">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1>MDISGO</h1>
            <div
              className="mdisgo-update-badge"
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              onClick={(e) => {
                if (isAdmin) {
                  const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                  try {
                    input?.showPicker();
                  } catch (err) {
                    // Fallback for browsers that don't support showPicker
                    input?.focus();
                  }
                }
              }}
            >
              <Clock size={12} />
              <span>Update Data: <strong>{lastUpdatedInfo ? new Date(lastUpdatedInfo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pilih Tanggal'}</strong></span>
              {isAdmin && (
                <input
                  type="date"
                  className="mdisgo-hidden-date-input"
                  style={{ position: 'absolute', visibility: 'hidden' }}
                  value={lastUpdatedInfo || ''}
                  onChange={handleDateChange}
                  title="Pilih tanggal update"
                />
              )}
            </div>
          </div>
          <span className="mdisgo-subtitle">Monitoring cabang yang telah mengikuti training MDISGO.</span>
        </div>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`mdisgo-toast ${message.type}`}>
          <CheckCircle2 size={13} />
          {message.text}
        </div>
      )}

      {/* Summary Stats — 5 cards */}
      <div className="mdisgo-stats-grid">
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon blue">
            <Building2 size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Total Cabang</h4>
            <div className="stat-value">{totalBranches}</div>
            <div className="stat-sub">Cabang terdaftar</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon green">
            <GraduationCap size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Sudah Training</h4>
            <div className="stat-value">{trainedBranches}</div>
            <div className="stat-sub">Active / Completed</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
            <Target size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Pencapaian Target</h4>
            <div className="stat-value">{targetReachedBranches} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>dari {totalBranches}</span></div>
            <div className="stat-sub">Sudah capai 20%</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon purple">
            <Users size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Total Akses Anggota</h4>
            <div className="stat-value">{totalMembers.toLocaleString('id-ID')}</div>
          </div>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="mdisgo-table-card">
        <div className="mdisgo-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>
              <GraduationCap size={13} style={{ verticalAlign: 'middle', marginRight: '5px', opacity: 0.5 }} />
              Daftar Cabang MDISGO
            </h3>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              ({filteredData.length} cabang)
            </span>
          </div>
          <div className="search-box table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Cari cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mdisgo-table-wrapper">
          {loading ? (
            <div className="mdisgo-loading">
              <Loader2 className="animate-spin" size={22} />
              <span>Memuat data...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="mdisgo-empty">
              <div className="mdisgo-empty-icon"><Building2 size={36} /></div>
              <h4>Belum ada data</h4>
              <p>{searchQuery ? 'Tidak ditemukan.' : 'Klik "Tambah" untuk menambahkan cabang.'}</p>
            </div>
          ) : (
            <table className="mdisgo-table">
              <thead>
                <tr>
                  <th style={{ width: '25px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Tanggal Training</th>
                  <th style={{ textAlign: 'center' }}>Member</th>
                  <th style={{ textAlign: 'center' }}>Anggota Akses</th>
                  <th style={{ textAlign: 'center' }}>Presentase</th>
                  <th style={{ textAlign: 'center' }}>Center Login</th>
                  <th style={{ textAlign: 'center' }}>Total Center</th>
                  <th style={{ textAlign: 'center' }}>Cakupan Center (%)</th>
                  {isAdmin && <th style={{ width: '50px', textAlign: 'right' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((branch, index) => (
                  <tr key={branch.id}>
                    <td style={{ textAlign: 'center' }} data-label="No">
                      <span className="mdisgo-row-num">{index + 1}</span>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Kode">
                      <span className="mdisgo-branch-code">{branch.branch_code}</span>
                    </td>
                    <td data-label="Nama Cabang">
                      <span className="mdisgo-branch-name">{branch.branch_name}</span>
                    </td>
                    <td data-label="Tanggal Training">
                      <span className="mdisgo-date">{formatDate(branch.training_date)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Member">
                      <div className="mdisgo-members">
                        {branch.total_members ? branch.total_members.toLocaleString('id-ID') : '-'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Anggota Akses">
                      <div className="mdisgo-members">
                        {branch.status === 'Belum' ? '-' : branch.members_accessed.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Presentase">
                      {(() => {
                        if (branch.status === 'Belum' || !branch.total_members) return <div className="mdisgo-percentage">-</div>;
                        const percentage = (branch.members_accessed / branch.total_members) * 100;
                        let colorClass = 'red';
                        if (percentage >= 20) colorClass = 'green';
                        else if (percentage >= 15) colorClass = 'yellow';

                        return (
                          <div className="mdisgo-progress-wrapper">
                            <div className="mdisgo-progress-text">
                              {percentage.toFixed(1)}% {percentage >= 20 && <CheckCircle2 size={12} className="mdisgo-progress-check" />}
                            </div>
                            <div className="mdisgo-progress-bg">
                              <div className={`mdisgo-progress-fill ${colorClass}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Center Login">
                      <span className="mdisgo-center-val">
                        {branch.accessed_center !== null && branch.accessed_center !== undefined ? branch.accessed_center.toLocaleString('id-ID') : '0'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Total Center">
                      <span className="mdisgo-center-val">
                        {branch.total_center ? branch.total_center.toLocaleString('id-ID') : '-'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} data-label="Cakupan Center (%)">
                      {(() => {
                        if (!branch.total_center || branch.status === 'Belum') return <span className="mdisgo-center-val">-</span>;
                        const cakupan = (branch.accessed_center / branch.total_center) * 100;
                        let colorClass = 'red';
                        if (cakupan >= 20) colorClass = 'green';
                        else if (cakupan >= 15) colorClass = 'yellow';
                        return (
                          <div className="mdisgo-progress-wrapper">
                            <div className="mdisgo-progress-text">
                              {cakupan.toFixed(1)}% {cakupan >= 20 && <CheckCircle2 size={12} className="mdisgo-progress-check" />}
                            </div>
                            <div className="mdisgo-progress-bg">
                              <div className={`mdisgo-progress-fill ${colorClass}`} style={{ width: `${Math.min(cakupan, 100)}%` }}></div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }} data-label="Aksi">
                        <div className="mdisgo-action-buttons">
                          <button className="mdisgo-action-btn" title="Edit" onClick={() => openEditModal(branch)}>
                            <Pencil size={12} />
                          </button>
                          <button className="mdisgo-action-btn delete" title="Hapus" onClick={() => handleDelete(branch)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="mdisgo-modal-overlay" onClick={closeModal}>
          <div className="mdisgo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mdisgo-modal-header">
              <h3>{editingItem ? 'Edit Data Cabang' : 'Tambah Cabang Baru'}</h3>
              <button className="mdisgo-modal-close" onClick={closeModal}><X size={16} /></button>
            </div>

            <div className="mdisgo-modal-body">
              {/* Group 1: Informasi Cabang */}
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Informasi Cabang</h4>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Kode Cabang</label>
                    <input
                      type="text"
                      placeholder="007"
                      value={formData.branch_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, branch_code: e.target.value }))}
                    />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Nama Cabang</label>
                    <input
                      type="text"
                      placeholder="BANTUL"
                      value={formData.branch_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, branch_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Status Training</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="Belum">Belum</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Tanggal Training</label>
                    <input
                      type="date"
                      value={formData.training_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, training_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Data Member */}
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Data Member (Anggota)</h4>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Total Member</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.total_members}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_members: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Anggota Akses</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.members_accessed}
                      onChange={(e) => setFormData(prev => ({ ...prev, members_accessed: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Data Center */}
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Data Center</h4>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Center Login</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.accessed_center}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessed_center: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Total Center</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.total_center}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_center: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mdisgo-modal-footer">
              <button className="btn btn-outline" onClick={closeModal} disabled={saving} style={{ fontSize: '12px', padding: '6px 14px' }}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '12px', padding: '6px 14px' }}>
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>{editingItem ? 'Simpan' : 'Tambah'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default MdisgoMonitoring;
