// ============================================
// src/ui/reasoningPanel.js — AI Reasoning Display
// ============================================
// PURPOSE:
//   Shows the AI's thinking process in real-time.
//
//   For STANDARD models (GPT-4o, GPT-4o-mini):
//     Only delta.content streams → we extract reasoning from partial JSON.
//
//   For REASONING models (o3, o1):
//     Uses OpenAI Responses API (SDK v6+) which streams:
//     Phase 1: response.reasoning_summary_text.delta → rich "thinking" text
//     Phase 2: response.output_text.delta → JSON with the move
//     This gives MUCH better reasoning display — real thought process.
//
// FEATURES:
//   - "Thinking..." pulsing indicator while waiting
//   - Two-phase streaming (reasoning then content)
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

  _render() {
    this.container.innerHTML = `
      <div class="reasoning-panel">
        <div class="reasoning-header">
          <span class="reasoning-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            AI Reasoning
          </span>
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
    this.reasoningStarted = false;
    this.reasoningText = '';
    this.rawText = '';
  }

  // ---- Append reasoning token (o-series Phase 1) ----
  // For reasoning models, this is called with the AI's actual
  // thinking process — rich, unstructured text that we display directly.
  // Much better than extracting from JSON!
  appendReasoning(token) {
    if (!this.reasoningStarted) {
      this.reasoningStarted = true;
      this.statusEl.textContent = 'Thinking deeply...';
      this.statusEl.className = 'reasoning-status reasoning-deep';
      this.contentEl.innerHTML = '<div class="reasoning-stream deep-thought"></div>';
      this.streamEl = this.contentEl.querySelector('.reasoning-stream');
      this.reasoningText = '';
    }

    this.reasoningText += token;
    this.streamEl.textContent = this.reasoningText;
    this.contentEl.scrollTop = this.contentEl.scrollHeight;
  }

  // ---- Append content token (Phase 2 / standard models) ----
  // For standard models: extracts reasoning from partial JSON.
  // For reasoning models: these are JSON tokens (less interesting),
  // but we still accumulate them so showResult() can display the final answer.
  appendToken(token) {
    if (this.reasoningStarted) {
      // Reasoning model Phase 2: JSON building
      // Update status but don't clear the reasoning text
      this.statusEl.textContent = 'Deciding...';
      this.statusEl.className = 'reasoning-status streaming';
      return; // Keep showing the reasoning text, don't overwrite with JSON
    }

    if (!this.streamStarted) {
      // Standard model: first token
      this.streamStarted = true;
      this.statusEl.textContent = 'Reasoning...';
      this.statusEl.className = 'reasoning-status streaming';
      this.contentEl.innerHTML = '<div class="reasoning-stream"></div>';
      this.streamEl = this.contentEl.querySelector('.reasoning-stream');
      this.rawText = '';
    }

    this.rawText += token;

    // Extract readable text from the partial JSON stream
    const reasoningText = this._extractPartialReasoning(this.rawText);
    if (reasoningText && reasoningText !== this.currentText) {
      this.currentText = reasoningText;
      this.streamEl.textContent = reasoningText;
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }

  // ---- Show the final result ----
  showResult(move, reasoning) {
    this.statusEl.textContent = '';
    this.statusEl.className = 'reasoning-status';

    // If we had deep reasoning, show it as the main text
    const displayReasoning = this.reasoningText || reasoning;

    this.contentEl.innerHTML = `
      <div class="reasoning-result">
        <div class="reasoning-move">
          <span class="move-label">Move:</span>
          <span class="move-badge">${this._escapeHtml(move)}</span>
        </div>
        <div class="reasoning-text-final">${this._escapeHtml(displayReasoning)}</div>
      </div>
    `;

    this.moveCount++;
    this._addToHistory(this.moveCount, move, displayReasoning);
  }

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

  // ---- Extract reasoning from partial JSON (standard models only) ----
  _extractPartialReasoning(text) {
    const reasoningMatch = text.match(/"reasoning"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
    if (reasoningMatch) {
      return reasoningMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    const moveMatch = text.match(/"move"\s*:\s*"([^"]+)"/);
    if (moveMatch) {
      return `Choosing: ${moveMatch[1]}...`;
    }
    return null;
  }

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
    this.historyEl.prepend(entry);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
