import React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import './MainLayout.css';

const MainLayout = () => {
  const [user, setUser] = React.useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    const session = sessionStorage.getItem('msa_session');
    if (session) {
      setUser(JSON.parse(session));
    }
  }, []);

  return (
    <div className="main-layout">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <div className="main-content">
        <header className="main-header">
          <div className="header-left">
            <button 
              className="menu-toggle-btn mobile-only" 
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
          <div className="header-right">
            <div className="search-bar desktop-only">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search..." />
            </div>
            <div className="user-profile">
              <div className="avatar">
                <img src={`https://ui-avatars.com/api/?name=${user?.fullName || 'User'}&background=EEF2FF&color=6366F1`} alt="User avatar" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
              </div>
              <div className="user-info desktop-only">
                <span className="user-name">{user?.fullName || 'Admin User'}</span>
                <span className="user-role">{user?.role || 'User'}</span>
              </div>
            </div>
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
