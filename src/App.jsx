import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Monitor,
  Palette,
  RotateCcw,
  Save,
  Smartphone
} from "lucide-react";

import Editable from "./components/Editable.jsx";
import EditableList from "./components/EditableList.jsx";
import { DEFAULT_CV } from "./data/defaultCv.js";

function updateAt(list, index, patch) {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export default function App() {
  const [cv, setCv] = useState(() => {
    try {
      const saved = localStorage.getItem("editable-cv-template");
      return saved ? JSON.parse(saved) : DEFAULT_CV;
    } catch {
      return DEFAULT_CV;
    }
  });

  const [view, setView] = useState("desktop");
  const [accent, setAccent] = useState("#111111");

  useEffect(() => {
    localStorage.setItem("editable-cv-template", JSON.stringify(cv));
  }, [cv]);

  const sectionTitle = useMemo(
      () => "section-title",
      []
  );

  const setField = (field, value) => {
    setCv((current) => ({ ...current, [field]: value }));
  };

  const setContact = (field, value) => {
    setCv((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [field]: value
      }
    }));
  };

  const reset = () => {
    if (window.confirm("Reset the CV to the original template?")) {
      localStorage.removeItem("editable-cv-template");
      setCv(DEFAULT_CV);
    }
  };

  const addExperience = () => {
    setCv((current) => ({
      ...current,
      experience: [
        ...current.experience,
        {
          role: "NEW JOB TITLE",
          company: "COMPANY NAME",
          dates: "START – END",
          description: "Summarise your work and impact here.",
          bullets: ["Add a measurable achievement"]
        }
      ]
    }));
  };

  const removeExperience = (index) => {
    setCv((current) => ({
      ...current,
      experience: current.experience.filter((_, i) => i !== index)
    }));
  };

  const addEducation = () => {
    setCv((current) => ({
      ...current,
      education: [
        ...current.education,
        {
          qualification: "QUALIFICATION",
          institution: "Institution/University",
          years: "Year – Year"
        }
      ]
    }));
  };

  const removeEducation = (index) => {
    setCv((current) => ({
      ...current,
      education: current.education.filter((_, i) => i !== index)
    }));
  };

  return (
      <div className="app" style={{ "--accent": accent }}>
        <header className="screen-only toolbar">
          <div>
            <h1>Editable CV Template</h1>
            <p>Click any text on the CV to edit it. Changes autosave.</p>
          </div>

          <div className="toolbar-actions">
            <button
                className="toolbar-btn"
                onClick={() => setView(view === "desktop" ? "mobile" : "desktop")}
            >
              {view === "desktop" ? <Smartphone size={16} /> : <Monitor size={16} />}
              {view === "desktop" ? "Mobile preview" : "Desktop preview"}
            </button>

            <label className="toolbar-btn">
              <Palette size={16} />
              Accent
              <input
                  type="color"
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
              />
            </label>

            <button className="toolbar-btn" onClick={reset}>
              <RotateCcw size={16} />
              Reset
            </button>

            <button className="toolbar-btn dark" onClick={() => window.print()}>
              <Download size={16} />
              Download PDF
            </button>

            <span className="toolbar-btn">
            <Save size={16} />
            Autosaved
          </span>
          </div>
        </header>

        <main className="print-wrap">
          <article className={`cv-page ${view === "mobile" ? "phone-preview" : ""}`}>
            <aside className="brand-panel">
              <div className="brand-text">
                <div className="brand-main">Download</div>
                <div className="brand-sub">COLLECTIVE</div>
              </div>
            </aside>

            <section className="cv-content">
              <header className="cv-header">
                <div className="name-row">
                  <Editable
                      value={cv.firstName}
                      onChange={(value) => setField("firstName", value)}
                      className="first-name"
                  />
                  <Editable
                      value={cv.lastName}
                      onChange={(value) => setField("lastName", value)}
                      className="last-name"
                  />
                </div>

                <Editable
                    value={cv.title}
                    onChange={(value) => setField("title", value)}
                    className="professional-title"
                />

                <Editable
                    value={cv.summary}
                    onChange={(value) => setField("summary", value)}
                    className="summary"
                    multiline
                />
              </header>

              <div className="cv-grid">
                <aside className="left-column">
                  <section>
                    <h2 className={sectionTitle}>Contact</h2>

                    <div className="contact-list">
                      <Editable
                          value={cv.contact.phone}
                          onChange={(value) => setContact("phone", value)}
                      />
                      <Editable
                          value={cv.contact.email}
                          onChange={(value) => setContact("email", value)}
                      />
                      <Editable
                          value={cv.contact.linkedin}
                          onChange={(value) => setContact("linkedin", value)}
                      />
                    </div>
                  </section>

                  <div className="small-divider" />

                  <section>
                    <h2 className={sectionTitle}>Education</h2>

                    <div className="education-list">
                      {cv.education.map((item, index) => (
                          <div className="education-item" key={index}>
                            <Editable
                                value={item.qualification}
                                onChange={(value) =>
                                    setCv((current) => ({
                                      ...current,
                                      education: updateAt(current.education, index, {
                                        qualification: value
                                      })
                                    }))
                                }
                                className="qualification"
                            />

                            <Editable
                                value={item.institution}
                                onChange={(value) =>
                                    setCv((current) => ({
                                      ...current,
                                      education: updateAt(current.education, index, {
                                        institution: value
                                      })
                                    }))
                                }
                                className="small-text"
                            />

                            <Editable
                                value={item.years}
                                onChange={(value) =>
                                    setCv((current) => ({
                                      ...current,
                                      education: updateAt(current.education, index, {
                                        years: value
                                      })
                                    }))
                                }
                                className="small-text"
                            />

                            <button
                                className="screen-only mini-btn remove-education"
                                onClick={() => removeEducation(index)}
                            >
                              ×
                            </button>
                          </div>
                      ))}
                    </div>

                    <button className="screen-only add-btn" onClick={addEducation}>
                      + Add education
                    </button>
                  </section>

                  <div className="small-divider" />

                  <section>
                    <h2 className={sectionTitle}>Awards</h2>

                    <EditableList
                        items={cv.awards}
                        onChange={(awards) =>
                            setCv((current) => ({ ...current, awards }))
                        }
                        placeholder="Award or certification"
                    />
                  </section>
                </aside>

                <section className="right-column">
                  <h2 className={sectionTitle}>Experience</h2>

                  <div className="experience-list">
                    {cv.experience.map((job, index) => (
                        <section className="experience-item" key={index}>
                          <Editable
                              value={job.role}
                              onChange={(value) =>
                                  setCv((current) => ({
                                    ...current,
                                    experience: updateAt(current.experience, index, {
                                      role: value
                                    })
                                  }))
                              }
                              className="job-role"
                          />

                          <div className="job-meta">
                            <Editable
                                value={job.company}
                                onChange={(value) =>
                                    setCv((current) => ({
                                      ...current,
                                      experience: updateAt(current.experience, index, {
                                        company: value
                                      })
                                    }))
                                }
                            />
                            <span>|</span>
                            <Editable
                                value={job.dates}
                                onChange={(value) =>
                                    setCv((current) => ({
                                      ...current,
                                      experience: updateAt(current.experience, index, {
                                        dates: value
                                      })
                                    }))
                                }
                            />
                          </div>

                          <Editable
                              value={job.description}
                              onChange={(value) =>
                                  setCv((current) => ({
                                    ...current,
                                    experience: updateAt(current.experience, index, {
                                      description: value
                                    })
                                  }))
                              }
                              className="job-description"
                              multiline
                          />

                          <EditableList
                              items={job.bullets}
                              onChange={(bullets) =>
                                  setCv((current) => ({
                                    ...current,
                                    experience: updateAt(current.experience, index, {
                                      bullets
                                    })
                                  }))
                              }
                              placeholder="Add a measurable achievement"
                          />

                          <button
                              className="screen-only mini-btn remove-experience"
                              onClick={() => removeExperience(index)}
                          >
                            ×
                          </button>
                        </section>
                    ))}
                  </div>

                  <button className="screen-only add-btn" onClick={addExperience}>
                    + Add experience
                  </button>
                </section>
              </div>
            </section>
          </article>
        </main>
      </div>
  );
}