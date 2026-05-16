/**
 * Config Model — persists all app configuration to disk.
 * This is how lawyers set up the app — no env vars, no terminals.
 * All credentials entered through the UI are saved here.
 */
const fs = require('fs');
const path = require('path');

const VALID_MODELS = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'r1-1776'];

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return null; }
}

function write(data) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

const ConfigModel = {
  get() {
    const stored = read();
    // Merge with any env vars (env takes precedence for security in Railway)
    return {
      isConfigured: !!(stored?.perplexityApiKey || process.env.PERPLEXITY_API_KEY),
      hasAdminPassword: !!(stored?.adminPassword || process.env.APP_ADMIN_PASSWORD),
      // AI
      perplexityApiKey: process.env.PERPLEXITY_API_KEY || stored?.perplexityApiKey || '',
      perplexityModel: process.env.PERPLEXITY_MODEL || (VALID_MODELS.includes(stored?.perplexityModel) ? stored.perplexityModel : 'sonar'),
      // OT defaults (can also be set per-session via connection wizard)
      otBaseUrl: process.env.ONETRUST_BASE_URL || stored?.otBaseUrl || 'https://app.onetrust.com',
      otClientId: process.env.ONETRUST_CLIENT_ID || stored?.otClientId || '',
      otClientSecret: process.env.ONETRUST_CLIENT_SECRET || stored?.otClientSecret || '',
      otParentOrgName: process.env.ONETRUST_PARENT_ORG_NAME || stored?.otParentOrgName || 'Meszaros - Do Not Touch',
      // Admin
      adminEmail: process.env.APP_ADMIN_EMAIL || stored?.adminEmail || '',
      adminPassword: process.env.APP_ADMIN_PASSWORD || stored?.adminPassword || '',
      sessionSecret: process.env.APP_SESSION_SECRET || stored?.sessionSecret || 'zerotrust-default-secret-change-me',
      // Setup status
      setupComplete: stored?.setupComplete || false,
      setupCompletedAt: stored?.setupCompletedAt || null,
    };
  },

  save(updates) {
    const current = read() || {};
    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
    write(merged);
    return merged;
  },

  markSetupComplete() {
    const current = read() || {};
    write({ ...current, setupComplete: true, setupCompletedAt: new Date().toISOString() });
  },

  isFirstRun() {
    const cfg = this.get();
    // First run if no AI key AND no env var
    return !cfg.perplexityApiKey && !cfg.adminPassword && !cfg.setupComplete;
  }
};

module.exports = ConfigModel;
