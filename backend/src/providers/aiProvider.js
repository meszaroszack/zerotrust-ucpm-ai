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
 * Execute a completion using the active provider.
 * Key resolution happens inside each provider (ConfigModel → env var).
 */
async function complete({ messages, systemPrompt, forceProvider }) {
  const activeProvider = forceProvider || 'perplexity';
  const provider = providers[activeProvider];
  if (!provider) throw new Error(`Unknown AI provider: ${activeProvider}`);
  return await provider.complete({ messages, systemPrompt });
}

module.exports = { complete, providers };
