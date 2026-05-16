const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { complete } = require('../providers/aiProvider');
const { prompts } = require('../utils/aiPrompts');
const { WorkspaceModel } = require('../models/workspace');
const ConfigModel = require('../models/config');

// Cap content so we never blow the token limit
const MAX_CONTENT_CHARS = 12000;

function truncate(text) {
  if (!text) return '';
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated for processing — full document on file.]';
}

/**
 * Run an AI prompt and return a parsed object.
 * Throws on any failure — routes must handle errors.
 * Does NOT silently wrap non-JSON as success.
 */
async function runAI(promptData) {
  const cfg = ConfigModel.get();
  if (!cfg.perplexityApiKey && !process.env.PERPLEXITY_API_KEY) {
    throw new Error('No AI key configured. Please add your Perplexity API key in Settings.');
  }
  const { systemPrompt, userMessage } = promptData;
  const messages = [{ role: 'user', content: userMessage }];
  // complete() throws on non-JSON — no silent wrapping here
  return await complete({ messages, systemPrompt });
}

/**
 * Validate that a parsed AI result has the minimum required shape.
 * routeKey is the name of the required discriminating key (e.g. 'questions', 'proposedObjects').
 * Returns { valid, error } — never throws.
 */
function validateShape(result, routeKey) {
  if (!result || typeof result !== 'object') {
    return { valid: false, error: 'AI returned a non-object response.' };
  }
  if (routeKey && !(routeKey in result)) {
    return {
      valid: false,
      error: `AI response is missing required field "${routeKey}". ` +
             `Got keys: [${Object.keys(result).join(', ')}]. ` +
             `This is a transient model output issue — please retry.`
    };
  }
  if (routeKey && !Array.isArray(result[routeKey])) {
    return {
      valid: false,
      error: `AI field "${routeKey}" must be an array but got ${typeof result[routeKey]}. Please retry.`
    };
  }
  return { valid: true };
}

function handleError(res, err, context) {
  console.error(`[AI/${context}]`, err.message);
  const status = err.response?.status;
  const msg = err.message?.includes('API key') || err.message?.includes('No AI key')
    ? err.message
    : status === 429
    ? 'Rate limit reached. Please wait a moment and try again.'
    : status === 401
    ? 'AI API key rejected. Please update your key in Settings.'
    : status === 400
    ? `AI request rejected (400): ${err.message}`
    : err.message || 'AI request failed. Please retry.';
  res.status(500).json({ error: msg });
}

// ── POST /api/ai/intake-document ────────────────────────────────────────────
router.post('/intake-document', authenticate, async (req, res) => {
  const { content, filename } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided.' });
  try {
    const safe = truncate(content);
    const result = await runAI(prompts.intakeDocument(safe));
    // Intake is flexible — we don't require a specific discriminating key
    // but we do require the result to be a real object with at least a summary
    const { valid, error } = validateShape(result, null);
    if (!valid) return res.status(500).json({ error });
    if (!result.summary && !result.extractedContext) {
      return res.status(500).json({
        error: 'AI intake response was missing required fields. Please retry.'
      });
    }
    WorkspaceModel.addAIReason({ type: 'intake-document', filename, result });
    const ws = WorkspaceModel.getActive();
    if (ws) {
      const inputs = [...(ws.sourceInputs || []), {
        type: 'document', filename, extractedAt: new Date().toISOString()
      }];
      WorkspaceModel.update({ sourceInputs: inputs });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'intake-document'); }
});

// ── POST /api/ai/ask-followups ───────────────────────────────────────────────
router.post('/ask-followups', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.askFollowups(context));
    const { valid, error } = validateShape(result, 'questions');
    if (!valid) return res.status(500).json({ error });
    if (result.questions.length === 0) {
      return res.status(500).json({ error: 'AI returned an empty questions array. Please retry.' });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'ask-followups'); }
});

// ── POST /api/ai/extract-program ────────────────────────────────────────────
router.post('/extract-program', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.extractProgram(context));
    const { valid, error } = validateShape(result, null);
    if (!valid) return res.status(500).json({ error });
    WorkspaceModel.addAIReason({ type: 'extract-program', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'extract-program'); }
});

// ── POST /api/ai/generate-scenarios ─────────────────────────────────────────
router.post('/generate-scenarios', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.generateScenarios(context));
    const { valid, error } = validateShape(result, 'scenarios');
    if (!valid) return res.status(500).json({ error });
    WorkspaceModel.update({ scenarios: result.scenarios });
    WorkspaceModel.addAIReason({ type: 'generate-scenarios', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'generate-scenarios'); }
});

// ── POST /api/ai/recommend-purposes ─────────────────────────────────────────
router.post('/recommend-purposes', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendPurposes(context));
    const { valid, error } = validateShape(result, 'proposedObjects');
    if (!valid) return res.status(500).json({ error });
    WorkspaceModel.update({ purposes: result.proposedObjects });
    WorkspaceModel.addAIReason({ type: 'recommend-purposes', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-purposes'); }
});

// ── POST /api/ai/recommend-data-elements ────────────────────────────────────
router.post('/recommend-data-elements', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendDataElements(context));
    const { valid, error } = validateShape(result, 'proposedObjects');
    if (!valid) return res.status(500).json({ error });
    WorkspaceModel.update({ dataElements: result.proposedObjects });
    WorkspaceModel.addAIReason({ type: 'recommend-data-elements', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-data-elements'); }
});

// ── POST /api/ai/recommend-collection-points ────────────────────────────────
router.post('/recommend-collection-points', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendCollectionPoints(context));
    const { valid, error } = validateShape(result, 'proposedObjects');
    if (!valid) return res.status(500).json({ error });
    WorkspaceModel.update({ collectionPoints: result.proposedObjects });
    WorkspaceModel.addAIReason({ type: 'recommend-collection-points', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-collection-points'); }
});

// ── POST /api/ai/propose-update ─────────────────────────────────────────────
router.post('/propose-update', authenticate, async (req, res) => {
  const { request } = req.body;
  const ws = WorkspaceModel.getActive();
  if (!ws) return res.status(400).json({ error: 'No active workspace. Please start an implementation session first.' });
  try {
    const currentState = {
      scenarios: ws.scenarios,
      purposes: ws.purposes,
      dataElements: ws.dataElements,
      collectionPoints: ws.collectionPoints,
      activeBrand: ws.activeBrandName
    };
    const result = await runAI(prompts.proposeUpdate(request, currentState));
    WorkspaceModel.addAIReason({ type: 'propose-update', request, result });
    res.json(result);
  } catch (err) { handleError(res, err, 'propose-update'); }
});

// ── POST /api/ai/explain-plan ────────────────────────────────────────────────
router.post('/explain-plan', authenticate, async (req, res) => {
  const { plan } = req.body;
  try {
    const result = await runAI(prompts.explainPlan(plan));
    res.json(result);
  } catch (err) { handleError(res, err, 'explain-plan'); }
});

// ── POST /api/ai/translate-content ──────────────────────────────────────────
router.post('/translate-content', authenticate, async (req, res) => {
  const { content, targetLanguage, sourceLanguage } = req.body;
  try {
    const result = await runAI(prompts.translateContent({ content, targetLanguage, sourceLanguage }));
    res.json(result);
  } catch (err) { handleError(res, err, 'translate-content'); }
});

module.exports = router;
