import { useCallback, useEffect, useRef, useState } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

const LOCAL_STORAGE_KEY = 'cvEditorData';
const CURRENT_TEMPLATE_VERSION = 4;
const EXPERIENCE_JOB_SELECTOR = '.experience-container .panel .job';
const ADDITIONAL_SECTION_SELECTOR = '.additional-section';
const MAX_UNDO_STATES = 50;

const fifthExperienceMarkup = `
  <div class="job">
    <h4>Your Job Title Goes Here</h4>
    <p class="job-meta">Company Name | Jan 2012 - Dec 2013</p>
    <p>Highlight earlier relevant experience to show the breadth of your background.</p>
    <ul>
      <li>Call out achievements that demonstrate transferable skills.</li>
    </ul>
  </div>
`;

const additionalSectionMarkup = `
  <section class="panel additional-section" data-testid="additional-section">
    <h3>Additional Information</h3>
    <p>Add extra achievements, projects, certifications, or volunteer work here.</p>
  </section>
`;

function readStoredCvData() {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.documentHtml === 'string' &&
      typeof parsed.templateVersion === 'number'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function writeStoredCvData(documentHtml) {
  const payload = {
    documentHtml,
    templateVersion: CURRENT_TEMPLATE_VERSION,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
}

function migrateDocumentHtml(documentHtml, templateVersion) {
  if (templateVersion >= CURRENT_TEMPLATE_VERSION) {
    return documentHtml;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = documentHtml;

  const experiencePanel = wrapper.querySelector('.experience-container .panel');
  const hasAdditionalSection = wrapper.querySelector(ADDITIONAL_SECTION_SELECTOR);

  if (!experiencePanel) {
    return documentHtml;
  }

  const existingJobs = experiencePanel.querySelectorAll(EXPERIENCE_JOB_SELECTOR);

  if (existingJobs.length < 5) {
    experiencePanel.insertAdjacentHTML('beforeend', fifthExperienceMarkup);
  }

  if (!hasAdditionalSection) {
    const contentGrid = wrapper.querySelector('.content-grid');
    contentGrid?.insertAdjacentHTML('afterend', additionalSectionMarkup);
  }

  return wrapper.innerHTML;
}

function App() {
  const cvRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastDocumentHtmlRef = useRef('');
  const isApplyingHistoryRef = useRef(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, []);

  const persistDocument = useCallback((documentHtml) => {
    writeStoredCvData(documentHtml);
  }, []);

  const handleSaveAsPdf = useCallback(() => {
    window.print();
  }, []);

  const handlePaste = useCallback((event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }, []);

  const handleInput = useCallback(() => {
    if (!cvRef.current || isApplyingHistoryRef.current) {
      return;
    }

    const currentHtml = cvRef.current.innerHTML;
    const previousHtml = lastDocumentHtmlRef.current;

    if (currentHtml === previousHtml) {
      return;
    }

    if (previousHtml) {
      undoStackRef.current.push(previousHtml);
      if (undoStackRef.current.length > MAX_UNDO_STATES) {
        undoStackRef.current.shift();
      }
    }

    redoStackRef.current = [];
    lastDocumentHtmlRef.current = currentHtml;
    persistDocument(currentHtml);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  const applyHistoryState = useCallback((nextHtml) => {
    if (!cvRef.current) {
      return;
    }

    isApplyingHistoryRef.current = true;
    cvRef.current.innerHTML = nextHtml;
    lastDocumentHtmlRef.current = nextHtml;
    persistDocument(nextHtml);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) {
      return;
    }

    const currentHtml = lastDocumentHtmlRef.current;
    const previousHtml = undoStackRef.current.pop();

    if (currentHtml) {
      redoStackRef.current.push(currentHtml);
    }

    if (previousHtml) {
      applyHistoryState(previousHtml);
    }
  }, [applyHistoryState]);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) {
      return;
    }

    const currentHtml = lastDocumentHtmlRef.current;
    const redoHtml = redoStackRef.current.pop();

    if (currentHtml) {
      undoStackRef.current.push(currentHtml);
    }

    if (redoHtml) {
      applyHistoryState(redoHtml);
    }
  }, [applyHistoryState]);

  const handleKeyDown = useCallback((event) => {
    const modifierPressed = event.metaKey || event.ctrlKey;

    if (!modifierPressed || event.key.toLowerCase() !== 'z') {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      handleRedo();
      return;
    }

    handleUndo();
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    if (!cvRef.current) {
      return;
    }

    const storedCvData = readStoredCvData();

    if (storedCvData?.documentHtml) {
      const migratedDocumentHtml = migrateDocumentHtml(
        storedCvData.documentHtml,
        storedCvData.templateVersion
      );

      cvRef.current.innerHTML = migratedDocumentHtml;
      lastDocumentHtmlRef.current = migratedDocumentHtml;
      syncHistoryState();

      if (
        storedCvData.templateVersion !== CURRENT_TEMPLATE_VERSION ||
        storedCvData.documentHtml !== migratedDocumentHtml
      ) {
        writeStoredCvData(migratedDocumentHtml);
      }

      return;
    }

    lastDocumentHtmlRef.current = cvRef.current.innerHTML;
    persistDocument(cvRef.current.innerHTML);
    syncHistoryState();
  }, [persistDocument, syncHistoryState]);

  return (
    <main className="page">
      <header className="toolbar" aria-label="CV editor controls">
        <h1>CV Editor</h1>
        <p>Click any text in the template to edit it.</p>
      </header>

      <section className="cv-shell">
        <div className="history-controls" aria-label="History controls">
          <button type="button" className="history-button" onClick={handleUndo} disabled={!historyState.canUndo}>
            Undo
          </button>
          <button type="button" className="history-button" onClick={handleRedo} disabled={!historyState.canRedo}>
            Redo
          </button>
        </div>

        <button
          type="button"
          className="save-pdf-button"
          onClick={handleSaveAsPdf}
          aria-label="Save as PDF"
          title="Save as PDF"
        >
          <MdOutlineSaveAs className="save-pdf-icon" aria-hidden="true" focusable="false" />
        </button>

        <article
          ref={cvRef}
          className="cv-document"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          aria-label="Editable CV template"
          onPaste={handlePaste}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        >
          <header className="profile-container hero" data-testid="profile-container">
            <h2 className="hero-name">
              <span className="hero-first">JANE</span>
              <span className="hero-last">AUSTEN</span>
            </h2>
            <p className="hero-title">PROFESSIONAL TITLE</p>
            <p className="hero-summary">
              Summarise yourself and why you're a good fit for the role in a few sentences. Your CV is meant to help you
              get an interview, so make them want to know you more. Help do this by tailoring your CV to the job you're
              applying for - of course your education and experience doesn't change, but what you highlight should.
            </p>
          </header>

          <section className="content-grid" data-testid="columns-container">
            <aside className="contact-container left-column" data-testid="contact-container">
              <section className="panel">
                <h3>Contact</h3>
                <p>+1 123 1234 1123 ☎</p>
                <p>personalemail@email.com ✉</p>
                <p>LinkedIn.com/username 👤</p>
              </section>

              <section className="panel">
                <h3>Education</h3>
                <div className="item">
                  <h4>Qualification</h4>
                  <p>Institution/University</p>
                  <p>2014 - 2015</p>
                </div>
                <div className="item">
                  <h4>Qualification</h4>
                  <p>Institution/University</p>
                  <p>2010 - 2014</p>
                </div>
                <div className="item">
                  <h4>Qualification</h4>
                  <p>Institution/University</p>
                  <p>2008 - 2010</p>
                </div>
              </section>

              <section className="panel">
                <h3>Awards</h3>
                <div className="item">
                  <h4>Name of award</h4>
                  <p>Organisation</p>
                  <p>2017</p>
                </div>
                <div className="item">
                  <h4>Name of award</h4>
                  <p>Organisation</p>
                  <p>2014</p>
                </div>
              </section>
            </aside>

            <section className="experience-container right-column" data-testid="experience-container">
              <section className="panel">
                <h3>Experience</h3>

                <div className="job">
                  <h4>Your Job Title Goes Here</h4>
                  <p className="job-meta">Company Name | Dec 2018 - Current</p>
                  <p>
                    Briefly summarise your responsibilities. But what recruiters really want to see is the impact you've
                    had, so use the bullet points to give specific examples of some of the key achievements you had in
                    the role.
                  </p>
                  <ul>
                    <li>For example, did you increase sales by 50% over 6 months</li>
                    <li>Or perhaps you negotiated a new contract with a different supplier, saving your company $x a year</li>
                    <li>Make sure the examples are specific, measurable and related to the job you're applying for</li>
                  </ul>
                </div>

                <div className="job">
                  <h4>Your Job Title Goes Here</h4>
                  <p className="job-meta">Company Name | Sept 2016 - Dec 2018</p>
                  <p>
                    Remember to turn on Spelling and Grammar, and make sure you check and check again for typos, errors
                    and formatting issues- zooming in helps here.
                  </p>
                  <ul>
                    <li>Try not to waffle and keep your points succinct</li>
                    <li>Avoid clichés and tell the truth. Use active verbs.</li>
                  </ul>
                </div>

                <div className="job">
                  <h4>Your Job Title Goes Here</h4>
                  <p className="job-meta">Company Name | Sept 2016 - Dec 2018</p>
                  <p>
                    Remember to turn on Spelling and Grammar, and make sure you check and check again for typos, errors
                    and formatting issues- zooming in helps here.
                  </p>
                  <ul>
                    <li>Try not to waffle and keep your points succinct</li>
                    <li>Avoid clichés and tell the truth. Use active verbs.</li>
                  </ul>
                </div>

                <div className="job">
                  <h4>Your Job Title Goes Here</h4>
                  <p className="job-meta">Company Name | Jan 2014 - Aug 2016</p>
                  <p>Include your earlier experience when it supports the role you're applying for.</p>
                  <ul>
                    <li>Keep each point concise and focused on impact.</li>
                  </ul>
                </div>

                <div className="job">
                  <h4>Your Job Title Goes Here</h4>
                  <p className="job-meta">Company Name | Jan 2012 - Dec 2013</p>
                  <p>Highlight earlier relevant experience to show the breadth of your background.</p>
                  <ul>
                    <li>Call out achievements that demonstrate transferable skills.</li>
                  </ul>
                </div>
              </section>
            </section>
          </section>

          <section className="panel additional-section" data-testid="additional-section">
            <h3>Additional Information</h3>
            <p>Add extra achievements, projects, certifications, or volunteer work here.</p>
          </section>
        </article>
      </section>
    </main>
  );
}

export default App;
