import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve('.');
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const MAX_TITLE_LENGTH = 140;
const MAX_COMPANY_LENGTH = 140;
const MAX_ROLE_LENGTH = 140;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_TAG_LENGTH = 60;
const MAX_FOLDER_LENGTH = 80;

const cvs = [];
let nextId = 1;
const duplicateGuards = new Map();
const snapshots = [];
let nextSnapshotId = 1;
const AUTOSAVE_SNAPSHOT_INTERVAL = 5;
const SNAPSHOT_RETENTION_LIMIT = 20;

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const getAuthUserId = (req) => {
  const userIdHeader = req.headers['x-user-id'];
  if (typeof userIdHeader === 'string' && userIdHeader.trim()) {
    return userIdHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) return token;
  }

  return null;
};

const readJsonBody = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024 * 1024) {
      throw new Error('Payload too large');
    }
  }

  if (!body) return {};
  return JSON.parse(body);
};

const toDto = (cv) => ({
  id: cv.id,
  title: cv.title,
  targetRole: cv.targetRole,
  targetCompany: cv.targetCompany,
  content_json: cv.contentJson,
  content_text: cv.contentText,
  status: cv.status,
  createdAt: cv.createdAt,
  updatedAt: cv.updatedAt,
  revision: cv.updatedAt,
  lastOpenedAt: cv.lastOpenedAt,
  folderId: cv.folderId,
  tags: cv.tags
});

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const validatePayload = (payload, { requireTitle = false } = {}) => {
  if (!isPlainObject(payload)) {
    return 'Payload must be a JSON object';
  }

  if (requireTitle && typeof payload.title !== 'string') {
    return 'title is required';
  }

  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      return 'title must be a non-empty string';
    }
    if (payload.title.length > MAX_TITLE_LENGTH) {
      return `title must be <= ${MAX_TITLE_LENGTH} chars`;
    }
  }

  if (payload.targetRole !== undefined && (typeof payload.targetRole !== 'string' || payload.targetRole.length > MAX_ROLE_LENGTH)) {
    return `targetRole must be a string <= ${MAX_ROLE_LENGTH} chars`;
  }

  if (payload.targetCompany !== undefined && (typeof payload.targetCompany !== 'string' || payload.targetCompany.length > MAX_COMPANY_LENGTH)) {
    return `targetCompany must be a string <= ${MAX_COMPANY_LENGTH} chars`;
  }

  if (payload.content_json !== undefined && !isPlainObject(payload.content_json) && !Array.isArray(payload.content_json)) {
    return 'content_json must be a JSON object or array';
  }

  if (payload.content_text !== undefined && payload.content_text !== null && typeof payload.content_text !== 'string') {
    return 'content_text must be a string or null';
  }

  if (payload.updated_at !== undefined && typeof payload.updated_at !== 'string') {
    return 'updated_at must be a string';
  }

  if (payload.revision !== undefined && typeof payload.revision !== 'string') {
    return 'revision must be a string';
  }

  if (payload.save_reason !== undefined && payload.save_reason !== 'manual_save' && payload.save_reason !== 'autosave') {
    return 'save_reason must be manual_save or autosave';
  }
  if (payload.create_pre_restore !== undefined && typeof payload.create_pre_restore !== 'boolean') {
    return 'create_pre_restore must be a boolean';
  }
  if (payload.folder_id !== undefined && payload.folder_id !== null && (typeof payload.folder_id !== 'string' || payload.folder_id.length > MAX_FOLDER_LENGTH)) {
    return `folder_id must be a string <= ${MAX_FOLDER_LENGTH} chars or null`;
  }

  return null;
};

const parsePagination = (url) => {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit') || DEFAULT_LIMIT)));
  const cursor = url.searchParams.get('cursor');
  const pageParam = url.searchParams.get('page');
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;
  const status = (url.searchParams.get('status') || 'active').toLowerCase();
  const folderId = url.searchParams.get('folder_id');
  const tag = url.searchParams.get('tag');
  return { limit, cursor, page, status, folderId, tag };
};

