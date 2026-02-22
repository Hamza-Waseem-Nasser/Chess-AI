// ============================================
// pieces.js — Chess Piece SVG Definitions
// ============================================
// Contains inline SVG data for all 12 chess pieces.
// Why inline SVGs instead of image files?
//   1. Zero network requests — no loading delay
//   2. Infinitely scalable — crisp at any size
//   3. Styleable via CSS — can change colors dynamically
//   4. Single file — no broken image links
//
// Naming convention: 'wK' = white King, 'bQ' = black Queen, etc.
// This matches chess.js: piece.color ('w'/'b') + piece.type ('k','q','r','b','n','p')
// ============================================

/**
 * Returns an SVG string for a given piece.
 * @param {string} color - 'w' or 'b'
 * @param {string} type - 'k', 'q', 'r', 'b', 'n', or 'p'
 * @returns {string} SVG markup string
 */
export function getPieceSVG(color, type) {
  // chess.js returns lowercase types ('k','q','r','b','n','p')
  // Our keys use uppercase ('wK','bQ') — so we uppercase the type
  const key = color + type.toUpperCase();
  return PIECE_SVGS[key] || '';
}

// Fill colors for pieces
const WHITE_FILL = '#fff';
const WHITE_STROKE = '#000';
const BLACK_FILL = '#333';
const BLACK_STROKE = '#000';

