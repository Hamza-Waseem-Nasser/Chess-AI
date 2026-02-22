// ============================================
// evaluate.js — Board Evaluation Function
// ============================================
// The AI's "eyes" — looks at a chess position and returns a score.
//
// Score convention:
//   Positive = White is winning
//   Negative = Black is winning
//   Zero     = Equal position
//   ±100     = One pawn advantage
//   ±300     = One minor piece (knight/bishop) advantage
//   ±500     = One rook advantage  
//   ±900     = One queen advantage
//   ±20000   = Checkmate
//
// Components:
//   1. Material    — who has more/better pieces?
//   2. PST         — are pieces on good squares?
//   3. Pawn struct  — doubled, isolated, passed pawns
//   4. King safety — castled, pawn shield
//   5. Mobility    — who has more moves available?
//   6. Bishop pair — having both bishops is a bonus
//   7. Game phase  — tapered eval (middlegame ↔ endgame blend)
//
// Python analogy:
//   def evaluate(chess) -> int:
//       mg_score = 0   # middlegame
//       eg_score = 0   # endgame
//       for each piece on board:
//           mg_score += material + middlegame_pst[piece][square]
//           eg_score += material + endgame_pst[piece][square]
//       phase = compute_game_phase()
//       return mg_score * phase + eg_score * (1 - phase)
// ============================================

// ============================================
// PIECE VALUES
// ============================================
// In centipawns (100 = 1 pawn).
// Separate values for middlegame and endgame because piece importance shifts:
//   - Knights are slightly weaker in endgames (fewer pieces to jump over)
//   - Rooks become stronger in endgames (open files appear)
//   - Pawns become MORE valuable in endgames (promotion potential)

const PIECE_VALUE_MG = { p: 82, n: 337, b: 365, r: 477, q: 1025, k: 0 };
const PIECE_VALUE_EG = { p: 94, n: 281, b: 297, r: 512, q: 936,  k: 0 };

// Phase weights — how much each piece type contributes to "game phase"
// Used to determine: are we in middlegame or endgame?
// Total starting phase = 4*1 + 4*1 + 4*2 + 2*4 = 24
const PHASE_WEIGHTS = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
const TOTAL_PHASE = 24;  // All minor pieces + rooks + queens on the board

// ============================================
// PIECE-SQUARE TABLES (PST)
// ============================================
// Each table is an 8x8 array viewed from WHITE's perspective.
// Row 0 = rank 8 (Black's back rank), Row 7 = rank 1 (White's back rank)
//
// For BLACK pieces, we mirror the table vertically (read row 7 as rank 8, etc.)
//
// These values are from established chess programming tuning (PeSTO tables),
// refined over decades by the computer chess community.
//
// HOW TO READ:
//   A positive number = the piece WANTS to be on that square
//   A negative number = the piece should AVOID that square
//   The number is in centipawns (so +20 = a 0.2 pawn bonus)

// ---- PAWN ----
// Pawns want to: advance, control the center, avoid being doubled
const PAWN_MG = [
  [  0,   0,   0,   0,   0,   0,   0,   0],  // rank 8 (never here — would promote)
  [ 98, 134,  61,  95,  68, 126,  34, -11],  // rank 7 (about to promote = very valuable)
  [ -6,   7,  26,  31,  65,  56,  25, -20],  // rank 6
  [-14,  13,   6,  21,  23,  12,  17, -23],  // rank 5
  [-27,  -2,  -5,  12,  17,   6,  10, -25],  // rank 4 (center control)
  [-26,  -4,  -4, -10,   3,   3,  33, -12],  // rank 3
  [-35,  -1, -20, -23, -15,  24,  38, -22],  // rank 2 (starting position)
  [  0,   0,   0,   0,   0,   0,   0,   0],  // rank 1 (never here)
];

