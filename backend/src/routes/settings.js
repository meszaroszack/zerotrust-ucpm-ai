const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ConfigModel = require('../models/config');

// GET /api/settings — return safe (masked) config
router.get('/', authenticate, (req, res) => {
  const cfg = ConfigModel.get();
  res.json({
    ai: {
      provider: 'perplexity',
      hasKey: !!cfg.perplexityApiKey,
      model: cfg.perplexityModel,
    },
    onetrust: {
      baseUrl: cfg.otBaseUrl,
      hasClientId: !!cfg.otClientId,
      hasClientSecret: !!cfg.otClientSecret,
      parentOrgName: cfg.otParentOrgName,
    },
    admin: {
      email: cfg.adminEmail,
    },
    setupComplete: cfg.setupComplete,
  });
});

// POST /api/settings — generic save (accepts any subset)
router.post('/', authenticate, (req, res) => {
  ConfigModel.save(req.body);
  res.json({ success: true });
});

module.exports = router;
