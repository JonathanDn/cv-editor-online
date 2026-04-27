import { useCallback } from 'react';

function App() {
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

      <article
        className="cv-document"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        aria-label="Editable CV template"
        onPaste={handlePaste}
      >
        <section className="sidebar">
          <div className="avatar">AJ</div>

          <h2 className="name">Alex Johnson</h2>
          <p className="title">Senior Product Designer</p>

          <section className="block">
            <h3>Contact</h3>
            <p>+1 (555) 321-9988</p>
            <p>alex.johnson@email.com</p>
            <p>San Francisco, CA</p>
            <p>linkedin.com/in/alexjohnson</p>
          </section>

          <section className="block">
            <h3>Skills</h3>
            <ul>
              <li>UI / UX Design</li>
              <li>Design Systems</li>
              <li>Figma &amp; Adobe XD</li>
              <li>Wireframing</li>
              <li>Prototyping</li>
              <li>Team Leadership</li>
            </ul>
          </section>

          <section className="block">
            <h3>Languages</h3>
            <p>English — Native</p>
            <p>Spanish — Fluent</p>
            <p>French — Intermediate</p>
          </section>
        </section>

        <section className="main-content">
          <section className="summary">
            <h3>Profile</h3>
            <p>
              Creative and detail-oriented product designer with 8+ years of experience crafting digital products
              that blend usability, accessibility, and visual storytelling. Passionate about building meaningful user
              experiences and mentoring cross-functional teams.
            </p>
          </section>

          <section className="resume-section">
            <h3>Work Experience</h3>

            <div className="entry">
              <div className="entry-header">
                <h4>Lead Product Designer</h4>
                <span>2022 — Present</span>
              </div>
              <p className="meta">Brightline Tech · San Francisco, CA</p>
              <ul>
                <li>Led end-to-end design for SaaS products used by 120k+ monthly active users.</li>
                <li>Built a component library that reduced design-to-dev handoff time by 35%.</li>
                <li>Collaborated with product and engineering to improve activation rate by 24%.</li>
              </ul>
            </div>

            <div className="entry">
              <div className="entry-header">
                <h4>Product Designer</h4>
                <span>2019 — 2022</span>
              </div>
              <p className="meta">North Harbor Studio · Los Angeles, CA</p>
              <ul>
                <li>Designed responsive dashboard workflows for fintech and healthcare clients.</li>
                <li>Ran user research sessions and translated insights into measurable UX changes.</li>
                <li>Improved task completion rates by 19% through iterative prototype testing.</li>
              </ul>
            </div>
          </section>

          <section className="resume-section">
            <h3>Education</h3>

            <div className="entry">
              <div className="entry-header">
                <h4>M.S. Human-Computer Interaction</h4>
                <span>2017 — 2019</span>
              </div>
              <p className="meta">University of Washington</p>
            </div>

            <div className="entry">
              <div className="entry-header">
                <h4>B.A. Graphic Design</h4>
                <span>2013 — 2017</span>
              </div>
              <p className="meta">California College of the Arts</p>
            </div>
          </section>

          <section className="resume-section">
            <h3>Certifications</h3>
            <p>Google UX Design Professional Certificate</p>
            <p>NN/g UX Certification</p>
          </section>
        </section>
      </article>
    </main>
  );
}

export default App;