const PAWN_EG = [
  [  0,   0,   0,   0,   0,   0,   0,   0],
  [178, 173, 158, 134, 147, 132, 165, 187],  // Rank 7: HUGE bonus in endgame
  [ 94, 100,  85,  67,  56,  53,  82,  84],  // (close to promotion!)
  [ 32,  24,  13,   5,  -2,   4,  17,  17],
  [ 13,   9,  -3,  -7,  -7,  -8,   3,  -1],
  [  4,   7,  -6,   1,   0,  -5,  -1,  -8],
  [ 13,   8,   8,  10,  13,   0,   2,  -7],
  [  0,   0,   0,   0,   0,   0,   0,   0],
];

// ---- KNIGHT ----
// Knights want: the center (short-range piece, needs to be close to action)
// Knights hate: edges and corners (control fewer squares)
const KNIGHT_MG = [
  [-167, -89, -34, -49,  61, -97, -15, -107],
  [ -73, -41,  72,  36,  23,  62,   7,  -17],
  [ -47,  60,  37,  65,  84, 129,  73,   44],
  [  -9,  17,  19,  53,  37,  69,  18,   22],
  [ -13,   4,  16,  13,  28,  19,  21,   -8],
  [ -23,  -9,  12,  10,  19,  17,  25,  -16],
  [ -29, -53, -12,  -3,  -1,  18, -14,  -19],
  [-105, -21, -58, -33, -17, -28, -19,  -23],
];

const KNIGHT_EG = [
  [-58, -38, -13, -28, -31, -27, -63, -99],
  [-25,  -8, -25,  -2,  -9, -25, -24, -52],
  [-24, -20,  10,   9,  -1,  -9, -19, -41],
  [-17,   3,  22,  22,  22,  11,   8, -18],
  [-18,  -6,  16,  25,  16,  17,   4, -18],
  [-23,  -3,  -1,  15,  10,  -3, -20, -22],
  [-42, -20, -10,  -5,  -2, -20, -23, -44],
  [-29, -51, -23, -15, -22, -18, -50, -64],
];

// ---- BISHOP ----
// Bishops want: long diagonals, not blocked by own pawns
// Bishops hate: edges (diagonals are short there)
const BISHOP_MG = [
  [-29,   4, -82, -37, -25, -42,   7,  -8],
  [-26,  16, -18, -13,  30,  59,  18, -47],
  [-16,  37,  43,  40,  35,  50,  37,  -2],
  [ -4,   5,  19,  50,  37,  37,   7,  -2],
  [ -6,  13,  13,  26,  34,  12,  10,   4],
  [  0,  15,  15,  15,  14,  27,  18,  10],
  [  4,  15,  16,   0,   7,  21,  33,   1],
  [-33,  -3, -14, -21, -13, -12, -39, -21],
];

const BISHOP_EG = [
  [-14, -21, -11,  -8,  -7,  -9, -17, -24],
  [ -8,  -4,   7, -12,  -3, -13,  -4, -14],
  [  2,  -8,   0,  -1,  -2,   6,   0,   4],
  [ -3,   9,  12,   9,  14,  10,   3,   2],
  [ -6,   3,  13,  19,   7,  10,  -3,  -9],
  [-12,  -3,   8,  10,  13,   3,  -7, -15],
  [-14, -18,  -7,  -1,   4,  -9, -15, -27],
  [-23,  -9, -23,  -5,  -9, -16,  -5, -17],
];

// ---- ROOK ----
// Rooks want: open files, the 7th rank (trapping the king)
// Rooks are fine on their starting squares early, then activate later
const ROOK_MG = [
  [ 32,  42,  32,  51,  63,   9,  31,  43],
  [ 27,  32,  58,  62,  80,  67,  26,  44],
  [ -5,  19,  26,  36,  17,  45,  61,  16],
  [-24, -11,   7,  26,  24,  35,  -8, -20],
  [-36, -26, -12,  -1,   9,  -7,   6, -23],
  [-45, -25, -16, -17,   3,   0,  -5, -33],
  [-44, -16, -20,  -9,  -1,  11,  -6, -71],
  [-19, -13,   1,  17,  16,   7, -37, -26],
];

