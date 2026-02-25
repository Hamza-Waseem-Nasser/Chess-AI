// ============================================
// src/ui/chatBubble.js — AI Speech Bubble
// ============================================
// PURPOSE:
//   Shows the AI's personality comments as a speech bubble
//   overlaid near the chessboard. Creates the feeling of
//   playing against a real opponent who taunts, compliments,
//   or trash-talks you based on their personality.
//
// TIMING:
//   After the AI makes its move, we wait 1.5–3 seconds,
//   then show the comment. This simulates the AI "watching"
//   the player think and then reacting. The bubble auto-hides
//   after ~6 seconds or when the player makes their move.
//
// Python analogy:
//   Like a Toast/Snackbar notification, but positioned
//   relative to the board, with personality.
// ============================================

export class ChatBubble {
  constructor(parentId) {
    // Parent element to attach the bubble to (board-area div)
    this.parent = document.getElementById(parentId);
    this.bubble = null;
    this.showTimer = null;
    this.hideTimer = null;
  }

  /**
   * Show a comment from the AI after a delay.
   * @param {string} message - The AI's comment text
   * @param {number} delay - Milliseconds to wait before showing (default 2000)
   */
  show(message, delay = 2000) {
    if (!this.parent || !message) return;

    // Clear any existing bubble first
    this.hide();

    this.showTimer = setTimeout(() => {
      // Create the bubble element
      this.bubble = document.createElement('div');
      this.bubble.className = 'chat-bubble';
      this.bubble.innerHTML = `
        <div class="chat-bubble-avatar">🤖</div>
        <div class="chat-bubble-content">
          <span class="chat-bubble-text">${this._escape(message)}</span>
        </div>
        <button class="chat-bubble-close" aria-label="Dismiss">×</button>
      `;

      // Wire close button
      this.bubble.querySelector('.chat-bubble-close').addEventListener('click', () => {
        this.hide();
      });

      this.parent.appendChild(this.bubble);

      // Trigger entrance animation (needs 2 rAF for CSS transition to work)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.bubble) this.bubble.classList.add('visible');
        });
      });

      // Auto-hide after 6 seconds
      this.hideTimer = setTimeout(() => this.hide(), 6000);
    }, delay);
  }

  /**
   * Immediately hide and remove the bubble.
   */
  hide() {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.bubble) {
      this.bubble.classList.remove('visible');
      const ref = this.bubble;
      // Wait for fade-out animation, then remove from DOM
      setTimeout(() => ref.remove(), 300);
      this.bubble = null;
    }
  }

  /**
   * HTML-escape user content to prevent XSS.
   * (The AI's comment could contain anything.)
   */
  _escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
