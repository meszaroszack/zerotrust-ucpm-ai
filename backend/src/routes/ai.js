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

async function runAI(promptData) {
  const cfg = ConfigModel.get();
  const { systemPrompt, userMessage } = promptData;

  if (!cfg.perplexityApiKey && !process.env.PERPLEXITY_API_KEY) {
    throw new Error('No AI key configured. Please add your Perplexity API key in Settings.');
  }

  const messages = [{ role: 'user', content: userMessage }];
  const result = await complete({ messages, systemPrompt });

  // If result is a string (provider returned raw text), wrap it
  if (typeof result === 'string') {
    return {
      title: 'AI Analysis',
      summary: result,
      confidence: 'medium',
      assumptions: [],
      warnings: [],
      recommendations: [],
      proposedObjects: [],
      missingInputs: [],
      humanReviewFlags: ['Review AI output — returned as unstructured text.']
    };
  }

  return result;
}

function handleError(res, err, context) {
  console.error(`[AI/${context}]`, err.message);
  const status = err.response?.status;
  const msg = err.message?.includes('API key')
    ? err.message
    : status === 429
    ? 'Rate limit reached. Please wait a moment and try again.'
    : status === 401
    ? 'AI API key rejected. Please update your key in Settings.'
    : status === 400
    ? `AI request rejected (400): ${err.message}`
    : `AI request failed: ${err.message}`;
  res.status(500).json({ error: msg });
}

// POST /api/ai/intake-document
router.post('/intake-document', authenticate, async (req, res) => {
  const { content, filename } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided.' });
  try {
    const safe = truncate(content);
    const result = await runAI(prompts.intakeDocument(safe));
    WorkspaceModel.addAIReason({ type: 'intake-document', filename, result });
    const ws = WorkspaceModel.getActive();
    if (ws) {
      const inputs = [...(ws.sourceInputs || []), { type: 'document', filename, extractedAt: new Date().toISOString() }];
      WorkspaceModel.update({ sourceInputs: inputs });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'intake-document'); }
});

// POST /api/ai/extract-program
router.post('/extract-program', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.extractProgram(context));
    WorkspaceModel.addAIReason({ type: 'extract-program', result });
    res.json(result);
  } catch (err) { handleError(res, err, 'extract-program'); }
});

// POST /api/ai/ask-followups
router.post('/ask-followups', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.askFollowups(context));
    res.json(result);
  } catch (err) { handleError(res, err, 'ask-followups'); }
});

// POST /api/ai/generate-scenarios
router.post('/generate-scenarios', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.generateScenarios(context));
    if (result?.scenarios) {
      WorkspaceModel.update({ scenarios: result.scenarios });
      WorkspaceModel.addAIReason({ type: 'generate-scenarios', result });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'generate-scenarios'); }
});

// POST /api/ai/recommend-purposes
router.post('/recommend-purposes', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendPurposes(context));
    if (result?.proposedObjects) {
      WorkspaceModel.update({ purposes: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-purposes', result });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-purposes'); }
});

// POST /api/ai/recommend-data-elements
router.post('/recommend-data-elements', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendDataElements(context));
    if (result?.proposedObjects) {
      WorkspaceModel.update({ dataElements: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-data-elements', result });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-data-elements'); }
});

// POST /api/ai/recommend-collection-points
router.post('/recommend-collection-points', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendCollectionPoints(context));
    if (result?.proposedObjects) {
      WorkspaceModel.update({ collectionPoints: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-collection-points', result });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'recommend-collection-points'); }
});

// POST /api/ai/propose-update
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

// POST /api/ai/explain-plan
router.post('/explain-plan', authenticate, async (req, res) => {
  const { plan } = req.body;
  try {
    const result = await runAI(prompts.explainPlan(plan));
    res.json(result);
  } catch (err) { handleError(res, err, 'explain-plan'); }
});

// POST /api/ai/translate-content
router.post('/translate-content', authenticate, async (req, res) => {
  const { content, targetLanguage, sourceLanguage } = req.body;
  try {
    const result = await runAI(prompts.translateContent({ content, targetLanguage, sourceLanguage }));
    res.json(result);
  } catch (err) { handleError(res, err, 'translate-content'); }
});

module.exports = router;
