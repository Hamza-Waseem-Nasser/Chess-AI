// ============================================
// src/game/stats.js — Win/Loss/Draw Statistics
// ============================================
// PURPOSE:
//   Tracks game results in localStorage so they persist
//   across page reloads. Shows a compact stats bar in the UI.
//
//   Tracks: wins, losses, draws, current streak, best streak.
//
// Python analogy:
//   Like writing to a JSON file:
//     with open('stats.json', 'r+') as f:
//         data = json.load(f)
//         data['wins'] += 1
//         json.dump(data, f)
//   But localStorage is built into the browser — no file needed.
// ============================================

const STATS_KEY = 'chess-ai-stats';

export class GameStats {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.stats = this._load();
    this.render();
  }

  // ---- Load stats from localStorage ----
  _load() {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle missing fields from older versions
        return { ...this._default(), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
    return this._default();
  }

  _default() {
    return {
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,     // +N = win streak, -N = loss streak, 0 = neutral
      bestStreak: 0,
    };
  }

  _save() {
    localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
  }

  // ---- Record results ----

  recordWin() {
    this.stats.wins++;
    this.stats.streak = Math.max(0, this.stats.streak) + 1;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    this._save();
    this.render();
  }

  recordLoss() {
    this.stats.losses++;
    this.stats.streak = Math.min(0, this.stats.streak) - 1;
    this._save();
    this.render();
  }

  recordDraw() {
    this.stats.draws++;
    this.stats.streak = 0;
    this._save();
    this.render();
  }

  /** Reset all stats to zero */
  resetAll() {
    this.stats = this._default();
    this._save();
    this.render();
  }

  /** Get current stats object */
  getStats() {
    return { ...this.stats };
  }

  // ---- Render stats display ----
  render() {
    if (!this.container) return;

    const s = this.stats;
    const total = s.wins + s.losses + s.draws;
    const winRate = total > 0 ? Math.round((s.wins / total) * 100) : 0;

    // Streak display
    let streakText = '';
    if (s.streak > 0) {
      streakText = `<span class="stat streak-win" title="Win streak">🔥 ${s.streak}</span>`;
    } else if (s.streak < 0) {
      streakText = `<span class="stat streak-loss" title="Loss streak">💀 ${Math.abs(s.streak)}</span>`;
    }

    this.container.innerHTML = `
      <div class="stats-bar">
        <span class="stat win" title="Wins">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${s.wins}
        </span>
        <span class="stat loss" title="Losses">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ${s.losses}
        </span>
        <span class="stat draw" title="Draws">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${s.draws}
        </span>
        <span class="stat rate" title="Win rate">${winRate}%</span>
        ${streakText}
      </div>
    `;
  }
}
