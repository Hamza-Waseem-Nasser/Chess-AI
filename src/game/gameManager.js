// ============================================
// gameManager.js — Game State Manager
// ============================================
// This is the BRAIN of the application.
// It owns the chess.js instance (source of truth for the game state)
// and coordinates between the UI (BoardUI) and the AI.
//
// ARCHITECTURE:
//   GameManager is the "controller" in MVC pattern:
//   - Model: chess.js (rules, state)
//   - View: BoardUI (rendering, user input)
//   - Controller: GameManager (this file — wires them together)
//
// Python analogy:
//   Like a FastAPI/Flask controller that receives user input,
//   calls business logic, and returns a response to the view.
//   Except here it's all client-side, no HTTP.
// ============================================

import { Chess } from 'chess.js';
import { BoardUI } from '../ui/board.js';
import { MoveHistory } from './moveHistory.js';
import { evaluate, evaluateDetailed } from '../ai/evaluate.js';

export class GameManager {
  constructor() {
    // ---- Chess Engine (Model) ----
    // chess.js instance — THE single source of truth
    this.chess = new Chess();

    // ---- Board UI (View) ----
    this.board = null;      // Initialized in init()
    this.moveHistory = null; // Initialized in init()

    // ---- Configuration ----
    this.playerColor = 'w';  // Human plays white
    this.aiColor = 'b';      // AI plays black
  }

  /**
   * Initialize the game — called once when the app starts.
   * Sets up the board UI, wires callbacks, and renders the starting position.
   */
  init() {
    // Create the board UI
    const container = document.getElementById('board-container');
    this.board = new BoardUI(container, {
      // This callback fires when the user makes a move (click or drag)
      onMove: (from, to, promotion) => this.handlePlayerMove(from, to, promotion),
    });

    // ---- Wire up the board's data providers ----
    // The board needs to ask: "what are the legal moves for square X?"
    // Instead of giving the board access to chess.js directly (bad — tight coupling),
    // we provide callback functions. The board calls them when it needs data.
    //
    // Python analogy: Dependency injection — pass in functions instead of objects.

    // Provider: legal moves for a given square
    this.board.setLegalMovesProvider((square) => this._getLegalMovesForSquare(square));

    // Provider: current board state (2D array of pieces)
    this.board.setBoardStateProvider(() => this.chess.board());

    // Provider: is this move a pawn promotion?
    this.board.setPromotionChecker((from, to) => this._isPromotion(from, to));

    // Provider: what color is currently promoting?
    this.board.setPromotionColorProvider(() => this.chess.turn());

    // Render the board and place pieces
    this.board.render();
    this.board.updatePosition(this.chess.board());

    // Create the move history display
    this.moveHistory = new MoveHistory(document.getElementById('move-history'));

    // Update status text
    this.updateStatus();

    // Wire up buttons
    document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());

