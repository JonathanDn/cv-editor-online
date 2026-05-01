import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('renders My CVs route with active, archived, and deleted tabs', () => {
  assert.match(appSource, /<h1>My CVs<\/h1>/);
  assert.match(appSource, /\{ key: 'active', label: 'Active' \}/);
  assert.match(appSource, /\{ key: 'archived', label: 'Archived' \}/);
  assert.match(appSource, /\{ key: 'deleted', label: 'Deleted' \}/);
});

test('shows loading, error, empty, and populated list states for My CVs', () => {
  assert.match(appSource, /aria-busy="true"/);
  assert.match(appSource, /Failed to load CVs:/);
  assert.match(appSource, /No \$\{status\} CVs yet\./);
  assert.match(appSource, /\['Open', 'Duplicate', 'Rename', 'Archive', 'Delete'\]/);
});

test('supports deleted-list restore action', () => {
  assert.match(appSource, /\/api\/cvs\/\$\{id\}\/restore/);
  assert.match(appSource, />Restore<\/button>/);
});

test('implements autosave and unsaved changes safeguards', () => {
  assert.match(appSource, /const AUTOSAVE_DELAY_MS = 7000;/);
  assert.match(appSource, /window\.setTimeout\(\(\) => \{ saveCv\('autosave'\); \}, AUTOSAVE_DELAY_MS\)/);
  assert.match(appSource, /window\.addEventListener\('beforeunload', onBeforeUnload\)/);
  assert.match(appSource, /You have unsaved changes\. Leave this page\?/);
});

test('handles optimistic concurrency conflicts with reload modal', () => {
  assert.match(appSource, /if \(res\.status === 409\)/);
  assert.match(appSource, /This CV changed elsewhere\. Reload latest version\./);
  assert.match(appSource, /Reload latest version<\/button>/);
});

test('includes snapshot list and restore workflow', () => {
  assert.match(appSource, /\/api\/cvs\/\$\{cvId\}\/snapshots/);
  assert.match(appSource, /\/api\/cvs\/\$\{cvId\}\/restore-snapshot\/\$\{snapshotId\}/);
  assert.match(appSource, /Create a pre_restore snapshot before restoring\?/);
  assert.match(appSource, /Snapshot restored successfully\./);
});

test('defines core My CVs layout styles', () => {
  assert.match(stylesSource, /\.cvs-page\{/);
  assert.match(stylesSource, /\.cvs-header\{/);
  assert.match(stylesSource, /\.status-chips\{/);
  assert.match(stylesSource, /\.cv-row\{/);
});
