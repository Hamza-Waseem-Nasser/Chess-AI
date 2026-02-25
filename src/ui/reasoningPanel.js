// ============================================
// src/ui/reasoningPanel.js — AI Reasoning Display
// ============================================
// PURPOSE:
//   Shows the AI's thinking process in real-time.
//   As the LLM streams tokens, they appear one by one
//   like the AI is "typing" its thoughts.
//
// FEATURES:
//   - "Thinking..." pulsing indicator while waiting
//   - Streaming text display (word by word)
//   - Shows final move in a highlighted badge
//   - Error state display
//   - History of past reasoning (collapsible)
// ============================================

export class ReasoningPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`ReasoningPanel: container #${containerId} not found`);
      return;
    }
    this._render();
  }

  // ---- Initial HTML structure ----
  _render() {
    this.container.innerHTML = `
      <div class="reasoning-panel">
        <div class="reasoning-header">
          <span class="reasoning-title">🤖 AI Reasoning</span>
          <span class="reasoning-status" id="reasoning-status"></span>
        </div>
        <div class="reasoning-content" id="reasoning-content">
          <div class="reasoning-placeholder">
            Make a move to see the AI think...
          </div>
        </div>
        <div class="reasoning-history" id="reasoning-history"></div>
      </div>
    `;

    this.statusEl = document.getElementById('reasoning-status');
    this.contentEl = document.getElementById('reasoning-content');
    this.historyEl = document.getElementById('reasoning-history');
    this.moveCount = 0;
  }

  // ---- Show "Thinking..." indicator ----
  startThinking() {
    this.statusEl.textContent = 'Thinking...';
    this.statusEl.className = 'reasoning-status thinking';
    this.contentEl.innerHTML = `
      <div class="thinking-indicator">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="thinking-text">Analyzing position...</span>
      </div>
    `;
    this.currentText = '';
    this.streamStarted = false;
  }

  // ---- Append a streaming token ----
  // Called for each chunk of text as the LLM streams its response.
  // The raw stream contains JSON tokens, so we accumulate them
  // and try to extract readable text.
  appendToken(token) {
    if (!this.streamStarted) {
      // First token — switch from "Thinking..." to streaming display
      this.streamStarted = true;
      this.statusEl.textContent = 'Reasoning...';
      this.statusEl.className = 'reasoning-status streaming';
      this.contentEl.innerHTML = '<div class="reasoning-stream"></div>';
      this.streamEl = this.contentEl.querySelector('.reasoning-stream');
      this.rawText = '';
    }

    this.rawText += token;

    // Try to extract the reasoning text from the partial JSON
    // The stream builds up: {"move": "Nf3", "reasoning": "I chose..."}
    // We want to show just the reasoning part as it types
    const reasoningText = this._extractPartialReasoning(this.rawText);
    if (reasoningText && reasoningText !== this.currentText) {
      this.currentText = reasoningText;
      this.streamEl.textContent = reasoningText;
      // Auto-scroll to bottom
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }

  // ---- Show the final result ----
  showResult(move, reasoning) {
    this.statusEl.textContent = '';
    this.statusEl.className = 'reasoning-status';

    this.contentEl.innerHTML = `
      <div class="reasoning-result">
        <div class="reasoning-move">
          <span class="move-label">Move:</span>
          <span class="move-badge">${this._escapeHtml(move)}</span>
        </div>
        <div class="reasoning-text-final">${this._escapeHtml(reasoning)}</div>
      </div>
    `;

    // Add to history
    this.moveCount++;
    this._addToHistory(this.moveCount, move, reasoning);
  }

  // ---- Show error state ----
  showError(message) {
    this.statusEl.textContent = 'Error';
    this.statusEl.className = 'reasoning-status error';
    this.contentEl.innerHTML = `
      <div class="reasoning-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${this._escapeHtml(message)}</span>
      </div>
    `;
  }

  // ---- Show server offline message ----
  showOffline() {
    this.contentEl.innerHTML = `
      <div class="reasoning-error">
        <span class="error-icon">🔌</span>
        <div class="error-text">
          AI server is offline.<br>
          Run: <code>node server/index.js</code>
        </div>
      </div>
    `;
  }

  // ---- Reset on new game ----
  reset() {
    this.moveCount = 0;
    this.contentEl.innerHTML = `
      <div class="reasoning-placeholder">
        Make a move to see the AI think...
      </div>
    `;
    this.historyEl.innerHTML = '';
    this.statusEl.textContent = '';
    this.statusEl.className = 'reasoning-status';
  }

  // ---- Extract reasoning from partial JSON stream ----
  // As tokens stream in, the text looks like:
  //   {"move": "Nf3", "reas      ← partial
  //   {"move": "Nf3", "reasoning": "The position...     ← partial
  //   {"move": "Nf3", "reasoning": "The position calls for..."}  ← complete
  //
  // We try to pull out the reasoning text even before the JSON is complete.
  _extractPartialReasoning(text) {
    // Look for the "reasoning" key and grab everything after its value starts
    const reasoningMatch = text.match(/"reasoning"\s*:\s*"([\s\S]*?)(?:"\s*}|$)/);
    if (reasoningMatch) {
      // Unescape JSON string escapes
      return reasoningMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    // Also try extracting the move if reasoning hasn't started
    const moveMatch = text.match(/"move"\s*:\s*"([^"]+)"/);
    if (moveMatch) {
      return `Choosing: ${moveMatch[1]}...`;
    }

    return null;
  }

  // ---- Add entry to reasoning history ----
  _addToHistory(num, move, reasoning) {
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    entry.innerHTML = `
      <div class="history-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="history-num">Move ${num}:</span>
        <span class="history-move">${this._escapeHtml(move)}</span>
        <span class="history-expand">▸</span>
      </div>
      <div class="history-body">${this._escapeHtml(reasoning)}</div>
    `;
    this.historyEl.prepend(entry); // Newest first
  }

  // ---- HTML escape utility ----
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
