// ============================================
// api/takeback.js — Serverless: Takeback Decision
// ============================================
// Vercel automatically exposes this as POST /api/takeback
// The AI decides whether to allow the player to undo a move.
// ============================================

import { PERSONALITIES, getClient, extractJSON, setCorsHeaders } from './_shared.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fen, moveHistory, personality, lastMove } = req.body;

    const { client } = getClient(req);
    if (!client) {
      return res.json({ accept: true, comment: 'Sure, take it back.' });
    }

    const personalityDesc = PERSONALITIES[personality] || PERSONALITIES.aggressive;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
      return res.json({ accept: true, comment: 'Fine, take it back.' });
    }
  } catch (error) {
    console.error('Takeback error:', error.message);
    return res.json({ accept: true, comment: 'Sure.' });
  }
}
