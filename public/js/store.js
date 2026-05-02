/**
 * Safari Frenzy — Persistence
 *
 * Local: localStorage (pokedex, achievements, best scores per mode, settings)
 * Cloud (optional): /api/profile/:name endpoint for sync
 */

const SafariStore = (() => {

  const KEYS = {
    pokedex:      'safari_frenzy_pokedex_v2',
    achievements: 'safari_frenzy_ach_v2',
    bests:        'safari_frenzy_bests_v2',
    settings:     'safari_frenzy_settings_v2',
    lastName:     'safari_frenzy_last_name_v2',
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* quota exceeded — silently ignore */ }
  }

  const data = {
    pokedex:      load(KEYS.pokedex, {}),
    achievements: load(KEYS.achievements, {}),
    bests:        load(KEYS.bests, {}),    // { classic: {score, level}, endless: {score}, ... }
    settings:     load(KEYS.settings, {
      sound: true,
      music: false,         // off by default — opt-in
      reducedMotion: false,
      playerName: '',
    }),
  };

  /* ----- Pokedex ----- */
  function recordCatch(creatureId) {
    data.pokedex[creatureId] = (data.pokedex[creatureId] || 0) + 1;
    save(KEYS.pokedex, data.pokedex);
  }
  function getPokedex() { return { ...data.pokedex }; }
  function pokedexCount() { return Object.keys(data.pokedex).length; }

  /* ----- Achievements ----- */
  function unlockAchievement(id) {
    if (data.achievements[id]) return false;
    data.achievements[id] = Date.now();
    save(KEYS.achievements, data.achievements);
    return true;
  }
  function hasAchievement(id) { return !!data.achievements[id]; }
  function getAchievements() { return { ...data.achievements }; }

  /* ----- Best scores per mode ----- */
  function recordBest(mode, score, level) {
    const cur = data.bests[mode] || { score: 0, level: 0 };
    if (score > cur.score) {
      data.bests[mode] = { score, level: level || 0, ts: Date.now() };
      save(KEYS.bests, data.bests);
      return true;
    }
    return false;
  }
  function getBest(mode) { return data.bests[mode] || { score: 0, level: 0 }; }
  function getAllBests() { return { ...data.bests }; }

  /* ----- Settings ----- */
  function getSetting(key) { return data.settings[key]; }
  function setSetting(key, value) {
    data.settings[key] = value;
    save(KEYS.settings, data.settings);
  }
  function getSettings() { return { ...data.settings }; }

  /* ----- Player name ----- */
  function setPlayerName(name) {
    if (typeof name !== 'string') return;
    setSetting('playerName', name.slice(0, 12));
    try { localStorage.setItem(KEYS.lastName, name.slice(0, 12)); } catch {}
  }
  function getPlayerName() { return data.settings.playerName || ''; }

  /* ----- Cloud sync ----- */
  async function syncToCloud() {
    const name = getPlayerName();
    if (!name) return { error: 'no_player_name' };
    if (!window.SafariApi) return { error: 'api_unavailable' };
    return window.SafariApi.saveProfile(name, {
      pokedex: data.pokedex,
      achievements: data.achievements,
      best: data.bests.classic || { score: 0, level: 0 },
    });
  }

  async function loadFromCloud(name) {
    if (!window.SafariApi) return null;
    const profile = await window.SafariApi.getProfile(name);
    if (!profile) return null;
    if (profile.pokedex) {
      // Merge — keep highest count per creature
      for (const k of Object.keys(profile.pokedex)) {
        data.pokedex[k] = Math.max(data.pokedex[k] || 0, profile.pokedex[k]);
      }
      save(KEYS.pokedex, data.pokedex);
    }
    if (profile.achievements) {
      Object.assign(data.achievements, profile.achievements);
      save(KEYS.achievements, data.achievements);
    }
    if (profile.best && profile.best.score) {
      const cur = data.bests.classic || { score: 0 };
      if (profile.best.score > cur.score) {
        data.bests.classic = profile.best;
        save(KEYS.bests, data.bests);
      }
    }
    return profile;
  }

  /* ----- Reset ----- */
  function clearAll() {
    for (const k of Object.values(KEYS)) {
      try { localStorage.removeItem(k); } catch {}
    }
    data.pokedex = {};
    data.achievements = {};
    data.bests = {};
    data.settings = { sound: true, music: false, reducedMotion: false, playerName: '' };
  }

  return {
    recordCatch, getPokedex, pokedexCount,
    unlockAchievement, hasAchievement, getAchievements,
    recordBest, getBest, getAllBests,
    getSetting, setSetting, getSettings,
    setPlayerName, getPlayerName,
    syncToCloud, loadFromCloud,
    clearAll,
  };
})();

window.SafariStore = SafariStore;
