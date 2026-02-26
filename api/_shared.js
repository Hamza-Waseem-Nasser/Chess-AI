// ============================================
// api/_shared.js — Shared utilities for serverless functions
// ============================================
// Files starting with _ are NOT exposed as endpoints by Vercel.
// This contains all shared logic used by the API functions.
// ============================================

import OpenAI from 'openai';

// ============================================
// MODEL CONFIGURATION
// ============================================

export const MODELS = {
  'gpt-4o':      { reasoning: false, label: 'GPT-4o' },
  'gpt-4o-mini': { reasoning: false, label: 'GPT-4o Mini' },
  'o3':          { reasoning: true,  label: 'o3' },
  'o1':          { reasoning: true,  label: 'o1' },
};

export const FREE_TIER_MODEL = 'gpt-4o-mini';

export function isReasoningModel(model) {
  return MODELS[model]?.reasoning === true;
}

// ============================================
// AI PERSONALITY DEFINITIONS
// ============================================

export const PERSONALITIES = {
  aggressive: 'You are cocky and love trash-talking. Tease the opponent. Speak with confidence and bravado. Example comments: "That all you got?", "Watch and learn, rookie."',
  chill:      'You are friendly and encouraging. Compliment good moves, keep it casual. Warm tone. Example: "Nice move!", "This is a fun game!"',
  dramatic:   'You are theatrical and over-the-top dramatic. Everything is a HUGE moment. Speak like a wrestling announcer or Shakespeare villain. Example: "THE KNIGHT DESCENDS UPON YOUR KINGDOM!"',
  grandmaster:'You are calm, analytical, slightly cold. Speak like a chess commentator. Dry humor, clinical. Example: "An interesting choice. Dubious, but interesting."',
  troll:      'You are chaotic and funny. Use internet humor, memes, never serious. Playful chaos. Example: "lol nice try", "bruh moment incoming"',
};

// ============================================
// RATE LIMITING (in-memory, resets per cold start)
// ============================================
// NOTE: On Vercel serverless, each function invocation may run
// on a different instance, so this in-memory map is NOT globally
// shared. For production rate limiting, use Vercel KV or Upstash
// Redis. This is a best-effort limit for free tier.

const rateLimits = new Map();
export const FREE_LIMIT = 30;

export function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3600000 };
  }

  if (entry.count >= FREE_LIMIT) {
    return { allowed: false, remaining: 0, resetsIn: Math.ceil((entry.resetAt - now) / 60000) };
  }

  entry.count++;
  rateLimits.set(ip, entry);
  return { allowed: true, remaining: FREE_LIMIT - entry.count };
}

// ============================================
// OpenAI CLIENT FACTORY
// ============================================

const HAS_SERVER_KEY = !!process.env.OPENAI_API_KEY;
let serverClient = null;

export function getClient(req) {
  const userKey = req.headers['x-api-key'];
  if (userKey && userKey.startsWith('sk-')) {
    return { client: new OpenAI({ apiKey: userKey }), isBYOK: true };
  }
  if (HAS_SERVER_KEY) {
    if (!serverClient) {
      serverClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return { client: serverClient, isBYOK: false };
  }
  return { client: null, isBYOK: false };
}

// ============================================
// JSON EXTRACTION
// ============================================

export function extractJSON(text) {
  try { return JSON.parse(text.trim()); } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }

  throw new Error('Could not extract JSON from response');
}

// ============================================
// RETRY LOGIC
// ============================================

export async function retryMove(client, model, fen, legalMoves, aiColor, moveHistory, previousResponse) {
  const retryModel = isReasoningModel(model) ? 'gpt-4o-mini' : model;

  try {
    const response = await client.chat.completions.create({
      model: retryModel,
      messages: [
        {
          role: 'system',
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
  const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return {
    move: fallbackMove,
    reasoning: '(AI had trouble deciding — played a random move)',
    comment: 'Hmm... let me just play this.',
  };
}

// ============================================
// CORS HELPER (for development)
// ============================================

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
}
