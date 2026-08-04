import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Save, Send, X,
  CheckCircle2, AlertTriangle, Loader2, Star, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SurveyMdisgoForm.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_QUESTION_LABELS = [
  'Bagaimana tingkat implementasi MDisgo di cabang Anda?',
  'Apakah MDisgo membantu anggota dalam melihat informasi simpanan dan pinjaman?',
  'Kendala apa yang paling sering dialami anggota? (Pilih semua yang sesuai)',
  'Menurut Anda apakah staff lapang sudah mampu melakukan edukasi penggunaan MDisgo kepada anggota?',
  'Fitur apa yang paling sering digunakan anggota?',
  'Kendala apa yang paling sering disampaikan staff lapang kepada MSA?',
  'Apa penyebab utama anggota belum menggunakan MDisgo secara aktif?',
  'Fitur apa yang paling perlu dikembangkan?',
  'Apa prioritas perbaikan MDisgo menurut Anda?',
  'Saran dan masukan untuk pengembangan MDisgo.',
];

const Q1_OPTIONS = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Sangat Kurang'];
const Q2_OPTIONS = ['Sangat Membantu', 'Membantu', 'Cukup', 'Kurang', 'Tidak Membantu'];
const Q3_OPTIONS = [
  'Registrasi', 'Login', 'Verifikasi Foto', 'Lupa Password',
  'Penarikan Simpanan', 'Informasi Saldo', 'Aplikasi Lambat', 'Tidak Ada Kendala', 'Lainnya',
];

interface FormState {
  question_1: string;
  question_2: string;
  question_3: string[];
  question_4: number | null;
  question_5: string;
  question_6: string;
  question_7: string;
  question_8: string;
  question_9: string;
  question_10: string;
}

const EMPTY_FORM: FormState = {
  question_1: '',
  question_2: '',
  question_3: [],
  question_4: null,
  question_5: '',
  question_6: '',
  question_7: '',
  question_8: '',
  question_9: '',
  question_10: '',
};

interface BranchOption {
  branch_code: string;
  branch_name: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────
const SurveyMdisgoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlKodeCabang = searchParams.get('kode_cabang');

  // Session
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  // State
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed (0..9)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [branchCode, setBranchCode] = useState(urlKodeCabang || '');
  const [branchName, setBranchName] = useState('');
  const [allActiveBranches, setAllActiveBranches] = useState<BranchOption[]>([]);
  const [questionLabels, setQuestionLabels] = useState<string[]>(DEFAULT_QUESTION_LABELS);
  const [isFirstCreate, setIsFirstCreate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [isPeriodOpen, setIsPeriodOpen] = useState(true);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TOTAL_STEPS = 10;

  const showToast = (type: string, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 3500);
  };

  // ─── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    fetchInitialData();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [branchCode]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // 1. Fetch period and dynamic questions
      const { data: periodData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['survey_mdisgo_period_start', 'survey_mdisgo_period_end', 'survey_mdisgo_questions']);

      if (periodData && periodData.length > 0) {
        const startSetting = periodData.find((p: any) => p.key === 'survey_mdisgo_period_start');
        const endSetting = periodData.find((p: any) => p.key === 'survey_mdisgo_period_end');
        
        if (isAdmin) {
          setIsPeriodOpen(true); // Admin is never blocked by period
        } else if (startSetting && endSetting) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          setIsPeriodOpen(todayStr >= startSetting.value && todayStr <= endSetting.value);
        }

