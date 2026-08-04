import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, AlertTriangle, Clock, Edit2, Eye,
  Building2, User, CalendarDays, Star, ToggleLeft, ToggleRight, Settings, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SurveyMdisgo.css';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SurveyRecord {
  id: string;
  kode_cabang: string;
  nama_cabang: string;
  msa: string;
  status_submit: 'draft' | 'submitted';
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

interface PeriodSettings {
  start: string;
  end: string;
}

interface BranchOption {
  branch_code: string;
  branch_name: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const DEFAULT_QUESTION_LABELS = [
  'Bagaimana tingkat implementasi MDisgo di cabang Anda?',
  'Apakah MDisgo membantu anggota dalam melihat informasi simpanan dan pinjaman?',
  'Kendala apa yang paling sering dialami anggota?',
  'Seberapa baik staff lapang dalam melakukan edukasi penggunaan MDisgo kepada anggota?',
  'Fitur apa yang paling sering digunakan anggota?',
  'Kendala apa yang paling sering disampaikan staff lapang kepada MSA?',
  'Apa penyebab utama anggota belum menggunakan MDisgo secara aktif?',
  'Fitur apa yang paling perlu dikembangkan?',
  'Apa prioritas perbaikan MDisgo menurut Anda?',
  'Saran dan masukan untuk pengembangan MDisgo.',
];

// ─── Component ────────────────────────────────────────────────────────────────
const SurveyMdisgo = () => {
  const navigate = useNavigate();

  // Session
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  // State
  const [loading, setLoading] = useState(true);
  const [isMdisgoActive, setIsMdisgoActive] = useState<boolean | null>(null);
  const [branchInfo, setBranchInfo] = useState<{ branch_code: string; branch_name: string } | null>(null);
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [selectedAdminBranch, setSelectedAdminBranch] = useState<string>('');
  const [disabledBranches, setDisabledBranches] = useState<string[]>([]);
  const [surveyRecord, setSurveyRecord] = useState<SurveyRecord | null>(null);
  const [period, setPeriod] = useState<PeriodSettings | null>(null);
  const [questionLabels, setQuestionLabels] = useState<string[]>(DEFAULT_QUESTION_LABELS);
  const [showReview, setShowReview] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [togglingAccess, setTogglingAccess] = useState(false);

  const showToast = (type: string, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 3500);
  };

  // ─── Check if survey period is open ───────────────────────────────────────
  const isPeriodOpen = useCallback(() => {
    if (isAdmin) return true; // Admin has unlimited access
    if (!period || !period.start || !period.end) return false;

    // Use local YYYY-MM-DD string comparison to avoid timezone offset issues
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    return todayStr >= period.start && todayStr <= period.end;
  }, [period, isAdmin]);

  // ─── Fetch all data ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, [selectedAdminBranch]);

