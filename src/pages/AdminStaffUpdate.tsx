import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Loader2, Save, RotateCcw, ImagePlus, Clock } from 'lucide-react';

const AdminStaffUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentDate = new Date();
  const currentMonth = indonesianMonths[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear().toString();

  const [selectedPeriode, setSelectedPeriode] = useState(currentMonth);
  const [selectedTahun, setSelectedTahun] = useState(currentYear);
  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for the form data (all categories)
  const [formData, setFormData] = useState({
    release_voucher: 0,
    unapprove_pengajuan: 0,
    recalculate_delinquency: 0,
    transfer_pencairan: 0,
    salah_generate: 0,
    ppi_not_entry: 0,
    validasi: 0,
    tiket_perbaikan: 0,
    lain_lain: 0,
    lain_lain_keterangan: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [globalSettings, setGlobalSettings] = useState({ 
    month: currentMonth, 
    year: currentYear 
  });
  const [saveGlobalLoading, setSaveGlobalLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState<{ created: number; skipped: number } | null>(null);

  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: '', branch: '' });
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).replace('.', ':');
    } catch (e) {
      return dateString;
    }
  };

  const categories = [
    { id: 'release_voucher', name: 'Release Voucher' },
    { id: 'unapprove_pengajuan', name: 'Unapprove Pengajuan' },
    { id: 'recalculate_delinquency', name: 'Recalculate Delinquency' },
    { id: 'transfer_pencairan', name: 'Transfer Pencairan' },
    { id: 'salah_generate', name: 'Salah Generate' },
    { id: 'ppi_not_entry', name: 'Minggon' },
    { id: 'validasi', name: 'Validasi' },
    { id: 'tiket_perbaikan', name: 'Tiket Perbaikan' },
    { id: 'lain_lain', name: 'Lain-lain (+/- poin)' },
  ];

  // 1. Fetch staff names for the dropdown
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setFetchLoading(true);

        // Fetch Staff List
        const { data: staff, error: staffError } = await supabase
          .from('staff_progress')
          .select('id, name, branch')
          .order('name');
        
        if (staffError) throw staffError;
        
        const uniqueStaff = Array.from(new Map(staff.map(item => [item.id, item])).values());
        setStaffList(uniqueStaff);
        
        if (uniqueStaff.length > 0) {
          setSelectedStaffId(uniqueStaff[0].id);
        }

        // Fetch Global Settings
        const { data: settings } = await supabase
          .from('global_settings')
          .select('value')
          .eq('id', 'dashboard_period')
          .single();

        if (settings) {
          setGlobalSettings({
            month: settings.value.month || 'Mei',
            year: settings.value.year?.toString() || '2026'
          });
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchInitialData();
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async (staffId?: string, periode?: string, tahun?: string) => {
    try {
      // Gunakan parameter yang diberikan, atau fallback ke state saat ini
      const filterStaffId = staffId || selectedStaffId;
      const filterPeriode = periode || selectedPeriode;
      const filterTahun = tahun || selectedTahun;

      // Jika belum ada staf/periode yang dipilih, kosongkan riwayat
      if (!filterStaffId || !filterPeriode) {
        setRecentActivity([]);
        return;
      }

      let result: any[] = [];

      const { data, error } = await supabase
        .from('staff_progress')
        .select('name, branch, periode, tahun, updated_at')
        .eq('id', filterStaffId)
        .eq('periode', filterPeriode)
        .eq('tahun', parseInt(filterTahun))
        .limit(1);

      if (error && (error.message?.includes('updated_at') || error.code === '42703')) {
        // Kolom updated_at belum ada di DB — fallback tanpa kolom tersebut
        const fallback = await supabase
          .from('staff_progress')
          .select('name, branch, periode, tahun')
          .eq('id', filterStaffId)
          .eq('periode', filterPeriode)
          .eq('tahun', parseInt(filterTahun))
          .limit(1);
        result = fallback.data || [];
      } else if (error) {
        throw error;
      } else {
        result = data || [];
      }

      setRecentActivity(result);
    } catch (err) {
      console.error('Error fetching activity:', err);
    }
  };

  // 2. Fetch specific data when Staff or Periode changes
  useEffect(() => {
    if (!selectedStaffId || !selectedPeriode) return;

    const fetchCurrentValues = async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('staff_progress')
          .select('*')
          .eq('id', selectedStaffId)
          .eq('periode', selectedPeriode)
          .eq('tahun', parseInt(selectedTahun));

        const { data, error } = await q.single();

        if (error && error.code !== 'PGRST116') throw error;

        // Fetch avatar independently to ensure it persists across months
        const { data: avatarData } = await supabase
          .from('staff_progress')
          .select('avatar_url')
          .eq('id', selectedStaffId)
          .not('avatar_url', 'is', null)
          .limit(1);
          
        const persistentAvatar = avatarData && avatarData.length > 0 ? avatarData[0].avatar_url : null;

        if (data) {
          setFormData({
            release_voucher: data.release_voucher || 0,
            unapprove_pengajuan: data.unapprove_pengajuan || 0,
            recalculate_delinquency: data.recalculate_delinquency || 0,
            transfer_pencairan: data.transfer_pencairan || 0,
            salah_generate: data.salah_generate || 0,
            ppi_not_entry: data.ppi_not_entry || 0,
            validasi: data.validasi || 0,
            tiket_perbaikan: data.tiket_perbaikan || 0,
            lain_lain: data.lain_lain || 0,
            lain_lain_keterangan: data.lain_lain_keterangan || ''
          });
          setAvatarPreview(data.avatar_url || persistentAvatar);
          setLastUpdatedAt(data.updated_at || null);
        } else {
          setFormData({
            release_voucher: 0, unapprove_pengajuan: 0, recalculate_delinquency: 0,
            transfer_pencairan: 0, salah_generate: 0, ppi_not_entry: 0,
            validasi: 0, tiket_perbaikan: 0, lain_lain: 0,
            lain_lain_keterangan: ''
          });
          setAvatarPreview(persistentAvatar);
          setLastUpdatedAt(null);
        }
        setAvatarFile(null); // Reset pending file
      } catch (err) {
        console.error('Error fetching current values:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentValues();
    fetchRecentActivity(selectedStaffId, selectedPeriode, selectedTahun);
  }, [selectedStaffId, selectedPeriode, selectedTahun]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleInputChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [id]: numValue }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;

    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const staffInfo = staffList.find(s => s.id === selectedStaffId);
      let avatar_url = avatarPreview;

      console.log('Attempting update for:', selectedStaffId, selectedPeriode);

      // 1. Handle File Upload if there's a new file
      if (avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${selectedStaffId}_${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile, { upsert: true });

          if (uploadError) {
             console.error('Storage Error:', uploadError);
             if (uploadError.message === 'Bucket not found') {
               throw new Error('Penyimpanan foto gagal: Anda belum membuat bucket "avatars" di Supabase Dashboard.');
             }
             throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          
          avatar_url = publicUrl;
      }
      
      const nowIso = new Date().toISOString();
      const payload: Record<string, any> = {
        id: selectedStaffId,
        periode: selectedPeriode,
        tahun: parseInt(selectedTahun),
        name: staffInfo?.name,
        branch: staffInfo?.branch,
        avatar_url,
        ...formData
      };
      // Tambahkan updated_at hanya jika kolom sudah ada di DB (tidak akan error kalau belum ada trigger)
      // Kolom ini akan di-set otomatis oleh trigger setelah SQL add_updated_at.sql dijalankan.
      // Kita tetap kirim supaya langsung terupdate tanpa menunggu trigger.
      try { payload.updated_at = nowIso; } catch(_) {}

      console.log('Sending payload:', payload);

      // Update or Insert process using UPSERT
      const { error: upsertError } = await supabase
        .from('staff_progress')
        .upsert(payload, { 
          onConflict: 'id,periode,tahun'
        });

      if (upsertError) throw upsertError;

      // Post-save: If an avatar was uploaded, sync it to ALL months for this staff
      if (avatar_url) {
        await supabase
          .from('staff_progress')
          .update({ avatar_url })
          .eq('id', selectedStaffId);
        console.log('Avatar synced globally for staff:', selectedStaffId);
      }

      setLastUpdatedAt(nowIso);
      setMessage({ type: 'success', text: `Data ${staffInfo?.name} berhasil diperbarui.` });
      setAvatarFile(null);
      fetchRecentActivity(selectedStaffId, selectedPeriode, selectedTahun);
    } catch (err: any) {
      console.error('Final Caught Error:', err);
      const errorMsg = err.message || 'Gagal memperbarui data';
      if (errorMsg.includes('updated_at') || errorMsg.includes('schema cache')) {
        setMessage({
          type: 'error',
          text: '⚠️ Kolom updated_at belum ada di database. Jalankan SQL di sql/add_updated_at.sql di Supabase Dashboard terlebih dahulu!'
        });
      } else if (errorMsg.includes('row-level security')) {
        setMessage({ 
          type: 'error', 
          text: 'Database masih menolak akses (RLS). Pastikan Anda sudah menjalankan SQL Super Reset di Supabase Dashboard.' 
        });
      } else {
        setMessage({ type: 'error', text: errorMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Hapus SEMUA data kesalahan di periode ${selectedPeriode} ${selectedTahun}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_progress')
        .delete()
        .eq('periode', selectedPeriode)
        .eq('tahun', parseInt(selectedTahun));

      if (error) throw error;
      setMessage({ type: 'success', text: `Seluruh data periode ${selectedPeriode} ${selectedTahun} telah dihapus.` });
      setFormData({
        release_voucher: 0, unapprove_pengajuan: 0, recalculate_delinquency: 0,
        transfer_pencairan: 0, salah_generate: 0, ppi_not_entry: 0,
        validasi: 0, tiket_perbaikan: 0, lain_lain: 0,
        lain_lain_keterangan: ''
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal meriset data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInitMonth = async () => {
    const confirmMsg = `Inisialisasi semua staff untuk periode ${selectedPeriode} ${selectedTahun}?\n\nStaff yang belum ada record di bulan ini akan dibuat otomatis dengan nilai 0.\nStaff yang sudah ada tidak akan diubah.`;
    if (!window.confirm(confirmMsg)) return;

    setInitLoading(true);
    setInitResult(null);
    setMessage({ type: '', text: '' });

    try {
      const tahunInt = parseInt(selectedTahun);

      // 1. Ambil semua staff unik dari staff_progress
      const { data: allStaffRaw, error: staffErr } = await supabase
        .from('staff_progress')
        .select('id, name, branch, avatar_url');

      if (staffErr) throw staffErr;

      // Deduplicate by staff id
      const uniqueMap = new Map<string, any>();
      allStaffRaw?.forEach(s => {
        if (!uniqueMap.has(s.id)) uniqueMap.set(s.id, s);
      });
      const allStaff = Array.from(uniqueMap.values());

      // 2. Ambil staff yang sudah ada record di bulan ini
      const { data: existingRaw, error: existErr } = await supabase
        .from('staff_progress')
        .select('id')
        .eq('periode', selectedPeriode)
        .eq('tahun', tahunInt);

      if (existErr) throw existErr;

      const existingIds = new Set(existingRaw?.map(r => r.id) || []);

      // 3. Filter staff yang belum ada
      const toCreate = allStaff.filter(s => !existingIds.has(s.id));

      if (toCreate.length === 0) {
        setInitResult({ created: 0, skipped: allStaff.length });
        setMessage({
          type: 'success',
          text: `Semua ${allStaff.length} staff sudah memiliki data untuk ${selectedPeriode} ${selectedTahun}.`
        });
        return;
      }

      // 4. Batch insert dengan nilai default 0
      const nowIso = new Date().toISOString();
      const payload = toCreate.map(s => ({
        id: s.id,
        name: s.name,
        branch: s.branch,
        avatar_url: s.avatar_url || null,
        periode: selectedPeriode,
        tahun: tahunInt,
        release_voucher: 0,
        unapprove_pengajuan: 0,
        recalculate_delinquency: 0,
        transfer_pencairan: 0,
        salah_generate: 0,
        ppi_not_entry: 0,
        validasi: 0,
        tiket_perbaikan: 0,
        lain_lain: 0,
        lain_lain_keterangan: '',
        updated_at: nowIso
      }));

      const { error: insertErr } = await supabase
        .from('staff_progress')
        .insert(payload);

      if (insertErr) throw insertErr;

      const result = { created: toCreate.length, skipped: existingIds.size };
      setInitResult(result);
      setMessage({
        type: 'success',
        text: `✅ ${result.created} staff berhasil diinisialisasi untuk ${selectedPeriode} ${selectedTahun}. ${result.skipped > 0 ? `${result.skipped} staff sudah ada (tidak diubah).` : ''}`
      });

      // Refresh staff list & activity
      fetchRecentActivity(toCreate.length > 0 ? toCreate[0].id : selectedStaffId, selectedPeriode, selectedTahun);

      // Auto-pilih staff pertama yang baru dibuat
      if (toCreate.length > 0) {
        setSelectedStaffId(toCreate[0].id);
      }

    } catch (err: any) {
      console.error('Init month error:', err);
      setMessage({ type: 'error', text: 'Gagal inisialisasi: ' + (err.message || 'Unknown error') });
    } finally {
      setInitLoading(false);
    }
  };

  const handleUpdateGlobalSettings = async () => {
    setSaveGlobalLoading(true);
    try {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          id: 'dashboard_period',
          value: { month: globalSettings.month, year: parseInt(globalSettings.year) },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Periode global dashboard berhasil diperbarui.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal memperbarui periode global' });
    } finally {
      setSaveGlobalLoading(false);
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileData.name || !editProfileData.branch) return;
    
    setEditProfileLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('staff_progress')
        .update({ name: editProfileData.name, branch: editProfileData.branch, updated_at: nowIso })
        .eq('id', selectedStaffId);

      if (error) throw error;
      
      // Update local state
      setStaffList(prev => prev.map(s => 
        s.id === selectedStaffId 
          ? { ...s, name: editProfileData.name, branch: editProfileData.branch } 
          : s
      ));
      
      setMessage({ type: 'success', text: `Profil staf berhasil diperbarui menjadi ${editProfileData.name} (${editProfileData.branch}).` });
      setEditProfileModalOpen(false);
      fetchRecentActivity(selectedStaffId, selectedPeriode, selectedTahun);
    } catch (err: any) {
      alert('Gagal memperbarui profil: ' + (err.message || 'Unknown error'));
    } finally {
      setEditProfileLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: '16px 20px' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '18px', marginBottom: '4px' }}>Update Kesalahan Staf</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Panel entri cepat untuk manajemen performa dan poin absolut staf.</p>
          </div>
          
          {/* Global Settings Control */}
          <div className="global-settings-panel" style={{ 
            background: 'var(--color-bg-card)', 
            padding: '10px 16px', 
            borderRadius: '12px', 
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>Periode Dashboard Global:</span>
            <select 
              value={globalSettings.month}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, month: e.target.value }))}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            >
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select 
              value={globalSettings.year}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, year: e.target.value }))}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
            <button 
              onClick={handleUpdateGlobalSettings}
              disabled={saveGlobalLoading}
              style={{ 
                background: 'var(--color-primary)', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: '6px', 
                fontSize: '11px', 
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saveGlobalLoading ? 0.7 : 1
              }}
            >
              {saveGlobalLoading ? '...' : 'Set Default'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-update-content" style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
        <Card style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          
          {/* HEADER SECTON: Avatar + Selectors in one row */}
          <div className="admin-update-header" style={{ 
            padding: '16px', 
            background: 'var(--color-bg-alt)', 
            borderBottom: '1px solid var(--color-border)', 
            display: 'flex', 
            gap: '20px', 
            alignItems: 'center', 
            flexWrap: 'wrap' 
          }}>
            
            {/* Avatar Badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', background: '#e2e8f0' }}>
                <img 
                  src={avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(staffList.find(s => s.id === selectedStaffId)?.name || 'Staf')}&background=random&color=fff&bold=true`} 
                  alt="Staf" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--color-primary)', color: 'white', border: '2px solid white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                title="Ubah Foto"
              >
                <ImagePlus size={12} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
            </div>

            <div style={{ marginRight: 'auto' }}>
              <button 
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  const staff = staffList.find(s => s.id === selectedStaffId);
                  if (staff) {
                    setEditProfileData({ name: staff.name, branch: staff.branch });
                    setEditProfileModalOpen(true);
                  }
                }}
              >
                ✏️ Edit Profil
              </button>
            </div>

            {/* Selectors */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pilih Staf</label>
                <select 
                  className="btn btn-outline w-full" 
                  style={{ height: '36px', padding: '0 10px', fontSize: '13px', background: 'var(--color-bg-card)' }}
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tahun</label>
                <select 
                  className="btn btn-outline w-full" 
                  style={{ height: '36px', padding: '0 10px', fontSize: '13px', background: 'var(--color-bg-card)' }}
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(e.target.value)}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulan</label>
                <select 
                  className="btn btn-outline w-full" 
                  style={{ height: '36px', padding: '0 10px', fontSize: '13px', background: 'var(--color-bg-card)' }}
                  value={selectedPeriode}
                  onChange={(e) => setSelectedPeriode(e.target.value)}
                >
                  {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Tombol Inisialisasi Bulan — di header agar selalu terlihat */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#7c3aed', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inisialisasi Bulan</label>
                <button
                  type="button"
                  onClick={handleInitMonth}
                  disabled={initLoading || loading}
                  title={`Buat record default (nilai 0) untuk semua staff di ${selectedPeriode} ${selectedTahun}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '36px',
                    width: '100%',
                    padding: '0 12px',
                    background: initLoading ? '#e2e8f0' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: initLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(79,70,229,0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  {initLoading
                    ? <><Loader2 className="animate-spin" size={14} /><span>Proses...</span></>
                    : <><span>🚀</span><span>Inisialisasi {selectedPeriode}</span></>}
                </button>
              </div>
            </div>
          </div>

          {/* Banner hasil inisialisasi */}
          {initResult && (
            <div style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
              borderBottom: '1px solid #bbf7d0',
              fontSize: '13px',
              color: '#166534',
              display: 'flex',
              gap: '20px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <span>✅ <strong>{initResult.created}</strong> staff baru dibuat</span>
              {initResult.skipped > 0 && <span>⏭️ <strong>{initResult.skipped}</strong> sudah ada (tidak diubah)</span>}
              <span style={{ color: '#047857', fontWeight: 600 }}>Total <strong>{initResult.created + initResult.skipped}</strong> staff terdaftar untuk {selectedPeriode} {selectedTahun}</span>
              <button onClick={() => setInitResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          )}

          <form onSubmit={handleUpdate} style={{ padding: '20px' }}>
            
            {/* LAST UPDATED TIMESTAMP BADGE */}
            {lastUpdatedAt && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '12px', 
                color: '#334155', 
                marginBottom: '16px', 
                padding: '8px 12px', 
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1',
                fontWeight: 500
              }}>
                <Clock size={15} style={{ color: '#4f46e5' }} />
                <span>Terakhir Diperbarui: <strong style={{ color: '#0f172a' }}>{formatDateTime(lastUpdatedAt)}</strong></span>
              </div>
            )}

            {/* SUCCESS/ERROR MESSAGE */}
            {message.text && (
              <div style={{ 
                padding: '10px 14px', borderRadius: '6px', marginBottom: '16px',
                backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: message.type === 'success' ? '#065F46' : '#991B1B',
                fontSize: '13px', border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500
              }}>
                <Save size={16} />
                {message.text}
              </div>
            )}

            {/* COMPACT 3-COLUMN GRID */}
            <div className="admin-update-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '12px', 
              marginBottom: '24px' 
            }}>
              {categories.map(c => {
                const isLainLain = c.id === 'lain_lain';
                return (
                  <div 
                    key={c.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: isLainLain ? 'column' : 'row',
                      alignItems: isLainLain ? 'stretch' : 'center', 
                      justifyContent: 'space-between', 
                      background: 'var(--color-bg-alt)', 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--color-border)',
                      transition: 'border-color 0.2s',
                      gap: isLainLain ? '8px' : '0'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.025em', maxWidth: '140px', lineHeight: '1.3' }}>
                        {c.name}
                      </label>
                      <input 
                        type="number" 
                        className="btn btn-outline" 
                        style={{ 
                          width: '64px', 
                          height: '32px', 
                          textAlign: 'center', 
                          fontSize: '15px', 
                          fontWeight: '700', 
                          padding: '0',
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text)'
                        }}
                        value={(formData as any)[c.id]}
                        onChange={(e) => handleInputChange(c.id, e.target.value)}
                        min={isLainLain ? undefined : "0"}
                      />
                    </div>
                    {isLainLain && (
                      <div style={{ width: '100%', marginTop: '2px' }}>
                        <input
                          type="text"
                          placeholder="Alasan penambahan/pengurangan poin..."
                          className="btn btn-outline"
                          style={{
                            width: '100%',
                            height: '32px',
                            fontSize: '12px',
                            padding: '0 8px',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text)',
                            textAlign: 'left',
                            fontWeight: 'normal',
                            borderStyle: 'dashed'
                          }}
                          value={formData.lain_lain_keterangan}
                          onChange={(e) => setFormData(prev => ({ ...prev, lain_lain_keterangan: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ACTIONS ROW */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading} 
                style={{ flex: 1, minWidth: '160px', justifyContent: 'center', height: '42px', fontSize: '14px', fontWeight: 600, letterSpacing: '0.025em' }}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                <span style={{ marginLeft: '8px' }}>Simpan Perubahan</span>
              </button>

              {/* Tombol Reset */}
              <button 
                type="button"
                onClick={handleReset} 
                className="btn btn-outline" 
                style={{ width: '42px', padding: 0, color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', justifyContent: 'center', height: '42px' }}
                disabled={loading || initLoading}
                title="Reset Semua Data Periode Ini"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </form>
        </Card>

        {/* RECENT ACTIVITY SECTION */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Clock size={16} className="text-primary" />
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Riwayat Update Terakhir</h2>
          </div>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--color-bg-card)', borderRadius: '12px', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                {!selectedStaffId || !selectedPeriode
                  ? 'Pilih staf dan periode untuk melihat riwayat.'
                  : 'Data staf ini belum tersimpan untuk periode yang dipilih.'}
              </div>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={idx} style={{ 
                  background: 'var(--color-bg-card)', 
                  padding: '12px 16px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{activity.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {activity.branch} • {activity.periode} {activity.tahun}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-primary)' }}>Berhasil Diperbarui</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {formatDateTime(activity.updated_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-bg-card)', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Edit Profil Staf</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Perubahan ini akan mengubah nama dan cabang staf untuk <strong>semua histori bulan sebelumnya</strong>. Kode ID akan tetap sama.
            </p>
            <form onSubmit={handleEditProfileSubmit}>
              <div className="form-group">
                <label>Nama Staf</label>
                <input 
                  type="text" 
                  className="btn btn-outline"
                  style={{ width: '100%', height: '40px', background: 'var(--color-bg-card)', textAlign: 'left', padding: '0 12px', fontWeight: 'normal' }}
                  value={editProfileData.name} 
                  onChange={(e) => setEditProfileData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Cabang</label>
                <input 
                  type="text" 
                  className="btn btn-outline"
                  style={{ width: '100%', height: '40px', background: 'var(--color-bg-card)', textAlign: 'left', padding: '0 12px', fontWeight: 'normal' }}
                  value={editProfileData.branch} 
                  onChange={(e) => setEditProfileData(prev => ({ ...prev, branch: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setEditProfileModalOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={editProfileLoading}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {editProfileLoading ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .admin-update-content {
            padding: 0 !important;
          }
          .admin-update-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .admin-update-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .admin-update-form-group {
            width: 100% !important;
          }
          .page-header > div {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .global-settings-panel {
            width: 100% !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .global-settings-panel button {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminStaffUpdate;
