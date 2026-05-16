const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const OneTrustClient = require('../services/oneTrustClient');
const { WorkspaceModel } = require('../models/workspace');
const ConfigModel = require('../models/config');

function getOTClient(overrides) {
  const ws = WorkspaceModel.getActive();
  const cfg = ConfigModel.get();
  const creds = {
    baseUrl:      overrides?.baseUrl      || ws?.otCredentials?.baseUrl      || cfg.otBaseUrl      || 'https://app.onetrust.com',
    clientId:     overrides?.clientId     || ws?.otCredentials?.clientId     || cfg.otClientId,
    clientSecret: overrides?.clientSecret || ws?.otCredentials?.clientSecret || cfg.otClientSecret,
  };
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error('No OneTrust credentials available. Please connect in the Connection Setup.');
  }
  return new OneTrustClient(creds);
}

// GET /api/onetrust/saved-credentials
router.get('/saved-credentials', authenticate, (req, res) => {
  const cfg = ConfigModel.get();
  res.json({
    baseUrl:       cfg.otBaseUrl || 'https://app.onetrust.com',
    hasClientId:   !!cfg.otClientId,
    clientIdPrefix: cfg.otClientId ? cfg.otClientId.slice(0, 6) + '••••' : '',
    hasClientSecret: !!cfg.otClientSecret,
    parentOrgName: cfg.otParentOrgName || 'Meszaros - Do Not Touch',
    prefilled:     !!(cfg.otClientId && cfg.otClientSecret),
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
    // Real creation — no simulated flag
    res.json({ success: true, org: { ...result, simulated: false } });
  } catch (err) {
    // Graceful fallback — simulated org for demo
    // Frontend MUST display this prominently so operator knows writes won't reach OT
    const simulatedOrg = {
      id: `sim-${Date.now()}`,
      name: orgName,
      parentOrgName: cfg.otParentOrgName || 'Meszaros - Do Not Touch',
      status: 'Active',
      simulated: true,
    };
    console.warn('[OT/create-org] Falling back to simulated org:', err.message);
    res.json({
      success: true,
      org: simulatedOrg,
      simulated: true,
      warning: `OneTrust org creation failed: ${err.message}. Using a simulated org — OneTrust object writes are disabled for this session.`,
    });
  }
});

// GET /api/onetrust/status
router.get('/status', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cfg = ConfigModel.get();
  const hasAnyCreds = !!(ws?.otCredentials?.clientId || cfg.otClientId);

  if (!hasAnyCreds) return res.json({ connected: false, message: 'No OneTrust credentials configured.' });

  if (ws?.simulated) {
    return res.json({
      connected: false,
      simulated: true,
      message: 'Workspace is using a simulated org. OneTrust object creation is disabled.',
      activeOrg: ws?.activeOrgId,
      activeOrgName: ws?.activeOrgName,
    });
  }

  try {
    const client = getOTClient();
    await client.testConnection();
    res.json({
      connected: true,
      baseUrl: cfg.otBaseUrl,
      activeOrg: ws?.activeOrgId,
      activeOrgName: ws?.activeOrgName,
      activeBrand: ws?.activeBrandName,
    });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// GET /api/onetrust/reconcile — compare local workspace objects against live OT
router.get('/reconcile', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  if (!ws) return res.status(400).json({ error: 'No active workspace.' });

  if (ws.simulated) {
    return res.json({
      simulated: true,
      message: 'Workspace is using a simulated org — reconciliation against live OneTrust is not available.',
      local: {
        purposes: ws.purposes?.length || 0,
        dataElements: ws.dataElements?.length || 0,
        collectionPoints: ws.collectionPoints?.length || 0,
      },
    });
  }

  let liveData = { purposes: [], dataElements: [], collectionPoints: [], errors: [] };
  try {
    const client = getOTClient();
    liveData = await client.reconcileOrg(ws.activeOrgId);
  } catch (err) {
    return res.status(502).json({ error: `Could not reach OneTrust: ${err.message}` });
  }

  // Build lookup maps from live OT data (normalize to lowercase for matching)
  const liveById = (arr) => {
    const m = {};
    (arr || []).forEach(obj => { if (obj.id) m[obj.id] = obj; });
    return m;
  };

  const livePurposesById = liveById(liveData.purposes);
  const liveDEsById = liveById(liveData.dataElements);
  const liveCPsById = liveById(liveData.collectionPoints);

  // Reconcile each local object
  const reconcilePurposes = (ws.purposes || []).map(p => ({
    localId: p.id,
    name: p.name,
    createStatus: p.createStatus,
    oneTrustId: p.oneTrustId,
    lastError: p.lastError,
    existsInOT: !!p.oneTrustId && !!livePurposesById[p.oneTrustId],
    liveOTData: p.oneTrustId ? livePurposesById[p.oneTrustId] || null : null,
    reconcileStatus: !p.oneTrustId
      ? 'local-only'
      : livePurposesById[p.oneTrustId]
      ? 'verified'
      : 'id-not-found-in-ot',
  }));

  const reconcileDEs = (ws.dataElements || []).map(d => ({
    localId: d.id,
    name: d.name,
    createStatus: d.createStatus,
    oneTrustId: d.oneTrustId,
    lastError: d.lastError,
    existsInOT: !!d.oneTrustId && !!liveDEsById[d.oneTrustId],
    reconcileStatus: !d.oneTrustId
      ? 'local-only'
      : liveDEsById[d.oneTrustId]
      ? 'verified'
      : 'id-not-found-in-ot',
  }));

  const reconcileCPs = (ws.collectionPoints || []).map(cp => ({
    localId: cp.id,
    name: cp.name,
    createStatus: cp.createStatus,
    oneTrustId: cp.oneTrustId,
    lastError: cp.lastError,
    existsInOT: !!cp.oneTrustId && !!liveCPsById[cp.oneTrustId],
    reconcileStatus: !cp.oneTrustId
      ? 'local-only'
      : liveCPsById[cp.oneTrustId]
      ? 'verified'
      : 'id-not-found-in-ot',
  }));

  // Objects in OT that we don't have locally (unlinked)
  const linkedOTIds = new Set([
    ...(ws.purposes || []).map(p => p.oneTrustId).filter(Boolean),
    ...(ws.dataElements || []).map(d => d.oneTrustId).filter(Boolean),
    ...(ws.collectionPoints || []).map(cp => cp.oneTrustId).filter(Boolean),
  ]);

  const unlinkedOTPurposes = liveData.purposes.filter(p => !linkedOTIds.has(p.id));
  const unlinkedOTDEs = liveData.dataElements.filter(d => !linkedOTIds.has(d.id));
  const unlinkedOTCPs = liveData.collectionPoints.filter(cp => !linkedOTIds.has(cp.id));

  res.json({
    activeOrg: ws.activeOrgId,
    activeOrgName: ws.activeOrgName,
    reconcileErrors: liveData.errors,
    local: {
      purposes: reconcilePurposes,
      dataElements: reconcileDEs,
      collectionPoints: reconcileCPs,
    },
    unlinkedInOT: {
      purposes: unlinkedOTPurposes.map(p => ({ id: p.id, name: p.name || p.purposeName })),
      dataElements: unlinkedOTDEs.map(d => ({ id: d.id, name: d.name })),
      collectionPoints: unlinkedOTCPs.map(cp => ({ id: cp.id, name: cp.name })),
    },
    summary: {
      localPurposes:       (ws.purposes || []).length,
      verifiedPurposes:    reconcilePurposes.filter(p => p.reconcileStatus === 'verified').length,
      localDEs:            (ws.dataElements || []).length,
      verifiedDEs:         reconcileDEs.filter(d => d.reconcileStatus === 'verified').length,
      localCPs:            (ws.collectionPoints || []).length,
      verifiedCPs:         reconcileCPs.filter(cp => cp.reconcileStatus === 'verified').length,
      livePurposesInOT:    liveData.purposes.length,
      liveDEsInOT:         liveData.dataElements.length,
      liveCPsInOT:         liveData.collectionPoints.length,
    },
  });
});

module.exports = router;
