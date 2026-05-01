import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'deleted', label: 'Deleted' },
];

const AUTOSAVE_DELAY_MS = 7000;

const formatUpdatedAt = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const roleCompanyLabel = (cv) => {
  if (cv.targetRole && cv.targetCompany) return `${cv.targetRole} / ${cv.targetCompany}`;
  if (cv.targetRole) return cv.targetRole;
  if (cv.targetCompany) return cv.targetCompany;
  return '—';
};

const parseCvId = () => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('id');
  return raw?.trim() || null;
};

const parseContentJsonToHtml = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join('');
  if (typeof value === 'object') {
    if (typeof value.html === 'string') return value.html;
    if (typeof value.content === 'string') return value.content;
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

function CvListPage() {
  const [status, setStatus] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const loadCvs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cvs?status=${status}`, { headers: { 'x-user-id': 'u1' } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Could not load CVs.');
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load CVs.');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => { loadCvs(); }, [loadCvs]);

  const emptyMessage = useMemo(() => `No ${status} CVs yet.`, [status]);

  return (
    <section className="cvs-page">
      <div className="cvs-header"><h1>My CVs</h1><button className="primary-btn" type="button">Create your first CV</button></div>
      <div className="status-chips">{TABS.map((tab) => <button key={tab.key} className={`chip${status === tab.key ? ' active' : ''}`} type="button" onClick={() => setStatus(tab.key)}>{tab.label}</button>)}</div>
      {isLoading && <div className="cvs-list skeleton-list" aria-busy="true">{Array.from({ length: 4 }).map((_, idx) => <div className="cv-row skeleton" key={idx} />)}</div>}
      {!isLoading && error && <div className="error-state"><p>Failed to load CVs: {error}</p><button type="button" className="secondary-btn" onClick={loadCvs}>Retry</button></div>}
      {!isLoading && !error && rows.length === 0 && <div className="empty-state"><p>{emptyMessage}</p><button className="primary-btn" type="button">Create your first CV</button></div>}
      {!isLoading && !error && rows.length > 0 && (
        <div className="cvs-list">
          {rows.map((cv) => <article className="cv-row" key={cv.id}><div><h3>{cv.title}</h3><p>{roleCompanyLabel(cv)}</p><small>Updated {formatUpdatedAt(cv.updatedAt)}</small></div><div className="row-actions">{['Open', 'Duplicate', 'Rename', 'Archive', 'Delete'].map((action) => <button type="button" key={action}>{action}</button>)}</div></article>)}
        </div>
      )}
    </section>
  );
}

function App() {
  const [route, setRoute] = useState('editor');
  const [cvId] = useState(parseCvId);
  const [saveState, setSaveState] = useState('Saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(null);
  const cvRef = useRef(null);
  const initialHtmlRef = useRef('');
  const isHydratingRef = useRef(false);

  const loadCv = useCallback(async () => {
    if (!cvId || !cvRef.current) return;
    setEditorError('');
    setSaveState('Saving…');
    try {
      const res = await fetch(`/api/cvs/${cvId}`, { headers: { 'x-user-id': 'u1' } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Could not load CV.');
      const html = parseContentJsonToHtml(payload?.data?.content_json);
      isHydratingRef.current = true;
      cvRef.current.innerHTML = html || '<h2>CV Editor</h2><p>Edit your CV content here.</p>';
      initialHtmlRef.current = cvRef.current.innerHTML;
      setCurrentRevision(payload?.data?.updatedAt || payload?.data?.revision || null);
      setHasUnsavedChanges(false);
      setSaveState('Saved');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Could not load CV.');
      setSaveState('Saved');
    } finally {
      isHydratingRef.current = false;
    }
  }, [cvId]);

  useEffect(() => { loadCv(); }, [loadCv]);

  const saveCv = useCallback(async (saveReason = 'autosave') => {
    if (!cvId || !cvRef.current) return;
    const html = cvRef.current.innerHTML;
    setSaveState('Saving…');
    setEditorError('');
    try {
      if (!currentRevision) {
        throw new Error('Missing revision. Reload and try again.');
      }
      const res = await fetch(`/api/cvs/${cvId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'u1' },
        body: JSON.stringify({
          content_json: { html },
          content_text: cvRef.current.innerText,
          updated_at: currentRevision,
          save_reason: saveReason
        })
      });
      const payload = await res.json();
      if (res.status === 409) {
        setShowConflictModal(true);
        throw new Error(payload?.message || 'This CV changed elsewhere. Reload latest version.');
      }
      if (!res.ok) throw new Error(payload?.error || 'Could not save CV.');
      initialHtmlRef.current = html;
      setCurrentRevision(payload?.data?.updatedAt || payload?.data?.revision || null);
      setHasUnsavedChanges(false);
      setSaveState('Saved');
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Could not save CV.');
      setSaveState('Saved');
    }
  }, [cvId, currentRevision]);

  useEffect(() => {
    if (!cvRef.current) return undefined;
    const onInput = () => {
      if (isHydratingRef.current) return;
      setHasUnsavedChanges(true);
      setSaveState('Saved');
    };
    const node = cvRef.current;
    node.addEventListener('input', onInput);
    return () => node.removeEventListener('input', onInput);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handle = window.setTimeout(() => { saveCv('autosave'); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [hasUnsavedChanges, saveCv]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigate = useCallback((nextRoute) => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave this page?');
      if (!shouldLeave) return;
    }
    setRoute(nextRoute);
  }, [hasUnsavedChanges]);

  const handleSaveAsPdf = useCallback(() => { if (!cvRef.current) return; window.print(); }, []);

  return (
    <main className="page">
      <header className="app-nav">
        <button type="button" className={route === 'editor' ? 'active' : ''} onClick={() => handleNavigate('editor')}>Editor</button>
        <button type="button" className={route === 'my-cvs' ? 'active' : ''} onClick={() => handleNavigate('my-cvs')}>My CVs</button>
      </header>
      {route === 'my-cvs' ? <CvListPage /> : <section className="cv-shell"><button type="button" className="save-pdf-button" onClick={handleSaveAsPdf} aria-label="Save as PDF" title="Save as PDF"><MdOutlineSaveAs className="save-pdf-icon" /></button><div className="editor-toolbar"><button type="button" className="secondary-btn" onClick={() => saveCv('manual_save')} disabled={!cvId}>Save</button><small>{saveState}</small></div>{editorError && <p className="error-text">{editorError}</p>}<article ref={cvRef} className="cv-document" contentEditable suppressContentEditableWarning><h2>CV Editor</h2><p>Edit your CV content here.</p></article>{showConflictModal && <div className="conflict-backdrop" role="dialog" aria-modal="true" aria-labelledby="conflict-title"><div className="conflict-modal"><h3 id="conflict-title">This CV changed elsewhere. Reload latest version.</h3><p>Reload to continue editing with the newest content.</p><div className="conflict-actions"><button type="button" className="primary-btn" onClick={() => { setShowConflictModal(false); loadCv(); }}>Reload latest version</button><button type="button" className="secondary-btn" onClick={() => setShowConflictModal(false)}>Close</button></div></div></div>}</section>}
    </main>
  );
}

export default App;
