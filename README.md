# ZEROTRUST AI

**From privacy plan to live consent program.**

ZEROTRUST AI is an AI-native implementation cockpit for OneTrust UCPM/CMP deployments. It is not a generic chat wrapper or admin panel — it is a production-grade implementation tool that uses AI to translate business requirements into real OneTrust objects, scenarios, and testable consent programs.

---

## What It Is

ZEROTRUST AI lets an operator:

1. Connect to a real OneTrust testing environment (`app.onetrust.com`)
2. Create a new org under the **Meszaros - Do Not Touch** parent org
3. Upload or paste implementation requirements (PDF, plain text, or plain English)
4. Have AI ask expert follow-up questions (geography, data capture, marketing presence, regulatory concerns)
5. Generate a full implementation blueprint: purposes, data elements, scenario matrix, collection points
6. Approve and push objects directly to OneTrust
7. Simulate geo/language experiences with URL-decorated test harness
8. Request iterative updates in plain English — AI proposes diffs, human approves

---

## Meszaros Parent-Org Testing Flow

- **Parent Org**: `Meszaros - Do Not Touch` — this is the testing environment root
- **Active Org**: A new child org is created for each implementation run
- **Active Brand**: The brand/company context provided during setup
- Each implementation session is scoped to one active org until Reset is pressed
- Prior orgs remain in OneTrust as historical testing artifacts — they are never deleted

---

## Active Workspace Persistence

Workspace state is persisted server-side in `backend/data/workspace.json`.

The workspace includes:
- `parentOrgName` — always "Meszaros - Do Not Touch"
- `activeOrgId` / `activeOrgName`
- `activeBrandName`
- `status` — active or reset
- `sourceInputs` — documents and text ingested
- `scenarios` — AI-generated scenario matrix
- `purposes` — AI-recommended purpose taxonomy
- `dataElements` — AI-recommended data elements
- `collectionPoints` — collection point plans and OT references
- `changeHistory` — all AI-driven updates applied
- `aiReasoningHistory` — AI reasoning logs for every action

On app restart, the server reloads the persisted workspace and the frontend syncs on mount. The session resumes exactly where it left off.

---

## Reset Behavior

Pressing **Reset Program** in the sidebar:
- Moves the current workspace to `backend/data/history.json` (last 20 sessions preserved)
- Clears `backend/data/workspace.json`
- Clears frontend session state
- Redirects to the Connection & Setup wizard
- **Does NOT delete OneTrust orgs or artifacts** — all OT objects created during the session persist
- Always confirms before resetting

---

## AI Provider Architecture

### Active: Perplexity
Perplexity is the live AI engine. Set `PERPLEXITY_API_KEY` and `PERPLEXITY_MODEL` in your env.

Recommended model: `llama-3.1-sonar-large-128k-online`

### Scaffolded (future-ready):
- OpenAI (`openaiProvider.js`)
- Anthropic (`anthropicProvider.js`)
- Google Gemini (`geminiProvider.js`)
- Azure OpenAI (`azureOpenAIProvider.js`)
- AWS Bedrock (`bedrockProvider.js`)

All providers implement the same `complete({ messages, systemPrompt, apiKey, model })` interface defined in `aiProvider.js`. Activating a new provider only requires adding its API key in Settings.

### AI Response Contract
Every AI response includes:
```json
{
  "title": "...",
  "summary": "...",
  "confidence": "high|medium|low",
  "assumptions": [],
  "warnings": [],
  "recommendations": [],
  "proposedObjects": [],
  "missingInputs": [],
  "humanReviewFlags": []
}
```

---

## Deployment on Railway

### Prerequisites
- Railway account
- GitHub repo connected to Railway
- Node.js 18+

### Setup

1. **Push to GitHub** (done automatically by this build)

2. **Create Railway project**
   - New Project → Deploy from GitHub → select `zerotrust-ucpm-ai`

3. **Set environment variables** in Railway dashboard:

```
ONETRUST_BASE_URL=https://app.onetrust.com
ONETRUST_CLIENT_ID=your_client_id
ONETRUST_CLIENT_SECRET=your_client_secret
ONETRUST_PARENT_ORG_NAME=Meszaros - Do Not Touch
APP_ADMIN_EMAIL=your@email.com
APP_ADMIN_PASSWORD=YourSecurePassword123!
APP_SESSION_SECRET=a-long-random-string-for-jwt-signing
PERPLEXITY_API_KEY=pplx-your-key
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online
PORT=3000
NODE_ENV=production
```

