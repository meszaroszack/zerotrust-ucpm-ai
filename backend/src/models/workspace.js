const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, defaultVal = null) {
  ensureDataDir();
  if (!fs.existsSync(file)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; }
}

function writeJSON(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const WorkspaceModel = {
  getActive() {
    return readJSON(WORKSPACE_FILE, null);
  },

  create({ activeOrgId, activeOrgName, activeBrandName, otCredentials }) {
    const ws = {
      id: uuidv4(),
      parentOrgName: process.env.ONETRUST_PARENT_ORG_NAME || 'Meszaros - Do Not Touch',
      activeOrgId,
      activeOrgName,
      activeBrandName,
      status: 'active',
      createdAt: new Date().toISOString(),
      otCredentials,
      sourceInputs: [],
      scenarios: [],
      purposes: [],
      dataElements: [],
      collectionPoints: [],
      changeHistory: [],
      aiReasoningHistory: [],
      createdArtifacts: []
    };
    writeJSON(WORKSPACE_FILE, ws);
    return ws;
  },

  update(updates) {
    const ws = this.getActive();
    if (!ws) return null;
    const updated = { ...ws, ...updates, updatedAt: new Date().toISOString() };
    writeJSON(WORKSPACE_FILE, updated);
    return updated;
  },

  addChange(entry) {
    const ws = this.getActive();
    if (!ws) return;
    ws.changeHistory = [
      { ...entry, id: uuidv4(), timestamp: new Date().toISOString() },
      ...(ws.changeHistory || [])
    ];
    writeJSON(WORKSPACE_FILE, ws);
  },

  addAIReason(entry) {
    const ws = this.getActive();
    if (!ws) return;
    ws.aiReasoningHistory = [
      { ...entry, id: uuidv4(), timestamp: new Date().toISOString() },
      ...(ws.aiReasoningHistory || [])
    ];
    writeJSON(WORKSPACE_FILE, ws);
  },

  addArtifact(artifact) {
    const ws = this.getActive();
    if (!ws) return;
    ws.createdArtifacts = [...(ws.createdArtifacts || []), { ...artifact, id: uuidv4(), createdAt: new Date().toISOString() }];
    writeJSON(WORKSPACE_FILE, ws);
  },

  reset() {
    const ws = this.getActive();
    if (ws) {
      const history = readJSON(HISTORY_FILE, []);
      history.unshift({ ...ws, resetAt: new Date().toISOString() });
      writeJSON(HISTORY_FILE, history.slice(0, 20));
    }
    if (fs.existsSync(WORKSPACE_FILE)) fs.unlinkSync(WORKSPACE_FILE);
    return true;
  },

  getHistory() {
    return readJSON(HISTORY_FILE, []);
  }
};

const SettingsModel = {
  get() {
    return readJSON(SETTINGS_FILE, {
      aiProviders: {
        perplexity: { enabled: true, model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online', apiKey: '' },
        openai: { enabled: false, model: 'gpt-4o', apiKey: '' },
        anthropic: { enabled: false, model: 'claude-3-5-sonnet-20241022', apiKey: '' },
        gemini: { enabled: false, model: 'gemini-1.5-pro', apiKey: '' },
        azureOpenAI: { enabled: false, model: '', apiKey: '', endpoint: '' },
        bedrock: { enabled: false, model: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' }
      }
    });
  },
  save(settings) {
    writeJSON(SETTINGS_FILE, settings);
    return settings;
  }
};

module.exports = { WorkspaceModel, SettingsModel };
