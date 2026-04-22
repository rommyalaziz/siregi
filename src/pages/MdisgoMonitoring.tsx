import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, Users, CalendarDays, Plus, Pencil, Trash2,
  X, Loader2, CheckCircle2, GraduationCap, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './MdisgoMonitoring.css';

interface MdisgoBranch {
  id: string;
  branch_name: string;
  training_date: string;
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
    branch_name: '',
    training_date: '',
    members_accessed: 0,
    status: 'Active'
  });
  const [saving, setSaving] = useState(false);

  // Check admin role
  const sessionData = localStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-dismiss message
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
  const totalMembers = data.reduce((acc, curr) => acc + (curr.members_accessed || 0), 0);
  const latestDate = data.length > 0
    ? data.reduce((latest, curr) => {
        const d = new Date(curr.training_date);
        return d > latest ? d : latest;
      }, new Date(data[0].training_date))
    : null;

  const formatDate = (dateStr: string) => {
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
    setFormData({ branch_name: '', training_date: '', members_accessed: 0, status: 'Active' });
    setShowModal(true);
  };

  const openEditModal = (item: MdisgoBranch) => {
    setEditingItem(item);
    setFormData({
      branch_name: item.branch_name,
      training_date: item.training_date,
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
    if (!formData.branch_name || !formData.training_date) {
      setMessage({ type: 'error', text: 'Nama cabang dan tanggal training wajib diisi.' });
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('mdisgo_branches')
          .update({
            branch_name: formData.branch_name,
            training_date: formData.training_date,
            members_accessed: formData.members_accessed,
            status: formData.status
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        setMessage({ type: 'success', text: `Data "${formData.branch_name}" berhasil diperbarui.` });
      } else {
        // Insert
        const { error } = await supabase
          .from('mdisgo_branches')
          .insert({
            branch_name: formData.branch_name,
            training_date: formData.training_date,
            members_accessed: formData.members_accessed,
            status: formData.status
          });

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

  // Filtered + alphabetically sorted data
  const filteredData = data
    .filter(b => b.branch_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.branch_name.localeCompare(b.branch_name, 'id'));

  return (
    <div className="mdisgo-container">
      {/* Header */}
      <div className="mdisgo-header">
        <div>
          <h1>MDISGO</h1>
          <p>Monitoring cabang yang telah mengikuti training MDISGO.</p>
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
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={15} />
              <span>Tambah</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Message */}
      {message.text && (
        <div className={`mdisgo-toast ${message.type}`}>
          <CheckCircle2 size={14} />
          {message.text}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mdisgo-stats-grid">
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon blue">
            <Building2 size={20} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Cabang Tertraining</h4>
            <div className="stat-value">{totalBranches}</div>
            <div className="stat-sub">Cabang telah ikut MDISGO</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon green">
            <Users size={20} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Total Akses Anggota</h4>
            <div className="stat-value">{totalMembers.toLocaleString('id-ID')}</div>
            <div className="stat-sub">Jumlah anggota yang diakses</div>
          </div>
        </Card>

        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon purple">
            <CalendarDays size={20} />
          </div>
          <div className="mdisgo-stat-info">
            <h4>Training Terakhir</h4>
            <div className="stat-value" style={{ fontSize: '16px' }}>{formatDateShort(latestDate)}</div>
            <div className="stat-sub">Tanggal training terbaru</div>
          </div>
        </Card>
      </div>

      {/* Main Data Table */}
      <Card className="mdisgo-table-card">
        <div className="mdisgo-table-header">
          <h3>
            <GraduationCap size={14} style={{ verticalAlign: 'middle', marginRight: '6px', opacity: 0.6 }} />
            Daftar Cabang MDISGO
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {filteredData.length} cabang
          </span>
        </div>

        <div className="mdisgo-table-wrapper">
          {loading ? (
            <div className="mdisgo-loading">
              <Loader2 className="animate-spin" size={24} />
              <span>Memuat data MDISGO...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="mdisgo-empty">
              <div className="mdisgo-empty-icon">
                <Building2 size={40} />
              </div>
              <h4>Belum ada data cabang</h4>
              <p>{searchQuery ? 'Tidak ditemukan cabang dengan kata kunci tersebut.' : 'Klik "Tambah" untuk menambahkan cabang baru.'}</p>
            </div>
          ) : (
            <table className="mdisgo-table">
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                  <th>Nama Cabang</th>
                  <th>Tanggal Training</th>
                  <th style={{ textAlign: 'center' }}>Jumlah Akses Anggota</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {isAdmin && <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((branch, index) => (
                  <tr key={branch.id}>
                    <td style={{ textAlign: 'center' }}>
                      <span className="mdisgo-row-num">{index + 1}</span>
                    </td>
                    <td>
                      <span className="mdisgo-branch-name">{branch.branch_name}</span>
                    </td>
                    <td>
                      <span className="mdisgo-date">{formatDate(branch.training_date)}</span>
                    </td>
                    <td>
                      <div className="mdisgo-members">{branch.members_accessed.toLocaleString('id-ID')}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`mdisgo-status ${branch.status.toLowerCase()}`}>
                        <span className="mdisgo-status-dot"></span>
                        {branch.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="mdisgo-action-btn"
                          title="Edit"
                          onClick={() => openEditModal(branch)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="mdisgo-action-btn delete"
                          title="Hapus"
                          onClick={() => handleDelete(branch)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="mdisgo-modal-overlay" onClick={closeModal}>
          <div className="mdisgo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mdisgo-modal-header">
              <h3>{editingItem ? 'Edit Data Cabang' : 'Tambah Cabang Baru'}</h3>
              <button className="mdisgo-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="mdisgo-modal-body">
              <div className="mdisgo-form-group">
                <label>Nama Cabang</label>
                <input
                  type="text"
                  placeholder="Contoh: KC Banjarmasin"
                  value={formData.branch_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, branch_name: e.target.value }))}
                />
              </div>

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

              <div className="mdisgo-form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="mdisgo-modal-footer">
              <button className="btn btn-outline" onClick={closeModal} disabled={saving}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                <span>{editingItem ? 'Simpan Perubahan' : 'Tambah Cabang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MdisgoMonitoring;
