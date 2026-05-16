/**
 * ZEROTRUST AI — Canonical Privacy Ontology
 *
 * This file is the single source of truth for all deterministic object
 * generation. AI is used ONLY to:
 *   1. Classify free-text input INTO these canonical IDs
 *   2. Assign rationale text and confidence scores
 *   3. Suggest "custom" objects that don't fit the ontology
 *
 * Nothing here calls the network. All exports are pure data.
 */

// ── Canonical Purposes ────────────────────────────────────────────────────────
const PURPOSES = [
  {
    id: 'p-marketing-email',
    name: 'Email Marketing',
    description: 'Sending promotional emails, newsletters, and marketing communications.',
    legalBasis: 'consent',
    tags: ['marketing', 'email', 'newsletter', 'promotional'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last'],
    humanReviewRequired: false,
  },
  {
    id: 'p-analytics',
    name: 'Analytics & Performance',
    description: 'Measuring website and application usage to understand user behavior and improve performance.',
    legalBasis: 'legitimate-interest',
    tags: ['analytics', 'tracking', 'performance', 'measurement', 'google analytics', 'adobe'],
    regions: ['global'],
    defaultDE: ['de-ip-address', 'de-device-id', 'de-behavioral'],
    humanReviewRequired: false,
  },
  {
    id: 'p-advertising',
    name: 'Targeted Advertising',
    description: 'Personalizing ads based on user behavior, interests, and profile data.',
    legalBasis: 'consent',
    tags: ['advertising', 'ads', 'targeting', 'personalization', 'retargeting', 'meta pixel', 'google ads'],
    regions: ['global'],
    defaultDE: ['de-ip-address', 'de-device-id', 'de-behavioral', 'de-location'],
    humanReviewRequired: true,
  },
  {
    id: 'p-functional',
    name: 'Functional & Preferences',
    description: 'Storing user preferences, language settings, and session state to provide core functionality.',
    legalBasis: 'contract',
    tags: ['functional', 'preferences', 'session', 'necessary', 'strictly necessary', 'essential'],
    regions: ['global'],
    defaultDE: ['de-device-id', 'de-email'],
    humanReviewRequired: false,
  },
  {
    id: 'p-service-improvement',
    name: 'Service Improvement',
    description: 'Using data to improve products, services, and user experience.',
    legalBasis: 'legitimate-interest',
    tags: ['product', 'improvement', 'research', 'development', 'ux'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-behavioral', 'de-device-id'],
    humanReviewRequired: false,
  },
  {
    id: 'p-sales-crm',
    name: 'Sales & CRM',
    description: 'Processing contact and company data for sales outreach, pipeline management, and CRM.',
    legalBasis: 'legitimate-interest',
    tags: ['sales', 'crm', 'b2b', 'outreach', 'lead', 'account'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last', 'de-phone', 'de-company'],
    humanReviewRequired: false,
  },
  {
    id: 'p-account-management',
    name: 'Account & Contract Management',
    description: 'Processing data required to create and manage user accounts and fulfill contractual obligations.',
    legalBasis: 'contract',
    tags: ['account', 'registration', 'login', 'contract', 'billing', 'subscription'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last', 'de-phone'],
    humanReviewRequired: false,
  },
  {
    id: 'p-legal-compliance',
    name: 'Legal & Regulatory Compliance',
    description: 'Processing data to meet legal obligations, tax requirements, or regulatory mandates.',
    legalBasis: 'legal-obligation',
    tags: ['legal', 'compliance', 'tax', 'regulatory', 'audit', 'gdpr', 'ccpa'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last'],
    humanReviewRequired: true,
  },
  {
    id: 'p-profiling',
    name: 'Profiling & Automated Decision-Making',
    description: 'Creating user profiles or making automated decisions based on personal data.',
    legalBasis: 'consent',
    tags: ['profiling', 'scoring', 'automated decision', 'segmentation', 'ml', 'ai'],
    regions: ['global'],
    defaultDE: ['de-behavioral', 'de-device-id', 'de-location'],
    humanReviewRequired: true,
  },
  {
    id: 'p-data-sharing',
    name: 'Third-Party Data Sharing',
    description: 'Sharing personal data with third-party partners, affiliates, or data brokers.',
    legalBasis: 'consent',
    tags: ['sharing', 'third party', 'partner', 'data broker', 'affiliate'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last', 'de-behavioral'],
    humanReviewRequired: true,
  },
  {
    id: 'p-support',
    name: 'Customer Support',
    description: 'Processing contact and communication data to respond to support requests.',
    legalBasis: 'contract',
    tags: ['support', 'helpdesk', 'ticketing', 'customer service'],
    regions: ['global'],
    defaultDE: ['de-email', 'de-name-first', 'de-name-last'],
    humanReviewRequired: false,
  },
];

// ── Canonical Data Elements ───────────────────────────────────────────────────
const DATA_ELEMENTS = [
  { id: 'de-email',        name: 'Email Address',       category: 'personal',  sensitive: false, tags: ['email'] },
  { id: 'de-name-first',   name: 'First Name',          category: 'personal',  sensitive: false, tags: ['name', 'first name'] },
  { id: 'de-name-last',    name: 'Last Name',            category: 'personal',  sensitive: false, tags: ['name', 'last name', 'surname'] },
  { id: 'de-phone',        name: 'Phone Number',         category: 'personal',  sensitive: false, tags: ['phone', 'mobile', 'telephone'] },
  { id: 'de-company',      name: 'Company Name',         category: 'personal',  sensitive: false, tags: ['company', 'organization', 'employer', 'b2b'] },
  { id: 'de-ip-address',   name: 'IP Address',           category: 'device',    sensitive: false, tags: ['ip', 'ip address'] },
  { id: 'de-device-id',    name: 'Device & Cookie IDs',  category: 'device',    sensitive: false, tags: ['device', 'cookie', 'fingerprint', 'identifier'] },
  { id: 'de-behavioral',   name: 'Behavioral Data',      category: 'behavioral',sensitive: false, tags: ['behavior', 'browsing', 'clickstream', 'activity', 'events'] },
  { id: 'de-location',     name: 'Location Data',        category: 'location',  sensitive: false, tags: ['location', 'geo', 'geolocation', 'address', 'city', 'country'] },
  { id: 'de-health',       name: 'Health & Medical Data',category: 'sensitive', sensitive: true,  tags: ['health', 'medical', 'hipaa', 'phi'] },
  { id: 'de-financial',    name: 'Financial Data',       category: 'financial', sensitive: true,  tags: ['financial', 'payment', 'billing', 'credit card', 'bank'] },
  { id: 'de-biometric',    name: 'Biometric Data',       category: 'biometric', sensitive: true,  tags: ['biometric', 'face', 'fingerprint', 'iris'] },
  { id: 'de-job-title',    name: 'Job Title',            category: 'personal',  sensitive: false, tags: ['job', 'title', 'role', 'position', 'b2b'] },
  { id: 'de-ssn',          name: 'Government ID / SSN',  category: 'sensitive', sensitive: true,  tags: ['ssn', 'government id', 'passport', 'driver license', 'national id'] },
  { id: 'de-special',      name: 'Special Category Data',category: 'special-category', sensitive: true, tags: ['race', 'religion', 'sexual orientation', 'political', 'union', 'special category'] },
];

// ── Consent Models by region ──────────────────────────────────────────────────
const CONSENT_MODELS = {
  // EU/EEA — GDPR
  'EU':  { consentPosture: 'opt-in', label: 'GDPR (EU)', requiresRejectAll: true, framework: 'GDPR' },
  'EEA': { consentPosture: 'opt-in', label: 'GDPR (EEA)', requiresRejectAll: true, framework: 'GDPR' },
  'GB':  { consentPosture: 'opt-in', label: 'UK GDPR', requiresRejectAll: true, framework: 'UK_GDPR' },
  'DE':  { consentPosture: 'opt-in', label: 'GDPR (Germany)', requiresRejectAll: true, framework: 'GDPR' },
  'FR':  { consentPosture: 'opt-in', label: 'GDPR (France)', requiresRejectAll: true, framework: 'GDPR' },
  'NL':  { consentPosture: 'opt-in', label: 'GDPR (Netherlands)', requiresRejectAll: true, framework: 'GDPR' },
  // US States
  'US-CA': { consentPosture: 'opt-out', label: 'CCPA/CPRA (California)', requiresRejectAll: false, framework: 'CCPA_CPRA', doNotSell: true },
  'US-VA': { consentPosture: 'opt-out', label: 'VCDPA (Virginia)', requiresRejectAll: false, framework: 'VCDPA' },
  'US-CO': { consentPosture: 'opt-out', label: 'CPA (Colorado)', requiresRejectAll: false, framework: 'CPA' },
  'US-CT': { consentPosture: 'opt-out', label: 'CTDPA (Connecticut)', requiresRejectAll: false, framework: 'CTDPA' },
  'US-TX': { consentPosture: 'opt-out', label: 'TDPSA (Texas)', requiresRejectAll: false, framework: 'TDPSA' },
  'US':    { consentPosture: 'notice-only', label: 'US General', requiresRejectAll: false, framework: 'US_GENERAL' },
  // APAC
  'AU':    { consentPosture: 'notice-only', label: 'Privacy Act (Australia)', requiresRejectAll: false, framework: 'PRIVACY_ACT_AU' },
  'CA':    { consentPosture: 'opt-in', label: 'PIPEDA / Bill C-27 (Canada)', requiresRejectAll: false, framework: 'PIPEDA' },
  // Global default
  'global': { consentPosture: 'notice-only', label: 'Global Default', requiresRejectAll: false, framework: 'GLOBAL' },
};

// ── Channel / CP Archetypes ───────────────────────────────────────────────────
// These are templates for collection point types. scenarioId is filled at runtime.
const CP_ARCHETYPES = [
  {
    id: 'cp-cookie-banner',
    name: 'Cookie Consent Banner',
    cpType: 'dynamic',
    tags: ['website', 'cookie', 'banner', 'cmp', 'web'],
    defaultPurposes: ['p-analytics', 'p-advertising', 'p-functional'],
    description: 'Browser-based cookie consent banner displayed on first visit.',
  },
  {
    id: 'cp-email-signup',
    name: 'Email Sign-Up Form',
    cpType: 'standard',
    tags: ['email', 'signup', 'newsletter', 'form', 'marketing'],
    defaultPurposes: ['p-marketing-email', 'p-sales-crm'],
    description: 'Inline or modal form collecting email for marketing purposes.',
  },
  {
    id: 'cp-registration',
    name: 'Account Registration',
    cpType: 'standard',
    tags: ['account', 'registration', 'signup', 'login', 'user'],
    defaultPurposes: ['p-account-management', 'p-functional'],
    description: 'Account creation or registration form.',
  },
  {
    id: 'cp-contact-form',
    name: 'Contact / Lead Form',
    cpType: 'standard',
    tags: ['contact', 'lead', 'inquiry', 'demo request', 'sales'],
    defaultPurposes: ['p-sales-crm', 'p-support'],
    description: 'Contact or lead capture form.',
  },
  {
    id: 'cp-checkout',
    name: 'Checkout / Purchase',
    cpType: 'standard',
    tags: ['checkout', 'purchase', 'ecommerce', 'payment', 'billing'],
    defaultPurposes: ['p-account-management', 'p-legal-compliance'],
    description: 'Purchase or checkout flow collecting billing and identity data.',
  },
  {
    id: 'cp-mobile-app',
    name: 'Mobile App',
    cpType: 'standard',
    tags: ['mobile', 'app', 'ios', 'android', 'native'],
    defaultPurposes: ['p-analytics', 'p-functional'],
    description: 'In-app consent collection point for mobile applications.',
  },
  {
    id: 'cp-preference-center',
    name: 'Preference Center',
    cpType: 'dynamic',
    tags: ['preference', 'center', 'opt-in', 'opt-out', 'profile'],
    defaultPurposes: ['p-marketing-email', 'p-analytics', 'p-advertising'],
    description: 'User-facing preference and consent management portal.',
  },
];

// ── Scenario templates — deterministic derivation ─────────────────────────────
// Given a set of regions and CP archetypes, these rules produce scenarios without AI.
// AI is then asked to add rationale only.
const SCENARIO_RULES = [
  // EU GDPR
  { regionMatch: /^(EU|EEA|DE|FR|NL|IT|ES|PL|SE|AT)$/, langDefault: 'en', langMap: { DE: 'de', FR: 'fr', NL: 'nl' } },
  // UK
  { regionMatch: /^GB$/, langDefault: 'en' },
  // US States with active privacy laws
  { regionMatch: /^US-CA$/, langDefault: 'en' },
  { regionMatch: /^US-VA$/, langDefault: 'en' },
  { regionMatch: /^US-CO$/, langDefault: 'en' },
  // US General
  { regionMatch: /^US$/, langDefault: 'en' },
  // Canada
  { regionMatch: /^CA$/, langDefault: 'en' },
  // Australia
  { regionMatch: /^AU$/, langDefault: 'en' },
  // Global / fallback
  { regionMatch: /^global$/, langDefault: 'en' },
];

// ── Keyword classification helpers ─────────────────────────────────────────────
/**
 * Score an ontology entry against input keywords.
 * Returns a score 0-N where N = number of tag matches.
 */
function scoreEntry(entry, keywords) {
  const kw = keywords.map(k => k.toLowerCase());
  return entry.tags.filter(tag => kw.some(k => k.includes(tag) || tag.includes(k))).length;
}

/**
 * Classify a free-text context into a list of canonical purpose IDs.
 * Input: context object (intakeResult + answers)
 * Returns: Array of { purposeId, score, reason }
 */
function classifyPurposes(context) {
  // Extract keywords from all relevant fields
  const text = [
    context?.businessModel || '',
    context?.industry || '',
    context?.marketingPresence || '',
    context?.analyticsPresence || '',
    context?.purposes || '',
    (context?.answers || {}),
    JSON.stringify(context?.extractedContext || {}),
  ].join(' ').toLowerCase();

  const words = text.split(/\W+/).filter(w => w.length > 2);

  return PURPOSES
    .map(p => ({ purposeId: p.id, score: scoreEntry(p, words), reason: `Matched tags from intake context` }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Classify a free-text context into canonical data element IDs.
 */
function classifyDataElements(context) {
  const text = JSON.stringify(context || {}).toLowerCase();
  const words = text.split(/\W+/).filter(w => w.length > 2);

  return DATA_ELEMENTS
    .map(de => ({ deId: de.id, score: scoreEntry(de, words), reason: 'Matched tags from intake context' }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Derive regions from context (looks for country/region mentions).
 */
function classifyRegions(context) {
  const text = JSON.stringify(context || {}).toLowerCase();
  const found = [];

  const regionSignals = [
    { keys: ['germany', 'german', 'deutschland', 'de'],            region: 'DE' },
    { keys: ['france', 'french', 'fr'],                            region: 'FR' },
    { keys: ['netherlands', 'dutch', 'nl'],                        region: 'NL' },
    { keys: ['united kingdom', 'uk', 'gb', 'britain', 'england'],  region: 'GB' },
    { keys: ['european union', ' eu ', 'gdpr', 'eea'],             region: 'EU' },
    { keys: ['california', 'ca ', 'ccpa', 'cpra'],                 region: 'US-CA' },
    { keys: ['virginia', 'vcdpa'],                                  region: 'US-VA' },
    { keys: ['colorado', ' co '],                                   region: 'US-CO' },
    { keys: ['connecticut', 'ctdpa'],                               region: 'US-CT' },
    { keys: ['texas', 'tdpsa'],                                     region: 'US-TX' },
    { keys: ['united states', ' us ', 'usa', 'america'],           region: 'US' },
    { keys: ['canada', 'canadian', 'pipeda'],                      region: 'CA' },
    { keys: ['australia', 'australian'],                            region: 'AU' },
  ];

  for (const sig of regionSignals) {
    if (sig.keys.some(k => text.includes(k))) {
      found.push(sig.region);
    }
  }

  // Dedupe — if EU is found, individual EU member states are covered
  // but we keep them for granular scenario generation
  return found.length > 0 ? [...new Set(found)] : ['global'];
}

/**
 * Classify CP archetypes from context.
 */
function classifyChannels(context) {
  const text = JSON.stringify(context || {}).toLowerCase();
  const words = text.split(/\W+/).filter(w => w.length > 2);

  return CP_ARCHETYPES
    .map(cp => ({ cpId: cp.id, score: scoreEntry(cp, words), reason: 'Matched tags from intake context' }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Build a deterministic scenario matrix from classified inputs.
 * No AI needed. AI adds rationale text on top of this.
 */
function buildScenarios(classifiedRegions, classifiedPurposeIds, classifiedCpIds) {
  const scenarios = [];

  for (const region of classifiedRegions) {
    const model = CONSENT_MODELS[region] || CONSENT_MODELS['global'];

    const cpIds = classifiedCpIds.length > 0 ? classifiedCpIds : ['cp-cookie-banner'];
    for (const cpId of cpIds) {
      const archetype = CP_ARCHETYPES.find(a => a.id === cpId);
      if (!archetype) continue;

      // Resolve purposes for this CP
      const cpPurposeIds = archetype.defaultPurposes.filter(pid =>
        classifiedPurposeIds.length === 0 || classifiedPurposeIds.includes(pid)
      );
      if (cpPurposeIds.length === 0 && classifiedPurposeIds.length > 0) {
        // Use any purpose that was classified
        cpPurposeIds.push(...classifiedPurposeIds.slice(0, 3));
      }

      const purposeNames = cpPurposeIds
        .map(pid => PURPOSES.find(p => p.id === pid)?.name)
        .filter(Boolean);

      // Determine lang
      const rule = SCENARIO_RULES.find(r => r.regionMatch.test(region));
      const lang = rule?.langMap?.[region] || rule?.langDefault || 'en';

      // Parse region to country/state codes
      let countryCode = region;
      let stateCode = null;
      if (region.includes('-')) {
        [countryCode, stateCode] = region.split('-');
      }

      scenarios.push({
        id: `scenario-${region}-${cpId}`,
        name: `${region} — ${archetype.name}`,
        region,
        country: countryCode,
        countryCode,
        state: stateCode || null,
        stateCode: stateCode || null,
        language: lang,
        languageCode: lang,
        consentPosture: model.consentPosture,
        cpType: archetype.cpType,
        purposes: purposeNames,
        purposeIds: cpPurposeIds,
        dataElements: [],  // populated from purpose defaults
        oneTrustObjectType: 'collection-point',
        testUrl: null,
        rationale: `${model.label} requires ${model.consentPosture} consent. Archetype: ${archetype.name}.`,
        priority: ['EU', 'GB', 'US-CA', 'DE', 'FR'].includes(region) ? 'high' : 'medium',
        status: 'pending',
        framework: model.framework,
        requiresRejectAll: model.requiresRejectAll || false,
        doNotSell: model.doNotSell || false,
      });
    }
  }

  return scenarios;
}

/**
 * Build purpose objects from classified purpose IDs + ontology defaults.
 * Each returns a workspace-ready purpose object (no ID — caller assigns uuid).
 */
function buildPurposes(classifiedPurposeIds) {
  return classifiedPurposeIds.map(pid => {
    const canonical = PURPOSES.find(p => p.id === pid);
    if (!canonical) return null;
    return {
      canonicalId: pid,
      name: canonical.name,
      description: canonical.description,
      legalBasis: canonical.legalBasis,
      regions: canonical.regions,
      confidenceScore: 0.85,
      reasoning: `Matched from canonical privacy ontology (${pid}).`,
      humanReviewRequired: canonical.humanReviewRequired,
      createStatus: 'suggested',
    };
  }).filter(Boolean);
}

/**
 * Build data element objects from classified DE IDs.
 */
function buildDataElements(classifiedDeIds, linkedPurposeIds) {
  return classifiedDeIds.map(deId => {
    const canonical = DATA_ELEMENTS.find(d => d.id === deId);
    if (!canonical) return null;
    // Link to purposes that reference this DE in their defaults
    const linkedPurposeNames = PURPOSES
      .filter(p => linkedPurposeIds.includes(p.id) && p.defaultDE.includes(deId))
      .map(p => p.name);
    return {
      canonicalId: deId,
      name: canonical.name,
      description: `${canonical.name} — classified from canonical data element ontology.`,
      category: canonical.category,
      sensitive: canonical.sensitive,
      linkedPurposes: linkedPurposeNames,
      confidenceScore: 0.85,
      reasoning: `Matched from canonical data element ontology (${deId}).`,
      humanReviewRequired: canonical.sensitive,
      createStatus: 'suggested',
    };
  }).filter(Boolean);
}

module.exports = {
  PURPOSES,
  DATA_ELEMENTS,
  CONSENT_MODELS,
  CP_ARCHETYPES,
  classifyPurposes,
  classifyDataElements,
  classifyRegions,
  classifyChannels,
  buildScenarios,
  buildPurposes,
  buildDataElements,
};
