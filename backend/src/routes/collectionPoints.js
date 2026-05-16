const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { WorkspaceModel } = require('../models/workspace');
const OneTrustClient = require('../services/oneTrustClient');
const { v4: uuidv4 } = require('uuid');

function getClient() {
  const ws = WorkspaceModel.getActive();
  if (!ws?.otCredentials) throw new Error('No OneTrust credentials');
  return new OneTrustClient(ws.otCredentials);
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

  const cp = {
    id: uuidv4(), name, label, description, cpType: cpType || 'standard',
    locale, region, purposeIds, dataElementIds, scenarioId,
    status: 'draft', versions: [], createdAt: new Date().toISOString()
  };

  if (createInOT) {
    try {
      const ws = WorkspaceModel.getActive();
      const client = getClient();
      const result = await client.createCollectionPoint({ name, label, description, purposeIds, dataElementIds, locale, orgId: ws?.activeOrgId });
      cp.otId = result.id || result.collectionPointId;
      cp.status = 'created';
      cp.otResponse = result;
      WorkspaceModel.addArtifact({ type: 'collectionPoint', name, otId: cp.otId, region, locale });
      WorkspaceModel.addChange({ action: 'create', objectType: 'collectionPoint', name, otId: cp.otId });
    } catch (err) {
      cp.status = 'draft';
      cp.otError = err.message;
    }
  }

  const ws = WorkspaceModel.getActive();
  const cps = [...(ws?.collectionPoints || []).filter(c => c.id !== cp.id), cp];
  WorkspaceModel.update({ collectionPoints: cps });
  res.json({ success: true, collectionPoint: cp });
});

// GET /api/collection-points/:id
router.get('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cp = (ws?.collectionPoints || []).find(c => c.id === req.params.id);
  if (!cp) return res.status(404).json({ error: 'Collection point not found' });

  if (cp.otId) {
    try {
      const client = getClient();
      const otData = await client.getCollectionPoint(cp.otId);
      return res.json({ collectionPoint: { ...cp, otData } });
    } catch {}
  }
  res.json({ collectionPoint: cp });
});

// PATCH /api/collection-points/:id
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cps = ws?.collectionPoints || [];
  const idx = cps.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Collection point not found' });

  const updated = { ...cps[idx], ...req.body, updatedAt: new Date().toISOString() };
  if (req.body.updateInOT && updated.otId) {
    try {
      const client = getClient();
      await client.updateCollectionPoint(updated.otId, req.body);
      updated.status = 'updated';
      WorkspaceModel.addChange({ action: 'update', objectType: 'collectionPoint', name: updated.name, otId: updated.otId });
    } catch (err) {
      updated.otError = err.message;
    }
  }

  cps[idx] = updated;
  WorkspaceModel.update({ collectionPoints: cps });
  res.json({ success: true, collectionPoint: updated });
});

// POST /api/collection-points/:id/version
router.post('/:id/version', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const cps = ws?.collectionPoints || [];
  const idx = cps.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Collection point not found' });

  const version = { versionId: uuidv4(), notes: req.body.notes, createdAt: new Date().toISOString() };

  if (cps[idx].otId) {
    try {
      const client = getClient();
      const result = await client.createCollectionPointVersion(cps[idx].otId, { notes: req.body.notes });
      version.otVersionId = result.id;
    } catch (err) {
      version.otError = err.message;
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
