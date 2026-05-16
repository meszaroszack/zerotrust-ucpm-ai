/**
 * AI Prompt Templates for ZEROTRUST AI
 *
 * CONTRACT: Every prompt instructs the model to return ONLY a JSON object
 * inside a ```json code block. No prose before or after.
 *
 * Design principle:
 *   - classify-first prompts: AI maps input to canonical IDs from the ontology
 *   - rationale-only prompts: AI adds reasoning text to deterministic outputs
 *   - free-form generation only for custom objects outside the ontology
 *
 * Prompts are deliberately SHORT and STRUCTURED to minimize AI prose risk.
 */

const { PURPOSES, DATA_ELEMENTS, CP_ARCHETYPES, CONSENT_MODELS } = require('../data/privacyOntology');

const BASE_SYSTEM =
`You are ZEROTRUST AI — a privacy implementation specialist for OneTrust UCPM/CMP deployments.
CRITICAL OUTPUT RULE: Respond with ONLY a single JSON object inside a \`\`\`json code block. Zero prose before or after. Any text outside the JSON block causes a parse failure and discards your response.`;

const JSON_REMINDER = '\n\nRespond with ONLY a ```json code block. No other text whatsoever.';

// Pre-serialize ontology for prompt injection (compact)
const PURPOSE_IDS = PURPOSES.map(p => p.id);
const DE_IDS = DATA_ELEMENTS.map(d => d.id);
const CP_IDS = CP_ARCHETYPES.map(c => c.id);
const REGION_KEYS = Object.keys(CONSENT_MODELS);

const prompts = {

  // ── Intake document: extract structured program facts ──────────────────────
  intakeDocument(content) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Analyze the following privacy program requirements and extract structured facts.

INPUT:
${content}

Return a JSON object with exactly these keys:
{
  "title": string,
  "summary": string (1-2 sentences),
  "confidence": "high"|"medium"|"low",
  "extractedContext": {
    "businessModel": string,
    "industry": string,
    "websiteFootprint": string,
    "regionsServed": [string],
    "languagesNeeded": [string],
    "purposes": string (comma-separated list from input),
    "dataElements": string (comma-separated list from input),
    "collectionPointScenarios": string,
    "complianceFrameworks": [string],
    "marketingPresence": string,
    "analyticsPresence": string,
    "knownConcerns": string
  },
  "assumptions": [string],
  "warnings": [string],
  "missingInputs": [string],
  "humanReviewFlags": [string],
  "recommendations": [string]
}
${JSON_REMINDER}`
    };
  },

  // ── Follow-up questions: gap-fill for program planning ────────────────────
  askFollowups(context) {
    const contextStr = JSON.stringify({
      businessModel: context?.businessModel,
      industry: context?.industry,
      regionsServed: context?.extractedContext?.regionsServed || context?.regionsServed,
      purposes: context?.extractedContext?.purposes || context?.purposes,
      complianceFrameworks: context?.extractedContext?.complianceFrameworks,
      knownConcerns: context?.extractedContext?.knownConcerns,
    });
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Based on this partial program context, generate expert follow-up questions to fill implementation gaps.

CONTEXT: ${contextStr}

Return JSON with:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "questions": [
    {
      "id": string (e.g. "q1"),
      "question": string,
      "category": "geography"|"business"|"dataCapture"|"languages"|"formTypes"|"marketing"|"regulatory"|"profiling",
      "required": boolean,
      "helpText": string,
      "options": [string] or null,
      "multiSelect": boolean
    }
  ],
  "assumptions": [string],
  "warnings": [string],
  "missingInputs": [string],
  "humanReviewFlags": [string],
  "recommendations": [string]
}

Rules:
- 4 to 10 questions only
- Every question with "options" must have multiSelect: true or false
- Options must be concrete values (e.g. ["Germany", "France", "UK"]) not meta-choices
- Geography and regulatory questions must always include options
${JSON_REMINDER}`
    };
  },

  // ── Extract program: classify input into canonical IDs ────────────────────
  // This prompt ONLY asks AI to select from known IDs — no free-form generation.
  extractProgram(context) {
    const contextStr = JSON.stringify(context || {}).slice(0, 4000);
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Classify this business context into canonical privacy program components.

CONTEXT: ${contextStr}

Available purpose IDs: ${JSON.stringify(PURPOSE_IDS)}
Available data element IDs: ${JSON.stringify(DE_IDS)}
Available region keys: ${JSON.stringify(REGION_KEYS)}
Available CP archetype IDs: ${JSON.stringify(CP_IDS)}

Return JSON with:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "classifiedPurposeIds": [string],
  "classifiedDeIds": [string],
  "classifiedRegions": [string],
  "classifiedCpIds": [string],
  "customPurposes": [{"name": string, "description": string, "legalBasis": "consent"|"legitimate-interest"|"contract"|"legal-obligation"|"vital-interests"|"public-task", "reasoning": string}],
  "customDataElements": [{"name": string, "description": string, "category": string, "sensitive": boolean, "reasoning": string}],
  "geoStrategy": string,
  "implementationPhases": [string],
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}

RULES:
- classifiedPurposeIds must only contain IDs from the provided list
- classifiedDeIds must only contain IDs from the provided list
- classifiedRegions must only contain keys from the provided list
- classifiedCpIds must only contain IDs from the provided list
- Only add customPurposes/customDataElements for genuine cases NOT covered by canonical IDs
${JSON_REMINDER}`
    };
  },

  // ── Generate scenarios: rationale only, no structure generation ───────────
  // The deterministic engine already built the scenarios.
  // AI adds rationale text and priority adjustments only.
  enrichScenarioRationale(scenarios) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`The following scenarios were generated by a deterministic rules engine. Add rationale text and priority adjustments only. Do not change structure, IDs, region codes, or consent postures.

