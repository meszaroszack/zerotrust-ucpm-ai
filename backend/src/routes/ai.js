const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { complete } = require('../providers/aiProvider');
const { prompts } = require('../utils/aiPrompts');
const { WorkspaceModel, SettingsModel } = require('../models/workspace');

function getSettings() { return SettingsModel.get(); }

async function runAI(promptData, res) {
  const settings = getSettings();
  const { systemPrompt, userMessage } = promptData;
  const messages = [{ role: 'user', content: userMessage }];
  const result = await complete({ messages, systemPrompt, settings });
  return result;
}

// POST /api/ai/intake-document
router.post('/intake-document', authenticate, async (req, res) => {
  const { content, filename } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  try {
    const result = await runAI(prompts.intakeDocument(content));
    WorkspaceModel.addAIReason({ type: 'intake-document', filename, result });
    const ws = WorkspaceModel.getActive();
    if (ws) {
      ws.sourceInputs = [...(ws.sourceInputs || []), { type: 'document', filename, extractedAt: new Date().toISOString() }];
      WorkspaceModel.update({ sourceInputs: ws.sourceInputs });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/extract-program
router.post('/extract-program', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.extractProgram(context));
    WorkspaceModel.addAIReason({ type: 'extract-program', result });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/ask-followups
router.post('/ask-followups', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.askFollowups(context));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-scenarios
router.post('/generate-scenarios', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.generateScenarios(context));
    if (result.scenarios) {
      WorkspaceModel.update({ scenarios: result.scenarios });
      WorkspaceModel.addAIReason({ type: 'generate-scenarios', result });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/recommend-purposes
router.post('/recommend-purposes', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendPurposes(context));
    if (result.proposedObjects) {
      WorkspaceModel.update({ purposes: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-purposes', result });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/recommend-data-elements
router.post('/recommend-data-elements', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendDataElements(context));
    if (result.proposedObjects) {
      WorkspaceModel.update({ dataElements: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-data-elements', result });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/recommend-collection-points
router.post('/recommend-collection-points', authenticate, async (req, res) => {
  const { context } = req.body;
  try {
    const result = await runAI(prompts.recommendCollectionPoints(context));
    if (result.proposedObjects) {
      WorkspaceModel.update({ collectionPoints: result.proposedObjects });
      WorkspaceModel.addAIReason({ type: 'recommend-collection-points', result });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/propose-update
router.post('/propose-update', authenticate, async (req, res) => {
  const { request } = req.body;
  const currentState = WorkspaceModel.getActive();
  if (!currentState) return res.status(400).json({ error: 'No active workspace' });
  try {
    const result = await runAI(prompts.proposeUpdate(request, {
      scenarios: currentState.scenarios,
      purposes: currentState.purposes,
      dataElements: currentState.dataElements,
      collectionPoints: currentState.collectionPoints,
      activeBrand: currentState.activeBrandName
    }));
    WorkspaceModel.addAIReason({ type: 'propose-update', request, result });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/explain-plan
router.post('/explain-plan', authenticate, async (req, res) => {
  const { plan } = req.body;
  try {
    const result = await runAI(prompts.explainPlan(plan));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/translate-content
router.post('/translate-content', authenticate, async (req, res) => {
  const { content, targetLanguage, sourceLanguage } = req.body;
  try {
    const result = await runAI(prompts.translateContent({ content, targetLanguage, sourceLanguage }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
