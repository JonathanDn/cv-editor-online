import { useCallback } from 'react';
import { MdOutlineSaveAs } from 'react-icons/md';

function App() {
  const handleSaveAsPdf = useCallback(() => {
    window.print();
  }, []);

  const handlePaste = useCallback((event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <main className="page">
      <header className="toolbar" aria-label="CV editor controls">
        <h1>CV Editor</h1>
        <p>Click any text in the template to edit it.</p>
      </header>

      <section className="cv-shell">
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
        className="cv-document"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        aria-label="Editable CV template"
        onPaste={handlePaste}
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
            </section>
          </section>
        </section>
      </article>
      </section>
    </main>
  );
}

export default App;
