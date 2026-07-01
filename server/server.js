#!/usr/bin/env node
/**
 * Hermes Notes Sync Server — V2
 * Serveur de synchronisation auto-hébergé, ZÉRO dépendance externe.
 * Node.js >= 23.4 requis (node:sqlite intégré). Testé avec Node 24.
 *
 * Rôles :
 *  - Authentification par email + mot de passe (scrypt), sessions JWT (HMAC-SHA256)
 *  - API de synchronisation offline-first par numéros de révision par utilisateur
 *  - Détection de conflits par baseRev : AUCUN écrasement silencieux
 *  - Isolation stricte des données par user_id
 *  - Backups automatiques de la base au démarrage (14 conservés)
 *  - Peut aussi servir le client web statique (option --static <dir>)
 *
 * Usage :
 *   node server.js [--port 8787] [--data ./data] [--static ../client]
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = parseInt(process.env.HERMES_SYNC_PORT || argValue('--port', '8787'), 10);
const HOST = process.env.HERMES_SYNC_HOST || argValue('--host', '0.0.0.0');
const DATA_DIR = path.resolve(process.env.HERMES_SYNC_DATA || argValue('--data', path.join(__dirname, 'data')));
const STATIC_DIR_ARG = process.env.HERMES_SYNC_STATIC || argValue('--static', '');
const STATIC_DIR = STATIC_DIR_ARG ? path.resolve(STATIC_DIR_ARG) : null;

const TOKEN_TTL_SECONDS = 90 * 24 * 3600; // session persistante : 90 jours
const MAX_BODY_BYTES = 8 * 1024 * 1024;   // 8 Mo
const MAX_CHANGES_PER_SYNC = 500;
const MAX_TITLE_LEN = 500;
const MAX_CONTENT_LEN = 1024 * 1024;      // 1 Mo par note
const MAX_TAGS = 50;
const BACKUPS_KEPT = 14;

// ---------------------------------------------------------------------------
// Base de données (backup AVANT ouverture : fichier fermé = copie sûre)
// ---------------------------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'hermes-notes.db');

function backupDatabase() {
  if (!fs.existsSync(DB_FILE)) return;
  const backupsDir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFileSync(DB_FILE, path.join(backupsDir, `hermes-notes-${stamp}.db`));
  const old = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db')).sort();
  while (old.length > BACKUPS_KEPT) fs.unlinkSync(path.join(backupsDir, old.shift()));
}
backupDatabase();

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    pass_hash  TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    id             TEXT NOT NULL,
    user_id        TEXT NOT NULL,
    title          TEXT NOT NULL DEFAULT '',
    content        TEXT NOT NULL DEFAULT '',
    tags           TEXT NOT NULL DEFAULT '[]',
    pinned         INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    archived_at    TEXT,
    deleted_at     TEXT,
    rev            INTEGER NOT NULL,
    last_client_id TEXT,
    PRIMARY KEY (id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user_rev ON notes(user_id, rev);
  CREATE TABLE IF NOT EXISTS user_seq (
    user_id TEXT PRIMARY KEY,
    seq     INTEGER NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// Secret JWT persistant (généré au premier démarrage, jamais commité)
// ---------------------------------------------------------------------------
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
let SECRET;
if (fs.existsSync(SECRET_FILE)) {
  SECRET = fs.readFileSync(SECRET_FILE);
} else {
  SECRET = crypto.randomBytes(64);
  fs.writeFileSync(SECRET_FILE, SECRET);
}

// ---------------------------------------------------------------------------
// Crypto : mots de passe (scrypt) + JWT (HS256)
// ---------------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const b64url = buf => Buffer.from(buf).toString('base64url');

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// Limitation basique anti brute-force sur /api/auth/*
// ---------------------------------------------------------------------------
const authHits = new Map(); // ip -> {count, resetAt}
function authRateLimited(ip) {
  const now = Date.now();
  const entry = authHits.get(ip);
  if (!entry || entry.resetAt < now) {
    authHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

// ---------------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('body_too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = verifyToken(m[1].trim());
  if (!payload) return null;
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(payload.sub);
  return user || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOTE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Logique de synchronisation
// ---------------------------------------------------------------------------
function nextRev(userId) {
  db.prepare('INSERT INTO user_seq (user_id, seq) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING').run(userId);
  db.prepare('UPDATE user_seq SET seq = seq + 1 WHERE user_id = ?').run(userId);
  return db.prepare('SELECT seq FROM user_seq WHERE user_id = ?').get(userId).seq;
}

function currentRev(userId) {
  const row = db.prepare('SELECT seq FROM user_seq WHERE user_id = ?').get(userId);
  return row ? row.seq : 0;
}

function rowToNote(row) {
  let tags = [];
  try { tags = JSON.parse(row.tags); } catch { /* tags corrompus -> [] */ }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags,
    pinned: !!row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    rev: row.rev,
  };
}

