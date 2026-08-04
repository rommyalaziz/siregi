import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, RefreshCw, Loader2, Filter,
  CheckCircle2, Clock, AlertTriangle, Building2,
  BarChart2, PieChart as PieChartIcon, Settings, X, CalendarDays, HelpCircle, FileEdit, ToggleLeft, ToggleRight, ShieldAlert, Trash2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import './SurveyMdisgoRekap.css';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SurveyRow {
  id: string;
  kode_cabang: string;
  nama_cabang: string;
  msa: string;
  status_submit: 'draft' | 'submitted' | null;
  question_1: string | null;
  question_2: string | null;
  question_3: string | null;
  question_4: number | null;
  question_5: string | null;
  question_6: string | null;
  question_7: string | null;
  question_8: string | null;
  question_9: string | null;
  question_10: string | null;
  tanggal_input: string | null;
  tanggal_update: string | null;
  created_by: string | null;
  updated_by: string | null;
}

interface MdisgoBranch {
  branch_code: string;
  branch_name: string;
  status: string;
}

interface PeriodSettings {
  start: string;
  end: string;
}

const DEFAULT_QUESTIONS = [
  'Bagaimana tingkat implementasi MDisgo di cabang Anda?',
  'Apakah MDisgo membantu anggota dalam melihat informasi simpanan dan pinjaman?',
  'Kendala apa yang paling sering dialami anggota?',
  'Menurut Anda apakah staff lapang sudah mampu melakukan edukasi penggunaan MDisgo kepada anggota?',
  'Fitur apa yang paling sering digunakan anggota?',
  'Kendala apa yang paling sering disampaikan staff lapang kepada MSA?',
  'Apa penyebab utama anggota belum menggunakan MDisgo secara aktif?',
  'Fitur apa yang paling perlu dikembangkan?',
  'Apa prioritas perbaikan MDisgo menurut Anda?',
  'Saran dan masukan untuk pengembangan MDisgo.',
];

// ─── Chart Colors ─────────────────────────────────────────────────────────
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

// ─── Helpers ───────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

const parseMultiAnswer = (raw: string | null) => {
  if (!raw) return '-';
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join(', ');
  } catch {}
  return raw;
};

