import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('renders My CVs route with active, archived, and deleted tabs', () => {
  assert.match(appSource, /<h1>My CVs<\/h1>/);
  assert.match(appSource, /\{ key: 'archived', label: 'Archived' \}/);
  assert.match(appSource, /\{ key: 'deleted', label: 'Deleted' \}/);
});

test('supports selection, bulk actions, and confirmation prompts', () => {
  assert.match(appSource, /\/api\/cvs\/bulk\/\$\{action\}/);
  assert.match(appSource, /window\.confirm\(/);
  assert.match(appSource, />Archive<\/button>/);
  assert.match(appSource, />Delete<\/button>/);
  assert.match(appSource, />Restore<\/button>/);
});

test('supports sort and pagination controls', () => {
  assert.match(appSource, /status, sort, page: String\(page\)/);
  assert.match(appSource, /Most recent/);
  assert.match(appSource, /Page \{page\}/);
});

test('defines core My CVs layout styles', () => {
  assert.match(stylesSource, /\.cvs-page\{/);
  assert.match(stylesSource, /\.cvs-header\{/);
  assert.match(stylesSource, /\.cv-row\{/);
});