4. **Build command**: `npm run build`
5. **Start command**: `npm start`
6. Railway will auto-detect the `package.json` at root

### How It Works in Production
- Railway runs `npm run build` which installs both backend and frontend deps, then builds the frontend
- The backend serves the frontend static files from `frontend/dist/`
- Single process, single port (3000)
- Workspace data persists in the Railway volume (or restarts with a fresh state — use Railway volumes for true persistence)

---

## Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ONETRUST_BASE_URL` | Yes | `https://app.onetrust.com` |
| `ONETRUST_CLIENT_ID` | Yes | OAuth2 client ID for OT API |
| `ONETRUST_CLIENT_SECRET` | Yes | OAuth2 client secret for OT API |
| `ONETRUST_PARENT_ORG_NAME` | Yes | `Meszaros - Do Not Touch` |
| `APP_ADMIN_EMAIL` | Yes | Login email for ZEROTRUST AI app |
| `APP_ADMIN_PASSWORD` | Yes | Login password |
| `APP_SESSION_SECRET` | Yes | JWT signing secret (random 32+ char string) |
| `PERPLEXITY_API_KEY` | Yes | Perplexity API key |
| `PERPLEXITY_MODEL` | No | Default: `llama-3.1-sonar-large-128k-online` |
| `PORT` | No | Default: 3000 |
| `NODE_ENV` | No | Set to `production` for Railway |

---

## Known Limitations (Beta)

1. **Workspace persistence**: Currently file-based JSON. For production, migrate to a real database (Prisma schema is scaffolded). Railway ephemeral filesystems may lose state on redeploy — use Railway volumes or a database add-on.

2. **OneTrust org creation**: Some API paths for org/tenant creation may differ between OT environments. The app gracefully falls back to a simulated org if real creation fails, clearly marking it in the UI.

3. **AI structured output**: Perplexity responses are parsed from JSON. If the model returns non-JSON prose, the app wraps it and flags it for human review. Increasing `temperature: 0.2` (already set) improves consistency.

4. **Translation quality**: AI translation is flagged with confidence levels. Always mark generated translations as requiring human review before production use.

5. **Geolocation rule groups**: OneTrust Geolocation API paths may vary by tenant configuration. The preview and assignment endpoints are wired correctly but may need adjustment for specific tenants.

6. **Single user**: Beta is designed for single-operator use. Multi-user support (user-scoped workspaces) is a future milestone.

---

## Architecture

```
zerotrust-ucpm-ai/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server
│   │   ├── middleware/auth.js    # JWT auth
│   │   ├── models/workspace.js  # Workspace + Settings persistence
│   │   ├── providers/           # AI provider abstraction
│   │   │   ├── aiProvider.js
│   │   │   ├── perplexityProvider.js  # LIVE
│   │   │   ├── openaiProvider.js      # Scaffold
│   │   │   ├── anthropicProvider.js   # Scaffold
│   │   │   ├── geminiProvider.js      # Scaffold
│   │   │   ├── azureOpenAIProvider.js # Scaffold
│   │   │   └── bedrockProvider.js     # Scaffold
│   │   ├── routes/              # All API routes
│   │   ├── services/
│   │   │   └── oneTrustClient.js  # OT API client
│   │   └── utils/aiPrompts.js   # Structured prompt templates
│   ├── data/                    # Persisted workspace/settings
│   └── uploads/                 # Uploaded documents
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/               # All 8 app pages
│   │   ├── components/          # Layout, UI components
│   │   ├── store/appStore.js    # Zustand global state
│   │   └── utils/api.js         # Axios API client
│   └── dist/                    # Built frontend (served by backend)
├── package.json                  # Root build scripts
└── railway.json                  # Railway deployment config
```

---

## Legal Disclaimer

ZEROTRUST AI provides regulatory-informed implementation recommendations, not legal advice. All AI-generated outputs should be reviewed by qualified privacy professionals before production deployment. The tool clearly marks AI recommendations as requiring human review where applicable.
