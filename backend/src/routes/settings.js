const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { SettingsModel } = require('../models/workspace');

// GET /api/settings
router.get('/', authenticate, (req, res) => {
  const settings = SettingsModel.get();
  // Mask API keys in response
  const masked = JSON.parse(JSON.stringify(settings));
  if (masked.aiProviders) {
    Object.keys(masked.aiProviders).forEach(k => {
      if (masked.aiProviders[k].apiKey) masked.aiProviders[k].apiKey = '***masked***';
    });
  }
  res.json(masked);
});

// POST /api/settings
router.post('/', authenticate, (req, res) => {
  const current = SettingsModel.get();
  // Merge carefully - preserve existing masked keys if new value is masked
  const updates = req.body;
  if (updates.aiProviders) {
    Object.keys(updates.aiProviders).forEach(k => {
      if (updates.aiProviders[k].apiKey === '***masked***') {
        updates.aiProviders[k].apiKey = current.aiProviders?.[k]?.apiKey || '';
      }
    });
  }
  const merged = { ...current, ...updates, aiProviders: { ...current.aiProviders, ...updates.aiProviders } };
  SettingsModel.save(merged);
  res.json({ success: true, message: 'Settings saved' });
});

module.exports = router;
