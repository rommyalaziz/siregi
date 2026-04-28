import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import './App.css';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BranchProgress from './pages/BranchProgress';
import StaffProgress from './pages/StaffProgress';
import AdminStaffUpdate from './pages/AdminStaffUpdate';
import DetailedReport from './pages/DetailedReport';
import MdisgoMonitoring from './pages/MdisgoMonitoring';
import { useIdleTimer } from './hooks/useIdleTimer';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const session = sessionStorage.getItem('msa_session');
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function AppContent() {
  // Global inactivity logout hook
  useIdleTimer();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/branches" element={<BranchProgress />} />
        <Route path="/staff" element={<StaffProgress />} />
        <Route path="/reports" element={<DetailedReport />} />
        <Route path="/mdisgo" element={<MdisgoMonitoring />} />
        <Route path="/admin/update" element={<AdminStaffUpdate />} />
      </Route>

      {/* Catch all redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
