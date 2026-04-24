import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, GraduationCap, FileBarChart, UserPlus } from 'lucide-react';
import './BottomNav.css';

const BottomNav = () => {
  const sessionData = localStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  return (
    <nav className="bottom-nav mobile-only flex">
      <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        <span>Beranda</span>
      </NavLink>
      <NavLink to="/staff" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Users size={20} />
        <span>Review</span>
      </NavLink>
      {isAdmin && (
        <>
          <NavLink to="/branches" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={20} />
            <span>Cabang</span>
          </NavLink>
          <NavLink to="/admin/update" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <UserPlus size={20} />
            <span>Update</span>
          </NavLink>
        </>
      )}
      <NavLink to="/mdisgo" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <GraduationCap size={20} />
        <span>MDISGO</span>
      </NavLink>
      <NavLink to="/reports" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FileBarChart size={20} />
        <span>Laporan</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
