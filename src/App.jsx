import { useCallback, useEffect, useRef, useState } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

const LEGACY_LOCAL_STORAGE_KEY = 'cvEditorData';
const LOCAL_STORAGE_KEY = 'cvEditorData_v2';
const CURRENT_TEMPLATE_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 1;
const MAX_UNDO_STATES = 50;

const createDefaultCvSchema = () => ({
  profile: {
    firstName: 'JANE',
    lastName: 'AUSTEN',
    title: 'PROFESSIONAL TITLE',
    summary:
      "Summarise yourself and why you're a good fit for the role in a few sentences. Your CV is meant to help you get an interview, so make them want to know you more. Help do this by tailoring your CV to the job you're applying for - of course your education and experience doesn't change, but what you highlight should.",
  },
  contacts: ['+1 123 1234 1123 ☎', 'personalemail@email.com ✉', 'LinkedIn.com/username 👤'],
  education: [
    { qualification: 'Qualification', institution: 'Institution/University', period: '2014 - 2015' },
    { qualification: 'Qualification', institution: 'Institution/University', period: '2010 - 2014' },
    { qualification: 'Qualification', institution: 'Institution/University', period: '2008 - 2010' },
  ],
  awards: [
    { name: 'Name of award', organization: 'Organisation', year: '2017' },
    { name: 'Name of award', organization: 'Organisation', year: '2014' },
  ],
  languages: 'Hebrew (Mother tongue), English (Fluent), Arabic (Mostly reading)',
  leftSections: [],
  experience: [
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Dec 2018 - Current',
      summary:
        "Briefly summarise your responsibilities. But what recruiters really want to see is the impact you've had, so use the bullet points to give specific examples of some of the key achievements you had in the role.",
      bullets: [
        'For example, did you increase sales by 50% over 6 months',
        'Or perhaps you negotiated a new contract with a different supplier, saving your company $x a year',
        "Make sure the examples are specific, measurable and related to the job you're applying for",
      ],
    },
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Sept 2016 - Dec 2018',
      summary:
        'Remember to turn on Spelling and Grammar, and make sure you check and check again for typos, errors and formatting issues- zooming in helps here.',
      bullets: ['Try not to waffle and keep your points succinct', 'Avoid clichés and tell the truth. Use active verbs.'],
    },
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Sept 2016 - Dec 2018',
      summary:
        'Remember to turn on Spelling and Grammar, and make sure you check and check again for typos, errors and formatting issues- zooming in helps here.',
      bullets: ['Try not to waffle and keep your points succinct', 'Avoid clichés and tell the truth. Use active verbs.'],
    },
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Jan 2014 - Aug 2016',
      summary: "Include your earlier experience when it supports the role you're applying for.",
      bullets: ['Keep each point concise and focused on impact.'],
    },
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Jan 2012 - Dec 2013',
      summary: 'Highlight earlier relevant experience to show the breadth of your background.',
      bullets: ['Call out achievements that demonstrate transferable skills.'],
    },
    {
      title: 'Your Job Title Goes Here',
      meta: 'Company Name | Jan 2010 - Dec 2011',
      summary: 'Include foundational experience that still supports your current career direction.',
      bullets: ['Focus on relevant outcomes and transferable strengths.'],
    },
  ],
  additional: {
    title: 'Additional Information',
    text: 'Add extra achievements, projects, certifications, or volunteer work here.',
  },
});

const cloneSchema = (schema) => JSON.parse(JSON.stringify(schema));
const schemaEquals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function readStoredCvData() {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schema && typeof parsed.templateVersion === 'number' && typeof parsed.schemaVersion === 'number') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredCvData(schema) {
  window.localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify({
      schema,
      templateVersion: CURRENT_TEMPLATE_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    })
  );
}

function migrateSchema(schema, schemaVersion) {
  const migrations = {
    0: (input) => ({ ...createDefaultCvSchema(), ...input }),
  };

  let next = cloneSchema(schema);
  let version = schemaVersion ?? 0;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) break;
    next = migrate(next);
    version += 1;
  }

  return next;
}