  const fetchAll = async () => {
    try {
      setLoading(true);

      // 1. Fetch period, questions, and disabled branches settings
      const { data: appSettings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['survey_mdisgo_period_start', 'survey_mdisgo_period_end', 'survey_mdisgo_questions', 'survey_mdisgo_disabled_branches']);

      if (appSettings && appSettings.length > 0) {
        const startSetting = appSettings.find(p => p.key === 'survey_mdisgo_period_start');
        const endSetting = appSettings.find(p => p.key === 'survey_mdisgo_period_end');
        if (startSetting && endSetting) {
          setPeriod({ start: startSetting.value, end: endSetting.value });
        }

        const questionsSetting = appSettings.find(p => p.key === 'survey_mdisgo_questions');
        if (questionsSetting?.value) {
          try {
            const parsed = JSON.parse(questionsSetting.value);
            if (Array.isArray(parsed) && parsed.length === 10) {
              setQuestionLabels(parsed);
            }
          } catch (e) {}
        }

        const disabledSetting = appSettings.find(p => p.key === 'survey_mdisgo_disabled_branches');
        if (disabledSetting?.value) {
          try {
            const disList = JSON.parse(disabledSetting.value);
            if (Array.isArray(disList)) {
              setDisabledBranches(disList);
            }
          } catch (e) {}
        }
      }

      // 2. Resolve branch for Admin vs Non-Admin
      let targetBranchCode = '';

      if (isAdmin) {
        // Fetch all active mdisgo branches for dropdown
        const { data: bData } = await supabase
          .from('mdisgo_branches')
          .select('branch_code, branch_name, status')
          .neq('status', 'Belum')
          .order('branch_name');

        setAllBranches(bData || []);

        if (selectedAdminBranch) {
          targetBranchCode = selectedAdminBranch;
        } else if (bData && bData.length > 0) {
          targetBranchCode = bData[0].branch_code;
          setSelectedAdminBranch(bData[0].branch_code);
        }

        if (!targetBranchCode) {
          setIsMdisgoActive(false);
          setLoading(false);
          return;
        }

        const activeBranch = bData?.find(b => b.branch_code === targetBranchCode);
        setIsMdisgoActive(true);
        setBranchInfo({
          branch_code: targetBranchCode,
          branch_name: activeBranch?.branch_name || targetBranchCode
        });

      } else {
        // Non-Admin: get branch from user's cabang_id
        let cabangData: { id: string; kode_cabang: string; nama_cabang: string } | null = null;

        if (user?.cabang_id) {
          const { data } = await supabase
            .from('cabang')
            .select('id, kode_cabang, nama_cabang')
            .eq('id', user.cabang_id)
            .maybeSingle();
          cabangData = data;
        }

        // Fallback if cabang_id is missing or obsolete in session
        if (!cabangData && (user?.fullName || user?.username)) {
          if (user?.username) {
            const { data: dbUser } = await supabase
              .from('app_users')
              .select('cabang_id')
              .eq('username', user.username)
              .maybeSingle();
            if (dbUser?.cabang_id) {
              const { data: cData } = await supabase
                .from('cabang')
                .select('id, kode_cabang, nama_cabang')
                .eq('id', dbUser.cabang_id)
                .maybeSingle();
              cabangData = cData;
            }
          }

          if (!cabangData && user?.fullName) {
            const { data: staffData } = await supabase
              .from('staff_progress')
              .select('branch')
              .ilike('name', user.fullName)
              .limit(1)
              .maybeSingle();
            
            if (staffData?.branch) {
              const { data: fallbackCabang } = await supabase
                .from('cabang')
                .select('id, kode_cabang, nama_cabang')
                .ilike('nama_cabang', staffData.branch)
                .maybeSingle();
              cabangData = fallbackCabang;
            }
          }
        }

        if (!cabangData) {
          setIsMdisgoActive(false);
          setLoading(false);
          return;
        }

        const { data: mdisgoData } = await supabase
          .from('mdisgo_branches')
          .select('branch_code, branch_name, status')
          .eq('branch_code', cabangData.kode_cabang)
          .single();

        if (!mdisgoData || mdisgoData.status === 'Belum') {
          setIsMdisgoActive(false);
          setLoading(false);
          return;
        }

        targetBranchCode = mdisgoData.branch_code;
        setIsMdisgoActive(true);
        setBranchInfo({ branch_code: mdisgoData.branch_code, branch_name: mdisgoData.branch_name });
      }

      // 3. Fetch existing survey record for targetBranchCode
      const { data: surveyData } = await supabase
        .from('survey_mdisgo')
        .select('*')
        .eq('kode_cabang', targetBranchCode)
        .maybeSingle();

      setSurveyRecord(surveyData || null);

    } catch (err: any) {
      console.error('Error fetching survey data:', err);
      showToast('error', 'Gagal memuat data survey.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Admin Toggle Branch Access ──────────────────────────────────────────
  const toggleBranchAccess = async () => {
    if (!branchInfo?.branch_code) return;
    try {
      setTogglingAccess(true);
      const code = branchInfo.branch_code;
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
      showToast('success', `Akses survey cabang ${branchInfo.branch_name} berhasil ${isCurrentlyDisabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengubah akses cabang.');
    } finally {
      setTogglingAccess(false);
    }
  };

  // ─── Navigate to form ──────────────────────────────────────────────────────
  const handleFillSurvey = () => {
    const code = branchInfo?.branch_code || '';
    navigate(`/mdisgo/survey/form${code ? `?kode_cabang=${code}` : ''}`);
  };

  const handleEditSurvey = () => {
    const code = branchInfo?.branch_code || '';
    navigate(`/mdisgo/survey/form${code ? `?kode_cabang=${code}` : ''}`);
  };

  // ─── Reset Survey (Admin only) ────────────────────────────────────────────
  const [resetting, setResetting] = useState(false);

  const handleResetSurvey = async () => {
    if (!surveyRecord?.id || !branchInfo) return;
    const confirmed = window.confirm(
      `Reset survey cabang ${branchInfo.branch_name}?\n\nSemua jawaban akan dihapus permanen dan status kembali ke "Belum Mengisi".`
    );
    if (!confirmed) return;
    try {
      setResetting(true);
      const { error } = await supabase
        .from('survey_mdisgo')
        .delete()
        .eq('id', surveyRecord.id);
      if (error) throw error;
      setSurveyRecord(null);
      setShowReview(false);
      showToast('success', `Survey cabang ${branchInfo.branch_name} berhasil direset.`);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mereset survey.');
    } finally {
      setResetting(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderSkeletons = () => (
    <div className="survey-skeleton">
      <div className="skeleton-block" style={{ height: 28, width: '40%' }} />
      <div className="skeleton-block" style={{ height: 16, width: '60%' }} />
      <div className="skeleton-block" style={{ height: 200, width: '100%', marginTop: 8 }} />
    </div>
  );

  const renderReviewAnswer = (q: number, answer: string | number | null) => {
    if (q === 3 && answer) {
      let tags: string[] = [];
      try { tags = JSON.parse(answer as string); } catch { tags = [answer as string]; }
      return (
        <div className="q-tags">
          {tags.map((t, i) => <span key={i} className="q-tag">{t}</span>)}
        </div>
      );
    }
    if (q === 4 && answer) {
      const rating = Number(answer);
      return (
        <div className="q-rating-stars">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={`q-star ${n <= rating ? 'active' : 'inactive'}`}>
              {n <= rating ? '★' : '☆'}
            </div>
          ))}
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 6 }}>({rating}/5)</span>
        </div>
      );
    }
    if (!answer) return <span className="q-answer empty">Belum diisi</span>;
    return <span className="q-answer">{answer as string}</span>;
  };

  const renderReview = () => {
    if (!surveyRecord) return null;
    const answers = [
      surveyRecord.question_1,
      surveyRecord.question_2,
      surveyRecord.question_3,
      surveyRecord.question_4,
      surveyRecord.question_5,
      surveyRecord.question_6,
      surveyRecord.question_7,
      surveyRecord.question_8,
      surveyRecord.question_9,
      surveyRecord.question_10,
    ];
    return (
      <div className="survey-review-container">
        <div className="survey-review-header">
          <h2>Detail Jawaban Survey — {branchInfo?.branch_name}</h2>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => setShowReview(false)}>
            Tutup Detail
          </button>
        </div>
        {questionLabels.map((label, i) => (
          <div key={i} className="survey-review-card">
            <span className="q-label">Pertanyaan {i + 1}</span>
            <span className="q-text">{label}</span>
            {renderReviewAnswer(i + 1, answers[i])}
          </div>
        ))}
      </div>
    );
  };

  // ─── Period display ────────────────────────────────────────────────────────
  const renderPeriodBanner = () => {
    if (!period) return null;
    const open = isPeriodOpen();
    return (
      <div className={`survey-period-banner ${open ? 'open' : 'closed'}`}>
        <Clock size={13} />
        <span>
          Periode Survey: <strong>{new Date(period.start).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          {' '}&ndash;{' '}
          <strong>{new Date(period.end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          {!open && !isAdmin && ' — '}
          {!open && !isAdmin && <strong style={{ marginLeft: 4 }}>Periode Sudah Ditutup</strong>}
          {isAdmin && <span style={{ marginLeft: 6, opacity: 0.8 }}>(Akses Admin Buka)</span>}
        </span>
      </div>
    );
  };

  // Check branch disabled status
  const isCurrentBranchDisabled = branchInfo ? disabledBranches.includes(branchInfo.branch_code) : false;

  // ─── Main Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="survey-mdisgo-container">
        <div className="survey-header">
          <div className="survey-header-left">
            <h1>Survey MDISGO</h1>
            <p>Evaluasi implementasi MDISGO cabang</p>
          </div>
        </div>
        {renderSkeletons()}
      </div>
    );
  }

  return (
    <div className="survey-mdisgo-container">
      {/* Toast */}
      {toast.text && (
        <div className={`survey-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="survey-header">
        <div className="survey-header-left">
          <h1>Survey MDISGO</h1>
          <p>Evaluasi implementasi dan penggunaan MDISGO di cabang Anda.</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-outline"
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}
              onClick={() => navigate('/mdisgo/survey/rekap')}
            >
              <Settings size={13} /> Buka Dashboard Rekap Admin
            </button>
          </div>
        )}
      </div>

      {/* Admin Branch Selector & Access Control Bar */}
      {isAdmin && allBranches.length > 0 && (
        <div className="survey-admin-control-bar">
          <div className="survey-admin-control-group">
            <Building2 size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Simulasi Cabang:</span>
            <select
              className="survey-admin-select"
              value={selectedAdminBranch}
              onChange={e => { setSelectedAdminBranch(e.target.value); setShowReview(false); }}
            >
              {allBranches.map(b => (
                <option key={b.branch_code} value={b.branch_code}>
                  {b.branch_name} ({b.branch_code})
                </option>
              ))}
            </select>
          </div>

          <div className="survey-admin-control-group">
            <button
              className={`survey-admin-toggle-btn ${isCurrentBranchDisabled ? 'disabled' : 'enabled'}`}
              onClick={toggleBranchAccess}
              disabled={togglingAccess}
            >
              {isCurrentBranchDisabled ? <ToggleLeft size={16} color="#EF4444" /> : <ToggleRight size={16} color="#10B981" />}
              {isCurrentBranchDisabled ? 'Akses Ditutup (Klik Aktifkan)' : 'Akses Aktif (Klik Non-aktifkan)'}
            </button>
          </div>
        </div>
      )}

      {/* Period Banner */}
      {renderPeriodBanner()}

      {/* === Cabang Tidak Aktif MDisgo === */}
      {isMdisgoActive === false && (
        <div className="survey-inactive-banner">
          <div className="survey-inactive-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="survey-inactive-text">
            <h3>Survey Belum Tersedia</h3>
            <p>
              Cabang Anda belum termasuk dalam implementasi MDisgo sehingga
              survey belum tersedia. Hubungi administrator regional untuk informasi lebih lanjut.
            </p>
          </div>
        </div>
      )}

      {/* === Cabang Disabled by Admin (for non-admin users) === */}
      {isMdisgoActive === true && isCurrentBranchDisabled && !isAdmin && (
        <div className="survey-inactive-banner">
          <div className="survey-inactive-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="survey-inactive-text">
            <h3>Akses Survey Non-Aktif</h3>
            <p>
              Akses pengisian survey MDISGO untuk cabang Anda saat ini ditutup oleh Administrator.
            </p>
          </div>
        </div>
      )}

      {/* === Cabang Aktif MDisgo & Allowed === */}
      {isMdisgoActive === true && (!isCurrentBranchDisabled || isAdmin) && (
        <>
          {/* Info chips */}
          {branchInfo && (
            <div className="survey-info-bar">
              <div className="survey-info-chip">
                <Building2 size={13} />
                Cabang: <strong>{branchInfo.branch_name}</strong>
                &nbsp;({branchInfo.branch_code})
              </div>
              <div className="survey-info-chip">
                <User size={13} />
                MSA: <strong>{surveyRecord?.msa || user?.fullName || '-'}</strong>
              </div>
            </div>
          )}

          {/* === Belum pernah mengisi === */}
          {!surveyRecord && (
            <div className="survey-status-card not-filled">
              <div className="survey-status-icon pending">
                <ClipboardList size={34} />
              </div>
              <h2>Belum Ada Survey</h2>
              <p>
                {isAdmin
                  ? `Belum ada survey diinput untuk cabang ${branchInfo?.branch_name}. Anda dapat melakukan simulasi pengisian survey.`
                  : 'Anda belum mengisi survey MDISGO. Silakan isi survey untuk memberikan evaluasi implementasi MDISGO di cabang Anda.'}
              </p>
              <button
                className="btn-fill-survey"
                onClick={handleFillSurvey}
                disabled={!isPeriodOpen() && !isAdmin}
              >
                <ClipboardList size={18} />
                {isAdmin ? 'Simulasi / Input Survey' : 'Isi Survey Sekarang'}
              </button>
              {!isPeriodOpen() && !isAdmin && (
                <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 0 }}>
                  Periode survey sudah ditutup.
                </p>
              )}
            </div>
          )}

          {/* === Sudah mengisi === */}
          {surveyRecord && !showReview && (
            <div className="survey-status-card">
              <div className="survey-status-icon success">
                <CheckCircle2 size={34} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2>Survey Telah Diisi</h2>
                {surveyRecord.status_submit === 'submitted' ? (
                  <span className="survey-badge-submitted">
                    <CheckCircle2 size={11} /> Submitted
                  </span>
                ) : (
                  <span className="survey-badge-draft">
                    <Clock size={11} /> Draft
                  </span>
                )}
              </div>

              <div className="survey-status-dates">
                <div className="survey-date-row">
                  <span className="label"><CalendarDays size={12} />Tanggal Input</span>
                  <span className="value">{formatDate(surveyRecord.tanggal_input)}</span>
                </div>
                <div className="survey-date-row">
                  <span className="label"><Clock size={12} />Update Terakhir</span>
                  <span className="value">{formatDate(surveyRecord.tanggal_update)}</span>
                </div>
                {surveyRecord.question_1 && (
                  <div className="survey-date-row">
                    <span className="label"><Star size={12} />Tingkat Implementasi</span>
                    <span className="value">{surveyRecord.question_1}</span>
                  </div>
                )}
                {surveyRecord.created_by && (
                  <div className="survey-date-row">
                    <span className="label"><User size={12} />Diisi Oleh</span>
                    <span className="value">{surveyRecord.created_by}</span>
                  </div>
                )}
              </div>

              <div className="survey-status-actions">
                <button className="btn-survey-view" onClick={() => setShowReview(true)}>
                  <Eye size={14} />
                  Lihat Survey
                </button>
                <button
                  className="btn-survey-edit"
                  onClick={handleEditSurvey}
                  disabled={!isPeriodOpen() && !isAdmin}
                  title={!isPeriodOpen() && !isAdmin ? 'Periode survey sudah ditutup' : 'Edit survey'}
                >
                  <Edit2 size={14} />
                  {isAdmin ? 'Edit Survey (Admin)' : 'Edit Survey'}
                </button>
                {/* Reset hanya untuk Admin */}
                {isAdmin && (
                  <button
                    className="btn-survey-reset"
                    onClick={handleResetSurvey}
                    disabled={resetting}
                    title={`Reset/hapus survey cabang ${branchInfo?.branch_name}`}
                  >
                    <Trash2 size={14} />
                    {resetting ? 'Mereset...' : 'Reset Survey'}
                  </button>
                )}
              </div>
              {!isPeriodOpen() && !isAdmin && (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Periode survey sudah ditutup. Survey tidak dapat diedit.
                </p>
              )}
            </div>
          )}

          {/* Review detail */}
          {surveyRecord && showReview && renderReview()}
        </>
      )}
    </div>
  );
};

export default SurveyMdisgo;
