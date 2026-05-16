const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { WorkspaceModel } = require('../models/workspace');

// POST /api/workspace/start
router.post('/start', authenticate, async (req, res) => {
  const { activeOrgId, activeOrgName, activeBrandName, otCredentials, simulated } = req.body;
  if (!activeOrgName || !activeBrandName) {
    return res.status(400).json({ error: 'activeOrgName and activeBrandName are required' });
  }
  try {
    const ws = WorkspaceModel.create({ activeOrgId, activeOrgName, activeBrandName, otCredentials, simulated });
    res.json({ success: true, workspace: ws });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspace/active
router.get('/active', authenticate, (req, res) => {
  const ws = WorkspaceModel.getActive();
  if (!ws) return res.json({ active: false, workspace: null });
  res.json({ active: true, workspace: ws });
});

// POST /api/workspace/reset
router.post('/reset', authenticate, (req, res) => {
  WorkspaceModel.reset();
  res.json({ success: true, message: 'Workspace reset. Prior OneTrust artifacts preserved.' });
});

// GET /api/workspace/history
router.get('/history', authenticate, (req, res) => {
  const history = WorkspaceModel.getHistory();
  res.json({ history });
});

// PATCH /api/workspace/active
router.patch('/active', authenticate, (req, res) => {
  const ws = WorkspaceModel.update(req.body);
  if (!ws) return res.status(404).json({ error: 'No active workspace' });
  res.json({ success: true, workspace: ws });
});

// POST /api/workspace/active/change
router.post('/active/change', authenticate, (req, res) => {
  WorkspaceModel.addChange(req.body);
  res.json({ success: true });
});

// POST /api/workspace/active/artifact
router.post('/active/artifact', authenticate, (req, res) => {
  WorkspaceModel.addArtifact(req.body);
  res.json({ success: true });
});

module.exports = router;
