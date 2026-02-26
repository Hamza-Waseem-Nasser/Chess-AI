// ============================================
// gameManager.js — Game State Manager
// ============================================
// The BRAIN of the application. Orchestrates:
//   - chess.js (rules engine)
//   - BoardUI (rendering)
//   - LLM service (AI moves via OpenAI)
//   - ReasoningPanel (streaming AI thoughts)
//   - ChatBubble (AI personality comments)
//   - ChessClock (timers)
//   - GameStats (win/loss tracking)
//   - ApiKeyModal (BYOK system)
//   - Sound effects, move history, board flip
// ============================================

import { Chess } from 'chess.js';
import { BoardUI } from '../ui/board.js';
import { MoveHistory } from './moveHistory.js';
import { evaluate, evaluateDetailed } from '../ai/evaluate.js';
import { requestChessMove, requestTakeback, checkHealth } from '../ai/llmService.js';
import { ReasoningPanel } from '../ui/reasoningPanel.js';
import { ChatBubble } from '../ui/chatBubble.js';
import { ChessClock, TIME_CONTROLS } from '../ui/chessClock.js';
import { GameStats } from './stats.js';
import { ApiKeyModal } from '../ui/apiKeyModal.js';
import { playSoundForMove, playGameOverSound, playErrorSound } from '../ui/sounds.js';

// All models are available to everyone (free tier is rate-limited, not model-restricted)

export class GameManager {
  constructor() {
    // ---- Chess Engine (Model) ----
    this.chess = new Chess();

    // ---- UI Components ----
    this.board = null;
    this.moveHistory = null;
    this.reasoningPanel = null;
    this.chatBubble = null;
    this.chessClock = null;
    this.stats = null;
    this.apiKeyModal = null;

    // ---- Configuration ----
    this.playerColor = 'w';
    this.aiColor = 'b';
    this.difficulty = 'intermediate';
    this.model = 'gpt-4o-mini';
    this.personality = 'aggressive';
    this.timeControl = 'unlimited';
    this.soundEnabled = true;

    // ---- State ----
    this.serverOnline = false;
    this.isAIThinking = false;
  }

  // ==================================================
  // INITIALIZATION
  // ==================================================

  init() {
    // ---- Board ----
    const container = document.getElementById('board-container');
    this.board = new BoardUI(container, {
      onMove: (from, to, promotion) => this.handlePlayerMove(from, to, promotion),
    });

    this.board.setLegalMovesProvider((square) => this._getLegalMovesForSquare(square));
    this.board.setBoardStateProvider(() => this.chess.board());
    this.board.setPromotionChecker((from, to) => this._isPromotion(from, to));
    this.board.setPromotionColorProvider(() => this.chess.turn());

    this.board.render();
    this.board.updatePosition(this.chess.board());

    // ---- Move History ----
    this.moveHistory = new MoveHistory(document.getElementById('move-history'));

    // ---- Reasoning Panel ----
    this.reasoningPanel = new ReasoningPanel('reasoning-container');

    // ---- Chat Bubble (AI comments near the board) ----
    this.chatBubble = new ChatBubble('board-area');

    // ---- Chess Clock ----
    this.chessClock = new ChessClock('clock-container');
    this.chessClock.onTimeout = (loser) => this._handleTimeout(loser);

    // ---- Stats ----
    this.stats = new GameStats('stats-display');

    // ---- API Key Modal ----
    this.apiKeyModal = new ApiKeyModal();
    this.apiKeyModal.onChange = () => this._onApiKeyChange();

    // ---- Wire up buttons ----
    document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.requestUndo());
    document.getElementById('btn-flip').addEventListener('click', () => this.flipBoard());
    document.getElementById('btn-key').addEventListener('click', () => this.apiKeyModal.show());
    document.getElementById('btn-share').addEventListener('click', () => this.shareGame());

    // Game over overlay buttons
    const rematchBtn = document.getElementById('btn-rematch');
    if (rematchBtn) rematchBtn.addEventListener('click', () => {
      document.getElementById('game-over-overlay')?.classList.add('hidden');
      this.newGame();
    });
    const reviewBtn = document.getElementById('btn-review');
    if (reviewBtn) reviewBtn.addEventListener('click', () => {
      document.getElementById('game-over-overlay')?.classList.add('hidden');
    });