SCENARIOS: ${JSON.stringify(scenarios).slice(0, 5000)}

Return JSON with:
{
  "enrichedScenarios": [
    {
      "id": string (same as input),
      "rationale": string (1-2 sentence explanation of why this scenario is needed),
      "priority": "high"|"medium"|"low",
      "implementationNotes": string
    }
  ]
}

Only return enrichedScenarios for each input scenario. Do not modify any other fields.
${JSON_REMINDER}`
    };
  },

  // ── Recommend purposes: classify + rationale, no free-form ───────────────
  recommendPurposes(context) {
    const contextStr = JSON.stringify(context || {}).slice(0, 4000);
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Classify this business context into canonical purpose IDs and add rationale.

CONTEXT: ${contextStr}
AVAILABLE PURPOSE IDs: ${JSON.stringify(PURPOSE_IDS)}

Return JSON with:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "classifiedPurposeIds": [string],
  "purposeRationale": {
    "<purposeId>": {
      "reasoning": string,
      "confidenceScore": number (0.0-1.0),
      "humanReviewRequired": boolean
    }
  },
  "customPurposes": [
    {
      "name": string,
      "description": string,
      "legalBasis": "consent"|"legitimate-interest"|"contract"|"legal-obligation"|"vital-interests"|"public-task",
      "reasoning": string,
      "confidenceScore": number,
      "humanReviewRequired": boolean
    }
  ],
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}

RULES:
- classifiedPurposeIds: only IDs from the provided list
- customPurposes: only for genuine purposes NOT in canonical list
- Do not invent purpose IDs
${JSON_REMINDER}`
    };
  },

  // ── Recommend data elements: classify + rationale ────────────────────────
  recommendDataElements(context) {
    const contextStr = JSON.stringify(context || {}).slice(0, 4000);
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Classify this business context into canonical data element IDs and add rationale.

CONTEXT: ${contextStr}
AVAILABLE DATA ELEMENT IDs: ${JSON.stringify(DE_IDS)}

Return JSON with:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "classifiedDeIds": [string],
  "deRationale": {
    "<deId>": {
      "reasoning": string,
      "confidenceScore": number (0.0-1.0),
      "humanReviewRequired": boolean
    }
  },
  "customDataElements": [
    {
      "name": string,
      "description": string,
      "category": "personal"|"sensitive"|"special-category"|"financial"|"biometric"|"location"|"behavioral"|"device"|"other",
      "sensitive": boolean,
      "reasoning": string,
      "confidenceScore": number
    }
  ],
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}

RULES:
- classifiedDeIds: only IDs from the provided list
- customDataElements: only for data types genuinely NOT in canonical list
${JSON_REMINDER}`
    };
  },

  // ── Recommend collection points: classify channels, no free-form ──────────
  recommendCollectionPoints(context) {
    const contextStr = JSON.stringify(context || {}).slice(0, 4000);
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Classify this business context into canonical collection point archetype IDs.

CONTEXT: ${contextStr}
AVAILABLE CP ARCHETYPE IDs: ${JSON.stringify(CP_IDS)}
AVAILABLE REGION KEYS: ${JSON.stringify(REGION_KEYS)}

Return JSON with:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "classifiedCpIds": [string],
  "classifiedRegions": [string],
  "cpRationale": {
    "<cpId>": {
      "reasoning": string,
      "confidenceScore": number
    }
  },
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}

RULES:
- classifiedCpIds: only IDs from the provided list
- classifiedRegions: only keys from the provided list
${JSON_REMINDER}`
    };
  },

  // ── Propose update ─────────────────────────────────────────────────────────
  proposeUpdate(request, currentState) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Current workspace state: ${JSON.stringify(currentState).slice(0, 3000)}
User request: "${request}"

Propose specific changes. Return JSON:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "affectedObjects": [{"type": string, "id": string, "name": string, "currentValue": string, "proposedValue": string, "changeType": "add"|"update"|"delete"}],
  "diff": string,
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string],
  "requiresApproval": true
}
${JSON_REMINDER}`
    };
  },

  // ── Explain plan ───────────────────────────────────────────────────────────
  explainPlan(plan) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Explain this implementation plan: ${JSON.stringify(plan).slice(0, 3000)}

Return JSON:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "explanations": [{"object": string, "why": string, "what": string, "assumptions": [string], "risks": [string]}],
  "implementationSequence": [string],
  "timeEstimate": string,
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}
${JSON_REMINDER}`
    };
  },

  // ── Translate content ──────────────────────────────────────────────────────
  translateContent({ content, targetLanguage, sourceLanguage = 'en' }) {
    return {
      systemPrompt: BASE_SYSTEM,
      userMessage:
`Translate this privacy content from ${sourceLanguage} to ${targetLanguage}.
CONTENT: ${JSON.stringify(content).slice(0, 3000)}

Return JSON:
{
  "title": string,
  "summary": string,
  "confidence": "high"|"medium"|"low",
  "translations": {},
  "qualityWarnings": [string],
  "assumptions": [string],
  "warnings": [string],
  "humanReviewFlags": [string],
  "missingInputs": [string],
  "recommendations": [string]
}
${JSON_REMINDER}`
    };
  },
};

module.exports = { prompts, BASE_SYSTEM };