function sanitizeChange(c) {
  if (!c || typeof c !== 'object') return null;
  if (!NOTE_ID_RE.test(String(c.id || ''))) return null;
  const tags = Array.isArray(c.tags) ? c.tags.slice(0, MAX_TAGS).map(t => String(t).slice(0, 100)) : [];
  return {
    id: String(c.id),
    baseRev: Number.isInteger(c.baseRev) ? c.baseRev : 0,
    title: String(c.title ?? '').slice(0, MAX_TITLE_LEN),
    content: String(c.content ?? '').slice(0, MAX_CONTENT_LEN),
    tags,
    pinned: c.pinned ? 1 : 0,
    createdAt: String(c.createdAt || nowIso()).slice(0, 40),
    updatedAt: String(c.updatedAt || nowIso()).slice(0, 40),
    archivedAt: c.archivedAt ? String(c.archivedAt).slice(0, 40) : null,
    deletedAt: c.deletedAt ? String(c.deletedAt).slice(0, 40) : null,
  };
}

/**
 * Applique les changements d'un client puis renvoie les nouveautés serveur.
 * Règle anti-perte : un changement dont baseRev != rev serveur actuel est un
 * CONFLIT -> non appliqué, la version serveur est renvoyée au client qui crée
 * une « copie de conflit » locale. Rien n'est jamais écrasé silencieusement.
 */