        const qSetting = periodData.find((p: any) => p.key === 'survey_mdisgo_questions');
        if (qSetting?.value) {
          try {
            const parsed = JSON.parse(qSetting.value);
            if (Array.isArray(parsed) && parsed.length === 10) {
              setQuestionLabels(parsed);
            }
          } catch (e) {}
        }
      }

      // 2. Fetch all active mdisgo branches if Admin
      if (isAdmin) {
        const { data: bList } = await supabase
          .from('mdisgo_branches')
          .select('branch_code, branch_name')
          .neq('status', 'Belum')
          .order('branch_name');
        setAllActiveBranches(bList || []);
      }

      // 3. Resolve target branch_code
      let targetBranchCode = branchCode;

      if (!targetBranchCode) {
        if (isAdmin) {
          // If Admin and no branch parameter, default to first active branch if available
          const { data: bFirst } = await supabase
            .from('mdisgo_branches')
            .select('branch_code, branch_name')
            .neq('status', 'Belum')
            .order('branch_name')
            .limit(1)
            .maybeSingle();

          if (bFirst) {
            targetBranchCode = bFirst.branch_code;
          } else {
            navigate('/mdisgo/survey/rekap', { replace: true });
            return;
          }
        } else {
          // Non-admin user: get branch from user's cabang_id
          let cabangData: { kode_cabang: string; nama_cabang: string } | null = null;

          if (user?.cabang_id) {
            const { data } = await supabase
              .from('cabang')
              .select('kode_cabang, nama_cabang')
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
                  .select('kode_cabang, nama_cabang')
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
                  .select('kode_cabang, nama_cabang')
                  .ilike('nama_cabang', staffData.branch)
                  .maybeSingle();
                cabangData = fallbackCabang;
              }
            }
          }

          if (!cabangData) {
            navigate('/mdisgo/survey', { replace: true });
            return;
          }
          targetBranchCode = cabangData.kode_cabang;
        }
      }

      // 4. Verify branch is active in MDisgo
      const { data: mdisgoData } = await supabase
        .from('mdisgo_branches')
        .select('branch_code, branch_name, status')
        .eq('branch_code', targetBranchCode)
        .single();

      if (!mdisgoData || (mdisgoData.status === 'Belum' && !isAdmin)) {
        navigate('/mdisgo/survey', { replace: true });
        return;
      }

      setBranchCode(mdisgoData.branch_code);
      setBranchName(mdisgoData.branch_name);

      // 5. Load existing survey for targetBranchCode
      const { data: surveyData } = await supabase
        .from('survey_mdisgo')
        .select('*')
        .eq('kode_cabang', mdisgoData.branch_code)
        .maybeSingle();

      if (surveyData) {
        setExistingId(surveyData.id);
        setIsFirstCreate(false);
        setFormData({
          question_1: surveyData.question_1 || '',
          question_2: surveyData.question_2 || '',
          question_3: surveyData.question_3 ? JSON.parse(surveyData.question_3) : [],
          question_4: surveyData.question_4 ?? null,
          question_5: surveyData.question_5 || '',
          question_6: surveyData.question_6 || '',
          question_7: surveyData.question_7 || '',
          question_8: surveyData.question_8 || '',
          question_9: surveyData.question_9 || '',
          question_10: surveyData.question_10 || '',
        });
      } else {
        setExistingId(null);
        setIsFirstCreate(true);
        setFormData(EMPTY_FORM);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Build payload ────────────────────────────────────────────────────────
  const buildPayload = (isSubmit: boolean, firstCreate: boolean) => {
    const now = new Date().toISOString();
    const base: any = {
      kode_cabang: branchCode,
      nama_cabang: branchName,
      msa: user?.fullName || 'Admin',
      question_1: formData.question_1 || null,
      question_2: formData.question_2 || null,
      question_3: formData.question_3.length > 0 ? JSON.stringify(formData.question_3) : null,
      question_4: formData.question_4 ?? null,
      question_5: formData.question_5 || null,
      question_6: formData.question_6 || null,
      question_7: formData.question_7 || null,
      question_8: formData.question_8 || null,
      question_9: formData.question_9 || null,
      question_10: formData.question_10 || null,
      tanggal_update: now,
      updated_at: now,
      updated_by: user?.fullName || user?.username || 'Admin',
      status_submit: isSubmit ? 'submitted' : 'draft',
    };
    if (firstCreate) {
      base.tanggal_input = now;
      base.created_by = user?.fullName || user?.username || 'Admin';
    }
    return base;
  };

  // ─── Save Draft ───────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (silent = false) => {
    if (!branchCode) return;
    try {
      if (!silent) setSaving(true);
      const payload = buildPayload(false, isFirstCreate);

      if (existingId) {
        await supabase.from('survey_mdisgo').update(payload).eq('id', existingId);
      } else {
        const { data, error } = await supabase.from('survey_mdisgo').upsert(payload, {
          onConflict: 'kode_cabang',
        }).select().single();
        if (error) throw error;
        if (data) {
          setExistingId(data.id);
          setIsFirstCreate(false);
        }
      }

      if (!silent) showToast('success', 'Draft berhasil disimpan.');
    } catch (err: any) {
      if (!silent) showToast('error', err.message || 'Gagal menyimpan draft.');
    } finally {
      if (!silent) setSaving(false);
    }
  }, [branchCode, existingId, isFirstCreate, formData]);

  // ─── Autosave on form change ──────────────────────────────────────────────
  useEffect(() => {
    if (!branchCode || loading) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveDraft(true); // silent autosave
    }, 30000); // 30 seconds
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [formData, branchCode, loading]);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!formData.question_1) missing.push('Pertanyaan 1');
    if (!formData.question_2) missing.push('Pertanyaan 2');
    if (formData.question_3.length === 0) missing.push('Pertanyaan 3');
    if (!formData.question_4) missing.push('Pertanyaan 4');

    if (missing.length > 0) {
      showToast('error', `Harap isi: ${missing.join(', ')}`);
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload(true, isFirstCreate);

      if (existingId) {
        await supabase.from('survey_mdisgo').update(payload).eq('id', existingId);
      } else {
        await supabase.from('survey_mdisgo').upsert(payload, { onConflict: 'kode_cabang' });
      }

      showToast('success', 'Survey berhasil disubmit!');
      setTimeout(() => {
        if (isAdmin) {
          navigate('/mdisgo/survey/rekap');
        } else {
          navigate('/mdisgo/survey');
        }
      }, 1200);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal submit survey.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (window.confirm('Batalkan pengisian survey? Perubahan yang belum disimpan akan hilang.')) {
      if (isAdmin) {
        navigate('/mdisgo/survey/rekap');
      } else {
        navigate('/mdisgo/survey');
      }
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────
  const goNext = () => { if (currentStep < TOTAL_STEPS - 1) setCurrentStep(s => s + 1); };
  const goPrev = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  // ─── Form field helpers ───────────────────────────────────────────────────
  const setRadio = (key: keyof FormState, val: string) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const toggleMulti = (val: string) => {
    setFormData(prev => {
      const arr = prev.question_3;
      const exists = arr.includes(val);
      return { ...prev, question_3: exists ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  const setText = (key: keyof FormState, val: string) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const setRating = (val: number) => {
    setFormData(prev => ({ ...prev, question_4: val }));
  };

  // ─── Progress ─────────────────────────────────────────────────────────────
  const progressPct = Math.round(((currentStep + 1) / TOTAL_STEPS) * 100);

  // ─── Render each question card ────────────────────────────────────────────
  const renderQuestion = () => {
    const step = currentStep;

    if (step === 0) return (
      <div className="sf-question-body">
        <div className="sf-radio-group">
          {Q1_OPTIONS.map(opt => (
            <label key={opt} className={`sf-radio-card ${formData.question_1 === opt ? 'selected' : ''}`}>
              <input type="radio" name="q1" value={opt} checked={formData.question_1 === opt}
                onChange={() => setRadio('question_1', opt)} />
              <span className="sf-radio-dot" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );

    if (step === 1) return (
      <div className="sf-question-body">
        <div className="sf-radio-group">
          {Q2_OPTIONS.map(opt => (
            <label key={opt} className={`sf-radio-card ${formData.question_2 === opt ? 'selected' : ''}`}>
              <input type="radio" name="q2" value={opt} checked={formData.question_2 === opt}
                onChange={() => setRadio('question_2', opt)} />
              <span className="sf-radio-dot" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );

    if (step === 2) return (
      <div className="sf-question-body">
        <p className="sf-hint">Pilih satu atau lebih opsi</p>
        <div className="sf-checkbox-group">
          {Q3_OPTIONS.map(opt => (
            <label key={opt} className={`sf-check-card ${formData.question_3.includes(opt) ? 'selected' : ''}`}>
              <input type="checkbox" value={opt} checked={formData.question_3.includes(opt)}
                onChange={() => toggleMulti(opt)} />
              <span className="sf-check-box" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {formData.question_3.length > 0 && (
          <div className="sf-selected-tags">
            {formData.question_3.map(t => (
              <span key={t} className="sf-tag">
                {t}
                <button onClick={() => toggleMulti(t)}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    );

    if (step === 3) return (
      <div className="sf-question-body">
        <p className="sf-hint">Pilih angka 1 (Tidak Mampu) hingga 5 (Sangat Mampu)</p>
        <div className="sf-rating-row">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={`sf-rating-btn ${formData.question_4 === n ? 'active' : ''}`}
              onClick={() => setRating(n)}
            >
              <Star size={20} className={formData.question_4 !== null && n <= formData.question_4 ? 'filled' : ''} />
              <span>{n}</span>
            </button>
          ))}
        </div>
        <div className="sf-rating-labels">
          <span>Tidak Mampu</span>
          <span>Sangat Mampu</span>
        </div>
        {formData.question_4 && (
          <div className="sf-rating-display">
            Pilihan Anda: <strong>{formData.question_4}/5</strong>
          </div>
        )}
      </div>
    );

    if (step === 4) return (
      <div className="sf-question-body">
        <input
          type="text"
          className="sf-text-input"
          placeholder="Contoh: Cek Saldo, Histori Transaksi, dll."
          value={formData.question_5}
          onChange={e => setText('question_5', e.target.value)}
          maxLength={200}
        />
        <span className="sf-char-count">{formData.question_5.length}/200</span>
      </div>
    );

    const textareaSteps: { step: number; key: keyof FormState; placeholder: string }[] = [
      { step: 5, key: 'question_6', placeholder: 'Jelaskan kendala yang sering disampaikan staff lapang...' },
      { step: 6, key: 'question_7', placeholder: 'Jelaskan penyebab anggota belum menggunakan MDisgo secara aktif...' },
      { step: 7, key: 'question_8', placeholder: 'Sebutkan fitur yang menurut Anda perlu dikembangkan...' },
      { step: 8, key: 'question_9', placeholder: 'Sebutkan prioritas perbaikan yang paling penting...' },
      { step: 9, key: 'question_10', placeholder: 'Tuliskan saran dan masukan Anda untuk pengembangan MDisgo...' },
    ];

    const ta = textareaSteps.find(t => t.step === step);
    if (ta) {
      const val = formData[ta.key] as string;
      return (
        <div className="sf-question-body">
          <textarea
            className="sf-textarea"
            placeholder={ta.placeholder}
            value={val}
            onChange={e => setText(ta.key, e.target.value)}
            rows={6}
            maxLength={1000}
          />
          <span className="sf-char-count">{val.length}/1000</span>
        </div>
      );
    }

    return null;
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="sf-container">
      <div className="sf-loading">
        <Loader2 size={28} className="sf-spinner" />
        <span>Memuat data survey...</span>
      </div>
    </div>
  );

  if (!isPeriodOpen && !isAdmin) return (
    <div className="sf-container">
      <div className="sf-period-closed">
        <AlertTriangle size={36} color="var(--color-warning)" />
        <h2>Periode Survey Sudah Ditutup</h2>
        <p>Survey tidak dapat diisi atau diedit di luar periode yang ditentukan.</p>
        <button className="btn btn-outline" onClick={() => navigate('/mdisgo/survey')}>
          <ChevronLeft size={14} /> Kembali
        </button>
      </div>
    </div>
  );

  return (
    <div className="sf-container">
      {/* Toast */}
      {toast.text && (
        <div className={`sf-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="sf-header">
        <div>
          <h1>Form Survey MDISGO</h1>
          {isAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Building2 size={14} className="text-muted" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Cabang Target:</span>
              <select
                style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, border: '1px solid var(--color-border)' }}
                value={branchCode}
                onChange={e => setBranchCode(e.target.value)}
              >
                {allActiveBranches.map(b => (
                  <option key={b.branch_code} value={b.branch_code}>
                    {b.branch_name} ({b.branch_code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p>{branchName} ({branchCode}) — MSA: {user?.fullName}</p>
          )}
        </div>
        <div className="sf-header-actions">
          <button className="sf-btn-draft" onClick={() => saveDraft(false)} disabled={saving}>
            {saving ? <Loader2 size={13} className="sf-spinner-sm" /> : <Save size={13} />}
            Simpan Draft
          </button>
          <button className="sf-btn-cancel" onClick={handleCancel}>
            <X size={13} /> Batal
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="sf-progress-wrapper">
        <div className="sf-progress-info">
          <span>Pertanyaan {currentStep + 1} dari {TOTAL_STEPS}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="sf-progress-bar">
          <div className="sf-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="sf-step-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <button
              key={i}
              className={`sf-dot ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}
              onClick={() => setCurrentStep(i)}
              title={`Pertanyaan ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Question Card */}
      <div className="sf-card" key={currentStep}>
        <div className="sf-question-header">
          <div className="sf-question-number">
            <span>{currentStep + 1}</span>
          </div>
          <h2 className="sf-question-text">{questionLabels[currentStep] || DEFAULT_QUESTION_LABELS[currentStep]}</h2>
        </div>
        {renderQuestion()}
      </div>

      {/* Navigation */}
      <div className="sf-nav-row">
        <button className="sf-btn-nav" onClick={goPrev} disabled={currentStep === 0}>
          <ChevronLeft size={16} /> Sebelumnya
        </button>

        <div className="sf-nav-center">
          {currentStep < TOTAL_STEPS - 1 && (
            <button className="sf-btn-next" onClick={goNext}>
              Selanjutnya <ChevronRight size={16} />
            </button>
          )}
          {currentStep === TOTAL_STEPS - 1 && (
            <button className="sf-btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="sf-spinner-sm" /> : <Send size={14} />}
              Submit Survey
            </button>
          )}
        </div>
      </div>

      {/* Autosave indicator */}
      <div className="sf-autosave-note">
        <Save size={11} /> Draft disimpan otomatis setiap 30 detik
      </div>
    </div>
  );
};

export default SurveyMdisgoForm;
