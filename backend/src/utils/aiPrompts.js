/**
 * AI Prompt Templates for ZEROTRUST AI
 *
 * CONTRACT: Every prompt instructs the model to return ONLY a JSON object
 * inside a ```json code block. No prose before or after. The provider will
 * throw (not silently wrap) if this contract is violated.
 */

const BASE_SYSTEM =
`You are ZEROTRUST AI — an expert privacy implementation officer specializing in OneTrust UCPM/CMP deployments.
You think in scenarios, not in menus. Your job is to translate business requirements into actionable privacy program implementations.

CRITICAL OUTPUT RULE: Respond with ONLY a single JSON object inside a \`\`\`json code block. No prose, no explanation, no text before or after the code block. This is a machine-readable API — any text outside the JSON will cause a parse failure.

Every response must include these base keys: title (string), summary (string), confidence ("high"|"medium"|"low"), assumptions (array of strings), warnings (array of strings), recommendations (array of strings), missingInputs (array of strings), humanReviewFlags (array of strings).

Note: This is regulatory-informed implementation guidance, not legal advice. Flag anything requiring human or legal review in humanReviewFlags.`;

const JSON_REMINDER = 'Respond with ONLY a ```json code block. No other text.';

const prompts = {
  intakeDocument(content) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Analyze this document and extract all privacy program requirements:

${content}

Return JSON with: title, summary, confidence, extractedContext (object with: businessModel, industry, websiteFootprint, regionsServed, languagesNeeded, purposes, dataElements, collectionPointScenarios, complianceFrameworks, marketingPresence, analyticsPresence, knownConcerns), assumptions, warnings, missingInputs, humanReviewFlags, recommendations.

${JSON_REMINDER}`
    };
  },

  askFollowups(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Based on this partial context: ${JSON.stringify(context)}

Generate targeted expert follow-up questions that will fill the gaps needed to build a complete OneTrust consent program.

Return JSON with: title, summary, confidence, questions (array of objects — each with: id (string), question (string), category (one of: geography|business|dataCapture|languages|formTypes|marketing|regulatory|profiling), required (bool), helpText (string), options (array of strings or null)), assumptions, warnings, missingInputs, humanReviewFlags, recommendations.

The questions array must have at least 3 items and no more than 12.

${JSON_REMINDER}`
    };
  },

  extractProgram(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Given this brand/program context: ${JSON.stringify(context)}

Generate a complete privacy program model. Return JSON with: title, summary, confidence, purposes (array of {name, description, legalBasis, regions, required, confidence}), dataElements (array of {name, description, category, sensitive, linkedPurposes, confidence}), collectionPointScenarios (array of {name, region, country, state, language, consentPosture, cpType, purposes, dataElements, rationale}), geoStrategy, languageStrategy, implementationPhases (array of strings), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  generateScenarios(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Given this program context: ${JSON.stringify(context)}

Generate a complete scenario matrix. Return JSON with: title, summary, confidence, scenarios (array of {id, name, region, country, countryCode, state, stateCode, language, languageCode, consentPosture (opt-in|opt-out|notice-only|legitimate-interest), cpType (dynamic|standard|multi), purposes (array of strings), dataElements (array of strings), oneTrustObjectType, testUrl, rationale, priority, status: "pending"}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  recommendPurposes(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Given this program context: ${JSON.stringify(context)}

Recommend a purpose taxonomy for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {name, description, legalBasis (consent|legitimate-interest|contract|legal-obligation|vital-interests|public-task), regions (array of strings), required (bool), confidenceScore (number 0-1), reasoning (string), humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  recommendDataElements(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Given this program context: ${JSON.stringify(context)}

Recommend data elements for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {name, description, category (personal|sensitive|special-category|financial|biometric|location|behavioral|device|other), sensitive (bool), linkedPurposes (array of strings), retentionPeriod (string), confidenceScore (number 0-1), reasoning (string), humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  recommendCollectionPoints(context) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Given this program context and scenarios: ${JSON.stringify(context)}

Recommend collection point strategy and object definitions for OneTrust. Return JSON with: title, summary, confidence, proposedObjects (array of {scenarioId (string), name, label, description, cpType (dynamic|standard), locale, region, geoRuleGroup, purposes (array of strings), dataElements (array of strings), consentModel, version: "1.0", confidenceScore (number 0-1), reasoning (string), humanReviewRequired (bool)}), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  proposeUpdate(request, currentState) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Current workspace state: ${JSON.stringify(currentState)}

User update request: "${request}"

Propose specific changes. Return JSON with: title, summary, confidence, affectedObjects (array of {type, id, name, currentValue, proposedValue, changeType (add|update|delete)}), diff (string — human-readable description), assumptions, warnings, humanReviewFlags, missingInputs, recommendations, requiresApproval: true.

${JSON_REMINDER}`
    };
  },

  explainPlan(plan) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Explain this implementation plan in detail: ${JSON.stringify(plan)}

Return JSON with: title, summary, confidence, explanations (array of {object (string), why (string), what (string), assumptions (array of strings), risks (array of strings)}), implementationSequence (array of strings), timeEstimate (string), assumptions, warnings, humanReviewFlags, missingInputs, recommendations.

${JSON_REMINDER}`
    };
  },

  translateContent({ content, targetLanguage, sourceLanguage = 'en' }) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Translate this privacy content from ${sourceLanguage} to ${targetLanguage}:

${JSON.stringify(content)}

Return JSON with: title, summary, confidence, translations (object with field names as keys and translated text as values), qualityWarnings (array of strings), assumptions, warnings, humanReviewFlags, missingInputs, recommendations. Flag any field where translation confidence is low.

${JSON_REMINDER}`
    };
  }
};

module.exports = { prompts, BASE_SYSTEM };
