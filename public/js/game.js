/**
 * Safari Frenzy — Main game loop
 *
 * State machine: MENU → PLAYING → GAME_OVER → MENU
 *
 * Mechanics:
 *  - 60-second round
 *  - 3×3 grid of grass tiles
 *  - Creatures spawn at increasing rate; click to capture
 *  - Combos multiply points (+1× per 3 catches, max ×5)
 *  - BOOMb halves combo and steals points → real risk/reward
 */

(() => {
  const { CREATURES, POKEBALL, drawSprite, drawGrassPattern } = window.SafariSprites;

  /* ---------- Constants ---------- */
  const GAME_DURATION_MS = 60_000;
  const GRID_SIZE = 3;
  const TILE_PX = 160;          // 480 / 3
  const PIXEL_SIZE = 10;        // 16-pixel sprites at 10px = 160px tiles
  const SPRITE_PIXEL = 10;      // For 14×14 sprites at 10px = 140px (centered)
  const SPRITE_OFFSET = (TILE_PX - 14 * SPRITE_PIXEL) / 2;
  const CANVAS_SIZE = TILE_PX * GRID_SIZE;
  const COMBO_PER_TIER = 3;
  const MAX_MULTIPLIER = 5;

  /* ---------- DOM ---------- */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById('score-value');
  const timerEl = document.getElementById('timer-value');
  const comboEl = document.getElementById('combo-value');
  const multiplierEl = document.getElementById('multiplier-value');
  const overlayEl = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlay-content');
  const leaderboardListEl = document.getElementById('leaderboard-list');

  /* ---------- State ---------- */
  const state = {
    phase: 'MENU',           // MENU | PLAYING | GAME_OVER
    score: 0,
    combo: 0,
    bestCombo: 0,
    catches: 0,
    misses: 0,
    timeLeft: GAME_DURATION_MS,
    tiles: [],               // length 9; each is null or { creature, spawnedAt, lifeMs, scale }
    effects: [],             // floating texts, ball throws, etc
    nextSpawnAt: 0,
    lastFrame: 0,
    startedAt: 0,
    shakeUntil: 0,
    flash: null,             // { color, until }
  };

  /* ---------- Utility ---------- */
  function pickWeighted(list) {
    const total = list.reduce((sum, x) => sum + x.weight, 0);
    let r = Math.random() * total;
    for (const item of list) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return list[list.length - 1];
  }

  function getMultiplier() {
    return Math.min(MAX_MULTIPLIER, 1 + Math.floor(state.combo / COMBO_PER_TIER));
  }

  function updateHud() {
    scoreEl.textContent = state.score.toString().padStart(5, '0');
    timerEl.textContent = Math.ceil(state.timeLeft / 1000);
    comboEl.textContent = state.combo;
    multiplierEl.textContent = '×' + getMultiplier();

    // Color the combo when hot
    const mult = getMultiplier();
    multiplierEl.dataset.tier = mult;
  }

  /* ---------- Spawning ---------- */
  function spawnInterval() {
    // Difficulty ramp: from 850ms early to 380ms late
    const elapsed = (GAME_DURATION_MS - state.timeLeft) / GAME_DURATION_MS;
    return 850 - elapsed * 470;
  }

  function spawnCreature() {
    // Find an empty tile
    const empty = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      if (!state.tiles[i]) empty.push(i);
    }
    if (empty.length === 0) return;

    const tileIdx = empty[Math.floor(Math.random() * empty.length)];
    const creature = pickWeighted(CREATURES);

    // Late-game: shorten lifetime slightly
    const elapsed = (GAME_DURATION_MS - state.timeLeft) / GAME_DURATION_MS;
    const lifeMs = creature.lifeMs * (1 - elapsed * 0.25);

    state.tiles[tileIdx] = {
      creature,
      spawnedAt: performance.now(),
      lifeMs,
      escaped: false,
    };
  }

  /* ---------- Effects ---------- */
  function addFloatingText(x, y, text, color) {
    state.effects.push({
      type: 'text',
      x, y, text, color,
      bornAt: performance.now(),
      lifeMs: 800,
    });
  }

  function addBallThrow(targetX, targetY) {
    state.effects.push({
      type: 'ball',
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE + 60,
      targetX, targetY,
      bornAt: performance.now(),
      lifeMs: 250,
    });
  }

  function addSparkle(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      state.effects.push({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3 - 1,
        bornAt: performance.now(),
        lifeMs: 500,
      });
    }
  }

  function shake(durationMs) {
    state.shakeUntil = performance.now() + durationMs;
  }

  function flash(color, durationMs) {
    state.flash = { color, until: performance.now() + durationMs };
  }

  /* ---------- Input ---------- */
  function tileFromPoint(px, py) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (px - rect.left) * scaleX;
    const y = (py - rect.top) * scaleY;
    if (x < 0 || y < 0 || x > CANVAS_SIZE || y > CANVAS_SIZE) return null;
    const col = Math.floor(x / TILE_PX);
    const row = Math.floor(y / TILE_PX);
    return { idx: row * GRID_SIZE + col, x, y };
  }

  function handleTileClick(idx, clickX, clickY) {
    if (state.phase !== 'PLAYING') return;
    const tile = state.tiles[idx];
    const tileCenterX = (idx % GRID_SIZE) * TILE_PX + TILE_PX / 2;
    const tileCenterY = Math.floor(idx / GRID_SIZE) * TILE_PX + TILE_PX / 2;

    addBallThrow(tileCenterX, tileCenterY);

    if (!tile) {
      // Empty whiff
      state.misses++;
      state.combo = 0;
      addFloatingText(tileCenterX, tileCenterY, 'MISS', '#8b8b9d');
      return;
    }

    const c = tile.creature;
    if (c.id === 'boomb') {
      // BOOMb hit: penalty + combo wipe
      state.score = Math.max(0, state.score + c.points);
      state.combo = 0;
      addFloatingText(tileCenterX, tileCenterY, c.points.toString(), '#e63946');
      shake(280);
      flash('rgba(230, 57, 70, 0.35)', 180);
      state.tiles[idx] = null;
    } else {
      // Successful capture
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.catches++;
      const mult = getMultiplier();
      const points = c.points * mult;
      state.score += points;
      const txt = `+${points}` + (mult > 1 ? ` ×${mult}` : '');
      const color = c.rarity === 'rare' ? '#fcbf49' : c.rarity === 'uncommon' ? '#a594d6' : '#7bc950';
      addFloatingText(tileCenterX, tileCenterY, txt, color);
      addSparkle(tileCenterX, tileCenterY);
      if (c.rarity === 'rare') flash('rgba(252, 191, 73, 0.25)', 220);
      state.tiles[idx] = null;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const hit = tileFromPoint(e.clientX, e.clientY);
    if (hit) handleTileClick(hit.idx, hit.x, hit.y);
  });

  /* ---------- Update ---------- */
  function update(dt, now) {
    if (state.phase !== 'PLAYING') return;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame();
      return;
    }

    // Tile lifetimes
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      if (!tile) continue;
      const age = now - tile.spawnedAt;
      if (age >= tile.lifeMs) {
        // Creature escaped — only break combo for non-BOOMb
        if (tile.creature.id !== 'boomb') {
          state.combo = 0;
        }
        state.tiles[i] = null;
      }
    }

    // Spawn timing
    if (now >= state.nextSpawnAt) {
      spawnCreature();
      state.nextSpawnAt = now + spawnInterval();
    }

    // Effects
    state.effects = state.effects.filter((eff) => {
      const age = now - eff.bornAt;
      if (age > eff.lifeMs) return false;
      if (eff.type === 'spark') {
        eff.x += eff.vx;
        eff.y += eff.vy;
        eff.vy += 0.25; // gravity
      }
      return true;
    });

    updateHud();
  }

  /* ---------- Render ---------- */
  function render(now) {
    // Camera shake offset
    let shakeX = 0, shakeY = 0;
    if (now < state.shakeUntil) {
      const intensity = (state.shakeUntil - now) / 280 * 6;
      shakeX = (Math.random() - 0.5) * intensity;
      shakeY = (Math.random() - 0.5) * intensity;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background grass
    drawGrassPattern(ctx, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 10);

    // Tile grid lines (subtle dirt borders)
    ctx.fillStyle = '#5c8a3e';
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.fillRect(i * TILE_PX - 2, 0, 4, CANVAS_SIZE);
      ctx.fillRect(0, i * TILE_PX - 2, CANVAS_SIZE, 4);
    }

    // Tile shadows under each grass patch
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const cx = col * TILE_PX + TILE_PX / 2;
      const cy = row * TILE_PX + TILE_PX * 0.78;
      ctx.fillStyle = 'rgba(15, 56, 15, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 50, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Creatures
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      if (!tile) continue;
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const baseX = col * TILE_PX + SPRITE_OFFSET;
      const baseY = row * TILE_PX + SPRITE_OFFSET;

      const age = now - tile.spawnedAt;
      const lifeRatio = age / tile.lifeMs;

      // Pop-in animation: 0–150ms
      let popY = 0;
      if (age < 150) {
        const t = age / 150;
        popY = (1 - t) * 40;
      }
      // Pop-out: last 200ms — sink back
      if (lifeRatio > 0.85) {
        const t = (lifeRatio - 0.85) / 0.15;
        popY = t * 40;
      }

      // Idle bob
      const bob = Math.sin(age / 180) * 2;

      drawSprite(ctx, tile.creature.sprite, baseX, baseY + popY + bob, SPRITE_PIXEL);
    }

    // Effects
    for (const eff of state.effects) {
      const age = now - eff.bornAt;
      const t = age / eff.lifeMs;

      if (eff.type === 'text') {
        const alpha = 1 - t;
        const lift = t * 30;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#0f1011';
        ctx.font = 'bold 22px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(eff.text, eff.x + 2, eff.y - lift + 2);
        ctx.fillStyle = eff.color;
        ctx.fillText(eff.text, eff.x, eff.y - lift);
        ctx.globalAlpha = 1;
      } else if (eff.type === 'ball') {
        const dx = eff.targetX - eff.x;
        const dy = eff.targetY - eff.y;
        const x = eff.x + dx * t;
        const y = eff.y + dy * t - Math.sin(t * Math.PI) * 60;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * Math.PI * 4);
        drawSprite(ctx, POKEBALL, -70, -70, SPRITE_PIXEL);
        ctx.restore();
      } else if (eff.type === 'spark') {
        const alpha = 1 - t;
        ctx.fillStyle = `rgba(252, 191, 73, ${alpha})`;
        ctx.fillRect(eff.x - 4, eff.y - 4, 8, 8);
      }
    }

    ctx.restore();

    // Flash overlay
    if (state.flash && now < state.flash.until) {
      ctx.fillStyle = state.flash.color;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
  }

  /* ---------- Loop ---------- */
  function loop(now) {
    const dt = state.lastFrame ? now - state.lastFrame : 16;
    state.lastFrame = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(loop);
  }

  /* ---------- Game lifecycle ---------- */
  async function startGame() {
    state.phase = 'PLAYING';
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.catches = 0;
    state.misses = 0;
    state.timeLeft = GAME_DURATION_MS;
    state.tiles = new Array(GRID_SIZE * GRID_SIZE).fill(null);
    state.effects = [];
    state.startedAt = performance.now();
    state.nextSpawnAt = performance.now() + 400;
    overlayEl.classList.add('hidden');
    updateHud();
  }

  async function endGame() {
    state.phase = 'GAME_OVER';
    showGameOver();
  }

  /* ---------- Overlay screens ---------- */
  function showMenu() {
    state.phase = 'MENU';
    overlayContent.innerHTML = `
      <div class="overlay-card">
        <h1 class="title">SAFARI<br/>FRENZY</h1>
        <p class="subtitle">Capture les créatures avant qu'elles ne s'enfuient.<br/>Évite les <span class="danger">BOOMb</span>.</p>
        <ul class="rules">
          <li><span class="dot common"></span> Communes — 10 pts</li>
          <li><span class="dot uncommon"></span> Rares — 25 pts</li>
          <li><span class="dot legendary"></span> Légendaires — 50 pts</li>
          <li><span class="dot danger"></span> BOOMb — −20 pts &amp; combo perdu</li>
        </ul>
        <p class="hint">Enchaîne les captures pour booster ton multiplicateur jusqu'à <strong>×5</strong>.</p>
        <button class="big-btn" id="start-btn">▶ COMMENCER</button>
        <button class="ghost-btn" id="show-board-btn">🏆 Classement</button>
      </div>
    `;
    overlayEl.classList.remove('hidden');
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('show-board-btn').addEventListener('click', showLeaderboardScreen);
    refreshLeaderboard();
  }

  async function showLeaderboardScreen() {
    const scores = await window.SafariApi.getTopScores(10);
    const rows = scores.length === 0
      ? '<li class="empty">Aucun score pour l\'instant — sois le premier !</li>'
      : scores.map((s, i) => `
          <li>
            <span class="rank">#${i + 1}</span>
            <span class="name">${escapeHtml(s.name)}</span>
            <span class="score">${s.score}</span>
          </li>
        `).join('');
    overlayContent.innerHTML = `
      <div class="overlay-card">
        <h2 class="title small">🏆 CLASSEMENT</h2>
        <ol class="board-full">${rows}</ol>
        <button class="big-btn" id="back-btn">← RETOUR</button>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', showMenu);
  }

  async function showGameOver() {
    const accuracy = state.catches + state.misses === 0
      ? 0
      : Math.round((state.catches / (state.catches + state.misses)) * 100);

    overlayContent.innerHTML = `
      <div class="overlay-card">
        <h2 class="title small">PARTIE TERMINÉE</h2>
        <div class="final-score">${state.score}</div>
        <div class="stats">
          <div><span>Captures</span><strong>${state.catches}</strong></div>
          <div><span>Combo max</span><strong>${state.bestCombo}</strong></div>
          <div><span>Précision</span><strong>${accuracy}%</strong></div>
        </div>
        <div class="name-form">
          <label for="player-name">Ton nom de dresseur</label>
          <input id="player-name" type="text" maxlength="12" placeholder="ROUGE" autocomplete="off"/>
          <button class="big-btn" id="save-btn">💾 SAUVEGARDER</button>
          <button class="ghost-btn" id="skip-btn">Ignorer</button>
        </div>
        <p id="save-status" class="status"></p>
      </div>
    `;
    overlayEl.classList.remove('hidden');

    const nameInput = document.getElementById('player-name');
    const saveBtn = document.getElementById('save-btn');
    const skipBtn = document.getElementById('skip-btn');
    const status = document.getElementById('save-status');

    setTimeout(() => nameInput.focus(), 100);

    const trySave = async () => {
      const name = nameInput.value.trim() || 'ANONYMOUS';
      saveBtn.disabled = true;
      status.textContent = 'Envoi…';
      const result = await window.SafariApi.submitScore({
        name,
        score: state.score,
        combo: state.bestCombo,
      });
      if (result.error) {
        status.textContent = '⚠ Erreur — réessaie';
        status.className = 'status error';
        saveBtn.disabled = false;
      } else {
        status.textContent = result.isTop10
          ? `🌟 TOP 10 ! Rang #${result.rank}`
          : `Sauvegardé · Rang #${result.rank}`;
        status.className = 'status success';
        await refreshLeaderboard();
        setTimeout(showMenu, 1400);
      }
    };

    saveBtn.addEventListener('click', trySave);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') trySave(); });
    skipBtn.addEventListener('click', showMenu);
  }

  /* ---------- Leaderboard sidebar ---------- */
  async function refreshLeaderboard() {
    const scores = await window.SafariApi.getTopScores(5);
    if (scores.length === 0) {
      leaderboardListEl.innerHTML = '<li class="empty">Aucun score</li>';
      return;
    }
    leaderboardListEl.innerHTML = scores.map((s, i) => `
      <li>
        <span class="rank">${i + 1}</span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="score">${s.score}</span>
      </li>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Boot ---------- */
  showMenu();
  requestAnimationFrame(loop);
})();
