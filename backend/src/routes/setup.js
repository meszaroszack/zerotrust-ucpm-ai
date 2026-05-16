/**
 * Setup / Onboarding Routes — no auth required.
 * This is how the app gets configured on first run or credential update.
 */
const express = require('express');
const router = express.Router();
const ConfigModel = require('../models/config');
const axios = require('axios');

// GET /api/setup/status
router.get('/status', (req, res) => {
  const cfg = ConfigModel.get();
  res.json({
    isFirstRun: !cfg.setupComplete && !cfg.adminEmail,
    isConfigured: cfg.isConfigured,
    setupComplete: cfg.setupComplete,
    hasAdminAccount: !!(cfg.adminEmail && cfg.adminPassword),
    hasAIKey: !!cfg.perplexityApiKey,
    hasOTCredentials: !!(cfg.otClientId && cfg.otClientSecret),
  });
});

// POST /api/setup/save-admin
router.post('/save-admin', async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const current = ConfigModel.get();
  const updates = { adminEmail: email };

  // Only update password if provided
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    updates.adminPassword = password;
  } else if (!current.adminPassword) {
    return res.status(400).json({ error: 'Password is required for first-time setup.' });
  }

  ConfigModel.save(updates);
  res.json({ success: true });
});

// POST /api/setup/save-ai
router.post('/save-ai', async (req, res) => {
  const { perplexityApiKey, perplexityModel } = req.body;
  if (!perplexityApiKey) return res.status(400).json({ error: 'API key is required.' });

  // Verify the key actually works
  try {
    const resp = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say OK.' }
      ],
      max_tokens: 5
    }, {
      headers: {
        Authorization: `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    if (!resp.data?.choices) throw new Error('Unexpected response');
  } catch (err) {
    const status = err.response?.status;
    const msg = (status === 401 || status === 403)
      ? 'That API key was not accepted. Please double-check it and try again.'
      : status === 400
      ? 'The key format looks wrong. Make sure you copied the full key from perplexity.ai/settings/api.'
      : status
      ? `Perplexity returned an error (${status}). Please try again.`
      : 'Could not reach Perplexity. Check your internet connection and try again.';
    return res.status(400).json({ error: msg });
  }

  ConfigModel.save({
    perplexityApiKey,
    perplexityModel: perplexityModel || 'sonar'
  });
  res.json({ success: true, message: 'Key verified and saved.' });
});

// POST /api/setup/save-ot
router.post('/save-ot', async (req, res) => {
  const { otBaseUrl, otClientId, otClientSecret, otParentOrgName } = req.body;
  ConfigModel.save({ otBaseUrl, otClientId, otClientSecret, otParentOrgName });
  res.json({ success: true });
});

// POST /api/setup/complete
router.post('/complete', (req, res) => {
  ConfigModel.markSetupComplete();
  res.json({ success: true });
});

module.exports = router;