    console.log('♟ Game initialized');
  }

  // ==================================================
  // PLAYER MOVE HANDLING
  // ==================================================

  /**
   * Handle a move from the player (fired by BoardUI).
   * @param {string} from - Source square, e.g., 'e2'
   * @param {string} to - Destination square, e.g., 'e4'
   * @param {string} [promotion] - Promotion piece, e.g., 'q'
   */
  handlePlayerMove(from, to, promotion) {
    // Build the move object for chess.js
    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;

    // Attempt the move — chess.js validates it
    const result = this.chess.move(moveObj);

    if (result) {
      // Move was valid — update the board
      const lastMove = { from, to };
      const checkSquare = this.chess.isCheck() ? this._findKing(this.chess.turn()) : null;
      this.board.refresh(this.chess.board(), lastMove, checkSquare);
      this.updateStatus();

      // Record in move history
      this.moveHistory.addMove(result.san);

      console.log(`Player: ${result.san}`);

      // Check for game over
      if (this.chess.isGameOver()) {
        this.board.setInteractive(false);
        return;
      }

      // If it's now AI's turn, trigger AI (Module 5+)
      if (this.chess.turn() === this.aiColor) {
        this.board.setInteractive(false);
        this._triggerAIMove();
      }
    }
  }

  // ==================================================
  // AI MOVE (placeholder until Module 5+)
  // ==================================================

  /**
   * Trigger the AI to make a move.
   * For now, plays a random legal move after a short delay.
   * Will be replaced with real AI in Module 5.
   */
  _triggerAIMove() {
    // Simulate "thinking" with a small delay
    setTimeout(() => {
      const moves = this.chess.moves({ verbose: true });
      if (moves.length === 0) return;

      // Random move for now
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      const result = this.chess.move(randomMove);

      if (result) {
        const lastMove = { from: result.from, to: result.to };
        const checkSquare = this.chess.isCheck() ? this._findKing(this.chess.turn()) : null;
        this.board.refresh(this.chess.board(), lastMove, checkSquare);
        this.updateStatus();

        // Record in move history
        this.moveHistory.addMove(result.san);

        console.log(`AI: ${result.san}`);

        if (!this.chess.isGameOver()) {
          this.board.setInteractive(true);
        }
      }
    }, 300);  // 300ms delay to feel natural
  }

  // ==================================================
  // STATUS & GAME CONTROLS
  // ==================================================

  /**
   * Update the status text (whose turn, check, checkmate, etc.)
   */
  updateStatus() {
    const statusEl = document.getElementById('status');

    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      statusEl.textContent = `Checkmate! ${winner} wins!`;
      statusEl.classList.add('game-over');
    } else if (this.chess.isStalemate()) {
      statusEl.textContent = 'Stalemate — Draw!';
      statusEl.classList.add('game-over');
    } else if (this.chess.isDraw()) {
      statusEl.textContent = 'Draw!';
      statusEl.classList.add('game-over');
    } else if (this.chess.isCheck()) {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} is in check!`;
    } else {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} to move`;
      statusEl.classList.remove('game-over');
    }

    // Show evaluation score (for learning/debugging)
    // Positive = White advantage, Negative = Black advantage
    if (!this.chess.isGameOver()) {
      const evalScore = evaluate(this.chess);
      // Convert from side-to-move perspective to White's perspective for display
      const whiteScore = this.chess.turn() === 'w' ? evalScore : -evalScore;
      const displayScore = (whiteScore / 100).toFixed(1);  // Convert centipawns to pawns
      const sign = whiteScore > 0 ? '+' : '';
      const evalEl = document.getElementById('eval-display');
      if (evalEl) {
        evalEl.textContent = `Eval: ${sign}${displayScore}`;
        evalEl.className = `eval-display ${whiteScore > 50 ? 'white-advantage' : whiteScore < -50 ? 'black-advantage' : 'equal'}`;
      }
      // Log detailed breakdown to console (open DevTools → Console to see)
      console.log('Evaluation:', evaluateDetailed(this.chess));
    }
  }

  /**
   * Start a new game — reset everything.
   */
  newGame() {
    this.chess.reset();
    this.moveHistory.clear();
    this.board.setInteractive(true);
    this.board.refresh(this.chess.board(), null, null);
    this.updateStatus();
    console.log('♟ New game started');
  }

  /**
   * Undo the last move pair (player + AI).
   */
  undo() {
    // If it's currently player's turn, undo AI's move + player's previous move
    // If it's AI's turn, just undo player's last move
    this.chess.undo(); // Undo AI's move (or player's if AI hasn't moved)
    this.chess.undo(); // Undo player's move
    this.moveHistory.undoMoves(2); // Remove both from history

    this.board.setInteractive(true);
    this.board.refresh(this.chess.board(), null, null);
    this.updateStatus();
    console.log('↩ Move undone');
  }

  // ==================================================
  // HELPER METHODS
  // ==================================================

  /**
   * Get legal destination squares for a piece on the given square.
   * Returns an array of square names, e.g., ['e3', 'e4']
   *
   * Only returns moves if it's the player's turn and the piece belongs to the player.
   */
  _getLegalMovesForSquare(square) {
    // Only allow moves on player's turn
    if (this.chess.turn() !== this.playerColor) return [];

    // Get all legal moves from this square
    // chess.js moves({ square, verbose: true }) returns detailed move objects
    const moves = this.chess.moves({ square, verbose: true });

    // Extract just the destination squares
    return moves.map(m => m.to);
  }

  /**
   * Check if a move from → to is a pawn promotion.
   * A pawn promotes when it reaches the last rank (rank 8 for white, rank 1 for black).
   */
  _isPromotion(from, to) {
    const moves = this.chess.moves({ square: from, verbose: true });
    // Check if any legal move from this square to the target has a promotion flag
    return moves.some(m => m.to === to && m.promotion);
  }

  /**
   * Find the king's square for a given color.
   * Used to highlight the king when in check.
   * @param {string} color - 'w' or 'b'
   * @returns {string|null} Square name, e.g., 'e1'
   */
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
