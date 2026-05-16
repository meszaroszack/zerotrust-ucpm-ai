const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { WorkspaceModel } = require('../models/workspace');
const OneTrustClient = require('../services/oneTrustClient');
const { v4: uuidv4 } = require('uuid');

function getClient(ws) {
  if (!ws?.otCredentials?.clientId) throw new Error('No OneTrust credentials in workspace. Please reconnect via the Connection Setup.');
  return new OneTrustClient(ws.otCredentials);
}

function otLog(action, ctx) {
  console.log(`[OT/collectionpoints/${action}]`, JSON.stringify(ctx));
}

// GET /api/collection-points
router.get('/', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  res.json({ collectionPoints: ws?.collectionPoints || [] });
});

// POST /api/collection-points
router.post('/', authenticate, async (req, res) => {
  const { name, label, description, cpType, locale, region, purposeIds, dataElementIds, createInOT, scenarioId } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const ws = WorkspaceModel.getActive();
  const cp = {
    id: uuidv4(),
    name, label, description,
    cpType: cpType || 'standard',
    locale, region, purposeIds, dataElementIds, scenarioId,
    createStatus: 'local',
    oneTrustId: null,
    lastAttemptAt: null,
    lastError: null,
    versions: [],
    createdAt: new Date().toISOString(),
  };

  if (createInOT) {
    cp.createStatus = 'pushing';
    cp.lastAttemptAt = new Date().toISOString();
    otLog('create', { name, orgId: ws?.activeOrgId, simulated: !!ws?.simulated, locale, region });

    if (ws?.simulated) {
      cp.createStatus = 'failed';
      cp.lastError = 'Workspace is using a simulated org — real OneTrust writes are disabled.';
      otLog('create:skipped-simulated', { name });
    } else {
      try {
        const client = getClient(ws);
        const result = await client.createCollectionPoint({
          name,
          label: label || name,
          description,
          purposeIds: purposeIds || [],
          dataElementIds: dataElementIds || [],
          locale: locale || 'en',
          organizationId: ws.activeOrgId,
        });
        const otId = result.id || result.collectionPointId || result.data?.id;
        cp.createStatus = 'created';
        cp.oneTrustId = otId;
        cp.lastError = null;
        otLog('create:success', { name, otId });
        WorkspaceModel.addArtifact({ type: 'collectionPoint', name, otId, region, locale });
        WorkspaceModel.addChange({ action: 'create', objectType: 'collectionPoint', name, otId });
      } catch (err) {
        cp.createStatus = 'failed';
        cp.lastError = err.message;
        otLog('create:failed', { name, error: err.message });
      }
    }
  }

  const current = WorkspaceModel.getActive();
  const cps = [...(current?.collectionPoints || []).filter(c => c.id !== cp.id), cp];
  WorkspaceModel.update({ collectionPoints: cps });
  res.json({ success: true, collectionPoint: cp });
});

// GET /api/collection-points/:id
router.get('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cp = (ws?.collectionPoints || []).find(c => c.id === req.params.id);
  if (!cp) return res.status(404).json({ error: 'Collection point not found' });

  if (cp.oneTrustId && !ws?.simulated) {
    try {
      const client = getClient(ws);
      const otData = await client.getCollectionPoint(cp.oneTrustId);
      return res.json({ collectionPoint: { ...cp, otData } });
    } catch (err) {
      otLog('get:failed', { id: cp.id, otId: cp.oneTrustId, error: err.message });
    }
  }
  res.json({ collectionPoint: cp });
});

// PATCH /api/collection-points/:id
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cps = [...(ws?.collectionPoints || [])];
  const idx = cps.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Collection point not found' });

  const updated = { ...cps[idx], ...req.body, updatedAt: new Date().toISOString() };

  if (req.body.createInOT || req.body.updateInOT) {
    const isCreate = !updated.oneTrustId;
    updated.createStatus = 'pushing';
    updated.lastAttemptAt = new Date().toISOString();
    otLog(isCreate ? 'create' : 'update', { name: updated.name, otId: updated.oneTrustId });

    if (ws?.simulated) {
      updated.createStatus = 'failed';
      updated.lastError = 'Workspace is using a simulated org — real OneTrust writes are disabled.';
    } else {
      try {
        const client = getClient(ws);
        if (isCreate) {
          const result = await client.createCollectionPoint({
            name: updated.name,
            label: updated.label || updated.name,
            description: updated.description,
            purposeIds: updated.purposeIds || [],
            dataElementIds: updated.dataElementIds || [],
            locale: updated.locale || 'en',
            organizationId: ws.activeOrgId,
          });
          const otId = result.id || result.collectionPointId || result.data?.id;
          updated.createStatus = 'created';
          updated.oneTrustId = otId;
          updated.lastError = null;
          otLog('create:success', { name: updated.name, otId });
          WorkspaceModel.addArtifact({ type: 'collectionPoint', name: updated.name, otId });
          WorkspaceModel.addChange({ action: 'create', objectType: 'collectionPoint', name: updated.name, otId });
        } else {
          await client.updateCollectionPoint(updated.oneTrustId, {
            name: updated.name,
            label: updated.label,
            description: updated.description,
          });
          updated.createStatus = 'created';
          updated.lastError = null;
          otLog('update:success', { name: updated.name });
        }
      } catch (err) {
        updated.createStatus = 'failed';
        updated.lastError = err.message;
        otLog('write:failed', { name: updated.name, error: err.message });
      }
    }
  }

  cps[idx] = updated;
  WorkspaceModel.update({ collectionPoints: cps });
  res.json({ success: true, collectionPoint: updated });
});

// POST /api/collection-points/:id/version
router.post('/:id/version', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cps = [...(ws?.collectionPoints || [])];
  const idx = cps.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Collection point not found' });

  const version = { versionId: uuidv4(), notes: req.body.notes, createdAt: new Date().toISOString() };

  if (cps[idx].oneTrustId && !ws?.simulated) {
    try {
      const client = getClient(ws);
      const result = await client.createCollectionPointVersion(cps[idx].oneTrustId, { notes: req.body.notes });
      version.otVersionId = result.id;
      otLog('version:success', { cpName: cps[idx].name, otVersionId: version.otVersionId });
    } catch (err) {
      version.otError = err.message;
      otLog('version:failed', { cpName: cps[idx].name, error: err.message });
    }
  }

  cps[idx].versions = [...(cps[idx].versions || []), version];
  WorkspaceModel.update({ collectionPoints: cps });
  res.json({ success: true, version });
});

// GET /api/collection-points/:id/versions
router.get('/:id/versions', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cp = (ws?.collectionPoints || []).find(c => c.id === req.params.id);
  if (!cp) return res.status(404).json({ error: 'Collection point not found' });
  res.json({ versions: cp.versions || [] });
});

module.exports = router;
