const axios = require('axios');
const ConfigModel = require('../models/config');

const PERPLEXITY_BASE = 'https://api.perplexity.ai';

async function complete({ messages, systemPrompt, apiKey, model }) {
  // Resolve key: caller-provided → config file → env var
  const cfg = ConfigModel.get();
  const resolvedKey = apiKey || cfg.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
  const resolvedModel = model || cfg.perplexityModel || process.env.PERPLEXITY_MODEL || 'sonar';
  const VALID = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'r1-1776'];
  if (!VALID.includes(resolvedModel)) throw new Error(`Invalid Perplexity model "${resolvedModel}". Valid: ${VALID.join(', ')}`);


  if (!resolvedKey) {
    throw new Error('No Perplexity API key found. Please add your API key in the application settings.');
  }

  // Perplexity standard accounts do not support the 'system' role — it returns a 400.
  // Prepend the system prompt as the first user message instead, then alternate roles properly.
  const allMessages = [];
  if (systemPrompt) {
    // Inject system content as a leading user message so the first role is always 'user'
    const firstUserContent = `[System Instructions]\n${systemPrompt}\n\n[User Request]\n${messages[0]?.content || ''}`;
    allMessages.push({ role: 'user', content: firstUserContent });
    // Append any remaining messages (skip index 0 since we merged it above)
    allMessages.push(...messages.slice(1));
  } else {
    allMessages.push(...messages);
  }

  let resp;
  try {
    resp = await axios.post(
      `${PERPLEXITY_BASE}/chat/completions`,
      {
        model: resolvedModel,
        messages: allMessages,
        temperature: 0.2,
        max_tokens: 4096
      },
      {
        headers: {
          Authorization: `Bearer ${resolvedKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    // Log the full Perplexity error body so we can actually debug it
    const body = err.response?.data;
    const status = err.response?.status;
    console.error('[Perplexity] HTTP', status, JSON.stringify(body));
    // Re-throw with meaningful message
    const detail = body?.error?.message || body?.detail || body?.message || JSON.stringify(body) || err.message;
    const error = new Error(`Perplexity ${status || 'error'}: ${detail}`);
    error.response = err.response;
    throw error;
  }

  const raw = resp.data.choices?.[0]?.message?.content || '';
  return parseStructuredResponse(raw);
}

function parseStructuredResponse(raw) {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()); } catch {}
  }
  try { return JSON.parse(raw.trim()); } catch {}
  return {
    title: 'AI Response',
    summary: raw,
    confidence: 'medium',
    assumptions: [],
    warnings: ['Response format requires review.'],
    recommendations: [],
    proposedObjects: [],
    missingInputs: [],
    humanReviewFlags: ['Full response requires manual interpretation']
  };
}

module.exports = { complete };
