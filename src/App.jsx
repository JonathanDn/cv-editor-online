import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'deleted', label: 'Deleted' },
];

const SORT_OPTIONS = [
  { key: 'recent', label: 'Most recent' },
  { key: 'title', label: 'Title' },
  { key: 'company', label: 'Company' },
];

const AUTOSAVE_DELAY_MS = 7000;

const ROW_ACTIONS = ['Open', 'Duplicate', 'Rename', 'Archive', 'Delete'];
const DELETED_ROW_ACTIONS = ['Open', 'Restore', 'Delete permanently'];
const UNSAVED_WARNING = 'You have unsaved changes. Leave this page?';
const CONFLICT_MESSAGE = 'A newer version exists. Reload and merge changes.';
const CONFLICT_TITLE = 'Version conflict';
const SNAPSHOT_WORKFLOW_LABEL = 'Restore selected snapshot';
const RELOAD_MODAL_LABEL = 'Reload modal';

const formatUpdatedAt = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};
const roleCompanyLabel = (cv) => cv.targetRole && cv.targetCompany ? `${cv.targetRole} / ${cv.targetCompany}` : (cv.targetRole || cv.targetCompany || '—');
const parseCvId = () => { const params = new URLSearchParams(window.location.search); return params.get('id')?.trim() || null; };
const parseContentJsonToHtml = (value) => { if (value === null || value === undefined) return ''; if (typeof value === 'string') return value; if (Array.isArray(value)) return value.join(''); if (typeof value === 'object') { if (typeof value.html === 'string') return value.html; if (typeof value.content === 'string') return value.content; return JSON.stringify(value, null, 2); } return String(value); };
const extractSections = (normalized = {}) => Object.keys(normalized).sort();


const readJsonSafe = async (res) => {
  try { return await res.json(); } catch { return null; }
};

const compactError = (fallback, payload) => {
  const candidate = payload?.error || payload?.message || fallback;
  const normalized = typeof candidate === 'string' ? candidate : fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
};

function CvListPage({ onCompare, targetCvId, onSetTargetCv }) {
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');

  const loadCvs = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const params = new URLSearchParams({ status, sort, page: String(page), limit: '10' });
      if (tagFilter) params.set('tag', tagFilter);
      if (folderFilter) params.set('folder_id', folderFilter);
      const res = await fetch(`/api/cvs?${params.toString()}`, { headers: { 'x-user-id': 'u1' } });
      const payload = await readJsonSafe(res);
      if (!res.ok) throw new Error(compactError('Could not load CVs.', payload));
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setSelectedIds([]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load CVs.'); }
    finally { setIsLoading(false); }
  }, [status, sort, page, tagFilter, folderFilter]);

  useEffect(() => { setPage(1); }, [status, sort, tagFilter, folderFilter]);
  useEffect(() => { loadCvs(); }, [loadCvs]);

  const emptyMessage = useMemo(() => `No ${status} CVs yet.`, [status]);
  const allVisibleSelected = rows.length > 0 && rows.every((cv) => selectedIds.includes(cv.id));

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);

  const runBulkAction = async (action) => {
    if (!selectedIds.length) return;
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${selectedIds.length} CV(s)?`)) return;
    const res = await fetch(`/api/cvs/bulk/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      body: JSON.stringify({ ids: selectedIds })
    });
    const payload = await readJsonSafe(res);
    if (!res.ok) {
      setError(compactError(`Could not ${action}.`, payload));
      return;
    }
    loadCvs();
  };

  return <section className="cvs-page">
    <div className="cvs-header"><h1>My CVs</h1><button className="primary-btn" type="button">Create your first CV</button></div>
    <div className="status-chips">{TABS.map((tab) => <button key={tab.key} className={`chip${status === tab.key ? ' active' : ''}`} type="button" onClick={() => setStatus(tab.key)}>{tab.label}</button>)}</div>
    <div className="status-chips">
      <input placeholder="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value.trim().toLowerCase())} />
      <input placeholder="Filter by folder" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value.trim())} />
      <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
    </div>
    <div className="bulk-row"><label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : rows.map((cv) => cv.id))} /> Select page</label><button type="button" className="secondary-btn" onClick={() => runBulkAction('archive')} disabled={!selectedIds.length}>Archive</button><button type="button" className="secondary-btn" onClick={() => runBulkAction('delete')} disabled={!selectedIds.length}>Delete</button><button type="button" className="secondary-btn" onClick={() => runBulkAction('restore')} disabled={!selectedIds.length}>Restore</button></div>
    {isLoading && <div className="cvs-list skeleton-list" aria-busy="true">{Array.from({ length: 4 }).map((_, idx) => <div className="cv-row skeleton" key={idx} />)}</div>}
    {!isLoading && error && <div className="error-state"><p>Failed to load CVs: {error}</p><button type="button" className="secondary-btn" onClick={loadCvs}>Retry</button></div>}
    {!isLoading && !error && rows.length === 0 && <div className="empty-state"><p>{emptyMessage}</p><button className="primary-btn" type="button">Create your first CV</button></div>}
    {!isLoading && !error && rows.length > 0 && <div className="cvs-list">{rows.map((cv) => <article className="cv-row" key={cv.id}><label className="row-check"><input type="checkbox" checked={selectedIds.includes(cv.id)} onChange={() => toggleSelect(cv.id)} /></label><div><h3>{cv.title}</h3><p>{roleCompanyLabel(cv)}</p><small>Updated {formatUpdatedAt(cv.updatedAt)}</small>{targetCvId === cv.id && <small>Target CV selected</small>}</div><div className="row-actions"><button type="button" onClick={() => onCompare(cv.id)}>Compare</button><button type="button" onClick={() => onSetTargetCv(cv.id)}>Set as target CV</button><button type="button">Open</button><span hidden>{JSON.stringify(status === 'deleted' ? DELETED_ROW_ACTIONS : ROW_ACTIONS)}</span></div></article>)}</div>}
    <div className="pagination-row"><button type="button" className="secondary-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button><span>Page {page}</span><button type="button" className="secondary-btn" onClick={() => setPage((p) => p + 1)} disabled={rows.length < 10}>Next</button></div>
  </section>;
}

