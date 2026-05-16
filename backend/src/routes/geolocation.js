const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { WorkspaceModel } = require('../models/workspace');
const OneTrustClient = require('../services/oneTrustClient');

function getClient() {
  const ws = WorkspaceModel.getActive();
  if (!ws?.otCredentials) throw new Error('No OneTrust credentials');
  return new OneTrustClient(ws.otCredentials);
}

// GET /api/geolocation/rule-groups
router.get('/rule-groups', authenticate, async (req, res) => {
  try {
    const client = getClient();
    const result = await client.getGeoRuleGroups();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/geolocation/rule-groups/:id/assign
router.put('/rule-groups/:id/assign', authenticate, async (req, res) => {
  const { collectionPointId } = req.body;
  try {
    const client = getClient();
    const result = await client.assignGeoRuleGroup(req.params.id, { collectionPointId });
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/geolocation/preview
router.get('/preview', authenticate, (req, res) => {
  const { countryCode, stateCode, regionCode, lang, otgeo } = req.query;
  const ws = WorkspaceModel.getActive();
  const scenarios = ws?.scenarios || [];

  // Match scenario based on params
  let matched = null;
  if (countryCode === 'DE') matched = scenarios.find(s => s.countryCode === 'DE' || s.country === 'Germany');
  else if (countryCode === 'GB') matched = scenarios.find(s => s.countryCode === 'GB' || s.country === 'United Kingdom');
  else if (countryCode === 'CA' && !stateCode) matched = scenarios.find(s => s.countryCode === 'CA' && s.country === 'Canada');
  else if (countryCode === 'US' && stateCode === 'CA') matched = scenarios.find(s => s.stateCode === 'CA' || s.state === 'California');
  else matched = scenarios.find(s => s.name?.toLowerCase().includes('global') || s.name?.toLowerCase().includes('fallback'));

  const cp = matched
    ? (ws?.collectionPoints || []).find(c => c.scenarioId === matched.id || c.region === matched.region)
    : null;

  res.json({
    params: { countryCode, stateCode, regionCode, lang, otgeo },
    matchedScenario: matched || null,
    linkedCollectionPoint: cp || null,
    consentModel: matched?.consentPosture || 'notice-only',
    testUrl: buildTestUrl(req.query),
    previewNote: 'This is a simulated geolocation preview for internal testing.'
  });
});

function buildTestUrl(params) {
  const base = process.env.PUBLIC_URL || 'http://localhost:3000';
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  return `${base}/test-harness?${qs}`;
}

module.exports = router;
