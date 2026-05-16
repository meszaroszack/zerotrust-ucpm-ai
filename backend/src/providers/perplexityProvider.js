const axios = require('axios');
const ConfigModel = require('../models/config');

const PERPLEXITY_BASE = 'https://api.perplexity.ai';

async function complete({ messages, systemPrompt, apiKey, model }) {
  // Resolve key: caller-provided → config file → env var
  const cfg = ConfigModel.get();
  const resolvedKey = apiKey || cfg.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
  const resolvedModel = model || cfg.perplexityModel || process.env.PERPLEXITY_MODEL || 'sonar';

  if (!resolvedKey) {
    throw new Error('No Perplexity API key found. Please add your API key in the application settings.');
  }

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages);

  const resp = await axios.post(
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
