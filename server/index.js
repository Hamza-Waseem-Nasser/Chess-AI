// ============================================
// server/index.js — Backend Proxy Server
// ============================================
// PURPOSE:
//   This server sits between the browser and OpenAI.
//   It supports TWO modes:
//
//   FREE TIER:  Server uses its own API key (from .env), all models
//               available, rate-limited to 30 moves/hour per IP.
//
//   BYOK TIER:  User sends their own API key in the X-API-Key header.
//               Any model, unlimited usage. The key is used per-request
//               and never stored on the server.
//
// ARCHITECTURE:
//   Browser ──POST /api/chess-move──▶ This Server ──▶ OpenAI API
//   Browser ◀──SSE (streaming text)── This Server ◀── OpenAI API
//
// MULTI-MODEL SUPPORT:
//   Standard models (GPT-4o, GPT-4o-mini):
//     - Chat Completions API
//     - role: "system", temperature, max_tokens
//     - Streams delta.content only
//
//   Reasoning models (o3, o1):
//     - Responses API (SDK v6+ — Chat Completions no longer streams reasoning)
//     - instructions + input (instead of messages)
//     - reasoning: { effort, summary } parameter
//     - Streams response.reasoning_summary_text.delta THEN response.output_text.delta
//
// HOW TO RUN:
//   node server/index.js
//   (runs on http://localhost:3001)
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// ============================================
// MODEL CONFIGURATION
// ============================================

const MODELS = {
  'gpt-4o':      { reasoning: false, label: 'GPT-4o' },
  'gpt-4o-mini': { reasoning: false, label: 'GPT-4o Mini' },
  'o3':          { reasoning: true,  label: 'o3' },
  'o1':          { reasoning: true,  label: 'o1' },
};

const FREE_TIER_MODEL = 'gpt-4o-mini'; // Default for free tier, but all models allowed

function isReasoningModel(model) {
  return MODELS[model]?.reasoning === true;
}

// ============================================
// AI PERSONALITY DEFINITIONS
// ============================================

const PERSONALITIES = {
  aggressive: 'You are cocky and love trash-talking. Tease the opponent. Speak with confidence and bravado. Example comments: "That all you got?", "Watch and learn, rookie."',
  chill:      'You are friendly and encouraging. Compliment good moves, keep it casual. Warm tone. Example: "Nice move!", "This is a fun game!"',
  dramatic:   'You are theatrical and over-the-top dramatic. Everything is a HUGE moment. Speak like a wrestling announcer or Shakespeare villain. Example: "THE KNIGHT DESCENDS UPON YOUR KINGDOM!"',
  grandmaster:'You are calm, analytical, slightly cold. Speak like a chess commentator. Dry humor, clinical. Example: "An interesting choice. Dubious, but interesting."',
  troll:      'You are chaotic and funny. Use internet humor, memes, never serious. Playful chaos. Example: "lol nice try", "bruh moment incoming"',
};

// ============================================
// RATE LIMITING (Free Tier)
// ============================================

const rateLimits = new Map();   // IP → { count, resetAt }
const FREE_LIMIT = 30;         // Max moves per hour for free tier

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3600000 }; // Reset every hour
  }

  if (entry.count >= FREE_LIMIT) {
    return { allowed: false, remaining: 0, resetsIn: Math.ceil((entry.resetAt - now) / 60000) };
  }

  entry.count++;
  rateLimits.set(ip, entry);
  return { allowed: true, remaining: FREE_LIMIT - entry.count };
}

// Clean up old rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 600000);

// ============================================
// SERVER SETUP
// ============================================

// ---- Validate free-tier API key ----
const HAS_SERVER_KEY = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-api-key-here';

let serverClient = null;
if (HAS_SERVER_KEY) {
  serverClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: Allow Vite dev server + custom headers
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json());

// ---- Helper: Get OpenAI client (BYOK or server key) ----
function getClient(req) {
  const userKey = req.headers['x-api-key'];
  if (userKey && userKey.startsWith('sk-')) {
    return { client: new OpenAI({ apiKey: userKey }), isBYOK: true };
  }
  if (serverClient) {
    return { client: serverClient, isBYOK: false };
  }
  return { client: null, isBYOK: false };
}

// ============================================
// CHESS MOVE ENDPOINT (streaming, multi-model)
// ============================================

