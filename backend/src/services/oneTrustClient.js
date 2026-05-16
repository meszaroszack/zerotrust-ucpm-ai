/**
 * OneTrust REST API Client
 *
 * Paths follow OneTrust's Consent & Preference Management (UCPM) API.
 * Reference: https://developer.onetrust.com/onetrust/reference
 *
 * Token endpoint: POST /api/access/v1/oauth/token
 * Consent/Preference objects live under: /api/consent/v2/...
 *   - Purposes:          /api/consent/v2/purposes
 *   - DataElements:      /api/consent/v2/dataelements
 *   - Collection Points: /api/consent/v2/collectionpoints
 *   - Geo Rule Groups:   /api/consent/v2/geolocation/rulegroups
 * Organization management: /api/organizations/v2/...
 */

const axios = require('axios');

class OneTrustClient {
  constructor({ baseUrl, clientId, clientSecret, accessToken }) {
    this.baseUrl = (baseUrl || 'https://app.onetrust.com').replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this._accessToken = accessToken || null;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async getToken() {
    if (this._accessToken) return this._accessToken;
    const resp = await axios.post(
      `${this.baseUrl}/api/access/v1/oauth/token`,
      null,
      { params: { grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret } }
    );
    this._accessToken = resp.data.access_token;
    return this._accessToken;
  }

  // ── Core request with structured logging ─────────────────────────────────
  async request(method, path, data, params) {
    const token = await this.getToken();
    const url = `${this.baseUrl}${path}`;
    const logCtx = { method, url, params: params || undefined, payloadKeys: data ? Object.keys(data) : undefined };

    console.log('[OT]', JSON.stringify(logCtx));

    let resp;
    try {
      resp = await axios({
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data,
        params,
        timeout: 30000,
      });
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      const msg = body?.message || body?.error || body?.errorMessage || err.message;
      console.error('[OT] ERROR', JSON.stringify({ method, url, status, body }));
      const error = new Error(`OneTrust API error [${status || 'network'}]: ${msg}`);
      error.status = status;
      error.otBody = body;
      throw error;
    }

    console.log('[OT] OK', JSON.stringify({ method, url, status: resp.status, dataKeys: resp.data ? Object.keys(resp.data) : [] }));
    return resp.data;
  }

  // ── Connection test ───────────────────────────────────────────────────────
  async testConnection() {
    // List orgs — works with any valid token
    return await this.request('GET', '/api/organizations/v2/organizations');
  }

  // ── Organizations ─────────────────────────────────────────────────────────
  async listOrganizations() {
    return await this.request('GET', '/api/organizations/v2/organizations');
  }

  async createOrganization({ name, parentOrgId }) {
    return await this.request('POST', '/api/organizations/v2/organizations', {
      name,
      parentOrganizationId: parentOrgId || null,
      active: true,
    });
  }

  async getOrganization(orgId) {
    return await this.request('GET', `/api/organizations/v2/organizations/${orgId}`);
  }

  // ── Purposes ──────────────────────────────────────────────────────────────
  async getPurposes(organizationId) {
    return await this.request('GET', '/api/consent/v2/purposes', null, { organizationId });
  }

  async createPurpose({ name, description, legalBasis, organizationId }) {
    // Map human-readable legalBasis to OT enum values
    const legalBasisMap = {
      'consent': 'CONSENT',
      'legitimate-interest': 'LEGITIMATE_INTEREST',
      'contract': 'CONTRACT',
      'legal-obligation': 'LEGAL_OBLIGATION',
      'vital-interests': 'VITAL_INTERESTS',
      'public-task': 'PUBLIC_TASK',
    };
    return await this.request('POST', '/api/consent/v2/purposes', {
      name,
      description: description || '',
      legalBasis: legalBasisMap[legalBasis] || legalBasis || 'CONSENT',
      organizationId,
      status: 'ACTIVE',
    });
  }

  async updatePurpose(purposeId, updates) {
    return await this.request('PATCH', `/api/consent/v2/purposes/${purposeId}`, updates);
  }

  // ── Data Elements ─────────────────────────────────────────────────────────
  async getDataElements(organizationId) {
    return await this.request('GET', '/api/consent/v2/dataelements', null, { organizationId });
  }

  async createDataElement({ name, description, category, sensitive, organizationId }) {
    const categoryMap = {
      'personal': 'PERSONAL',
      'sensitive': 'SENSITIVE',
      'special-category': 'SPECIAL_CATEGORY',
      'financial': 'FINANCIAL',
      'biometric': 'BIOMETRIC',
      'location': 'LOCATION',
      'behavioral': 'BEHAVIORAL',
      'device': 'DEVICE',
      'other': 'OTHER',
    };
    return await this.request('POST', '/api/consent/v2/dataelements', {
      name,
      description: description || '',
      dataElementType: categoryMap[category] || 'OTHER',
      isSensitive: !!sensitive,
      organizationId,
    });
  }

  async updateDataElement(elementId, updates) {
    return await this.request('PATCH', `/api/consent/v2/dataelements/${elementId}`, updates);
  }

  // ── Collection Points ─────────────────────────────────────────────────────
  async getCollectionPoints(organizationId) {
    return await this.request('GET', '/api/consent/v2/collectionpoints', null, { organizationId });
  }

  async createCollectionPoint({ name, label, description, purposeIds, dataElementIds, locale, geoRuleGroupId, organizationId }) {
    return await this.request('POST', '/api/consent/v2/collectionpoints', {
      name,
      label: label || name,
      description: description || '',
      purposeIds: purposeIds || [],
      dataElementIds: dataElementIds || [],
      locale: locale || 'en',
      geoRuleGroupId: geoRuleGroupId || null,
      organizationId,
      status: 'ACTIVE',
    });
  }

  async getCollectionPoint(cpId) {
    return await this.request('GET', `/api/consent/v2/collectionpoints/${cpId}`);
  }

  async updateCollectionPoint(cpId, updates) {
    return await this.request('PATCH', `/api/consent/v2/collectionpoints/${cpId}`, updates);
  }

  async createCollectionPointVersion(cpId, { notes }) {
    return await this.request('POST', `/api/consent/v2/collectionpoints/${cpId}/versions`, { notes: notes || '' });
  }

  async getCollectionPointVersions(cpId) {
    return await this.request('GET', `/api/consent/v2/collectionpoints/${cpId}/versions`);
  }

  // ── Geolocation Rule Groups ───────────────────────────────────────────────
  async getGeoRuleGroups(organizationId) {
    return await this.request('GET', '/api/consent/v2/geolocation/rulegroups', null, { organizationId });
  }

  async assignGeoRuleGroup(ruleGroupId, { collectionPointId }) {
    return await this.request('PUT', `/api/consent/v2/geolocation/rulegroups/${ruleGroupId}/assign`, { collectionPointId });
  }

  // ── Reconciliation — fetch all live objects for an org ────────────────────
  async reconcileOrg(organizationId) {
    const [purposes, dataElements, collectionPoints] = await Promise.allSettled([
      this.getPurposes(organizationId),
      this.getDataElements(organizationId),
      this.getCollectionPoints(organizationId),
    ]);
    return {
      purposes:         purposes.status === 'fulfilled'         ? (purposes.value?.content || purposes.value?.data || purposes.value || []) : [],
      dataElements:     dataElements.status === 'fulfilled'     ? (dataElements.value?.content || dataElements.value?.data || dataElements.value || []) : [],
      collectionPoints: collectionPoints.status === 'fulfilled' ? (collectionPoints.value?.content || collectionPoints.value?.data || collectionPoints.value || []) : [],
      errors: [purposes, dataElements, collectionPoints]
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message),
    };
  }
}

module.exports = OneTrustClient;