function handleSync(user, body) {
  const clientId = String(body.clientId || 'unknown').slice(0, 64);
  const lastRev = Number.isInteger(body.lastRev) && body.lastRev >= 0 ? body.lastRev : 0;
  const rawChanges = Array.isArray(body.changes) ? body.changes.slice(0, MAX_CHANGES_PER_SYNC) : [];

  const applied = [];
  const conflicts = [];
  const rejected = [];

  db.exec('BEGIN IMMEDIATE');
  try {
    const selectNote = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?');
    const insertNote = db.prepare(`
      INSERT INTO notes (id, user_id, title, content, tags, pinned, created_at, updated_at,
                         archived_at, deleted_at, rev, last_client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateNote = db.prepare(`
      UPDATE notes SET title = ?, content = ?, tags = ?, pinned = ?, updated_at = ?,
                       archived_at = ?, deleted_at = ?, rev = ?, last_client_id = ?
      WHERE id = ? AND user_id = ?
    `);

    for (const raw of rawChanges) {
      const c = sanitizeChange(raw);
      if (!c) { rejected.push({ id: raw && raw.id, reason: 'invalid_change' }); continue; }

      const existing = selectNote.get(c.id, user.id);
      if (!existing) {
        const rev = nextRev(user.id);
        insertNote.run(c.id, user.id, c.title, c.content, JSON.stringify(c.tags), c.pinned,
          c.createdAt, c.updatedAt, c.archivedAt, c.deletedAt, rev, clientId);
        applied.push({ id: c.id, rev });
      } else if (existing.rev === c.baseRev) {
        const rev = nextRev(user.id);
        updateNote.run(c.title, c.content, JSON.stringify(c.tags), c.pinned, c.updatedAt,
          c.archivedAt, c.deletedAt, rev, clientId, c.id, user.id);
        applied.push({ id: c.id, rev });
      } else {
        // baseRev obsolète : la note a été modifiée par un autre appareil.
        conflicts.push({ id: c.id, reason: 'base_rev_mismatch', server: rowToNote(existing) });
      }
    }

    const pulled = db.prepare(
      'SELECT * FROM notes WHERE user_id = ? AND rev > ? ORDER BY rev ASC LIMIT 2000'
    ).all(user.id, lastRev).map(rowToNote);

    const serverRev = currentRev(user.id);
    db.exec('COMMIT');
    return { ok: true, serverRev, applied, conflicts, rejected, changes: pulled, syncedAt: nowIso() };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Fichiers statiques (client web) — optionnel
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(STATIC_DIR, rel);
  if (!filePath.startsWith(STATIC_DIR + path.sep) && filePath !== STATIC_DIR) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback : toute route inconnue -> index.html
      fs.readFile(path.join(STATIC_DIR, 'index.html'), (err2, index) => {
        if (err2) { sendJson(res, 404, { error: 'not_found' }); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(index);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Serveur HTTP + routage
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = `${req.method} ${url.pathname}`;
  const ip = req.socket.remoteAddress || '?';

  res.on('finish', () => {
    console.log(`${nowIso()} ${ip} ${route} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  // CORS preflight (JWT en header Authorization, pas de cookies)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  try {
    if (route === 'GET /api/health') {
      sendJson(res, 200, { ok: true, name: 'hermes-notes-sync', version: VERSION, time: nowIso() });
      return;
    }

    if (route === 'POST /api/auth/register' || route === 'POST /api/auth/login') {
      if (authRateLimited(ip)) { sendJson(res, 429, { error: 'too_many_attempts' }); return; }
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (route === 'POST /api/auth/register') {
        if (!EMAIL_RE.test(email)) { sendJson(res, 400, { error: 'invalid_email' }); return; }
        if (password.length < 8) { sendJson(res, 400, { error: 'password_too_short', detail: 'Minimum 8 caractères.' }); return; }
        if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
          sendJson(res, 409, { error: 'email_already_registered' });
          return;
        }
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO users (id, email, pass_hash, created_at) VALUES (?, ?, ?, ?)')
          .run(id, email, hashPassword(password), nowIso());
        const token = signToken({ sub: id, email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
        sendJson(res, 201, { token, user: { id, email } });
        return;
      }

      // login
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !verifyPassword(password, user.pass_hash)) {
        sendJson(res, 401, { error: 'invalid_credentials' });
        return;
      }
      const token = signToken({ sub: user.id, email: user.email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
      sendJson(res, 200, { token, user: { id: user.id, email: user.email } });
      return;
    }

    if (route === 'GET /api/me') {
      const user = getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      sendJson(res, 200, { user: { id: user.id, email: user.email, createdAt: user.created_at }, serverRev: currentRev(user.id) });
      return;
    }

    if (route === 'POST /api/sync') {
      const user = getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const body = await readJsonBody(req);
      sendJson(res, 200, handleSync(user, body));
      return;
    }

    if (STATIC_DIR && req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    if (err.message === 'invalid_json') { sendJson(res, 400, { error: 'invalid_json' }); return; }
    if (err.message === 'body_too_large') { sendJson(res, 413, { error: 'body_too_large' }); return; }
    console.error(`${nowIso()} ERREUR ${route}:`, err);
    sendJson(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Hermes Notes Sync Server v${VERSION}`);
  console.log(`  API     : http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/api/health`);
  if (STATIC_DIR) console.log(`  Client  : http://127.0.0.1:${PORT}/  (statique: ${STATIC_DIR})`);
  console.log(`  Données : ${DB_FILE}`);
});
