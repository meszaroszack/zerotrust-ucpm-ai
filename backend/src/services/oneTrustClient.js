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

    // Full upstream logging — visible in Railway logs
    const logEntry = {
      method,
      url,
      baseUrl: this.baseUrl,
      path,
      params: params || undefined,
      payloadSummary: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          Array.isArray(v) ? `[${v.length} items]` : typeof v === 'string' ? v.slice(0, 80) : v
        ])
      ) : undefined,
    };
    console.log('[OT] REQUEST', JSON.stringify(logEntry));

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
      const rawMsg = body?.message || body?.error || body?.errorMessage ||
                     (typeof body === 'string' ? body : null) || err.message;
      // Log full error context so Railway logs show exact failure
      console.error('[OT] ERROR', JSON.stringify({
        method, url, status,
        responseBody: body,
        errorMessage: rawMsg,
        hint: status === 404 ? 'Check tenant base URL and org/brand scoping — OT path may require /api/v3/ or a different tenant subdomain' : undefined,
        hint401: status === 401 ? 'Token may be expired or client_id/secret wrong' : undefined,
        hint400: status === 400 ? 'Check payload fields — organizationId may be required or field names differ by OT version' : undefined,
      }));
      const error = new Error(`OneTrust API error [${status || 'network'}] ${method} ${url}: ${rawMsg}`);
      error.status = status;
      error.otBody = body;
      error.otUrl = url;
      throw error;
    }

    console.log('[OT] OK', JSON.stringify({
      method, url, status: resp.status,
      responseKeys: resp.data ? Object.keys(resp.data) : [],
      idInResponse: resp.data?.id || resp.data?.purposeId || resp.data?.collectionPointId || null,
    }));
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
    const legalBasisMap = {
      'consent': 'CONSENT',
      'legitimate-interest': 'LEGITIMATE_INTEREST',
      'contract': 'CONTRACT',
      'legal-obligation': 'LEGAL_OBLIGATION',
      'vital-interests': 'VITAL_INTERESTS',
      'public-task': 'PUBLIC_TASK',
    };
    const payload = {
      name,
      description: description || '',
      legalBasis: legalBasisMap[legalBasis] || legalBasis || 'CONSENT',
      organizationId,
      status: 'ACTIVE',
    };
    const resp = await this.request('POST', '/api/consent/v2/purposes', payload);
    // Robustly extract the OT-assigned ID from any response shape
    const otId = resp?.id || resp?.purposeId || resp?.data?.id || resp?.data?.purposeId ||
                 resp?.content?.[0]?.id || null;
    if (!otId) {
      console.warn('[OT] createPurpose: response missing ID field. Full response:', JSON.stringify(resp));
    }
    return { ...resp, _resolvedId: otId };
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
    // purposeIds and dataElementIds must be real OT UUIDs (not local IDs or names).
    // If an empty or name-only array is passed, send empty to avoid OT rejecting bad IDs.
    const safePurposeIds = (purposeIds || []).filter(id => id && /^[0-9a-f-]{36}$/i.test(id));
    const safeDeIds = (dataElementIds || []).filter(id => id && /^[0-9a-f-]{36}$/i.test(id));

    if ((purposeIds || []).length !== safePurposeIds.length) {
      console.warn('[OT] createCollectionPoint: some purposeIds were not valid OT UUIDs and were dropped.',
        { originalCount: purposeIds?.length, validCount: safePurposeIds.length });
    }

    const payload = {
      name,
      label: label || name,
      description: description || '',
      purposeIds: safePurposeIds,
      dataElementIds: safeDeIds,
      locale: locale || 'en',
      geoRuleGroupId: geoRuleGroupId || null,
      organizationId,
      status: 'ACTIVE',
    };

    let resp;
    try {
      resp = await this.request('POST', '/api/consent/v2/collectionpoints', payload);
    } catch (err) {
      // 404 on /v2/ — some tenants use /v3/ path. Retry once.
      if (err.status === 404) {
        console.warn('[OT] createCollectionPoint: /v2/ returned 404 — retrying with /v3/ path');
        try {
          resp = await this.request('POST', '/api/consent/v3/collectionpoints', payload);
        } catch (err2) {
          // Re-throw original error with both paths noted
          throw new Error(`OneTrust CP creation failed on both /v2/ and /v3/ paths. v2 error: ${err.message} | v3 error: ${err2.message}. Check tenant base URL in Settings.`);
        }
      } else {
        throw err;
      }
    }

    const otId = resp?.id || resp?.collectionPointId || resp?.data?.id ||
                 resp?.data?.collectionPointId || resp?.content?.[0]?.id || null;
    if (!otId) {
      console.warn('[OT] createCollectionPoint: response missing ID field. Full response:', JSON.stringify(resp));
    }
    return { ...resp, _resolvedId: otId };
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
