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

// GET /api/data-elements
router.get('/', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  res.json({ dataElements: ws?.dataElements || [] });
});

// POST /api/data-elements
router.post('/', authenticate, async (req, res) => {
  const { name, description, category, sensitive, linkedPurposes, createInOT } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const element = { id: uuidv4(), name, description, category, sensitive, linkedPurposes, status: 'draft', createdAt: new Date().toISOString() };

  if (createInOT) {
    try {
      const ws = WorkspaceModel.getActive();
      const client = getClient();
      const result = await client.createDataElement({ name, description, category, sensitive, orgId: ws?.activeOrgId });
      element.otId = result.id;
      element.status = 'created';
      WorkspaceModel.addArtifact({ type: 'dataElement', name, otId: element.otId });
      WorkspaceModel.addChange({ action: 'create', objectType: 'dataElement', name, otId: element.otId });
    } catch (err) {
      element.status = 'draft';
      element.otError = err.message;
    }
  }

  const ws = WorkspaceModel.getActive();
  const dataElements = [...(ws?.dataElements || []).filter(d => d.id !== element.id), element];
  WorkspaceModel.update({ dataElements });
  res.json({ success: true, dataElement: element });
});

// PATCH /api/data-elements/:id
router.patch('/:id', authenticate, async (req, res) => {
  const ws = WorkspaceModel.getActive();
  const elements = ws?.dataElements || [];
  const idx = elements.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Data element not found' });

  const updated = { ...elements[idx], ...req.body, updatedAt: new Date().toISOString() };
  if (req.body.updateInOT && updated.otId) {
    try {
      const client = getClient();
      await client.updateDataElement(updated.otId, req.body);
      updated.status = 'updated';
      WorkspaceModel.addChange({ action: 'update', objectType: 'dataElement', name: updated.name, otId: updated.otId });
    } catch (err) {
      updated.otError = err.message;
    }
  }

  elements[idx] = updated;
  WorkspaceModel.update({ dataElements: elements });
  res.json({ success: true, dataElement: updated });
});

module.exports = router;
