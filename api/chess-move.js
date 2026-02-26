// ============================================
// api/chess-move.js — Serverless: Get AI Chess Move (streaming)
// ============================================
// Vercel automatically exposes this as POST /api/chess-move
//
// On Vercel, serverless functions have a max duration
// (10s on free, 60s on Pro). Streaming extends this because
// the response stays open. Our SSE approach works perfectly.
// ============================================

import {
  MODELS, PERSONALITIES, FREE_LIMIT,
  isReasoningModel, checkRateLimit, getClient,
  extractJSON, retryMove, setCorsHeaders,
} from './_shared.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fen, moveHistory, legalMoves, playerColor, difficulty, model: requestedModel, personality } = req.body;

    // Validate input
    if (!fen || !legalMoves || legalMoves.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: fen, legalMoves' });
    }

    // Get the right OpenAI client
    const { client, isBYOK } = getClient(req);
    if (!client) {
      return res.status(503).json({
        error: 'No API key available. Enter your own key in Settings, or ask the site owner to configure a server key.',
      });
    }

    // Determine model
    let model = requestedModel && MODELS[requestedModel] ? requestedModel : 'gpt-4o-mini';

    if (!isBYOK) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const limit = checkRateLimit(ip);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Free tier rate limit reached (${FREE_LIMIT} moves/hour). Enter your own API key for unlimited play. Resets in ~${limit.resetsIn} minutes.`,
        });
      }
    }

    const isReasoning = isReasoningModel(model);
    const aiColor = playerColor === 'w' ? 'Black' : 'White';

    // Difficulty settings
    const difficultySettings = {
      beginner:     { elo: 800,  temp: 1.0, desc: 'a casual beginner (around 800 ELO). Make simple, obvious moves. Occasionally make mistakes. Do NOT play optimal moves.' },
      intermediate: { elo: 1500, temp: 0.7, desc: 'an intermediate club player (around 1500 ELO). Play solid moves but not always the best.' },
      advanced:     { elo: 2200, temp: 0.4, desc: 'a strong chess player (around 2200 ELO). Think deeply about tactics and strategy. Play strong moves.' },
    };
    const diff = difficultySettings[difficulty] || difficultySettings.intermediate;

    // Personality
    const personalityDesc = PERSONALITIES[personality] || PERSONALITIES.aggressive;

    // Build prompts
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

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Build API parameters
    const systemRole = isReasoning ? 'developer' : 'system';
    const apiParams = {
      model,
      messages: [
        { role: systemRole, content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
    };

    if (isReasoning) {
      apiParams.max_completion_tokens = 16000;
    } else {
      apiParams.temperature = diff.temp;
      apiParams.max_tokens = 500;
    }

    // Call OpenAI with streaming
    const stream = await client.chat.completions.create(apiParams);

    let fullResponse = '';
    let fullReasoning = '';

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const reasoningContent = choice.delta?.reasoning_content;
      if (reasoningContent) {
        fullReasoning += reasoningContent;
        res.write(`data: ${JSON.stringify({ type: 'reasoning', content: reasoningContent })}\n\n`);
      }

      const content = choice.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
      }
    }

    // Parse the complete response
    let parsed = null;
    try {
      parsed = extractJSON(fullResponse);
    } catch (e) {
      console.error('Failed to parse LLM response:', fullResponse);
    }

    // Validate the move
    if (parsed && parsed.move && legalMoves.includes(parsed.move)) {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        move: parsed.move,
        reasoning: parsed.reasoning || '',
        comment: parsed.comment || '',
        thinkingTokens: fullReasoning.length > 0,
      })}\n\n`);
    } else {
      console.warn('LLM returned invalid move, retrying...', parsed);
      const retryResult = await retryMove(client, model, fen, legalMoves, aiColor, moveHistoryStr, fullResponse);
      res.write(`data: ${JSON.stringify({ type: 'done', ...retryResult })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in /api/chess-move:', error.message);

    let userMessage = error.message;
    if (error.status === 401) userMessage = 'Invalid API key. Please check your key in Settings.';
    else if (error.status === 429) userMessage = 'Rate limited by OpenAI. Wait a moment and try again.';
    else if (error.status === 404) userMessage = 'Model not found. You may not have access to this model.';

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
      res.end();
    } else {
      res.status(error.status || 500).json({ error: userMessage });
    }
  }
}
