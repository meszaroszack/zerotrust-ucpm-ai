const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const OneTrustClient = require('../services/oneTrustClient');
const { WorkspaceModel } = require('../models/workspace');

function getOTClient(credentials) {
  const ws = WorkspaceModel.getActive();
  const creds = credentials || ws?.otCredentials;
  if (!creds) throw new Error('No OneTrust credentials available. Connect first.');
  return new OneTrustClient(creds);
}

// POST /api/onetrust/test-connection
router.post('/test-connection', authenticate, async (req, res) => {
  const { baseUrl, clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
  try {
    const client = new OneTrustClient({ baseUrl, clientId, clientSecret });
    const result = await client.testConnection();
    res.json({ connected: true, message: 'Connection successful', data: result });
  } catch (err) {
    res.status(400).json({ connected: false, error: err.message });
  }
});

// POST /api/onetrust/create-org
router.post('/create-org', authenticate, async (req, res) => {
  const { baseUrl, clientId, clientSecret, orgName, parentOrgId } = req.body;
  if (!orgName) return res.status(400).json({ error: 'orgName required' });
  try {
    const client = new OneTrustClient({ baseUrl, clientId, clientSecret });
    const result = await client.createOrganization({
      name: orgName,
      parentOrgId: parentOrgId || process.env.ONETRUST_PARENT_ORG_ID || null
    });
    res.json({ success: true, org: result });
  } catch (err) {
    // Return simulated response for demo/testing when real API fails
    const simulatedOrg = {
      id: `sim-${Date.now()}`,
      name: orgName,
      parentOrgName: process.env.ONETRUST_PARENT_ORG_NAME || 'Meszaros - Do Not Touch',
      status: 'Active',
      simulated: true,
      warning: `OneTrust org creation returned an error: ${err.message}. Using simulated org for demo.`
    };
    res.json({ success: true, org: simulatedOrg, warning: simulatedOrg.warning });
  }
});

// GET /api/onetrust/status
router.get('/status', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  if (!ws?.otCredentials) return res.json({ connected: false, message: 'No credentials stored' });
  try {
    const client = new OneTrustClient(ws.otCredentials);
    await client.testConnection();
    res.json({ connected: true, baseUrl: ws.otCredentials.baseUrl, activeOrg: ws.activeOrgId });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// GET /api/onetrust/organizations
router.get('/organizations', authenticate, async (req, res) => {
  try {
    const client = getOTClient();
    const result = await client.listOrganizations();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
