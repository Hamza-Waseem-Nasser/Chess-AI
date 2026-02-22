// ============================================
// constants.js — Shared Constants
// ============================================
// Central place for values used across modules.
// Avoids "magic numbers" scattered through the code.
// ============================================

// Board dimensions
export const BOARD_SIZE = 8;
export const SQUARE_SIZE = 70;  // pixels (560px board / 8 squares)

// Colors for board squares
export const COLORS = {
  LIGHT: '#eeeed2',
  DARK: '#769656',
  HIGHLIGHT: 'rgba(255, 255, 0, 0.4)',
  LEGAL_MOVE: 'rgba(0, 0, 0, 0.15)',
  LAST_MOVE: 'rgba(255, 255, 0, 0.3)',
  CHECK: 'rgba(255, 0, 0, 0.5)',
};

// Piece values (centipawns — 100 = 1 pawn)
// Used by the AI evaluation function
export const PIECE_VALUES = {
  p: 100,   // Pawn
  n: 320,   // Knight
  b: 330,   // Bishop
  r: 500,   // Rook
  q: 900,   // Queen
  k: 20000, // King (effectively infinite — can't be captured)
};

// AI configuration
export const AI_CONFIG = {
  MAX_DEPTH: 5,           // Maximum search depth
  TIME_LIMIT_MS: 3000,    // Max think time (milliseconds)
};
