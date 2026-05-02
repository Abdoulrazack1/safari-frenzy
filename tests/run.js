#!/usr/bin/env node
/**
 * Safari Frenzy — Test runner
 *
 * Lightweight integration tests for the API. No test framework — uses native
 * fetch + assert. Run after `npm start` (or via `npm test` which spawns the
 * server, runs tests, then kills it).
 */

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 3001; // dedicated test port
const BASE = `http://localhost:${PORT}`;
const TEST_DATA_DIR = path.join(__dirname, '..', '.test-data');

let serverProcess;
let passed = 0;
let failed = 0;

/* ---------- Helpers ---------- */

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, body });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

function test(name, fn) {
  return fn().then(() => {
    passed++;
    console.log(`  ✅ ${name}`);
  }).catch((err) => {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    if (err.actual !== undefined) console.log(`     expected: ${JSON.stringify(err.expected)}`);
    if (err.actual !== undefined) console.log(`     actual:   ${JSON.stringify(err.actual)}`);
  });
}

async function startServer() {
  // Clean test data dir
  if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: PORT, DISABLE_RATE_LIMIT: '1' },
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    const onLine = (chunk) => {
      const out = chunk.toString();
      if (out.includes(`http://localhost:${PORT}`) && !started) {
        started = true;
        setTimeout(resolve, 200);
      }
    };
    serverProcess.stdout.on('data', onLine);
    serverProcess.stderr.on('data', onLine);
    setTimeout(() => started ? null : reject(new Error('Server start timeout')), 5000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

/* ---------- Tests ---------- */

async function runAllTests() {
  console.log('\n🧪 Safari Frenzy API tests\n');

  await test('GET /api/health returns ok', async () => {
    const { status, body } = await req('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(['sqlite', 'json'].includes(body.backend));
  });

  await test('POST /api/session returns signed token', async () => {
    const { status, body } = await req('/api/session', { method: 'POST', body: { mode: 'classic' } });
    assert.equal(status, 200);
    assert.match(body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(body.mode, 'classic');
  });

  await test('POST /api/session normalizes invalid mode', async () => {
    const { body } = await req('/api/session', { method: 'POST', body: { mode: 'cheating' } });
    assert.equal(body.mode, 'classic');
  });

  await test('POST /api/scores rejects missing name', async () => {
    const { status, body } = await req('/api/scores', { method: 'POST', body: { score: 100 } });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_name');
  });

  await test('POST /api/scores rejects invalid score', async () => {
    const { status, body } = await req('/api/scores', { method: 'POST', body: { name: 'X', score: -50 } });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_score');
  });

  await test('POST /api/scores accepts unverified submission (back-compat)', async () => {
    const { status, body } = await req('/api/scores', {
      method: 'POST', body: { name: 'GUEST', score: 250, mode: 'classic' },
    });
    assert.equal(status, 201);
    assert.equal(body.entry.name, 'GUEST');
    assert.equal(body.entry.score, 250);
    assert.equal(body.verified, false);
  });

  await test('POST /api/scores with valid session token marks verified', async () => {
    const session = (await req('/api/session', { method: 'POST', body: { mode: 'classic' } })).body;
    // Wait > 1s so plausibility check (sessionAgeMs >= 1000) passes
    await new Promise(r => setTimeout(r, 1100));
    const { status, body } = await req('/api/scores', {
      method: 'POST',
      body: { name: 'VERIFIED', score: 300, mode: 'classic', sessionToken: session.token },
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.verified, true);
  });

  await test('POST /api/scores rejects implausible score', async () => {
    const session = (await req('/api/session', { method: 'POST', body: { mode: 'classic' } })).body;
    // Submit immediately with absurd score
    const { status, body } = await req('/api/scores', {
      method: 'POST',
      body: { name: 'CHEAT', score: 9_999_999, mode: 'classic', sessionToken: session.token },
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'implausible_score');
  });

  await test('POST /api/scores rejects forged token', async () => {
    const fake = 'eyJzaWQiOiJoYXgifQ.signature_is_wrong_here';
    const { status, body } = await req('/api/scores', {
      method: 'POST',
      body: { name: 'CHEAT', score: 100, mode: 'classic', sessionToken: fake },
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'invalid_session');
  });

  await test('POST /api/scores rejects mode mismatch', async () => {
    const session = (await req('/api/session', { method: 'POST', body: { mode: 'classic' } })).body;
    await new Promise(r => setTimeout(r, 1100));
    const { status, body } = await req('/api/scores', {
      method: 'POST',
      body: { name: 'X', score: 100, mode: 'endless', sessionToken: session.token },
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'mode_mismatch');
  });

  await test('POST /api/scores sanitizes long names', async () => {
    const { body } = await req('/api/scores', {
      method: 'POST',
      body: { name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', score: 50 },
    });
    assert.equal(body.entry.name.length, 12);
  });

  await test('GET /api/scores filters by mode', async () => {
    // Use a unique name within the 12-char sanitization limit
    const submitRes = await req('/api/scores', { method: 'POST', body: { name: 'ENDLESS', score: 100, mode: 'endless' } });
    if (submitRes.status !== 201) {
      throw new Error(`Could not submit endless score: ${submitRes.status} ${JSON.stringify(submitRes.body)}`);
    }

    const classicRes = await req('/api/scores?mode=classic');
    const endlessRes = await req('/api/scores?mode=endless');
    assert.equal(classicRes.status, 200);
    assert.equal(endlessRes.status, 200);
    assert.equal(classicRes.body.mode, 'classic');
    assert.equal(endlessRes.body.mode, 'endless');
    assert.ok(endlessRes.body.scores.some(s => s.name === 'ENDLESS'));
    assert.ok(!classicRes.body.scores.some(s => s.name === 'ENDLESS'));
  });

  await test('GET /api/scores returns sorted descending', async () => {
    // Submit several
    await req('/api/scores', { method: 'POST', body: { name: 'LOW', score: 10, mode: 'hardcore' } });
    await req('/api/scores', { method: 'POST', body: { name: 'HIGH', score: 9000, mode: 'hardcore' } });
    await req('/api/scores', { method: 'POST', body: { name: 'MID', score: 500, mode: 'hardcore' } });
    const { body } = await req('/api/scores?mode=hardcore');
    const scores = body.scores.map(s => s.score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i - 1] >= scores[i], `Not sorted: ${scores}`);
    }
  });

  await test('PUT /api/profile/:name saves profile', async () => {
    const { status, body } = await req('/api/profile/TESTER', {
      method: 'PUT',
      body: { pokedex: { wormy: 5 }, achievements: { firstCatch: 12345 }, best: { score: 1000 } },
    });
    assert.equal(status, 200);
    assert.equal(body.name, 'TESTER');
    assert.equal(body.data.pokedex.wormy, 5);
  });

  await test('GET /api/profile/:name returns saved profile', async () => {
    const { status, body } = await req('/api/profile/TESTER');
    assert.equal(status, 200);
    assert.equal(body.data.pokedex.wormy, 5);
    assert.equal(body.data.achievements.firstCatch, 12345);
  });

  await test('GET /api/profile/:name returns 404 for unknown', async () => {
    const { status } = await req('/api/profile/NOSUCHUSER123');
    assert.equal(status, 404);
  });

  await test('Unknown API route returns 404', async () => {
    const { status, body } = await req('/api/nonexistent');
    assert.equal(status, 404);
    assert.equal(body.error, 'not_found');
  });

  await test('Rate limiting blocks rapid submissions', async () => {
    // Spawn a second server WITH rate limiting enabled (port 3002)
    const RL_PORT = 3002;
    const rlServer = spawn('node', [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: RL_PORT },
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve) => {
      rlServer.stdout.on('data', (chunk) => {
        if (chunk.toString().includes(`http://localhost:${RL_PORT}`)) resolve();
      });
      setTimeout(resolve, 3000);
    });

    try {
      // First request OK
      const r1 = await fetch(`http://localhost:${RL_PORT}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'RL1', score: 50, mode: 'classic' }),
      });
      assert.equal(r1.status, 201);
      // Second within 2s should be 429
      const r2 = await fetch(`http://localhost:${RL_PORT}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'RL2', score: 60, mode: 'classic' }),
      });
      const body = await r2.json();
      assert.equal(r2.status, 429);
      assert.equal(body.error, 'rate_limited');
    } finally {
      rlServer.kill('SIGTERM');
    }
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

/* ---------- Run ---------- */

(async () => {
  try {
    console.log('Starting test server…');
    await startServer();
    const ok = await runAllTests();
    stopServer();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('Test runner error:', err);
    stopServer();
    process.exit(1);
  }
})();

process.on('SIGINT', () => { stopServer(); process.exit(130); });