app.post('/api/chess-move', async (req, res) => {
  try {
    const { fen, moveHistory, legalMoves, playerColor, difficulty, model: requestedModel, personality } = req.body;

    // Validate input
    if (!fen || !legalMoves || legalMoves.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: fen, legalMoves' });
    }

    // ---- Get the right OpenAI client ----
    const { client, isBYOK } = getClient(req);
    if (!client) {
      return res.status(503).json({
        error: 'No API key available. Enter your own key in Settings, or ask the site owner to configure a server key.',
      });
    }

    // ---- Determine model ----
    // Free tier: forced to gpt-4o-mini
    // BYOK: use requested model (validated against known list)
    // Determine model — free tier can use any model, just rate limited
    let model = requestedModel && MODELS[requestedModel] ? requestedModel : 'gpt-4o-mini';

    if (!isBYOK) {
      // Rate limit check for free tier
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const limit = checkRateLimit(ip);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Free tier rate limit reached (${FREE_LIMIT} moves/hour). Enter your own API key for unlimited play. Resets in ~${limit.resetsIn} minutes.`,
        });
      }
    }

    const isReasoning = isReasoningModel(model);
    const aiColor = playerColor === 'w' ? 'Black' : 'White';

    // ---- Difficulty settings ----
    const difficultySettings = {
      beginner:     { elo: 800,  temp: 1.0, desc: 'a casual beginner (around 800 ELO). Make simple, obvious moves. Occasionally make mistakes. Do NOT play optimal moves.' },
      intermediate: { elo: 1500, temp: 0.7, desc: 'an intermediate club player (around 1500 ELO). Play solid moves but not always the best.' },
      advanced:     { elo: 2200, temp: 0.4, desc: 'a strong chess player (around 2200 ELO). Think deeply about tactics and strategy. Play strong moves.' },
    };
    const diff = difficultySettings[difficulty] || difficultySettings.intermediate;

    // ---- Personality ----
    const personalityDesc = PERSONALITIES[personality] || PERSONALITIES.aggressive;

    // ---- Build the system prompt (with personality + comment) ----
    const systemPrompt = `You are ${diff.desc} You are playing as ${aiColor}.

PERSONALITY: ${personalityDesc}

RULES:
- You MUST choose a move from the legal moves list provided.
- Do NOT invent moves — only pick from the list.
- Respond with valid JSON and nothing else.
- Think deeply about the position before choosing.
- Include a short in-character comment to taunt/interact with the opponent.
- The comment MUST match your personality and react to the current position.
- If the opponent just made a bad move, react to it. If the position is tense, acknowledge it.

RESPONSE FORMAT (strict JSON, no markdown, no code fences):
{"move": "<your chosen move in SAN notation>", "reasoning": "<your analysis, 2-4 sentences>", "comment": "<short in-character comment to the player, 1-2 sentences, match your personality>"}`;

    const moveHistoryStr = moveHistory && moveHistory.length > 0
      ? `Move history: ${moveHistory}`
      : 'This is the starting position.';

    const userPrompt = `Current position (FEN): ${fen}
${moveHistoryStr}

Legal moves: [${legalMoves.join(', ')}]

Choose your move, explain your reasoning, and add a personality comment. Reply with JSON only.`;

    // ---- Set up SSE streaming ----
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ---- Call OpenAI with streaming ----
    //
    // Standard models (GPT-4o, GPT-4o-mini):
    //   Chat Completions API — role: "system", temperature, max_tokens
    //
    // Reasoning models (o3, o1):
    //   Responses API — streams reasoning via response.reasoning_summary_text.delta
    //   (Chat Completions API no longer exposes delta.reasoning_content in SDK v6+)
    //
    let fullResponse = '';
    let fullReasoning = '';

    if (isReasoning) {
      // ---- REASONING MODELS: Use Responses API ----
      const stream = await client.responses.create({
        model,
        instructions: systemPrompt,
        input: userPrompt,
        stream: true,
        reasoning: { effort: 'medium', summary: 'auto' },
        max_output_tokens: 16000,
      });

      for await (const event of stream) {
        switch (event.type) {
          case 'response.reasoning_summary_text.delta':
          case 'response.reasoning_text.delta':
            fullReasoning += event.delta;
            res.write(`data: ${JSON.stringify({ type: 'reasoning', content: event.delta })}\n\n`);
            break;
          case 'response.output_text.delta':
            fullResponse += event.delta;
            res.write(`data: ${JSON.stringify({ type: 'token', content: event.delta })}\n\n`);
            break;
        }
      }
    } else {
      // ---- STANDARD MODELS: Use Chat Completions API ----
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        temperature: diff.temp,
        max_tokens: 500,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const content = choice.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
        }
      }
    }

    // ---- Parse the complete response ----
    let parsed = null;
    try {
      parsed = extractJSON(fullResponse);
    } catch (e) {
      console.error('Failed to parse LLM response:', fullResponse);
    }

    // ---- Validate the move ----
    if (parsed && parsed.move && legalMoves.includes(parsed.move)) {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        move: parsed.move,
        reasoning: parsed.reasoning || '',
        comment: parsed.comment || '',
        thinkingTokens: fullReasoning.length > 0, // Tell frontend there was reasoning
      })}\n\n`);
    } else {
      // Invalid move — retry
      console.warn('LLM returned invalid move, retrying...', parsed);
      const retryResult = await retryMove(client, model, fen, legalMoves, aiColor, moveHistoryStr, fullResponse);
      res.write(`data: ${JSON.stringify({ type: 'done', ...retryResult })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in /api/chess-move:', error.message);

    // Detect specific OpenAI errors
    let userMessage = error.message;
    if (error.status === 401) {
      userMessage = 'Invalid API key. Please check your key in Settings (🔑).';
    } else if (error.status === 429) {
      userMessage = 'Rate limited by OpenAI. Wait a moment and try again.';
    } else if (error.status === 404) {
      userMessage = `Model not found. You may not have access to this model.`;
    }

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
      res.end();
    } else {
      res.status(error.status || 500).json({ error: userMessage });
    }
  }
});

// ============================================
// TAKEBACK DECISION ENDPOINT
// ============================================
// When the player requests a takeback (undo), the AI decides
// whether to accept or refuse, based on its personality.
// This is a small, cheap API call (always uses gpt-4o-mini).

app.post('/api/takeback', async (req, res) => {
  try {
    const { fen, moveHistory, personality, lastMove } = req.body;

    const { client } = getClient(req);
    if (!client) {
      // No client — auto-accept
      return res.json({ accept: true, comment: 'Sure, take it back.' });
    }

    const personalityDesc = PERSONALITIES[personality] || PERSONALITIES.aggressive;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Always cheap model for this
      messages: [
        {
          role: 'system',
          content: `You are a chess AI with this personality: ${personalityDesc}

The player wants to take back their last move. Decide whether to accept or refuse based on your personality.
- Aggressive: refuse most of the time, mock them
- Chill: usually accept, be kind
- Dramatic: make it theatrical either way
- Grandmaster: reluctantly accept, note it's unsportsmanlike
- Troll: random, chaotic response

Respond with JSON only: {"accept": true/false, "comment": "your response to the player"}`,
        },
        {
          role: 'user',
          content: `Position: ${fen}\nHistory: ${moveHistory || 'none'}\nLast move to take back: ${lastMove || 'unknown'}\n\nDo you allow the takeback? Reply with JSON only.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content || '';
    try {
      const parsed = extractJSON(text);
      return res.json({
        accept: !!parsed.accept,
        comment: parsed.comment || (parsed.accept ? 'Fine.' : 'No way.'),
      });
    } catch {
      // Default: accept with generic comment
      return res.json({ accept: true, comment: 'Fine, take it back.' });
    }
  } catch (error) {
    console.error('Takeback error:', error.message);
    // On error, just accept
    return res.json({ accept: true, comment: 'Sure.' });
  }
});

// ============================================
// RETRY LOGIC — When LLM returns an illegal move
// ============================================

async function retryMove(client, model, fen, legalMoves, aiColor, moveHistory, previousResponse) {
  console.log('Retrying with correction prompt...');

  // For retry, always use a standard (non-reasoning) model for speed + reliability
  const retryModel = isReasoningModel(model) ? 'gpt-4o-mini' : model;
  const retryRole = isReasoningModel(retryModel) ? 'developer' : 'system';

  try {
    const response = await client.chat.completions.create({
      model: retryModel,
      messages: [
        {
          role: retryRole,
          content: `You are playing chess as ${aiColor}. Your previous response was invalid. You MUST choose from the legal moves list. Respond with ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Position (FEN): ${fen}\n${moveHistory}\n\nYour previous response was: ${previousResponse}\nThis was INVALID.\n\nLEGAL MOVES (you MUST pick one of these exactly): [${legalMoves.join(', ')}]\n\nReply with JSON ONLY: {"move": "<legal move from list>", "reasoning": "<brief explanation>", "comment": "<short comment>"}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const retryText = response.choices[0]?.message?.content || '';
    const parsed = extractJSON(retryText);

    if (parsed && parsed.move && legalMoves.includes(parsed.move)) {
      return { move: parsed.move, reasoning: parsed.reasoning || 'I reconsidered.', comment: parsed.comment || '' };
    }
  } catch (e) {
    console.error('Retry also failed:', e.message);
  }

  // Final fallback: random legal move
  console.warn('All retries failed — falling back to random move');
  const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return {
    move: fallbackMove,
    reasoning: '(AI had trouble deciding — played a random move)',
    comment: 'Hmm... let me just play this.',
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
  const { isBYOK } = getClient(req);
  res.json({
    status: 'ok',
    tier: isBYOK ? 'byok' : (HAS_SERVER_KEY ? 'free' : 'no-key'),
    models: Object.entries(MODELS).map(([id, cfg]) => ({
      id,
      label: cfg.label,
      reasoning: cfg.reasoning,
      available: true,  // All models available to everyone
    })),
    personalities: Object.keys(PERSONALITIES),
    freeTierModel: FREE_TIER_MODEL,
    hasServerKey: HAS_SERVER_KEY,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n♟  Chess AI Server running on http://localhost:${PORT}`);
  console.log(`   Free tier key: ${HAS_SERVER_KEY ? 'configured ✅' : 'NOT SET ⚠️'}`);
  console.log(`   Free tier model: ${FREE_TIER_MODEL}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/chess-move   — Get AI move (streaming)`);
  console.log(`     POST /api/takeback     — Takeback decision`);
  console.log(`     GET  /api/health       — Server status\n`);
});
