/**
 * API client for Safari Frenzy v2
 *
 * Adds: per-mode leaderboards, session tokens (anti-cheat), profile sync.
 */

const SafariApi = {
  /**
   * Request a fresh session token from the server.
   * Should be called when starting a run; the token must be sent with submitScore.
   */
  async openSession(mode = 'classic') {
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); // { token, sid, mode, issuedAt }
    } catch (err) {
      console.warn('openSession failed (server may be offline):', err);
      return null;
    }
  },

  async getTopScores(mode = 'classic', limit = 10) {
    try {
      const res = await fetch(`/api/scores?mode=${encodeURIComponent(mode)}&limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.scores || [];
    } catch (err) {
      console.error('getTopScores failed:', err);
      return [];
    }
  },

  async submitScore({ name, score, combo, level, mode = 'classic', sessionToken }) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, combo, level, mode, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data; // { entry, rank, isTop10, verified }
    } catch (err) {
      console.error('submitScore failed:', err);
      return { error: err.message || 'unknown' };
    }
  },

  async getProfile(name) {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(name)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data || null;
    } catch (err) {
      console.error('getProfile failed:', err);
      return null;
    }
  },

  async saveProfile(name, profile) {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('saveProfile failed:', err);
      return { error: err.message };
    }
  },
};

window.SafariApi = SafariApi;