// Helper to wrap SVG path in consistent viewBox
function makeSVG(paths, color) {
  const fill = color === 'w' ? WHITE_FILL : BLACK_FILL;
  const stroke = color === 'w' ? WHITE_STROKE : BLACK_STROKE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%">
    <g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      ${paths}
    </g>
  </svg>`;
}

// ============================================
// SVG path data for each piece type
// Based on standard chess piece designs (public domain)
// ============================================

const PIECE_SVGS = {
  // ---- WHITE PIECES ----
  wK: makeSVG(`
    <path d="M 22.5,11.63 L 22.5,6" style="fill:none; stroke:#000; stroke-linejoin:miter"/>
    <path d="M 20,8 L 25,8" style="fill:none; stroke:#000; stroke-linejoin:miter"/>
    <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#fff; stroke:#000; stroke-linecap:butt; stroke-linejoin:miter"/>
    <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" style="fill:#fff; stroke:#000"/>
    <path d="M 12.5,30 C 18,27 27,27 32.5,30" style="fill:none; stroke:#000"/>
    <path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" style="fill:none; stroke:#000"/>
    <path d="M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none; stroke:#000"/>
  `, 'w'),

  wQ: makeSVG(`
    <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" style="fill:#fff; stroke:#000; stroke-linecap:butt"/>
    <path d="M 9,26 C 9,28 10.5,28.5 12.5,30 C 14.5,31.5 16.5,31 16.5,31 C 18.5,30 19.5,30 22.5,30 C 25.5,30 26.5,30 28.5,31 C 28.5,31 30.5,31.5 32.5,30 C 34.5,28.5 36,28 36,26" style="stroke-linecap:butt"/>
    <path d="M 9,26 C 9,29 12.5,31.5 12.5,31.5 L 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,31.5 C 32.5,31.5 36,29 36,26" style="stroke-linecap:butt"/>
    <path d="M 12.5,31.5 C 18,29 27,29 32.5,31.5" style="fill:none; stroke:#000"/>
    <path d="M 12.5,34 C 18,31.5 27,31.5 32.5,34" style="fill:none; stroke:#000"/>
    <path d="M 12.5,37 C 18,34.5 27,34.5 32.5,37" style="fill:none; stroke:#000"/>
    <circle cx="6" cy="12" r="2.5"/>
    <circle cx="14" cy="9" r="2.5"/>
    <circle cx="22.5" cy="8" r="2.5"/>
    <circle cx="31" cy="9" r="2.5"/>
    <circle cx="39" cy="12" r="2.5"/>
  `, 'w'),

  wR: makeSVG(`
    <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" style="stroke-linecap:butt"/>
    <path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z" style="stroke-linecap:butt"/>
    <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" style="stroke-linecap:butt"/>
    <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" style="stroke-linecap:butt; stroke-linejoin:miter"/>
    <path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" style="stroke-linecap:butt"/>
    <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z" style="stroke-linecap:butt"/>
    <path d="M 12,35.5 L 33,35.5 L 33,35.5" style="fill:none; stroke:#000"/>
    <path d="M 13,31.5 L 32,31.5" style="fill:none; stroke:#000"/>
    <path d="M 14,29.5 L 31,29.5" style="fill:none; stroke:#000"/>
    <path d="M 14,16.5 L 31,16.5" style="fill:none; stroke:#000"/>
    <path d="M 11,14 L 34,14" style="fill:none; stroke:#000"/>
  `, 'w'),

  wB: makeSVG(`
    <g style="fill:#fff; stroke:#000; stroke-linecap:butt">
      <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/>
      <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/>
      <path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/>
    </g>
    <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none; stroke:#000; stroke-linejoin:miter"/>
  `, 'w'),

  wN: makeSVG(`
    <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#fff; stroke:#000"/>
    <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#fff; stroke:#000"/>
    <path d="M 9.5,25.5 A 0.5,1.5 0 1 1 8.5,25.5 A 0.5,1.5 0 1 1 9.5,25.5 z" style="fill:#000; stroke:#000"/>
    <path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#000; stroke:#000"/>
  `, 'w'),

  wP: makeSVG(`
    <path d="M 22.5,9 C 19.79,9 17.609,11.18 17.609,13.89 C 17.609,15.05 18.05,16.1 18.77,16.88 C 16.69,18.15 15.279,20.39 15.279,22.95 C 15.279,24.83 16.05,26.52 17.29,27.71 C 14.8,29.2 13.109,31.9 13.109,35 L 31.891,35 C 31.891,31.9 30.2,29.2 27.71,27.71 C 28.95,26.52 29.721,24.83 29.721,22.95 C 29.721,20.39 28.31,18.15 26.23,16.88 C 26.95,16.1 27.391,15.05 27.391,13.89 C 27.391,11.18 25.21,9 22.5,9 z" style="fill:#fff; stroke:#000; stroke-linecap:round"/>
  `, 'w'),

  // ---- BLACK PIECES ----
  bK: makeSVG(`
    <path d="M 22.5,11.63 L 22.5,6" style="fill:none; stroke:#000; stroke-linejoin:miter"/>
    <path d="M 20,8 L 25,8" style="fill:none; stroke:#000; stroke-linejoin:miter"/>
    <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#333; stroke:#000; stroke-linecap:butt; stroke-linejoin:miter"/>
    <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" style="fill:#333; stroke:#000"/>
    <path d="M 12.5,30 C 18,27 27,27 32.5,30" style="fill:none; stroke:#fff"/>
    <path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" style="fill:none; stroke:#fff"/>
    <path d="M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none; stroke:#fff"/>
  `, 'b'),

  bQ: makeSVG(`
    <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" style="fill:#333; stroke:#000; stroke-linecap:butt"/>
    <path d="M 9,26 C 9,28 10.5,28.5 12.5,30 C 14.5,31.5 16.5,31 16.5,31 C 18.5,30 19.5,30 22.5,30 C 25.5,30 26.5,30 28.5,31 C 28.5,31 30.5,31.5 32.5,30 C 34.5,28.5 36,28 36,26" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 9,26 C 9,29 12.5,31.5 12.5,31.5 L 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,31.5 C 32.5,31.5 36,29 36,26" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 12.5,31.5 C 18,29 27,29 32.5,31.5" style="fill:none; stroke:#fff"/>
    <path d="M 12.5,34 C 18,31.5 27,31.5 32.5,34" style="fill:none; stroke:#fff"/>
    <path d="M 12.5,37 C 18,34.5 27,34.5 32.5,37" style="fill:none; stroke:#fff"/>
    <circle cx="6" cy="12" r="2.5" style="fill:#333; stroke:#000"/>
    <circle cx="14" cy="9" r="2.5" style="fill:#333; stroke:#000"/>
    <circle cx="22.5" cy="8" r="2.5" style="fill:#333; stroke:#000"/>
    <circle cx="31" cy="9" r="2.5" style="fill:#333; stroke:#000"/>
    <circle cx="39" cy="12" r="2.5" style="fill:#333; stroke:#000"/>
  `, 'b'),

  bR: makeSVG(`
    <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" style="stroke-linecap:butt; stroke-linejoin:miter; fill:#333"/>
    <path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z" style="stroke-linecap:butt; fill:#333"/>
    <path d="M 12,35.5 L 33,35.5" style="fill:none; stroke:#fff"/>
    <path d="M 13,31.5 L 32,31.5" style="fill:none; stroke:#fff"/>
    <path d="M 14,29.5 L 31,29.5" style="fill:none; stroke:#fff"/>
    <path d="M 14,16.5 L 31,16.5" style="fill:none; stroke:#fff"/>
    <path d="M 11,14 L 34,14" style="fill:none; stroke:#fff"/>
  `, 'b'),

  bB: makeSVG(`
    <g style="fill:#333; stroke:#000; stroke-linecap:butt">
      <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/>
      <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/>
      <path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/>
    </g>
    <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none; stroke:#fff; stroke-linejoin:miter"/>
  `, 'b'),

  bN: makeSVG(`
    <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#333; stroke:#000"/>
    <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#333; stroke:#000"/>
    <path d="M 9.5,25.5 A 0.5,1.5 0 1 1 8.5,25.5 A 0.5,1.5 0 1 1 9.5,25.5 z" style="fill:#fff; stroke:#fff"/>
    <path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#fff; stroke:#fff"/>
  `, 'b'),

  bP: makeSVG(`
    <path d="M 22.5,9 C 19.79,9 17.609,11.18 17.609,13.89 C 17.609,15.05 18.05,16.1 18.77,16.88 C 16.69,18.15 15.279,20.39 15.279,22.95 C 15.279,24.83 16.05,26.52 17.29,27.71 C 14.8,29.2 13.109,31.9 13.109,35 L 31.891,35 C 31.891,31.9 30.2,29.2 27.71,27.71 C 28.95,26.52 29.721,24.83 29.721,22.95 C 29.721,20.39 28.31,18.15 26.23,16.88 C 26.95,16.1 27.391,15.05 27.391,13.89 C 27.391,11.18 25.21,9 22.5,9 z" style="fill:#333; stroke:#000; stroke-linecap:round"/>
  `, 'b'),
};
