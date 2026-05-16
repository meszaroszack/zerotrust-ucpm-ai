import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// Attach token from store on each request
api.interceptors.request.use((config) => {
  const stored = JSON.parse(localStorage.getItem('zerotrust-app') || '{}');
  const token = stored?.state?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('zerotrust-app');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) => api.post('/app/login', { email, password });
export const getSession = () => api.get('/app/session');

// OneTrust
export const testOTConnection = (creds) => api.post('/onetrust/test-connection', creds);
export const createOTOrg = (data) => api.post('/onetrust/create-org', data);
export const getOTStatus = () => api.get('/onetrust/status');

// Workspace
export const startWorkspace = (data) => api.post('/workspace/start', data);
export const getWorkspace = () => api.get('/workspace/active');
export const resetWorkspace = () => api.post('/workspace/reset');
export const getWorkspaceHistory = () => api.get('/workspace/history');
export const updateWorkspace = (data) => api.patch('/workspace/active', data);

// Documents
export const uploadDocument = (formData) => api.post('/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// AI
export const aiIntakeDocument = (data) => api.post('/ai/intake-document', data);
export const aiExtractProgram = (data) => api.post('/ai/extract-program', data);
export const aiAskFollowups = (data) => api.post('/ai/ask-followups', data);
export const aiGenerateScenarios = (data) => api.post('/ai/generate-scenarios', data);
export const aiRecommendPurposes = (data) => api.post('/ai/recommend-purposes', data);
export const aiRecommendDataElements = (data) => api.post('/ai/recommend-data-elements', data);
export const aiRecommendCollectionPoints = (data) => api.post('/ai/recommend-collection-points', data);
export const aiProposeUpdate = (data) => api.post('/ai/propose-update', data);
export const aiExplainPlan = (data) => api.post('/ai/explain-plan', data);
export const aiTranslateContent = (data) => api.post('/ai/translate-content', data);

// Purposes
export const getPurposes = () => api.get('/purposes');
export const createPurpose = (data) => api.post('/purposes', data);
export const updatePurpose = (id, data) => api.patch(`/purposes/${id}`, data);

// Data Elements
export const getDataElements = () => api.get('/data-elements');
export const createDataElement = (data) => api.post('/data-elements', data);
export const updateDataElement = (id, data) => api.patch(`/data-elements/${id}`, data);

// Collection Points
export const getCollectionPoints = () => api.get('/collection-points');
export const createCollectionPoint = (data) => api.post('/collection-points', data);
export const getCollectionPoint = (id) => api.get(`/collection-points/${id}`);
export const updateCollectionPoint = (id, data) => api.patch(`/collection-points/${id}`, data);
export const createCPVersion = (id, data) => api.post(`/collection-points/${id}/version`, data);
export const getCPVersions = (id) => api.get(`/collection-points/${id}/versions`);

// Geolocation
export const getGeoRuleGroups = () => api.get('/geolocation/rule-groups');
export const getGeoPreview = (params) => api.get('/geolocation/preview', { params });

// Settings
export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.post('/settings', data);

export default api;
