const axios = require('axios');

class OneTrustClient {
  constructor({ baseUrl, clientId, clientSecret, accessToken }) {
    this.baseUrl = (baseUrl || 'https://app.onetrust.com').replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this._accessToken = accessToken || null;
  }

  async getToken() {
    if (this._accessToken) return this._accessToken;
    const resp = await axios.post(`${this.baseUrl}/api/access/v1/oauth/token`, null, {
      params: { grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret }
    });
    this._accessToken = resp.data.access_token;
    return this._accessToken;
  }

  async request(method, path, data, params) {
    const token = await this.getToken();
    try {
      const resp = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        data,
        params
      });
      return resp.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`OneTrust API error [${err.response?.status}]: ${msg}`);
    }
  }

  // Connection test
  async testConnection() {
    return await this.request('GET', '/api/v2/Organizations');
  }

  // Org / Tenant Management
  async listOrganizations() {
    return await this.request('GET', '/api/v2/Organizations');
  }

  async createOrganization({ name, parentOrgId }) {
    return await this.request('POST', '/api/v2/Organizations', { name, parentOrgId, active: true });
  }

  async getOrganization(orgId) {
    return await this.request('GET', `/api/v2/Organizations/${orgId}`);
  }

  // Purposes
  async getPurposes(orgId) {
    return await this.request('GET', '/api/v2/Purposes', null, { orgId });
  }

  async createPurpose({ name, description, legalBasis, orgId }) {
    return await this.request('POST', '/api/v2/Purposes', { name, description, legalBasis, orgId });
  }

  async updatePurpose(purposeId, updates) {
    return await this.request('PATCH', `/api/v2/Purposes/${purposeId}`, updates);
  }

  // Data Elements
  async getDataElements(orgId) {
    return await this.request('GET', '/api/v2/DataElements', null, { orgId });
  }

  async createDataElement({ name, description, category, sensitive, orgId }) {
    return await this.request('POST', '/api/v2/DataElements', { name, description, category, sensitive, orgId });
  }

  async updateDataElement(elementId, updates) {
    return await this.request('PATCH', `/api/v2/DataElements/${elementId}`, updates);
  }

  // Collection Points
  async getCollectionPoints(orgId) {
    return await this.request('GET', '/api/v2/CollectionPoints', null, { orgId });
  }

  async createCollectionPoint({ name, label, description, purposeIds, dataElementIds, locale, geoRuleGroupId, orgId }) {
    return await this.request('POST', '/api/v2/CollectionPoints', {
      name, label, description, purposeIds, dataElementIds, locale, geoRuleGroupId, orgId, status: 'Active'
    });
  }

  async getCollectionPoint(cpId) {
    return await this.request('GET', `/api/v2/CollectionPoints/${cpId}`);
  }

  async updateCollectionPoint(cpId, updates) {
    return await this.request('PATCH', `/api/v2/CollectionPoints/${cpId}`, updates);
  }

  async createCollectionPointVersion(cpId, { notes }) {
    return await this.request('POST', `/api/v2/CollectionPoints/${cpId}/Versions`, { notes });
  }

  async getCollectionPointVersions(cpId) {
    return await this.request('GET', `/api/v2/CollectionPoints/${cpId}/Versions`);
  }

  // Geolocation Rule Groups
  async getGeoRuleGroups() {
    return await this.request('GET', '/api/v2/Geolocation/RuleGroups');
  }

  async assignGeoRuleGroup(ruleGroupId, { collectionPointId }) {
    return await this.request('PUT', `/api/v2/Geolocation/RuleGroups/${ruleGroupId}/assign`, { collectionPointId });
  }
}

module.exports = OneTrustClient;
