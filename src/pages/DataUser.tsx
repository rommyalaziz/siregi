import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { encryptText, decryptText } from '../lib/crypto';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  Download, 
  Loader2, 
  Save, 
  X, 
  ClipboardList, 
  Check, 
  Filter 
} from 'lucide-react';
import './TableStyles.css';

const DataUser = () => {
  // Session & Access control
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const role = user?.role?.toLowerCase() || '';
  const isAdmin = role.includes('admin');
  const isSuperAdmin = role === 'administrator' || role === 'admin';

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // State Declarations
  const [accounts, setAccounts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form Fields
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Aktif');
  const [keterangan, setKeterangan] = useState('');
  const [csrfToken, setCsrfToken] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('Semua');

  // Password Visibility States
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});
  const [showInputPassword, setShowInputPassword] = useState(false);

  // Notifications
  const [alert, setAlert] = useState({ type: '', text: '' });
  const [copiedId, setCopiedId] = useState<{ type: string; id: string } | null>(null);

  // Initialize CSRF Token and Load Data
  useEffect(() => {
    // Generate secure simulated CSRF token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setCsrfToken(token);
    sessionStorage.setItem('owncloud_csrf_token', token);

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Branches
      const { data: branchData, error: branchError } = await supabase
        .from('cabang')
        .select('*')
        .order('nama_cabang');
      if (branchError) throw branchError;
      setBranches(branchData || []);

      // 2. Fetch OwnCloud Accounts
      const { data: accountData, error: accountError } = await supabase
        .from('owncloud_cabang')
        .select(`
          *,
          cabang:cabang_id (
            id,
            nama_cabang
          )
        `)
        .order('created_at', { ascending: false });
      if (accountError) throw accountError;

      // Decrypt passwords for frontend processing
      const decryptedAccounts = await Promise.all(
        (accountData || []).map(async (acc) => {
          const plain = await decryptText(acc.password);
          return { ...acc, plainPassword: plain };
        })
      );

      // Sort alphabetically by branch name (A-Z) by default
      decryptedAccounts.sort((a, b) => {
        const nameA = a.cabang?.nama_cabang?.toLowerCase() || '';
        const nameB = b.cabang?.nama_cabang?.toLowerCase() || '';
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      setAccounts(decryptedAccounts);

      // 3. Fetch logs
      fetchLogs();
    } catch (err: any) {
      console.error('Error fetching data:', err);
      showAlert('error', 'Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data: logData, error: logError } = await supabase
        .from('admin_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (logError) throw logError;
      setLogs(logData || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const showAlert = (type: string, text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert({ type: '', text: '' }), 4000);
  };

  const resetForm = () => {
    setSelectedBranchId('');
    setEmail('');
    setUsername('');
    setPassword('');
    setStatus('Aktif');
    setKeterangan('');
    setIsEditMode(false);
    setCurrentId(null);
    setShowForm(false);
  };

  // CRUD: Create and Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CSRF Protection Check
    const storedCsrf = sessionStorage.getItem('owncloud_csrf_token');
    if (csrfToken !== storedCsrf) {
      showAlert('error', 'Validasi token CSRF gagal. Akses ditolak!');
      return;
    }

    // Standard Form Validation
    if (!selectedBranchId) {
      showAlert('error', 'Cabang harus dipilih!');
      return;
    }
    if (!username.trim()) {
      showAlert('error', 'Username OwnCloud tidak boleh kosong!');
      return;
    }
    if (!password.trim()) {
      showAlert('error', 'Password OwnCloud tidak boleh kosong!');
      return;
    }

    try {
      setSubmitLoading(true);
      const branchName = branches.find(b => b.id === selectedBranchId)?.nama_cabang || 'Cabang';
      const encryptedPassword = await encryptText(password);

      const payload = {
        cabang_id: selectedBranchId,
        email: email.trim() || null,
        username: username.trim(),
        password: encryptedPassword,
        keterangan: keterangan.trim() || null,
        status,
        updated_at: new Date().toISOString()
      };

      if (isEditMode && currentId) {
        // Edit Mode: Update
        const { error } = await supabase
          .from('owncloud_cabang')
          .update(payload)
          .eq('id', currentId);
        if (error) throw error;

        // Log admin activity
        await supabase.from('admin_activity_log').insert({
          admin_username: user.username,
          action: 'EDIT',
          target_cabang: branchName,
          details: `Mengedit akun OwnCloud cabang ${branchName}. Status: ${status}.`
        });

        showAlert('success', `Akun OwnCloud cabang ${branchName} berhasil diperbarui.`);
      } else {
        // Create Mode: Insert
        const { error } = await supabase
          .from('owncloud_cabang')
          .insert({
            ...payload,
            created_at: new Date().toISOString()
          });
        if (error) throw error;

        // Log admin activity
        await supabase.from('admin_activity_log').insert({
          admin_username: user.username,
          action: 'ADD',
          target_cabang: branchName,
          details: `Menambahkan akun OwnCloud cabang ${branchName} dengan username ${username.trim()}.`
        });

        showAlert('success', `Akun OwnCloud cabang ${branchName} berhasil ditambahkan.`);
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Error saving account:', err);
      showAlert('error', 'Gagal menyimpan akun: ' + (err.message || 'Terjadi kesalahan.'));
    } finally {
      setSubmitLoading(false);
    }
  };

  // CRUD: Edit Trigger
  const handleEditClick = (acc: any) => {
    setIsEditMode(true);
    setCurrentId(acc.id);
    setSelectedBranchId(acc.cabang_id);
    setEmail(acc.email || '');
    setUsername(acc.username);
    setPassword(acc.plainPassword);
    setStatus(acc.status);
    setKeterangan(acc.keterangan || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // CRUD: Delete
  const handleDeleteClick = async (id: string, branchName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun OwnCloud untuk cabang ${branchName}?`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('owncloud_cabang')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Log admin activity
      await supabase.from('admin_activity_log').insert({
        admin_username: user.username,
        action: 'DELETE',
        target_cabang: branchName,
        details: `Menghapus akun OwnCloud cabang ${branchName}.`
      });

      showAlert('success', `Akun OwnCloud cabang ${branchName} berhasil dihapus.`);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      showAlert('error', 'Gagal menghapus akun: ' + err.message);
      setLoading(false);
    }
  };

  // Copy to Clipboard Utility
  const handleCopyToClipboard = (text: string, type: 'username' | 'password', id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId({ type, id });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle Password Visibility for rows
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter branches that don't have accounts yet (for creation)
  const availableBranches = branches.filter(b => {
    if (isEditMode && selectedBranchId === b.id) return true;
    return !accounts.some(acc => acc.cabang_id === b.id);
  });

  // Export to Excel (HTML format disguised as .xls for perfect cell parsing)
  const handleExportExcel = () => {
    if (accounts.length === 0) return;

    const headers = ['No', 'Nama Cabang', 'Email OwnCloud', 'Username OwnCloud', 'Password OwnCloud', 'Keterangan', 'Status', 'Tanggal Input'];
    
    const rows = filteredAccounts.map((acc, idx) => [
      idx + 1,
      acc.cabang?.nama_cabang || '',
      acc.email || '',
      acc.username,
      acc.plainPassword,
      acc.keterangan || '',
      acc.status,
      new Date(acc.created_at).toLocaleDateString('id-ID')
    ]);

    // Format as Tab-Separated CSV with UTF-8 BOM so Microsoft Excel loads the columns correctly in Indonesia region
    const csvContent = '\ufeff' + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Siregi_Akun_OwnCloud_Cabang_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and Search Logic for accounts
  const filteredAccounts = accounts.filter(acc => {
    const branchName = acc.cabang?.nama_cabang || '';
    const matchSearch = branchName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        acc.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (acc.email && acc.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchFilter = branchFilter === 'Semua' || acc.cabang_id === branchFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="page-container" style={{ padding: '16px 20px' }}>
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Data User</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Manajemen terpusat akun OwnCloud untuk masing-masing cabang Siregi.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {isSuperAdmin && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              <span>{showForm ? 'Batal' : 'Tambah Akun'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ALERT NOTIFICATION */}
      {alert.text && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          backgroundColor: alert.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: alert.type === 'success' ? '#065F46' : '#991B1B',
          fontSize: '13px', 
          border: `1px solid ${alert.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)'
        }}>
          {alert.type === 'success' ? <Check size={18} /> : <X size={18} />}
          {alert.text}
        </div>
      )}

      {/* FORM INPUT SECTION (Collapsible Card) */}
      {showForm && (
        <Card style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
              {isEditMode ? 'Edit Akun OwnCloud' : 'Tambah Akun OwnCloud Cabang'}
            </h2>
            <button onClick={resetForm} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Hidden CSRF Input */}
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              
              {/* Branch Dropdown */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Nama Cabang</label>
                <select
                  className="btn btn-outline w-full"
                  style={{ height: '40px', padding: '0 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left' }}
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={isEditMode}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.nama_cabang}</option>
                  ))}
                </select>
                {isEditMode && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>Cabang tidak dapat diubah saat mengedit.</span>}
              </div>

              {/* Email Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Email OwnCloud</label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  className="btn btn-outline w-full"
                  style={{ height: '40px', padding: '0 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left', fontWeight: 'normal' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Username Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Username OwnCloud</label>
                <input
                  type="text"
                  placeholder="Masukkan username"
                  className="btn btn-outline w-full"
                  style={{ height: '40px', padding: '0 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left', fontWeight: 'normal' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {/* Password Input with Visibility Toggle */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Password OwnCloud</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showInputPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    className="btn btn-outline w-full"
                    style={{ height: '40px', padding: '0 40px 0 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left', fontWeight: 'normal' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowInputPassword(!showInputPassword)}
                    style={{ position: 'absolute', right: '12px', top: '11px', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                  >
                    {showInputPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Status Select */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Status Akun</label>
                <select
                  className="btn btn-outline w-full"
                  style={{ height: '40px', padding: '0 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left' }}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>

            </div>

            {/* Optional Description */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Keterangan / Catatan (Opsional)</label>
              <textarea
                placeholder="Catatan tambahan..."
                className="btn btn-outline w-full"
                style={{ minHeight: '80px', padding: '10px 12px', fontSize: '13px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'left', fontWeight: 'normal', fontFamily: 'inherit', resize: 'vertical' }}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitLoading}
                style={{ flex: 1, minHeight: '40px', justifyContent: 'center' }}
              >
                {submitLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                <span style={{ marginLeft: '8px' }}>Simpan Akun</span>
              </button>
              
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetForm}
                disabled={submitLoading}
                style={{ minHeight: '40px' }}
              >
                Batal
              </button>
            </div>

          </form>
        </Card>
      )}

      {/* FILTER & SEARCH ACTION ROW */}
      <Card style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            
            {/* Search Input */}
            <div className="search-box" style={{ flex: 1, maxWidth: '300px', width: '100%' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari cabang atau username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Branch Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
              <select
                className="month-select"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <option value="Semua">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nama_cabang}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button 
              className="btn btn-outline" 
              onClick={handleExportExcel}
              disabled={filteredAccounts.length === 0}
              style={{ height: '34px', minHeight: '34px', fontSize: '12px' }}
            >
              <Download size={14} />
              <span>Ekspor Excel</span>
            </button>
          </div>

        </div>
      </Card>

      {/* TABLE DATA LIST SECTION */}
      <Card className="table-card" style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center-text" style={{ width: '50px' }}>No</th>
                <th>Nama Cabang</th>
                <th>Email</th>
                <th>Username</th>
                <th>Password</th>
                <th>Status</th>
                <th>Keterangan</th>
                <th>Tanggal Input</th>
                <th className="center-text" style={{ width: '120px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="center-text" style={{ padding: '60px' }}>
                    <Loader2 className="animate-spin text-primary" size={28} />
                    <span style={{ display: 'block', marginTop: '10px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sedang memuat data akun...</span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="center-text" style={{ padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    Tidak ada data akun OwnCloud yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc, index) => (
                  <tr key={acc.id}>
                    <td className="center-text mono text-muted" data-label="No">{index + 1}</td>
                    <td className="fw-600" data-label="Nama Cabang" style={{ color: 'var(--color-primary)' }}>
                      {acc.cabang?.nama_cabang || 'TIDAK DIKETAHUI'}
                    </td>
                    <td data-label="Email">
                      <span className="mono">{acc.email || '-'}</span>
                    </td>
                    <td data-label="Username">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }} className="mobile-flex-end-desktop-left">
                        <span className="mono">{acc.username}</span>
                        <button
                          className="icon-btn"
                          title="Salin Username"
                          onClick={() => handleCopyToClipboard(acc.username, 'username', acc.id)}
                          style={{ padding: '4px', background: 'transparent' }}
                        >
                          {copiedId?.type === 'username' && copiedId?.id === acc.id ? (
                            <Check size={12} style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td data-label="Password">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }} className="mobile-flex-end-desktop-left">
                        <span className="mono">
                          {visiblePasswords[acc.id] ? acc.plainPassword : '••••••••'}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            className="icon-btn"
                            title={visiblePasswords[acc.id] ? 'Sembunyikan Password' : 'Tampilkan Password'}
                            onClick={() => togglePasswordVisibility(acc.id)}
                            style={{ padding: '4px', background: 'transparent' }}
                          >
                            {visiblePasswords[acc.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          
                          <button
                            className="icon-btn"
                            title="Salin Password"
                            onClick={() => handleCopyToClipboard(acc.plainPassword, 'password', acc.id)}
                            style={{ padding: '4px', background: 'transparent' }}
                          >
                            {copiedId?.type === 'password' && copiedId?.id === acc.id ? (
                              <Check size={12} style={{ color: 'var(--color-success)' }} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td data-label="Status">
                      <Badge variant={acc.status === 'Aktif' ? 'on-track' : 'critical'}>
                        {acc.status}
                      </Badge>
                    </td>
                    <td data-label="Keterangan">
                      <span className="text-muted" style={{ fontSize: '11px', whiteSpace: 'normal', wordBreak: 'break-word', display: 'block', maxWidth: '200px' }}>
                        {acc.keterangan || '-'}
                      </span>
                    </td>
                    <td className="mono text-muted" data-label="Tanggal Input">
                      {new Date(acc.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="center-text" data-label="Aksi">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {isSuperAdmin ? (
                          <>
                            <button 
                              className="icon-btn" 
                              title="Edit Akun" 
                              onClick={() => handleEditClick(acc)}
                              style={{ color: 'var(--color-primary)', background: '#f0fdfa' }}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              className="icon-btn" 
                              title="Hapus Akun" 
                              onClick={() => handleDeleteClick(acc.id, acc.cabang?.nama_cabang || 'Cabang')}
                              style={{ color: '#dc2626', background: '#fef2f2' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ACTIVITY LOGS SECTION */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ClipboardList size={16} className="text-primary" />
          <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log Aktivitas Admin OwnCloud</h2>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          {logs.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', background: 'var(--color-bg-card)', borderRadius: '8px', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              Belum ada log aktivitas OwnCloud.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ 
                background: 'var(--color-bg-card)', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                border: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{log.details}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Oleh Admin: <span style={{ fontWeight: 600 }}>{log.admin_username}</span> • Target: <span style={{ fontWeight: 600 }}>{log.target_cabang}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`badge ${log.action === 'ADD' ? 'on-track' : log.action === 'EDIT' ? 'delayed' : 'critical'}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                    {log.action}
                  </span>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {new Date(log.created_at).toLocaleString('id-ID', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .mobile-flex-end-desktop-left {
            justify-content: flex-start !important;
          }
        }
        @media (max-width: 768px) {
          .search-box {
            max-width: 100% !important;
          }
          .data-table td::before {
            font-size: 9px !important;
            margin-right: 8px;
          }
          .data-table td {
            font-size: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DataUser;