    // Settings toggle
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsBody = document.getElementById('settings-body');
    if (settingsToggle && settingsBody) {
      settingsToggle.addEventListener('click', () => {
        const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
        settingsToggle.setAttribute('aria-expanded', !expanded);
        settingsBody.classList.toggle('collapsed', expanded);
      });
    }

    // Sound toggle (SVG icon button)
    const soundBtn = document.getElementById('btn-sound');
    soundBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      soundBtn.classList.toggle('sound-off', !this.soundEnabled);
      soundBtn.title = this.soundEnabled ? 'Sound On' : 'Sound Off';
      if (this.soundEnabled) {
        soundBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
      } else {
        soundBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
      }
    });

    // ---- Wire up selectors ----
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) diffSelect.addEventListener('change', (e) => {
      this.difficulty = e.target.value;
      this._updateAIRating();
    });

    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.addEventListener('change', (e) => {
      this.model = e.target.value;
    });

    const personalitySelect = document.getElementById('personality-select');
    if (personalitySelect) personalitySelect.addEventListener('change', (e) => {
      this.personality = e.target.value;
    });

    const timeSelect = document.getElementById('time-select');
    if (timeSelect) timeSelect.addEventListener('change', (e) => {
      this.timeControl = e.target.value;
      const tc = TIME_CONTROLS[this.timeControl];
      if (tc) this.chessClock.configure(tc.time, tc.increment);
    });

    // ---- Check for shared game in URL ----
    this._loadSharedGame();

    // ---- Status + server check ----
    this.updateStatus();
    this._checkServer();

    console.log('♟ Game initialized');
  }

  // ==================================================
  // PLAYER MOVE HANDLING
  // ==================================================

  handlePlayerMove(from, to, promotion) {
    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;

    const result = this.chess.move(moveObj);

    if (result) {
      const lastMove = { from, to };
      const isCheck = this.chess.isCheck();
      const checkSquare = isCheck ? this._findKing(this.chess.turn()) : null;
      this.board.refresh(this.chess.board(), lastMove, checkSquare);
      this.updateStatus();

      if (this.soundEnabled) {
        playSoundForMove(result, this.chess.isGameOver(), isCheck);
      }

      this.moveHistory.addMove(result.san);

      // Switch clock: player's turn ends, AI's turn starts
      if (!this.chessClock.isUnlimited()) {
        if (this.chessClock.activeSide) {
          this.chessClock.switchSide();
        } else {
          // First move of the game: start the clock
          this.chessClock.start(this.aiColor);
        }
      }

      // Hide any chat bubble when player acts
      this.chatBubble.hide();

      console.log(`Player: ${result.san}`);

      if (this.chess.isGameOver()) {
        this._handleGameOver();
        return;
      }

      // Trigger AI
      if (this.chess.turn() === this.aiColor) {
        this.board.setInteractive(false);
        this._triggerAIMove();
      }
    }
  }

  // ==================================================
  // AI MOVE — LLM-powered with streaming + personality
  // ==================================================

  async _triggerAIMove() {
    if (!this.serverOnline) {
      this._playRandomMove();
      return;
    }

    this.isAIThinking = true;
    this.reasoningPanel.startThinking();

    // Pause AI clock during API call (don't penalize for network latency)
    if (!this.chessClock.isUnlimited()) {
      this.chessClock.pause();
    }

    try {
      const fen = this.chess.fen();
      const moveHistory = this.chess.pgn();
      const legalMoves = this.chess.moves();

      console.log(`Asking ${this.model} for move... (${legalMoves.length} legal moves)`);

      const { move, reasoning, comment } = await requestChessMove(
        {
          fen,
          moveHistory,
          legalMoves,
          playerColor: this.playerColor,
          difficulty: this.difficulty,
          model: this.model,
          personality: this.personality,
          apiKey: this.apiKeyModal.getApiKey(),
        },
        {
          onToken: (token) => this.reasoningPanel.appendToken(token),
          onReasoning: (token) => this.reasoningPanel.appendReasoning(token),
        }
      );

      console.log(`AI chose: ${move} | Comment: ${comment}`);

      // Resume AI clock before executing the move
      if (!this.chessClock.isUnlimited()) {
        this.chessClock.resume();
      }

      const result = this.chess.move(move);

      if (result) {
        const lastMove = { from: result.from, to: result.to };
        const isCheck = this.chess.isCheck();
        const checkSquare = isCheck ? this._findKing(this.chess.turn()) : null;
        this.board.refresh(this.chess.board(), lastMove, checkSquare);
        this.updateStatus();

        if (this.soundEnabled) {
          playSoundForMove(result, this.chess.isGameOver(), isCheck);
        }

        this.moveHistory.addMove(result.san);
        this.reasoningPanel.showResult(result.san, reasoning);

        // Switch clock: AI's turn ends, player's turn starts
        if (!this.chessClock.isUnlimited()) {
          this.chessClock.switchSide();
        }

        // Show AI's personality comment after a delay
        if (comment) {
          this.chatBubble.show(comment, 1500 + Math.random() * 1500);
        }

        console.log(`AI: ${result.san}`);

        if (this.chess.isGameOver()) {
          this._handleGameOver();
        } else {
          this.board.setInteractive(true);
        }
      } else {
        console.error('AI move rejected by chess.js:', move);
        this.reasoningPanel.showError(`Invalid move: ${move}`);
        if (this.soundEnabled) playErrorSound();
        this._playRandomMove();
      }
    } catch (error) {
      console.error('AI error:', error.message);
      this.reasoningPanel.showError(error.message);

      // Resume clock on error
      if (!this.chessClock.isUnlimited()) {
        this.chessClock.resume();
      }

      this._playRandomMove();
    } finally {
      this.isAIThinking = false;
    }
  }

  _playRandomMove() {
    setTimeout(() => {
      const moves = this.chess.moves({ verbose: true });
      if (moves.length === 0) return;

      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      const result = this.chess.move(randomMove);

      if (result) {
        const lastMove = { from: result.from, to: result.to };
        const isCheck = this.chess.isCheck();
        const checkSquare = isCheck ? this._findKing(this.chess.turn()) : null;
        this.board.refresh(this.chess.board(), lastMove, checkSquare);
        this.updateStatus();
        this.moveHistory.addMove(result.san);

        if (this.soundEnabled) {
          playSoundForMove(result, this.chess.isGameOver(), isCheck);
        }

        if (!this.chessClock.isUnlimited()) {
          this.chessClock.switchSide();
        }

        console.log(`AI (random): ${result.san}`);

        if (this.chess.isGameOver()) {
          this._handleGameOver();
        } else {
          this.board.setInteractive(true);
        }
      }
    }, 300);
  }

  // ==================================================
  // TAKEBACK (Undo) — AI decides based on personality
  // ==================================================

  async requestUndo() {
    if (this.isAIThinking) return;
    if (this.chess.history().length < 2) return; // Need at least 2 moves to undo

    // Get the last move for context
    const history = this.chess.history();
    const lastMove = history[history.length - 1];

    // Show "asking AI..." in chat bubble
    this.chatBubble.show('🤔 Thinking about your takeback request...', 0);

    try {
      const { accept, comment } = await requestTakeback({
        fen: this.chess.fen(),
        moveHistory: this.chess.pgn(),
        personality: this.personality,
        lastMove,
        apiKey: this.apiKeyModal.getApiKey(),
      });

      // Show AI's response
      this.chatBubble.show(comment, 300);

      if (accept) {
        // Wait a beat for the player to read the comment, then undo
        setTimeout(() => {
          this.chess.undo(); // Undo AI's move
          this.chess.undo(); // Undo player's move
          this.moveHistory.undoMoves(2);
          this.board.setInteractive(true);
          this.board.refresh(this.chess.board(), null, null);
          this.updateStatus();
          console.log('↩ Takeback accepted');
        }, 1200);
      } else {
        console.log('↩ Takeback refused');
      }
    } catch (e) {
      // Fallback: just undo
      this.chess.undo();
      this.chess.undo();
      this.moveHistory.undoMoves(2);
      this.board.setInteractive(true);
      this.board.refresh(this.chess.board(), null, null);
      this.updateStatus();
    }
  }

  // ==================================================
  // GAME OVER HANDLING + STATS
  // ==================================================

  _handleGameOver() {
    this.board.setInteractive(false);
    this.chessClock.stop();

    if (this.soundEnabled) playGameOverSound();

    const overlay = document.getElementById('game-over-overlay');
    const iconEl = document.getElementById('game-over-icon');
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');

    if (this.chess.isCheckmate()) {
      const winnerColor = this.chess.turn() === 'w' ? 'b' : 'w';
      if (winnerColor === this.playerColor) {
        this.stats.recordWin();
        this.chatBubble.show('Well played... I\'ll get you next time!', 1000);
        if (iconEl) iconEl.textContent = '🏆';
        if (titleEl) { titleEl.textContent = 'Victory!'; titleEl.style.color = '#64ffda'; }
        if (subtitleEl) subtitleEl.textContent = 'You won by checkmate';
      } else {
        this.stats.recordLoss();
        this.chatBubble.show('Better luck next time! 😎', 1000);
        if (iconEl) iconEl.textContent = '♚';
        if (titleEl) { titleEl.textContent = 'Defeat'; titleEl.style.color = '#ef5350'; }
        if (subtitleEl) subtitleEl.textContent = 'Checkmate — better luck next time!';
      }
    } else {
      this.stats.recordDraw();
      this.chatBubble.show('A draw... not bad, not bad.', 1000);
      if (iconEl) iconEl.textContent = '🤝';
      if (titleEl) { titleEl.textContent = 'Draw'; titleEl.style.color = '#8892b0'; }
      if (subtitleEl) subtitleEl.textContent = this.chess.isStalemate() ? 'Stalemate' : 'Draw by agreement';
    }

    // Show game over overlay after a short delay
    if (overlay) {
      setTimeout(() => overlay.classList.remove('hidden'), 800);
    }
  }

  _handleTimeout(loserColor) {
    this.board.setInteractive(false);
    this.chessClock.stop();

    if (this.soundEnabled) playGameOverSound();

    const statusEl = document.getElementById('status');
    const overlay = document.getElementById('game-over-overlay');
    const iconEl = document.getElementById('game-over-icon');
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');

    if (loserColor === this.playerColor) {
      statusEl.textContent = 'You ran out of time!';
      statusEl.className = 'status-badge game-over';
      this.stats.recordLoss();
      this.chatBubble.show('Time\'s up! Too slow! ⏰', 500);
      if (iconEl) iconEl.textContent = '⏰';
      if (titleEl) { titleEl.textContent = 'Time\'s Up!'; titleEl.style.color = '#ef5350'; }
      if (subtitleEl) subtitleEl.textContent = 'You ran out of time';
    } else {
      statusEl.textContent = 'AI ran out of time!';
      statusEl.className = 'status-badge game-over';
      this.stats.recordWin();
      if (iconEl) iconEl.textContent = '🏆';
      if (titleEl) { titleEl.textContent = 'Victory!'; titleEl.style.color = '#64ffda'; }
      if (subtitleEl) subtitleEl.textContent = 'AI ran out of time';
    }

    if (overlay) {
      setTimeout(() => overlay.classList.remove('hidden'), 800);
    }
  }

  // ==================================================
  // SHARE GAME LINK
  // ==================================================

  shareGame() {
    const pgn = this.chess.pgn();
    if (!pgn) {
      this.chatBubble.show('No moves to share yet!', 0);
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?pgn=${encodeURIComponent(pgn)}`;

    navigator.clipboard.writeText(url).then(() => {
      this.chatBubble.show('📋 Game link copied to clipboard!', 0);
    }).catch(() => {
      // Fallback for older browsers
      prompt('Copy this link to share the game:', url);
    });
  }

  _loadSharedGame() {
    const params = new URLSearchParams(window.location.search);
    const pgn = params.get('pgn');
    if (!pgn) return;

    try {
      this.chess.loadPgn(decodeURIComponent(pgn));
      this.board.updatePosition(this.chess.board());

      // Replay moves in history
      const history = this.chess.history();
      history.forEach(move => this.moveHistory.addMove(move));

      this.updateStatus();

      // Clean URL (remove the ?pgn= parameter)
      window.history.replaceState({}, '', window.location.pathname);

      console.log(`♟ Loaded shared game (${history.length} moves)`);
    } catch (e) {
      console.warn('Failed to load shared game:', e);
    }
  }

  // ==================================================
  // SERVER CHECK + TIER MANAGEMENT
  // ==================================================

  async _checkServer() {
    try {
      const health = await checkHealth(this.apiKeyModal.getApiKey());
      this.serverOnline = true;
      console.log(`✅ Server online (tier: ${health.tier})`);
    } catch (e) {
      this.serverOnline = false;
      console.warn('⚠️ Server offline — using random moves.');
      if (this.reasoningPanel) this.reasoningPanel.showOffline();
    }
  }

  _onApiKeyChange() {
    this._checkServer();
  }

  // ==================================================
  // STATUS + GAME CONTROLS
  // ==================================================

  updateStatus() {
    const statusEl = document.getElementById('status');

    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      statusEl.textContent = `Checkmate! ${winner} wins!`;
      statusEl.className = 'status-badge game-over';
    } else if (this.chess.isStalemate()) {
      statusEl.textContent = 'Stalemate — Draw!';
      statusEl.className = 'status-badge game-over';
    } else if (this.chess.isDraw()) {
      statusEl.textContent = 'Draw!';
      statusEl.className = 'status-badge game-over';
    } else if (this.chess.isCheck()) {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} is in check!`;
      statusEl.className = 'status-badge in-check';
    } else {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} to move`;
      statusEl.className = 'status-badge';
    }

    // Evaluation bar update
    if (!this.chess.isGameOver()) {
      const evalScore = evaluate(this.chess);
      const whiteScore = this.chess.turn() === 'w' ? evalScore : -evalScore;
      const displayScore = (whiteScore / 100).toFixed(1);
      const sign = whiteScore > 0 ? '+' : '';

      // Update eval bar (vertical)
      const evalBarFill = document.getElementById('eval-bar-fill');
      const evalBarScore = document.getElementById('eval-bar-score');
      if (evalBarFill && evalBarScore) {
        // Convert eval to percentage (sigmoid-ish mapping)
        const pct = 50 + Math.max(-50, Math.min(50, whiteScore / 20));
        evalBarFill.style.height = `${pct}%`;
        evalBarScore.textContent = `${sign}${displayScore}`;
      }
    }
  }

  _updateAIRating() {
    const ratingMap = { beginner: '~800', intermediate: '~1500', advanced: '~2200' };
    const ratingEl = document.getElementById('ai-rating');
    if (ratingEl) ratingEl.textContent = ratingMap[this.difficulty] || '~1500';
  }

  newGame() {
    this.chess.reset();
    this.moveHistory.clear();
    if (this.reasoningPanel) this.reasoningPanel.reset();
    this.chatBubble.hide();
    this.board.setInteractive(true);
    this.board.refresh(this.chess.board(), null, null);
    this.updateStatus();

    // Hide game over overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Reset eval bar
    const evalBarFill = document.getElementById('eval-bar-fill');
    const evalBarScore = document.getElementById('eval-bar-score');
    if (evalBarFill) evalBarFill.style.height = '50%';
    if (evalBarScore) evalBarScore.textContent = '0.0';

    // Reset clock with current time control
    const tc = TIME_CONTROLS[this.timeControl];
    if (tc) this.chessClock.reset(tc.time, tc.increment);

    this._checkServer();
    console.log('♟ New game started');
  }

  flipBoard() {
    const temp = this.playerColor;
    this.playerColor = this.aiColor;
    this.aiColor = temp;

    this.board.flip();
    this.board.updatePosition(this.chess.board());
    this.board.clearHighlights();

    if (this.board.lastMove) {
      this.board.highlightLastMove(this.board.lastMove);
    }
    if (this.chess.isCheck()) {
      this.board.highlightCheck(this._findKing(this.chess.turn()));
    }

    this.updateStatus();

    if (this.chess.turn() === this.aiColor && !this.chess.isGameOver()) {
      this.board.setInteractive(false);
      this._triggerAIMove();
    } else {
      this.board.setInteractive(true);
    }

    console.log(`♟ Board flipped — you are now ${this.playerColor === 'w' ? 'White' : 'Black'}`);
  }

  // ==================================================
  // HELPERS
  // ==================================================

  _getLegalMovesForSquare(square) {
    if (this.chess.turn() !== this.playerColor) return [];
    const moves = this.chess.moves({ square, verbose: true });
    return moves.map(m => m.to);
  }

  _isPromotion(from, to) {
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves.some(m => m.to === to && m.promotion);
  }

  _findKing(color) {
    const board = this.chess.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === color) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          return files[col] + ranks[row];
        }
      }
    }
    return null;
  }
}
