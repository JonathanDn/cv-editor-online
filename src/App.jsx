import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'deleted', label: 'Deleted' },
];

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
  const cvRef = useRef(null);
  const handleSaveAsPdf = useCallback(() => { if (!cvRef.current) return; window.print(); }, []);

  return (
    <main className="page">
      <header className="app-nav">
        <button type="button" className={route === 'editor' ? 'active' : ''} onClick={() => setRoute('editor')}>Editor</button>
        <button type="button" className={route === 'my-cvs' ? 'active' : ''} onClick={() => setRoute('my-cvs')}>My CVs</button>
      </header>
      {route === 'my-cvs' ? <CvListPage /> : <section className="cv-shell"><button type="button" className="save-pdf-button" onClick={handleSaveAsPdf} aria-label="Save as PDF" title="Save as PDF"><MdOutlineSaveAs className="save-pdf-icon" /></button><article ref={cvRef} className="cv-document" contentEditable suppressContentEditableWarning><h2>CV Editor</h2><p>Edit your CV content here.</p></article></section>}
    </main>
  );
}

export default App;
