# Deployment Guide — Ascent AI Coding Academy

This document outlines step-by-step instructions for deploying Ascent to production on Railway, Render, Fly.io, or any Docker/container platform with MongoDB Atlas and GitHub OAuth.

---

## 1. Prerequisites & Services

1. **GitHub OAuth Application**:
   - Navigate to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
   - Click **New OAuth App**.
   - **Application name:** `Ascent AI Coding Academy`
   - **Homepage URL:** Your production domain (e.g. `https://ascent.up.railway.app`)
   - **Authorization callback URL:** `https://<YOUR_DOMAIN>/api/auth/github/callback`
   - Copy the generated **Client ID** and generate a **Client Secret**.
   - *Note on Scopes:* Ascent uses `repo read:user user:email` to create private repositories named `ASCENT-<project>` on the learner's personal account and commit their verified code files via GitHub's Git Data API.

2. **MongoDB Database (MongoDB Atlas)**:
   - Create a free or dedicated cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Create a database user with Read/Write permissions.
   - Network Access: Allow access from `0.0.0.0/0` or the static egress IPs of your host.
   - Obtain connection string: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/ascent?retryWrites=true&w=majority`

---

## 2. Environment Variables Checklist

Configure the following environment variables in your deployment dashboard:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB connection string (Atlas or self-hosted) | `mongodb+srv://user:pass@cluster.mongodb.net/ascent` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `Iv1.xxxxxxxxxxxx` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SESSION_SECRET` | Secret key used to sign session cookies (min 32 chars) | `openssl rand -hex 32` |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM encryption key for user tokens at rest | `openssl rand -hex 32` |
| `APP_URL` | Public HTTPS URL of the application | `https://ascent.up.railway.app` |
| `PORT` | HTTP port the server listens on | `3000` |
| `NODE_ENV` | Runtime environment | `production` |
| `GEMINI_MODEL` | (Optional) Gemini model override | `gemini-3.1-flash-lite` |

---

## 3. Deployment Options

### Option A: Railway (Recommended)

1. Fork or push this repository to GitHub.
2. In Railway, click **New Project > Deploy from GitHub repo**.
3. Select this repository.
4. Go to **Variables** and set all environment variables listed above.
5. In **Settings > Networking**, click **Generate Domain** or configure your custom domain.
6. Railway automatically detects the multi-stage `Dockerfile` and builds the production container with healthchecks enabled.

### Option B: Render

1. Create a **Web Service** in Render connected to your repository.
2. Select **Docker** as the environment.
3. Under **Environment Variables**, add the keys from the checklist above.
4. Set the **Health Check Path** to `/api/health`.
5. Deploy.

### Option C: Fly.io

1. Authenticate with `fly auth login`.
2. Launch app configuration:
   ```bash
   fly launch --no-deploy
   ```
3. Set secrets:
   ```bash
   fly secrets set \
     MONGODB_URI="..." \
     GITHUB_CLIENT_ID="..." \
     GITHUB_CLIENT_SECRET="..." \
     SESSION_SECRET="..." \
     TOKEN_ENCRYPTION_KEY="..." \
     APP_URL="https://your-app.fly.dev"
   ```
4. Deploy the multi-stage Docker container:
   ```bash
   fly deploy
   ```

---

## 4. Verification and Health Check

Once deployed, verify the installation:

1. **Health Endpoint**:
   ```bash
   curl -I https://<YOUR_DOMAIN>/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "mongo": "connected",
     "timestamp": "2026-11-15T18:20:00.000Z"
   }
   ```

2. **GitHub OAuth Flow**:
   - Visit `https://<YOUR_DOMAIN>/` when signed out.
   - Click **Start Learning with GitHub**.
   - Verify the consent explainer modal displays what access is requested and why.
   - Complete GitHub login; verify redirection back to the workspace.

3. **Curated & BYOK Execution**:
   - Curated courses (Currency Converter, Rock Paper Scissors, Tic Tac Toe, Login Greeting) work immediately without an API key.
   - Adding a user Gemini key via **BYOK Key** modal activates real-time custom course synthesis.
