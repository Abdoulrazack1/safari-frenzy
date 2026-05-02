/**
 * Safari Frenzy — Game configuration
 *
 * All numbers and definitions live here so balance tweaks don't touch logic.
 */

const SafariConfig = (() => {

  /* ============ Game modes ============ */

  const MODES = {
    classic: {
      id: 'classic',
      name: 'CLASSIQUE',
      description: 'Atteins les objectifs des 8+ niveaux pour score max',
      icon: '🎮',
      hasLevels: true,
      hasTimer: true,
      lives: 0,
    },
    endless: {
      id: 'endless',
      name: 'ENDLESS',
      description: '3 vies. BOOMb = -1 vie. Pas de timer, pas de level cap.',
      icon: '♾',
      hasLevels: false,
      hasTimer: false,
      lives: 3,
      // No level goals — pure score chase. Difficulty ramps with time elapsed.
    },
    hardcore: {
      id: 'hardcore',
      name: 'HARDCORE',
      description: 'Une seule erreur (BOOMb ou miss) = game over.',
      icon: '💀',
      hasLevels: true,
      hasTimer: true,
      lives: 1,
      strict: true, // any miss or BOOMb = death
    },
    hunt: {
      id: 'hunt',
      name: 'CHASSE',
      description: 'Capture la cible désignée. Mauvaise capture = pénalité.',
      icon: '🎯',
      hasLevels: false,
      hasTimer: true,
      lives: 0,
      duration: 90_000, // 90s hunt
    },
  };

  /* ============ Levels (classic & hardcore) ============ */

  const LEVELS = [
    { num: 1, goal: 200,  durationMs: 45000, tint: 'none',       difficulty: 0.0,  biome: 'PRAIRIE MATIN' },
    { num: 2, goal: 500,  durationMs: 50000, tint: 'none',       difficulty: 0.2,  biome: 'PRAIRIE MIDI' },
    { num: 3, goal: 900,  durationMs: 50000, tint: 'goldenhour', difficulty: 0.4,  biome: 'HEURE DORÉE' },
    { num: 4, goal: 1400, durationMs: 55000, tint: 'goldenhour', difficulty: 0.55, biome: 'COUCHANT' },
    { num: 5, goal: 2000, durationMs: 55000, tint: 'dusk',       difficulty: 0.7,  biome: 'CRÉPUSCULE' },
    { num: 6, goal: 2700, durationMs: 60000, tint: 'dusk',       difficulty: 0.85, biome: 'NUIT TOMBANTE' },
    { num: 7, goal: 3500, durationMs: 60000, tint: 'night',      difficulty: 1.0,  biome: 'NUIT NOIRE' },
    { num: 8, goal: 4500, durationMs: 60000, tint: 'aurora',     difficulty: 1.15, biome: 'AURORE COSMIQUE' },
  ];

  function getLevel(n) {
    if (n <= LEVELS.length) return LEVELS[n - 1];
    const last = LEVELS[LEVELS.length - 1];
    const extra = n - LEVELS.length;
    return {
      num: n,
      goal: last.goal + extra * 1100,
      durationMs: 60000,
      tint: 'aurora',
      difficulty: 1.15 + extra * 0.1,
      biome: `DIMENSION ${n}`,
    };
  }

  /* ============ Bonus round ============ */
  // Triggered every 3 levels in classic mode.
  // 15 seconds where ONLY legendaries spawn, no BOOMb, double points.

  const BONUS_ROUND = {
    durationMs: 15_000,
    trigger: 3,           // every N levels
    multiplier: 2,        // points × this during bonus
    spawnIntervalMs: 600,
    biome: 'TERRE LÉGENDAIRE',
    tint: 'aurora',
  };

  /* ============ Achievements ============ */

  const ACHIEVEMENTS = {
    firstCatch:   { icon: '🌱', title: 'PREMIERS PAS',    msg: 'Première capture' },
    combo10:      { icon: '⚡', title: 'COMBO MAÎTRE',     msg: '10 captures d\'affilée' },
    combo20:      { icon: '🔥', title: 'COMBO DIVIN',      msg: '20 captures d\'affilée' },
    legendary:    { icon: '✨', title: 'CHASSEUR LÉGENDE', msg: 'Capture un Mewzy' },
    legendary5:   { icon: '🌟', title: 'LÉGENDE VIVANTE',  msg: '5 légendaires capturés' },
    level5:       { icon: '🛡',  title: 'SURVIVANT',        msg: 'Atteins le niveau 5' },
    level8:       { icon: '👑', title: 'MAÎTRE SAFARI',    msg: 'Atteins le niveau 8' },
    perfect:      { icon: '🎯', title: 'PERFECTIONNISTE',  msg: '100% précision sur un niveau' },
    score5k:      { icon: '💎', title: 'GRAND DRESSEUR',   msg: '5 000 points' },
    score10k:     { icon: '🏆', title: 'MAÎTRE COLLECTOR', msg: '10 000 points' },
    powerup:      { icon: '🌟', title: 'COLLECTIONNEUR',   msg: 'Premier power-up' },
    masterball:   { icon: '⚪', title: 'MASTER BLAST',     msg: 'Master AOE utilisé' },
    bonusRound:   { icon: '✨', title: 'TERRE BÉNIE',      msg: 'Premier bonus round' },
    huntComplete: { icon: '🎯', title: 'TRAQUEUR',         msg: 'Première chasse réussie' },
    endlessRun:   { icon: '♾', title: 'INFINI',           msg: '5 minutes en endless' },
    hardcoreRun:  { icon: '💀', title: 'IMPLACABLE',       msg: 'Niveau 3 en hardcore' },
    pokedexHalf:  { icon: '📖', title: 'CARNET REMPLI',   msg: 'Capture toutes les espèces' },
  };

  /* ============ Difficulty constants ============ */

  const DIFFICULTY = {
    spawn: {
      baseMs: 750,
      minMs: 160,
      jitterRatio: 0.3,
      ramp: 320,            // shrunk over a level's duration
      diffShrink: 220,      // shrunk further by config.difficulty
    },
    boombWeightMul: 0.7,    // BOOMb gets weight × (1 + diff × this)
    commonWeightMul: 0.15,  // commons get weight × (1 - diff × this)
    lifeShrinkMax: 0.4,
    itemDropChance: 0.05,   // 5% per spawn slot
    hardcoreBoombMul: 0.5,  // hardcore reduces BOOMb (one-shot kill is enough)
  };

  /* ============ Combo / scoring ============ */

  const COMBO = {
    perTier: 3,
    maxMultiplier: 5,
  };

  /* ============ Power-up effects ============ */

  const POWERUPS = {
    time_bonus:   { duration: 0,    timeAdd: 5000,  toast: { icon: '⏱', title: '+5 SECONDES', msg: 'Temps bonus !' } },
    freeze:       { duration: 3000, timeAdd: 0,     toast: { icon: '❄', title: 'GEL',          msg: 'Créatures figées 3s' } },
    master_aoe:   { duration: 0,    timeAdd: 0,     toast: { icon: '⚪', title: 'MASTER AOE',   msg: 'Toutes les créatures !' } },
    magnet:       { duration: 4000, timeAdd: 0,     toast: { icon: '🧲', title: 'AIMANT',       msg: 'Auto-aim 4s' } },
    repel:        { duration: 0,    timeAdd: 0,     toast: { icon: '💨', title: 'REPEL',        msg: 'BOOMb chassés !' } },
  };

  return {
    MODES,
    LEVELS,
    getLevel,
    BONUS_ROUND,
    ACHIEVEMENTS,
    DIFFICULTY,
    COMBO,
    POWERUPS,
  };
})();

window.SafariConfig = SafariConfig;
