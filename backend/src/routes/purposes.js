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
  console.log(`[OT/purposes/${action}]`, JSON.stringify(ctx));
}

// GET /api/purposes
router.get('/', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  res.json({ purposes: ws?.purposes || [] });
});

// POST /api/purposes — create locally and optionally push to OT
router.post('/', authenticate, async (req, res) => {
  const { name, description, legalBasis, regions, confidenceScore, reasoning, humanReviewRequired, createInOT } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const ws = WorkspaceModel.getActive();
  const purpose = {
    id: uuidv4(),
    name, description, legalBasis, regions,
    confidenceScore, reasoning, humanReviewRequired,
    // Execution state fields
    createStatus: 'local',   // local | pushing | created | failed
    oneTrustId: null,
    lastAttemptAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  if (createInOT) {
    purpose.createStatus = 'pushing';
    purpose.lastAttemptAt = new Date().toISOString();
    otLog('create', { name, orgId: ws?.activeOrgId, simulated: !!ws?.simulated });

    if (ws?.simulated) {
      purpose.createStatus = 'failed';
      purpose.lastError = 'Workspace is using a simulated org — real OneTrust writes are disabled.';
      otLog('create:skipped-simulated', { name });
    } else {
      try {
        const client = getClient(ws);
        const result = await client.createPurpose({
          name,
          description,
          legalBasis,
          organizationId: ws.activeOrgId,
        });
        const otId = result.id || result.purposeId || result.data?.id;
        purpose.createStatus = 'created';
        purpose.oneTrustId = otId;
        purpose.otResponse = { id: otId, status: result.status };
        otLog('create:success', { name, otId });
        WorkspaceModel.addArtifact({ type: 'purpose', name, otId });
        WorkspaceModel.addChange({ action: 'create', objectType: 'purpose', name, otId });
      } catch (err) {
        purpose.createStatus = 'failed';
        purpose.lastError = err.message;
        otLog('create:failed', { name, error: err.message, otBody: err.otBody });
      }
    }
  }

  // Persist — merge into existing array, replace any pre-existing local-only copy with same name
  const current = WorkspaceModel.getActive();
  const purposes = [...(current?.purposes || []).filter(p => p.id !== purpose.id), purpose];
  WorkspaceModel.update({ purposes });
  res.json({ success: true, purpose });
});

// PATCH /api/purposes/:id — update locally and optionally push to OT
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const purposes = [...(ws?.purposes || [])];
  const idx = purposes.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purpose not found' });

  const updated = { ...purposes[idx], ...req.body, updatedAt: new Date().toISOString() };

  if (req.body.createInOT || req.body.updateInOT) {
    const isCreate = !updated.oneTrustId;
    updated.createStatus = 'pushing';
    updated.lastAttemptAt = new Date().toISOString();
    otLog(isCreate ? 'create' : 'update', { name: updated.name, otId: updated.oneTrustId, orgId: ws?.activeOrgId });

    if (ws?.simulated) {
      updated.createStatus = 'failed';
      updated.lastError = 'Workspace is using a simulated org — real OneTrust writes are disabled.';
    } else {
      try {
        const client = getClient(ws);
        if (isCreate) {
          const result = await client.createPurpose({
            name: updated.name,
            description: updated.description,
            legalBasis: updated.legalBasis,
            organizationId: ws.activeOrgId,
          });
          const otId = result.id || result.purposeId || result.data?.id;
          updated.createStatus = 'created';
          updated.oneTrustId = otId;
          updated.lastError = null;
          otLog('create:success', { name: updated.name, otId });
          WorkspaceModel.addArtifact({ type: 'purpose', name: updated.name, otId });
          WorkspaceModel.addChange({ action: 'create', objectType: 'purpose', name: updated.name, otId });
        } else {
          await client.updatePurpose(updated.oneTrustId, {
            name: updated.name,
            description: updated.description,
            legalBasis: updated.legalBasis,
          });
          updated.createStatus = 'created';
          updated.lastError = null;
          otLog('update:success', { name: updated.name, otId: updated.oneTrustId });
          WorkspaceModel.addChange({ action: 'update', objectType: 'purpose', name: updated.name, otId: updated.oneTrustId });
        }
      } catch (err) {
        updated.createStatus = 'failed';
        updated.lastError = err.message;
        otLog('write:failed', { name: updated.name, error: err.message });
      }
    }
  }

  purposes[idx] = updated;
  WorkspaceModel.update({ purposes });
  res.json({ success: true, purpose: updated });
});

module.exports = router;
