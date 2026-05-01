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

const cvs = [];
let nextId = 1;
const duplicateGuards = new Map();

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
  lastOpenedAt: cv.lastOpenedAt
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

  return null;
};

const parsePagination = (url) => {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit') || DEFAULT_LIMIT)));
  const cursor = url.searchParams.get('cursor');
  const pageParam = url.searchParams.get('page');
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;
  return { limit, cursor, page };
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
          archivedAt: null
        };
        cvs.push(cv);
        return sendJson(res, 201, { data: toDto(cv) });
      }

      if (method === 'GET' && pathname === '/api/cvs') {
        const { limit, cursor, page } = parsePagination(url);
        const owned = cvs
          .filter((cv) => cv.userId === userId && !cv.deletedAt)
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

        if (payload.title !== undefined) cv.title = payload.title.trim();
        if (payload.targetRole !== undefined) cv.targetRole = payload.targetRole;
        if (payload.targetCompany !== undefined) cv.targetCompany = payload.targetCompany;
        if (payload.content_json !== undefined) cv.contentJson = payload.content_json;
        if (payload.content_text !== undefined) cv.contentText = payload.content_text;
        cv.updatedAt = new Date().toISOString();
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
          archivedAt: null
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

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`CV editor running at http://localhost:${port}`);
  });
}
