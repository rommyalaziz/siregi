import React from 'react';
import { X, Info, ChevronRight } from 'lucide-react';
import './KpiParameterModal.css';

interface KpiParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KpiParameterModal: React.FC<KpiParameterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
    { name: 'Release Voucher', deduction: 3 },
    { name: 'Unapprove Pengajuan', deduction: 3 },
    { name: 'Recalculate Delinquency', deduction: 3 },
    { name: 'Transfer Pencairan', deduction: 10 },
    { name: 'Salah Generate', deduction: 5 },
    { name: 'Validasi', deduction: 3, note: 'Dihitung maksimal 1 kali kesalahan meskipun jumlahnya > 1.' },
    { name: 'Tiket Perbaikan', deduction: 10 },
  ];

  return (
    <div className="kpi-modal-overlay" onClick={onClose}>
      <div className="kpi-modal-content" onClick={e => e.stopPropagation()}>
        <div className="kpi-modal-header">
          <div className="header-title">
            <Info size={20} className="text-primary" />
            <h2>Parameter Performance MSA</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="kpi-modal-body">
          <div className="info-alert">
            <p><strong>Sistem Base 100:</strong> Nilai awal setiap staf adalah <strong>100</strong> (Tanpa kesalahan). Jika terjadi kesalahan, poin akan dikurangi sesuai dengan bobot masing-masing kategori di bawah ini.</p>
          </div>

          <div className="table-responsive">
            <table className="parameter-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Kategori Kesalahan</th>
                  <th className="center-text" style={{ padding: '12px' }}>Pengurangan per Kesalahan</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Keterangan Tambahan</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="fw-600" style={{ padding: '12px' }}>{cat.name}</td>
                    <td className="center-text fw-700" style={{ color: 'var(--color-danger)', padding: '12px' }}>-{cat.deduction} Point</td>
                    <td className="text-muted" style={{ fontSize: '13px', padding: '12px' }}>{cat.note || '-'}</td>
                  </tr>
                ))}
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="fw-600" style={{ padding: '12px' }}>Minggon</td>
                  <td className="center-text fw-700 text-primary" style={{ padding: '12px' }}>+1 Point</td>
                  <td className="text-muted" style={{ fontSize: '13px', padding: '12px' }}>Ditambahkan ke total point per aktivitas Minggon.</td>
                </tr>
                <tr>
                  <td className="fw-600" style={{ padding: '12px' }}>Lain-lain</td>
                  <td className="center-text fw-700" style={{ color: '#f59e0b', padding: '12px' }}>+/- Point</td>
                  <td className="text-muted" style={{ fontSize: '13px', padding: '12px' }}>Penyesuaian manual dari Admin (contoh: +5 reward, -10 kasus khusus).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: 700 }}>Grading System</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
               <div style={{ padding: '10px', background: '#F0FDF4', borderLeft: '4px solid #22c55e', borderRadius: '4px' }}>
                 <div className="fw-700" style={{ color: '#166534', fontSize: '16px' }}>Grade A</div>
                 <div style={{ fontSize: '13px', marginTop: '4px' }}>100 - 110 (Excellent)</div>
               </div>
               <div style={{ padding: '10px', background: '#EFF6FF', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                 <div className="fw-700" style={{ color: '#1e40af', fontSize: '16px' }}>Grade B</div>
                 <div style={{ fontSize: '13px', marginTop: '4px' }}>90 - 99 (Good)</div>
               </div>
               <div style={{ padding: '10px', background: '#FEFCE8', borderLeft: '4px solid #eab308', borderRadius: '4px' }}>
                 <div className="fw-700" style={{ color: '#854d0e', fontSize: '16px' }}>Grade C</div>
                 <div style={{ fontSize: '13px', marginTop: '4px' }}>80 - 89 (Improvement)</div>
               </div>
               <div style={{ padding: '10px', background: '#FFF7ED', borderLeft: '4px solid #f97316', borderRadius: '4px' }}>
                 <div className="fw-700" style={{ color: '#9a3412', fontSize: '16px' }}>Grade D</div>
                 <div style={{ fontSize: '13px', marginTop: '4px' }}>70 - 79 (Attention)</div>
               </div>
               <div style={{ padding: '10px', background: '#FEF2F2', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
                 <div className="fw-700" style={{ color: '#991b1b', fontSize: '16px' }}>Grade E</div>
                 <div style={{ fontSize: '13px', marginTop: '4px' }}>&lt; 70 (Critical)</div>
               </div>
            </div>
          </div>
          
          <div className="footer-note" style={{ marginTop: '20px' }}>
            <ChevronRight size={14} />
            <span>Poin di atas 100 tetap valid jika mendapat poin tambahan.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiParameterModal;

