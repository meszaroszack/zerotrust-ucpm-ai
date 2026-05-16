const axios = require('axios');

const PERPLEXITY_BASE = 'https://api.perplexity.ai';

async function complete({ messages, systemPrompt, apiKey, model }) {
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages);

  const resp = await axios.post(
    `${PERPLEXITY_BASE}/chat/completions`,
    {
      model: model || 'llama-3.1-sonar-large-128k-online',
      messages: allMessages,
      temperature: 0.2,
      max_tokens: 4096
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const raw = resp.data.choices?.[0]?.message?.content || '';

  // Attempt to parse JSON from the response
  return parseStructuredResponse(raw);
}

function parseStructuredResponse(raw) {
  // Try to extract JSON from markdown code blocks first
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()); } catch {}
  }
  // Try raw JSON parse
  try { return JSON.parse(raw.trim()); } catch {}
  // Return as wrapped prose if not parseable
  return {
    title: 'AI Response',
    summary: raw,
    confidence: 'medium',
    assumptions: [],
    warnings: ['Response was not structured JSON — human review required.'],
    recommendations: [],
    proposedObjects: [],
    missingInputs: [],
    humanReviewFlags: ['Full response requires manual interpretation']
  };
}

module.exports = { complete };
