// ============================================
// src/ui/sounds.js — Chess Sound Effects
// ============================================
// PURPOSE:
//   Play sound effects for chess moves — move, capture, check,
//   castle, game over. Makes the game feel ALIVE.
//
// HOW IT WORKS:
//   We use the Web Audio API to generate sounds in code.
//   No audio files needed — the browser creates the sounds
//   mathematically (like a tiny synthesizer).
//
// Python analogy:
//   import numpy as np, sounddevice as sd
//   tone = np.sin(2 * np.pi * 440 * t)  # Generate a 440Hz tone
//   sd.play(tone)                        # Play it
//
//   The Web Audio API does the same thing but in the browser.
//   Instead of numpy arrays, we use "oscillator nodes" and "gain nodes."
//
// WHY NOT AUDIO FILES?
//   Audio files (MP3/WAV) are simpler but:
//   - Need to be downloaded (slower first load)
//   - Need to be hosted somewhere
//   - Can have licensing issues
//   Generated sounds are instant, tiny, and free.
// ============================================

// The AudioContext is like a "sound card" in the browser.
// We create ONE and reuse it for all sounds.
let audioCtx = null;

/**
 * Get or create the AudioContext.
 * Browsers require a user interaction (click) before playing audio.
 * So we create it lazily on the first sound request.
 */
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browsers pause audio until user interacts)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ============================================
// SOUND GENERATORS
// ============================================
// Each function creates a short sound by:
// 1. Creating an oscillator (tone generator)
// 2. Creating a gain node (volume control)
// 3. Connecting them: oscillator → gain → speakers
// 4. Starting and stopping the oscillator after a short time
//
// Think of it like:
//   oscillator = the instrument (produces a tone)
//   gain = the volume knob
//   destination = your speakers

/**
 * Regular piece move — short, clean "tap" sound.
 * Like placing a piece on a wooden board.
 */
export function playMoveSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Create a short noise burst (like a tap)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';           // Smooth tone
  osc.frequency.value = 400;   // 400 Hz (a medium pitch)

  // Volume envelope: quick attack, quick decay
  // Like tapping a table — loud for a split second, then silence
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.08);  // Stop after 80ms
}

/**
 * Capture — heavier "thud" sound.
 * Lower pitch, longer duration than a regular move.
 */
export function playCaptureSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Lower frequency = heavier sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';       // Slightly richer tone
  osc.frequency.value = 200;   // 200 Hz (lower = heavier)

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);

  // Add a second layer — a short noise burst for "impact"
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2.type = 'square';        // Harsher tone
  osc2.frequency.value = 150;

  gain2.gain.setValueAtTime(0.15, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(now);
  osc2.stop(now + 0.06);
}

/**
 * Check — sharp alert sound.
 * High pitch, attention-grabbing. Two quick tones.
 */
export function playCheckSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // First tone — high
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.value = 800;

  gain1.gain.setValueAtTime(0.25, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.1);

  // Second tone — slightly higher (creates a "warning" feel)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2.type = 'sine';
  osc2.frequency.value = 1000;

  gain2.gain.setValueAtTime(0.25, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(now + 0.12);
  osc2.stop(now + 0.22);
}

/**
 * Castle — double tap sound (two moves in one).
 * Two quick move sounds in succession.
 */
export function playCastleSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // First tap (king moves)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 400;
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.07);

  // Second tap (rook moves)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 500;
  gain2.gain.setValueAtTime(0.3, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.17);
}

/**
 * Game over — dramatic descending tone.
 * Signals the end of the game.
 */
export function playGameOverSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.linearRampToValueAtTime(200, now + 0.5); // Pitch drops

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);
}

/**
 * Illegal move / error — short buzz.
 */
export function playErrorSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';         // Harsh tone
  osc.frequency.value = 100;   // Low buzz

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

// ============================================
// SMART SOUND PICKER
// ============================================

/**
 * Play the right sound based on a chess.js move result.
 * 
 * @param {object} moveResult - The object returned by chess.move()
 *   Has properties like: .san, .captured, .flags
 *   Flags: 'k' = kingside castle, 'q' = queenside castle
 * @param {boolean} isGameOver - Is the game over after this move?
 * @param {boolean} isCheck - Is the opponent in check after this move?
 */
export function playSoundForMove(moveResult, isGameOver = false, isCheck = false) {
  if (isGameOver) {
    playGameOverSound();
  } else if (isCheck) {
    playCheckSound();
  } else if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
    // Castling (kingside or queenside)
    playCastleSound();
  } else if (moveResult.captured) {
    playCaptureSound();
  } else {
    playMoveSound();
  }
}
