import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Loader2, Save, RotateCcw, AlertTriangle } from 'lucide-react';

const AdminStaffUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('April');
  
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
        // We get all staff from the table to populate the dropdown
        // Using distinct IDs/Names
        const { data, error } = await supabase
          .from('staff_progress')
          .select('id, name, branch')
          .order('name');
        
        if (error) throw error;
        
        // Filter unique staff by ID
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

        if (error && error.code !== 'PGRST116') { // PGRST116 is code for "no rows returned"
           throw error;
        }

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
        } else {
          // Reset to 0 if no record exists for this period yet
          setFormData({
            release_voucher: 0, unapprove_pengajuan: 0, recalculate_delinquency: 0,
            transfer_pencairan: 0, salah_generate: 0, ppi_not_entry: 0,
            validasi: 0, tiket_perbaikan: 0
          });
        }
      } catch (err) {
        console.error('Error fetching current values:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentValues();
  }, [selectedStaffId, selectedPeriode]);

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
      
      const payload = {
        id: selectedStaffId,
        periode: selectedPeriode,
        name: staffInfo?.name,
        branch: staffInfo?.branch,
        ...formData
      };

      // UPSERT logic ensures data is overwritten for the (id, periode) composite key
      const { error } = await supabase
        .from('staff_progress')
        .upsert(payload, { onConflict: 'id, periode' });

      if (error) throw error;

      setMessage({ type: 'success', text: `Data ${staffInfo?.name} periode ${selectedPeriode} berhasil diperbarui.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal memperbarui data' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Hapus SEMUA data kesalahan di periode ${selectedPeriode}? Tindakan ini tidak dapat dibatalkan.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_progress')
        .delete()
        .eq('periode', selectedPeriode);

      if (error) throw error;
      setMessage({ type: 'success', text: `Seluruh data periode ${selectedPeriode} telah dihapus.` });
      // Reset local form if current period was deleted
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
          <h1>Manajemen Kesalahan Staf</h1>
          <p>Edit atau atur total kesalahan staf secara absolut untuk periode terpilih.</p>
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
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: message.type === 'success' ? '#065F46' : '#991B1B',
                fontSize: '14px',
                border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Save size={16} />
                {message.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', height: '44px', fontSize: '15px' }}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span style={{ marginLeft: '10px' }}>Simpan Perubahan Absolut</span>
            </button>
          </form>
        </Card>

        <Card style={{ padding: '24px', marginTop: '24px', borderColor: '#FEF2F2' }}>
          <h3 style={{ color: '#CD1818', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <AlertTriangle size={18} /> Area Berbahaya
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Menghapus seluruh data kesalahan untuk periode <strong>{selectedPeriode}</strong> saja. Pastikan Anda mencadangkan data sebelum melakukan tindakan ini.
          </p>
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
