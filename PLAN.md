# Chess AI — Full Build Plan

## Project Goal
Build a production-quality chess AI that runs in the browser, where a human plays against an AI opponent.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER                          │
│                                                     │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │   UI Layer   │     │      AI Engine            │  │
│  │              │     │   (Web Worker thread)     │  │
│  │  Chessboard  │◄───►│                           │  │
│  │  Move input  │     │  ┌─────────────────────┐  │  │
│  │  Highlights  │     │  │  Board Evaluation    │  │  │
│  │  Sounds      │     │  │  (material, position,│  │  │
│  │  Clock       │     │  │   king safety, etc.) │  │  │
│  └──────┬───────┘     │  ├─────────────────────┤  │  │
│         │             │  │  Search Algorithm    │  │  │
│  ┌──────▼───────┐     │  │  (minimax + α-β +    │  │  │
│  │  Game State  │     │  │   iterative deep.)  │  │  │
│  │  Manager     │◄───►│  ├─────────────────────┤  │  │
│  │  (chess.js)  │     │  │  Opening Book       │  │  │
│  │              │     │  │  (pre-computed)      │  │  │
│  │  - Rules     │     │  └─────────────────────┘  │  │
│  │  - Validation│     └──────────────────────────┘  │
│  │  - FEN/PGN   │                                    │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

---

## Modules

### Module 1 — Project Setup & Structure ✅
- [x] Initialize npm project (package.json)
- [x] Install dependencies (chess.js, vite)
- [x] Create folder structure (src/ui, src/game, src/ai, src/utils, public/)
- [x] Configure Vite (vite.config.js)
- [x] Create index.html entry point
- [x] Create main.js, gameManager.js, constants.js skeletons
- [x] Verify dev server runs

### Module 2 — Chessboard UI
- [ ] Render 8x8 board grid (HTML/CSS)
- [ ] Download and integrate piece SVG images
- [ ] Place pieces on the board based on game state
- [ ] Color-code squares (light/dark)
- [ ] Add coordinate labels (a-h, 1-8)
- [ ] Implement square click selection + highlight
- [ ] Show legal move indicators (dots on valid squares)
- [ ] Implement click-to-move
- [ ] Implement drag-and-drop piece movement
- [ ] Highlight last move
- [ ] Highlight king in check
- [ ] Handle pawn promotion UI (choose piece dialog)

### Module 3 — Game Loop & State Management
- [ ] Wire board UI to GameManager
- [ ] Handle player move: click/drag → validate via chess.js → update board
- [ ] Detect turn changes (player vs AI)
- [ ] Implement game-over detection (checkmate, stalemate, draw)
- [ ] Display game-over messages
- [ ] Implement "New Game" (reset board + state)
- [ ] Implement "Undo" (revert last player + AI move pair)

### Module 4 — Move History & Notation
- [ ] Record moves in algebraic notation (e4, Nf3, O-O, etc.)
- [ ] Display move list in side panel (numbered pairs: 1. e4 e5)
- [ ] Highlight current move in the list
- [ ] Auto-scroll to latest move

### Module 5 — AI: Board Evaluation Function
- [ ] Material counting (piece values in centipawns)
- [ ] Piece-Square Tables (positional bonuses per piece per square)
- [ ] Pawn structure evaluation (doubled, isolated, passed pawns)
- [ ] King safety (castling bonus, pawn shield)
- [ ] Mobility (number of legal moves available)
- [ ] Bishop pair bonus
- [ ] Game phase detection (opening → middlegame → endgame)
- [ ] Tapered evaluation (blend middlegame + endgame scores)
- [ ] Unit tests for evaluation

### Module 6 — AI: Minimax Search
- [ ] Implement basic minimax (recursive tree search)
- [ ] Understand game trees and depth
- [ ] Return best move at given depth
- [ ] Test at depth 1, 2, 3

### Module 7 — AI: Alpha-Beta Pruning
- [ ] Add alpha-beta bounds to minimax
- [ ] Understand branch elimination
- [ ] Measure node reduction vs plain minimax
- [ ] Move ordering (captures first, then checks, then quiet moves)
- [ ] MVV-LVA (Most Valuable Victim - Least Valuable Attacker)

### Module 8 — AI: Iterative Deepening & Time Management
- [ ] Implement iterative deepening (search depth 1, then 2, then 3...)
- [ ] Add time control (stop searching when time runs out)
- [ ] Return best move found so far when time expires
- [ ] Quiescence search (don't stop mid-capture sequence)
- [ ] Transposition table basics (cache evaluated positions)

### Module 9 — AI: Opening Book
- [ ] Create/import opening book data (common openings)
- [ ] Book lookup: match current position → known moves
- [ ] Weighted random selection from book moves
- [ ] Fallback to search when out of book

### Module 10 — Web Workers (Multi-threading)
- [ ] Move AI engine into a Web Worker (separate thread)
- [ ] Main thread ↔ Worker communication (postMessage / onmessage)
- [ ] Show "AI is thinking..." indicator
- [ ] Prevent UI freeze during AI computation
- [ ] Handle Worker errors gracefully

### Module 11 — UX Polish
- [ ] Sound effects (move, capture, check, castle, game-over)
- [ ] Piece movement animations (smooth transitions)
- [ ] Board flip (play as black)
- [ ] Difficulty settings (limit AI depth: Easy/Medium/Hard)
- [ ] Chess clock (countdown timer per side)
- [ ] Visual theme options
- [ ] Mobile responsive layout
- [ ] Keyboard accessibility

### Module 12 — Deployment
- [ ] Production build (npm run build → dist/)
- [ ] Optimize assets (minify JS/CSS, compress images)
- [ ] Deploy to hosting (Vercel / Netlify / GitHub Pages)
- [ ] Custom domain (optional)
- [ ] Performance audit (Lighthouse)
- [ ] SEO basics (meta tags, Open Graph)

---

## Tech Stack
| Component       | Technology    | Purpose                          |
|-----------------|---------------|----------------------------------|
| Language        | JavaScript    | Browser-native, no install       |
| Chess Rules     | chess.js      | Move validation, FEN/PGN, rules  |
| Bundler         | Vite          | Dev server, hot reload, builds   |
| UI              | Vanilla JS    | No framework overhead            |
| AI Threading    | Web Workers   | Non-blocking AI computation      |
| Deployment      | Vercel/Netlify| Free, instant, global CDN        |

## Key Files
```
Chess AI/
├── package.json           ← Dependencies & scripts
├── vite.config.js         ← Bundler configuration
├── index.html             ← HTML entry point
├── PLAN.md                ← This file
├── src/
│   ├── main.js            ← App entry point
│   ├── styles.css         ← Global styles
│   ├── ui/
│   │   ├── board.js       ← Board rendering
│   │   ├── pieces.js      ← Piece rendering
│   │   ├── sounds.js      ← Sound effects
│   │   └── clock.js       ← Chess clock
│   ├── game/
│   │   ├── gameManager.js ← Game orchestration
│   │   └── moveHistory.js ← Move notation tracking
│   ├── ai/
│   │   ├── worker.js      ← Web Worker entry
│   │   ├── evaluate.js    ← Position evaluation
│   │   ├── search.js      ← Minimax + alpha-beta
│   │   └── openingBook.js ← Opening book data
│   └── utils/
│       └── constants.js   ← Shared constants
└── public/
    ├── pieces/            ← Chess piece SVGs
    └── sounds/            ← Audio files
```
