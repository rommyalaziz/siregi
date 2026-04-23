import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, Users, Plus, Pencil, Trash2,
  X, Loader2, CheckCircle2, GraduationCap, Save, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './MdisgoMonitoring.css';

interface MdisgoBranch {
  id: string;
  branch_code: string;
  branch_name: string;
  training_date: string | null;
  members_accessed: number;
  status: string;
}

const MdisgoMonitoring = () => {
  const [data, setData] = useState<MdisgoBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MdisgoBranch | null>(null);
  const [formData, setFormData] = useState({
    branch_code: '',
    branch_name: '',
    training_date: '',
    members_accessed: 0,
    status: 'Belum'
  });
  const [saving, setSaving] = useState(false);

  // Check admin role
  const sessionData = localStorage.getItem('msa_session');
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
        .order('branch_name', { ascending: true });

      if (error) throw error;
      setData(branches || []);
    } catch (err) {
      console.error('Error fetching MDISGO data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Summary calculations
  const totalBranches = data.length;
  const trainedBranches = data.filter(b => b.status !== 'Belum').length;
  const belumBranches = data.filter(b => b.status === 'Belum').length;
  const totalMembers = data.reduce((acc, curr) => acc + (curr.members_accessed || 0), 0);
  const trainedData = data.filter(b => b.training_date);
  const latestDate = trainedData.length > 0
    ? trainedData.reduce((latest, curr) => {
        const d = new Date(curr.training_date!);
        return d > latest ? d : latest;
      }, new Date(trainedData[0].training_date!))
    : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Modal handlers
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ branch_code: '', branch_name: '', training_date: '', members_accessed: 0, status: 'Belum' });
    setShowModal(true);
  };

  const openEditModal = (item: MdisgoBranch) => {
    setEditingItem(item);
    setFormData({
      branch_code: item.branch_code,
      branch_name: item.branch_name,
      training_date: item.training_date || '',
      members_accessed: item.members_accessed,
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

  // Filtered + alphabetically sorted
  const filteredData = data
    .filter(b =>
      b.branch_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branch_code.includes(searchQuery)
    )
    .sort((a, b) => a.branch_name.localeCompare(b.branch_name, 'id'));

  return (
    <div className="mdisgo-container">
      {/* Header */}
      <div className="mdisgo-header">
        <div className="mdisgo-header-titles">
          <h1>MDISGO</h1>
          <span className="mdisgo-subtitle">Monitoring cabang yang telah mengikuti training MDISGO.</span>
        </div>
        <div className="mdisgo-header-actions">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button className="btn btn-primary mdisgo-btn-compact" onClick={openAddModal}>
              <Plus size={14} />
              <span>Tambah</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`mdisgo-toast ${message.type}`}>
          <CheckCircle2 size={13} />
          {message.text}
        </div>
      )}

      {/* Summary Stats — 4 cards */}
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
          <div className="mdisgo-stat-icon orange">
            <AlertTriangle size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Belum Implementasi</h4>
            <div className="stat-value">{belumBranches}</div>
            <div className="stat-sub">Belum training</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon purple">
            <Users size={18} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Total Akses Anggota</h4>
            <div className="stat-value">{totalMembers.toLocaleString('id-ID')}</div>
            <div className="stat-sub">{latestDate ? `s.d. ${formatDateShort(latestDate)}` : '-'}</div>
          </div>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="mdisgo-table-card">
        <div className="mdisgo-table-header">
          <h3>
            <GraduationCap size={13} style={{ verticalAlign: 'middle', marginRight: '5px', opacity: 0.5 }} />
            Daftar Cabang MDISGO
          </h3>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            {filteredData.length} cabang
          </span>
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
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Tanggal Training</th>
                  <th style={{ textAlign: 'center' }}>Akses Anggota</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {isAdmin && <th style={{ width: '70px', textAlign: 'center' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((branch, index) => (
                  <tr key={branch.id}>
                    <td style={{ textAlign: 'center' }}>
                      <span className="mdisgo-row-num">{index + 1}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="mdisgo-branch-code">{branch.branch_code}</span>
                    </td>
                    <td>
                      <span className="mdisgo-branch-name">{branch.branch_name}</span>
                    </td>
                    <td>
                      <span className="mdisgo-date">{formatDate(branch.training_date)}</span>
                    </td>
                    <td>
                      <div className="mdisgo-members">
                        {branch.status === 'Belum' ? '-' : branch.members_accessed.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`mdisgo-status ${branch.status.toLowerCase()}`}>
                        <span className="mdisgo-status-dot"></span>
                        {branch.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
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
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Belum">Belum</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
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

              <div className="mdisgo-form-row">
                <div className="mdisgo-form-group">
                  <label>Tanggal Training</label>
                  <input
                    type="date"
                    value={formData.training_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, training_date: e.target.value }))}
                  />
                </div>
                <div className="mdisgo-form-group">
                  <label>Jumlah Akses Anggota</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.members_accessed}
                    onChange={(e) => setFormData(prev => ({ ...prev, members_accessed: parseInt(e.target.value) || 0 }))}
                  />
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
