const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || 'admin@zerotrust.ai';
const ADMIN_PASSWORD_HASH = process.env.APP_ADMIN_PASSWORD
  ? bcrypt.hashSync(process.env.APP_ADMIN_PASSWORD, 10)
  : bcrypt.hashSync('ZeroTrust2025!', 10);

const SECRET = process.env.APP_SESSION_SECRET || 'zerotrust-dev-secret';

// POST /api/app/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const emailMatch = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const passMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!emailMatch || !passMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { email, role: 'admin', app: 'zerotrust-ai' },
    SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, email, role: 'admin', expiresIn: 86400 });
});

// GET /api/app/session
router.get('/session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], SECRET);
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

module.exports = router;
