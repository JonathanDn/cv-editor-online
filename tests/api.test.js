import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { __getSnapshotsForTesting, createAppServer } from '../dev-server.js';

const jsonReq = async (base, path, { method = 'GET', userId = 'u1', body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json() };
};

test('API lifecycle: create, list, get, update, duplicate, archive, delete, restore', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'My CV', content_json: { sections: [] } } });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  const listed = await jsonReq(base, '/api/cvs?status=active');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  assert.equal(listed.body.data[0].id, id);

  const fetched = await jsonReq(base, `/api/cvs/${id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.id, id);

  const updated = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { title: 'Updated CV', updated_at: fetched.body.data.updatedAt }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'Updated CV');

  const duplicated = await jsonReq(base, `/api/cvs/${id}/duplicate`, {
    method: 'POST',
    body: { title: 'Updated CV Copy' }
  });
  assert.equal(duplicated.status, 201);
  assert.equal(duplicated.body.data.title, 'Updated CV Copy');

  const archived = await jsonReq(base, `/api/cvs/${id}/archive`, { method: 'POST' });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.data.status, 'archived');

  const deleted = await jsonReq(base, `/api/cvs/${id}/delete`, { method: 'POST' });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.status, 'deleted');

  const restored = await jsonReq(base, `/api/cvs/${id}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.status, 'active');

  server.close();
});

test('Authorization: user A cannot access or mutate user B CV', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const createdByA = await jsonReq(base, '/api/cvs', { method: 'POST', userId: 'user-a', body: { title: 'A CV' } });
  assert.equal(createdByA.status, 201);
  const id = createdByA.body.data.id;

  const getByB = await jsonReq(base, `/api/cvs/${id}`, { userId: 'user-b' });
  assert.equal(getByB.status, 404);

  const updateByB = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    userId: 'user-b',
    body: { title: 'Hacked', updated_at: createdByA.body.data.updatedAt }
  });
  assert.equal(updateByB.status, 404);

  const duplicateByB = await jsonReq(base, `/api/cvs/${id}/duplicate`, { method: 'POST', userId: 'user-b', body: {} });
  assert.equal(duplicateByB.status, 404);

  const archiveByB = await jsonReq(base, `/api/cvs/${id}/archive`, { method: 'POST', userId: 'user-b' });
  assert.equal(archiveByB.status, 404);

  server.close();
});

test('Concurrency: stale updated_at/revision gets HTTP 409 conflict', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'Concurrent CV' } });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  const firstUpdate = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { title: 'First Writer', revision: created.body.data.revision }
  });
  assert.equal(firstUpdate.status, 200);

  const staleUpdate = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { title: 'Second Writer', updated_at: created.body.data.updatedAt }
  });
  assert.equal(staleUpdate.status, 409);
  assert.equal(staleUpdate.body.code, 'CV_CONFLICT');

  server.close();
});

test('Snapshots: creation and retention limit enforcement', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'Snapshot CV', content_json: { v: 0 } } });
  const cvId = created.body.data.id;
  let revision = created.body.data.updatedAt;

  for (let i = 1; i <= 40; i += 1) {
    const reason = i % 2 === 0 ? 'manual_save' : 'autosave';
    const saved = await jsonReq(base, `/api/cvs/${cvId}`, {
      method: 'PUT',
      body: { content_json: { v: i }, updated_at: revision, save_reason: reason }
    });
    assert.equal(saved.status, 200);
    revision = saved.body.data.updatedAt;
  }

  const ownedSnapshots = __getSnapshotsForTesting('u1', cvId);
  assert.equal(ownedSnapshots.length, 20);
  assert.ok(ownedSnapshots.some((row) => row.reason === 'manual_save'));
  assert.ok(ownedSnapshots.some((row) => row.reason === 'autosave_checkpoint'));

  const listedSnapshots = await jsonReq(base, `/api/cvs/${cvId}/snapshots`);
  assert.equal(listedSnapshots.status, 200);
  assert.equal(listedSnapshots.body.data.length, 20);

  const latestSnapshot = listedSnapshots.body.data[0];
  const restored = await jsonReq(base, `/api/cvs/${cvId}/restore-snapshot/${latestSnapshot.id}`, {
    method: 'POST',
    body: { create_pre_restore: true }
  });
  assert.equal(restored.status, 200);

  const postRestoreSnapshots = __getSnapshotsForTesting('u1', cvId);
  assert.equal(postRestoreSnapshots.length, 20);
  assert.ok(postRestoreSnapshots.some((row) => row.reason === 'pre_restore'));

  server.close();
});

test('Tags/folders: assign, unassign, move, and filter', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'Filter CV' } });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(created.body.data.folderId, 'inbox');

  const tagged = await jsonReq(base, `/api/cvs/${id}/tags/engineering`, { method: 'PUT' });
  assert.equal(tagged.status, 200);
  assert.ok(tagged.body.data.tags.includes('engineering'));

  const moved = await jsonReq(base, `/api/cvs/${id}/move`, { method: 'POST', body: { folder_id: 'onsite' } });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.folderId, 'onsite');

  const filtered = await jsonReq(base, '/api/cvs?status=active&tag=engineering&folder_id=onsite');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.data.length, 1);

  const untagged = await jsonReq(base, `/api/cvs/${id}/tags/engineering`, { method: 'DELETE' });
  assert.equal(untagged.status, 200);
  assert.equal(untagged.body.data.tags.length, 0);

  server.close();
});