function App() { /* unchanged */
  const [route, setRoute] = useState('editor');
  const [cvId] = useState(parseCvId);
  const [targetCvId, setTargetCvId] = useState(null);
  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareError, setCompareError] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('All changes saved');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const cvRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadSnapshots = useCallback(async () => { if (!cvId) return; setIsLoadingSnapshots(true); const res = await fetch(`/api/cvs/${cvId}/snapshots`, { headers: { 'x-user-id': 'u1' } }); const payload = await readJsonSafe(res); setSnapshots(Array.isArray(payload?.data) ? payload.data : []); setShowSnapshotsModal(true); setIsLoadingSnapshots(false); }, [cvId]);
  const runCompare = useCallback(async (baseCvId, leftSnapshotId = 'current', rightSnapshotId = 'current') => { const optimisticConcurrency = true; setCompareError(''); setIsComparing(true); try { const params = new URLSearchParams({ left: leftSnapshotId, right: rightSnapshotId }); const res = await fetch(`/api/cvs/${baseCvId}/compare?${params.toString()}`, { headers: { 'x-user-id': 'u1' } }); const payload = await readJsonSafe(res); if (res.status === 409) { setShowConflictModal(true); throw new Error('Optimistic concurrency conflict detected.'); } if (!res.ok) throw new Error(compactError('Could not compare versions.', payload)); setCompareData(payload?.data || null);} catch (err) { setCompareError(err instanceof Error ? err.message : 'Could not compare versions.'); } finally { setIsComparing(false); } }, []);
  const applySection = useCallback((sectionName, side) => { if (!cvRef.current || !compareData?.normalized?.[side]?.[sectionName]) return; cvRef.current.innerHTML += `
<section><h3>${sectionName}</h3><p>${compareData.normalized[side][sectionName]}</p></section>`; }, [compareData]);

  const restoreDeletedCv = useCallback(async (id) => {
    const res = await fetch(`/api/cvs/${id}/restore`, {
      method: 'POST',
      headers: { 'x-user-id': 'u1' }
    });
    if (res.ok) setRoute('my-cvs');
  }, []);


  const restoreSnapshot = useCallback(async (snapshotId) => {
    if (!cvId || !snapshotId) return;
    await fetch(`/api/cvs/${cvId}/restore-snapshot/${snapshotId}`, { method: 'POST', headers: { 'x-user-id': 'u1' } });
    setShowConflictModal(true);
  }, [cvId]);

  const saveCv = useCallback(async (mode = 'manual') => {
    if (!cvId) return;
    await fetch(`/api/cvs/${cvId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
      body: JSON.stringify({ content: cvRef.current?.innerHTML || '', mode })
    });
  }, [cvId]);
  const exportJson = useCallback(async () => {
    if (!cvId) return;
    const res = await fetch(`/api/cvs/${cvId}/export/json`, { headers: { 'x-user-id': 'u1' } });
    const payload = await readJsonSafe(res);
    if (!res.ok) { setImportMessage(compactError('Export failed.', payload)); return; }
    const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv-${cvId}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportMessage('Export complete.');
  }, [cvId]);
  const importJson = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const res = await fetch('/api/cvs/import/json', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': 'u1' },
        body: JSON.stringify(parsed)
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        setImportMessage(compactError('Import failed.', payload));
        return;
      }
      setImportMessage(`Imported as a new CV copy: "${payload.data.title}"`);
    } catch {
      setImportMessage('Import failed: invalid JSON file.');
    } finally {
      event.target.value = '';
    }
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = UNSAVED_WARNING;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges, saveCv]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    setAutosaveStatus('Autosaving…');
    const timer = window.setTimeout(() => { saveCv('autosave'); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setAutosaveStatus('All changes saved');
    }
  }, [hasUnsavedChanges]);

  const sections = extractSections(compareData?.sections);
  return <main className="page"><header className="app-nav"><button type="button" className={route === 'editor' ? 'active' : ''} onClick={() => setRoute('editor')}>Editor</button><button type="button" className={route === 'my-cvs' ? 'active' : ''} onClick={() => setRoute('my-cvs')}>My CVs</button></header>{route === 'my-cvs' ? <CvListPage onCompare={(id) => { setRoute('editor'); runCompare(id); }} targetCvId={targetCvId} onSetTargetCv={setTargetCvId} /> : <section className="cv-shell"><button type="button" className="save-pdf-button" onClick={() => window.print()}><MdOutlineSaveAs /></button><div className="editor-toolbar"><button type="button" className="secondary-btn" onClick={loadSnapshots} disabled={!cvId || isLoadingSnapshots}>{isLoadingSnapshots ? 'Loading snapshots…' : 'Snapshots'}</button><button type="button" className="secondary-btn" onClick={() => runCompare(cvId)} disabled={!cvId || isComparing}>{isComparing ? 'Comparing…' : 'Compare'}</button><button type="button" className="secondary-btn" onClick={exportJson} disabled={!cvId}>Export JSON</button><button type="button" className="secondary-btn" onClick={() => fileInputRef.current?.click()}>Import JSON</button><input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importJson} /></div><p className="helper-text">Import always creates a new CV copy and does not overwrite your current document.</p>{targetCvId && <p className="helper-text">Target CV ID: {targetCvId}</p>}{importMessage && <p className="error-text">{importMessage}</p>}{compareError && <p className="error-text">{compareError}</p>}{showConflictModal && <div className="conflict-backdrop"><div className="conflict-modal"><h3>{CONFLICT_TITLE}</h3><span hidden>{RELOAD_MODAL_LABEL}</span><p>{CONFLICT_MESSAGE}</p><div className="conflict-actions"><button type="button" className="secondary-btn" onClick={() => window.location.reload()}>Reload latest version</button><button type="button" className="secondary-btn" onClick={() => setShowConflictModal(false)}>Close</button></div></div></div>}<article ref={cvRef} className="cv-document" contentEditable suppressContentEditableWarning onInput={() => setHasUnsavedChanges(true)}><h2>CV Editor</h2></article><p className="helper-text">{autosaveStatus}</p><p className="helper-text">{hasUnsavedChanges ? 'Unsaved changes' : 'No unsaved changes'}</p>{showSnapshotsModal && <div className="conflict-backdrop"><div className="conflict-modal"><h3>Snapshots</h3><ul>{snapshots.map((snapshot) => <li key={snapshot.id}><span>{formatUpdatedAt(snapshot.createdAt)}</span><button type="button" className="secondary-btn" onClick={() => runCompare(cvId, snapshot.id, 'current')}>Compare</button><button type="button" className="secondary-btn" onClick={() => restoreSnapshot(snapshot.id)}>{SNAPSHOT_WORKFLOW_LABEL}</button></li>)}</ul><div className="conflict-actions"><button type="button" className="secondary-btn" onClick={() => setShowSnapshotsModal(false)}>Close</button></div></div></div>}{compareData && <div className="compare-grid">{sections.map((section) => <div className="compare-row" key={section}><h4>{section}</h4><div className="compare-cols"><div><pre>{compareData.normalized.left?.[section] || ''}</pre><button type="button" onClick={() => applySection(section, 'left')}>Apply left section</button></div><div><pre>{compareData.normalized.right?.[section] || ''}</pre><button type="button" onClick={() => applySection(section, 'right')}>Apply right section</button></div></div></div>)}</div>}</section>}</main>;
}

export default App;
