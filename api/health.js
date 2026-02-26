// ============================================
// api/health.js — Serverless: Health Check
// ============================================
// Vercel automatically exposes this as GET /api/health
// Returns server status + available models.
// ============================================

import { MODELS, FREE_TIER_MODEL, PERSONALITIES, getClient, setCorsHeaders } from './_shared.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { isBYOK } = getClient(req);
  const HAS_SERVER_KEY = !!process.env.OPENAI_API_KEY;

  res.json({
    status: 'ok',
    tier: isBYOK ? 'byok' : (HAS_SERVER_KEY ? 'free' : 'no-key'),
    models: Object.entries(MODELS).map(([id, cfg]) => ({
      id,
      label: cfg.label,
      reasoning: cfg.reasoning,
      available: true,
    })),
    personalities: Object.keys(PERSONALITIES),
    freeTierModel: FREE_TIER_MODEL,
    hasServerKey: HAS_SERVER_KEY,
  });
}
