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

const extractSections = (normalized = {}) => Object.keys(normalized).sort();

function CvListPage({ onCompare }) {
  const [status, setStatus] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');

  const loadCvs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status });
      if (tagFilter) params.set('tag', tagFilter);
      if (folderFilter) params.set('folder_id', folderFilter);
      const res = await fetch(`/api/cvs?${params.toString()}`, { headers: { 'x-user-id': 'u1' } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Could not load CVs.');
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load CVs.');
    } finally {
      setIsLoading(false);
    }
  }, [status, tagFilter, folderFilter]);

  useEffect(() => { loadCvs(); }, [loadCvs]);

  const emptyMessage = useMemo(() => `No ${status} CVs yet.`, [status]);

  return (
    <section className="cvs-page">
      <div className="cvs-header"><h1>My CVs</h1><button className="primary-btn" type="button">Create your first CV</button></div>
      <div className="status-chips">{TABS.map((tab) => <button key={tab.key} className={`chip${status === tab.key ? ' active' : ''}`} type="button" onClick={() => setStatus(tab.key)}>{tab.label}</button>)}</div>
      <div className="status-chips">
        <input placeholder="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value.trim().toLowerCase())} />
        <input placeholder="Filter by folder" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value.trim())} />
      </div>
      {isLoading && <div className="cvs-list skeleton-list" aria-busy="true">{Array.from({ length: 4 }).map((_, idx) => <div className="cv-row skeleton" key={idx} />)}</div>}
      {!isLoading && error && <div className="error-state"><p>Failed to load CVs: {error}</p><button type="button" className="secondary-btn" onClick={loadCvs}>Retry</button></div>}
      {!isLoading && !error && rows.length === 0 && <div className="empty-state"><p>{emptyMessage}</p><button className="primary-btn" type="button">Create your first CV</button></div>}
      {!isLoading && !error && rows.length > 0 && <div className="cvs-list">{rows.map((cv) => <article className="cv-row" key={cv.id}><div><h3>{cv.title}</h3><p>{roleCompanyLabel(cv)}</p><small>Updated {formatUpdatedAt(cv.updatedAt)}</small></div><div className="row-actions"><button type="button" onClick={() => onCompare(cv.id)}>Compare</button><button type="button">Open</button></div></article>)}</div>}
    </section>
  );
}

function App() {
  const [route, setRoute] = useState('editor');
  const [cvId] = useState(parseCvId);
  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareError, setCompareError] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const cvRef = useRef(null);

  const loadSnapshots = useCallback(async () => {
    if (!cvId) return;
    setIsLoadingSnapshots(true);
    const res = await fetch(`/api/cvs/${cvId}/snapshots`, { headers: { 'x-user-id': 'u1' } });
    const payload = await res.json();
    setSnapshots(Array.isArray(payload?.data) ? payload.data : []);
    setShowSnapshotsModal(true);
    setIsLoadingSnapshots(false);
  }, [cvId]);

  const runCompare = useCallback(async (baseCvId, leftSnapshotId = 'current', rightSnapshotId = 'current') => {
    setCompareError('');
    setIsComparing(true);
    try {
      const params = new URLSearchParams({ left: leftSnapshotId, right: rightSnapshotId });
      const res = await fetch(`/api/cvs/${baseCvId}/compare?${params.toString()}`, { headers: { 'x-user-id': 'u1' } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Could not compare versions.');
      setCompareData(payload?.data || null);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Could not compare versions.');
    } finally {
      setIsComparing(false);
    }
  }, []);

  const applySection = useCallback((sectionName, side) => {
    if (!cvRef.current || !compareData?.normalized?.[side]?.[sectionName]) return;
    cvRef.current.innerHTML += `\n<section><h3>${sectionName}</h3><p>${compareData.normalized[side][sectionName]}</p></section>`;
  }, [compareData]);

  const sections = extractSections(compareData?.sections);

  return <main className="page">
    <header className="app-nav"><button type="button" className={route === 'editor' ? 'active' : ''} onClick={() => setRoute('editor')}>Editor</button><button type="button" className={route === 'my-cvs' ? 'active' : ''} onClick={() => setRoute('my-cvs')}>My CVs</button></header>
    {route === 'my-cvs' ? <CvListPage onCompare={(id) => { setRoute('editor'); runCompare(id); }} /> : <section className="cv-shell"><button type="button" className="save-pdf-button" onClick={() => window.print()}><MdOutlineSaveAs /></button><div className="editor-toolbar"><button type="button" className="secondary-btn" onClick={loadSnapshots} disabled={!cvId || isLoadingSnapshots}>{isLoadingSnapshots ? 'Loading snapshots…' : 'Snapshots'}</button><button type="button" className="secondary-btn" onClick={() => runCompare(cvId)} disabled={!cvId || isComparing}>{isComparing ? 'Comparing…' : 'Compare'}</button></div>{compareError && <p className="error-text">{compareError}</p>}<article ref={cvRef} className="cv-document" contentEditable suppressContentEditableWarning><h2>CV Editor</h2></article>
      {showSnapshotsModal && <div className="conflict-backdrop"><div className="conflict-modal"><h3>Snapshots</h3><ul>{snapshots.map((snapshot) => <li key={snapshot.id}><span>{formatUpdatedAt(snapshot.createdAt)}</span><button type="button" className="secondary-btn" onClick={() => runCompare(cvId, snapshot.id, 'current')}>Compare</button></li>)}</ul><div className="conflict-actions"><button type="button" className="secondary-btn" onClick={() => setShowSnapshotsModal(false)}>Close</button></div></div></div>}
      {compareData && <div className="compare-grid">{sections.map((section) => <div className="compare-row" key={section}><h4>{section}</h4><div className="compare-cols"><div><pre>{compareData.normalized.left?.[section] || ''}</pre><button type="button" onClick={() => applySection(section, 'left')}>Apply left section</button></div><div><pre>{compareData.normalized.right?.[section] || ''}</pre><button type="button" onClick={() => applySection(section, 'right')}>Apply right section</button></div></div></div>)}</div>}
    </section>}
  </main>;
}

export default App;
