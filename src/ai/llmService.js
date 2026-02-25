// ============================================
// src/ai/llmService.js — Frontend LLM Client
// ============================================
// PURPOSE:
//   This module sends the chess position to our backend server
//   and reads the streaming response. It does NOT talk to OpenAI
//   directly — the API key stays safe on the server.
//
// STREAMING:
//   We use the Fetch API with ReadableStream to read SSE
//   (Server-Sent Events) as they arrive. Each chunk contains
//   a piece of the AI's reasoning text, which we pass to a
//   callback so the UI can display it in real-time.
//
// Python analogy:
//   import httpx
//   async with httpx.stream("POST", url, json=data) as response:
//       async for line in response.aiter_lines():
//           process(line)
// ============================================

const API_BASE = 'http://localhost:3001';

/**
 * Request a chess move from the LLM via our backend server.
 * Streams the reasoning text and returns the final move.
 * 
 * @param {Object} params
 * @param {string} params.fen - Current board position in FEN notation
 * @param {string} params.moveHistory - PGN move history string
 * @param {string[]} params.legalMoves - Array of legal moves in SAN notation
 * @param {string} params.playerColor - 'w' or 'b'
 * @param {string} [params.difficulty] - 'beginner', 'intermediate', or 'advanced'
 * @param {function} onToken - Called with each text chunk as it streams in
 * @returns {Promise<{move: string, reasoning: string}>}
 */
export async function requestChessMove({ fen, moveHistory, legalMoves, playerColor, difficulty }, onToken) {
  // ---- Send the request ----
  // We POST the position data to our backend server.
  // The server will call OpenAI and stream the response back.
  const response = await fetch(`${API_BASE}/api/chess-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, moveHistory, legalMoves, playerColor, difficulty }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error.error || `Server responded with ${response.status}`);
  }

  // ---- Read the SSE stream ----
  // The response body is a ReadableStream. We read it chunk by chunk.
  // Each SSE message looks like: "data: {"type":"token","content":"some text"}\n\n"
  //
  // Python analogy: This is like iterating over response.iter_lines()
  // but in the browser using the Streams API.

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';        // Accumulates partial lines
  let fullReasoning = ''; // Complete reasoning text
  let finalMove = null;
  let finalReasoning = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode the binary chunk to text
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages (terminated by \n\n)
    const messages = buffer.split('\n\n');
    buffer = messages.pop(); // Keep the incomplete part

    for (const message of messages) {
      if (!message.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(message.slice(6)); // Remove "data: " prefix

        switch (data.type) {
          case 'token':
            // A piece of the AI's streaming text
            fullReasoning += data.content;
            if (onToken) onToken(data.content);
            break;

          case 'done':
            // The final parsed result with move and reasoning
            finalMove = data.move;
            finalReasoning = data.reasoning || fullReasoning;
            break;

          case 'error':
            throw new Error(data.message || 'Server error during streaming');

          case 'end':
            // Stream complete
            break;
        }
      } catch (e) {
        if (e.message.includes('Server error')) throw e;
        // Ignore parse errors for partial messages
        console.warn('SSE parse warning:', e.message);
      }
    }
  }

  if (!finalMove) {
    throw new Error('No valid move received from AI');
  }

  return { move: finalMove, reasoning: finalReasoning };
}

/**
 * Check if the backend server is running and healthy.
 * @returns {Promise<{status: string, model: string}>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return await response.json();
  } catch (e) {
    throw new Error('Chess AI server is not running. Start it with: node server/index.js');
  }
}
