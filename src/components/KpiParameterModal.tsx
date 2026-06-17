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
    { name: 'Release Voucher', max: 10, points: [10, 8, 7, 6, 5, 4, 3, 2, 1, 0] },
    { name: 'Unapprove Pengajuan', max: 10, points: [10, 7, 5, 3, 2, 1, 0, 0, 0, 0] },
    { name: 'Recalculate Delinquency', max: 10, points: [10, 8, 7, 6, 4, 3, 1, 0, 0, 0] },
    { name: 'Transfer Pencairan', max: 15, points: [15, 10, 5, 1, 0, 0, 0, 0, 0, 0] },
    { name: 'Salah Generate', max: 10, points: [10, 6, 2, 1, 0, 0, 0, 0, 0, 0] },
    { name: 'PPI Not Entry', max: 10, points: [10, 8, 7, 7, 5, 5, 3, 2, 1, 0] },
    { name: 'Validasi', max: 10, points: [10, 8, 7, 6, 5, 4, 3, 2, 1, 0] },
    { name: 'Tiket Perbaikan', max: 15, points: [15, 5, 2, 1, 0, 0, 0, 0, 0, 0] },
    { name: 'Lain-lain', max: 10, points: [10, 7, 4, 2, 1, 0, 0, 0, 0, 0] },
  ];

  const headers = ['0', '1', '2-3', '4-5', '6-7', '8-10', '11-13', '14-16', '17-20', '>20'];

  const getHeaderColor = (index: number) => {
    const colors = [
      '#22c55e', // 0
      '#4ade80', // 1
      '#a3e635', // 2-3
      '#facc15', // 4-5
      '#fbbf24', // 6-7
      '#fb923c', // 8-10
      '#f87171', // 11-13
      'var(--color-danger)', // 14-16
      '#dc2626', // 17-20
      '#991b1b'  // >20
    ];
    return colors[index];
  };

  const getCellColor = (point: number, max: number, hIdx: number) => {
    if (point === 0 && hIdx > 0) return '#FEF2F2';
    if (point === max) return '#F0FDF4';
    
    // Use a lighter version of the header color if the point is > 0
    const hColor = getHeaderColor(hIdx);
    return hColor + '15'; // 15% opacity of the header color
  };

  const getTextColor = (point: number, max: number, hIdx: number) => {
    if (point === 0 && hIdx > 0) return '#991B1B';
    if (point === max) return '#166534';
    return '#334155';
  };

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
            <p>Poin akhir dihitung berdasarkan akumulasi poin dari setiap kategori kesalahan. Total poin maksimal adalah <strong>100</strong>.</p>
          </div>

          <div className="table-responsive">
            <table className="parameter-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky-col">Deskripsi</th>
                  <th rowSpan={2}>Poin Max</th>
                  <th colSpan={10} className="center-text bg-alt">Jumlah Kesalahan / Poin yang Didapat</th>
                </tr>
                <tr>
                  {headers.map((h, i) => (
                    <th 
                      key={h} 
                      className="sub-header"
                      style={{ 
                        backgroundColor: getHeaderColor(i),
                        color: 'white',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => {
                  if (cat.name === 'Lain-lain') {
                    return (
                      <tr key={idx}>
                        <td className="sticky-col fw-600">{cat.name}</td>
                        <td className="center-text fw-700 text-primary">{cat.max}</td>
                        <td colSpan={10} className="center-text text-muted" style={{ fontSize: '11px', fontStyle: 'italic', padding: '8px', color: 'var(--color-text-muted)' }}>
                          Penyesuaian Poin Langsung (contoh: +5 untuk menambah poin, -5 untuk mengurangi poin)
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx}>
                      <td className="sticky-col fw-600">{cat.name}</td>
                      <td className="center-text fw-700 text-primary">{cat.max}</td>
                      {cat.points.map((p, pIdx) => (
                        <td 
                          key={pIdx} 
                          className="center-text point-cell"
                          style={{ 
                            backgroundColor: getCellColor(p, cat.max, pIdx),
                            color: getTextColor(p, cat.max, pIdx),
                            borderBottom: `1px solid ${getHeaderColor(pIdx)}30`,
                            fontWeight: p === cat.max ? 800 : 500
                          }}
                        >
                          {p}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td className="sticky-col">TOTAL POIN</td>
                  <td className="center-text">100</td>
                  {/* Summary row if needed, but the user image shows 100, 100, 67, etc. */}
                  {[100, 100, 67, 46, 33, 22, 17, 10, 6, 3, 0].slice(1).map((val, i) => (
                    <td key={i} className="center-text fw-700">{val}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="footer-note">
            <ChevronRight size={14} />
            <span>Semakin banyak kesalahan, poin yang didapat semakin kecil.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiParameterModal;
