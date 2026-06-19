import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  LogIn,
  Clock,
  Activity,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Monitor
} from 'lucide-react';
import './TableStyles.css';
import './LogAktivitas.css';

// Threshold for "online" status: user active within last 3 minutes
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;
const PAGE_SIZE = 1000;

interface AppUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface ActivityLog {
  id: number;
  user_id: number;
  activity_type: string;
  activity_time: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface UserActivitySummary {
  user: AppUser;
  lastLogin: string | null;
  lastActivity: string | null;
  isOnline: boolean;
  loginCount: number;
  recentActivities: ActivityLog[];
}

const LogAktivitas = () => {
  // Session & Access control
  const sessionData = sessionStorage.getItem('msa_session');
  const currentUser = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = currentUser?.role?.toLowerCase().includes('admin');

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // State
  const [userSummaries, setUserSummaries] = useState<UserActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [userDetailLogs, setUserDetailLogs] = useState<ActivityLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    todayLogins: 0,
    inactiveUsers: 0
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // 1. Fetch all users
      const { data: users, error: usersError } = await supabase
        .from('app_users')
        .select('id, username, full_name, role')
        .order('full_name');
      if (usersError) throw usersError;

      // 2. Fetch all activity logs (latest per user)
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('activity_time', { ascending: false });
      if (logsError) throw logsError;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // 3. Build user activity summaries
      const summaries: UserActivitySummary[] = (users || []).map((user: AppUser) => {
        const userLogs = (logs || []).filter((l: ActivityLog) => l.user_id === user.id);

        // Last login
        const loginLogs = userLogs.filter((l: ActivityLog) => l.activity_type === 'LOGIN');
        const lastLogin = loginLogs.length > 0 ? loginLogs[0].activity_time : null;

        // Last activity (any type)
        const lastActivity = userLogs.length > 0 ? userLogs[0].activity_time : null;

        // Online check: last activity within threshold
        const isOnline = lastActivity
          ? (now.getTime() - new Date(lastActivity).getTime()) < ONLINE_THRESHOLD_MS
          : false;

        // Today's login count
        const todayLoginCount = loginLogs.filter(
          (l: ActivityLog) => l.activity_time >= todayStart
        ).length;

        // Recent activities (last 5, excluding heartbeats for display)
        const recentActivities = userLogs
          .filter((l: ActivityLog) => l.activity_type !== 'HEARTBEAT')
          .slice(0, 5);

        return {
          user,
          lastLogin,
          lastActivity,
          isOnline,
          loginCount: todayLoginCount,
          recentActivities
        };
      });

      setUserSummaries(summaries);

      // 4. Calculate stats
      const onlineCount = summaries.filter(s => s.isOnline).length;
      const todayTotalLogins = summaries.reduce((sum, s) => sum + s.loginCount, 0);
      const inactiveCount = summaries.filter(s => !s.lastActivity).length;

      setStats({
        totalUsers: summaries.length,
        onlineUsers: onlineCount,
        todayLogins: todayTotalLogins,
        inactiveUsers: inactiveCount
      });

    } catch (err: any) {
      console.error('Error fetching activity data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 60 seconds
    const refreshInterval = setInterval(() => fetchData(true), 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Fetch detail logs for expanded user
  const fetchUserDetailLogs = async (userId: number) => {
    try {
      setDetailLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .neq('activity_type', 'HEARTBEAT')
        .order('activity_time', { ascending: false })
        .limit(20);
      if (error) throw error;
      setUserDetailLogs(data || []);
    } catch (err) {
      console.error('Error fetching user detail logs:', err);
      setUserDetailLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExpandUser = (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDetailLogs([]);
    } else {
      setExpandedUserId(userId);
      fetchUserDetailLogs(userId);
    }
  };

  // Get unique roles for filter
  const uniqueRoles = [...new Set(userSummaries.map(s => s.user.role))].sort();

  // Filter logic
  const filteredSummaries = userSummaries.filter(s => {
    const matchSearch = s.user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.user.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === 'Semua' || s.user.role === roleFilter;
    const matchStatus = statusFilter === 'Semua' ||
                        (statusFilter === 'Online' && s.isOnline) ||
                        (statusFilter === 'Offline' && !s.isOnline);

    let matchDate = true;
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toISOString().split('T')[0];
      if (s.lastLogin) {
        const loginDate = new Date(s.lastLogin).toISOString().split('T')[0];
        matchDate = loginDate === filterDate;
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchRole && matchStatus && matchDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSummaries.length / PAGE_SIZE);
  const paginatedSummaries = filteredSummaries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, dateFilter]);

  // Format date helper
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Belum pernah';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  };

  // Parse user agent for simple browser/device display
  const parseBrowser = (ua: string | null) => {
    if (!ua) return '-';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    return 'Browser Lain';
  };

  return (
    <div className="page-container" style={{ padding: '16px 20px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Log Aktivitas</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Pantau aktivitas seluruh user dalam aplikasi SIREGI.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{ height: '36px', fontSize: '13px' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Memperbarui...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="log-stats-row">
        <div className="log-stat-card">
          <div className="log-stat-icon online">
            <UserCheck size={20} />
          </div>
          <div className="log-stat-info">
            <span className="log-stat-value">{stats.onlineUsers}</span>
            <span className="log-stat-label">User Online</span>
          </div>
        </div>
        <div className="log-stat-card">
          <div className="log-stat-icon total">
            <Users size={20} />
          </div>
          <div className="log-stat-info">
            <span className="log-stat-value">{stats.totalUsers}</span>
            <span className="log-stat-label">Total User</span>
          </div>
        </div>
        <div className="log-stat-card">
          <div className="log-stat-icon login">
            <LogIn size={20} />
          </div>
          <div className="log-stat-info">
            <span className="log-stat-value">{stats.todayLogins}</span>
            <span className="log-stat-label">Login Hari Ini</span>
          </div>
        </div>
        <div className="log-stat-card">
          <div className="log-stat-icon inactive">
            <Clock size={20} />
          </div>
          <div className="log-stat-info">
            <span className="log-stat-value">{stats.inactiveUsers}</span>
            <span className="log-stat-label">Belum Pernah Login</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="log-filter-row">
          <div className="log-filter-group">
            {/* Search */}
            <div className="search-box" style={{ flex: 1, maxWidth: '280px', width: '100%' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari nama atau username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Role Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
              <select
                className="month-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <option value="Semua">Semua Role</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} style={{ color: 'var(--color-text-muted)' }} />
              <select
                className="month-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <option value="Semua">Semua Status</option>
                <option value="Online">🟢 Online</option>
                <option value="Offline">⚪ Offline</option>
              </select>
            </div>

            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="date"
                className="month-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ height: '34px', fontSize: '12px', padding: '0 8px' }}
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="table-card" style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="center-text" style={{ width: '50px' }}>No</th>
                <th>Nama User</th>
                <th>Role</th>
                <th className="center-text">Status</th>
                <th>Login Terakhir</th>
                <th>Last Activity</th>
                <th>Browser</th>
                <th className="center-text" style={{ width: '80px' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="center-text" style={{ padding: '60px' }}>
                    <Loader2 className="animate-spin text-primary" size={28} />
                    <span style={{ display: 'block', marginTop: '10px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sedang memuat data aktivitas...</span>
                  </td>
                </tr>
              ) : paginatedSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="center-text" style={{ padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    Tidak ada data user yang ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedSummaries.map((summary, index) => (
                  <>
                    <tr key={summary.user.id}>
                      <td className="center-text mono text-muted" data-label="No">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td data-label="Nama User">
                        <div className="user-info-cell">
                          <div className="user-avatar-small">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(summary.user.full_name)}&background=EEF2FF&color=6366F1&size=32`}
                              alt={summary.user.full_name}
                            />
                          </div>
                          <span className="user-name-text">{summary.user.full_name}</span>
                        </div>
                      </td>
                      <td data-label="Role">
                        <Badge variant={summary.user.role.toLowerCase().includes('admin') ? 'delayed' : 'on-track'}>
                          {summary.user.role}
                        </Badge>
                      </td>
                      <td className="center-text" data-label="Status">
                        <div className="status-indicator" style={{ justifyContent: 'center' }}>
                          <span className={`status-dot ${summary.isOnline ? 'online' : 'offline'}`}></span>
                          <span style={{ color: summary.isOnline ? '#10B981' : '#94A3B8' }}>
                            {summary.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td data-label="Login Terakhir">
                        <div>
                          <div className="mono" style={{ fontSize: '12px' }}>{formatDateTime(summary.lastLogin)}</div>
                          {summary.lastLogin && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              {formatTimeAgo(summary.lastLogin)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Last Activity">
                        <div>
                          <div className="mono" style={{ fontSize: '12px' }}>{formatDateTime(summary.lastActivity)}</div>
                          {summary.lastActivity && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              {formatTimeAgo(summary.lastActivity)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Browser">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Monitor size={12} style={{ color: 'var(--color-text-muted)' }} />
                          <span className="mono" style={{ fontSize: '11px' }}>
                            {summary.recentActivities.length > 0
                              ? parseBrowser(summary.recentActivities[0].user_agent)
                              : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="center-text" data-label="Detail">
                        <button
                          className="icon-btn"
                          title="Lihat Riwayat"
                          onClick={() => handleExpandUser(summary.user.id)}
                          style={{
                            color: expandedUserId === summary.user.id ? '#fff' : 'var(--color-primary)',
                            background: expandedUserId === summary.user.id ? 'var(--color-primary)' : 'rgba(99, 102, 241, 0.08)',
                            borderRadius: '6px',
                            padding: '4px 8px'
                          }}
                        >
                          <Activity size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {expandedUserId === summary.user.id && (
                      <tr key={`detail-${summary.user.id}`}>
                        <td colSpan={8} style={{ padding: '0', background: 'var(--color-bg-main)' }}>
                          <div style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                              <Activity size={14} className="text-primary" />
                              <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                Riwayat Aktivitas — {summary.user.full_name}
                              </h3>
                            </div>

                            {detailLoading ? (
                              <div style={{ padding: '20px', textAlign: 'center' }}>
                                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--color-primary)' }} />
                              </div>
                            ) : userDetailLogs.length === 0 ? (
                              <div style={{ padding: '16px', textAlign: 'center', background: 'var(--color-bg-card)', borderRadius: '8px', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                Belum ada riwayat aktivitas untuk user ini.
                              </div>
                            ) : (
                              <div className="activity-timeline">
                                {userDetailLogs.map(log => (
                                  <div key={log.id} className="activity-timeline-item">
                                    <span className={`activity-type-badge ${log.activity_type.toLowerCase()}`}>
                                      {log.activity_type}
                                    </span>
                                    <span style={{ flex: 1, color: 'var(--color-text-main)' }}>
                                      {log.activity_type === 'LOGIN' ? 'Masuk ke aplikasi' : 'Keluar dari aplikasi'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Monitor size={11} style={{ color: 'var(--color-text-muted)' }} />
                                      <span className="mono" style={{ fontSize: '10px' }}>{parseBrowser(log.user_agent)}</span>
                                    </div>
                                    <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                      {formatDateTime(log.activity_time)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredSummaries.length > PAGE_SIZE && (
          <div className="log-pagination">
            <span>
              Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSummaries.length)} dari {filteredSummaries.length} user
            </span>
            <div className="log-pagination-btns">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .search-box {
            max-width: 100% !important;
          }
          .user-info-cell {
            justify-content: flex-end;
          }
          .status-indicator {
            justify-content: flex-end !important;
          }
        }
        @media (min-width: 769px) {
          .user-info-cell {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default LogAktivitas;