test('Import/export JSON: exports payload and imports as tagged copy', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'Original CV', content_json: { summary: 'hello' } } });
  const id = created.body.data.id;
  const exported = await jsonReq(base, `/api/cvs/${id}/export/json`);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.data.export_version, '1.0');
  assert.equal(exported.body.data.cv.title, 'Original CV');

  const imported = await jsonReq(base, '/api/cvs/import/json', { method: 'POST', body: exported.body.data });
  assert.equal(imported.status, 201);
  assert.notEqual(imported.body.data.id, id);
  assert.equal(imported.body.data.sourceMetadata.source, 'json_import');

  const badImport = await jsonReq(base, '/api/cvs/import/json', { method: 'POST', body: { nope: true } });
  assert.equal(badImport.status, 400);
  assert.equal(badImport.body.error, 'Import failed');

  server.close();
});

test('CV detail and render-ready endpoint: stable sections and version selection', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', {
    method: 'POST',
    body: { title: 'Structured CV', content_json: { summary: 'Senior engineer', experience: [{ text: 'Built APIs' }] } }
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  const revision = created.body.data.updatedAt;

  assert.ok(Array.isArray(created.body.data.content_json.skills));
  assert.ok(Array.isArray(created.body.data.content_json.education));
  assert.equal(created.body.data.content_json.summary, 'Senior engineer');

  const saved = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { content_json: { summary: 'Principal engineer', skills: ['Node.js'] }, updated_at: revision, save_reason: 'manual_save' }
  });
  assert.equal(saved.status, 200);

  const snapshots = await jsonReq(base, `/api/cvs/${id}/snapshots`);
  assert.equal(snapshots.status, 200);
  assert.ok(snapshots.body.data.length > 0);
  const snapshotId = snapshots.body.data[0].id;

  const renderCurrent = await jsonReq(base, `/api/cvs/${id}/render-ready-text?version=current`);
  assert.equal(renderCurrent.status, 200);
  assert.equal(renderCurrent.body.data.cv_id, id);
  assert.ok(renderCurrent.body.data.section_order.includes('summary'));
  assert.ok(renderCurrent.body.data.section_order.includes('experience'));
  assert.ok(typeof renderCurrent.body.data.render_ready_text === 'string');

  const renderSnapshot = await jsonReq(base, `/api/cvs/${id}/render-ready-text?version=${snapshotId}`);
  assert.equal(renderSnapshot.status, 200);
  assert.equal(renderSnapshot.body.data.version_id, snapshotId);

  const notFoundVersion = await jsonReq(base, `/api/cvs/${id}/render-ready-text?version=missing-snapshot`);
  assert.equal(notFoundVersion.status, 404);

  server.close();
});

test('Analytics: tracks lifecycle events, save failures, dashboard panels, and alert thresholds', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'Analytics CV' } });
  const cvId = created.body.data.id;
  const opened = await jsonReq(base, `/api/cvs/${cvId}`);
  assert.equal(opened.status, 200);

  const saved = await jsonReq(base, `/api/cvs/${cvId}`, { method: 'PUT', body: { title: 'Analytics CV v2', updated_at: opened.body.data.updatedAt } });
  assert.equal(saved.status, 200);

  const conflict = await jsonReq(base, `/api/cvs/${cvId}`, { method: 'PUT', body: { title: 'stale', updated_at: opened.body.data.updatedAt } });
  assert.equal(conflict.status, 409);

  const duplicated = await jsonReq(base, `/api/cvs/${cvId}/duplicate`, { method: 'POST', body: {} });
  assert.equal(duplicated.status, 201);

  const restored = await jsonReq(base, `/api/cvs/${cvId}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);

  const taxBad = await jsonReq(base, '/api/analytics/events', { method: 'POST', body: { event_name: 'cv_save' } });
  assert.equal(taxBad.status, 400);

  const taxGood = await jsonReq(base, '/api/analytics/events', { method: 'POST', body: { event_name: 'cv_saved', status: 'failure', error_code: 'SAVE_TIMEOUT', cv_id: cvId } });
  assert.equal(taxGood.status, 202);

  const dashboard = await jsonReq(base, '/api/analytics/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.panels.length, 3);
  assert.ok(dashboard.body.data.panels.some((panel) => panel.id === 'save_success_rate'));
  assert.ok(dashboard.body.data.panels.some((panel) => panel.id === 'duplicate_success_rate'));
  assert.ok(dashboard.body.data.panels.some((panel) => panel.id === 'weekly_return_to_edit'));
  assert.ok(dashboard.body.data.alerts.some((alert) => alert.id === 'save_failure_rate_elevated' && alert.threshold === 0.05));

  server.close();
});
