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

// GET /api/purposes
router.get('/', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  res.json({ purposes: ws?.purposes || [] });
});

// POST /api/purposes
router.post('/', authenticate, async (req, res) => {
  const { name, description, legalBasis, regions, createInOT } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const purpose = { id: uuidv4(), name, description, legalBasis, regions, status: 'draft', createdAt: new Date().toISOString() };

  if (createInOT) {
    try {
      const ws = WorkspaceModel.getActive();
      const client = getClient();
      const result = await client.createPurpose({ name, description, legalBasis, orgId: ws?.activeOrgId });
      purpose.otId = result.id || result.purposeId;
      purpose.status = 'created';
      purpose.otResponse = result;
      WorkspaceModel.addArtifact({ type: 'purpose', name, otId: purpose.otId });
      WorkspaceModel.addChange({ action: 'create', objectType: 'purpose', name, otId: purpose.otId });
    } catch (err) {
      purpose.status = 'draft';
      purpose.otError = err.message;
    }
  }

  const ws = WorkspaceModel.getActive();
  const purposes = [...(ws?.purposes || []).filter(p => p.id !== purpose.id), purpose];
  WorkspaceModel.update({ purposes });
  res.json({ success: true, purpose });
});

// PATCH /api/purposes/:id
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const purposes = ws?.purposes || [];
  const idx = purposes.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purpose not found' });

  const updated = { ...purposes[idx], ...req.body, updatedAt: new Date().toISOString() };
  if (req.body.updateInOT && updated.otId) {
    try {
      const client = getClient();
      await client.updatePurpose(updated.otId, req.body);
      updated.status = 'updated';
      WorkspaceModel.addChange({ action: 'update', objectType: 'purpose', name: updated.name, otId: updated.otId });
    } catch (err) {
      updated.otError = err.message;
    }
  }

  purposes[idx] = updated;
  WorkspaceModel.update({ purposes });
  res.json({ success: true, purpose: updated });
});

module.exports = router;