const ROOK_EG = [
  [ 13,  10,  18,  15,  12,  12,   8,   5],
  [ 11,  13,  13,  11,  -3,   3,   8,   3],
  [  7,   7,   7,   5,   4,  -3,  -5,  -3],
  [  4,   3,  13,   1,   2,   1,  -1,   2],
  [  3,   5,   8,   4,  -5,  -6,  -8, -11],
  [ -4,   0,  -5,  -1,  -7, -12,  -8, -16],
  [ -6,  -6,   0,   2,  -9,  -9, -11,  -3],
  [ -9,   2,   3,  -1,  -5, -13,   4, -20],
];

// ---- QUEEN ----
// Queen wants: Not too active early (you'll lose time retreating from attacks)
// Queen in endgame: central and active
const QUEEN_MG = [
  [-28,   0,  29,  12,  59,  44,  43,  45],
  [-24, -39,  -5,   1, -16,  57,  28,  54],
  [-13, -17,   7,   8,  29,  56,  47,  57],
  [-27, -27, -16, -16,  -1,  17,  -2,   1],
  [ -9, -26,  -9, -10,  -2,  -4,   3,  -3],
  [-14,   2, -11,  -2,  -5,   2,  14,   5],
  [-35,  -8,  11,   2,   8,  15,  -3,   1],
  [ -1, -18,  -9,  10, -15, -25, -31, -50],
];

const QUEEN_EG = [
  [ -9,  22,  22,  27,  27,  19,  10,  20],
  [-17,  20,  32,  41,  58,  25,  30,   0],
  [-20,   6,   9,  49,  47,  35,  19,   9],
  [  3,  22,  24,  45,  57,  40,  57,  36],
  [-18,  28,  19,  47,  31,  34,  39,  23],
  [-16, -27,  15,   6,   9,  17,  10,   5],
  [-22, -23, -30, -16, -16, -23, -36, -32],
  [-33, -28, -22, -43,  -5, -32, -20, -41],
];

// ---- KING ----
// MIDDLEGAME: King wants to HIDE — castled position, behind pawns
// ENDGAME:    King wants to be ACTIVE — central, participating in the fight
const KING_MG = [
  [-65,  23,  16, -15, -56, -34,   2,  13],
  [ 29,  -1, -20,  -7,  -8,  -4, -38, -29],
  [ -9,  24,   2, -16, -20,   6,  22, -22],
  [-17, -20, -12, -27, -30, -25, -14, -36],
  [-49,  -1, -27, -39, -46, -44, -33, -51],
  [-14, -14, -22, -46, -44, -30, -15, -27],
  [  1,   7,  -8, -64, -43, -16,   9,   8],
  [-15,  36,  12, -54,   8, -28,  24,  14],
  //                ↑ Note: d1 is -54 — king in center is TERRIBLE in middlegame
  //                  But g1 (index 6) is +24 — castled kingside is GREAT
];

const KING_EG = [
  [-74, -35, -18, -18, -11,  15,   4, -17],
  [-12,  17,  14,  17,  17,  38,  23,  11],
  [ 10,  17,  23,  15,  20,  45,  44,  13],
  [ -8,  22,  24,  27,  26,  33,  26,   3],
  [-18,  -4,  21,  24,  27,  23,   9, -11],
  [-19,  -3,  11,  21,  23,  16,   7,  -9],
  [-27, -11,   4,  13,  14,   4,  -5, -17],
  [-53, -34, -21, -11, -28, -14, -24, -43],
  //                ↑ Note: central squares now have POSITIVE values!
  //                  King in center is GOOD in endgame (active king)
];

