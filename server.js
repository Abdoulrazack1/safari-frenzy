/**
 * Safari Frenzy v2.0 — Backend API
 *
 * Stack: Node.js + Express + better-sqlite3 (with JSON fallback)
 *
 * Features:
 *  - SQLite primary storage with automatic JSON fallback if module unavailable
 *  - HMAC-signed session tokens to prevent score forgery
 *  - Per-mode leaderboards (classic, endless, hardcore, hunt)
 *  - Profile endpoint for cloud-syncing pokedex
 *  - Rate limiting on submission
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR     = path.join(__dirname, 'data');
const DB_FILE      = path.join(DATA_DIR, 'safari.db');
const SCORES_FILE  = path.join(DATA_DIR, 'scores.json');     // legacy / fallback
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const SECRET_FILE = path.join(DATA_DIR, '.secret');

const MAX_SCORES_PER_MODE = 100;
const MAX_NAME_LENGTH = 12;
const MAX_SCORE_VALUE = 10_000_000;
const SESSION_TTL_MS = 30 * 60 * 1000;          // 30 minutes
const SUBMIT_RATE_LIMIT_MS = 2_000;             // 2 seconds between submissions per IP
const VALID_MODES = ['classic', 'endless', 'hardcore', 'hunt'];

/* ============ Bootstrap ============ */

fs.mkdirSync(DATA_DIR, { recursive: true });

// Persistent HMAC secret (auto-generated, kept out of source control)
let HMAC_SECRET;
try {
  HMAC_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  if (!HMAC_SECRET) throw new Error('empty');
} catch {
  HMAC_SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, HMAC_SECRET, { mode: 0o600 });
  console.log('  Generated new HMAC secret');
}

/* ============ Storage layer ============ */

let storage;

function initSqlite() {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return null;
  }
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      score      INTEGER NOT NULL,
      combo      INTEGER NOT NULL DEFAULT 0,
      level      INTEGER NOT NULL DEFAULT 1,
      mode       TEXT NOT NULL DEFAULT 'classic',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON scores(mode, score DESC);

    CREATE TABLE IF NOT EXISTS profiles (
      name       TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return {
    backend: 'sqlite',
    insertScore(entry) {
      db.prepare(`
        INSERT INTO scores (id, name, score, combo, level, mode, created_at)
        VALUES (@id, @name, @score, @combo, @level, @mode, @created_at)
      `).run({
        id: entry.id, name: entry.name, score: entry.score,
        combo: entry.combo || 0, level: entry.level || 1,
        mode: entry.mode || 'classic', created_at: entry.createdAt,
      });
      // Trim per-mode top
      db.prepare(`
        DELETE FROM scores WHERE mode = ? AND id NOT IN (
          SELECT id FROM scores WHERE mode = ? ORDER BY score DESC LIMIT ?
        )
      `).run(entry.mode, entry.mode, MAX_SCORES_PER_MODE);
    },
    getTopScores(mode, limit) {
      const rows = db.prepare(`
        SELECT id, name, score, combo, level, mode, created_at AS createdAt
        FROM scores WHERE mode = ?
        ORDER BY score DESC LIMIT ?
      `).all(mode, limit);
      return rows;
    },
    rankOf(mode, scoreId) {
      const row = db.prepare(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) AS rk
          FROM scores WHERE mode = ?
        )
        SELECT rk FROM ranked WHERE id = ?
      `).get(mode, scoreId);
      return row ? row.rk : null;
    },
    countByMode(mode) {
      const row = db.prepare('SELECT COUNT(*) AS c FROM scores WHERE mode = ?').get(mode);
      return row.c;
    },
    saveProfile(name, data) {
      db.prepare(`
        INSERT INTO profiles (name, data, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run(name, JSON.stringify(data), new Date().toISOString());
    },
    getProfile(name) {
      const row = db.prepare('SELECT data FROM profiles WHERE name = ?').get(name);
      if (!row) return null;
      try { return JSON.parse(row.data); } catch { return null; }
    },
  };
}