function parseCvHtmlToSchema(documentHtml) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = documentHtml;
  const base = createDefaultCvSchema();

  const qText = (selector, fallback = '') => wrapper.querySelector(selector)?.textContent?.trim() || fallback;
  const qAllText = (selector) => Array.from(wrapper.querySelectorAll(selector)).map((el) => el.textContent?.trim() || '');

  base.profile.firstName = qText('.hero-first', base.profile.firstName);
  base.profile.lastName = qText('.hero-last', base.profile.lastName);
  base.profile.title = qText('.hero-title', base.profile.title);
  base.profile.summary = qText('.hero-summary', base.profile.summary);
  base.contacts = qAllText('.left-column .panel:nth-of-type(1) p');

  base.education = Array.from(wrapper.querySelectorAll('.left-column .panel:nth-of-type(2) .item')).map((item) => ({
    qualification: item.querySelector('h4')?.textContent?.trim() || 'Qualification',
    institution: item.querySelectorAll('p')[0]?.textContent?.trim() || 'Institution/University',
    period: item.querySelectorAll('p')[1]?.textContent?.trim() || '',
  }));

  base.awards = Array.from(wrapper.querySelectorAll('.left-column .panel:nth-of-type(3) .item')).map((item) => ({
    name: item.querySelector('h4')?.textContent?.trim() || 'Name of award',
    organization: item.querySelectorAll('p')[0]?.textContent?.trim() || 'Organisation',
    year: item.querySelectorAll('p')[1]?.textContent?.trim() || '',
  }));

  base.languages = qText('.languages-section p', base.languages);
  base.leftSections = Array.from(wrapper.querySelectorAll('.custom-left-section')).map((section) => ({
    title: section.querySelector('h3')?.textContent?.trim() || 'Section Title',
    text: section.querySelector('p')?.textContent?.trim() || 'Add a short description for this left column section.',
  }));

  base.experience = Array.from(wrapper.querySelectorAll('.experience-container .job')).map((job) => ({
    title: job.querySelector('h4')?.textContent?.trim() || 'Your Job Title Goes Here',
    meta: job.querySelector('.job-meta')?.textContent?.trim() || '',
    summary: job.querySelectorAll('p')[1]?.textContent?.trim() || '',
    bullets: Array.from(job.querySelectorAll('li')).map((li) => li.textContent?.trim() || ''),
  }));

  base.additional = {
    title: qText('.additional-section h3', base.additional.title),
    text: qText('.additional-section p', base.additional.text),
  };

  return base;
}