// ============================================
// PACK ALL PSTs INTO A LOOKUP TABLE
// ============================================
// So we can do: PST_MG['n'][row][col] instead of a big switch statement.
// Python equivalent: pst_mg = {'n': KNIGHT_MG, 'b': BISHOP_MG, ...}

const PST_MG = { p: PAWN_MG, n: KNIGHT_MG, b: BISHOP_MG, r: ROOK_MG, q: QUEEN_MG, k: KING_MG };
const PST_EG = { p: PAWN_EG, n: KNIGHT_EG, b: BISHOP_EG, r: ROOK_EG, q: QUEEN_EG, k: KING_EG };


// ============================================
// MAIN EVALUATION FUNCTION
// ============================================

/**
 * Evaluate a chess position.
 * 
 * @param {Chess} chess - A chess.js instance with the current position
 * @returns {number} Score in centipawns from WHITE's perspective.
 *                   Positive = white advantage, negative = black advantage.
 * 
 * EXAMPLE:
 *   Starting position → ~0 (equal)
 *   White up a pawn    → ~+100
 *   White up a knight  → ~+330
 *   White is checkmated → -20000
 */
export function evaluate(chess) {
  // ---- Handle terminal states first ----
  // If the game is over, return extreme values
  if (chess.isCheckmate()) {
    // The side to move is checkmated → they LOST
    // Return a huge negative value for the side that's in checkmate
    // We use 20000 minus a "depth bonus" later (shallower checkmates are preferred)
    return chess.turn() === 'w' ? -20000 : 20000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;  // Draw = no advantage for either side
  }

  // ---- Accumulate scores ----
  let mgScore = 0;  // Middlegame score
  let egScore = 0;  // Endgame score
  let phase = 0;    // Game phase (how much material is on the board)

  // Bonus trackers
  let whiteBishops = 0;
  let blackBishops = 0;

  // ---- Scan every square on the board ----
  const board = chess.board();
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;  // Empty square — skip

      const { type, color } = piece;
      
      // ---- Material Score ----
      // Add piece value for white, subtract for black
      const mgMaterial = PIECE_VALUE_MG[type];
      const egMaterial = PIECE_VALUE_EG[type];

      // ---- Positional Score (PST) ----
      // For WHITE pieces: use the table directly (row 0 = rank 8)
      // For BLACK pieces: MIRROR vertically (row 0 = rank 1, row 7 = rank 8)
      //
      // Why mirror? The PST is written from White's perspective.
      // A white pawn on rank 7 (row 1) is great — about to promote.
      // A black pawn on rank 2 (row 6) is equally great — HIS rank 7.
      // So for black, we read the table "upside-down": pstRow = 7 - row
      const pstRow = color === 'w' ? row : 7 - row;
      const mgPositional = PST_MG[type][pstRow][col];
      const egPositional = PST_EG[type][pstRow][col];

      // ---- Combine: material + positional ----
      const mgTotal = mgMaterial + mgPositional;
      const egTotal = egMaterial + egPositional;

      // Add to score: positive for white, negative for black
      if (color === 'w') {
        mgScore += mgTotal;
        egScore += egTotal;
      } else {
        mgScore -= mgTotal;
        egScore -= egTotal;
      }

      // ---- Track game phase ----
      // More material on board → higher phase → more middlegame
      phase += PHASE_WEIGHTS[type];

      // ---- Track bishop pairs ----
      if (type === 'b') {
        if (color === 'w') whiteBishops++;
        else blackBishops++;
      }
    }
  }

  // ---- Bishop Pair Bonus ----
  // Having BOTH bishops is worth an extra ~50 centipawns
  // because they cover both light and dark squares together.
  // A single bishop can only cover half the board.
  const BISHOP_PAIR_BONUS = 50;
  if (whiteBishops >= 2) {
    mgScore += BISHOP_PAIR_BONUS;
    egScore += BISHOP_PAIR_BONUS;
  }
  if (blackBishops >= 2) {
    mgScore -= BISHOP_PAIR_BONUS;
    egScore -= BISHOP_PAIR_BONUS;
  }

  // ---- Tapered Evaluation ----
  // Blend middlegame and endgame scores based on game phase.
  //
  // phase = how many "phase points" are on the board (max = 24)
  //   24 = all pieces present (pure middlegame)
  //    0 = only kings + pawns (pure endgame)
  //
  // Formula:
  //   mgWeight = phase / 24          (1.0 in middlegame, 0.0 in endgame)
  //   egWeight = 1 - mgWeight        (0.0 in middlegame, 1.0 in endgame)
  //   finalScore = mgScore * mgWeight + egScore * egWeight
  //
  // This creates a SMOOTH transition between evaluation strategies.

  // Clamp phase to valid range (in case of weird positions)
  phase = Math.min(phase, TOTAL_PHASE);

  const mgWeight = phase / TOTAL_PHASE;
  const egWeight = 1 - mgWeight;

  let finalScore = Math.round(mgScore * mgWeight + egScore * egWeight);

  // ---- Return from the perspective of the side to move ----
  // Convention: positive = good for the side to move
  // This simplifies the minimax search — it always maximizes.
  //
  // Why? In minimax, both players try to maximize their own score.
  // If we return from White's perspective, the search needs to know
  // "am I maximizing or minimizing?" But if we always return from
  // the perspective of whoever's turn it is, the search ALWAYS maximizes.
  //
  // Example:
  //   White's turn, score = +200 → return +200 (good for white = good for mover)
  //   Black's turn, score = +200 → return -200 (good for white = bad for mover)
  if (chess.turn() === 'b') {
    finalScore = -finalScore;
  }

  return finalScore;
}


