import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Loader2, Save, RotateCcw, AlertTriangle, ImagePlus } from 'lucide-react';

const AdminStaffUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('April');
  
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
    tiket_perbaikan: 0
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  const categories = [
    { id: 'release_voucher', name: 'Release Voucher' },
    { id: 'unapprove_pengajuan', name: 'Unapprove Pengajuan' },
    { id: 'recalculate_delinquency', name: 'Recalculate Delinquency' },
    { id: 'transfer_pencairan', name: 'Transfer Pencairan' },
    { id: 'salah_generate', name: 'Salah Generate' },
    { id: 'ppi_not_entry', name: 'PPI Not Entry' },
    { id: 'validasi', name: 'Validasi' },
    { id: 'tiket_perbaikan', name: 'Tiket Perbaikan' },
  ];

  // 1. Fetch staff names for the dropdown
  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        setFetchLoading(true);
        const { data, error } = await supabase
          .from('staff_progress')
          .select('id, name, branch')
          .order('name');
        
        if (error) throw error;
        
        const uniqueStaff = Array.from(new Map(data.map(item => [item.id, item])).values());
        setStaffList(uniqueStaff);
        
        if (uniqueStaff.length > 0) {
          setSelectedStaffId(uniqueStaff[0].id);
        }
      } catch (err) {
        console.error('Error fetching staff list:', err);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchStaffList();
  }, []);

  // 2. Fetch specific data when Staff or Periode changes
  useEffect(() => {
    if (!selectedStaffId || !selectedPeriode) return;

    const fetchCurrentValues = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('staff_progress')
          .select('*')
          .eq('id', selectedStaffId)
          .eq('periode', selectedPeriode)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setFormData({
            release_voucher: data.release_voucher || 0,
            unapprove_pengajuan: data.unapprove_pengajuan || 0,
            recalculate_delinquency: data.recalculate_delinquency || 0,
            transfer_pencairan: data.transfer_pencairan || 0,
            salah_generate: data.salah_generate || 0,
            ppi_not_entry: data.ppi_not_entry || 0,
            validasi: data.validasi || 0,
            tiket_perbaikan: data.tiket_perbaikan || 0
          });
          setAvatarPreview(data.avatar_url || null);
        } else {
          setFormData({
            release_voucher: 0, unapprove_pengajuan: 0, recalculate_delinquency: 0,
            transfer_pencairan: 0, salah_generate: 0, ppi_not_entry: 0,
            validasi: 0, tiket_perbaikan: 0
          });
          setAvatarPreview(null);
        }
        setAvatarFile(null); // Reset pending file
      } catch (err) {
        console.error('Error fetching current values:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentValues();
  }, [selectedStaffId, selectedPeriode]);

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

      // 1. Handle File Upload if there's a new file
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${selectedStaffId}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        avatar_url = publicUrl;
      }
      
      const payload = {
        id: selectedStaffId,
        periode: selectedPeriode,
        name: staffInfo?.name,
        branch: staffInfo?.branch,
        avatar_url,
        ...formData
      };

      const { error } = await supabase
        .from('staff_progress')
        .upsert(payload, { onConflict: 'id, periode' });

      if (error) throw error;

      setMessage({ type: 'success', text: `Data ${staffInfo?.name} berhasil diperbarui.` });
      setAvatarFile(null);
    } catch (err: any) {
      console.error('Update Error:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal memperbarui data' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Hapus SEMUA data kesalahan di periode ${selectedPeriode}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_progress')
        .delete()
        .eq('periode', selectedPeriode);

      if (error) throw error;
      setMessage({ type: 'success', text: `Seluruh data periode ${selectedPeriode} telah dihapus.` });
      setFormData({
        release_voucher: 0, unapprove_pengajuan: 0, recalculate_delinquency: 0,
        transfer_pencairan: 0, salah_generate: 0, ppi_not_entry: 0,
        validasi: 0, tiket_perbaikan: 0
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal meriset data' });
    } finally {
      setLoading(false);
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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Manajemen Staf & Kesalahan</h1>
          <p>Kelola profil, foto, dan total kesalahan staf secara absolut.</p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>Pilih Periode</label>
              <select 
                className="btn btn-outline w-full" 
                style={{ textAlign: 'left', appearance: 'auto', padding: '10px' }}
                value={selectedPeriode}
                onChange={(e) => setSelectedPeriode(e.target.value)}
              >
                <option value="April">April</option>
                <option value="Maret">Maret</option>
                <option value="Februari">Februari</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>Pilih Staf</label>
              <select 
                className="btn btn-outline w-full" 
                style={{ textAlign: 'left', appearance: 'auto', padding: '10px' }}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleUpdate}>
            {/* AVATAR SECTION */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
               <div style={{ position: 'relative' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', border: '3px solid white', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <img 
                      src={avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(staffList.find(s => s.id === selectedStaffId)?.name || 'Staf')}&background=random&color=fff&bold=true`} 
                      alt="Preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                  >
                    <ImagePlus size={14} style={{ margin: '0 auto' }} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />
               </div>
               <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Foto Profil Staf</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>Mendukung format JPG, PNG. Maksimal 2MB.</p>
                  {avatarFile && <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: '4px' }}>File siap diunggah: {avatarFile.name}</span>}
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {categories.map(c => (
                <div key={c.id} className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: '500' }}>
                    {c.name.toUpperCase()}
                  </label>
                  <input 
                    type="number" 
                    className="btn btn-outline w-full" 
                    style={{ textAlign: 'left', padding: '10px', fontSize: '14px', fontWeight: '600' }}
                    value={(formData as any)[c.id]}
                    onChange={(e) => handleInputChange(c.id, e.target.value)}
                    min="0"
                  />
                </div>
              ))}
            </div>

            {message.text && (
              <div style={{ 
                padding: '12px', borderRadius: '8px', marginBottom: '20px',
                backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: message.type === 'success' ? '#065F46' : '#991B1B',
                fontSize: '14px', border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <Save size={16} />
                {message.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', height: '44px', fontSize: '15px' }}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span style={{ marginLeft: '10px' }}>Simpan Update Profil & Poin</span>
            </button>
          </form>
        </Card>

        <Card style={{ padding: '24px', marginTop: '24px', borderColor: '#FEF2F2' }}>
          <h3 style={{ color: '#CD1818', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <AlertTriangle size={18} /> Area Berbahaya
          </h3>
          <button 
            onClick={handleReset} 
            className="btn btn-outline" 
            style={{ color: '#CD1818', borderColor: '#FECACA', width: '100%', justifyContent: 'center', fontSize: '13px' }}
            disabled={loading}
          >
            <RotateCcw size={16} style={{ marginRight: '8px' }} />
            Hapus Data Periode {selectedPeriode}
          </button>
        </Card>
      </div>
    </div>
  );
};

export default AdminStaffUpdate;
