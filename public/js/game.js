/**
 * Safari Frenzy v3.0 — Main game loop & state machine
 *
 * Modes: classic, endless, hardcore, hunt
 * Power-ups: time_bonus, freeze, master_aoe, magnet, repel
 * Features: bonus rounds, audio, settings, mode-aware leaderboards, anti-cheat sessions
 */

(() => {
  const { CREATURES, ITEMS, POKEBALL, drawSprite, drawGrassPattern } = window.SafariSprites;
  const { MODES, LEVELS, getLevel, BONUS_ROUND, ACHIEVEMENTS, DIFFICULTY, COMBO, POWERUPS } = window.SafariConfig;
  const Audio = window.SafariAudio;
  const Store = window.SafariStore;
  const Api = window.SafariApi;

  /* ============ Constants ============ */
  const CANVAS_SIZE = 480;
  const SPRITE_PIXEL = 4;
  const SPRITE_W = 14 * SPRITE_PIXEL;
  const SPRITE_H = 14 * SPRITE_PIXEL;
  const HITBOX_PADDING = 6;
  const SPAWN_MARGIN = 30;
  const MIN_SPACING = 60;
  const MAX_ACTIVE = 7;
  const MAGNET_RADIUS = 100; // pixels — auto-aim assist range

  /* ============ DOM ============ */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const $ = (id) => document.getElementById(id);
  const dom = {
    score: $('score-value'),
    timer: $('timer-value'),
    combo: $('combo-value'),
    multiplier: $('multiplier-value'),
    overlay: $('overlay'),
    overlayContent: $('overlay-content'),
    leaderboard: $('leaderboard-list'),
    levelNum: $('level-num'),
    goalCurrent: $('goal-current'),
    goalTarget: $('goal-target'),
    levelBarFill: $('level-bar-fill'),
    tint: $('canvas-tint'),
    toastStack: $('toast-stack'),
    levelLabel: $('level-label'),
    livesDisplay: $('lives-display'),
  };

  /* ============ State ============ */
  const state = {
    phase: 'MENU',          // MENU | LEVEL_INTRO | PLAYING | BONUS_ROUND | LEVEL_COMPLETE | GAME_OVER | SETTINGS | MODE_SELECT | LEADERBOARD
    mode: MODES.classic,
    score: 0,
    combo: 0,
    bestCombo: 0,
    catches: 0,
    misses: 0,
    levelLegendaries: 0,
    sessionLegendaries: 0,
    levelNum: 1,
    levelConfig: LEVELS[0],
    levelStartScore: 0,
    levelMissCount: 0,
    levelCatchCount: 0,
    timeLeft: 0,
    creatures: [],
    effects: [],
    nextSpawnAt: 0,
    lastFrame: 0,
    shakeUntil: 0,
    flash: null,
    nextId: 1,
    frozenUntil: 0,
    magnetUntil: 0,
    masterAoeArmed: false,
    lives: 0,
    huntTarget: null,        // creature id to chase in hunt mode
    huntCount: 0,
    bonusActive: false,
    bonusEndsAt: 0,
    sessionStartedAt: 0,
    sessionToken: null,      // server-issued anti-cheat token
    isEndlessTimer: false,
    endlessElapsed: 0,
  };

  /* ============ Utilities ============ */
  function pickWeighted(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const item of list) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return list[list.length - 1];
  }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function getMultiplier() {
    return Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perTier));
  }
  function isFrozen(now) { return now < state.frozenUntil; }
  function isMagnetActive(now) { return now < state.magnetUntil; }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============ HUD ============ */
  function updateHud() {
    dom.score.textContent = state.score.toString().padStart(5, '0');

    if (state.mode.hasTimer) {
      dom.timer.textContent = Math.ceil(state.timeLeft / 1000);
    } else {
      // Endless mode shows elapsed time instead
      const sec = Math.floor(state.endlessElapsed / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      dom.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    dom.combo.textContent = state.combo;
    const mult = getMultiplier();
    dom.multiplier.textContent = '×' + mult;
    dom.multiplier.dataset.tier = mult;

    if (state.mode.hasLevels && !state.bonusActive) {
      dom.levelLabel.textContent = 'NIVEAU';
      dom.levelNum.textContent = state.levelNum;
      const earned = Math.max(0, state.score - state.levelStartScore);
      dom.goalCurrent.textContent = earned;
      dom.goalTarget.textContent = state.levelConfig.goal;
      dom.levelBarFill.style.width = clamp(earned / state.levelConfig.goal, 0, 1) * 100 + '%';
    } else if (state.bonusActive) {
      dom.levelLabel.textContent = 'BONUS';
      dom.levelNum.textContent = '★';
      dom.goalCurrent.textContent = Math.ceil((state.bonusEndsAt - performance.now()) / 1000);
      dom.goalTarget.textContent = 's';
      dom.levelBarFill.style.width = clamp((state.bonusEndsAt - performance.now()) / BONUS_ROUND.durationMs, 0, 1) * 100 + '%';
    } else if (state.mode.id === 'endless') {
      dom.levelLabel.textContent = 'VIES';
      dom.levelNum.textContent = '♥'.repeat(Math.max(0, state.lives));
      dom.goalCurrent.textContent = state.catches;
      dom.goalTarget.textContent = 'captures';
      dom.levelBarFill.style.width = '100%';
    } else if (state.mode.id === 'hunt') {
      dom.levelLabel.textContent = 'CHASSE';
      dom.levelNum.textContent = state.huntTarget ? state.huntTarget.name : '?';
      dom.goalCurrent.textContent = state.huntCount;
      dom.goalTarget.textContent = 'captures';
      dom.levelBarFill.style.width = '100%';
    }
  }

  function applyTint(tint) { dom.tint.dataset.tint = tint; }

  /* ============ Toasts ============ */
  function showToast(icon, title, msg, sound = true) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-body">
        <span class="toast-title">${escapeHtml(title)}</span>
        <span class="toast-msg">${escapeHtml(msg)}</span>
      </div>
    `;
    dom.toastStack.appendChild(toast);
    if (sound) Audio.play('achievement');
    setTimeout(() => toast.remove(), 3300);
  }

  function tryUnlock(id) {
    if (Store.unlockAchievement(id)) {
      const a = ACHIEVEMENTS[id];
      if (a) showToast(a.icon, a.title, a.msg);
    }
  }

  /* ============ Spawning ============ */
  function spawnInterval() {
    const D = DIFFICULTY.spawn;
    let elapsed;
    if (state.mode.hasTimer && !state.mode.id === 'endless') {
      elapsed = (state.levelConfig.durationMs - state.timeLeft) / state.levelConfig.durationMs;
    } else {
      // Endless: difficulty ramps with elapsed time, plateau after 5min
      elapsed = clamp(state.endlessElapsed / (5 * 60 * 1000), 0, 1);
    }
    const diff = state.bonusActive ? 0 : (state.levelConfig.difficulty || elapsed);
    const base = D.baseMs - elapsed * D.ramp - diff * D.diffShrink;
    const jitter = base * D.jitterRatio;
    return Math.max(D.minMs, base + (Math.random() * 2 - 1) * jitter);
  }

  function findSpawnPosition() {
    const minX = SPAWN_MARGIN, minY = SPAWN_MARGIN;
    const maxX = CANVAS_SIZE - SPRITE_W - SPAWN_MARGIN;
    const maxY = CANVAS_SIZE - SPRITE_H - SPAWN_MARGIN;
    for (let i = 0; i < 12; i++) {
      const x = randRange(minX, maxX);
      const y = randRange(minY, maxY);
      const cx = x + SPRITE_W / 2, cy = y + SPRITE_H / 2;
      let ok = true;
      for (const c of state.creatures) {
        const ocx = c.x + SPRITE_W / 2, ocy = c.y + SPRITE_H / 2;
        if (Math.hypot(cx - ocx, cy - ocy) < MIN_SPACING) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: randRange(minX, maxX), y: randRange(minY, maxY) };
  }

  function pickSpawnEntity() {
    if (state.bonusActive) {
      // Bonus round: only legendaries
      const legendaries = CREATURES.filter(c => c.rarity === 'rare');
      const chosen = legendaries[Math.floor(Math.random() * legendaries.length)];
      return { ...chosen, lifeMs: chosen.lifeMs * 1.3 };
    }

    // Items drop with small chance
    if (Math.random() < DIFFICULTY.itemDropChance) {
      return { ...pickWeighted(ITEMS) };
    }

    const diff = state.levelConfig.difficulty || 0;
    const isHardcore = state.mode.id === 'hardcore';

    const pool = CREATURES.map(c => {
      let w = c.weight;
      if (c.id === 'boomb') {
        w = w * (1 + diff * DIFFICULTY.boombWeightMul);
        if (isHardcore) w = w * DIFFICULTY.hardcoreBoombMul;
      }
      if (c.rarity === 'common') w = w * (1 - diff * DIFFICULTY.commonWeightMul);
      // Hunt mode: bias spawn toward target
      if (state.mode.id === 'hunt' && state.huntTarget && c.id === state.huntTarget.id) {
        w = w * 2.5;
      }
      return { ...c, weight: Math.max(1, w) };
    });
    const chosen = pickWeighted(pool);
    const lifeScale = 1 - Math.min(DIFFICULTY.lifeShrinkMax, diff * 0.3);
    return { ...chosen, lifeMs: chosen.lifeMs * lifeScale };
  }

  function spawnEntity() {
    if (state.creatures.length >= MAX_ACTIVE) return;
    const entity = pickSpawnEntity();
    const pos = findSpawnPosition();
    state.creatures.push({
      id: state.nextId++,
      creature: entity,
      x: pos.x, y: pos.y,
      spawnedAt: performance.now(),
      lifeMs: entity.lifeMs,
    });
  }

  /* ============ Effects ============ */
  function addFloatingText(x, y, text, color) {
    state.effects.push({ type: 'text', x, y, text, color, bornAt: performance.now(), lifeMs: 800 });
  }
  function addBallThrow(targetX, targetY) {
    state.effects.push({ type: 'ball', x: CANVAS_SIZE / 2, y: CANVAS_SIZE + 40, targetX, targetY, bornAt: performance.now(), lifeMs: 220 });
  }
  function addSparkle(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      state.effects.push({ type: 'spark', x, y, color,
        vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5 - 1,
        bornAt: performance.now(), lifeMs: 450 });
    }
  }
  function addBigBurst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      state.effects.push({ type: 'spark', x, y, color,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        bornAt: performance.now(), lifeMs: 700 });
    }
  }
  function addRing(x, y, color, maxRadius) {
    state.effects.push({ type: 'ring', x, y, color, maxRadius, bornAt: performance.now(), lifeMs: 400 });
  }
  function shake(ms) { state.shakeUntil = performance.now() + ms; }
  function flash(color, ms) { state.flash = { color, until: performance.now() + ms }; }

  /* ============ Input ============ */
  function pointToCanvas(px, py) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (px - rect.left) * (canvas.width / rect.width),
      y: (py - rect.top) * (canvas.height / rect.height),
    };
  }

  function creatureAtPoint(x, y) {
    // Magnet active: also accept clicks within MAGNET_RADIUS — auto-aim
    const magnet = isMagnetActive(performance.now());
    let best = null;
    let bestDist = Infinity;

    for (let i = state.creatures.length - 1; i >= 0; i--) {
      const c = state.creatures[i];
      const cx = c.x + SPRITE_W / 2, cy = c.y + SPRITE_H / 2;
      const inside =
        x >= c.x - HITBOX_PADDING && x <= c.x + SPRITE_W + HITBOX_PADDING &&
        y >= c.y - HITBOX_PADDING && y <= c.y + SPRITE_H + HITBOX_PADDING;
      if (inside) return { creature: c, index: i };

      if (magnet) {
        const d = Math.hypot(cx - x, cy - y);
        // Magnet shouldn't auto-grab BOOMb — that would be unfair griefing
        if (d < MAGNET_RADIUS && d < bestDist && c.creature.id !== 'boomb') {
          bestDist = d;
          best = { creature: c, index: i };
        }
      }
    }
    return best;
  }

  function handleClick(clickX, clickY) {
    if (state.phase !== 'PLAYING' && state.phase !== 'BONUS_ROUND') return;
    if (clickX < 0 || clickY < 0 || clickX > CANVAS_SIZE || clickY > CANVAS_SIZE) return;

    addBallThrow(clickX, clickY);

    // Master AOE armed: capture all non-BOOMb on screen
    if (state.masterAoeArmed) {
      state.masterAoeArmed = false;
      Audio.play('masterBall');
      addRing(clickX, clickY, '#a594d6', CANVAS_SIZE);
      flash('rgba(165, 148, 214, 0.4)', 300);
      const captured = [];
      for (let i = state.creatures.length - 1; i >= 0; i--) {
        const c = state.creatures[i];
        if (c.creature.rarity === 'item' || c.creature.id === 'boomb') continue;
        captured.push(c);
        state.creatures.splice(i, 1);
      }
      for (const c of captured) {
        const cx = c.x + SPRITE_W / 2, cy = c.y + SPRITE_H / 2;
        const points = c.creature.points * getMultiplier();
        state.score += points;
        addFloatingText(cx, cy, `+${points}`, '#a594d6');
        addSparkle(cx, cy, '#a594d6');
        Store.recordCatch(c.creature.id);
        state.catches++;
        state.levelCatchCount++;
        if (c.creature.rarity === 'rare') {
          state.sessionLegendaries++;
          state.levelLegendaries++;
        }
      }
      if (captured.length > 0) {
        state.combo += captured.length;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
      }
      checkLevelGoal();
      return;
    }

    const hit = creatureAtPoint(clickX, clickY);

    if (!hit) {
      // Empty whiff
      state.misses++;
      state.levelMissCount++;
      state.combo = 0;
      addFloatingText(clickX, clickY, 'MISS', '#8b8b9d');
      Audio.play('miss');
      if (state.mode.strict) {
        endGame('miss');
      }
      return;
    }

    const { creature: tile, index } = hit;
    const c = tile.creature;
    const cx = tile.x + SPRITE_W / 2, cy = tile.y + SPRITE_H / 2;

    if (c.rarity === 'item') {
      handlePowerUp(c, cx, cy);
      state.creatures.splice(index, 1);
      return;
    }

    if (c.id === 'boomb') {
      if (state.bonusActive) {
        // Shouldn't happen (no BOOMb in bonus), but guard anyway
        state.creatures.splice(index, 1);
        return;
      }
      Audio.play('boomb');
      addRing(cx, cy, '#e63946', 80);
      shake(280);
      flash('rgba(230, 57, 70, 0.35)', 180);
      state.combo = 0;

      if (state.mode.id === 'endless') {
        state.lives--;
        addFloatingText(cx, cy, '−1 ♥', '#e63946');
        if (state.lives <= 0) { state.creatures.splice(index, 1); endGame('boomb_endless'); return; }
      } else if (state.mode.strict) {
        state.creatures.splice(index, 1);
        endGame('boomb_hardcore');
        return;
      } else {
        state.score = Math.max(0, state.score + c.points);
        addFloatingText(cx, cy, c.points.toString(), '#e63946');
      }
      state.creatures.splice(index, 1);
      return;
    }

    // Hunt mode: wrong target = penalty + combo wipe
    if (state.mode.id === 'hunt' && state.huntTarget && c.id !== state.huntTarget.id) {
      state.combo = 0;
      state.score = Math.max(0, state.score - 20);
      addFloatingText(cx, cy, '−20', '#e63946');
      Audio.play('miss');
      flash('rgba(230, 57, 70, 0.2)', 150);
      state.creatures.splice(index, 1);
      return;
    }

    // ========== Successful capture ==========
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.catches++;
    state.levelCatchCount++;
    if (state.mode.id === 'hunt') state.huntCount++;

    const baseMult = getMultiplier();
    const bonusMult = state.bonusActive ? BONUS_ROUND.multiplier : 1;
    const mult = baseMult * bonusMult;
    const points = c.points * mult;
    state.score += points;

    Store.recordCatch(c.id);

    let multTxt = mult > 1 ? ` ×${mult}` : '';
    const color =
      c.rarity === 'rare'     ? '#fcbf49' :
      c.rarity === 'uncommon' ? '#a594d6' :
                                '#7bc950';
    addFloatingText(cx, cy, `+${points}${multTxt}`, color);
    addSparkle(cx, cy, color);

    if (c.rarity === 'rare') {
      Audio.play('catchRare');
      flash('rgba(252, 191, 73, 0.25)', 220);
      state.sessionLegendaries++;
      state.levelLegendaries++;
      tryUnlock('legendary');
      if (state.sessionLegendaries >= 5) tryUnlock('legendary5');
    } else if (c.rarity === 'uncommon') {
      Audio.play('catchUncommon');
    } else {
      Audio.play('catchCommon');
    }

    // Achievements
    if (state.catches === 1) tryUnlock('firstCatch');
    if (state.combo === 10) tryUnlock('combo10');
    if (state.combo === 20) tryUnlock('combo20');
    if (state.score >= 5000) tryUnlock('score5k');
    if (state.score >= 10000) tryUnlock('score10k');
    if (state.mode.id === 'hardcore' && state.levelNum >= 3) tryUnlock('hardcoreRun');
    if (Object.keys(Store.getPokedex()).length >= CREATURES.filter(c => c.id !== 'boomb').length) {
      tryUnlock('pokedexHalf');
    }

    state.creatures.splice(index, 1);
    checkLevelGoal();
  }

  function checkLevelGoal() {
    if (state.bonusActive) return;
    if (!state.mode.hasLevels) return;
    if (state.score - state.levelStartScore >= state.levelConfig.goal) {
      completeLevel();
    }
  }

  /* ============ Power-ups ============ */
  function handlePowerUp(item, cx, cy) {
    Audio.play('powerup');
    addBigBurst(cx, cy, '#fcbf49');
    flash('rgba(252, 191, 73, 0.25)', 200);
    tryUnlock('powerup');

    const cfg = POWERUPS[item.effect];
    if (cfg && cfg.toast) showToast(cfg.toast.icon, cfg.toast.title, cfg.toast.msg);

    switch (item.effect) {
      case 'time_bonus':
        if (state.mode.hasTimer) {
          state.timeLeft = Math.min(state.levelConfig.durationMs * 1.5, state.timeLeft + cfg.timeAdd);
        }
        break;
      case 'freeze':
        state.frozenUntil = performance.now() + cfg.duration;
        Audio.play('freeze');
        break;
      case 'master_aoe':
        state.masterAoeArmed = true;
        tryUnlock('masterball');
        break;
      case 'magnet':
        state.magnetUntil = performance.now() + cfg.duration;
        break;
      case 'repel':
        // Clear all BOOMb on screen
        let cleared = 0;
        for (let i = state.creatures.length - 1; i >= 0; i--) {
          if (state.creatures[i].creature.id === 'boomb') {
            const b = state.creatures[i];
            addRing(b.x + SPRITE_W / 2, b.y + SPRITE_H / 2, '#5dade2', 60);
            state.creatures.splice(i, 1);
            cleared++;
          }
        }
        addRing(CANVAS_SIZE / 2, CANVAS_SIZE / 2, '#5dade2', CANVAS_SIZE);
        break;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = pointToCanvas(e.clientX, e.clientY);
    handleClick(p.x, p.y);
  });

  /* ============ Update ============ */
  function update(dt, now) {
    if (state.phase !== 'PLAYING' && state.phase !== 'BONUS_ROUND') return;

    if (state.mode.hasTimer) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        if (state.bonusActive) endBonus();
        else endGame('timeout');
        return;
      }
    } else {
      state.endlessElapsed += dt;
      if (state.endlessElapsed >= 5 * 60 * 1000) tryUnlock('endlessRun');
    }

    if (state.bonusActive && now >= state.bonusEndsAt) {
      endBonus();
      return;
    }

    const frozen = isFrozen(now);

    if (!frozen) {
      for (let i = state.creatures.length - 1; i >= 0; i--) {
        const c = state.creatures[i];
        if (now - c.spawnedAt >= c.lifeMs) {
          if (c.creature.id !== 'boomb' && c.creature.rarity !== 'item') {
            state.combo = 0;
            if (state.mode.id === 'hunt' && state.huntTarget && c.creature.id === state.huntTarget.id) {
              // Missing the target: small penalty
              state.score = Math.max(0, state.score - 5);
            }
          }
          state.creatures.splice(i, 1);
        }
      }
    } else {
      // Push spawn timestamps forward so creatures don't expire instantly after thaw
      for (const c of state.creatures) c.spawnedAt += dt;
    }

    if (now >= state.nextSpawnAt) {
      spawnEntity();
      state.nextSpawnAt = now + spawnInterval();
    }

    state.effects = state.effects.filter(eff => {
      const age = now - eff.bornAt;
      if (age > eff.lifeMs) return false;
      if (eff.type === 'spark') {
        eff.x += eff.vx; eff.y += eff.vy; eff.vy += 0.25;
      }
      return true;
    });

    updateHud();
  }

  /* ============ Render ============ */
  function render(now) {
    let sx = 0, sy = 0;
    if (now < state.shakeUntil) {
      const intensity = (state.shakeUntil - now) / 280 * 6;
      sx = (Math.random() - 0.5) * intensity;
      sy = (Math.random() - 0.5) * intensity;
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawGrassPattern(ctx, 0, 0, CANVAS_SIZE, CANVAS_SIZE, 10);

    const sorted = [...state.creatures].sort((a, b) => a.y - b.y);
    const frozen = isFrozen(now);
    const magnet = isMagnetActive(now);

    for (const c of sorted) {
      const age = now - c.spawnedAt;
      const lifeRatio = age / c.lifeMs;
      let popY = 0;
      if (age < 150) popY = (1 - age / 150) * 30;
      if (lifeRatio > 0.85) popY = ((lifeRatio - 0.85) / 0.15) * 30;
      const bob = Math.sin(age / 180) * 1.5;

      // Shadow
      ctx.fillStyle = 'rgba(15, 56, 15, 0.35)';
      ctx.beginPath();
      ctx.ellipse(c.x + SPRITE_W / 2, c.y + SPRITE_H - 4, 22, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hunt target highlight
      if (state.mode.id === 'hunt' && state.huntTarget && c.creature.id === state.huntTarget.id) {
        const pulse = 0.3 + 0.2 * Math.sin(now / 120);
        ctx.strokeStyle = `rgba(252, 191, 73, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(c.x - 4, c.y + popY - 4, SPRITE_W + 8, SPRITE_H + 8);
      }

      // Frozen tint
      if (frozen) {
        ctx.fillStyle = 'rgba(93, 173, 226, 0.35)';
        ctx.fillRect(c.x - 4, c.y + popY - 4, SPRITE_W + 8, SPRITE_H + 8);
      }

      drawSprite(ctx, c.creature.sprite, c.x, c.y + popY + bob, SPRITE_PIXEL);
    }

    // Effects
    for (const eff of state.effects) {
      const age = now - eff.bornAt;
      const t = age / eff.lifeMs;
      if (eff.type === 'text') {
        const a = 1 - t;
        const lift = t * 24;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#0f1011';
        ctx.font = 'bold 16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(eff.text, eff.x + 2, eff.y - lift + 2);
        ctx.fillStyle = eff.color;
        ctx.fillText(eff.text, eff.x, eff.y - lift);
        ctx.globalAlpha = 1;
      } else if (eff.type === 'ball') {
        const dx = eff.targetX - eff.x;
        const dy = eff.targetY - eff.y;
        const x = eff.x + dx * t;
        const y = eff.y + dy * t - Math.sin(t * Math.PI) * 50;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * Math.PI * 4);
        drawSprite(ctx, POKEBALL, -SPRITE_W / 2, -SPRITE_H / 2, SPRITE_PIXEL);
        ctx.restore();
      } else if (eff.type === 'spark') {
        const a = 1 - t;
        ctx.fillStyle = eff.color
          ? `rgba(${hexToRgb(eff.color)}, ${a})`
          : `rgba(252, 191, 73, ${a})`;
        ctx.fillRect(eff.x - 3, eff.y - 3, 6, 6);
      } else if (eff.type === 'ring') {
        const a = 1 - t;
        const radius = eff.maxRadius * t;
        ctx.strokeStyle = `rgba(${hexToRgb(eff.color)}, ${a})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Visual indicators for active states
    if (frozen) {
      const a = 0.4 + 0.2 * Math.sin(now / 100);
      ctx.strokeStyle = `rgba(93, 173, 226, ${a})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
    }
    if (magnet) {
      const a = 0.4 + 0.15 * Math.sin(now / 80);
      ctx.strokeStyle = `rgba(230, 57, 70, ${a})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
    }
    if (state.masterAoeArmed) {
      const a = 0.5 + 0.25 * Math.sin(now / 90);
      ctx.strokeStyle = `rgba(165, 148, 214, ${a})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
    }
    if (state.bonusActive) {
      const a = 0.4 + 0.3 * Math.sin(now / 100);
      ctx.strokeStyle = `rgba(252, 191, 73, ${a})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
    }

    ctx.restore();

    if (state.flash && now < state.flash.until) {
      ctx.fillStyle = state.flash.color;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
  }

  function hexToRgb(hex) {
    const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return '252, 191, 73';
    return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
  }

  /* ============ Loop ============ */
  function loop(now) {
    const dt = state.lastFrame ? Math.min(50, now - state.lastFrame) : 16;
    state.lastFrame = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(loop);
  }

  /* ============ Game lifecycle ============ */
  async function startNewGame(modeId) {
    const mode = MODES[modeId] || MODES.classic;
    state.mode = mode;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.catches = 0;
    state.misses = 0;
    state.sessionLegendaries = 0;
    state.creatures = [];
    state.effects = [];
    state.lives = mode.lives;
    state.endlessElapsed = 0;
    state.huntCount = 0;
    state.huntTarget = null;
    state.bonusActive = false;
    state.masterAoeArmed = false;
    state.frozenUntil = 0;
    state.magnetUntil = 0;
    state.sessionStartedAt = performance.now();

    // Open server session for anti-cheat
    if (Api && Api.openSession) {
      const session = await Api.openSession(mode.id);
      state.sessionToken = session ? session.token : null;
    }

    if (Store.getSetting('music')) Audio.startMusic();

    if (mode.hasLevels) {
      state.levelNum = 1;
      enterLevel(1);
    } else if (mode.id === 'endless') {
      state.levelConfig = { goal: 0, durationMs: 0, difficulty: 0, biome: 'PRAIRIE INFINIE', tint: 'none' };
      state.levelStartScore = 0;
      state.levelMissCount = 0;
      state.levelCatchCount = 0;
      applyTint('none');
      startPlaying();
    } else if (mode.id === 'hunt') {
      pickHuntTarget();
      state.timeLeft = mode.duration;
      state.levelConfig = { goal: 0, durationMs: mode.duration, difficulty: 0.5, biome: 'TERRAIN DE CHASSE', tint: 'goldenhour' };
      applyTint('goldenhour');
      state.levelStartScore = 0;
      state.levelMissCount = 0;
      state.levelCatchCount = 0;
      showHuntIntro();
    }
  }

  function pickHuntTarget() {
    // Rotate through uncommons & rares as targets — never commons (too easy) or BOOMb
    const candidates = CREATURES.filter(c => c.rarity === 'uncommon' || c.rarity === 'rare');
    state.huntTarget = candidates[Math.floor(Math.random() * candidates.length)];
  }

  function enterLevel(num) {
    state.levelNum = num;
    state.levelConfig = getLevel(num);
    state.levelStartScore = state.score;
    state.timeLeft = state.levelConfig.durationMs;
    state.creatures = [];
    state.effects = [];
    state.combo = 0;
    state.frozenUntil = 0;
    state.magnetUntil = 0;
    state.masterAoeArmed = false;
    state.levelMissCount = 0;
    state.levelCatchCount = 0;
    state.levelLegendaries = 0;
    applyTint(state.levelConfig.tint);
    showLevelIntro();
  }

  function startPlaying() {
    state.phase = 'PLAYING';
    state.nextSpawnAt = performance.now() + 250;
    dom.overlay.classList.add('hidden');
    if (state.levelNum >= 5) tryUnlock('level5');
    if (state.levelNum >= 8) tryUnlock('level8');
    updateHud();
  }

  function startBonusRound() {
    state.phase = 'BONUS_ROUND';
    state.bonusActive = true;
    state.bonusEndsAt = performance.now() + BONUS_ROUND.durationMs;
    state.timeLeft = BONUS_ROUND.durationMs;
    state.creatures = [];
    state.combo = 0;
    state.nextSpawnAt = performance.now() + 200;
    applyTint(BONUS_ROUND.tint);
    Audio.play('bonusStart');
    tryUnlock('bonusRound');
    showToast('✨', 'BONUS ROUND', `Légendaires uniquement · x${BONUS_ROUND.multiplier}`);
    dom.overlay.classList.add('hidden');
  }

  function endBonus() {
    state.bonusActive = false;
    state.phase = 'PLAYING';
    state.timeLeft = state.levelConfig.durationMs;
    state.creatures = [];
    applyTint(state.levelConfig.tint);
    showToast('🌿', 'RETOUR', 'Niveau ' + state.levelNum);
  }

  function completeLevel() {
    state.phase = 'LEVEL_COMPLETE';
    Audio.play('levelComplete');
    if (state.levelMissCount === 0 && state.levelCatchCount > 0) {
      tryUnlock('perfect');
    }
    showLevelComplete();
  }

  function endGame(reason) {
    state.phase = 'GAME_OVER';
    Audio.play('gameOver');
    Audio.stopMusic();
    Store.recordBest(state.mode.id, state.score, state.levelNum);
    if (state.mode.id === 'hunt' && state.huntCount > 0) tryUnlock('huntComplete');
    showGameOver(reason);
  }

  /* ============ Overlay screens ============ */

  function renderPokedexHTML() {
    const cells = CREATURES.filter(c => c.id !== 'boomb').map(c => {
      const count = Store.getPokedex()[c.id] || 0;
      const locked = count === 0;
      const display = locked ? '???' : c.name.slice(0, 5).toUpperCase();
      return `
        <div class="pokedex-cell ${locked ? 'locked' : ''}" title="${c.name} — ${count}">
          ${display}
          ${count > 0 ? `<span class="count">${count}</span>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div class="pokedex">
        <div class="pokedex-title">📖 POKÉDEX (${Store.pokedexCount()}/${CREATURES.filter(c => c.id !== 'boomb').length})</div>
        <div class="pokedex-grid">${cells}</div>
      </div>
    `;
  }

  function showMenu() {
    state.phase = 'MENU';
    Audio.stopMusic();
    applyTint('none');
    const best = Store.getBest('classic');
    const bestLine = best.score > 0
      ? `<div class="best-score">MEILLEUR CLASSIQUE: <strong>${best.score}</strong> (L${best.level})</div>`
      : '';
    dom.overlayContent.innerHTML = `
      <div class="overlay-card">
        <h1 class="title">SAFARI<br/>FRENZY</h1>
        ${bestLine}
        <p class="subtitle">Capture les créatures.<br/>Évite les BOOMb.</p>
        <div class="menu-buttons">
          <button class="big-btn" id="play-btn">▶ JOUER</button>
          <button class="ghost-btn" id="modes-btn">⚙ Modes &amp; Settings</button>
          <button class="ghost-btn" id="board-btn">🏆 Classement</button>
        </div>
        ${renderPokedexHTML()}
      </div>
    `;
    dom.overlay.classList.remove('hidden');
    $('play-btn').addEventListener('click', () => startNewGame('classic'));
    $('modes-btn').addEventListener('click', showModeSelect);
    $('board-btn').addEventListener('click', showLeaderboardScreen);
  }

  function showModeSelect() {
    state.phase = 'MODE_SELECT';
    const best = Store.getAllBests();
    const cards = Object.values(MODES).map(m => {
      const b = best[m.id] || {};
      const bestStr = b.score ? `Best: ${b.score}` : 'Pas encore joué';
      return `
        <button class="mode-card" data-mode="${m.id}">
          <span class="mode-icon">${m.icon}</span>
          <strong>${m.name}</strong>
          <span class="mode-desc">${m.description}</span>
          <span class="mode-best">${bestStr}</span>
        </button>
      `;
    }).join('');

    const settings = Store.getSettings();
    dom.overlayContent.innerHTML = `
      <div class="overlay-card">
        <h2 class="title small">MODES</h2>
        <div class="modes-grid">${cards}</div>
        <h2 class="title small" style="margin-top:8px">RÉGLAGES</h2>
        <div class="settings-rows">
          <label class="setting-row">
            <input type="checkbox" id="set-sound" ${settings.sound ? 'checked' : ''}/>
            <span>🔊 Effets sonores</span>
          </label>
          <label class="setting-row">
            <input type="checkbox" id="set-music" ${settings.music ? 'checked' : ''}/>
            <span>🎵 Musique chiptune</span>
          </label>
          <label class="setting-row">
            <input type="checkbox" id="set-motion" ${settings.reducedMotion ? 'checked' : ''}/>
            <span>♿ Mouvement réduit</span>
          </label>
        </div>
        <button class="big-btn" id="back-btn">← RETOUR</button>
        <button class="ghost-btn" id="reset-btn">🗑 Réinitialiser progression</button>
      </div>
    `;
    document.querySelectorAll('.mode-card').forEach(b => {
      b.addEventListener('click', () => startNewGame(b.dataset.mode));
    });
    $('back-btn').addEventListener('click', showMenu);
    $('set-sound').addEventListener('change', (e) => {
      Store.setSetting('sound', e.target.checked);
      Audio.setMuted(!e.target.checked);
    });
    $('set-music').addEventListener('change', (e) => {
      Store.setSetting('music', e.target.checked);
      if (e.target.checked) Audio.startMusic();
      else Audio.stopMusic();
    });
    $('set-motion').addEventListener('change', (e) => {
      Store.setSetting('reducedMotion', e.target.checked);
      document.body.classList.toggle('reduced-motion', e.target.checked);
    });
    $('reset-btn').addEventListener('click', () => {
      if (confirm('Tout effacer ? (pokédex, achievements, scores locaux)')) {
        Store.clearAll();
        showMenu();
      }
    });
  }

  function showLevelIntro() {
    state.phase = 'LEVEL_INTRO';
    dom.overlayContent.innerHTML = `
      <div class="overlay-card level-up-card">
        <div class="level-up-banner">${state.levelNum > 1 ? 'NIVEAU SUIVANT' : 'PRÊT?'}</div>
        <div class="level-up-num">L${state.levelNum}</div>
        <div class="level-up-biome">${state.levelConfig.biome}</div>
        <div class="level-up-stats">
          <div class="level-up-stat"><span>OBJECTIF</span><strong>${state.levelConfig.goal}</strong></div>
          <div class="level-up-stat"><span>TEMPS</span><strong>${Math.round(state.levelConfig.durationMs / 1000)}s</strong></div>
        </div>
        <button class="big-btn" id="play-btn">▶ GO !</button>
      </div>
    `;
    dom.overlay.classList.remove('hidden');
    $('play-btn').addEventListener('click', startPlaying);
    setTimeout(() => $('play-btn').focus(), 50);
  }

  function showHuntIntro() {
    state.phase = 'LEVEL_INTRO';
    dom.overlayContent.innerHTML = `
      <div class="overlay-card level-up-card">
        <div class="level-up-banner">CHASSE</div>
        <div class="level-up-num" style="font-size:32px">${state.huntTarget.name.toUpperCase()}</div>
        <div class="level-up-biome">CIBLE DÉSIGNÉE</div>
        <p class="hint">Capture uniquement la cible. Mauvaise capture = −20 pts.</p>
        <div class="level-up-stats">
          <div class="level-up-stat"><span>VALEUR</span><strong>${state.huntTarget.points} pts</strong></div>
          <div class="level-up-stat"><span>TEMPS</span><strong>${Math.round(state.mode.duration / 1000)}s</strong></div>
        </div>
        <button class="big-btn" id="play-btn">▶ GO !</button>
      </div>
    `;
    dom.overlay.classList.remove('hidden');
    $('play-btn').addEventListener('click', startPlaying);
    setTimeout(() => $('play-btn').focus(), 50);
  }

  function showLevelComplete() {
    const accuracy = state.levelMissCount + state.levelCatchCount === 0
      ? 100
      : Math.round((state.levelCatchCount / (state.levelCatchCount + state.levelMissCount)) * 100);
    const timeBonus = Math.floor(state.timeLeft / 1000) * 10;
    state.score += timeBonus;

    const triggerBonus = state.mode.id === 'classic' && state.levelNum % BONUS_ROUND.trigger === 0;

    dom.overlayContent.innerHTML = `
      <div class="overlay-card level-up-card">
        <div class="level-up-banner">NIVEAU ${state.levelNum} CLEAR !</div>
        <div class="level-up-num">${state.score}</div>
        <div class="level-up-stats">
          <div class="level-up-stat"><span>BONUS TEMPS</span><strong>+${timeBonus}</strong></div>
          <div class="level-up-stat"><span>PRÉCISION</span><strong>${accuracy}%</strong></div>
          <div class="level-up-stat"><span>CAPTURES</span><strong>${state.levelCatchCount}</strong></div>
          <div class="level-up-stat"><span>COMBO MAX</span><strong>${state.bestCombo}</strong></div>
        </div>
        ${triggerBonus
          ? '<button class="big-btn" id="next-btn" style="background:#fcbf49;color:#0f1011">★ BONUS ROUND</button>'
          : `<button class="big-btn" id="next-btn">▶ NIVEAU ${state.levelNum + 1}</button>`}
        <button class="ghost-btn" id="end-btn">Arrêter ici</button>
      </div>
    `;
    dom.overlay.classList.remove('hidden');
    $('next-btn').addEventListener('click', () => {
      if (triggerBonus) startBonusRound();
      else enterLevel(state.levelNum + 1);
    });
    $('end-btn').addEventListener('click', () => endGame('voluntary'));
  }

  async function showGameOver(reason) {
    const accuracy = state.catches + state.misses === 0
      ? 0 : Math.round((state.catches / (state.catches + state.misses)) * 100);

    const reasonText = {
      timeout: 'Temps écoulé',
      boomb_endless: 'Plus de vies !',
      boomb_hardcore: 'Hardcore: BOOMb fatal',
      miss: 'Hardcore: clic raté',
      voluntary: 'Sortie volontaire',
    }[reason] || '';

    dom.overlayContent.innerHTML = `
      <div class="overlay-card">
        <h2 class="title small">PARTIE TERMINÉE</h2>
        <p class="subtitle">${state.mode.name} · ${reasonText}</p>
        <div class="final-score">${state.score}</div>
        <div class="stats">
          <div><span>${state.mode.hasLevels ? 'Niveau' : 'Captures'}</span><strong>${state.mode.hasLevels ? state.levelNum : state.catches}</strong></div>
          <div><span>Précision</span><strong>${accuracy}%</strong></div>
          <div><span>Combo max</span><strong>${state.bestCombo}</strong></div>
        </div>
        <div class="name-form">
          <label for="player-name">Ton nom de dresseur</label>
          <input id="player-name" type="text" maxlength="12" placeholder="ROUGE" autocomplete="off" value="${escapeHtml(Store.getPlayerName())}"/>
          <button class="big-btn" id="save-btn">💾 SAUVEGARDER</button>
          <button class="ghost-btn" id="skip-btn">Ignorer</button>
        </div>
        <p id="save-status" class="status"></p>
      </div>
    `;
    dom.overlay.classList.remove('hidden');

    const nameInput = $('player-name');
    const saveBtn = $('save-btn');
    const skipBtn = $('skip-btn');
    const status = $('save-status');
    setTimeout(() => nameInput.focus(), 100);

    const trySave = async () => {
      const name = nameInput.value.trim() || 'ANONYMOUS';
      Store.setPlayerName(name);
      saveBtn.disabled = true;
      status.textContent = 'Envoi…';
      const result = await Api.submitScore({
        name, score: state.score, combo: state.bestCombo,
        level: state.levelNum, mode: state.mode.id,
        sessionToken: state.sessionToken,
      });
      if (result.error) {
        status.textContent = result.error === 'implausible_score'
          ? '⚠ Score rejeté (anti-triche)'
          : result.error === 'rate_limited'
            ? '⏳ Trop rapide, réessaie'
            : '⚠ Erreur — réessaie';
        status.className = 'status error';
        saveBtn.disabled = false;
      } else {
        status.textContent = result.isTop10
          ? `🌟 TOP 10 ! Rang #${result.rank}`
          : `Sauvegardé · Rang #${result.rank}`;
        status.className = 'status success';
        // Cloud sync of pokedex
        Store.syncToCloud().catch(() => {});
        await refreshLeaderboard();
        setTimeout(showMenu, 1600);
      }
    };
    saveBtn.addEventListener('click', trySave);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') trySave(); });
    skipBtn.addEventListener('click', showMenu);
  }

  async function showLeaderboardScreen() {
    state.phase = 'LEADERBOARD';
    const tabs = Object.values(MODES).map(m =>
      `<button class="lb-tab" data-mode="${m.id}">${m.icon} ${m.name}</button>`
    ).join('');
    dom.overlayContent.innerHTML = `
      <div class="overlay-card">
        <h2 class="title small">🏆 CLASSEMENT</h2>
        <div class="lb-tabs">${tabs}</div>
        <ol class="board-full" id="board-content"><li class="empty">Chargement…</li></ol>
        <button class="big-btn" id="back-btn">← RETOUR</button>
      </div>
    `;
    document.querySelectorAll('.lb-tab').forEach(t => {
      t.addEventListener('click', () => loadLeaderboardTab(t.dataset.mode));
    });
    $('back-btn').addEventListener('click', showMenu);
    loadLeaderboardTab('classic');
  }

  async function loadLeaderboardTab(mode) {
    document.querySelectorAll('.lb-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    const scores = await Api.getTopScores(mode, 10);
    const list = $('board-content');
    if (!list) return;
    if (scores.length === 0) {
      list.innerHTML = '<li class="empty">Aucun score — sois le premier !</li>';
      return;
    }
    list.innerHTML = scores.map((s, i) => `
      <li>
        <span class="rank">#${i + 1}</span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="score">${s.score}</span>
      </li>
    `).join('');
  }

  /* ============ Sidebar leaderboard ============ */
  async function refreshLeaderboard() {
    const scores = await Api.getTopScores('classic', 5);
    if (scores.length === 0) {
      dom.leaderboard.innerHTML = '<li class="empty">Aucun score</li>';
      return;
    }
    dom.leaderboard.innerHTML = scores.map((s, i) => `
      <li>
        <span class="rank">${i + 1}</span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="score">${s.score}</span>
      </li>
    `).join('');
  }

  /* ============ Boot ============ */
  // Apply saved settings
  if (!Store.getSetting('sound')) Audio.setMuted(true);
  if (Store.getSetting('reducedMotion')) document.body.classList.add('reduced-motion');

  showMenu();
  refreshLeaderboard();
  requestAnimationFrame(loop);
})();
