import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAppServer } from '../dev-server.js';

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

test('CV API CRUD, lifecycle, ownership and pagination', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: 'My CV', content_json: { sections: [] } } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.title, 'My CV');

  const badCreate = await jsonReq(base, '/api/cvs', { method: 'POST', body: { title: '' } });
  assert.equal(badCreate.status, 400);

  const list = await jsonReq(base, '/api/cvs?limit=1&page=1');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);

  const id = created.body.data.id;
  const getOne = await jsonReq(base, `/api/cvs/${id}`);
  assert.equal(getOne.status, 200);
  assert.ok(getOne.body.data.updatedAt);
  assert.equal(getOne.body.data.revision, getOne.body.data.updatedAt);

  const forbiddenForOther = await jsonReq(base, `/api/cvs/${id}`, { userId: 'u2' });
  assert.equal(forbiddenForOther.status, 404);

  const updated = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { title: 'Updated CV', updated_at: getOne.body.data.updatedAt }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'Updated CV');

  const conflict = await jsonReq(base, `/api/cvs/${id}`, {
    method: 'PUT',
    body: { title: 'Stale Update', updated_at: getOne.body.data.updatedAt }
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'CV_CONFLICT');

  const archived = await jsonReq(base, `/api/cvs/${id}/archive`, { method: 'POST' });
  assert.equal(archived.body.data.status, 'archived');

  const deleted = await jsonReq(base, `/api/cvs/${id}/delete`, { method: 'POST' });
  assert.equal(deleted.body.data.status, 'deleted');

  const hiddenFromList = await jsonReq(base, '/api/cvs');
  assert.equal(hiddenFromList.body.data.length, 0);

  const restored = await jsonReq(base, `/api/cvs/${id}/restore`, { method: 'POST' });
  assert.equal(restored.body.data.status, 'active');

  server.close();
});

test('CV duplicate endpoint supports overrides and idempotency guard', async () => {
  const server = createAppServer();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const created = await jsonReq(base, '/api/cvs', {
    method: 'POST',
    body: {
      title: 'Source CV',
      targetRole: 'Engineer',
      targetCompany: 'Acme',
      content_json: { sections: [{ id: 1 }] },
      content_text: 'plain text'
    }
  });
  const sourceId = created.body.data.id;

  const duplicate = await jsonReq(base, `/api/cvs/${sourceId}/duplicate`, {
    method: 'POST',
    body: { title: 'Copy CV', targetCompany: 'Beta Corp' }
  });
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.body.data.id, sourceId);
  assert.equal(duplicate.body.data.title, 'Copy CV');
  assert.equal(duplicate.body.data.targetRole, 'Engineer');
  assert.equal(duplicate.body.data.targetCompany, 'Beta Corp');
  assert.deepEqual(duplicate.body.data.content_json, { sections: [{ id: 1 }] });
  assert.equal(duplicate.body.data.content_text, 'plain text');

  const idemHeaders = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'u1',
      'idempotency-key': 'dup-1'
    },
    body: JSON.stringify({})
  };

  const firstIdem = await fetch(`${base}/api/cvs/${sourceId}/duplicate`, idemHeaders);
  const firstIdemBody = await firstIdem.json();
  const secondIdem = await fetch(`${base}/api/cvs/${sourceId}/duplicate`, idemHeaders);
  const secondIdemBody = await secondIdem.json();

  assert.equal(firstIdem.status, 201);
  assert.equal(secondIdem.status, 200);
  assert.equal(firstIdemBody.data.id, secondIdemBody.data.id);

  const unauthorized = await jsonReq(base, `/api/cvs/${sourceId}/duplicate`, {
    method: 'POST',
    userId: 'u2',
    body: {}
  });
  assert.equal(unauthorized.status, 404);

  server.close();
});
