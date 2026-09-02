import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, Users, Plus, Trash2,
  X, Loader2, CheckCircle2, GraduationCap, Save, Clock, Target, Download,
  ClipboardPaste
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './MdisgoMonitoring.css';

interface MdisgoBranch {
  id: string;
  branch_code: string;
  branch_name: string;
  training_date: string | null;
  members_accessed: number;
  total_members: number;
  total_center: number;
  accessed_center: number;
  locked_center: number;
  status: string;
}

// ── Column config for inline editing ─────────────────────────────────────────
// Order here = Tab-order AND paste-from-Excel column order
const EDITABLE_FIELDS: Array<{
  field: keyof MdisgoBranch;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
}> = [
  { field: 'branch_code',      type: 'text'   },
  { field: 'branch_name',      type: 'text'   },
  { field: 'status',           type: 'select', options: ['Belum', 'Active', 'Completed'] },
  { field: 'training_date',    type: 'date'   },
  { field: 'total_members',    type: 'number' },
  { field: 'members_accessed', type: 'number' },
  { field: 'locked_center',    type: 'number' },
  { field: 'accessed_center',  type: 'number' },
  { field: 'total_center',     type: 'number' },
];

// ── Inline Editable Cell ──────────────────────────────────────────────────────
interface EditableCellProps {
  rowId: string;
  field: keyof MdisgoBranch;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  rawValue: string;
  displayValue: React.ReactNode;
  isEditing: boolean;
  isSaving: boolean;
  isAdmin: boolean;
  editingValue: string;
  inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
  onDoubleClick: (rowId: string, field: keyof MdisgoBranch, v: string) => void;
  onSave: (rowId: string, field: keyof MdisgoBranch, v: string) => void;
  onKeyDown: (e: React.KeyboardEvent, rowId: string, field: keyof MdisgoBranch) => void;
  onEditingValueChange: (v: string) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
  rowId, field, type, options, rawValue, displayValue,
  isEditing, isSaving, isAdmin,
  editingValue, inputRef,
  onDoubleClick, onSave, onKeyDown, onEditingValueChange,
}) => {
  if (!isAdmin) return <>{displayValue}</>;

  if (isEditing) {
    const commonProps = {
      className: type === 'select' ? 'mdisgo-inline-select' : 'mdisgo-inline-input',
      autoFocus: true,
      onBlur: () => onSave(rowId, field, editingValue),
      onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, rowId, field),
    };

    if (type === 'select') {
      return (
        <select
          {...commonProps}
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
        >
          {options!.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    return (
      <input
        {...commonProps}
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={editingValue}
        min={type === 'number' ? 0 : undefined}
        onChange={(e) => onEditingValueChange(e.target.value)}
      />
    );
  }

  return (
    <span
      className={`mdisgo-cell-editable${isSaving ? ' mdisgo-cell-saving' : ''}`}
      onDoubleClick={() => onDoubleClick(rowId, field, rawValue)}
      title="Klik 2x untuk edit"
    >
      {isSaving
        ? <Loader2 size={10} className="animate-spin" style={{ opacity: 0.5, display: 'inline-block' }} />
        : displayValue
      }
    </span>
  );
};


// ── Main Component ────────────────────────────────────────────────────────────
const MdisgoMonitoring = () => {
  const [data, setData] = useState<MdisgoBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Last updated info
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState('');
  const [_savingInfo, setSavingInfo] = useState(false);

  // ── Inline edit state ───────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof MdisgoBranch } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // ── Add Modal state ─────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    branch_code: '', branch_name: '', training_date: '',
    members_accessed: 0, total_members: 0, total_center: 0,
    accessed_center: 0, locked_center: 0, status: 'Belum'
  });
  const [saving, setSaving] = useState(false);

  // Check admin role
  const sessionData = sessionStorage.getItem('msa_session');
  const user = sessionData ? JSON.parse(sessionData) : null;
  const isAdmin = user?.role?.toLowerCase().includes('admin');

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Auto-focus the input whenever editingCell changes
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }
  }, [editingCell]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: branches, error } = await supabase
        .from('mdisgo_branches')
        .select('*')
        .order('members_accessed', { ascending: false });
      if (error) throw error;
      setData(branches || []);

      try {
        const { data: settingData, error: settingError } = await supabase
          .from('app_settings').select('value').eq('key', 'mdisgo_last_updated').single();
        if (!settingError && settingData) setLastUpdatedInfo(settingData.value);
      } catch {
        console.warn('Could not fetch app_settings.');
      }
    } catch (err) {
      console.error('Error fetching MDISGO data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalBranches = data.length;
  const trainedBranches = data.filter(b => b.status !== 'Belum').length;
  const totalMembers = data.reduce((acc, curr) => acc + (curr.members_accessed || 0), 0);
  const targetReachedBranches = data.filter(b =>
    b.total_members && b.status !== 'Belum' && ((b.members_accessed / b.total_members) * 100) >= 20
  ).length;
  const lockedCenterBranches = data.filter(b =>
    b.total_center && b.status !== 'Belum' && (((b.locked_center || 0) / b.total_center) * 100) >= 10
  ).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ── Filtered & sorted data ───────────────────────────────────────────────
  const filteredData = data
    .filter(b =>
      b.branch_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branch_code.includes(searchQuery)
    )
    .sort((a, b) => b.members_accessed - a.members_accessed || a.branch_name.localeCompare(b.branch_name, 'id'));

  // ── Inline Edit Handlers ─────────────────────────────────────────────────

  const handleCellDoubleClick = useCallback((rowId: string, field: keyof MdisgoBranch, currentValue: string) => {
    if (!isAdmin) return;
    setEditingCell({ rowId, field });
    setEditingValue(currentValue);
    setSelectedRowId(rowId);
    setPasteHint(false);
  }, [isAdmin]);

  const handleCellSave = useCallback(async (rowId: string, field: keyof MdisgoBranch, value: string) => {
    setEditingCell(null);
    const branch = data.find(b => b.id === rowId);
    if (!branch) return;

    const fieldConfig = EDITABLE_FIELDS.find(f => f.field === field);
    let parsedValue: string | number | null = value;
    if (fieldConfig?.type === 'number') parsedValue = parseInt(value) || 0;
    else if (fieldConfig?.type === 'date') parsedValue = value || null;

    if (String(branch[field] ?? '') === String(parsedValue ?? '')) return;

    // Optimistic update
    setData(prev => prev.map(b => b.id === rowId ? { ...b, [field]: parsedValue } : b));
    const cellKey = `${rowId}:${field}`;
    setSavingCells(prev => new Set(prev).add(cellKey));

    try {
      const { error } = await supabase
        .from('mdisgo_branches').update({ [field]: parsedValue }).eq('id', rowId);
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Tersimpan' });
    } catch (err: any) {
      // Revert
      setData(prev => prev.map(b => b.id === rowId ? { ...b, [field]: branch[field] } : b));
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan.' });
    } finally {
      setSavingCells(prev => { const n = new Set(prev); n.delete(cellKey); return n; });
    }
  }, [data]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, field: keyof MdisgoBranch) => {
    const fieldIdx = EDITABLE_FIELDS.findIndex(f => f.field === field);
    const rowIdx = filteredData.findIndex(b => b.id === rowId);

    const navigateTo = (nextRowIdx: number, nextFieldIdx: number) => {
      const nr = filteredData[nextRowIdx];
      const nf = EDITABLE_FIELDS[nextFieldIdx];
      if (!nr || !nf) return;
      setTimeout(() => {
        setEditingCell({ rowId: nr.id, field: nf.field });
        setEditingValue(String(nr[nf.field] ?? ''));
        setSelectedRowId(nr.id);
      }, 30);
    };

    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      handleCellSave(rowId, field, editingValue);
      const nextFieldIdx = (fieldIdx + 1) % EDITABLE_FIELDS.length;
      const nextRowIdx = nextFieldIdx === 0 ? rowIdx + 1 : rowIdx;
      navigateTo(nextRowIdx, nextFieldIdx);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      handleCellSave(rowId, field, editingValue);
      const prevFieldIdx = fieldIdx === 0 ? EDITABLE_FIELDS.length - 1 : fieldIdx - 1;
      const prevRowIdx = fieldIdx === 0 ? rowIdx - 1 : rowIdx;
      navigateTo(prevRowIdx, prevFieldIdx);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleCellSave(rowId, field, editingValue);
      navigateTo(rowIdx + 1, fieldIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleCellSave(rowId, field, editingValue);
      navigateTo(rowIdx - 1, fieldIdx);
    }
  }, [editingValue, filteredData, handleCellSave]);

  // ── Paste from Excel (Ctrl+V on row) ─────────────────────────────────────
  const handleRowPaste = useCallback(async (e: React.ClipboardEvent, startRowId: string) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    
    e.preventDefault();
    if (!isAdmin) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;

    const rows = text.trim().split('\n').map(r => r.split('\t'));
    const startIdx = filteredData.findIndex(b => b.id === startRowId);
    if (startIdx === -1) return;

    setMessage({ type: 'success', text: `📋 Menerapkan ${rows.length} baris dari clipboard...` });

    const updates: Array<{ id: string; payload: Partial<MdisgoBranch> }> = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const targetBranch = filteredData[startIdx + ri];
      if (!targetBranch) break;
      const cells = rows[ri];
      const payload: Partial<MdisgoBranch> = {};

      for (let ci = 0; ci < EDITABLE_FIELDS.length && ci < cells.length; ci++) {
        const { field, type } = EDITABLE_FIELDS[ci];
        let val: string | number | null = cells[ci]?.trim() ?? '';
        if (type === 'number') {
          val = parseInt(String(val).replace(/\./g, '').replace(/,/g, '')) || 0;
        } else if (type === 'date') {
          if (val) {
            const parts = String(val).split(/[\/\-]/);
            if (parts.length === 3) {
              // DD/MM/YYYY → YYYY-MM-DD
              val = parts[0].length === 4
                ? String(val)
                : `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
          } else { val = null; }
        }
        (payload as any)[field] = val;
      }
      updates.push({ id: targetBranch.id, payload });
    }

    // Optimistic update
    setData(prev => prev.map(b => {
      const upd = updates.find(u => u.id === b.id);
      return upd ? { ...b, ...upd.payload } : b;
    }));

    try {
      await Promise.all(updates.map(({ id, payload }) =>
        supabase.from('mdisgo_branches').update(payload).eq('id', id)
      ));
      setMessage({ type: 'success', text: `✓ ${updates.length} baris berhasil dipaste & disimpan.` });
    } catch (err: any) {
      fetchData();
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan hasil paste.' });
    }
  }, [isAdmin, filteredData]);

  // ── Add New Branch ────────────────────────────────────────────────────────
  const handleSaveNew = async () => {
    if (!formData.branch_name || !formData.branch_code) {
      setMessage({ type: 'error', text: 'Kode dan nama cabang wajib diisi.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('mdisgo_branches').insert({
        branch_code: formData.branch_code,
        branch_name: formData.branch_name,
        training_date: formData.training_date || null,
        members_accessed: formData.members_accessed,
        total_members: formData.total_members,
        total_center: formData.total_center,
        accessed_center: formData.accessed_center,
        locked_center: formData.locked_center,
        status: formData.status
      });
      if (error) throw error;
      setMessage({ type: 'success', text: `Cabang "${formData.branch_name}" berhasil ditambahkan.` });
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menambah data.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (item: MdisgoBranch) => {
    if (!window.confirm(`Hapus data cabang "${item.branch_name}"?`)) return;
    try {
      const { error } = await supabase.from('mdisgo_branches').delete().eq('id', item.id);
      if (error) throw error;
      setMessage({ type: 'success', text: `"${item.branch_name}" berhasil dihapus.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus data.' });
    }
  };

  // ── Update Date ───────────────────────────────────────────────────────────
  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    setSavingInfo(true);
    try {
      const { error } = await supabase.from('app_settings')
        .upsert({ key: 'mdisgo_last_updated', value: newDate, updated_at: new Date().toISOString() });
      if (error) throw error;
      setLastUpdatedInfo(newDate);
      setMessage({ type: 'success', text: 'Tanggal update berhasil disimpan.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan info update.' });
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ['No','Kode','Nama Cabang','Tanggal Training','Total Member','Anggota Akses','Login (%)','Center Lock','Lock (%)','Center Login','Total Center','Cakupan (%)'];
    const rows = filteredData.map((b, idx) => {
      const loginPct = b.total_members && b.status !== 'Belum' ? ((b.members_accessed/b.total_members)*100).toFixed(1) : '-';
      const lockPct = b.total_center && b.status !== 'Belum' ? (((b.locked_center||0)/b.total_center)*100).toFixed(1) : '-';
      const cakupanPct = b.total_center && b.status !== 'Belum' ? ((b.accessed_center/b.total_center)*100).toFixed(1) : '-';
      return [idx+1,`"${b.branch_code}"`,`"${b.branch_name}"`,b.training_date?`"${formatDate(b.training_date)}"`:'-',b.total_members||0,b.status==='Belum'?'-':b.members_accessed,loginPct,b.locked_center??0,lockPct,b.accessed_center??0,b.total_center||'-',cakupanPct];
    });
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MDISGO_Monitoring${searchQuery?'_'+searchQuery:''}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Progress bar helper ───────────────────────────────────────────────────
  const renderProgress = (value: number, total: number, status: string) => {
    if (status === 'Belum' || !total) return <span className="mdisgo-center-val">-</span>;
    const pct = (value / total) * 100;
    const colorClass = pct >= 20 ? 'green' : pct >= 15 ? 'yellow' : 'red';
    return (
      <div className="mdisgo-progress-wrapper">
        <div className="mdisgo-progress-text">
          {pct.toFixed(1)}% {pct >= 20 && <CheckCircle2 size={12} className="mdisgo-progress-check" />}
        </div>
        <div className="mdisgo-progress-bg">
          <div className={`mdisgo-progress-fill ${colorClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    );
  };

  // ── Lock Progress bar helper ────────────────────────────────────────────────
  const renderLockProgress = (value: number, total: number, status: string) => {
    if (status === 'Belum' || !total) return <span className="mdisgo-center-val">-</span>;
    const pct = (value / total) * 100;
    const colorClass = pct >= 10 ? 'green' : 'red';
    return (
      <div className="mdisgo-progress-wrapper">
        <div className="mdisgo-progress-text">
          {pct.toFixed(1)}% {pct >= 10 && <CheckCircle2 size={12} className="mdisgo-progress-check" />}
        </div>
        <div className="mdisgo-progress-bg">
          <div className={`mdisgo-progress-fill ${colorClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    );
  };

  // ── Helper to build EditableCell props ────────────────────────────────────
  const makeCellProps = (branch: MdisgoBranch, field: keyof MdisgoBranch) => {
    const fieldConfig = EDITABLE_FIELDS.find(f => f.field === field)!;
    return {
      rowId: branch.id,
      field,
      type: fieldConfig.type,
      options: fieldConfig.options,
      rawValue: String(branch[field] ?? ''),
      isEditing: editingCell?.rowId === branch.id && editingCell?.field === field,
      isSaving: savingCells.has(`${branch.id}:${field}`),
      isAdmin,
      editingValue,
      inputRef: inputRef as React.RefObject<HTMLInputElement | HTMLSelectElement | null>,
      onDoubleClick: handleCellDoubleClick,
      onSave: handleCellSave,
      onKeyDown: handleCellKeyDown,
      onEditingValueChange: setEditingValue,
    };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="mdisgo-container"
      onClick={() => { if (!editingCell) { setSelectedRowId(null); setPasteHint(false); } }}
    >
      {/* Top bar */}
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', marginTop: '2px' }}>
          <button
            className="btn btn-primary mdisgo-btn-add"
            onClick={() => {
              setFormData({ branch_code:'', branch_name:'', training_date:'', members_accessed:0, total_members:0, total_center:0, accessed_center:0, locked_center:0, status:'Belum' });
              setShowAddModal(true);
            }}
          >
            <Plus size={12} />
            <span>Tambah Cabang</span>
          </button>
          <div className="mdisgo-excel-hint">
            <ClipboardPaste size={11} />
            <span>Klik baris lalu <kbd>Ctrl+V</kbd> untuk paste dari Excel · <kbd>Dbl-click</kbd> sel untuk edit</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mdisgo-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div className="mdisgo-header-titles">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1>MDISGO</h1>
            <div
              className="mdisgo-update-badge"
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              onClick={(e) => {
                if (isAdmin) {
                  const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                  try { input?.showPicker(); } catch { input?.focus(); }
                }
              }}
            >
              <Clock size={12} />
              <span>Update Data: <strong>{lastUpdatedInfo ? new Date(lastUpdatedInfo).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pilih Tanggal'}</strong></span>
              {isAdmin && (
                <input
                  type="date"
                  className="mdisgo-hidden-date-input"
                  style={{ position: 'absolute', visibility: 'hidden' }}
                  value={lastUpdatedInfo || ''}
                  onChange={handleDateChange}
                  title="Pilih tanggal update"
                />
              )}
            </div>
          </div>
          <span className="mdisgo-subtitle">Monitoring cabang yang telah mengikuti training MDISGO.</span>
        </div>
        <button
          className="btn btn-outline"
          onClick={handleExportCSV}
          title="Unduh CSV / Excel"
          style={{ height: '28px', fontSize: '10px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={12} />
          <span>CSV / Excel</span>
        </button>
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`mdisgo-toast ${message.type}`}>
          <CheckCircle2 size={13} />
          {message.text}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mdisgo-stats-grid">
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon blue"><Building2 size={18} /></div>
          <div className="mdisgo-stat-info">
            <h4>Total Cabang</h4>
            <div className="stat-value">{totalBranches}</div>
            <div className="stat-sub">Cabang terdaftar</div>
          </div>
        </Card>
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon green"><GraduationCap size={18} /></div>
          <div className="mdisgo-stat-info">
            <h4>Sudah Training</h4>
            <div className="stat-value">{trainedBranches}</div>
            <div className="stat-sub">Active / Completed</div>
          </div>
        </Card>
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}><Target size={18} /></div>
          <div className="mdisgo-stat-info">
            <h4>Pencapaian Target</h4>
            <div className="stat-value">{targetReachedBranches} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>dari {totalBranches}</span></div>
            <div className="stat-sub">Sudah capai 20%</div>
          </div>
        </Card>
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}><Target size={18} /></div>
          <div className="mdisgo-stat-info">
            <h4>Target Lock Center</h4>
            <div className="stat-value">{lockedCenterBranches} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>dari {totalBranches}</span></div>
            <div className="stat-sub">Sudah capai 10%</div>
          </div>
        </Card>
        <Card className="mdisgo-stat-card">
          <div className="mdisgo-stat-icon purple"><Users size={18} /></div>
          <div className="mdisgo-stat-info">
            <h4>Total Akses Anggota</h4>
            <div className="stat-value">{totalMembers.toLocaleString('id-ID')}</div>
          </div>
        </Card>
      </div>

      {/* Catatan / Info */}
      <div style={{ background: 'var(--color-bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: '8px', fontSize: '10.5px', color: 'var(--color-text-main)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <strong style={{ color: 'var(--color-primary)' }}>Catatan:</strong>
          <span>• Anggota minimal akses <strong>20%</strong> dari member.</span>
          <span>• Center yang di lock penarikan minimal <strong>10%</strong> dari total center aktif.</span>
        </div>
      </div>

      {/* Data Table */}
      <Card className="mdisgo-table-card">
        <div className="mdisgo-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0, padding: 0 }}>
              <GraduationCap size={13} style={{ opacity: 0.5 }} />
              Daftar Cabang MDISGO
            </h3>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>({filteredData.length} cabang)</span>
          </div>
          <div className="search-box table-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Cari cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mdisgo-table-wrapper">
          {loading ? (
            <div className="mdisgo-loading">
              <Loader2 className="animate-spin" size={22} />
              <span>Memuat data...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="mdisgo-empty">
              <div className="mdisgo-empty-icon"><Building2 size={36} /></div>
              <h4>Belum ada data</h4>
              <p>{searchQuery ? 'Tidak ditemukan.' : 'Klik "Tambah" untuk menambahkan cabang.'}</p>
            </div>
          ) : (
            <table className="mdisgo-table">
              <thead>
                <tr>
                  <th style={{ width: '25px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '44px', textAlign: 'center' }}>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Status</th>
                  <th>Tgl Training</th>
                  <th style={{ textAlign: 'center' }}>Member</th>
                  <th style={{ textAlign: 'center' }}>Anggota Akses</th>
                  <th style={{ textAlign: 'center' }}>Login (%)</th>
                  <th style={{ textAlign: 'center' }}>Center Lock</th>
                  <th style={{ textAlign: 'center' }}>Lock (%)</th>
                  <th style={{ textAlign: 'center' }}>Center Login</th>
                  <th style={{ textAlign: 'center' }}>Total Center</th>
                  <th style={{ textAlign: 'center' }}>Cakupan (%)</th>
                  {isAdmin && <th style={{ width: '32px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((branch, index) => {
                  const isSelected = selectedRowId === branch.id;
                  const isEditingRow = editingCell?.rowId === branch.id;

                  return (
                    <tr
                      key={branch.id}
                      className={`${isSelected ? 'mdisgo-row-selected' : ''}${isEditingRow ? ' mdisgo-row-editing' : ''}`}
                      onClick={(e) => {
                        const tag = (e.target as HTMLElement).tagName;
                        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
                        setSelectedRowId(branch.id);
                        setPasteHint(true);
                        e.stopPropagation();
                      }}
                      onPaste={(e) => handleRowPaste(e, branch.id)}
                    >
                      {/* No */}
                      <td style={{ textAlign: 'center' }} data-label="No">
                        <span className="mdisgo-row-num">{index + 1}</span>
                      </td>

                      {/* Kode Cabang */}
                      <td style={{ textAlign: 'center' }} data-label="Kode">
                        <EditableCell
                          {...makeCellProps(branch, 'branch_code')}
                          displayValue={<span className="mdisgo-branch-code">{branch.branch_code}</span>}
                        />
                      </td>

                      {/* Nama Cabang */}
                      <td data-label="Nama Cabang">
                        <EditableCell
                          {...makeCellProps(branch, 'branch_name')}
                          displayValue={<span className="mdisgo-branch-name">{branch.branch_name}</span>}
                        />
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        <EditableCell
                          {...makeCellProps(branch, 'status')}
                          displayValue={
                            <span className={`mdisgo-status-badge ${branch.status === 'Active' ? 'active' : branch.status === 'Completed' ? 'completed' : 'belum'}`}>
                              {branch.status}
                            </span>
                          }
                        />
                      </td>

                      {/* Tanggal Training */}
                      <td data-label="Tgl Training">
                        <EditableCell
                          {...makeCellProps(branch, 'training_date')}
                          displayValue={<span className="mdisgo-date">{formatDate(branch.training_date)}</span>}
                        />
                      </td>

                      {/* Total Member */}
                      <td style={{ textAlign: 'center' }} data-label="Member">
                        <EditableCell
                          {...makeCellProps(branch, 'total_members')}
                          displayValue={<div className="mdisgo-members">{branch.total_members ? branch.total_members.toLocaleString('id-ID') : '-'}</div>}
                        />
                      </td>

                      {/* Anggota Akses */}
                      <td style={{ textAlign: 'center' }} data-label="Anggota Akses">
                        <EditableCell
                          {...makeCellProps(branch, 'members_accessed')}
                          displayValue={<div className="mdisgo-members">{branch.status === 'Belum' ? '-' : branch.members_accessed.toLocaleString('id-ID')}</div>}
                        />
                      </td>

                      {/* Login (%) */}
                      <td style={{ textAlign: 'center' }} data-label="Login (%)">
                        {renderProgress(branch.members_accessed, branch.total_members, branch.status)}
                      </td>

                      {/* Center Lock Penarikan */}
                      <td style={{ textAlign: 'center' }} data-label="Center Lock">
                        <EditableCell
                          {...makeCellProps(branch, 'locked_center')}
                          displayValue={<span className="mdisgo-center-val">{branch.locked_center !== null && branch.locked_center !== undefined ? branch.locked_center.toLocaleString('id-ID') : '0'}</span>}
                        />
                      </td>

                      {/* Lock Center (%) */}
                      <td style={{ textAlign: 'center' }} data-label="Lock (%)">
                        {renderLockProgress(branch.locked_center || 0, branch.total_center, branch.status)}
                      </td>

                      {/* Center Login */}
                      <td style={{ textAlign: 'center' }} data-label="Center Login">
                        <EditableCell
                          {...makeCellProps(branch, 'accessed_center')}
                          displayValue={<span className="mdisgo-center-val">{branch.accessed_center !== null && branch.accessed_center !== undefined ? branch.accessed_center.toLocaleString('id-ID') : '0'}</span>}
                        />
                      </td>

                      {/* Total Center */}
                      <td style={{ textAlign: 'center' }} data-label="Total Center">
                        <EditableCell
                          {...makeCellProps(branch, 'total_center')}
                          displayValue={<span className="mdisgo-center-val">{branch.total_center ? branch.total_center.toLocaleString('id-ID') : '-'}</span>}
                        />
                      </td>

                      {/* Cakupan Center (%) */}
                      <td style={{ textAlign: 'center' }} data-label="Cakupan (%)">
                        {renderProgress(branch.accessed_center, branch.total_center, branch.status)}
                      </td>

                      {/* Aksi */}
                      {isAdmin && (
                        <td data-label="Aksi">
                          <div className="mdisgo-action-buttons">
                            <button
                              className="mdisgo-action-btn delete"
                              title="Hapus"
                              onClick={(e) => { e.stopPropagation(); handleDelete(branch); }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paste hint bar */}
        {isAdmin && selectedRowId && pasteHint && (
          <div className="mdisgo-paste-bar">
            <ClipboardPaste size={11} />
            <span>Baris dipilih — tekan <kbd>Ctrl+V</kbd> untuk paste dari Excel (multi-baris didukung)</span>
            <button onClick={(e) => { e.stopPropagation(); setSelectedRowId(null); setPasteHint(false); }}>
              <X size={10} />
            </button>
          </div>
        )}
      </Card>

      {/* Add New Branch Modal */}
      {showAddModal && (
        <div className="mdisgo-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="mdisgo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mdisgo-modal-header">
              <h3>Tambah Cabang Baru</h3>
              <button className="mdisgo-modal-close" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <div className="mdisgo-modal-body">
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Informasi Cabang</h4>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Kode Cabang</label>
                    <input type="text" placeholder="007" value={formData.branch_code} onChange={(e) => setFormData(p=>({...p, branch_code: e.target.value}))} />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Nama Cabang</label>
                    <input type="text" placeholder="BANTUL" value={formData.branch_name} onChange={(e) => setFormData(p=>({...p, branch_name: e.target.value}))} />
                  </div>
                </div>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Status Training</label>
                    <select value={formData.status} onChange={(e) => setFormData(p=>({...p, status: e.target.value}))}>
                      <option value="Belum">Belum</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Tanggal Training</label>
                    <input type="date" value={formData.training_date} onChange={(e) => setFormData(p=>({...p, training_date: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Data Member (Anggota)</h4>
                <div className="mdisgo-form-row">
                  <div className="mdisgo-form-group">
                    <label>Total Member</label>
                    <input type="number" min="0" value={formData.total_members} onChange={(e) => setFormData(p=>({...p, total_members: parseInt(e.target.value)||0}))} />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Anggota Akses</label>
                    <input type="number" min="0" value={formData.members_accessed} onChange={(e) => setFormData(p=>({...p, members_accessed: parseInt(e.target.value)||0}))} />
                  </div>
                </div>
              </div>
              <div className="mdisgo-form-section">
                <h4 className="mdisgo-section-title">Data Center</h4>
                <div className="mdisgo-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="mdisgo-form-group">
                    <label>Center Login</label>
                    <input type="number" min="0" value={formData.accessed_center} onChange={(e) => setFormData(p=>({...p, accessed_center: parseInt(e.target.value)||0}))} />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Center Lock</label>
                    <input type="number" min="0" value={formData.locked_center} onChange={(e) => setFormData(p=>({...p, locked_center: parseInt(e.target.value)||0}))} />
                  </div>
                  <div className="mdisgo-form-group">
                    <label>Total Center</label>
                    <input type="number" min="0" value={formData.total_center} onChange={(e) => setFormData(p=>({...p, total_center: parseInt(e.target.value)||0}))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mdisgo-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)} disabled={saving} style={{ fontSize: '12px', padding: '6px 14px' }}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveNew} disabled={saving} style={{ fontSize: '12px', padding: '6px 14px' }}>
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>Tambah</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MdisgoMonitoring;
