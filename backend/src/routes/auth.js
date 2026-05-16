const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const ConfigModel = require('../models/config');

// POST /api/app/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const cfg = ConfigModel.get();
  const secret = cfg.sessionSecret || 'zerotrust-default-secret';

  // Match email (case-insensitive)
  const emailMatch = email.toLowerCase() === (cfg.adminEmail || '').toLowerCase();

  // Match password — stored as plain in config (bcrypt on compare)
  let passMatch = false;
  if (cfg.adminPassword) {
    // Try plain comparison first (UI-set), then bcrypt
    passMatch = password === cfg.adminPassword || await bcrypt.compare(password, cfg.adminPassword).catch(() => false);
  }

  if (!emailMatch || !passMatch) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = jwt.sign(
    { email, role: 'admin', app: 'zerotrust-ai' },
    secret,
    { expiresIn: '24h' }
  );

  res.json({ token, email, role: 'admin', expiresIn: 86400 });
});

// GET /api/app/session
router.get('/session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  const cfg = ConfigModel.get();
  const secret = cfg.sessionSecret || 'zerotrust-default-secret';
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], secret);
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false, error: 'Session expired. Please sign in again.' });
  }
});

module.exports = router;