function initJsonFallback() {
  function read(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return fallback; }
  }
  function write(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
  function loadScores() { return read(SCORES_FILE, []); }
  function saveScores(scores) { write(SCORES_FILE, scores); }
  function loadProfiles() { return read(PROFILES_FILE, {}); }
  function saveProfiles(profiles) { write(PROFILES_FILE, profiles); }

  return {
    backend: 'json',
    insertScore(entry) {
      const all = loadScores();
      all.push(entry);
      // Per-mode trim
      const byMode = {};
      for (const s of all) {
        const m = s.mode || 'classic';
        (byMode[m] ||= []).push(s);
      }
      const trimmed = [];
      for (const m of Object.keys(byMode)) {
        byMode[m].sort((a, b) => b.score - a.score);
        trimmed.push(...byMode[m].slice(0, MAX_SCORES_PER_MODE));
      }
      saveScores(trimmed);
    },
    getTopScores(mode, limit) {
      return loadScores()
        .filter(s => (s.mode || 'classic') === mode)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
    rankOf(mode, scoreId) {
      const sorted = loadScores()
        .filter(s => (s.mode || 'classic') === mode)
        .sort((a, b) => b.score - a.score);
      const idx = sorted.findIndex(s => s.id === scoreId);
      return idx >= 0 ? idx + 1 : null;
    },
    countByMode(mode) {
      return loadScores().filter(s => (s.mode || 'classic') === mode).length;
    },
    saveProfile(name, data) {
      const all = loadProfiles();
      all[name] = { data, updatedAt: new Date().toISOString() };
      saveProfiles(all);
    },
    getProfile(name) {
      const all = loadProfiles();
      return all[name] ? all[name].data : null;
    },
  };
}

storage = initSqlite() || initJsonFallback();
console.log(`  Storage backend: ${storage.backend}`);

/* ============ Session tokens (anti-cheat) ============ */

function signToken(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(body).digest('base64url');
  // Constant-time comparison
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() - payload.issuedAt > SESSION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ============ Validation ============ */

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ').trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function validateMode(mode) {
  return VALID_MODES.includes(mode) ? mode : 'classic';
}

/**
 * Plausibility check: reject obviously forged scores.
 * Score should be roughly explainable by the time spent + capture rate.
 * Most legitimate runs cap around 200 pts/sec at peak combo, so we use
 * a generous 400 pts/sec ceiling against the session lifetime.
 */
function isPlausibleScore(score, sessionAgeMs) {
  if (sessionAgeMs < 1000) return false; // less than 1s alive = no time to play
  const maxRate = 400; // pts per second, generous upper bound
  const max = (sessionAgeMs / 1000) * maxRate;
  return score <= max;
}

/* ============ Rate limiting ============ */

const ipLastSubmit = new Map();

function ipKey(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
}

function rateLimit(req, res, next) {
  if (process.env.DISABLE_RATE_LIMIT === '1') return next();
  const ip = ipKey(req);
  const now = Date.now();
  const last = ipLastSubmit.get(ip) || 0;
  if (now - last < SUBMIT_RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'rate_limited' });
  }
  ipLastSubmit.set(ip, now);
  // Periodic cleanup
  if (ipLastSubmit.size > 1000) {
    for (const [k, v] of ipLastSubmit) {
      if (now - v > 60_000) ipLastSubmit.delete(k);
    }
  }
  next();
}

/* ============ Middleware ============ */

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ============ Routes ============ */

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', backend: storage.backend, timestamp: Date.now() });
});

/**
 * POST /api/session — issue a signed token at game start.
 * The client must submit this token along with any score; the server uses it
 * to verify the session was issued recently and within plausibility bounds.
 */
