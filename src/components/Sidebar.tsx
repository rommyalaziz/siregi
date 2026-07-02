import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, FileBarChart, LogOut, UserPlus, GraduationCap, Info, X, ClipboardCheck, Banknote, Zap, User, FolderArchive, Activity, ChevronDown, FileText, Banknote as CoinIcon, UserCheck } from 'lucide-react';
import KpiParameterModal from './KpiParameterModal';
import { supabase } from '../lib/supabase';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isKpiModalOpen, setIsKpiModalOpen] = React.useState(false);

  // Arsip Digital accordion state
  const arsipRoutes = ['/arsip-digital/anggota', '/arsip-digital/pencairan', '/arsip-digital/anggota-masuk'];
  const isArsipActive = arsipRoutes.some(r => location.pathname.startsWith(r));
  const [arsipOpen, setArsipOpen] = React.useState(isArsipActive);
  const arsipSubmenuRef = useRef<HTMLDivElement>(null);

  // Keep accordion open if navigating to an arsip route
  useEffect(() => {
    if (isArsipActive) setArsipOpen(true);
  }, [location.pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose();
  }, [location.pathname]);
  
  // Get user session to check role
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const role = user?.role?.toLowerCase() || '';
  const isAdmin = role.includes('admin');
  const isSuperAdmin = role === 'administrator' || role === 'admin';

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Log logout activity
    if (user?.id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        activity_type: 'LOGOUT',
        user_agent: navigator.userAgent
      });
    }
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
            {isSuperAdmin && (
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
              </>
            )}
            
            <NavLink to="/admin/rekap-pengeluaran" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Banknote size={16} />
              <span>Rekap Pengeluaran</span>
            </NavLink>
            <NavLink to="/admin/data-user" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={16} />
              <span>Data User</span>
            </NavLink>
            
            {isSuperAdmin && (
              <NavLink to="/admin/log-aktivitas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Activity size={16} />
                <span>Log Aktivitas</span>
              </NavLink>
            )}
          </>
        )}

        {/* Placeholder for future Reports view if needed */}
        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileBarChart size={16} />
          <span>Laporan Detail</span>
        </NavLink>
        {/* ── Arsip Digital Accordion ── */}
        <div className="nav-group">
          <button
            className={`nav-item nav-group-trigger ${isArsipActive ? 'active' : ''}`}
            onClick={() => setArsipOpen(prev => !prev)}
            aria-expanded={arsipOpen}
          >
            <FolderArchive size={16} />
            <span>Arsip Digital</span>
            <ChevronDown
              size={14}
              className={`nav-chevron ${arsipOpen ? 'nav-chevron--open' : ''}`}
            />
          </button>

          <div
            ref={arsipSubmenuRef}
            className="nav-submenu"
            style={{
              maxHeight: arsipOpen
                ? `${arsipSubmenuRef.current?.scrollHeight ?? 200}px`
                : '0px',
            }}
          >
            <NavLink
              to="/arsip-digital/anggota"
              className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
            >
              <FileText size={13} />
              <span>Arsip Anggota</span>
            </NavLink>
            <NavLink
              to="/arsip-digital/pencairan"
              className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
            >
              <CoinIcon size={13} />
              <span>Arsip Pencairan</span>
            </NavLink>
            <NavLink
              to="/arsip-digital/anggota-masuk"
              className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
            >
              <UserCheck size={13} />
              <span>Arsip Anggota Masuk</span>
            </NavLink>
          </div>
        </div>
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