// ============================================
// UTILITY: Explain a position's evaluation (for debugging)
// ============================================

/**
 * Returns a breakdown of the evaluation for debugging/display.
 * @param {Chess} chess - chess.js instance
 * @returns {object} Detailed score breakdown
 */
export function evaluateDetailed(chess) {
  let whiteMgMaterial = 0, blackMgMaterial = 0;
  let whiteMgPST = 0, blackMgPST = 0;
  let whiteEgMaterial = 0, blackEgMaterial = 0;
  let whiteEgPST = 0, blackEgPST = 0;
  let phase = 0;
  let whiteBishops = 0, blackBishops = 0;

  const board = chess.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const { type, color } = piece;
      const pstRow = color === 'w' ? row : 7 - row;

      if (color === 'w') {
        whiteMgMaterial += PIECE_VALUE_MG[type];
        whiteEgMaterial += PIECE_VALUE_EG[type];
        whiteMgPST += PST_MG[type][pstRow][col];
        whiteEgPST += PST_EG[type][pstRow][col];
      } else {
        blackMgMaterial += PIECE_VALUE_MG[type];
        blackEgMaterial += PIECE_VALUE_EG[type];
        blackMgPST += PST_MG[type][pstRow][col];
        blackEgPST += PST_EG[type][pstRow][col];
      }

      phase += PHASE_WEIGHTS[type];
      if (type === 'b') {
        if (color === 'w') whiteBishops++;
        else blackBishops++;
      }
    }
  }

  phase = Math.min(phase, TOTAL_PHASE);
  const mgWeight = phase / TOTAL_PHASE;

  return {
    phase: { raw: phase, max: TOTAL_PHASE, mgWeight: mgWeight.toFixed(2) },
    white: {
      mgMaterial: whiteMgMaterial,
      egMaterial: whiteEgMaterial,
      mgPST: whiteMgPST,
      egPST: whiteEgPST,
      bishopPair: whiteBishops >= 2,
    },
    black: {
      mgMaterial: blackMgMaterial,
      egMaterial: blackEgMaterial,
      mgPST: blackMgPST,
      egPST: blackEgPST,
      bishopPair: blackBishops >= 2,
    },
    finalScore: evaluate(chess),
    turn: chess.turn(),
  };
}
