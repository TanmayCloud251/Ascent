# Ascent: AI-Powered Project-Based Coding Academy

Ascent is an interactive, project-based coding academy that transforms natural language prompts into structured full-stack engineering curriculums. Learners build real web applications step-by-step in an in-browser IDE with live preview, automated verification testing, and continuous synchronization to personal private GitHub repositories.

---

## Key Features

- **Personalized Project Generation**: Generate tailored multi-page engineering projects from user prompts via Google Gemini 2.5 Pro, validated through strict Zod schemas with multi-attempt repair harnesses.
- **Curated Projects**: High-quality pre-designed projects (such as the Greeting Login Form) available with zero API key requirement.
- **In-Browser IDE**: Monaco-powered code editor with syntax highlighting, multi-file workspace, real-time iframe execution preview, and automated browser test assertions.
- **GitHub OAuth & Account Management**: Server-side OAuth 2.0 flow with CSRF state protection, 14-day rotating sessions, and AES-256-GCM token encryption at rest.
- **Bring Your Own Key (BYOK)**: User Gemini API keys are stored exclusively in the browser's local storage/IndexedDB and transmitted via encrypted HTTPS request headers. Keys are never logged, never stored in MongoDB, and automatically redacted across all debug traces.
- **Automatic GitHub Sync**: Upon project spec confirmation, Ascent creates a private repository named `ASCENT-<project>` directly on the learner's GitHub account. Completing each module triggers a non-blocking background sync pipeline that commits learner code and updates the project README checklist via the GitHub Git Data API.
- **Fair-Use Access Governance**: Unlimited access to curated tracks. Exactly **one custom project** per learner enforced atomically in MongoDB. Custom projects with completed modules are locked to preserve learning integrity and repo sync.
- **Streaks & 26-Week Heatmap**: Activity calendar, streaks, and completion analytics calculated from verified completion records in the learner's local timezone.
- **9:16 Social Share Cards & Public Profile**: Export high-resolution vertical cards (1080x1920) with customizable visual themes (Cyber Cyan, Terminal Green, Neon Magenta) and toggle a public engineer portfolio page at `/u/:username`.
- **Production Hardened**: Hardened with Helmet HTTP security headers, CORS origin locking, rate limiters on auth and LLM routes, and multi-stage containerization.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Ascent Client (SPA)                  │
│       React 19 · Vite · Tailwind CSS · Monaco Editor   │
│  - BYOK Key Storage (IndexedDB only)                   │
│  - Local Working Copy Sync (Debounced 30s / Immediate) │
│  - 9:16 Share Card Generator & Canvas Proxy            │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (Signed Cookie Session + x-user-api-key)
┌───────────────────────────▼────────────────────────────┐
│                  Ascent Express Server                 │
│         Express 5 · Helmet · Rate Limiting · Zod       │
├───────────────────────────┬────────────────────────────┤
│ Auth & Security:          │ LLM & Generation:          │
│ - GitHub OAuth Flow       │ - GeminiProvider (BYOK)    │
│ - AES-256-GCM Token Store │ - Multi-tier Retry/Timeout │
│ - 14-Day Mongo Sessions   │ - Zero Server Key Storage  │
├───────────────────────────┼────────────────────────────┤
│ Storage & State:          │ GitHub Git Engine:         │
│ - MongoDB / GridFS        │ - Private Repo Provisioner │
│ - Atomic 1-Custom Rule    │ - Git Data API Commits     │
│ - Local Streak Calculator │ - Serialized Sync Queue    │
└───────────────────────────┴────────────────────────────┘
```

---

## GitHub OAuth & Least-Privilege Permissions

Ascent requests the following OAuth scopes:
- `repo`: Required to create private repositories on the user's personal GitHub account (`POST /user/repos`) and push module commits via the GitHub Git Data API (`POST /repos/:owner/:repo/git/commits`).
- `read:user`: To display the learner's avatar, username, and profile identity.
- `user:email`: To associate Git commits with the user's verified primary GitHub email.

> **Why `repo` scope?**  
> GitHub classic OAuth does not provide a granular "create private repos only" personal scope. The standard `public_repo` scope only allows creating public repositories, which would expose learner projects publicly. Ascent explicitly requests `repo` to ensure learner repositories remain **strictly private** to the user. A transparent consent explainer is shown before redirecting to GitHub.

---

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description |
| :--- | :--- |
| `PORT` | Server listening port (default: `3001`) |
| `APP_URL` | Canonical app origin (e.g. `http://localhost:3001` or production domain) |
| `MONGODB_URI` | MongoDB Atlas or local connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `SESSION_SECRET` | Secret key for signing session cookies |
| `TOKEN_ENCRYPTION_KEY` | Hex or alphanumeric key for AES-256-GCM token encryption at rest |
| `GEMINI_API_KEY` | Optional server-level API key for curated fallback / dev testing |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-2.5-pro`) |

---

## Development Setup

### 1. Prerequisites
- Node.js 20+ or 22+
- npm 10+
- A running MongoDB instance (or MongoDB Atlas cluster)
- A registered [GitHub OAuth Application](https://github.com/settings/developers) with callback URL:  
  `http://localhost:3001/api/auth/github/callback`

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The server runs at `http://localhost:3001` and serves both the Express API and Vite live client.

---

## Testing

Ascent includes a comprehensive test suite covering statistical computations, resilient retry mechanisms, and full Slice 7 integration:

```bash
# Run all unit and integration test suites
npx tsx --test tests/slice7Integration.test.ts tests/learnerStats.test.ts tests/moduleContentRobustness.test.ts
```

### Test Coverage Highlights:
- **`slice7Integration.test.ts`**: AES-256-GCM token encryption roundtrip, 14-day rotating sessions, atomic single custom project enforcement, 0-module deletion rules, BYOK header resolver, and public/private profile switching.
- **`learnerStats.test.ts`**: Heatmap bucket aggregations, empty states, midnight boundary calculations, streak persistence across gaps.
- **`moduleContentRobustness.test.ts`**: 120s/60s/110s timeout budget enforcement, 503 exponential backoff retries, permanent failure surfacing, and starter file cache hashing.

---

## Production Deployment

### Multi-Stage Docker Build
Ascent provides an optimized, non-root multi-stage Dockerfile:

```bash
# Build production Docker image
docker build -t ascent-academy .

# Run container
docker run -p 3001:3001 --env-file .env ascent-academy
```

For complete deployment guides on **Railway**, **Render**, or **Fly.io**, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Health Check Endpoint
- `GET /api/health`: Returns service status, MongoDB connectivity, and uptime.
