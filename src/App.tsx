import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import SurveyMdisgo from './pages/SurveyMdisgo';
import SurveyMdisgoForm from './pages/SurveyMdisgoForm';
import SurveyMdisgoRekap from './pages/SurveyMdisgoRekap';
import Kunjungan from './pages/Kunjungan';
import DataUser from './pages/DataUser';
import RekapPengeluaran from './pages/RekapPengeluaran';
import ArsipDigital from './pages/ArsipDigital';
import ArsipDigitalForm from './pages/ArsipDigitalForm';
import LogAktivitas from './pages/LogAktivitas';
import { useIdleTimer } from './hooks/useIdleTimer';
import { useActivityTracker } from './hooks/useActivityTracker';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const session = sessionStorage.getItem('msa_session');
  const location = useLocation();
  
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// Admin Only Route Component
const AdminRoute = ({ children }: { children: ReactNode }) => {
  const session = sessionStorage.getItem('msa_session');
  const user = session ? JSON.parse(session) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Super Admin Only Route Component (for write actions & restricted views)
const SuperAdminRoute = ({ children }: { children: ReactNode }) => {
  const session = sessionStorage.getItem('msa_session');
  const user = session ? JSON.parse(session) : null;
  const role = user?.role?.toLowerCase() || '';
  const isSuperAdmin = role === 'administrator' || role === 'admin';
  
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function AppContent() {
  // Global inactivity logout hook
  useIdleTimer();
  // Activity tracking hook (heartbeat for online detection)
  useActivityTracker();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/branches" element={<SuperAdminRoute><BranchProgress /></SuperAdminRoute>} />
        <Route path="/staff" element={<StaffProgress />} />
        <Route path="/reports" element={<DetailedReport />} />
        <Route path="/mdisgo" element={<MdisgoMonitoring />} />
        {/* Survey MDISGO Module */}
        <Route path="/mdisgo/survey" element={<SurveyMdisgo />} />
        <Route path="/mdisgo/survey/form" element={<SurveyMdisgoForm />} />
        <Route path="/mdisgo/survey/rekap" element={<AdminRoute><SurveyMdisgoRekap /></AdminRoute>} />
        <Route path="/kunjungan" element={<SuperAdminRoute><Kunjungan /></SuperAdminRoute>} />
        <Route path="/admin/update" element={<SuperAdminRoute><AdminStaffUpdate /></SuperAdminRoute>} />
        <Route path="/admin/data-user" element={<AdminRoute><DataUser /></AdminRoute>} />
        <Route path="/admin/rekap-pengeluaran" element={<AdminRoute><RekapPengeluaran /></AdminRoute>} />
        <Route path="/admin/log-aktivitas" element={<SuperAdminRoute><LogAktivitas /></SuperAdminRoute>} />
        
        {/* Arsip Digital Module */}
        <Route path="/arsip-digital" element={<Navigate to="/arsip-digital/anggota" replace />} />
        <Route path="/arsip-digital/anggota" element={<ArsipDigital view="anggota" />} />
        <Route path="/arsip-digital/pencairan" element={<ArsipDigital view="pencairan" />} />
        <Route path="/arsip-digital/anggota-masuk" element={<ArsipDigital view="anggota-masuk" />} />
        <Route path="/arsip-digital/tambah/:type" element={<AdminRoute><ArsipDigitalForm /></AdminRoute>} />
        <Route path="/arsip-digital/edit/:id/:type" element={<AdminRoute><ArsipDigitalForm /></AdminRoute>} />
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
