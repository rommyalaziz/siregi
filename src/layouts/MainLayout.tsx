import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import './MainLayout.css';

const MainLayout = () => {
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const session = sessionStorage.getItem('msa_session');
    if (session) {
      setUser(JSON.parse(session));
    }
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-content">
        <header className="main-header">
          <div className="header-breadcrumbs">
            <span className="breadcrumb-role">{user?.role || 'User'}</span>
          </div>
          <div className="user-profile">
            <div className="avatar">{getInitials(user?.fullName)}</div>
            <span className="user-name">{user?.fullName || 'Admin'}</span>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
