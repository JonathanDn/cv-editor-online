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

  const forbiddenForOther = await jsonReq(base, `/api/cvs/${id}`, { userId: 'u2' });
  assert.equal(forbiddenForOther.status, 404);

  const updated = await jsonReq(base, `/api/cvs/${id}`, { method: 'PUT', body: { title: 'Updated CV' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'Updated CV');

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
