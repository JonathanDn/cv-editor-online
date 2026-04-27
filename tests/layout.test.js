import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('names containers for profile, contact, and experience sections', () => {
  assert.match(appSource, /className="profile-container hero"/);
  assert.match(appSource, /data-testid="profile-container"/);
  assert.match(appSource, /className="contact-container left-column"/);
  assert.match(appSource, /data-testid="contact-container"/);
  assert.match(appSource, /className="experience-container right-column"/);
  assert.match(appSource, /data-testid="experience-container"/);
});

test('includes four experience entries in the template', () => {
  const jobEntries = appSource.match(/<div className="job">/g) ?? [];
  assert.equal(jobEntries.length, 4);
});

test('keeps contact and experience side-by-side on default layout width', () => {
  assert.match(
    stylesSource,
    /\.content-grid\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*31%\s*69%;/
  );
});

test('collapses to single column only at the mobile breakpoint', () => {
  assert.match(
    stylesSource,
    /@media\s*\(width <= 760px\)\s*\{[\s\S]*?\.content-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
  );
});

test('preserves two-column layout in print/PDF output', () => {
  assert.match(stylesSource, /@media print\s*\{/);
  assert.match(
    stylesSource,
    /@media print\s*\{[\s\S]*?\.cv-document\s*\{[\s\S]*?width:\s*210mm;[\s\S]*?height:\s*297mm;/
  );
  assert.match(
    stylesSource,
    /@media print\s*\{[\s\S]*?\.content-grid\s*\{[\s\S]*?grid-template-columns:\s*31%\s*69%;/
  );
  assert.match(
    stylesSource,
    /@media print\s*\{[\s\S]*?\.left-column\s*\{[\s\S]*?border-right:\s*1px solid var\(--divider\);/
  );
});
