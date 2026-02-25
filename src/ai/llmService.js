// ============================================
// src/ai/llmService.js — Frontend LLM Client
// ============================================
// PURPOSE:
//   Sends chess positions to our backend server and reads
//   streaming responses. Supports BYOK (user's own API key)
//   and multi-model selection.
//
// STREAMING EVENTS FROM SERVER:
//   {type: "reasoning", content: "..."}  ← o-series thinking (phase 1)
//   {type: "token", content: "..."}      ← JSON response building (phase 2)
//   {type: "done", move, reasoning, comment}  ← final result
//   {type: "error", message}             ← error
//   {type: "end"}                        ← stream complete
//
// Python analogy:
//   async with httpx.stream("POST", url, json=data) as r:
//       async for line in r.aiter_lines():
//           process(line)
// ============================================

// Dynamic base URL:
// Dev: Vite on :3000, server on :3001 → need full URL
// Prod (Vercel): same origin → empty string (relative URLs)
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

/**
 * Request a chess move from the LLM via our backend server.
 * Streams reasoning and tokens, returns the final move + comment.
 *
 * @param {Object} params
 * @param {string} params.fen - Board position (FEN)
 * @param {string} params.moveHistory - PGN move history
 * @param {string[]} params.legalMoves - Legal moves in SAN
 * @param {string} params.playerColor - 'w' or 'b'
 * @param {string} [params.difficulty] - beginner/intermediate/advanced
 * @param {string} [params.model] - Model ID (gpt-4o, o3, etc.)
 * @param {string} [params.personality] - AI personality style
 * @param {string} [params.apiKey] - User's BYOK API key (optional)
 * @param {Object} callbacks
 * @param {function} callbacks.onToken - Called with each JSON content chunk
 * @param {function} [callbacks.onReasoning] - Called with each reasoning chunk (o-series)
 * @returns {Promise<{move: string, reasoning: string, comment: string}>}
 */
export async function requestChessMove(params, callbacks = {}) {
  const { fen, moveHistory, legalMoves, playerColor, difficulty, model, personality, apiKey } = params;
  const { onToken, onReasoning } = callbacks;

  // ---- Build request headers ----
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // ---- Send request ----
  const response = await fetch(`${API_BASE}/api/chess-move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fen, moveHistory, legalMoves, playerColor, difficulty, model, personality }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error.error || `Server responded with ${response.status}`);
  }

  // ---- Read the SSE stream ----
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullReasoning = '';
  let finalMove = null;
  let finalReasoning = '';
  let finalComment = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages (separated by \n\n)
    const messages = buffer.split('\n\n');
    buffer = messages.pop(); // Keep incomplete part

    for (const message of messages) {
      if (!message.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(message.slice(6));

        switch (data.type) {
          case 'reasoning':
            // Reasoning model thinking tokens (o-series Phase 1)
            fullReasoning += data.content;
            if (onReasoning) onReasoning(data.content);
            break;

          case 'token':
            // JSON content tokens (Phase 2, or only phase for standard models)
            if (onToken) onToken(data.content);
            break;

          case 'done':
            // Final parsed result
            finalMove = data.move;
            finalReasoning = data.reasoning || fullReasoning || '';
            finalComment = data.comment || '';
            break;

          case 'error':
            throw new Error(data.message || 'Server error during streaming');

          case 'end':
            break;
        }
      } catch (e) {
        if (e.message.includes('Server error') || e.message.includes('Invalid API')
            || e.message.includes('Rate limit') || e.message.includes('Model not found')) {
          throw e;
        }
        console.warn('SSE parse warning:', e.message);
      }
    }
  }

  if (!finalMove) {
    throw new Error('No valid move received from AI');
  }

  return { move: finalMove, reasoning: finalReasoning, comment: finalComment };
}

/**
 * Request the AI's decision on a takeback (undo) request.
 * @param {Object} params
 * @param {string} params.fen - Current position
 * @param {string} params.moveHistory - PGN
 * @param {string} params.personality - AI personality
 * @param {string} params.lastMove - The move being taken back
 * @param {string} [params.apiKey] - BYOK key
 * @returns {Promise<{accept: boolean, comment: string}>}
 */
export async function requestTakeback({ fen, moveHistory, personality, lastMove, apiKey }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(`${API_BASE}/api/takeback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fen, moveHistory, personality, lastMove }),
    });

    if (!response.ok) {
      return { accept: true, comment: 'Sure, take it back.' };
    }

    return await response.json();
  } catch (e) {
    // Network error — just accept
    return { accept: true, comment: 'Fine.' };
  }
}

/**
 * Check if the backend server is running.
 * @param {string} [apiKey] - Optional BYOK key to check tier
 * @returns {Promise<Object>} Health data including tier, available models
 */
export async function checkHealth(apiKey) {
  const headers = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(`${API_BASE}/api/health`, { headers });
    return await response.json();
  } catch (e) {
    throw new Error('Chess AI server is not running. Start it with: node server/index.js');
  }
}
