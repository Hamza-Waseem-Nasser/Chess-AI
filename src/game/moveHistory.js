// ============================================
// moveHistory.js — Move Notation Tracker & Display
// ============================================
// Tracks all moves in Standard Algebraic Notation (SAN)
// and renders them in the side panel as numbered pairs:
//
//   1. e4    e5
//   2. Nf3   Nc6
//   3. Bb5   ...
//
// ARCHITECTURE:
//   - Receives SAN strings from GameManager after each move
//   - Stores moves in a flat array: ['e4', 'e5', 'Nf3', 'Nc6', ...]
//   - Renders as pairs: odd indices = white, even indices = black
//   - Auto-scrolls to the latest move
//
// Python analogy:
//   moves = []
//   moves.append('e4')
//   # Render: for i in range(0, len(moves), 2):
//   #            print(f"{i//2 + 1}. {moves[i]}  {moves[i+1] if i+1 < len(moves) else '...'}")
// ============================================

export class MoveHistory {
  constructor(containerEl) {
    // The DOM element where we render the move list
    this.container = containerEl;

    // Flat array of SAN strings: ['e4', 'e5', 'Nf3', 'Nc6', ...]
    // Index 0,2,4,... = white moves. Index 1,3,5,... = black moves.
    this.moves = [];

    // Initial render (empty state)
    this._render();
  }

  /**
   * Add a move to the history.
   * @param {string} san - Standard Algebraic Notation, e.g., 'Nf3', 'O-O', 'exd5'
   */
  addMove(san) {
    this.moves.push(san);
    this._render();
  }

  /**
   * Remove the last N moves (for undo).
   * @param {number} count - How many moves to undo (default: 1)
   */
  undoMoves(count = 1) {
    for (let i = 0; i < count; i++) {
      this.moves.pop();
    }
    this._render();
  }

  /**
   * Clear all moves (for new game).
   */
  clear() {
    this.moves = [];
    this._render();
  }

  /**
   * Render the move list into the container.
   * 
   * Structure:
   *   <div class="move-row">
   *     <span class="move-number">1.</span>
   *     <span class="move white">e4</span>
   *     <span class="move black">e5</span>
   *   </div>
   */
  _render() {
    // If no moves yet, show placeholder
    if (this.moves.length === 0) {
      this.container.innerHTML = '<div class="move-placeholder">No moves yet</div>';
      return;
    }

    let html = '';

    // Iterate in pairs: [white, black], [white, black], ...
    for (let i = 0; i < this.moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = this.moves[i];
      const blackMove = i + 1 < this.moves.length ? this.moves[i + 1] : '';

      // Determine if this is the latest move (for highlighting)
      const isLatestWhite = (i === this.moves.length - 1);
      const isLatestBlack = (i + 1 === this.moves.length - 1);

      html += `<div class="move-row">`;
      html += `<span class="move-number">${moveNumber}.</span>`;
      html += `<span class="move white${isLatestWhite ? ' latest' : ''}">${whiteMove}</span>`;
      if (blackMove) {
        html += `<span class="move black${isLatestBlack ? ' latest' : ''}">${blackMove}</span>`;
      }
      html += `</div>`;
    }

    this.container.innerHTML = html;

    // Auto-scroll to the bottom (latest move)
    this.container.scrollTop = this.container.scrollHeight;
  }
}
