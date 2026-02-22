// ============================================
// gameManager.js — Game State Manager
// ============================================
// This is the BRAIN of the application.
// It owns the chess.js instance (source of truth for the game state)
// and coordinates between the UI and the AI.
//
// Responsibilities:
//   - Initialize a new game
//   - Handle player moves (validate via chess.js)
//   - Trigger AI moves when it's the AI's turn
//   - Detect game-over conditions (checkmate, stalemate, draw)
//   - Manage undo/new game actions
// ============================================

import { Chess } from 'chess.js';

export class GameManager {
  constructor() {
    // chess.js instance — THE single source of truth
    // Every move, every rule check, every board state comes from here
    this.chess = new Chess();

    // Configuration
    this.playerColor = 'w';  // Human plays white
    this.aiColor = 'b';      // AI plays black
  }

  /**
   * Initialize the game — called once when the app starts.
   * Later, this will set up the board UI, AI worker, and event listeners.
   */
  init() {
    console.log('Game initialized');
    console.log('Starting position (FEN):', this.chess.fen());
    console.log('Legal moves:', this.chess.moves());

    // Update the status display
    this.updateStatus();

    // Wire up buttons
    document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
  }

  /**
   * Update the status text (whose turn, check, checkmate, etc.)
   */
  updateStatus() {
    const statusEl = document.getElementById('status');
    
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      statusEl.textContent = `Checkmate! ${winner} wins!`;
    } else if (this.chess.isDraw()) {
      statusEl.textContent = 'Draw!';
    } else if (this.chess.isStalemate()) {
      statusEl.textContent = 'Stalemate!';
    } else if (this.chess.isCheck()) {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} is in check!`;
    } else {
      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      statusEl.textContent = `${turn} to move`;
    }
  }

  /**
   * Start a new game — reset everything
   */
  newGame() {
    this.chess.reset();
    this.updateStatus();
    console.log('New game started');
  }

  /**
   * Undo the last move (undo 2 moves to undo both player + AI)
   */
  undo() {
    this.chess.undo(); // Undo AI's move
    this.chess.undo(); // Undo player's move
    this.updateStatus();
    console.log('Move undone');
  }
}