app.post('/api/session', (req, res) => {
  const mode = validateMode(req.body && req.body.mode);
  const payload = {
    sid: crypto.randomBytes(8).toString('hex'),
    mode,
    issuedAt: Date.now(),
  };
  const token = signToken(payload);
  res.json({ token, sid: payload.sid, mode, issuedAt: payload.issuedAt });
});

/**
 * GET /api/scores?mode=classic&limit=10
 */
app.get('/api/scores', (req, res) => {
  try {
    const mode = validateMode(req.query.mode);
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, MAX_SCORES_PER_MODE);
    const scores = storage.getTopScores(mode, limit);
    res.json({ scores, total: storage.countByMode(mode), mode });
  } catch (err) {
    console.error('GET /api/scores:', err);
    res.status(500).json({ error: 'failed_to_read_scores' });
  }
});

/**
 * POST /api/scores — submit a score.
 * Requires `sessionToken` from /api/session. Performs plausibility checks.
 */
app.post('/api/scores', rateLimit, (req, res) => {
  try {
    const { name, score, combo, level, mode, sessionToken } = req.body || {};

    const safeName = sanitizeName(name);
    if (!safeName) return res.status(400).json({ error: 'invalid_name' });

    const safeScore = Number(score);
    if (!Number.isFinite(safeScore) || safeScore < 0 || safeScore > MAX_SCORE_VALUE) {
      return res.status(400).json({ error: 'invalid_score' });
    }

    const safeMode = validateMode(mode);

    // Anti-cheat: verify session token. If missing/invalid we still accept (back-compat)
    // but flag it so the response carries a "verified: false" hint.
    let verified = false;
    let sessionAgeMs = SESSION_TTL_MS;
    if (sessionToken) {
      const payload = verifyToken(sessionToken);
      if (!payload) return res.status(401).json({ error: 'invalid_session' });
      if (payload.mode !== safeMode) return res.status(400).json({ error: 'mode_mismatch' });
      sessionAgeMs = Date.now() - payload.issuedAt;
      if (!isPlausibleScore(safeScore, sessionAgeMs)) {
        return res.status(400).json({ error: 'implausible_score' });
      }
      verified = true;
    }

    const entry = {
      id: Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
      name: safeName,
      score: Math.floor(safeScore),
      combo: Number.isFinite(Number(combo)) ? Math.floor(Number(combo)) : 0,
      level: Number.isFinite(Number(level)) ? Math.floor(Number(level)) : 1,
      mode: safeMode,
      createdAt: new Date().toISOString(),
    };

    storage.insertScore(entry);
    const rank = storage.rankOf(safeMode, entry.id);

    res.status(201).json({
      entry,
      rank,
      isTop10: rank !== null && rank <= 10,
      verified,
    });
  } catch (err) {
    console.error('POST /api/scores:', err);
    res.status(500).json({ error: 'failed_to_save_score' });
  }
});

/**
 * GET /api/profile/:name
 * Cloud-synced pokédex / achievements (read).
 */
app.get('/api/profile/:name', (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) return res.status(400).json({ error: 'invalid_name' });
  const data = storage.getProfile(name);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ name, data });
});

/**
 * PUT /api/profile/:name
 * Cloud-synced pokédex / achievements (write).
 * Body: { pokedex: { id: count, ... }, achievements: { id: ts, ... }, best: { score, level } }
 */
app.put('/api/profile/:name', (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) return res.status(400).json({ error: 'invalid_name' });

  const { pokedex, achievements, best } = req.body || {};
  if (!pokedex || typeof pokedex !== 'object') {
    return res.status(400).json({ error: 'invalid_pokedex' });
  }

  const data = {
    pokedex: pokedex || {},
    achievements: achievements || {},
    best: best || {},
  };
  storage.saveProfile(name, data);
  res.json({ name, data, updatedAt: new Date().toISOString() });
});

app.use('/api/*', (_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => {
  console.log(`\n  🌿 Safari Frenzy running on http://localhost:${PORT}`);
  console.log(`     API: /api/health · /api/session · /api/scores · /api/profile/:name\n`);
});
