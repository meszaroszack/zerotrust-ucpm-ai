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
  console.log(`[OT/dataelements/${action}]`, JSON.stringify(ctx));
}

// GET /api/data-elements
router.get('/', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  res.json({ dataElements: ws?.dataElements || [] });
});

// POST /api/data-elements
router.post('/', authenticate, async (req, res) => {
  const { name, description, category, sensitive, linkedPurposes, confidenceScore, reasoning, humanReviewRequired, createInOT } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const ws = WorkspaceModel.getActive();
  const element = {
    id: uuidv4(),
    name, description, category, sensitive, linkedPurposes,
    confidenceScore, reasoning, humanReviewRequired,
    createStatus: 'local',
    oneTrustId: null,
    lastAttemptAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  if (createInOT) {
    element.createStatus = 'pushing';
    element.lastAttemptAt = new Date().toISOString();
    otLog('create', { name, orgId: ws?.activeOrgId, simulated: !!ws?.simulated });

    if (ws?.simulated) {
      element.createStatus = 'failed';
      element.lastError = 'Workspace is using a simulated org — real OneTrust writes are disabled.';
      otLog('create:skipped-simulated', { name });
    } else {
      try {
        const client = getClient(ws);
        const result = await client.createDataElement({
          name,
          description,
          category,
          sensitive,
          organizationId: ws.activeOrgId,
        });
        const otId = result.id || result.dataElementId || result.data?.id;
        element.createStatus = 'created';
        element.oneTrustId = otId;
        element.lastError = null;
        otLog('create:success', { name, otId });
        WorkspaceModel.addArtifact({ type: 'dataElement', name, otId });
        WorkspaceModel.addChange({ action: 'create', objectType: 'dataElement', name, otId });
      } catch (err) {
        element.createStatus = 'failed';
        element.lastError = err.message;
        otLog('create:failed', { name, error: err.message });
      }
    }
  }

  const current = WorkspaceModel.getActive();
  const dataElements = [...(current?.dataElements || []).filter(d => d.id !== element.id), element];
  WorkspaceModel.update({ dataElements });
  res.json({ success: true, dataElement: element });
});

// PATCH /api/data-elements/:id
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const elements = [...(ws?.dataElements || [])];
  const idx = elements.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Data element not found' });

  const updated = { ...elements[idx], ...req.body, updatedAt: new Date().toISOString() };

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
          const result = await client.createDataElement({
            name: updated.name,
            description: updated.description,
            category: updated.category,
            sensitive: updated.sensitive,
            organizationId: ws.activeOrgId,
          });
          const otId = result.id || result.dataElementId || result.data?.id;
          updated.createStatus = 'created';
          updated.oneTrustId = otId;
          updated.lastError = null;
          otLog('create:success', { name: updated.name, otId });
          WorkspaceModel.addArtifact({ type: 'dataElement', name: updated.name, otId });
          WorkspaceModel.addChange({ action: 'create', objectType: 'dataElement', name: updated.name, otId });
        } else {
          await client.updateDataElement(updated.oneTrustId, { name: updated.name, description: updated.description });
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

  elements[idx] = updated;
  WorkspaceModel.update({ dataElements: elements });
  res.json({ success: true, dataElement: updated });
});

module.exports = router;