function App() {
  const cvRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastSchemaRef = useRef(null);
  const isApplyingHistoryRef = useRef(false);
  const printCleanupTimeoutRef = useRef(null);
  const [cvSchema, setCvSchema] = useState(createDefaultCvSchema());
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [isPrinting, setIsPrinting] = useState(false);

  const syncHistoryState = useCallback(() => {
    setHistoryState({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 });
  }, []);

  const persistDocument = useCallback((schema) => writeStoredCvData(schema), []);

  const applySchemaState = useCallback((nextSchema) => {
    isApplyingHistoryRef.current = true;
    setCvSchema(nextSchema);
    lastSchemaRef.current = cloneSchema(nextSchema);
    persistDocument(nextSchema);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  const handleInput = useCallback(() => {
    if (!cvRef.current || isApplyingHistoryRef.current) return;
    const parsedSchema = parseCvHtmlToSchema(cvRef.current.innerHTML);
    const previousSchema = lastSchemaRef.current;
    if (previousSchema && schemaEquals(previousSchema, parsedSchema)) return;

    if (previousSchema) {
      undoStackRef.current.push(cloneSchema(previousSchema));
      if (undoStackRef.current.length > MAX_UNDO_STATES) undoStackRef.current.shift();
    }

    redoStackRef.current = [];
    lastSchemaRef.current = cloneSchema(parsedSchema);
    setCvSchema(parsedSchema);
    persistDocument(parsedSchema);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  const applyDocumentChange = useCallback((updater) => {
    if (isApplyingHistoryRef.current || !lastSchemaRef.current) return;
    const previousSchema = cloneSchema(lastSchemaRef.current);
    const nextSchema = updater(cloneSchema(previousSchema));
    if (!nextSchema || schemaEquals(previousSchema, nextSchema)) return;

    undoStackRef.current.push(previousSchema);
    if (undoStackRef.current.length > MAX_UNDO_STATES) undoStackRef.current.shift();
    redoStackRef.current = [];
    applySchemaState(nextSchema);
  }, [applySchemaState]);

  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length || !lastSchemaRef.current) return;
    const previousSchema = undoStackRef.current.pop();
    redoStackRef.current.push(cloneSchema(lastSchemaRef.current));
    applySchemaState(previousSchema);
  }, [applySchemaState]);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length || !lastSchemaRef.current) return;
    const redoSchema = redoStackRef.current.pop();
    undoStackRef.current.push(cloneSchema(lastSchemaRef.current));
    applySchemaState(redoSchema);
  }, [applySchemaState]);

  const handleAddExperience = useCallback(() => {
    applyDocumentChange((schema) => {
      schema.experience.push({
        title: 'Your Job Title Goes Here',
        meta: 'Company Name | Jan 2012 - Dec 2013',
        summary: 'Highlight earlier relevant experience to show the breadth of your background.',
        bullets: ['Call out achievements that demonstrate transferable skills.'],
      });
      return schema;
    });
  }, [applyDocumentChange]);

  const handleAddLeftSection = useCallback(() => {
    applyDocumentChange((schema) => {
      schema.leftSections.push({
        title: 'Section Title',
        text: 'Add a short description for this left column section.',
      });
      return schema;
    });
  }, [applyDocumentChange]);

  const handleSaveAsPdf = useCallback(() => { setIsPrinting(true); window.print(); if (printCleanupTimeoutRef.current) clearTimeout(printCleanupTimeoutRef.current); printCleanupTimeoutRef.current = window.setTimeout(() => setIsPrinting(false), 1000); }, []);
  const handlePaste = useCallback((event) => { event.preventDefault(); const text = event.clipboardData?.getData('text/plain') ?? ''; document.execCommand('insertText', false, text); }, []);
  const handleKeyDown = useCallback((event) => { const modifierPressed = event.metaKey || event.ctrlKey; if (!modifierPressed || event.key.toLowerCase() !== 'z') return; event.preventDefault(); if (event.shiftKey) handleRedo(); else handleUndo(); }, [handleRedo, handleUndo]);

  useEffect(() => {
    const stored = readStoredCvData();
    if (stored?.schema) {
      const migrated = migrateSchema(stored.schema, stored.schemaVersion);
      setCvSchema(migrated);
      lastSchemaRef.current = cloneSchema(migrated);
      if (!schemaEquals(stored.schema, migrated) || stored.schemaVersion !== CURRENT_SCHEMA_VERSION) persistDocument(migrated);
      syncHistoryState();
      return;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (typeof legacy?.documentHtml === 'string') {
          const migratedSchema = parseCvHtmlToSchema(legacy.documentHtml);
          setCvSchema(migratedSchema);
          lastSchemaRef.current = cloneSchema(migratedSchema);
          persistDocument(migratedSchema);
          syncHistoryState();
          return;
        }
      } catch {
        // ignore legacy parse errors
      }
    }

    const fallback = createDefaultCvSchema();
    setCvSchema(fallback);
    lastSchemaRef.current = cloneSchema(fallback);
    persistDocument(fallback);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (printCleanupTimeoutRef.current) clearTimeout(printCleanupTimeoutRef.current);
    };
  }, []);

  return (
    <main className={`page${isPrinting ? ' is-printing' : ''}`}>
      <header className="toolbar" aria-label="CV editor controls"><h1>CV Editor</h1><p>Click any text in the template to edit it.</p></header>
      <section className="cv-layout">
        {!isPrinting && <div className="history-controls" aria-label="History controls"><button type="button" className="history-button" onClick={handleUndo} disabled={!historyState.canUndo}>Undo</button><button type="button" className="history-button" onClick={handleRedo} disabled={!historyState.canRedo}>Redo</button><button type="button" className="history-button" onClick={handleAddExperience}>Add Experience</button><button type="button" className="history-button" onClick={handleAddLeftSection}>Add Left Section</button></div>}
        <section className="cv-shell">
          <button type="button" className="save-pdf-button" onClick={handleSaveAsPdf} aria-label="Save as PDF" title="Save as PDF"><MdOutlineSaveAs className="save-pdf-icon" aria-hidden="true" focusable="false" /></button>
          <article ref={cvRef} className="cv-document" contentEditable suppressContentEditableWarning spellCheck={false} aria-label="Editable CV template" onPaste={handlePaste} onInput={handleInput} onKeyDown={handleKeyDown}>
            <header className="profile-container hero" data-testid="profile-container"><h2 className="hero-name"><span className="hero-first">{cvSchema.profile.firstName}</span><span className="hero-last">{cvSchema.profile.lastName}</span></h2><p className="hero-title">{cvSchema.profile.title}</p><p className="hero-summary">{cvSchema.profile.summary}</p></header>
            <section className="content-grid" data-testid="columns-container">
              <aside className="contact-container left-column" data-testid="contact-container">
                <section className="panel"><h3>Contact</h3>{cvSchema.contacts.map((item, index) => <p key={`contact-${index}`}>{item}</p>)}</section>
                <section className="panel"><h3>Education</h3>{cvSchema.education.map((item, index) => <div className="item" key={`education-${index}`}><h4>{item.qualification}</h4><p>{item.institution}</p><p>{item.period}</p></div>)}</section>
                <section className="panel"><h3>Awards</h3>{cvSchema.awards.map((item, index) => <div className="item" key={`awards-${index}`}><h4>{item.name}</h4><p>{item.organization}</p><p>{item.year}</p></div>)}</section>
                <section className="panel languages-section" data-testid="languages-section"><h3>Languages</h3><p>{cvSchema.languages}</p></section>
                {cvSchema.leftSections.map((section, index) => <section className="panel custom-left-section" data-testid="custom-left-section" key={`left-${index}`}><h3>{section.title}</h3><p>{section.text}</p></section>)}
              </aside>
              <section className="experience-container right-column" data-testid="experience-container"><section className="panel"><h3>Experience</h3>{cvSchema.experience.map((job, index) => <div className="job" key={`job-${index}`}><h4>{job.title}</h4><p className="job-meta">{job.meta}</p><p>{job.summary}</p><ul>{job.bullets.map((bullet, bulletIndex) => <li key={`job-${index}-bullet-${bulletIndex}`}>{bullet}</li>)}</ul></div>)}</section></section>
            </section>
            <section className="panel additional-section" data-testid="additional-section"><h3>{cvSchema.additional.title}</h3><p>{cvSchema.additional.text}</p></section>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
