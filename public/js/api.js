/**
 * API client for Safari Frenzy scores
 */

const SafariApi = {
  async getTopScores(limit = 10) {
    try {
      const res = await fetch(`/api/scores?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.scores || [];
    } catch (err) {
      console.error('Failed to fetch scores:', err);
      return [];
    }
  },

  async submitScore({ name, score, combo }) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, combo }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data; // { entry, rank, isTop10 }
    } catch (err) {
      console.error('Failed to submit score:', err);
      return { error: err.message };
    }
  },
};

window.SafariApi = SafariApi;
