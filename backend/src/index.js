require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? '*' : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/setup', require('./routes/setup'));       // No auth — first-run wizard
app.use('/api/app', require('./routes/auth'));
app.use('/api/onetrust', require('./routes/onetrust'));
app.use('/api/workspace', require('./routes/workspace'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/purposes', require('./routes/purposes'));
app.use('/api/data-elements', require('./routes/dataElements'));
app.use('/api/collection-points', require('./routes/collectionPoints'));
app.use('/api/geolocation', require('./routes/geolocation'));
app.use('/api/settings', require('./routes/settings'));

app.get('/api/health', (req, res) => {
  const ConfigModel = require('./models/config');
  const cfg = ConfigModel.get();
  res.json({
    status: 'ok',
    version: '1.0.0',
    app: 'ZEROTRUST AI',
    configured: cfg.isConfigured,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuild));
  // All non-API routes go to React (React Router handles navigation)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔒 ZEROTRUST AI — running on port ${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
});
