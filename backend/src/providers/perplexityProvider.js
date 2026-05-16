const axios = require('axios');
const ConfigModel = require('../models/config');

const PERPLEXITY_BASE = 'https://api.perplexity.ai';
const VALID_MODELS = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'r1-1776'];

async function complete({ messages, systemPrompt, apiKey, model }) {
  const cfg = ConfigModel.get();
  const resolvedKey = apiKey || cfg.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
  const resolvedModel = model || cfg.perplexityModel || process.env.PERPLEXITY_MODEL || 'sonar';

  if (!VALID_MODELS.includes(resolvedModel)) {
    throw new Error(`Invalid Perplexity model "${resolvedModel}". Valid models: ${VALID_MODELS.join(', ')}`);
  }
  if (!resolvedKey) {
    throw new Error('No Perplexity API key found. Please add your API key in Settings.');
  }

  // Build messages — merge system prompt into user content because Perplexity
  // standard-tier accounts may reject a standalone 'system' role with 400.
  const allMessages = [];
  if (systemPrompt) {
    const combined = `${systemPrompt}\n\n---\n\n${messages[0]?.content || ''}`;
    allMessages.push({ role: 'user', content: combined });
    allMessages.push(...messages.slice(1));
  } else {
    allMessages.push(...messages);
  }

  let resp;
  try {
    resp = await axios.post(
      `${PERPLEXITY_BASE}/chat/completions`,
      { model: resolvedModel, messages: allMessages, temperature: 0.2, max_tokens: 4096 },
      { headers: { Authorization: `Bearer ${resolvedKey}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const body = err.response?.data;
    const status = err.response?.status;
    console.error('[Perplexity] HTTP', status, JSON.stringify(body));
    const detail = body?.error?.message || body?.detail || body?.message || JSON.stringify(body) || err.message;
    const error = new Error(`Perplexity ${status || 'error'}: ${detail}`);
    error.response = err.response;
    throw error;
  }

  const raw = (resp.data.choices?.[0]?.message?.content || '').trim();
  if (!raw) throw new Error('Perplexity returned an empty response. Please retry.');

  return parseOrThrow(raw);
}

/**
 * Parse JSON from the model's response.
 * Accepts:
 *   1. A ```json ... ``` fenced block
 *   2. The first top-level JSON object in the string (handles leading prose)
 *   3. A bare JSON string
 *
 * Throws a structured error if none of these parse — this bubbles up as a
 * real API error instead of a misleading 200 success with garbage data.
 */
function parseOrThrow(raw) {
  // 1. Fenced code block (preferred — model should always use this)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (e) {
      throw new Error(`AI returned a JSON code block but it was not valid JSON. Parse error: ${e.message}`);
    }
  }

  // 2. Find the first { in the string and try parsing from there
  const firstBrace = raw.indexOf('{');
  if (firstBrace !== -1) {
    try { return JSON.parse(raw.slice(firstBrace)); } catch {}
    // Try just the substring up to the last }
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
    }
  }

  // 3. Bare JSON
  try { return JSON.parse(raw); } catch {}

  // Nothing worked — throw so the route returns a real error
  console.error('[Perplexity] Non-JSON response (first 500 chars):', raw.slice(0, 500));
  throw new Error(
    'AI did not return valid JSON. The model responded with prose instead of structured data. ' +
    'This is a transient issue — please retry. If it persists, check Railway logs for the raw response.'
  );
}

module.exports = { complete };
