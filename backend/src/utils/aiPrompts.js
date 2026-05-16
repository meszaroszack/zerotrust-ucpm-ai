/**
 * AI Prompt Templates for ZEROTRUST AI
 * All prompts instruct the AI to return structured JSON.
 */

const BASE_SYSTEM = `You are ZEROTRUST AI — an expert privacy implementation officer specializing in OneTrust UCPM/CMP deployments. 
You think in scenarios, not in menus. Your job is to translate business requirements into actionable privacy program implementations.
IMPORTANT: Always respond with valid JSON only. No markdown prose outside the JSON structure.
Include in every response: title, summary, confidence (high/medium/low), assumptions (array), warnings (array), recommendations (array), proposedObjects (array), missingInputs (array), humanReviewFlags (array).
Note: This is regulatory-informed implementation guidance, not legal advice. Flag anything requiring human/legal review.`;

const prompts = {
  intakeDocument(content) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Analyze this document and extract all privacy program requirements:\n\n${content}\n\nReturn JSON with: title, summary, confidence, extractedContext (object with: businessModel, industry, websiteFootprint, regionsServed, languagesNeeded, purposes, dataElements, collectionPointScenarios, complianceFrameworks, marketingPresence, analyticsPresence, knownConcerns), assumptions, warnings, missingInputs, humanReviewFlags, recommendations.`
    };
  },

  extractProgram(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Given this brand/program context: ${JSON.stringify(context)}\n\nGenerate a complete privacy program model. Return JSON with: title, summary, confidence, purposes (array of {name, description, legalBasis, regions, required, confidence}), dataElements (array of {name, description, category, sensitive, linkedPurposes, confidence}), collectionPointScenarios (array of {name, region, country, state, language, consentPosture, cpType, purposes, dataElements, rationale}), geoStrategy, languageStrategy, implementationPhases (array), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  askFollowups(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Based on this partial context: ${JSON.stringify(context)}\n\nGenerate targeted expert follow-up questions. Return JSON with: title, summary, confidence, questions (array of {id, question, category (one of: geography|business|dataCapture|languages|formTypes|marketing|regulatory|profiling), required, helpText, options (array or null)}), assumptions, warnings, missingInputs, humanReviewFlags, recommendations.`
    };
  },

  generateScenarios(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Given this program context: ${JSON.stringify(context)}\n\nGenerate a complete scenario matrix. Return JSON with: title, summary, confidence, scenarios (array of {id, name, region, country, countryCode, state, stateCode, language, languageCode, consentPosture (opt-in|opt-out|notice-only|legitimate-interest), cpType (dynamic|standard|multi), purposes (array of names), dataElements (array of names), oneTrustObjectType, testUrl, rationale, priority, status: 'pending'}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  recommendPurposes(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Given this program context: ${JSON.stringify(context)}\n\nRecommend a purpose taxonomy for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {name, description, legalBasis (consent|legitimate-interest|contract|legal-obligation|vital-interests|public-task), regions (array), required, confidenceScore (0-1), reasoning, humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  recommendDataElements(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Given this program context: ${JSON.stringify(context)}\n\nRecommend data elements for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {name, description, category (personal|sensitive|special-category|financial|biometric|location|behavioral|device|other), sensitive (bool), linkedPurposes (array), retentionPeriod, confidenceScore (0-1), reasoning, humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  recommendCollectionPoints(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Given this program context and scenarios: ${JSON.stringify(context)}\n\nRecommend collection point strategy and object definitions for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {scenarioId, name, label, description, cpType (dynamic|standard), locale, region, geoRuleGroup, purposes (array), dataElements (array), consentModel, version: '1.0', confidenceScore (0-1), reasoning, humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  proposeUpdate(request, currentState) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Current workspace state: ${JSON.stringify(currentState)}\n\nUser update request: "${request}"\n\nPropose specific changes. Return JSON with: title, summary, confidence, affectedObjects (array of {type, id, name, currentValue, proposedValue, changeType (add|update|delete)}), diff (human-readable description), assumptions, warnings, humanReviewFlags, missingInputs, recommendations, requiresApproval: true.`
    };
  },

  explainPlan(plan) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Explain this implementation plan in detail: ${JSON.stringify(plan)}\n\nReturn JSON with: title, summary, confidence, explanations (array of {object, why, what, assumptions, risks}), implementationSequence (array of steps), timeEstimate, assumptions, warnings, humanReviewFlags, missingInputs, recommendations.`
    };
  },

  translateContent({ content, targetLanguage, sourceLanguage = 'en' }) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage: `Translate this privacy content from ${sourceLanguage} to ${targetLanguage}:\n\n${JSON.stringify(content)}\n\nReturn JSON with: title, summary, confidence, translations (object with field names as keys and translated text as values), qualityWarnings (array), assumptions, warnings, humanReviewFlags, missingInputs, recommendations. If confidence is low for any field, flag it.`
    };
  }
};

module.exports = { prompts, BASE_SYSTEM };
