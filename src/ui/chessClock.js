// ============================================
// src/ui/chessClock.js — Chess Clock (Two Timers)
// ============================================
// PURPOSE:
//   Two countdown timers, one per player. When it's your turn,
//   your clock ticks down. When you move, your clock stops and
//   the opponent's starts.
//
//   Supports Fischer increment (e.g., 3+2 = 3 minutes + 2 seconds
//   added after each move).
//
//   During AI API calls, the AI's clock is PAUSED so network
//   latency doesn't unfairly cost the AI time.
//
// Python analogy:
//   Like a threading.Timer that counts down, with pause/resume.
//   setInterval(() => ..., 100) ≈ while True: sleep(0.1); tick()
// ============================================

// Time control presets — time in seconds, increment in seconds
export const TIME_CONTROLS = {
  unlimited:  { time: Infinity, increment: 0,  label: '∞ Unlimited' },
  bullet:     { time: 60,       increment: 0,  label: '1+0 Bullet' },
  blitz:      { time: 180,      increment: 2,  label: '3+2 Blitz' },
  rapid:      { time: 600,      increment: 0,  label: '10+0 Rapid' },
  classical:  { time: 1800,     increment: 0,  label: '30+0 Classical' },
};

export class ChessClock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.timeWhite = Infinity;
    this.timeBlack = Infinity;
    this.increment = 0;
    this.activeSide = null; // 'w', 'b', or null (stopped)
    this.interval = null;
    this.lastTick = 0;
    this.paused = false;      // Pause during AI API call
    this.onTimeout = null;    // Callback when a player runs out of time
    this._render();
  }

  // ---- Render the clock HTML ----
  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="chess-clock">
        <div class="clock-side" id="clock-black">
          <span class="clock-label">● Black</span>
          <span class="clock-time" id="clock-time-black">∞</span>
        </div>
        <div class="clock-divider">⏱</div>
        <div class="clock-side" id="clock-white">
          <span class="clock-label">○ White</span>
          <span class="clock-time" id="clock-time-white">∞</span>
        </div>
      </div>
    `;
    this.whiteTimeEl = document.getElementById('clock-time-white');
    this.blackTimeEl = document.getElementById('clock-time-black');
    this.whiteBox = document.getElementById('clock-white');
    this.blackBox = document.getElementById('clock-black');
    this._updateDisplay();
  }

  /**
   * Set up a new time control.
   * @param {number} timeSeconds - Starting time per side (Infinity = unlimited)
   * @param {number} incrementSeconds - Fischer increment per move
   */
  configure(timeSeconds, incrementSeconds = 0) {
    this.stop();
    this.timeWhite = timeSeconds;
    this.timeBlack = timeSeconds;
    this.increment = incrementSeconds;
    this.paused = false;
    this._updateDisplay();
  }

  /**
   * Start ticking for a specific side.
   * @param {string} side - 'w' or 'b'
   */
  start(side) {
    this.stop();
    if (this.timeWhite === Infinity) return; // Unlimited = no clock
    this.activeSide = side;
    this.lastTick = performance.now();
    this._updateActiveStyles();

    // Tick every 100ms for smooth countdown
    this.interval = setInterval(() => this._tick(), 100);
  }

  /** Internal tick — subtract elapsed time from active clock */
  _tick() {
    if (this.paused || !this.activeSide) return;

    const now = performance.now();
    const elapsed = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (this.activeSide === 'w') {
      this.timeWhite = Math.max(0, this.timeWhite - elapsed);
    } else {
      this.timeBlack = Math.max(0, this.timeBlack - elapsed);
    }

    this._updateDisplay();
    this._updateActiveStyles();

    // Check for timeout (flag fall)
    if (this.timeWhite <= 0 || this.timeBlack <= 0) {
      const loser = this.timeWhite <= 0 ? 'w' : 'b';
      this.stop();
      if (this.onTimeout) this.onTimeout(loser);
    }
  }

  /**
   * Switch the clock after a move. Adds increment to the side that just moved.
   */
  switchSide() {
    if (!this.activeSide || this.timeWhite === Infinity) return;

    // Add increment to the side that just moved
    if (this.activeSide === 'w') {
      this.timeWhite += this.increment;
    } else {
      this.timeBlack += this.increment;
    }

    // Start the other side's clock
    const newSide = this.activeSide === 'w' ? 'b' : 'w';
    this.start(newSide);
  }

  /** Pause the active clock (used during AI API calls) */
  pause() {
    this.paused = true;
  }

  /** Resume after pause */
  resume() {
    this.paused = false;
    this.lastTick = performance.now(); // Reset tick so pause time isn't counted
  }

  /** Stop all clocks */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.activeSide = null;
    this._updateActiveStyles();
  }

  /** Full reset with new time control */
  reset(timeSeconds, incrementSeconds = 0) {
    this.configure(timeSeconds, incrementSeconds);
  }

  /** Is the clock currently running? */
  isRunning() {
    return this.activeSide !== null && !this.paused;
  }

  /** Is this an unlimited (no clock) game? */
  isUnlimited() {
    return this.timeWhite === Infinity;
  }

  // ---- Display helpers ----

  _updateDisplay() {
    if (this.whiteTimeEl) this.whiteTimeEl.textContent = this._format(this.timeWhite);
    if (this.blackTimeEl) this.blackTimeEl.textContent = this._format(this.timeBlack);
  }

  _updateActiveStyles() {
    if (!this.whiteBox || !this.blackBox) return;
    this.whiteBox.classList.toggle('active', this.activeSide === 'w');
    this.blackBox.classList.toggle('active', this.activeSide === 'b');
    this.whiteBox.classList.toggle('low-time', this.timeWhite < 30 && this.timeWhite !== Infinity);
    this.blackBox.classList.toggle('low-time', this.timeBlack < 30 && this.timeBlack !== Infinity);
  }

  /**
   * Format seconds into human-readable time.
   * Under 10 seconds: show tenths (0:05.3)
   * Over 10 seconds: show MM:SS (4:32)
   */
  _format(seconds) {
    if (seconds === Infinity) return '∞';
    if (seconds <= 0) return '0:00';

    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    // Show tenths when under 10 seconds
    if (seconds < 10) {
      const tenths = Math.floor((seconds % 1) * 10);
      return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
    }

    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
