import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, FileBarChart, LogOut, UserPlus, GraduationCap } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  
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
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-box">
          <div className="logo-icon"></div>
          <span className="logo-text">SIREGI</span>
        </div>
      </div>
      
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
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item logout" style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}>
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
