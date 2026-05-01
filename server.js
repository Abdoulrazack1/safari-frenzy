/**
 * Safari Frenzy — Score API
 * Stack: Node.js + Express
 * Storage: JSON file (zero-config, zero-cost)
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, 'data', 'scores.json');
const MAX_SCORES = 100;          // hard cap to prevent unbounded growth
const MAX_NAME_LENGTH = 12;
const MAX_SCORE_VALUE = 1_000_000;

app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Storage helpers ---------- */

async function readScores() {
  try {
    const raw = await fs.readFile(SCORES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeScores(scores) {
  await fs.mkdir(path.dirname(SCORES_FILE), { recursive: true });
  await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  // Strip control chars, trim, collapse whitespace
  const cleaned = name
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/* ---------- Routes ---------- */

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// GET top scores (descending)
app.get('/api/scores', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, MAX_SCORES);
    const scores = await readScores();
    const top = [...scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    res.json({ scores: top, total: scores.length });
  } catch (err) {
    console.error('GET /api/scores error:', err);
    res.status(500).json({ error: 'failed_to_read_scores' });
  }
});

// POST a new score
app.post('/api/scores', async (req, res) => {
  try {
    const { name, score, combo } = req.body || {};

    const safeName = sanitizeName(name);
    if (!safeName) {
      return res.status(400).json({ error: 'invalid_name' });
    }

    const safeScore = Number(score);
    if (!Number.isFinite(safeScore) || safeScore < 0 || safeScore > MAX_SCORE_VALUE) {
      return res.status(400).json({ error: 'invalid_score' });
    }

    const safeCombo = Number(combo);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: safeName,
      score: Math.floor(safeScore),
      combo: Number.isFinite(safeCombo) ? Math.floor(safeCombo) : 0,
      createdAt: new Date().toISOString(),
    };

    const scores = await readScores();
    scores.push(entry);

    // Keep storage tidy: only retain top MAX_SCORES
    const trimmed = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);

    await writeScores(trimmed);

    // Compute rank of the new entry
    const rank = trimmed.findIndex(s => s.id === entry.id);

    res.status(201).json({
      entry,
      rank: rank >= 0 ? rank + 1 : null,
      isTop10: rank >= 0 && rank < 10,
    });
  } catch (err) {
    console.error('POST /api/scores error:', err);
    res.status(500).json({ error: 'failed_to_save_score' });
  }
});

// 404 for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  console.log(`\n  🌿 Safari Frenzy running on http://localhost:${PORT}\n`);
});
