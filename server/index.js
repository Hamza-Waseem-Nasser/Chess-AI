// ============================================
// server/index.js — Backend Proxy Server
// ============================================
// PURPOSE:
//   This server sits between the browser and OpenAI.
//   It keeps the API key secret (in .env) and streams
//   the LLM's response back to the browser in real-time.
//
// ARCHITECTURE:
//   Browser ──POST /api/chess-move──▶ This Server ──▶ OpenAI API
//   Browser ◀──SSE (streaming text)── This Server ◀── OpenAI API
//
// Python analogy:
//   This is like a FastAPI app with one endpoint:
//
//   @app.post("/api/chess-move")
//   async def chess_move(request):
//       response = openai.chat.completions.create(stream=True, ...)
//       for chunk in response:
//           yield chunk
//
// HOW TO RUN:
//   node server/index.js
//   (runs on http://localhost:3001)
// ============================================

import 'dotenv/config';          // Loads .env file → process.env.OPENAI_API_KEY
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// ---- Validate environment ----
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-api-key-here') {
  console.error('\n❌ ERROR: Set your OpenAI API key in .env file!');
  console.error('   Open .env and replace "sk-your-api-key-here" with your real key.');
  console.error('   Get a key at: https://platform.openai.com/api-keys\n');
  process.exit(1);
}

// ---- Initialize OpenAI client ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ---- Initialize Express server ----
const app = express();
const PORT = 3001;

// CORS: Allow the Vite dev server (port 3000) to call this server (port 3001)
// Without this, the browser blocks cross-origin requests.
// Python equivalent: FastAPI CORSMiddleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['POST'],
}));

// Parse JSON request bodies
app.use(express.json());

// ============================================
// CHESS MOVE ENDPOINT (streaming)
// ============================================

app.post('/api/chess-move', async (req, res) => {
  try {
    const { fen, moveHistory, legalMoves, playerColor, difficulty } = req.body;

    // Validate input
    if (!fen || !legalMoves || legalMoves.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: fen, legalMoves' });
    }

    const aiColor = playerColor === 'w' ? 'Black' : 'White';

    // ---- Difficulty levels ----
    // We change the ELO in the prompt and the temperature.
    // Lower ELO + higher temperature = weaker (more random) play.
    // Higher ELO + lower temperature = stronger (more precise) play.
    const difficultySettings = {
      beginner:     { elo: 800,  temp: 1.0, desc: 'a casual beginner (around 800 ELO). Make simple, obvious moves. Occasionally make mistakes. Do NOT play optimal moves.' },
      intermediate: { elo: 1500, temp: 0.7, desc: 'an intermediate club player (around 1500 ELO). Play solid moves but not always the best.' },
      advanced:     { elo: 2200, temp: 0.4, desc: 'a strong chess player (around 2200 ELO). Think deeply about tactics and strategy. Play strong moves.' },
    };
    const diff = difficultySettings[difficulty] || difficultySettings.intermediate;

    // ---- Build the prompt ----
    // This is the most important part — how we talk to the LLM.
    // We give it:
    //   1. A role (chess player)
    //   2. The position (FEN)
    //   3. The move history (so it understands context)
    //   4. The EXACT list of legal moves (so it can't hallucinate illegal ones)
    //   5. A strict output format (JSON)

    const systemPrompt = `You are ${diff.desc} You are playing as ${aiColor}.

RULES:
- You MUST choose a move from the legal moves list provided.
- Do NOT invent moves — only pick from the list.
- Respond with valid JSON and nothing else.
- Think deeply about the position before choosing.

RESPONSE FORMAT (strict JSON, no markdown, no code fences):
{"move": "<your chosen move in SAN notation>", "reasoning": "<your analysis of the position and why you chose this move, 2-4 sentences>"}`;

    const moveHistoryStr = moveHistory && moveHistory.length > 0 
      ? `Move history: ${moveHistory}` 
      : 'This is the starting position.';

    const userPrompt = `Current position (FEN): ${fen}
${moveHistoryStr}

Legal moves: [${legalMoves.join(', ')}]

Choose your move and explain your reasoning. Reply with JSON only.`;

    // ---- Set up SSE (Server-Sent Events) streaming ----
    // SSE is a protocol where the server keeps the connection open
    // and sends text chunks as they arrive. The browser receives them
    // as events via EventSource or fetch + ReadableStream.
    //
    // Python analogy: StreamingResponse in FastAPI
    //   return StreamingResponse(generate(), media_type="text/event-stream")

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ---- Call OpenAI with streaming ----
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,            // Enable streaming — get tokens one by one
      temperature: diff.temp,  // Adjusted by difficulty (higher = more random)
      max_tokens: 500,         // Limit response length
    });

    // ---- Stream tokens to the browser ----
    // Each chunk from OpenAI contains a small piece of text (a "token").
    // We forward each piece to the browser immediately.
    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;

        // Send this chunk to the browser as an SSE event
        // Format: "data: <text>\n\n"
        res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
      }
    }

    // ---- Parse the complete response ----
    // The LLM should have returned JSON like: {"move": "Nf3", "reasoning": "..."}
    // But LLMs are messy — they sometimes wrap it in code fences or add extra text.
    // We need to extract the JSON robustly.
    let parsed = null;
    try {
      parsed = extractJSON(fullResponse);
    } catch (e) {
      console.error('Failed to parse LLM response:', fullResponse);
    }

    // ---- Validate the move ----
    if (parsed && parsed.move && legalMoves.includes(parsed.move)) {
      // Valid move! Send the final result
      res.write(`data: ${JSON.stringify({ type: 'done', move: parsed.move, reasoning: parsed.reasoning || '' })}\n\n`);
    } else {
      // Invalid move — retry with a correction prompt
      console.warn('LLM returned invalid move, retrying...', parsed);
      const retryResult = await retryMove(openai, MODEL, fen, legalMoves, aiColor, moveHistoryStr, fullResponse);
      res.write(`data: ${JSON.stringify({ type: 'done', ...retryResult })}\n\n`);
    }

    // Close the SSE stream
    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in /api/chess-move:', error.message);

    // If headers already sent (streaming started), send error as SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ============================================
