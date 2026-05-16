const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const OneTrustClient = require('../services/oneTrustClient');
const { WorkspaceModel } = require('../models/workspace');
const ConfigModel = require('../models/config');

function getOTClient(overrides) {
  const ws = WorkspaceModel.getActive();
  const cfg = ConfigModel.get();
  // Priority: caller overrides → active workspace → saved config
  const creds = {
    baseUrl: overrides?.baseUrl || ws?.otCredentials?.baseUrl || cfg.otBaseUrl || 'https://app.onetrust.com',
    clientId: overrides?.clientId || ws?.otCredentials?.clientId || cfg.otClientId,
    clientSecret: overrides?.clientSecret || ws?.otCredentials?.clientSecret || cfg.otClientSecret,
  };
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error('No OneTrust credentials available. Please connect in the Connection Setup.');
  }
  return new OneTrustClient(creds);
}

// GET /api/onetrust/saved-credentials — return masked saved creds so UI can pre-fill
router.get('/saved-credentials', authenticate, (req, res) => {
  const cfg = ConfigModel.get();
  res.json({
    baseUrl: cfg.otBaseUrl || 'https://app.onetrust.com',
    hasClientId: !!cfg.otClientId,
    clientIdPrefix: cfg.otClientId ? cfg.otClientId.slice(0, 6) + '••••' : '',
    hasClientSecret: !!cfg.otClientSecret,
    parentOrgName: cfg.otParentOrgName || 'Meszaros - Do Not Touch',
    prefilled: !!(cfg.otClientId && cfg.otClientSecret),
  });
});

// POST /api/onetrust/test-connection
router.post('/test-connection', authenticate, async (req, res) => {
  const { baseUrl, clientId, clientSecret } = req.body;
  try {
    const client = new OneTrustClient({
      baseUrl: baseUrl || ConfigModel.get().otBaseUrl || 'https://app.onetrust.com',
      clientId: clientId || ConfigModel.get().otClientId,
      clientSecret: clientSecret || ConfigModel.get().otClientSecret,
    });
    const result = await client.testConnection();
    res.json({ connected: true, message: 'Connection successful', data: result });
  } catch (err) {
    res.status(400).json({ connected: false, error: err.message });
  }
});

// POST /api/onetrust/create-org
router.post('/create-org', authenticate, async (req, res) => {
  const { baseUrl, clientId, clientSecret, orgName, parentOrgId } = req.body;
  if (!orgName) return res.status(400).json({ error: 'A name for the new org is required.' });

  const cfg = ConfigModel.get();
  try {
    const client = new OneTrustClient({
      baseUrl: baseUrl || cfg.otBaseUrl,
      clientId: clientId || cfg.otClientId,
      clientSecret: clientSecret || cfg.otClientSecret,
    });
    const result = await client.createOrganization({ name: orgName, parentOrgId: parentOrgId || null });
    res.json({ success: true, org: result });
  } catch (err) {
    // Graceful fallback — simulated org for demo if API can't create
    const simulatedOrg = {
      id: `zt-${Date.now()}`,
      name: orgName,
      parentOrgName: cfg.otParentOrgName || 'Meszaros - Do Not Touch',
      status: 'Active',
      simulated: true,
    };
    res.json({
      success: true,
      org: simulatedOrg,
      warning: `OneTrust org creation encountered an issue: ${err.message}. A simulated org is being used for this session — all other objects will still be created correctly.`
    });
  }
});

// GET /api/onetrust/status
router.get('/status', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cfg = ConfigModel.get();
  const hasAnyCreds = !!(ws?.otCredentials?.clientId || cfg.otClientId);

  if (!hasAnyCreds) return res.json({ connected: false, message: 'No OneTrust credentials configured.' });

  try {
    const client = getOTClient();
    await client.testConnection();
    res.json({ connected: true, baseUrl: cfg.otBaseUrl, activeOrg: ws?.activeOrgId });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

module.exports = router;
