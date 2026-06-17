import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, FileBarChart, LogOut, UserPlus, GraduationCap, Info, X, ClipboardCheck, Banknote, Zap, User, ChevronRight } from 'lucide-react';
import KpiParameterModal from './KpiParameterModal';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isKpiModalOpen, setIsKpiModalOpen] = React.useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose();
  }, [location.pathname]);
  
  // Get user session to check role
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  // Make admin check more robust (case-insensitive)
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear the session from sessionStorage
    sessionStorage.removeItem('msa_session');
    // Force redirect back to login
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay mobile-only" 
          onClick={onClose}
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box">
            <div className="logo-icon">
              <Zap size={22} color="#6366f1" fill="rgba(99, 102, 241, 0.4)" />
            </div>
            <span className="logo-text">SIREGI</span>
          </div>
          <button className="sidebar-close-btn mobile-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {user && (
          <div className="sidebar-profile">
            <div className="sidebar-avatar">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.fullName} />
              ) : (
                <User size={24} />
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.fullName || 'User'}</span>
            </div>
          </div>
        )}
      
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={16} />
          <span>Beranda</span>
        </NavLink>
        <NavLink to="/staff" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={16} />
          <span>Performance Review</span>
        </NavLink>
        
        {isAdmin && (
          <>
            <NavLink to="/branches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Building2 size={16} />
              <span>Progres Cabang</span>
            </NavLink>
            <NavLink to="/admin/update" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <UserPlus size={16} />
              <span>Update Kesalahan</span>
            </NavLink>
            <NavLink to="/kunjungan" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <ClipboardCheck size={16} />
              <span>Kunjungan</span>
            </NavLink>
            <NavLink to="/admin/rekap-pengeluaran" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Banknote size={16} />
              <span>Rekap Pengeluaran</span>
            </NavLink>
            <NavLink to="/admin/data-user" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={16} />
              <span>Data User</span>
            </NavLink>
          </>
        )}

        {/* Placeholder for future Reports view if needed */}
        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileBarChart size={16} />
          <span>Laporan Detail</span>
        </NavLink>
        <NavLink to="/mdisgo" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <GraduationCap size={16} />
          <span>MDISGO</span>
        </NavLink>

        <button 
          onClick={() => setIsKpiModalOpen(true)} 
          className="nav-item" 
          style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
        >
          <Info size={16} />
          <span>Parameter Performance</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item logout" style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}>
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>

      <KpiParameterModal 
        isOpen={isKpiModalOpen} 
        onClose={() => setIsKpiModalOpen(false)} 
      />
    </aside>
    </>
  );
};

export default Sidebar;
