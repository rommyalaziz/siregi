import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Drawer } from '../components/Drawer';
import { Search, Filter, Eye, LineChart, MessageSquare } from 'lucide-react';
import { branchesData } from '../mockData';
import './TableStyles.css';

const BranchProgress = () => {
  const [selectedBranch, setSelectedBranch] = useState<any>(null);

  const openDrawer = (branch: any) => setSelectedBranch(branch);
  const closeDrawer = () => setSelectedBranch(null);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Progres Cabang</h1>
          <p>Pelacakan kinerja detail di seluruh cabang yang beroperasi.</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <Search size={18} />
            <input type="text" placeholder="Cari cabang..." />
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
                <th>ID Cabang</th>
                <th>Nama</th>
                <th>Wilayah</th>
                <th>Manajer</th>
                <th>Target Progres</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {branchesData.map(branch => (
                <tr key={branch.id}>
                  <td className="mono">{branch.id}</td>
                  <td className="fw-500">{branch.name}</td>
                  <td>{branch.region}</td>
                  <td>{branch.manager}</td>
                  <td style={{ width: '220px' }}>
                    <ProgressBar 
                      progress={branch.progress} 
                      color={branch.status === 'on-track' ? 'var(--color-secondary)' : branch.status === 'delayed' ? 'var(--color-warning)' : 'var(--color-danger)'}
                    />
                  </td>
                  <td>
                    <Badge variant={branch.status as BadgeVariant}>
                      {branch.status === 'on-track' ? 'On Track' : branch.status === 'delayed' ? 'Delayed' : 'Critical'}
                    </Badge>
                  </td>
                  <td>
                    <button className="icon-btn" title="Lihat Detail" onClick={() => openDrawer(branch)}>
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer 
        isOpen={!!selectedBranch} 
        onClose={closeDrawer} 
        title={selectedBranch ? `Beranda ${selectedBranch.name}` : 'Laporan'}
      >
        {selectedBranch && (
          <div className="drawer-content">
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Badge variant={selectedBranch.status as BadgeVariant}>
                  {selectedBranch.status === 'on-track' ? 'On Track' : selectedBranch.status === 'delayed' ? 'Delayed' : 'Critical'}
                </Badge>
                <span className="mono">{selectedBranch.id}</span>
              </div>
              <p><strong>Manajer:</strong> {selectedBranch.manager}</p>
              <p><strong>Wilayah:</strong> {selectedBranch.region}</p>
            </div>
            
            <div className="drawer-section">
              <h3>Target Progres</h3>
              <div style={{ marginTop: '8px' }}>
                <ProgressBar 
                  progress={selectedBranch.progress} 
                  label="Penyelesaian Keseluruhan"
                  color={selectedBranch.status === 'on-track' ? 'var(--color-secondary)' : selectedBranch.status === 'delayed' ? 'var(--color-warning)' : 'var(--color-danger)'}
                />
              </div>
            </div>

            <div className="drawer-section">
              <h3>Aksi Cepat</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-outline w-full justify-center">
                  <LineChart size={16} /> Lihat Analitik
                </button>
                <button className="btn btn-outline w-full justify-center">
                  <MessageSquare size={16} /> Tambah Catatan
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default BranchProgress;
