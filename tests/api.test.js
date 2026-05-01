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
