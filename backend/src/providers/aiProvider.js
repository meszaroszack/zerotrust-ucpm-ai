/**
 * AI Provider Abstraction Layer
 * Primary: Perplexity (live)
 * Others: scaffolded as future-ready placeholders
 */

const perplexityProvider = require('./perplexityProvider');
const openaiProvider = require('./openaiProvider');
const anthropicProvider = require('./anthropicProvider');
const geminiProvider = require('./geminiProvider');
const azureOpenAIProvider = require('./azureOpenAIProvider');
const bedrockProvider = require('./bedrockProvider');

const providers = {
  perplexity: perplexityProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  azureOpenAI: azureOpenAIProvider,
  bedrock: bedrockProvider
};

/**
 * Execute a completion using the configured active provider.
 * Returns structured JSON response.
 */
async function complete({ messages, systemPrompt, settings, forceProvider }) {
  const activeProvider = forceProvider || 'perplexity';
  const provider = providers[activeProvider];
  if (!provider) throw new Error(`Unknown AI provider: ${activeProvider}`);

  const apiKey = settings?.aiProviders?.[activeProvider]?.apiKey || getEnvKey(activeProvider);
  const model = settings?.aiProviders?.[activeProvider]?.model || getDefaultModel(activeProvider);

  return await provider.complete({ messages, systemPrompt, apiKey, model });
}

function getEnvKey(provider) {
  const keys = {
    perplexity: process.env.PERPLEXITY_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    azureOpenAI: process.env.AZURE_OPENAI_API_KEY,
    bedrock: process.env.AWS_ACCESS_KEY_ID
  };
  return keys[provider] || '';
}

function getDefaultModel(provider) {
  const models = {
    perplexity: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-1.5-pro',
    azureOpenAI: 'gpt-4o',
    bedrock: 'anthropic.claude-3-sonnet-20240229-v1:0'
  };
  return models[provider] || '';
}

module.exports = { complete, providers };