// RETRY LOGIC — When LLM returns an illegal move
// ============================================

async function retryMove(client, model, fen, legalMoves, aiColor, moveHistory, previousResponse) {
  console.log('Retrying with correction prompt...');

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are playing chess as ${aiColor}. Your previous response was invalid. You MUST choose from the legal moves list. Respond with ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Position (FEN): ${fen}
${moveHistory}

Your previous response was: ${previousResponse}
This was INVALID. 

LEGAL MOVES (you MUST pick one of these exactly): [${legalMoves.join(', ')}]

Reply with JSON ONLY: {"move": "<legal move from list>", "reasoning": "<brief explanation>"}`,
        },
      ],
      temperature: 0.3,   // Lower temperature for retry (more deterministic)
      max_tokens: 300,
    });

    const retryText = response.choices[0]?.message?.content || '';
    const parsed = extractJSON(retryText);

    if (parsed && parsed.move && legalMoves.includes(parsed.move)) {
      return { move: parsed.move, reasoning: parsed.reasoning || 'I reconsidered my choice.' };
    }
  } catch (e) {
    console.error('Retry also failed:', e.message);
  }

  // Final fallback: pick a random legal move
  console.warn('All retries failed — falling back to random move');
  const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return {
    move: fallbackMove,
    reasoning: '(AI had trouble deciding — played a random move)',
  };
}

// ============================================
// JSON EXTRACTION — Robustly parse LLM output
// ============================================

/**
 * Extract JSON from LLM response text.
 * LLMs often wrap JSON in code fences, add preamble text, etc.
 * This function handles all those cases.
 * 
 * Examples it handles:
 *   '{"move": "Nf3", "reasoning": "..."}'           ← clean JSON
 *   '```json\n{"move": "Nf3", ...}\n```'             ← code fences
 *   'Sure! Here is my move:\n{"move": "Nf3", ...}'   ← preamble
 */
function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    // Fall through
  }

  // Try to find JSON within code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {
      // Fall through
    }
  }

  // Try to find a JSON object anywhere in the text: { ... }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Fall through
    }
  }

  throw new Error('Could not extract JSON from response');
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n♟  Chess AI Server running on http://localhost:${PORT}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/chess-move  — Get AI move (streaming)`);
  console.log(`     GET  /api/health      — Server status\n`);
});
