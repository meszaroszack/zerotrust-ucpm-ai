/**
 * AI Routes — ZEROTRUST AI
 *
 * Design: ontology-first, AI-second.
 *
 * For every planning route:
 *  1. Run deterministic classification from privacyOntology.js
 *  2. Try AI to classify/enrich (narrow prompt, not free-form generation)
 *  3. Merge: deterministic base + AI additions, AI wins on confidence/rationale
 *  4. If AI fails, fall back to deterministic result — NEVER fail the step
 *
 * The only routes that still require AI to succeed are:
 *  - /intake-document (first parse — no ontology alternative yet)
 *  - /ask-followups   (questions are AI-generated, fallback to stock questions)
 *  - /propose-update  (diff generation)
 *  - /translate-content
 *  - /explain-plan
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { complete } = require('../providers/aiProvider');
const { prompts } = require('../utils/aiPrompts');
const { WorkspaceModel } = require('../models/workspace');
const ConfigModel = require('../models/config');
const {
  classifyPurposes,
  classifyDataElements,
  classifyRegions,
  classifyChannels,
  buildPurposes,
  buildDataElements,
  buildScenarios,
  PURPOSES,
  DATA_ELEMENTS,
  CP_ARCHETYPES,
} = require('../data/privacyOntology');

const MAX_CONTENT_CHARS = 10000;

function truncate(text) {
  if (!text) return '';
  return text.length <= MAX_CONTENT_CHARS ? text : text.slice(0, MAX_CONTENT_CHARS) + '\n[Content truncated]';
}

// ── AI execution helper ────────────────────────────────────────────────────────
async function runAI(promptData) {
  const cfg = ConfigModel.get();
  if (!cfg.perplexityApiKey && !process.env.PERPLEXITY_API_KEY) {
    throw new Error('No AI key configured. Please add your Perplexity API key in Settings.');
  }
  const { systemPrompt, userMessage } = promptData;
  const messages = [{ role: 'user', content: userMessage }];
  return await complete({ messages, systemPrompt });
}

// ── Shape validation helper ───────────────────────────────────────────────────
function validateShape(result, routeKey) {
  if (!result || typeof result !== 'object') return { valid: false, error: 'AI returned a non-object response.' };
  if (routeKey && !(routeKey in result)) return {
    valid: false,
    error: `AI response missing "${routeKey}". Keys: [${Object.keys(result).join(', ')}]`
  };
  if (routeKey && !Array.isArray(result[routeKey])) return {
    valid: false,
    error: `AI field "${routeKey}" must be array, got ${typeof result[routeKey]}`
  };
  return { valid: true };
}

// ── Error handler ─────────────────────────────────────────────────────────────
function handleError(res, err, context) {
  console.error(`[AI/${context}]`, err.message);
  const status = err.response?.status;
  const msg = err.message?.includes('API key') || err.message?.includes('No AI key')
    ? err.message
    : status === 429 ? 'Rate limit reached. Please wait and retry.'
    : status === 401 ? 'AI API key rejected. Update in Settings.'
    : status === 400 ? `AI request rejected (400): ${err.message}`
    : err.message || 'AI request failed. Please retry.';
  res.status(500).json({ error: msg });
}

// ── Stock fallback questions (used when AI fails /ask-followups) ──────────────
const STOCK_FOLLOWUPS = [
  { id: 'q-regions',    question: 'Which regions do you serve?', category: 'geography',   required: true,  helpText: 'Select all that apply.', options: ['EU/EEA', 'UK', 'Germany', 'France', 'California (US)', 'US General', 'Canada', 'Australia', 'Global'], multiSelect: true },
  { id: 'q-channels',   question: 'What data collection channels do you have?', category: 'formTypes', required: true, helpText: 'Select all that apply.', options: ['Website cookie banner', 'Email sign-up form', 'Account registration', 'Contact/lead form', 'Checkout', 'Mobile app', 'Preference center'], multiSelect: true },
  { id: 'q-marketing',  question: 'Do you run marketing or advertising programs?', category: 'marketing', required: true, helpText: 'Select all that apply.', options: ['Email marketing', 'Google Ads', 'Meta/Facebook Ads', 'LinkedIn Ads', 'Analytics only', 'No marketing'], multiSelect: true },
  { id: 'q-b2b',        question: 'Is your business B2B, B2C, or both?', category: 'business', required: true, helpText: null, options: ['B2B', 'B2C', 'Both'], multiSelect: false },
  { id: 'q-sensitive',  question: 'Do you process any sensitive or special-category data?', category: 'dataCapture', required: true, helpText: 'Special categories: health, race, religion, biometric, financial.', options: ['Health/medical', 'Financial/payment', 'Biometric', 'Government ID', 'None of the above'], multiSelect: true },
  { id: 'q-languages',  question: 'Which languages do you need for consent notices?', category: 'languages', required: false, helpText: 'English is always included.', options: ['English', 'German', 'French', 'Dutch', 'Spanish', 'Italian', 'Portuguese'], multiSelect: true },
];

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────────────────────────────

// ── POST /api/ai/intake-document ──────────────────────────────────────────────
router.post('/intake-document', authenticate, async (req, res) => {
  const { content, filename } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided.' });
  try {
    const safe = truncate(content);
    const result = await runAI(prompts.intakeDocument(safe));
    const { valid, error } = validateShape(result, null);
    if (!valid) return res.status(500).json({ error });
    if (!result.summary && !result.extractedContext) {
      return res.status(500).json({ error: 'AI intake response missing required fields. Please retry.' });
    }
    WorkspaceModel.addAIReason({ type: 'intake-document', filename, result });
    const ws = WorkspaceModel.getActive();
    if (ws) {
      WorkspaceModel.update({
        sourceInputs: [...(ws.sourceInputs || []), { type: 'document', filename, extractedAt: new Date().toISOString() }]
      });
    }
    res.json(result);
  } catch (err) { handleError(res, err, 'intake-document'); }
});

// ── POST /api/ai/ask-followups ────────────────────────────────────────────────
router.post('/ask-followups', authenticate, async (req, res) => {
  const { context } = req.body;
  let result;
  try {
    result = await runAI(prompts.askFollowups(context));
    const { valid } = validateShape(result, 'questions');
    if (!valid || result.questions.length === 0) throw new Error('Empty questions array');
    res.json(result);
  } catch (err) {
    // Fallback to stock questions — never fail this step
    console.warn('[AI/ask-followups] AI failed, using stock questions:', err.message);
    res.json({
      title: 'Follow-up Questions',
      summary: 'Standard implementation questions (AI unavailable — using defaults).',
      confidence: 'medium',
      questions: STOCK_FOLLOWUPS,
      assumptions: [],
      warnings: ['AI was unavailable — stock questions used. Answers will still drive deterministic planning.'],
      missingInputs: [],
      humanReviewFlags: [],
      recommendations: [],
    });
  }
});

// ── POST /api/ai/extract-program ──────────────────────────────────────────────
// Deterministic first, AI enrichment second, deterministic fallback on AI failure
router.post('/extract-program', authenticate, async (req, res) => {
  const { context } = req.body;

  // 1. Deterministic classification
  const detRegions    = classifyRegions(context);
  const detPurposes   = classifyPurposes(context).map(r => r.purposeId);
  const detDEs        = classifyDataElements(context).map(r => r.deId);
  const detCPs        = classifyChannels(context).map(r => r.cpId);

  // 2. Try AI to classify/enrich (narrow prompt)
  let aiResult = null;
  try {
    const raw = await runAI(prompts.extractProgram(context));
    const { valid } = validateShape(raw, null);
    if (valid && raw.classifiedPurposeIds) aiResult = raw;
  } catch (err) {
    console.warn('[AI/extract-program] AI failed, using deterministic only:', err.message);
  }

  // 3. Merge: AI overrides deterministic if available
  const regions    = dedupe([...(aiResult?.classifiedRegions || []), ...detRegions]);
  const purposeIds = dedupe([...(aiResult?.classifiedPurposeIds || []), ...detPurposes]);
  const deIds      = dedupe([...(aiResult?.classifiedDeIds || []), ...detDEs]);
  const cpIds      = dedupe([...(aiResult?.classifiedCpIds || []), ...detCPs]);

  const result = {
    title: aiResult?.title || 'Privacy Program Configuration',
    summary: aiResult?.summary || `Derived ${purposeIds.length} purposes, ${deIds.length} data elements, ${regions.length} regions from deterministic classification.`,
    confidence: aiResult?.confidence || 'high',
    classifiedPurposeIds: purposeIds,
    classifiedDeIds: deIds,
    classifiedRegions: regions,
    classifiedCpIds: cpIds,
    customPurposes: aiResult?.customPurposes || [],
    customDataElements: aiResult?.customDataElements || [],
    geoStrategy: aiResult?.geoStrategy || `${regions.join(', ')} — derived from context`,
    implementationPhases: aiResult?.implementationPhases || ['Configure purposes', 'Set up scenarios', 'Deploy collection points'],
    assumptions: aiResult?.assumptions || [],
    warnings: aiResult?.warnings || [],
    humanReviewFlags: aiResult?.humanReviewFlags || [],
    missingInputs: aiResult?.missingInputs || [],
    recommendations: aiResult?.recommendations || [],
    deterministic: !aiResult,
  };

  WorkspaceModel.addAIReason({ type: 'extract-program', result });
  res.json(result);
});

// ── POST /api/ai/generate-scenarios ──────────────────────────────────────────
// Fully deterministic — no AI needed for structure. AI enriches rationale only.
router.post('/generate-scenarios', authenticate, async (req, res) => {
  const { context } = req.body;

  // 1. Deterministic region + CP classification
  const regions    = classifyRegions(context);
  const purposeIds = classifyPurposes(context).map(r => r.purposeId);
  const cpIds      = classifyChannels(context).map(r => r.cpId);

  // Fall back to cookie-banner if no channels detected
  const effectiveCpIds = cpIds.length > 0 ? cpIds : ['cp-cookie-banner'];

  // 2. Build deterministic scenarios
  let scenarios = buildScenarios(regions, purposeIds, effectiveCpIds);

  // 3. Try AI rationale enrichment (non-blocking)
  try {
    const raw = await runAI(prompts.enrichScenarioRationale(scenarios));
    if (raw?.enrichedScenarios?.length > 0) {
      const rationaleMap = {};
      raw.enrichedScenarios.forEach(e => { if (e.id) rationaleMap[e.id] = e; });
      scenarios = scenarios.map(s => {
        const enriched = rationaleMap[s.id];
        return enriched
          ? { ...s, rationale: enriched.rationale || s.rationale, priority: enriched.priority || s.priority, implementationNotes: enriched.implementationNotes || '' }
          : s;
      });
    }
  } catch (err) {
    console.warn('[AI/generate-scenarios] AI rationale enrichment failed (non-blocking):', err.message);
  }

  // Persist to workspace
  WorkspaceModel.update({ scenarios });
  WorkspaceModel.addAIReason({ type: 'generate-scenarios', scenarioCount: scenarios.length });

  res.json({
    title: 'Scenario Matrix',
    summary: `${scenarios.length} deterministic scenarios generated across ${regions.length} region(s).`,
    confidence: 'high',
    scenarios,
    deterministic: true,
    regions,
  });
});

// ── POST /api/ai/recommend-purposes ──────────────────────────────────────────
// Deterministic classification + AI rationale enrichment + custom purpose support
router.post('/recommend-purposes', authenticate, async (req, res) => {
  const { context } = req.body;

  // 1. Deterministic classification
  const detClassified = classifyPurposes(context);
  const detIds = detClassified.map(r => r.purposeId);

  // 2. AI classify + rationale (non-blocking)
  let aiResult = null;
  try {
    const raw = await runAI(prompts.recommendPurposes(context));
    if (raw?.classifiedPurposeIds?.length > 0) aiResult = raw;
  } catch (err) {
    console.warn('[AI/recommend-purposes] AI failed, using deterministic only:', err.message);
  }

  // 3. Merge: union of deterministic + AI IDs, AI rationale wins
  const allIds = dedupe([...(aiResult?.classifiedPurposeIds || []), ...detIds]);
  const rationaleMap = aiResult?.purposeRationale || {};

  // 4. Build purpose objects from canonical ontology (one object per ID — no collapse)
  const basePurposes = buildPurposes(allIds).map(p => {
    const enrich = rationaleMap[p.canonicalId] || {};
    return {
      ...p,
      id: uuidv4(),
      confidenceScore: enrich.confidenceScore ?? p.confidenceScore,
      reasoning: enrich.reasoning || p.reasoning,
      humanReviewRequired: enrich.humanReviewRequired ?? p.humanReviewRequired,
    };
  });

  // 5. Add custom purposes from AI (not in canonical ontology)
  const customPurposes = (aiResult?.customPurposes || []).map(cp => ({
    id: uuidv4(),
    canonicalId: null,
    name: cp.name,
    description: cp.description,
    legalBasis: cp.legalBasis || 'consent',
    regions: ['global'],
    confidenceScore: cp.confidenceScore ?? 0.6,
    reasoning: cp.reasoning || 'Suggested by AI as custom purpose outside canonical ontology.',
    humanReviewRequired: true,
    createStatus: 'suggested',
    isCustom: true,
  }));

  const proposedObjects = [...basePurposes, ...customPurposes];

  // 6. Persist — APPEND to existing, do not replace (fixes the one-purpose collapse bug)
  const ws = WorkspaceModel.getActive();
  const existing = ws?.purposes || [];
  const merged = mergePurposes(existing, proposedObjects);
  WorkspaceModel.update({ purposes: merged });
  WorkspaceModel.addAIReason({ type: 'recommend-purposes', count: proposedObjects.length });

  res.json({
    title: aiResult?.title || 'Recommended Purposes',
    summary: aiResult?.summary || `${proposedObjects.length} purposes identified (${basePurposes.length} canonical, ${customPurposes.length} custom).`,
    confidence: aiResult?.confidence || 'high',
    proposedObjects,
    deterministic: !aiResult,
    assumptions: aiResult?.assumptions || [],
    warnings: aiResult?.warnings || [],
    humanReviewFlags: aiResult?.humanReviewFlags || [],
    missingInputs: aiResult?.missingInputs || [],
    recommendations: aiResult?.recommendations || [],
  });
});

// ── POST /api/ai/recommend-data-elements ─────────────────────────────────────
router.post('/recommend-data-elements', authenticate, async (req, res) => {
  const { context } = req.body;

  // 1. Deterministic
  const detClassified = classifyDataElements(context);
  const detIds = detClassified.map(r => r.deId);
  const purposeIds = classifyPurposes(context).map(r => r.purposeId);

  // 2. AI classify (non-blocking)
  let aiResult = null;
  try {
    const raw = await runAI(prompts.recommendDataElements(context));
    if (raw?.classifiedDeIds?.length > 0) aiResult = raw;
  } catch (err) {
    console.warn('[AI/recommend-data-elements] AI failed, using deterministic only:', err.message);
  }

  // 3. Merge
  const allIds = dedupe([...(aiResult?.classifiedDeIds || []), ...detIds]);
  const rationaleMap = aiResult?.deRationale || {};

  const baseDEs = buildDataElements(allIds, purposeIds).map(de => {
    const enrich = rationaleMap[de.canonicalId] || {};
    return {
      ...de,
      id: uuidv4(),
      confidenceScore: enrich.confidenceScore ?? de.confidenceScore,
      reasoning: enrich.reasoning || de.reasoning,
      humanReviewRequired: enrich.humanReviewRequired ?? de.humanReviewRequired,
    };
  });

  const customDEs = (aiResult?.customDataElements || []).map(cd => ({
    id: uuidv4(),
    canonicalId: null,
    name: cd.name,
    description: cd.description,
    category: cd.category || 'other',
    sensitive: !!cd.sensitive,
    linkedPurposes: [],
    confidenceScore: cd.confidenceScore ?? 0.6,
    reasoning: cd.reasoning || 'Suggested by AI as custom data element.',
    humanReviewRequired: true,
    createStatus: 'suggested',
    isCustom: true,
  }));

  const proposedObjects = [...baseDEs, ...customDEs];

  // Persist — append to existing, not replace
  const ws = WorkspaceModel.getActive();
  const existing = ws?.dataElements || [];
  const merged = mergeByCanonicalId(existing, proposedObjects, 'canonicalId');
  WorkspaceModel.update({ dataElements: merged });
  WorkspaceModel.addAIReason({ type: 'recommend-data-elements', count: proposedObjects.length });

  res.json({
    title: aiResult?.title || 'Recommended Data Elements',
    summary: aiResult?.summary || `${proposedObjects.length} data elements identified.`,
    confidence: aiResult?.confidence || 'high',
    proposedObjects,
    deterministic: !aiResult,
    assumptions: aiResult?.assumptions || [],
    warnings: aiResult?.warnings || [],
    humanReviewFlags: aiResult?.humanReviewFlags || [],
    missingInputs: aiResult?.missingInputs || [],
    recommendations: aiResult?.recommendations || [],
  });
});

// ── POST /api/ai/recommend-collection-points ──────────────────────────────────
router.post('/recommend-collection-points', authenticate, async (req, res) => {
  const { context } = req.body;

  // 1. Deterministic
  const detRegions  = classifyRegions(context);
  const detCpIds    = classifyChannels(context).map(r => r.cpId);
  const detPurposes = classifyPurposes(context).map(r => r.purposeId);

  // 2. AI classify (non-blocking)
  let aiResult = null;
  try {
    const raw = await runAI(prompts.recommendCollectionPoints(context));
    if (raw?.classifiedCpIds?.length > 0) aiResult = raw;
  } catch (err) {
    console.warn('[AI/recommend-collection-points] AI failed, using deterministic only:', err.message);
  }

  // 3. Merge
  const allCpIds  = dedupe([...(aiResult?.classifiedCpIds || []), ...(detCpIds.length > 0 ? detCpIds : ['cp-cookie-banner'])]);
  const allRegions = dedupe([...(aiResult?.classifiedRegions || []), ...detRegions]);
  const rationaleMap = aiResult?.cpRationale || {};

  // 4. Build CP objects from archetypes
  const proposedObjects = [];
  for (const cpId of allCpIds) {
    const archetype = CP_ARCHETYPES.find(a => a.id === cpId);
    if (!archetype) continue;
    const enrich = rationaleMap[cpId] || {};
    // One proposed CP per archetype (not per region — regions go on scenarios)
    const purposeNames = (archetype.defaultPurposes || [])
      .filter(pid => detPurposes.length === 0 || detPurposes.includes(pid))
      .map(pid => {
        const p = require('../data/privacyOntology').PURPOSES.find(p => p.id === pid);
        return p?.name;
      }).filter(Boolean);

    proposedObjects.push({
      id: uuidv4(),
      archetypeId: cpId,
      name: archetype.name,
      label: archetype.name,
      description: archetype.description,
      cpType: archetype.cpType,
      purposes: purposeNames,
      dataElements: [],
      locale: 'en',
      region: allRegions[0] || 'global',
      confidenceScore: enrich.confidenceScore ?? 0.85,
      reasoning: enrich.reasoning || `Detected from context. Archetype: ${archetype.id}.`,
      humanReviewRequired: false,
      createStatus: 'suggested',
    });
  }

  // Persist — append/merge
  const ws = WorkspaceModel.getActive();
  const existing = ws?.collectionPoints || [];
  const merged = mergeByCanonicalId(existing, proposedObjects, 'archetypeId');
  WorkspaceModel.update({ collectionPoints: merged });
  WorkspaceModel.addAIReason({ type: 'recommend-collection-points', count: proposedObjects.length });

  res.json({
    title: aiResult?.title || 'Recommended Collection Points',
    summary: aiResult?.summary || `${proposedObjects.length} collection point archetypes identified.`,
    confidence: aiResult?.confidence || 'high',
    proposedObjects,
    deterministic: !aiResult,
    assumptions: aiResult?.assumptions || [],
    warnings: aiResult?.warnings || [],
    humanReviewFlags: aiResult?.humanReviewFlags || [],
    missingInputs: aiResult?.missingInputs || [],
    recommendations: aiResult?.recommendations || [],
  });
});

// ── POST /api/ai/propose-update ───────────────────────────────────────────────
router.post('/propose-update', authenticate, async (req, res) => {
  const { request } = req.body;
  const ws = WorkspaceModel.getActive();
  if (!ws) return res.status(400).json({ error: 'No active workspace.' });
  try {
    const currentState = { scenarios: ws.scenarios, purposes: ws.purposes, dataElements: ws.dataElements, collectionPoints: ws.collectionPoints, activeBrand: ws.activeBrandName };
    const result = await runAI(prompts.proposeUpdate(request, currentState));
    WorkspaceModel.addAIReason({ type: 'propose-update', request, result });
    res.json(result);
  } catch (err) { handleError(res, err, 'propose-update'); }
});

// ── POST /api/ai/explain-plan ─────────────────────────────────────────────────
router.post('/explain-plan', authenticate, async (req, res) => {
  const { plan } = req.body;
  try {
    const result = await runAI(prompts.explainPlan(plan));
    res.json(result);
  } catch (err) { handleError(res, err, 'explain-plan'); }
});

// ── POST /api/ai/translate-content ───────────────────────────────────────────
router.post('/translate-content', authenticate, async (req, res) => {
  const { content, targetLanguage, sourceLanguage } = req.body;
  try {
    const result = await runAI(prompts.translateContent({ content, targetLanguage, sourceLanguage }));
    res.json(result);
  } catch (err) { handleError(res, err, 'translate-content'); }
});

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/**
 * Merge purposes: keep existing objects, add new ones if canonicalId not already present.
 * For custom purposes (no canonicalId) always append.
 */
function mergePurposes(existing, incoming) {
  const result = [...existing];
  const existingCanonicalIds = new Set(existing.map(p => p.canonicalId).filter(Boolean));

  for (const p of incoming) {
    if (!p.canonicalId) {
      // Custom purpose — always append (don't dedupe by name to allow multiple custom ones)
      result.push(p);
    } else if (!existingCanonicalIds.has(p.canonicalId)) {
      // New canonical purpose — add it
      result.push(p);
      existingCanonicalIds.add(p.canonicalId);
    }
    // If canonicalId already exists — skip (preserve existing with its status/OT ID)
  }
  return result;
}

/**
 * Generic merge by a canonical ID field (e.g. 'canonicalId', 'archetypeId').
 */
function mergeByCanonicalId(existing, incoming, field) {
  const result = [...existing];
  const existingIds = new Set(existing.map(o => o[field]).filter(Boolean));

  for (const item of incoming) {
    if (!item[field] || !existingIds.has(item[field])) {
      result.push(item);
      if (item[field]) existingIds.add(item[field]);
    }
  }
  return result;
}

module.exports = router;