// ─── Component ─────────────────────────────────────────────────────────────
const SurveyMdisgoRekap = () => {
  const navigate = useNavigate();
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  // State
  const [surveyData, setSurveyData] = useState<SurveyRow[]>([]);
  const [allBranches, setAllBranches] = useState<MdisgoBranch[]>([]);
  const [disabledBranches, setDisabledBranches] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodSettings>({ start: '', end: '' });
  const [questions, setQuestions] = useState<string[]>(DEFAULT_QUESTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMsa, setFilterMsa] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modals
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editPeriod, setEditPeriod] = useState<PeriodSettings>({ start: '', end: '' });

  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [editQuestions, setEditQuestions] = useState<string[]>(DEFAULT_QUESTIONS);

  const [showBranchAccessModal, setShowBranchAccessModal] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table');

  const showToast = (type: string, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 3500);
  };

  // ─── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard', { replace: true }); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);

      // 1. All mdisgo active branches
      const { data: branchData } = await supabase
        .from('mdisgo_branches')
        .select('branch_code, branch_name, status')
        .neq('status', 'Belum')
        .order('branch_name');

      setAllBranches(branchData || []);

      // 2. All survey data
      const { data: surveys, error } = await supabase
        .from('survey_mdisgo')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurveyData(surveys || []);

      // 3. Settings (period, questions, disabled branches)
      const { data: appSettings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['survey_mdisgo_period_start', 'survey_mdisgo_period_end', 'survey_mdisgo_questions', 'survey_mdisgo_disabled_branches']);

      if (appSettings && appSettings.length > 0) {
        const startSetting = appSettings.find((p: any) => p.key === 'survey_mdisgo_period_start');
        const endSetting = appSettings.find((p: any) => p.key === 'survey_mdisgo_period_end');
        if (startSetting && endSetting) {
          const p = { start: startSetting.value, end: endSetting.value };
          setPeriod(p);
          setEditPeriod(p);
        }

        const questionsSetting = appSettings.find((p: any) => p.key === 'survey_mdisgo_questions');
        if (questionsSetting?.value) {
          try {
            const parsed = JSON.parse(questionsSetting.value);
            if (Array.isArray(parsed) && parsed.length === 10) {
              setQuestions(parsed);
              setEditQuestions(parsed);
            }
          } catch (e) {}
        }

        const disabledSetting = appSettings.find((p: any) => p.key === 'survey_mdisgo_disabled_branches');
        if (disabledSetting?.value) {
          try {
            const disList = JSON.parse(disabledSetting.value);
            if (Array.isArray(disList)) {
              setDisabledBranches(disList);
            }
          } catch (e) {}
        }
      }
    } catch (err: any) {
      showToast('error', 'Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Combined data: merge all mdisgo branches with survey responses ───────
  const combinedData = useMemo(() => {
    return allBranches.map(branch => {
      const survey = surveyData.find(s => s.kode_cabang === branch.branch_code) || null;
      const isAccessDisabled = disabledBranches.includes(branch.branch_code);
      return { branch, survey, isAccessDisabled };
    });
  }, [allBranches, surveyData, disabledBranches]);

  // ─── MSA list for filter ──────────────────────────────────────────────────
  const msaList = useMemo(() => {
    const set = new Set(surveyData.map(s => s.msa).filter(Boolean));
    return Array.from(set);
  }, [surveyData]);

  // ─── Filtered data ─────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    return combinedData.filter(({ branch, survey }) => {
      const branchName = branch.branch_name.toLowerCase();
      const branchCode = branch.branch_code.toLowerCase();
      const msaName = (survey?.msa || '').toLowerCase();

      if (search && !branchName.includes(search.toLowerCase()) &&
          !branchCode.includes(search.toLowerCase()) &&
          !msaName.includes(search.toLowerCase())) return false;

      if (filterStatus === 'submitted' && survey?.status_submit !== 'submitted') return false;
      if (filterStatus === 'draft' && survey?.status_submit !== 'draft') return false;
      if (filterStatus === 'belum' && survey !== null) return false;

      if (filterMsa && survey?.msa !== filterMsa) return false;

      if (filterDateFrom && survey?.tanggal_input) {
        if (new Date(survey.tanggal_input) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo && survey?.tanggal_input) {
        const endDate = new Date(filterDateTo); endDate.setHours(23, 59, 59);
        if (new Date(survey.tanggal_input) > endDate) return false;
      }

      return true;
    });
  }, [combinedData, search, filterStatus, filterMsa, filterDateFrom, filterDateTo]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allBranches.length;
    const submitted = surveyData.filter(s => s.status_submit === 'submitted').length;
    const draft = surveyData.filter(s => s.status_submit === 'draft').length;
    const belum = total - surveyData.length;
    return { total, submitted, draft, belum };
  }, [allBranches, surveyData]);

  // ─── Chart Data ───────────────────────────────────────────────────────────
  const implementasiChartData = useMemo(() => {
    const opts = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Sangat Kurang'];
    return opts.map(opt => ({
      name: opt,
      Jumlah: surveyData.filter(s => s.question_1 === opt).length,
    }));
  }, [surveyData]);

  const kendalaChartData = useMemo(() => {
    const counter: Record<string, number> = {};
    surveyData.forEach(s => {
      if (!s.question_3) return;
      try {
        const items: string[] = JSON.parse(s.question_3);
        items.forEach(item => { counter[item] = (counter[item] || 0) + 1; });
      } catch { /* ignore */ }
    });
    return Object.entries(counter)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, Jumlah]) => ({ name, Jumlah }));
  }, [surveyData]);

  const statusChartData = useMemo(() => [
    { name: 'Submitted', value: stats.submitted },
    { name: 'Draft', value: stats.draft },
    { name: 'Belum Mengisi', value: stats.belum },
  ].filter(d => d.value > 0), [stats]);

  const STATUS_COLORS: Record<string, string> = {
    'Submitted': '#10B981',
    'Draft': '#F59E0B',
    'Belum Mengisi': '#E5E7EB',
  };

  // ─── Save Period ───────────────────────────────────────────────────────────
  const savePeriod = async () => {
    try {
      setSaving(true);
      await supabase.from('app_settings').upsert([
        { key: 'survey_mdisgo_period_start', value: editPeriod.start, updated_at: new Date().toISOString() },
        { key: 'survey_mdisgo_period_end',   value: editPeriod.end,   updated_at: new Date().toISOString() },
      ]);
      setPeriod(editPeriod);
      setShowPeriodModal(false);
      showToast('success', 'Periode survey berhasil diperbarui.');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan periode.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Save Questions ────────────────────────────────────────────────────────
  const saveQuestions = async () => {
    try {
      setSaving(true);
      await supabase.from('app_settings').upsert({
        key: 'survey_mdisgo_questions',
        value: JSON.stringify(editQuestions),
        updated_at: new Date().toISOString()
      });
      setQuestions(editQuestions);
      setShowQuestionsModal(false);
      showToast('success', 'Pertanyaan survey berhasil diperbarui.');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan pertanyaan.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Branch Access ──────────────────────────────────────────────────
  const toggleBranch = async (code: string) => {
    try {
      const isCurrentlyDisabled = disabledBranches.includes(code);
      const updated = isCurrentlyDisabled
        ? disabledBranches.filter(c => c !== code)
        : [...disabledBranches, code];

      await supabase.from('app_settings').upsert({
        key: 'survey_mdisgo_disabled_branches',
        value: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      });

      setDisabledBranches(updated);
      showToast('success', `Akses cabang ${code} diubah.`);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengubah akses cabang.');
    }
  };

  // ─── Reset Survey (Admin) ───────────────────────────────────────────────────
  const handleResetSurvey = async (branchName: string, surveyId: string) => {
    const confirmed = window.confirm(
      `Reset survey cabang ${branchName}?\n\nSemua jawaban akan dihapus permanen dan status kembali ke "Belum Mengisi".`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('survey_mdisgo')
        .delete()
        .eq('id', surveyId);
      if (error) throw error;
      setSurveyData(prev => prev.filter(s => s.id !== surveyId));
      showToast('success', `Survey cabang ${branchName} berhasil direset.`);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mereset survey.');
    }
  };

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredData.map(({ branch, survey, isAccessDisabled }, idx) => ({
      'No': idx + 1,
      'Kode Cabang': branch.branch_code,
      'Nama Cabang': branch.branch_name,
      'Akses Survey': isAccessDisabled ? 'Non-Aktif' : 'Aktif',
      'MSA': survey?.msa || '-',
      'Status Survey': survey?.status_submit === 'submitted'
        ? 'Submitted' : survey?.status_submit === 'draft'
        ? 'Draft' : 'Belum Mengisi',
      'Tanggal Input': formatDate(survey?.tanggal_input || null),
      'Tanggal Update': formatDate(survey?.tanggal_update || null),
      [`Q1 - ${questions[0]}`]: survey?.question_1 || '-',
      [`Q2 - ${questions[1]}`]: survey?.question_2 || '-',
      [`Q3 - ${questions[2]}`]: parseMultiAnswer(survey?.question_3 || null),
      [`Q4 - ${questions[3]}`]: survey?.question_4?.toString() || '-',
      [`Q5 - ${questions[4]}`]: survey?.question_5 || '-',
      [`Q6 - ${questions[5]}`]: survey?.question_6 || '-',
      [`Q7 - ${questions[6]}`]: survey?.question_7 || '-',
      [`Q8 - ${questions[7]}`]: survey?.question_8 || '-',
      [`Q9 - ${questions[8]}`]: survey?.question_9 || '-',
      [`Q10 - ${questions[9]}`]: survey?.question_10 || '-',
      'Diisi Oleh': survey?.created_by || '-',
      'Diupdate Oleh': survey?.updated_by || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Survey MDISGO');

    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, 18)
    }));
    ws['!cols'] = colWidths;

    const filename = `Rekap_Survey_MDISGO_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('success', `Export berhasil: ${filename}`);
  };

  // ─── Status Badge ──────────────────────────────────────────────────────────
  const renderStatusBadge = (survey: SurveyRow | null, isDisabled: boolean) => {
    if (isDisabled) return <span className="rekap-badge rekap-badge-disabled"><ShieldAlert size={10} /> Access Off</span>;
    if (!survey) return <span className="rekap-badge rekap-badge-belum">Belum Mengisi</span>;
    if (survey.status_submit === 'submitted') return (
      <span className="rekap-badge rekap-badge-submitted">
        <CheckCircle2 size={10} /> Submitted
      </span>
    );
    return <span className="rekap-badge rekap-badge-draft"><Clock size={10} /> Draft</span>;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rekap-container">
      {/* Toast */}
      {toast.text && (
        <div className={`rekap-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="rekap-header">
        <div>
          <h1>Rekap Survey MDISGO</h1>
          <p>Data evaluasi implementasi MDISGO dari seluruh cabang aktif</p>
        </div>
        <div className="rekap-header-actions">
          <button className="rekap-btn-period" onClick={() => setShowBranchAccessModal(true)}>
            <Building2 size={13} />
            Kelola Cabang Peserta
          </button>
          <button className="rekap-btn-period" onClick={() => { setEditQuestions([...questions]); setShowQuestionsModal(true); }}>
            <HelpCircle size={13} />
            Edit Pertanyaan
          </button>
          <button className="rekap-btn-period" onClick={() => { setEditPeriod(period); setShowPeriodModal(true); }}>
            <Settings size={13} />
            Atur Periode
          </button>
          <button className="rekap-btn-refresh" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'rekap-spin' : ''} />
            Refresh
          </button>
          <button className="rekap-btn-export" onClick={handleExport} disabled={loading || filteredData.length === 0}>
            <Download size={13} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Period Info */}
      {period.start && period.end && (
        <div className="rekap-period-info">
          <CalendarDays size={13} />
          <span>
            Periode Survey: <strong>{new Date(period.start).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            {' — '}
            <strong>{new Date(period.end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="rekap-stats-grid">
        <div className="rekap-stat-card">
          <div className="rekap-stat-icon blue"><Building2 size={18} /></div>
          <div className="rekap-stat-info">
            <div className="rekap-stat-value">{stats.total}</div>
            <div className="rekap-stat-label">Cabang Aktif MDisgo</div>
          </div>
        </div>
        <div className="rekap-stat-card">
          <div className="rekap-stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="rekap-stat-info">
            <div className="rekap-stat-value">{stats.submitted}</div>
            <div className="rekap-stat-label">Sudah Submit</div>
          </div>
        </div>
        <div className="rekap-stat-card">
          <div className="rekap-stat-icon yellow"><Clock size={18} /></div>
          <div className="rekap-stat-info">
            <div className="rekap-stat-value">{stats.draft}</div>
            <div className="rekap-stat-label">Masih Draft</div>
          </div>
        </div>
        <div className="rekap-stat-card">
          <div className="rekap-stat-icon gray"><AlertTriangle size={18} /></div>
          <div className="rekap-stat-info">
            <div className="rekap-stat-value">{stats.belum}</div>
            <div className="rekap-stat-label">Belum Mengisi</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rekap-tabs">
        <button
          className={`rekap-tab ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <Building2 size={14} /> Data Tabel (Lengkap Q1–Q10)
        </button>
        <button
          className={`rekap-tab ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <BarChart2 size={14} /> Grafik Statistik
        </button>
      </div>

      {/* ─── TABLE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'table' && (
        <>
          {/* Filter Bar */}
          <div className="rekap-filter-bar">
            <div className="rekap-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Cari cabang, kode, MSA..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')}><X size={12} /></button>}
            </div>
            <div className="rekap-filters">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Semua Status</option>
                <option value="submitted">Submitted</option>
                <option value="draft">Draft</option>
                <option value="belum">Belum Mengisi</option>
              </select>
              <select value={filterMsa} onChange={e => setFilterMsa(e.target.value)}>
                <option value="">Semua MSA</option>
                {msaList.map(msa => (
                  <option key={msa} value={msa}>{msa}</option>
                ))}
              </select>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                title="Tanggal input dari" />
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                title="Tanggal input sampai" />
              {(filterStatus || filterMsa || filterDateFrom || filterDateTo) && (
                <button className="rekap-clear-filter" onClick={() => {
                  setFilterStatus(''); setFilterMsa(''); setFilterDateFrom(''); setFilterDateTo('');
                }}>
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="rekap-table-info">
            Menampilkan {filteredData.length} dari {combinedData.length} cabang (Geser tabel ke kanan untuk melihat seluruh pertanyaan Q1–Q10)
          </div>

          {/* Compact Dense Table */}
          <div className="rekap-table-wrapper compact-mode">
            {loading ? (
              <div className="rekap-loading">
                <Loader2 size={24} className="rekap-spin" />
                <span>Memuat data...</span>
              </div>
            ) : (
              <table className="rekap-table compact-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No</th>
                    <th style={{ width: 140 }}>Cabang</th>
                    <th style={{ width: 110 }}>MSA</th>
                    <th style={{ width: 90 }}>Status</th>
                    <th style={{ width: 90 }}>Tgl Input</th>
                    <th style={{ width: 90 }}>Tgl Update</th>
                    <th style={{ width: 100 }} title={questions[0]}>Q1 Implementasi</th>
                    <th style={{ width: 100 }} title={questions[1]}>Q2 Membantu</th>
                    <th style={{ width: 130 }} title={questions[2]}>Q3 Kendala</th>
                    <th style={{ width: 70 }} title={questions[3]}>Q4 Edukasi</th>
                    <th style={{ width: 120 }} title={questions[4]}>Q5 Fitur Sering</th>
                    <th style={{ width: 130 }} title={questions[5]}>Q6 Kendala Staff</th>
                    <th style={{ width: 130 }} title={questions[6]}>Q7 Penyebab Belum</th>
                    <th style={{ width: 130 }} title={questions[7]}>Q8 Pengembangan</th>
                    <th style={{ width: 130 }} title={questions[8]}>Q9 Prioritas</th>
                    <th style={{ width: 130 }} title={questions[9]}>Q10 Saran</th>
                    <th style={{ width: 90 }}>Aksi Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="rekap-empty">
                        <Filter size={20} />
                        <span>Tidak ada data yang cocok dengan filter</span>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map(({ branch, survey, isAccessDisabled }, idx) => (
                      <tr key={branch.branch_code}>
                        <td className="text-center">{idx + 1}</td>
                        <td>
                          <div className="rekap-branch-cell">
                            <span className="rekap-branch-name">{branch.branch_name}</span>
                            <span className="rekap-branch-code">{branch.branch_code}</span>
                          </div>
                        </td>
                        <td>{survey?.msa || <span className="rekap-empty-cell">—</span>}</td>
                        <td>{renderStatusBadge(survey, isAccessDisabled)}</td>
                        <td>{formatDate(survey?.tanggal_input || null)}</td>
                        <td>{formatDate(survey?.tanggal_update || null)}</td>

                        {/* Q1 */}
                        <td>
                          {survey?.question_1
                            ? <span className="rekap-q1-chip">{survey.question_1}</span>
                            : <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q2 */}
                        <td>
                          {survey?.question_2
                            ? <span className="rekap-chip-simple">{survey.question_2}</span>
                            : <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q3 */}
                        <td className="rekap-compact-cell" title={parseMultiAnswer(survey?.question_3 || null)}>
                          {parseMultiAnswer(survey?.question_3 || null)}
                        </td>

                        {/* Q4 */}
                        <td className="text-center">
                          {survey?.question_4 != null
                            ? <span className="rekap-rating">{survey.question_4}/5</span>
                            : <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q5 */}
                        <td className="rekap-compact-cell" title={survey?.question_5 || ''}>
                          {survey?.question_5 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q6 */}
                        <td className="rekap-compact-cell" title={survey?.question_6 || ''}>
                          {survey?.question_6 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q7 */}
                        <td className="rekap-compact-cell" title={survey?.question_7 || ''}>
                          {survey?.question_7 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q8 */}
                        <td className="rekap-compact-cell" title={survey?.question_8 || ''}>
                          {survey?.question_8 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q9 */}
                        <td className="rekap-compact-cell" title={survey?.question_9 || ''}>
                          {survey?.question_9 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Q10 */}
                        <td className="rekap-compact-cell" title={survey?.question_10 || ''}>
                          {survey?.question_10 || <span className="rekap-empty-cell">—</span>}
                        </td>

                        {/* Aksi */}
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              className="rekap-btn-input-survey"
                              onClick={() => navigate(`/mdisgo/survey/form?kode_cabang=${branch.branch_code}`)}
                              title={`Simulasi / Input Survey untuk ${branch.branch_name}`}
                            >
                              <FileEdit size={12} />
                              {survey ? 'Edit' : 'Isi'}
                            </button>
                            {survey && (
                              <button
                                className="rekap-btn-reset-survey"
                                onClick={() => handleResetSurvey(branch.branch_name, survey.id)}
                                title={`Reset/hapus survey ${branch.branch_name}`}
                              >
                                <Trash2 size={12} />
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ─── CHARTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'charts' && (
        <div className="rekap-charts-grid">
          {/* Status Pie */}
          <div className="rekap-chart-card">
            <div className="rekap-chart-title">
              <PieChartIcon size={15} />
              Status Pengisian Survey
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                  paddingAngle={3} label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Implementasi Bar */}
          <div className="rekap-chart-card">
            <div className="rekap-chart-title">
              <BarChart2 size={15} />
              Distribusi Tingkat Implementasi
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={implementasiChartData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Jumlah" radius={[4, 4, 0, 0]}>
                  {implementasiChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Kendala Bar */}
          <div className="rekap-chart-card rekap-chart-wide">
            <div className="rekap-chart-title">
              <BarChart2 size={15} />
              Kendala Terbanyak (dari Anggota)
            </div>
            {kendalaChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kendalaChartData} layout="vertical" margin={{ top: 4, right: 20, left: 80, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="Jumlah" radius={[0, 4, 4, 0]}>
                    {kendalaChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rekap-no-data">Belum ada data kendala</div>
            )}
          </div>
        </div>
      )}

      {/* ─── PERIOD MODAL ──────────────────────────────────────────────────── */}
      {showPeriodModal && (
        <div className="rekap-modal-overlay" onClick={() => setShowPeriodModal(false)}>
          <div className="rekap-modal" onClick={e => e.stopPropagation()}>
            <div className="rekap-modal-header">
              <h3>Atur Periode Survey MDISGO</h3>
              <button onClick={() => setShowPeriodModal(false)}><X size={18} /></button>
            </div>
            <div className="rekap-modal-body">
              <div className="rekap-modal-field">
                <label>Tanggal Mulai</label>
                <input
                  type="date"
                  value={editPeriod.start}
                  onChange={e => setEditPeriod(p => ({ ...p, start: e.target.value }))}
                />
              </div>
              <div className="rekap-modal-field">
                <label>Tanggal Selesai</label>
                <input
                  type="date"
                  value={editPeriod.end}
                  onChange={e => setEditPeriod(p => ({ ...p, end: e.target.value }))}
                />
              </div>
              <p className="rekap-modal-note">
                Cabang hanya dapat mengisi/mengedit survey dalam periode yang ditentukan. Administrator tetap dapat mengisi survey kapan pun.
              </p>
            </div>
            <div className="rekap-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowPeriodModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={savePeriod} disabled={saving || !editPeriod.start || !editPeriod.end}>
                {saving ? <Loader2 size={13} className="rekap-spin" /> : null}
                Simpan Periode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUESTIONS EDIT MODAL ──────────────────────────────────────────── */}
      {showQuestionsModal && (
        <div className="rekap-modal-overlay" onClick={() => setShowQuestionsModal(false)}>
          <div className="rekap-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="rekap-modal-header">
              <h3>Edit Pertanyaan Survey MDISGO</h3>
              <button onClick={() => setShowQuestionsModal(false)}><X size={18} /></button>
            </div>
            <div className="rekap-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {editQuestions.map((q, idx) => (
                <div key={idx} className="rekap-modal-field">
                  <label>Pertanyaan {idx + 1}</label>
                  <input
                    type="text"
                    value={q}
                    onChange={e => {
                      const updated = [...editQuestions];
                      updated[idx] = e.target.value;
                      setEditQuestions(updated);
                    }}
                    placeholder={`Teks pertanyaan ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
            <div className="rekap-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowQuestionsModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={saveQuestions} disabled={saving}>
                {saving ? <Loader2 size={13} className="rekap-spin" /> : null}
                Simpan Pertanyaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BRANCH ACCESS CONTROL MODAL ───────────────────────────────────── */}
      {showBranchAccessModal && (
        <div className="rekap-modal-overlay" onClick={() => setShowBranchAccessModal(false)}>
          <div className="rekap-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="rekap-modal-header">
              <h3>Kelola Akses Cabang Peserta Survey</h3>
              <button onClick={() => setShowBranchAccessModal(false)}><X size={18} /></button>
            </div>
            <div className="rekap-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 10px 0' }}>
                Centang cabang yang diperbolehkan mengisi survey. Cabang yang dinonaktifkan tidak akan dapat mengisi survey.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {allBranches.map(b => {
                  const isDisabled = disabledBranches.includes(b.branch_code);
                  return (
                    <div
                      key={b.branch_code}
                      onClick={() => toggleBranch(b.branch_code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: isDisabled ? '#FEF2F2' : '#ECFDF5',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{b.branch_name} ({b.branch_code})</span>
                      {isDisabled ? <ToggleLeft size={18} color="#EF4444" /> : <ToggleRight size={18} color="#10B981" />}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rekap-modal-footer">
              <button className="btn btn-primary" onClick={() => setShowBranchAccessModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyMdisgoRekap;
