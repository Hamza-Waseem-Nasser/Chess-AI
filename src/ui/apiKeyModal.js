// ============================================
// src/ui/apiKeyModal.js — BYOK (Bring Your Own Key) System
// ============================================
// PURPOSE:
//   Lets users enter their own OpenAI API key so they can
//   play with no rate limits. Without a key, they still get
//   all models but are rate limited (30 moves/hour).
//
//   The key is stored in localStorage — it NEVER leaves the browser
//   except when sent to YOUR server as a header per-request.
//   The server forwards it to OpenAI, then discards it.
//
// Python analogy:
//   Like storing a token in a .env file, but browser-side.
//   localStorage ≈ a persistent dict that survives page reloads.
// ============================================

const STORAGE_KEY = 'chess-ai-api-key';

export class ApiKeyModal {
  constructor() {
    this.apiKey = localStorage.getItem(STORAGE_KEY) || '';
    this.overlay = null;
    this.onChange = null; // callback when key changes
    this._createModal();
  }

  // ---- Public API ----

  /** Does the user have a BYOK key? */
  hasKey() {
    return this.apiKey.length > 0 && this.apiKey.startsWith('sk-');
  }

  /** Get the stored API key (empty string if none) */
  getApiKey() {
    return this.apiKey;
  }

  /** Show the modal */
  show() {
    const input = this.overlay.querySelector('#modal-api-key');
    input.value = this.apiKey;
    this._updateTierBadge(this.apiKey);
    this.overlay.style.display = 'flex';
    input.focus();
  }

  /** Hide the modal */
  hide() {
    this.overlay.style.display = 'none';
  }

  // ---- Private: Build the modal DOM ----

  _createModal() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal-content">
        <h2>🔑 API Key Settings</h2>
        <p class="modal-subtitle">
          Play free (rate limited) or enter your own OpenAI key for unlimited play.
        </p>

        <div class="modal-section">
          <label for="modal-api-key">OpenAI API Key</label>
          <div class="modal-input-row">
            <input type="password" id="modal-api-key" placeholder="sk-proj-..." autocomplete="off" />
            <button id="modal-toggle-vis" class="modal-btn-icon" title="Show/hide key">👁</button>
          </div>
          <p class="modal-hint">
            Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>
          </p>
        </div>

        <div class="modal-section">
          <div id="modal-tier-badge" class="tier-badge free">
            🆓 Free Tier — All models, rate limited
          </div>
        </div>

        <div class="modal-actions">
          <button id="modal-save" class="modal-btn primary">Save & Close</button>
          <button id="modal-close" class="modal-btn secondary">Cancel</button>
          <button id="modal-clear" class="modal-btn danger">Remove Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.overlay.style.display = 'none';

    // ---- Wire up events ----

    // Save button
    this.overlay.querySelector('#modal-save').addEventListener('click', () => {
      this._save();
    });

    // Cancel button
    this.overlay.querySelector('#modal-close').addEventListener('click', () => {
      this.hide();
    });

    // Remove Key button
    this.overlay.querySelector('#modal-clear').addEventListener('click', () => {
      this._clearKey();
    });

    // Show/hide password toggle
    this.overlay.querySelector('#modal-toggle-vis').addEventListener('click', () => {
      const input = this.overlay.querySelector('#modal-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Live tier badge update as user types
    this.overlay.querySelector('#modal-api-key').addEventListener('input', (e) => {
      this._updateTierBadge(e.target.value.trim());
    });

    // Close on overlay click (outside modal)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
        this.hide();
      }
    });
  }

  _save() {
    const input = this.overlay.querySelector('#modal-api-key');
    this.apiKey = input.value.trim();

    if (this.apiKey) {
      localStorage.setItem(STORAGE_KEY, this.apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    this.hide();
    if (this.onChange) this.onChange();
  }

  _clearKey() {
    this.apiKey = '';
    localStorage.removeItem(STORAGE_KEY);
    this.overlay.querySelector('#modal-api-key').value = '';
    this._updateTierBadge('');
    if (this.onChange) this.onChange();
  }

  _updateTierBadge(key) {
    const badge = this.overlay.querySelector('#modal-tier-badge');
    if (key && key.startsWith('sk-')) {
      badge.className = 'tier-badge byok';
      badge.textContent = '⭐ BYOK — All models, unlimited play';
    } else {
      badge.className = 'tier-badge free';
      badge.textContent = '🆓 Free Tier — All models, rate limited';
    }
  }
}
