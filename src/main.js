// ============================================
// main.js — Application Entry Point
// ============================================
// This is the FIRST JavaScript file that runs.
// Its job: initialize all modules and wire them together.
//
// Think of it as the "conductor" of an orchestra — it doesn't
// play any instrument, it just makes sure everyone starts 
// at the right time and communicates properly.
// ============================================

import { GameManager } from './game/gameManager.js';

// Wait for the page to fully load before initializing
document.addEventListener('DOMContentLoaded', () => {
  console.log('♟ Chess AI — Initializing...');

  // Create the game manager — it orchestrates everything
  const game = new GameManager();
  game.init();

  console.log('♟ Chess AI — Ready!');
});