const writeSnapshot = ({ cv, reason }) => {
  try {
    snapshots.push({
      id: String(nextSnapshotId++),
      cvId: cv.id,
      userId: cv.userId,
      contentJson: cv.contentJson,
      createdAt: new Date().toISOString(),
      reason
    });

    const cvSnapshots = snapshots
      .filter((row) => row.cvId === cv.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (cvSnapshots.length > SNAPSHOT_RETENTION_LIMIT) {
      const keepIds = new Set(cvSnapshots.slice(0, SNAPSHOT_RETENTION_LIMIT).map((row) => row.id));
      for (let i = snapshots.length - 1; i >= 0; i -= 1) {
        if (snapshots[i].cvId === cv.id && !keepIds.has(snapshots[i].id)) {
          snapshots.splice(i, 1);
        }
      }
    }
  } catch (error) {
    console.warn('Snapshot write failed', {
      cvId: cv.id,
      userId: cv.userId,
      reason,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const requestHandler = async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    const method = req.method || 'GET';

    const userId = getAuthUserId(req);

    if (pathname.startsWith('/api/cvs')) {
      if (!userId) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      if (method === 'POST' && pathname === '/api/cvs') {
        const payload = await readJsonBody(req);
        const err = validatePayload(payload, { requireTitle: true });
        if (err) return sendJson(res, 400, { error: err });
        const now = new Date().toISOString();
        const cv = {
          id: String(nextId++),
          userId,
          title: payload.title.trim(),
          targetRole: payload.targetRole || null,
          targetCompany: payload.targetCompany || null,
          contentJson: payload.content_json ?? {},
          contentText: payload.content_text ?? null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          deletedAt: null,
          archivedAt: null,
          saveCount: 0,
          folderId: payload.folder_id ?? 'inbox',
          tags: []
        };
        cvs.push(cv);
        return sendJson(res, 201, { data: toDto(cv) });
      }

      if (method === 'GET' && pathname === '/api/cvs') {
        const { limit, cursor, page, status, folderId, tag } = parsePagination(url);
        const allowedStatuses = new Set(['active', 'archived', 'deleted']);
        const requestedStatus = allowedStatuses.has(status) ? status : 'active';
        const owned = cvs
          .filter((cv) => cv.userId === userId && cv.status === requestedStatus)
          .filter((cv) => (!folderId ? true : cv.folderId === folderId))
          .filter((cv) => (!tag ? true : cv.tags.includes(tag)))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        let startIndex = 0;
        if (cursor) {
          const idx = owned.findIndex((cv) => cv.id === cursor);
          startIndex = idx >= 0 ? idx + 1 : 0;
        } else if (page > 1) {
          startIndex = (page - 1) * limit;
        }

        const data = owned.slice(startIndex, startIndex + limit).map(toDto);
        const nextCursor = data.length === limit ? data[data.length - 1].id : null;
        return sendJson(res, 200, { data, pagination: { limit, nextCursor, page } });
      }

      const idMatch = pathname.match(/^\/api\/cvs\/([^/]+)$/);
      if (idMatch && method === 'GET') {
        const cv = cvs.find((row) => row.id === idMatch[1] && row.userId === userId && !row.deletedAt);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        cv.lastOpenedAt = new Date().toISOString();
        return sendJson(res, 200, { data: toDto(cv) });
      }

      if (idMatch && method === 'PUT') {
        const cv = cvs.find((row) => row.id === idMatch[1] && row.userId === userId && !row.deletedAt);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const payload = await readJsonBody(req);
        const err = validatePayload(payload, { requireTitle: false });
        if (err) return sendJson(res, 400, { error: err });
        const clientRevision = payload.updated_at ?? payload.revision;
        if (!clientRevision) {
          return sendJson(res, 400, { error: 'updated_at (or revision) is required' });
        }
        if (clientRevision !== cv.updatedAt) {
          return sendJson(res, 409, {
            error: 'Conflict',
            code: 'CV_CONFLICT',
            message: 'This CV changed elsewhere. Reload latest version.',
            guidance: 'Please refresh/reload to get the latest version before saving.',
            server: {
              updated_at: cv.updatedAt,
              revision: cv.updatedAt
            }
          });
        }

        if (payload.title !== undefined) cv.title = payload.title.trim();
        if (payload.targetRole !== undefined) cv.targetRole = payload.targetRole;
        if (payload.targetCompany !== undefined) cv.targetCompany = payload.targetCompany;
        if (payload.content_json !== undefined) cv.contentJson = payload.content_json;
        if (payload.content_text !== undefined) cv.contentText = payload.content_text;
        if (payload.folder_id !== undefined) cv.folderId = payload.folder_id ?? 'inbox';
        cv.saveCount = (cv.saveCount || 0) + 1;
        cv.updatedAt = new Date().toISOString();

        const saveReason = payload.save_reason === 'manual_save' ? 'manual_save' : 'autosave';
        if (saveReason === 'manual_save') {
          writeSnapshot({ cv, reason: 'manual_save' });
        } else if (cv.saveCount % AUTOSAVE_SNAPSHOT_INTERVAL === 0) {
          writeSnapshot({ cv, reason: 'autosave_checkpoint' });
        }

        return sendJson(res, 200, { data: toDto(cv) });
      }

      const duplicateMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/duplicate$/);
      if (duplicateMatch && method === 'POST') {
        const sourceId = duplicateMatch[1];
        const source = cvs.find((row) => row.id === sourceId && row.userId === userId && !row.deletedAt);
        if (!source) return sendJson(res, 404, { error: 'Not found' });

        const payload = await readJsonBody(req);
        const err = validatePayload(payload, { requireTitle: false });
        if (err) return sendJson(res, 400, { error: err });

        const idemHeader = req.headers['idempotency-key'];
        const idemKey = typeof idemHeader === 'string' ? idemHeader.trim() : '';
        const guardKey = idemKey ? `${userId}:${sourceId}:${idemKey}` : `${userId}:${sourceId}:recent`;
        const nowMs = Date.now();
        const existing = duplicateGuards.get(guardKey);
        if (existing && nowMs - existing.createdAtMs < 5000) {
          const duplicated = cvs.find((row) => row.id === existing.cvId && row.userId === userId);
          if (duplicated) return sendJson(res, 200, { data: toDto(duplicated) });
        }

        const now = new Date().toISOString();
        const duplicated = {
          id: String(nextId++),
          userId,
          title: payload.title !== undefined ? payload.title.trim() : source.title,
          targetRole: payload.targetRole !== undefined ? payload.targetRole : source.targetRole,
          targetCompany: payload.targetCompany !== undefined ? payload.targetCompany : source.targetCompany,
          contentJson: source.contentJson,
          contentText: source.contentText,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          deletedAt: null,
          archivedAt: null,
          saveCount: 0,
          folderId: source.folderId || 'inbox',
          tags: [...(source.tags || [])]
        };
        cvs.push(duplicated);
        duplicateGuards.set(guardKey, { cvId: duplicated.id, createdAtMs: nowMs });
        return sendJson(res, 201, { data: toDto(duplicated) });
      }

      const actionMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/(archive|delete|restore)$/);
      if (actionMatch && method === 'POST') {
        const [, id, action] = actionMatch;
        const cv = cvs.find((row) => row.id === id && row.userId === userId);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const now = new Date().toISOString();

        if (action === 'archive') {
          cv.status = 'archived';
          cv.archivedAt = now;
        } else if (action === 'delete') {
          cv.status = 'deleted';
          cv.deletedAt = now;
        } else if (action === 'restore') {
          cv.status = 'active';
          cv.deletedAt = null;
          cv.archivedAt = null;
        }

        cv.updatedAt = now;
        return sendJson(res, 200, { data: toDto(cv) });
      }

      const snapshotsListMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/snapshots$/);
      if (snapshotsListMatch && method === 'GET') {
        const cv = cvs.find((row) => row.id === snapshotsListMatch[1] && row.userId === userId);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const data = snapshots
          .filter((row) => row.cvId === cv.id && row.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((row) => ({ id: row.id, createdAt: row.createdAt, reason: row.reason }));
        return sendJson(res, 200, { data });
      }

      const tagsMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/tags\/([^/]+)$/);
      if (tagsMatch && (method === 'PUT' || method === 'DELETE')) {
        const [, cvId, rawTag] = tagsMatch;
        const cv = cvs.find((row) => row.id === cvId && row.userId === userId && !row.deletedAt);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const tag = decodeURIComponent(rawTag).trim().toLowerCase();
        if (!tag || tag.length > MAX_TAG_LENGTH) return sendJson(res, 400, { error: `tag must be 1-${MAX_TAG_LENGTH} chars` });
        cv.tags = Array.isArray(cv.tags) ? cv.tags : [];
        if (method === 'PUT' && !cv.tags.includes(tag)) cv.tags.push(tag);
        if (method === 'DELETE') cv.tags = cv.tags.filter((value) => value !== tag);
        cv.updatedAt = new Date().toISOString();
        return sendJson(res, 200, { data: toDto(cv) });
      }

      const moveMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/move$/);
      if (moveMatch && method === 'POST') {
        const cv = cvs.find((row) => row.id === moveMatch[1] && row.userId === userId && !row.deletedAt);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const payload = await readJsonBody(req);
        if (payload.folder_id !== null && (typeof payload.folder_id !== 'string' || payload.folder_id.trim() === '' || payload.folder_id.length > MAX_FOLDER_LENGTH)) {
          return sendJson(res, 400, { error: `folder_id must be a non-empty string <= ${MAX_FOLDER_LENGTH} chars or null` });
        }
        cv.folderId = payload.folder_id ?? 'inbox';
        cv.updatedAt = new Date().toISOString();
        return sendJson(res, 200, { data: toDto(cv) });
      }

      const restoreSnapshotMatch = pathname.match(/^\/api\/cvs\/([^/]+)\/restore-snapshot\/([^/]+)$/);
      if (restoreSnapshotMatch && method === 'POST') {
        const [, cvId, snapshotId] = restoreSnapshotMatch;
        const cv = cvs.find((row) => row.id === cvId && row.userId === userId);
        if (!cv) return sendJson(res, 404, { error: 'Not found' });
        const snapshot = snapshots.find((row) => row.id === snapshotId && row.cvId === cvId && row.userId === userId);
        if (!snapshot) return sendJson(res, 404, { error: 'Snapshot not found' });

        const payload = await readJsonBody(req);
        const err = validatePayload(payload, { requireTitle: false });
        if (err) return sendJson(res, 400, { error: err });
        if (payload.create_pre_restore) {
          writeSnapshot({ cv, reason: 'pre_restore' });
        }

        cv.contentJson = snapshot.contentJson;
        cv.updatedAt = new Date().toISOString();
        return sendJson(res, 200, { data: toDto(cv) });
      }

      return sendJson(res, 404, { error: 'Not found' });
    }

    let staticPath = pathname;
    if (staticPath === '/') {
      staticPath = '/index.html';
    }

    const filePath = join(root, staticPath);
    const data = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
};

export const createAppServer = () => createServer(requestHandler);
export const __getSnapshotsForTesting = (userId, cvId) => snapshots.filter((row) => row.userId === userId && row.cvId === cvId);

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`CV editor running at http://localhost:${port}`);
  });
}
