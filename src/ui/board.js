// ============================================
// board.js — Chessboard Rendering & Interaction
// ============================================
// Responsible for:
//   - Rendering the 8x8 grid of squares
//   - Placing/moving piece images on squares
//   - Highlighting squares (selection, legal moves, last move, check)
//   - Handling click-to-move and drag-and-drop input
//   - Coordinate labels (a-h, 1-8)
//   - Pawn promotion dialog
//
// ARCHITECTURE NOTE:
//   This class does NOT know chess rules. It only knows how to DRAW.
//   It receives data (board state, legal moves) from GameManager and
//   fires callbacks when the user makes a move. GameManager validates.
//
// Python analogy:
//   Think of this as a Pygame Surface class that handles all rendering
//   and mouse events, but calls back to a "controller" for game logic.
// ============================================

import { BOARD_SIZE, SQUARE_SIZE, COLORS } from '../utils/constants.js';
import { getPieceSVG } from './pieces.js';

// Files (columns) and ranks (rows) labels
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export class BoardUI {
  /**
   * @param {HTMLElement} container - The DOM element to render the board into
   * @param {object} callbacks - Event handlers provided by GameManager:
   *   - onMove(from, to): called when user moves a piece (e.g., 'e2' → 'e4')
   *   - onPromotionChoice(from, to, piece): called when user picks a promotion piece
   */
  constructor(container, callbacks = {}) {
    // ---- DOM References ----
    this.container = container;     // The #board-container div
    this.boardEl = null;            // The board grid element (created in render())
    this.squares = {};              // Map: 'e4' → <div> element for that square

    // ---- Callbacks ----
    this.onMove = callbacks.onMove || (() => {});

    // ---- Interaction State ----
    this.selectedSquare = null;     // Currently selected square (e.g., 'e2') or null
    this.legalMoves = [];           // Legal destination squares for selected piece
    this.lastMove = null;           // { from: 'e2', to: 'e4' } or null
    this.isFlipped = false;         // false = white at bottom, true = black at bottom
    this.interactive = true;        // Can the user interact? (false during AI turn)

    // ---- Drag State ----
    this.dragPiece = null;          // The floating piece element during drag
    this.dragFrom = null;           // Square being dragged from
    this.isDragging = false;

    // ---- Promotion State ----
    this.pendingPromotion = null;   // { from, to } awaiting piece choice
  }

  // ==================================================
  // RENDERING — Building the board from scratch
  // ==================================================

  /**
   * Render the entire board. Called once during initialization.
   * Creates 64 square elements arranged in an 8x8 CSS Grid.
   *
   * CSS Grid explained (Python analogy):
   *   Imagine a 2D list: board = [[None]*8 for _ in range(8)]
   *   CSS Grid does the same but for visual layout —
   *   you say "8 columns, 8 rows" and the browser arranges children automatically.
   */
  render() {
    // Create the board grid element
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';
    this.container.innerHTML = '';  // Clear any previous board
    this.container.appendChild(this.boardEl);

    // Create 64 squares
    // We iterate in visual order: top-left to bottom-right
    // When not flipped: rank 8 (black side) at top, rank 1 (white side) at bottom
    const rankOrder = this.isFlipped ? [...RANKS].reverse() : RANKS;
    const fileOrder = this.isFlipped ? [...FILES].reverse() : FILES;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const rank = rankOrder[row];
        const file = fileOrder[col];
        const squareName = file + rank;  // e.g., 'e4'

        // Determine square color: (row + col) % 2 === 0 → light, else dark
        // Same math as in Pygame: if (row + col) is even, it's a light square
        const isLight = (row + col) % 2 === 0;

        // Create the square element
        const squareEl = document.createElement('div');
        squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
        squareEl.dataset.square = squareName;  // Store square name in data attribute

        // Add coordinate labels on the edges
        // File labels (a-h) on the bottom row
        if (row === BOARD_SIZE - 1) {
          const fileLabel = document.createElement('span');
          fileLabel.className = `coord coord-file ${isLight ? 'dark-text' : 'light-text'}`;
          fileLabel.textContent = file;
          squareEl.appendChild(fileLabel);
        }
        // Rank labels (1-8) on the leftmost column
        if (col === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = `coord coord-rank ${isLight ? 'dark-text' : 'light-text'}`;
          rankLabel.textContent = rank;
          squareEl.appendChild(rankLabel);
        }

        // ---- EVENT LISTENERS ----
        // Click handler
        squareEl.addEventListener('click', (e) => this._onSquareClick(squareName, e));

        // Drag handlers (mousedown starts drag)
        squareEl.addEventListener('mousedown', (e) => this._onDragStart(squareName, e));

        // Store reference and add to board
        this.squares[squareName] = squareEl;
        this.boardEl.appendChild(squareEl);
      }
    }

    // Global mouse handlers for drag (need to track mouse outside the board)
    // This is like Pygame's event loop — we listen at the document level
    document.addEventListener('mousemove', (e) => this._onDragMove(e));
    document.addEventListener('mouseup', (e) => this._onDragEnd(e));

    return this;
  }

  // ==================================================
  // BOARD STATE — Placing pieces on the board
  // ==================================================

  /**
   * Update the board to match a given position.
   * @param {object} boardState - 2D array from chess.js: chess.board()
   *   Each element is { type: 'p', color: 'w' } or null
   *
   * chess.board() returns:
   *   [
   *     [ {type:'r',color:'b'}, {type:'n',color:'b'}, ... ],  ← rank 8 (index 0)
   *     [ {type:'p',color:'b'}, {type:'p',color:'b'}, ... ],  ← rank 7 (index 1)
   *     ...
   *     [ {type:'P',color:'w'}, ... ],                        ← rank 1 (index 7)
   *   ]
   */
  updatePosition(boardState) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const file = FILES[col];
        const rank = RANKS[row];
        const squareName = file + rank;
        const squareEl = this.squares[squareName];
        const piece = boardState[row][col];

        // Remove existing piece from this square (if any)
        const existingPiece = squareEl.querySelector('.piece');
        if (existingPiece) {
          existingPiece.remove();
        }

        // Place new piece (if any)
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece';
          pieceEl.innerHTML = getPieceSVG(piece.color, piece.type);
          // Prevent default drag behavior on images (browser tries to drag images natively)
          pieceEl.addEventListener('dragstart', (e) => e.preventDefault());
          squareEl.appendChild(pieceEl);
        }
      }
    }
  }

  // ==================================================
  // HIGHLIGHTING — Visual feedback for the player
  // ==================================================

  /**
   * Clear all highlights (selection, legal moves, etc.)
   */
  clearHighlights() {
    Object.values(this.squares).forEach(sq => {
      sq.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move-from', 'last-move-to', 'in-check');
      // Remove legal move dot indicators
      const dot = sq.querySelector('.move-dot');
      if (dot) dot.remove();
      const captureDot = sq.querySelector('.capture-ring');
      if (captureDot) captureDot.remove();
    });
  }

  /**
   * Highlight the selected square.
   * @param {string} square - e.g., 'e2'
   */
  highlightSelected(square) {
    if (this.squares[square]) {
      this.squares[square].classList.add('selected');
    }
  }

  /**
   * Show legal move indicators.
   * - Empty squares: small dot in center
   * - Occupied squares (captures): ring around the outside
   * @param {string[]} moves - Array of destination squares, e.g., ['e3', 'e4']
   * @param {object} boardState - Current board to detect captures
   */
  showLegalMoves(moves, boardState) {
    moves.forEach(move => {
      const squareEl = this.squares[move];
      if (!squareEl) return;

      // Determine if this is a capture (destination has an opponent's piece)
      const { row, col } = this._squareToRowCol(move);
      const targetPiece = boardState[row][col];

      if (targetPiece) {
        // Capture: show a ring
        squareEl.classList.add('legal-capture');
        const ring = document.createElement('div');
        ring.className = 'capture-ring';
        squareEl.appendChild(ring);
      } else {
        // Quiet move: show a dot
        squareEl.classList.add('legal-move');
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        squareEl.appendChild(dot);
      }
    });
  }

  /**
   * Highlight the last move (from and to squares).
   * @param {{ from: string, to: string } | null} move
   */
  highlightLastMove(move) {
    if (!move) return;
    if (this.squares[move.from]) this.squares[move.from].classList.add('last-move-from');
    if (this.squares[move.to]) this.squares[move.to].classList.add('last-move-to');
  }

  /**
   * Highlight the king square when in check.
   * @param {string|null} square - King's square, e.g., 'e1', or null
   */
  highlightCheck(square) {
    if (square && this.squares[square]) {
      this.squares[square].classList.add('in-check');
    }
  }

  // ==================================================
  // CLICK-TO-MOVE — Select a piece, then click destination
  // ==================================================

  /**
   * Handle square click.
   * Two-step process:
   *   1. Click a piece → select it, show legal moves
   *   2. Click a legal destination → make the move
   *   (Click elsewhere → deselect)
   *
   * @param {string} squareName - e.g., 'e2'
   */
  _onSquareClick(squareName) {
    if (!this.interactive) return;

    // If promotion dialog is open, ignore board clicks
    if (this.pendingPromotion) return;

    if (this.selectedSquare) {
      // A piece is already selected — try to move to clicked square
      if (this.legalMoves.includes(squareName)) {
        // Valid destination — make the move
        this._executeMove(this.selectedSquare, squareName);
      } else {
        // Invalid destination — try selecting the new square instead
        this._deselectPiece();
        this._trySelectPiece(squareName);
      }
    } else {
      // Nothing selected — try to select the clicked piece
      this._trySelectPiece(squareName);
    }
  }

  /**
   * Try to select a piece on the given square.
   * Only selects if there's a friendly piece and the game provides legal moves.
   */
  _trySelectPiece(squareName) {
    // We'll fire a request for legal moves — GameManager decides if selection is valid
    // For now, the board stores a callback that returns legal moves for a square
    if (this._getLegalMovesForSquare) {
      const moves = this._getLegalMovesForSquare(squareName);
      if (moves && moves.length > 0) {
        this.selectedSquare = squareName;
        this.legalMoves = moves;
        this.clearHighlights();
        this.highlightLastMove(this.lastMove);
        this.highlightSelected(squareName);
        this.showLegalMoves(moves, this._getBoardState());
      }
    }
  }

  /**
   * Deselect the current piece.
   */
  _deselectPiece() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.clearHighlights();
    this.highlightLastMove(this.lastMove);
  }

  /**
   * Execute a move from source to destination.
   * Checks if it's a pawn promotion first.
   */
  _executeMove(from, to) {
    // Check if this is a pawn promotion
    if (this._isPromotion && this._isPromotion(from, to)) {
      this._showPromotionDialog(from, to);
      return;
    }

    this.selectedSquare = null;
    this.legalMoves = [];
    this.onMove(from, to);
  }

  // ==================================================
  // DRAG AND DROP — Pick up and drop pieces
  // ==================================================

  /**
   * Start dragging a piece.
   * Creates a floating copy of the piece that follows the mouse cursor.
   */
  _onDragStart(squareName, e) {
    if (!this.interactive) return;
    if (this.pendingPromotion) return;
    if (e.button !== 0) return; // Only left mouse button

    // Check if there's a piece here and we have legal moves
    if (!this._getLegalMovesForSquare) return;
    const moves = this._getLegalMovesForSquare(squareName);
    if (!moves || moves.length === 0) return;

    e.preventDefault();

    // Select the piece
    this.selectedSquare = squareName;
    this.legalMoves = moves;
    this.dragFrom = squareName;
    this.isDragging = true;

    // Show legal moves
    this.clearHighlights();
    this.highlightLastMove(this.lastMove);
    this.highlightSelected(squareName);
    this.showLegalMoves(moves, this._getBoardState());

    // Create floating piece element
    const squareEl = this.squares[squareName];
    const pieceEl = squareEl.querySelector('.piece');
    if (!pieceEl) return;

    // Clone the piece for dragging
    this.dragPiece = pieceEl.cloneNode(true);
    this.dragPiece.className = 'piece dragging';
    this.dragPiece.style.width = SQUARE_SIZE + 'px';
    this.dragPiece.style.height = SQUARE_SIZE + 'px';
    document.body.appendChild(this.dragPiece);

    // Position the floating piece at the cursor
    this._moveDragPiece(e.clientX, e.clientY);

    // Make the original piece semi-transparent
    pieceEl.style.opacity = '0.3';
  }

  /**
   * Move the floating piece with the cursor.
   */
  _onDragMove(e) {
    if (!this.isDragging || !this.dragPiece) return;
    e.preventDefault();
    this._moveDragPiece(e.clientX, e.clientY);
  }

  /**
   * Drop the piece — determine which square it was dropped on.
   */
  _onDragEnd(e) {
    if (!this.isDragging) return;

    // Remove the floating piece
    if (this.dragPiece) {
      this.dragPiece.remove();
      this.dragPiece = null;
    }

    // Restore original piece opacity
    if (this.dragFrom) {
      const squareEl = this.squares[this.dragFrom];
      const pieceEl = squareEl?.querySelector('.piece');
      if (pieceEl) pieceEl.style.opacity = '1';
    }

    // Determine which square we dropped on
    const dropSquare = this._getSquareFromPoint(e.clientX, e.clientY);

    if (dropSquare && this.legalMoves.includes(dropSquare) && dropSquare !== this.dragFrom) {
      // Valid drop — make the move
      this._executeMove(this.dragFrom, dropSquare);
    } else {
      // Invalid drop — deselect
      this._deselectPiece();
    }

    this.isDragging = false;
    this.dragFrom = null;
  }

  /**
   * Position the floating drag piece centered on the cursor.
   */
  _moveDragPiece(x, y) {
    if (!this.dragPiece) return;
    this.dragPiece.style.left = (x - SQUARE_SIZE / 2) + 'px';
    this.dragPiece.style.top = (y - SQUARE_SIZE / 2) + 'px';
  }

  /**
   * Determine which square is at a given screen coordinate.
   * Converts pixel position → square name (e.g., 'e4').
   */
  _getSquareFromPoint(x, y) {
    // Use document.elementFromPoint to find which square element is at (x, y)
    // We temporarily hide the drag piece so it doesn't block the detection
    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    // Walk up the DOM to find the square element
    const squareEl = el.closest('.square');
    if (!squareEl) return null;

    return squareEl.dataset.square;
  }

  // ==================================================
  // PAWN PROMOTION — Dialog to choose promotion piece
  // ==================================================

  /**
   * Show a promotion dialog when a pawn reaches the last rank.
   * Displays 4 piece options: Queen, Rook, Bishop, Knight.
   */
  _showPromotionDialog(from, to) {
    this.pendingPromotion = { from, to };

    // Determine which color is promoting
    const color = this._getPromotionColor ? this._getPromotionColor() : 'w';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'promotion-overlay';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'promotion-dialog';

    const pieces = ['q', 'r', 'b', 'n'];  // Queen, Rook, Bishop, Knight
    const labels = ['Queen', 'Rook', 'Bishop', 'Knight'];

    pieces.forEach((piece, i) => {
      const option = document.createElement('div');
      option.className = 'promotion-option';
      option.innerHTML = getPieceSVG(color, piece);
      option.title = labels[i];
      option.addEventListener('click', () => {
        // Remove dialog
        overlay.remove();
        this.pendingPromotion = null;
        // Fire move with promotion piece
        this.selectedSquare = null;
        this.legalMoves = [];
        this.onMove(from, to, piece);
      });
      dialog.appendChild(option);
    });

    overlay.appendChild(dialog);
    this.container.appendChild(overlay);
  }

  // ==================================================
  // UTILITY METHODS
  // ==================================================

  /**
   * Convert square name to row/col indices.
   * 'e4' → { row: 4, col: 4 }  (row 0 = rank 8, col 0 = file a)
   */
  _squareToRowCol(squareName) {
    const file = squareName[0];
    const rank = squareName[1];
    const col = FILES.indexOf(file);
    const row = RANKS.indexOf(rank);
    return { row, col };
  }

  /**
   * Set the function that provides legal moves for a square.
   * Called by GameManager to wire up the connection.
   */
  setLegalMovesProvider(fn) {
    this._getLegalMovesForSquare = fn;
  }

  /**
   * Set the function that provides the current board state.
   */
  setBoardStateProvider(fn) {
    this._getBoardState = fn;
  }

  /**
   * Set the function that checks if a move is a pawn promotion.
   */
  setPromotionChecker(fn) {
    this._isPromotion = fn;
  }

  /**
   * Set the function that returns the promoting side's color.
   */
  setPromotionColorProvider(fn) {
    this._getPromotionColor = fn;
  }

  /**
   * Set whether the board is interactive (player's turn) or locked (AI's turn).
   */
  setInteractive(value) {
    this.interactive = value;
    if (this.boardEl) {
      this.boardEl.classList.toggle('disabled', !value);
    }
  }

  /**
   * Flip the board orientation.
   */
  flip() {
    this.isFlipped = !this.isFlipped;
    // Re-render the board with new orientation
    this.render();
  }

  /**
   * Store the last move for highlighting.
   */
  setLastMove(move) {
    this.lastMove = move;
  }

  /**
   * Full refresh: clear highlights, update pieces, re-apply highlights.
   * Called after every move. Includes piece slide animation.
   */
  refresh(boardState, lastMove = null, checkSquare = null) {
    this.lastMove = lastMove;
    this.clearHighlights();

    // ---- ANIMATION (FLIP technique) ----
    // If there's a lastMove, animate the piece sliding from → to.
    // FLIP = First, Last, Invert, Play:
    //   1. FIRST: Record where the piece is now (at "from" square)
    //   2. LAST: Update the board (piece teleports to "to" square)
    //   3. INVERT: Offset the piece back to where it was
    //   4. PLAY: Animate the offset back to 0 (piece slides into place)
    //
    // Python analogy: Like calculating a transform offset in Pygame
    //   and using a tween to animate it over a few frames.
    if (lastMove) {
      const fromEl = this.squares[lastMove.from];
      const toEl = this.squares[lastMove.to];

      if (fromEl && toEl) {
        // 1. FIRST: Get pixel position of source square
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const dx = fromRect.left - toRect.left;
        const dy = fromRect.top - toRect.top;

        // 2. LAST: Update the board (piece appears at destination)
        this.updatePosition(boardState);
        this.highlightLastMove(lastMove);
        this.highlightCheck(checkSquare);

        // 3. INVERT + 4. PLAY: Offset the piece, then animate
        const pieceEl = toEl.querySelector('.piece');
        if (pieceEl && (dx !== 0 || dy !== 0)) {
          // Set the piece at its old position (no transition yet)
          pieceEl.style.transition = 'none';
          pieceEl.style.transform = `translate(${dx}px, ${dy}px)`;
          pieceEl.style.zIndex = '10';

          // Force the browser to apply the offset before animating
          // (This is called "forcing a reflow" — without it, the browser
          //  might skip the offset and go straight to the final position)
          pieceEl.offsetHeight; // eslint-disable-line no-unused-expressions

          // Now animate to the real position
          pieceEl.style.transition = 'transform 0.15s ease-out';
          pieceEl.style.transform = 'translate(0, 0)';

          // Clean up after animation completes
          pieceEl.addEventListener('transitionend', () => {
            pieceEl.style.transition = '';
            pieceEl.style.transform = '';
            pieceEl.style.zIndex = '';
          }, { once: true });
        }
        return;
      }
    }

    // No animation (e.g., new game, undo)
    this.updatePosition(boardState);
    this.highlightLastMove(lastMove);
    this.highlightCheck(checkSquare);
  }
}
