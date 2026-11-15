import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { GoogleGenAI, Type } from '@google/genai'
import { runChecksOnFiles } from './src/services/checkRunner.js'
import { ModuleContentSchema, ReviewSubmissionResponseSchema } from './src/schemas/course.js'
import { TIMEOUT_CONFIG } from './src/config/timeouts.js'
import { ENV, redactSecrets, reloadEnv, isGitHubConfigured } from './src/config/env.js'
import { encryptToken, decryptToken, generateRandomToken } from './src/services/cryptoService.js'
import {
  connectToMongo,
  isMongoConnected,
  findUserById,
  findUserByGithubId,
  saveUser,
  deleteUserAndAllData,
  createSession,
  findSession,
  deleteSession,
  getProjectsByUserId,
  getProjectById,
  saveProject,
  deleteProjectRecord,
  countUserConfirmedCustomProjects,
  confirmCustomProjectSpecAtomic,
  saveLearnerProgress,
  getUserProgress,
  getProjectProgress,
  saveProjectMemory,
  getProjectMemory,
  getShareSettings,
  saveShareSettings,
  findPublicProfileByUsername,
  saveProjectAsset,
  getProjectAsset,
  MongoUser,
  MongoProject,
  MongoProgress
} from './src/services/mongoService.js'
import {
  getGitHubAuthUrl,
  exchangeCodeForGitHubToken,
  fetchGitHubUser,
  revokeGitHubToken,
  createPrivateRepoForProject,
  triggerBackgroundModuleSync
} from './src/services/githubService.js'
import { geminiProvider, resolveKeySource } from './src/services/llmProvider.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_KEY_ENV_NAMES = [
  'GEMINI_API_KEY',
  'ASCENT_API_KEY',
  'API_KEY',
  'GOOGLE_API_KEY',
  'NEXT_PUBLIC_GEMINI_API_KEY'
] as const

const PLACEHOLDER_API_KEYS = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'MY_ASCENT_API_KEY',
  'YOUR_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'undefined',
  'null'
])

export function isValidApiKeyValue(val?: string | null): val is string {
  if (!val || typeof val !== 'string') return false
  const trimmed = val.trim()
  return trimmed.length > 0 && !PLACEHOLDER_API_KEYS.has(trimmed)
}

function loadEnvFromDisk(overridePlaceholders: boolean = false): void {
  try {
    const envPath = path.join(__dirname, '.env')
    if (!fs.existsSync(envPath)) return
    const rawEnv = fs.readFileSync(envPath, 'utf8')
    for (const rawLine of rawEnv.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx <= 0) continue
      const key = line.slice(0, eqIdx).trim().replace(/^export\s+/, '')
      let value = line.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).trim()
      }
      if (!key) continue
      const currentVal = process.env[key]
      if (!currentVal || (overridePlaceholders && !isValidApiKeyValue(currentVal) && isValidApiKeyValue(value))) {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore when .env cannot be read
  }
}

loadEnvFromDisk(true)

const app = express()
const PORT = Number(process.env.PORT) || 3000
const HOST = '0.0.0.0'

// Security Headers (Helmet) & CORS
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
)

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (
    origin &&
    (origin === ENV.APP_URL ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-session-id, x-user-api-key'
    )
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.use(cookieParser(ENV.SESSION_SECRET))
app.use(express.json({ limit: '15mb' }))

// Rate limiters
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})

export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many AI generation requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
})

// Session authentication middlewares
export function getSessionIdFromRequest(req: Request): string | undefined {
  return req.signedCookies?.['ascent_session'] || req.cookies?.['ascent_session']
}

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = getSessionIdFromRequest(req)
    if (!sessionId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: login required', code: 'UNAUTHORIZED' })
    }
    const session = await findSession(sessionId)
    if (!session) {
      res.clearCookie('ascent_session')
      return res.status(401).json({ success: false, error: 'Session expired, please log in again', code: 'SESSION_EXPIRED' })
    }
    const user = await findUserById(session.userId)
    if (!user) {
      res.clearCookie('ascent_session')
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' })
    }
    ;(req as any).user = user
    ;(req as any).session = session
    next()
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal auth error' })
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const sessionId = getSessionIdFromRequest(req)
    if (sessionId) {
      const session = await findSession(sessionId)
      if (session) {
        const user = await findUserById(session.userId)
        if (user) {
          ;(req as any).user = user
          ;(req as any).session = session
        }
      }
    }
  } catch {
    // optional, continue
  }
  next()
}

// ============================================================================
// GEMINI MODEL CONFIGURATION
// ============================================================================
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'

// Dynamic Gemini client resolution (accepts optional user API key override)
export function getGeminiClient(keyOverride?: string | null): GoogleGenAI | null {
  if (keyOverride && isValidApiKeyValue(keyOverride)) {
    return new GoogleGenAI({
      apiKey: keyOverride.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    })
  }

  const findValidKey = () =>
    API_KEY_ENV_NAMES.map(name => process.env[name]).find(k => isValidApiKeyValue(k))?.trim() || null

  let validKey = findValidKey()
  if (!validKey) {
    loadEnvFromDisk(true)
    validKey = findValidKey()
  }

  if (!validKey) {
    return null
  }
  return new GoogleGenAI({
    apiKey: validKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  })
}

export function getClientForRequest(
  req: Request,
  isCurated: boolean = false
): { ai: GoogleGenAI | null; code?: string; error?: string } {
  const userApiKey = req.headers['x-user-api-key'] as string | undefined
  const keyResolution = resolveKeySource(userApiKey)
  const isSimulation =
    req.headers['x-simulate-permanent-503'] === 'true' ||
    req.headers['x-simulate-transient-503'] === 'true' ||
    process.env.ASCENT_SIMULATE_PERMANENT_503 === '1' ||
    process.env.ASCENT_SIMULATE_TRANSIENT_503 === '1'

  if (!isCurated && !keyResolution.apiKey && !isSimulation) {
    return {
      ai: null,
      code: 'no_key',
      error: 'An active Gemini API key is required for custom AI-generated projects. Please add your API key in Settings.'
    }
  }

  const ai = getGeminiClient(keyResolution.apiKey) || (isSimulation ? ({} as any) : null)
  if (!ai && !isSimulation) {
    return {
      ai: null,
      code: 'no_key',
      error: 'Gemini API client could not be initialized. Please configure an API key in Settings.'
    }
  }
  return { ai }
}

// Model startup verification state
interface ModelVerificationStatus {
  tested: boolean
  success: boolean
  model: string
  error: string | null
  responseSnippet?: string
  timestamp: string
}

let modelStatus: ModelVerificationStatus = {
  tested: false,
  success: false,
  model: GEMINI_MODEL,
  error: null,
  timestamp: new Date().toISOString()
}

// -------------------------------------------------------------
// Telemetry Tracker
// -------------------------------------------------------------
const telemetry = {
  curriculumGenerations: 0,
  curriculumAvgLatencyMs: 0,
  geminiCalls: 0,
  codeEvaluations: 0,
  codeEvaluationsPassed: 0,
  tutorQueries: 0
}

function logEvent(event: string, data: Record<string, any> = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event,
      ...data
    })
  )
}

// Clean and parse Gemini JSON responses
function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  return JSON.parse(cleaned)
}

function extractGeminiErrorMessage(err: any): string {
  if (!err) return 'Unknown error occurred while contacting Gemini API'
  const message = err.message || String(err)
  let result = message
  try {
    const parsed = JSON.parse(message)
    if (parsed?.error?.message) {
      if (parsed.error.code === 400 && parsed.error.status === 'INVALID_ARGUMENT') {
        return 'Gemini API key is invalid or not yet configured. Please verify your API key in Settings and click Retry.'
      }
      if (parsed.error.code === 403 || parsed.error.status === 'PERMISSION_DENIED') {
        return 'Gemini API permission denied. Please verify your API key in Settings, then click Retry.'
      }
      if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
        return 'Your API key hit its quota or rate limit on Google AI Studio. Please check your quota or wait a moment.'
      }
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'The Gemini model is currently experiencing a temporary demand spike on Google servers (503 Service Unavailable). Your quota has NOT ended. Please wait 15–30 seconds and click Retry.'
      }
      result = parsed.error.message
    }
  } catch {
    // not JSON string
  }
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return 'Gemini API key is invalid or expired. Please check your key in Settings and click Retry.'
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
    return 'Your API key hit its quota or rate limit on Google AI Studio. Please check your quota or wait a moment.'
  }
  if (message.includes('503') || message.includes('high demand') || message.includes('UNAVAILABLE')) {
    return 'The Gemini model is currently experiencing a temporary demand spike on Google servers (503 Service Unavailable). Your quota has NOT ended. Please wait 15–30 seconds and click Retry.'
  }
  return redactSecrets(result)
}

export interface AttemptLog {
  attempt: number
  startTimeMs: number
  durationMs: number
  success: boolean
  errorType?: string
  errorMessage?: string
  phase?: 'initial' | 'repair'
}

export function isTransientGeminiError(err: any): { isTransient: boolean; errorType: string; statusCode: number; message: string } {
  const rawMsg = String(err?.message || err || '')
  let statusCode = typeof err?.status === 'number' ? err.status : 0
  let cleanMsg = extractGeminiErrorMessage(err)

  try {
    const parsed = JSON.parse(rawMsg)
    if (parsed?.error?.code) {
      statusCode = parsed.error.code
    }
  } catch {
    // not JSON
  }

  // Non-transient errors: surface immediately without retry
  if (statusCode === 400 || rawMsg.includes('INVALID_ARGUMENT') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
    return { isTransient: false, errorType: 'HTTP_400_INVALID_ARGUMENT', statusCode: 400, message: cleanMsg }
  }
  if (statusCode === 401 || rawMsg.includes('UNAUTHENTICATED')) {
    return { isTransient: false, errorType: 'HTTP_401_UNAUTHENTICATED', statusCode: 401, message: cleanMsg }
  }
  if (statusCode === 403 || rawMsg.includes('PERMISSION_DENIED')) {
    return { isTransient: false, errorType: 'HTTP_403_PERMISSION_DENIED', statusCode: 403, message: cleanMsg }
  }
  if (rawMsg.includes('SAFETY') || rawMsg.includes('HARM_CATEGORY') || rawMsg.includes('blocked: true')) {
    return { isTransient: false, errorType: 'SAFETY_POLICY_BLOCK', statusCode: 400, message: 'Gemini safety filters flagged the content. Please modify the requirements.' }
  }

  // Transient errors: safe to retry with exponential backoff
  if (statusCode === 429 || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('rate limit')) {
    return { isTransient: true, errorType: 'HTTP_429_RATE_LIMIT', statusCode: 429, message: cleanMsg }
  }
  if (statusCode === 503 || rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
    return { isTransient: true, errorType: 'HTTP_503_UNAVAILABLE', statusCode: 503, message: cleanMsg }
  }
  if (statusCode === 502 || rawMsg.includes('502') || rawMsg.includes('Bad Gateway')) {
    return { isTransient: true, errorType: 'HTTP_502_BAD_GATEWAY', statusCode: 502, message: cleanMsg }
  }
  if (statusCode === 504 || rawMsg.includes('504') || rawMsg.includes('Gateway Timeout')) {
    return { isTransient: true, errorType: 'HTTP_504_GATEWAY_TIMEOUT', statusCode: 504, message: cleanMsg }
  }
  if (statusCode === 500 || rawMsg.includes('500') || rawMsg.includes('Internal Server Error')) {
    return { isTransient: true, errorType: 'HTTP_500_INTERNAL_SERVER_ERROR', statusCode: 500, message: cleanMsg }
  }

  const isNetworkOrTimeout =
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    rawMsg.includes('timed out') ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('ETIMEDOUT') ||
    rawMsg.includes('ECONNRESET') ||
    rawMsg.includes('ECONNREFUSED') ||
    rawMsg.includes('ENOTFOUND') ||
    rawMsg.includes('fetch failed') ||
    rawMsg.includes('UND_ERR_SOCKET')

  if (isNetworkOrTimeout) {
    return { isTransient: true, errorType: 'NETWORK_TIMEOUT_OR_CONNECTION_ERROR', statusCode: 504, message: cleanMsg }
  }

  return { isTransient: true, errorType: 'UNKNOWN_TRANSIENT_ERROR', statusCode: 500, message: cleanMsg }
}

async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  timeoutMs: number = TIMEOUT_CONFIG.SERVER_GEMINI_CALL_TIMEOUT_MS
) {
  let timer: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Gemini API call timed out after ${Math.round(timeoutMs / 1000)}s`)
      ;(err as any).name = 'TimeoutError'
      ;(err as any).status = 504
      reject(err)
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      ai.models.generateContent(params),
      timeoutPromise
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface TransientRetryOptions {
  phase: 'initial' | 'repair'
  attemptLogs: AttemptLog[]
  getRemainingBudgetMs: () => number
  simulateTransient503?: boolean
  simulatePermanent503?: boolean
}

export async function generateContentWithTransientRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  options: TransientRetryOptions
) {
  const maxRetries = TIMEOUT_CONFIG.SERVER_MAX_TRANSIENT_RETRIES // 2 retries = 3 attempts max
  let lastError: any = null

  for (let attemptIdx = 0; attemptIdx <= maxRetries; attemptIdx++) {
    const attemptNum = options.attemptLogs.length + 1
    const callStart = Date.now()

    const remainingBudget = options.getRemainingBudgetMs()
    if (remainingBudget < 3000) {
      const budgetErr = new Error(`Overall request budget exceeded (${TIMEOUT_CONFIG.SERVER_OVERALL_BUDGET_MS / 1000}s)`)
      ;(budgetErr as any).code = 'GENERATION_TIMEOUT'
      ;(budgetErr as any).status = 504
      throw budgetErr
    }

    const perCallTimeout = Math.min(TIMEOUT_CONFIG.SERVER_GEMINI_CALL_TIMEOUT_MS, remainingBudget)

    try {
      if (options.simulatePermanent503) {
        const simErr = new Error('Simulated permanent 503 service unavailable from Gemini API')
        ;(simErr as any).status = 503
        throw simErr
      }
      if (options.simulateTransient503 && attemptIdx === 0) {
        const simErr = new Error('Simulated transient 503 service unavailable on attempt 1')
        ;(simErr as any).status = 503
        throw simErr
      }

      const response = await callGeminiWithTimeout(ai, params, perCallTimeout)
      const callDuration = Date.now() - callStart
      options.attemptLogs.push({
        attempt: attemptNum,
        startTimeMs: callStart,
        durationMs: callDuration,
        success: true,
        phase: options.phase
      })
      return response
    } catch (err: any) {
      lastError = err
      const callDuration = Date.now() - callStart
      const { isTransient, errorType, message } = isTransientGeminiError(err)

      options.attemptLogs.push({
        attempt: attemptNum,
        startTimeMs: callStart,
        durationMs: callDuration,
        success: false,
        errorType,
        errorMessage: message,
        phase: options.phase
      })

      if (!isTransient || attemptIdx >= maxRetries) {
        throw err
      }

      const baseDelay = attemptIdx === 0 ? TIMEOUT_CONFIG.SERVER_BACKOFF_BASE_MS : TIMEOUT_CONFIG.SERVER_BACKOFF_STEP2_MS
      const jitter = Math.floor(Math.random() * TIMEOUT_CONFIG.SERVER_BACKOFF_JITTER_MAX_MS)
      const delayMs = baseDelay + jitter

      if (options.getRemainingBudgetMs() <= delayMs + 2000) {
        throw err
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

async function generateContentWithRetry(ai: GoogleGenAI, params: Parameters<GoogleGenAI['models']['generateContent']>[0], maxRetries = 2) {
  const dummyLogs: AttemptLog[] = []
  return await generateContentWithTransientRetry(ai, params, {
    phase: 'initial',
    attemptLogs: dummyLogs,
    getRemainingBudgetMs: () => 110_000
  })
}

// -------------------------------------------------------------
// Real Model Verification at Server Startup
// -------------------------------------------------------------
let activeVerificationPromise: Promise<void> | null = null

async function verifyModelAtStartup() {
  if (activeVerificationPromise) {
    return activeVerificationPromise
  }
  activeVerificationPromise = (async () => {
    const ai = getGeminiClient()
    if (!ai) {
      modelStatus = {
        tested: true,
        success: false,
        model: GEMINI_MODEL,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets or your environment, then click Retry.',
        timestamp: new Date().toISOString()
      }
      console.warn(`[Gemini Startup Check] PENDING: ASCENT_API_KEY or GEMINI_API_KEY is not configured or set to placeholder. Model: ${GEMINI_MODEL}`)
      return
    }

    try {
      console.log(`[Gemini Startup Check] Testing model "${GEMINI_MODEL}" with API key...`)
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'Respond with exactly: {"status":"verified"}'
      })
      const text = response.text?.trim()
      console.log(`[Gemini Startup Check] SUCCESS: Model "${GEMINI_MODEL}" responded successfully: ${text}`)
      modelStatus = {
        tested: true,
        success: true,
        model: GEMINI_MODEL,
        error: null,
        responseSnippet: text,
        timestamp: new Date().toISOString()
      }
    } catch (err: any) {
      const cleanError = extractGeminiErrorMessage(err)
      console.error(`[Gemini Startup Check] FAILED: Model "${GEMINI_MODEL}" error: ${cleanError}`)
      modelStatus = {
        tested: true,
        success: false,
        model: GEMINI_MODEL,
        error: cleanError,
        timestamp: new Date().toISOString()
      }
    }
  })().finally(() => {
    activeVerificationPromise = null
  })
  return activeVerificationPromise
}

// -------------------------------------------------------------
// GET /api/health
// -------------------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  const ai = getGeminiClient()
  if (ai && !modelStatus.success) {
    await verifyModelAtStartup()
  }
  res.json({
    status: 'ok',
    engine: 'Ascent Full-Stack Coding Academy Server',
    model: GEMINI_MODEL,
    geminiEnabled: !!ai,
    startupVerification: modelStatus,
    telemetry,
    timestamp: new Date().toISOString()
  })
})

// -------------------------------------------------------------
// GET /api/llm/status
// Exposes model verification status to client UI
// -------------------------------------------------------------
app.get('/api/llm/status', async (_req: Request, res: Response) => {
  const ai = getGeminiClient()
  if (ai && !modelStatus.success) {
    await verifyModelAtStartup()
  }
  res.json({
    model: GEMINI_MODEL,
    verified: modelStatus.success,
    error: modelStatus.error,
    tested: modelStatus.tested,
    timestamp: modelStatus.timestamp
  })
})

// -------------------------------------------------------------
// Per-Session Rate Limiting for /api/llm/* routes (Standing Rule 6)
// Max 20 requests per minute per IP/Session
// -------------------------------------------------------------
interface RateLimitBucket {
  tokens: number
  lastRefill: number
}
const rateLimits = new Map<string, RateLimitBucket>()
const RATE_LIMIT_CAPACITY = 20
const RATE_LIMIT_REFILL_MS = 60000

function rateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const sessionId = (req.headers['x-session-id'] as string) || req.ip || 'anonymous'
  const now = Date.now()
  let bucket = rateLimits.get(sessionId)

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now }
    rateLimits.set(sessionId, bucket)
  } else {
    const elapsed = now - bucket.lastRefill
    if (elapsed > RATE_LIMIT_REFILL_MS) {
      bucket.tokens = RATE_LIMIT_CAPACITY
      bucket.lastRefill = now
    }
  }

  if (bucket.tokens <= 0) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded (max 20 requests/minute). Please wait a moment before sending another request.',
      model: GEMINI_MODEL,
      retryable: true
    })
  }

  bucket.tokens--
  next()
}

app.use('/api/llm', llmLimiter)

// -------------------------------------------------------------
// Health Check Endpoint
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    mongo: isMongoConnected() ? 'connected' : 'memory_fallback',
    timestamp: new Date().toISOString()
  })
})

// -------------------------------------------------------------
// GitHub OAuth & Account Endpoints
// -------------------------------------------------------------
app.get('/api/auth/github/url', authLimiter, (_req: Request, res: Response) => {
  reloadEnv()
  if (!isGitHubConfigured()) {
    return res.status(400).json({
      success: false,
      code: 'GITHUB_NOT_CONFIGURED',
      message: 'GitHub OAuth is not configured. GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required in your .env file.',
      instructions: {
        callbackUrl: `${ENV.APP_URL}/api/auth/github/callback`,
        appUrl: ENV.APP_URL,
        steps: [
          'Go to GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App',
          `Set "Application name" to: Ascent AI Coding Academy`,
          `Set "Homepage URL" to: ${ENV.APP_URL}`,
          `Set "Authorization callback URL" to: ${ENV.APP_URL}/api/auth/github/callback`,
          'Register application and generate a Client Secret',
          'Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to your .env file'
        ]
      }
    })
  }

  const state = generateRandomToken()
  res.cookie('ascent_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000 // 10 minutes
  })
  try {
    const url = getGitHubAuthUrl(state)
    return res.json({ success: true, url })
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      code: 'GITHUB_NOT_CONFIGURED',
      message: err.message
    })
  }
})

// Dev quick-login endpoint (enabled in development mode when GitHub OAuth is not yet configured)
if (ENV.NODE_ENV !== 'production') {
  app.post('/api/auth/dev-login', authLimiter, async (req: Request, res: Response) => {
    try {
      let devUser = await findUserByGithubId(99999999)
      if (!devUser) {
        devUser = {
          id: crypto.randomUUID(),
          githubId: 99999999,
          username: 'demo-engineer',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
          displayName: 'Demo Engineer',
          email: 'demo@ascent.local',
          noreplyEmail: 'demo@users.noreply.github.com',
          encryptedToken: encryptToken('gho_mock_dev_token_for_local_testing_only'),
          plan: 'byok',
          customProjectUsed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        await saveUser(devUser)
      }

      const sessionId = generateRandomToken()
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      await createSession({
        sessionId,
        userId: devUser.id,
        expiresAt,
        createdAt: new Date(),
        userAgent: req.headers['user-agent'] as string,
        ip: req.ip
      })

      res.cookie('ascent_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        signed: true,
        maxAge: 14 * 24 * 60 * 60 * 1000
      })

      return res.json({
        success: true,
        user: {
          id: devUser.id,
          githubId: devUser.githubId,
          username: devUser.username,
          avatarUrl: devUser.avatarUrl,
          displayName: devUser.displayName,
          plan: devUser.plan,
          customProjectUsed: devUser.customProjectUsed
        }
      })
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Dev login failed' })
    }
  })
}

app.get('/api/auth/github/callback', authLimiter, async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query
    const savedState = req.cookies?.['ascent_oauth_state']

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing code parameter')
    }
    if (!state || !savedState || state !== savedState) {
      return res.status(403).send('Invalid or expired CSRF state parameter')
    }

    res.clearCookie('ascent_oauth_state')

    const accessToken = await exchangeCodeForGitHubToken(code)
    const githubUser = await fetchGitHubUser(accessToken)
    const encryptedToken = encryptToken(accessToken)

    let user = await findUserByGithubId(githubUser.id)
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        githubId: githubUser.id,
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        displayName: githubUser.name || githubUser.login,
        email: githubUser.email,
        noreplyEmail: githubUser.noreply_email,
        encryptedToken,
        plan: 'byok',
        customProjectUsed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } else {
      user.encryptedToken = encryptedToken
      user.avatarUrl = githubUser.avatar_url
      user.displayName = githubUser.name || user.displayName || user.username
      user.email = githubUser.email || user.email
      user.noreplyEmail = githubUser.noreply_email || user.noreplyEmail
      user.updatedAt = new Date()
    }
    await saveUser(user)

    const sessionId = generateRandomToken()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await createSession({
      sessionId,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
      userAgent: req.headers['user-agent'] as string,
      ip: req.ip
    })

    res.cookie('ascent_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60 * 1000
    })

    return res.redirect('/')
  } catch (err: any) {
    console.error('[GitHub Callback Error]', redactSecrets(String(err)))
    return res.status(500).send(`Authentication failed: ${redactSecrets(String(err?.message || err))}`)
  }
})

app.get('/api/auth/me', optionalAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser | undefined
  if (!user) {
    return res.json({ authenticated: false, user: null })
  }

  const session = (req as any).session
  if (session && new Date(session.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    session.expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await createSession(session)
    res.cookie('ascent_session', session.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60 * 1000
    })
  }

  const customCount = await countUserConfirmedCustomProjects(user.id)

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      plan: user.plan || 'byok',
      customProjectUsed: customCount > 0 || user.customProjectUsed === true
    }
  })
})

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const sessionId = getSessionIdFromRequest(req)
  if (sessionId) {
    await deleteSession(sessionId)
  }
  res.clearCookie('ascent_session')
  return res.json({ success: true })
})

app.post('/api/auth/disconnect', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  if (user.encryptedToken) {
    try {
      const token = decryptToken(user.encryptedToken)
      if (token) {
        await revokeGitHubToken(token)
      }
    } catch (e) {
      console.warn('Revoke token warning:', e)
    }
    user.encryptedToken = ''
    await saveUser(user)
  }
  const sessionId = getSessionIdFromRequest(req)
  if (sessionId) {
    await deleteSession(sessionId)
  }
  res.clearCookie('ascent_session')
  return res.json({ success: true, message: 'GitHub grant revoked and signed out.' })
})

app.delete('/api/auth/account', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  await deleteUserAndAllData(user.id)
  const sessionId = getSessionIdFromRequest(req)
  if (sessionId) {
    await deleteSession(sessionId)
  }
  res.clearCookie('ascent_session')
  return res.json({
    success: true,
    message: 'Account and all data deleted. Your GitHub repositories remain untouched.'
  })
})

app.get('/api/auth/proxy-avatar', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string
    if (!url || !url.startsWith('https://avatars.githubusercontent.com/')) {
      return res.status(400).send('Invalid avatar URL')
    }
    const resp = await fetch(url)
    if (!resp.ok) return res.status(resp.status).send('Avatar fetch failed')
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    const buffer = await resp.arrayBuffer()
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    return res.send(Buffer.from(buffer))
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Error proxying avatar')
  }
})

// -------------------------------------------------------------
// Projects CRUD & Access Rules Endpoints
// -------------------------------------------------------------
app.get('/api/projects', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const projects = await getProjectsByUserId(user.id)
  const progress = await getUserProgress(user.id)
  return res.json({ success: true, projects, progress })
})

app.post('/api/projects', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const { id, name, prompt, spec, useTailwind, source = 'curated', curatedSlug } = req.body
  if (!name || !id) {
    return res.status(400).json({ success: false, error: 'Project id and name are required' })
  }
  const existing = await getProjectById(id)
  const project: MongoProject = {
    id,
    userId: user.id,
    name,
    prompt: prompt || '',
    spec: spec || null,
    useTailwind: Boolean(useTailwind),
    source,
    curatedSlug,
    status: existing?.status || 'draft_spec',
    repo: existing?.repo,
    createdAt: existing?.createdAt || new Date(),
    updatedAt: new Date()
  }
  await saveProject(project)
  return res.json({ success: true, project })
})

app.post('/api/projects/confirm-spec', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const { projectId, spec } = req.body

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' })
  }

  const result = await confirmCustomProjectSpecAtomic(user.id, projectId, spec)
  if (!result.success) {
    return res.status(403).json(result)
  }

  const project = await getProjectById(projectId)
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }

  // Create GitHub repo if user has connected token and repo not yet created
  if (user.encryptedToken && (!project.repo || !project.repo.url)) {
    try {
      const token = decryptToken(user.encryptedToken)
      if (token) {
        const repoResult = await createPrivateRepoForProject(
          token,
          user.username,
          project.name,
          project.prompt || project.spec?.summary || 'Web Application',
          {
            'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${project.name}</title>\n</head>\n<body>\n  <h1>${project.name}</h1>\n  <p>Initialized with Ascent.</p>\n</body>\n</html>`
          },
          project.spec?.pages?.flatMap((p: any) => p.modules || []) || [],
          project.useTailwind ? 'HTML + Tailwind CSS + JavaScript' : 'HTML + Plain CSS + JavaScript'
        )

        project.repo = {
          name: repoResult.repoName,
          url: repoResult.repoUrl,
          defaultBranch: repoResult.defaultBranch,
          lastCommitSha: repoResult.initialCommitSha,
          syncStatus: 'synced',
          lastPushedAt: new Date()
        }
        await saveProject(project)
      }
    } catch (err: any) {
      console.warn('[GitHub Repo Creation Warning]:', redactSecrets(String(err)))
      project.repo = {
        name: `ASCENT-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        url: '',
        defaultBranch: 'main',
        syncStatus: 'failed',
        error: redactSecrets(err?.message || 'Repo creation error')
      }
      await saveProject(project)
    }
  }

  return res.json({ success: true, project })
})

app.delete('/api/projects/:id', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const projectId = req.params.id

  const project = await getProjectById(projectId)
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }

  if (project.userId !== user.id) {
    return res.status(403).json({ success: false, error: 'Access denied' })
  }

  const progressList = await getProjectProgress(user.id, projectId)
  const completedCount = progressList.filter(p => p.passed).length

  if (project.source === 'generated' && completedCount > 0) {
    return res.status(400).json({
      success: false,
      code: 'CANNOT_DELETE_ACTIVE_CUSTOM_PROJECT',
      error:
        'A custom project may be deleted only if zero modules have been completed. Once you start completing modules, the custom project slot is locked to preserve your learning history.'
    })
  }

  await deleteProjectRecord(projectId)

  if (project.source === 'generated') {
    const remainingCustom = await countUserConfirmedCustomProjects(user.id)
    if (remainingCustom === 0) {
      user.customProjectUsed = false
      await saveUser(user)
    }
  }

  return res.json({ success: true, message: 'Project deleted successfully' })
})

// -------------------------------------------------------------
// State Sync & GitHub Synchronization Endpoints
// -------------------------------------------------------------
app.post('/api/sync/state', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as MongoUser
    const { projectId, progress, files, completedModule, allModules, completedPages } = req.body

    if (Array.isArray(progress)) {
      for (const p of progress) {
        await saveLearnerProgress({
          ...p,
          userId: user.id,
          projectId: p.projectId || projectId
        })
      }
    }

    if (projectId && completedModule && files) {
      const allDone = (progress || []).filter((p: any) => p.passed).map((p: any) => p.moduleId)
      triggerBackgroundModuleSync({
        projectId,
        userId: user.id,
        moduleIndex: completedModule.moduleIndex ?? 0,
        moduleTitle: completedModule.moduleTitle || 'Module Update',
        userFiles: files,
        allModules: allModules || [],
        completedModuleIds: allDone,
        completedPages: completedPages || []
      })
    }

    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Sync error' })
  }
})

app.get('/api/github/sync-status/:projectId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const project = await getProjectById(req.params.projectId)
  if (!project || project.userId !== user.id) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }
  return res.json({
    success: true,
    repo: project.repo || null
  })
})

app.post('/api/github/retry-sync/:projectId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const project = await getProjectById(req.params.projectId)
  if (!project || project.userId !== user.id) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }
  const { files, moduleIndex = 0, moduleTitle = 'Retry Sync', allModules = [], completedPages = [] } = req.body
  const progressList = await getProjectProgress(user.id, project.id)
  const doneIds = progressList.filter(p => p.passed).map(p => p.moduleId)

  triggerBackgroundModuleSync({
    projectId: project.id,
    userId: user.id,
    moduleIndex,
    moduleTitle,
    userFiles: files || {},
    allModules,
    completedModuleIds: doneIds,
    completedPages
  })

  return res.json({ success: true, message: 'Sync queued' })
})

// -------------------------------------------------------------
// Share Settings & Public Profile Endpoints
// -------------------------------------------------------------
app.get('/api/share/settings', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const settings = await getShareSettings(user.id)
  return res.json({ success: true, settings })
})

app.put('/api/share/settings', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user as MongoUser
  const { isPublic, theme } = req.body
  const settings = {
    userId: user.id,
    isPublic: Boolean(isPublic),
    theme: theme === 'green' || theme === 'magenta' ? theme : 'cyan'
  }
  await saveShareSettings(settings as any)
  return res.json({ success: true, settings })
})

app.get('/api/u/:username', async (req: Request, res: Response) => {
  const username = req.params.username
  const profile = await findPublicProfileByUsername(username)
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Profile not found or is private' })
  }

  return res.json({
    success: true,
    user: {
      username: profile.user.username,
      displayName: profile.user.displayName,
      avatarUrl: profile.user.avatarUrl,
      createdAt: profile.user.createdAt
    },
    shareSettings: profile.shareSettings,
    stats: {
      totalProjects: profile.projects.length,
      completedModules: profile.progress.filter(p => p.passed).length,
      hintsUsed: profile.progress.reduce((sum, p) => sum + (p.hintsUsed || 0), 0)
    },
    projects: profile.projects.map(p => ({
      name: p.name,
      prompt: p.prompt,
      source: p.source,
      status: p.status,
      repoUrl: p.repo?.url
    }))
  })
})

// -------------------------------------------------------------
// Bring Your Own Key (BYOK) Validation Endpoint
// -------------------------------------------------------------
app.post('/api/llm/validate-key', async (req: Request, res: Response) => {
  const apiKey = (req.body?.apiKey || req.headers['x-user-api-key'] || '') as string
  const result = await geminiProvider.validateKey(apiKey)
  return res.json({ success: result.valid, ...result })
})

// -------------------------------------------------------------
// Binary Project Assets (GridFS with 5MB file & 10MB project caps)
// -------------------------------------------------------------
app.post('/api/projects/:projectId/assets', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { path: assetPath, mimeType, base64Content } = req.body
    if (!assetPath || !base64Content) {
      return res.status(400).json({ success: false, error: 'path and base64Content required' })
    }
    const buffer = Buffer.from(base64Content, 'base64')
    const result = await saveProjectAsset({
      projectId,
      path: assetPath,
      mimeType: mimeType || 'application/octet-stream',
      buffer
    })
    if (!result.success) {
      return res.status(400).json(result)
    }
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Asset upload error' })
  }
})

app.get('/api/projects/:projectId/assets/{*assetPath}', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId
    const assetPath = (req.params as any).assetPath
    const asset = await getProjectAsset(projectId, assetPath)
    if (!asset) {
      return res.status(404).send('Asset not found')
    }
    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.send(asset.buffer)
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Asset fetch error')
  }
})

// -------------------------------------------------------------
// POST /api/llm/generate-spec
// Real Gemini structured project specification generation (Slice 1 + Refinement Fix)
// -------------------------------------------------------------
app.post('/api/llm/generate-spec', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { prompt, useTailwind: rawUseTailwind, techStack } = req.body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Valid prompt string is required', retryable: false })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated'
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      logEvent('generate_spec_no_api_key', { prompt, code: clientResult.code })
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        model: GEMINI_MODEL,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    // FIXED STACK SCOPE:
    // Every course teaches and builds with HTML, CSS, and vanilla JavaScript ONLY.
    // No React, Vue, Zustand, npm packages, bundlers, TypeScript, or backend/server code.
    const useTailwind = rawUseTailwind !== undefined
      ? Boolean(rawUseTailwind)
      : techStack?.useTailwind !== undefined
      ? Boolean(techStack.useTailwind)
      : true

    const runtimeChoice = 'HTML + CSS + JavaScript'
    const stylingChoice = useTailwind ? 'Tailwind CSS' : 'Plain CSS'
    const stateChoice = 'Browser In-Memory State / DOM'
    const backendChoice = 'In-Browser LocalStorage / IndexedDB'

    const stylingRule = useTailwind
      ? 'Tailwind CSS utilities (learner builds with semantic HTML + Tailwind utility classes + vanilla JS DOM manipulation; avoid custom CSS except when necessary).'
      : 'Plain CSS (learner builds with semantic HTML + semantic CSS classes, CSS custom properties, and Flexbox/Grid + vanilla JS DOM manipulation; zero utility libraries).'

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Analyze the user's project idea and synthesize a complete, production-grade project specification in a single comprehensive pass.

Student Idea: "${prompt.trim()}"

STRICT FIXED STACK MANDATE:
- Stack: HTML, CSS, and vanilla JavaScript ONLY.
- Absolute Prohibition: NO React, NO Vue, NO Svelte, NO Zustand/Redux, NO TypeScript, NO npm packages, NO bundlers (Webpack/Vite/Parcel), and NO server-side/backend code.
- Styling: ${stylingRule}
- Data Persistence: In-browser only (localStorage or IndexedDB).
- Backend Scope-Down Rule: Any features requiring a real backend (e.g. payments, real email delivery, multi-user authentication, cloud databases) MUST be scoped down to realistic front-end-only equivalents (e.g. simulated checkout with receipt generator, mock auth stored in localStorage, client-side data export/import).

NO CLARIFYING QUESTIONS:
- Do NOT generate questions for the user. Instead, infer missing details sensibly, make clear engineering assumptions, and state them explicitly in 'assumptions'.
- State clearly in 'outOfScope' anything deliberately excluded because the project is front-end only.

Strict Schema Requirements:
1. appName: Creative, crisp, memorable name (e.g., "AquaFeed", "ApexPulse", "OmniTracker").
2. tagline: Under 12 words, active and punchy.
3. summary: Concise 2-3 sentences explaining what problem it solves, how it works in vanilla browser storage, and what the experience feels like.
4. targetAudience: Specific user persona.
5. primaryFeatures: Array of 4 to 6 features, each an object with:
   - name: concise feature title
   - description: one-line explanation of what it does
6. userFlows: Exactly 2 to 4 end-to-end user journeys, each an object with:
   - flowName: title of the journey (e.g., "First Feeding Log Entry", "Export Chemistry Report")
   - steps: 3 to 5 short step strings describing user interactions
7. dataEntities: 1 to 3 data models persisted in localStorage/IndexedDB, each an object with:
   - name: entity name (e.g. "FeedingRecord", "WaterReading")
   - storageKey: exact localStorage key (e.g. "axolog_feedings_v1")
   - fields: array of { name: string, type: string, description: string }
8. techStack:
   - runtime: "HTML + CSS + JavaScript"
   - styling: "${stylingChoice}"
   - stateManagement: "${stateChoice}"
   - backendSim: "${backendChoice}"
   - useTailwind: ${useTailwind}
9. useTailwind: boolean ${useTailwind}
10. architectureHighlights: 3 to 4 technical patterns (e.g., DOM query caching, event delegation, LocalStorage JSON serialization).
11. assumptions: 3 to 5 explicit decisions you made on the user's behalf (e.g., "Checkout is simulated, no real payments", "Data persists locally per browser session only").
12. outOfScope: 3 to 5 features deliberately excluded to keep the project pure front-end (e.g., "Cloud database sync", "Real SMS/email alerts").
13. estimatedScreenCount: integer between 2 and 6.
14. difficulty: "beginner" or "intermediate".
15. estimatedHours: estimated build time in hours (number between 2 and 12).`

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate a complete vanilla front-end specification for: "${prompt.trim()}".`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              appName: { type: Type.STRING },
              tagline: { type: Type.STRING },
              summary: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              primaryFeatures: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ['name', 'description']
                }
              },
              userFlows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    flowName: { type: Type.STRING },
                    steps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ['flowName', 'steps']
                }
              },
              dataEntities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    storageKey: { type: Type.STRING },
                    fields: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          type: { type: Type.STRING },
                          description: { type: Type.STRING }
                        },
                        required: ['name', 'type']
                      }
                    }
                  },
                  required: ['name', 'storageKey', 'fields']
                }
              },
              useTailwind: { type: Type.BOOLEAN },
              techStack: {
                type: Type.OBJECT,
                properties: {
                  runtime: { type: Type.STRING },
                  styling: { type: Type.STRING },
                  stateManagement: { type: Type.STRING },
                  backendSim: { type: Type.STRING },
                  useTailwind: { type: Type.BOOLEAN }
                },
                required: ['runtime', 'styling', 'stateManagement', 'backendSim', 'useTailwind']
              },
              architectureHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              assumptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              outOfScope: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              estimatedScreenCount: { type: Type.INTEGER },
              difficulty: { type: Type.STRING },
              estimatedHours: { type: Type.NUMBER }
            },
            required: [
              'appName',
              'tagline',
              'summary',
              'targetAudience',
              'primaryFeatures',
              'userFlows',
              'dataEntities',
              'useTailwind',
              'techStack',
              'architectureHighlights',
              'assumptions',
              'outOfScope',
              'estimatedScreenCount',
              'difficulty',
              'estimatedHours'
            ]
          }
        }
      })
      return {
        text: response.text,
        tokens: response.usageMetadata?.totalTokenCount || 'N/A'
      }
    }

    // Try call with single retry on invalid output as mandated by Rule #3
    let rawText: string | undefined
    let tokenCount: any = 'N/A'
    let spec: any
    let attempts = 0
    let lastError: any = null

    while (attempts < 2 && !spec) {
      attempts++
      try {
        const result = await callGemini()
        rawText = result.text
        tokenCount = result.tokens
        if (rawText) {
          spec = cleanAndParseJSON(rawText)
          if (!spec.appName || !spec.summary || !Array.isArray(spec.primaryFeatures)) {
            spec = null
            throw new Error('Incomplete specification payload returned from model')
          }
        }
      } catch (e: any) {
        lastError = e
        logEvent('generate_spec_attempt_failed', { attempt: attempts, error: e?.message })
      }
    }

    if (!spec) {
      const cleanError = extractGeminiErrorMessage(lastError)
      logEvent('generate_spec_failed_after_retries', { error: cleanError })
      return res.status(502).json({
        success: false,
        error: cleanError,
        model: GEMINI_MODEL,
        rawGeminiText: rawText || null,
        retryable: true
      })
    }

    // Ensure techStack subfields are populated
    spec.techStack = {
      runtime: spec.techStack?.runtime || runtimeChoice,
      styling: spec.techStack?.styling || stylingChoice,
      stateManagement: spec.techStack?.stateManagement || stateChoice,
      backendSim: spec.techStack?.backendSim || backendChoice
    }

    const duration = Date.now() - startTime
    logEvent('generate_spec_success', { appName: spec.appName, duration, attempts })

    return res.json({
      success: true,
      spec,
      model: GEMINI_MODEL,
      latencyMs: duration,
      rawGeminiText: rawText,
      tokensUsed: tokenCount
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    logEvent('generate_spec_unhandled_error', { error: cleanError })
    return res.status(500).json({
      success: false,
      error: cleanError,
      model: GEMINI_MODEL,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/llm/generate-screen-plan
// SLICE 2: Real Gemini structured screen plan generation
// Input: confirmed spec; Output: ordered screens [{ name, description }], 5-8 max
// -------------------------------------------------------------
app.post('/api/llm/generate-screen-plan', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { spec } = req.body

    if (!spec || !spec.appName) {
      return res.status(400).json({ success: false, error: 'Valid ProjectSpec is required', retryable: false })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated' || spec?.isCurated === true
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        model: GEMINI_MODEL,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    const useTailwind = spec.useTailwind !== undefined ? spec.useTailwind : spec.techStack?.useTailwind !== undefined ? spec.techStack.useTailwind : true
    const stylingDetail = useTailwind ? 'Tailwind CSS utility classes' : 'Plain semantic CSS with Flexbox/Grid and CSS variables'

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Given the confirmed specification for the student's project, generate an ordered screen plan.
App: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Primary Features: ${spec.primaryFeatures.join(', ')}
Tech Stack: HTML + CSS + JavaScript (${stylingDetail})

STRICT VANILLA FRONT-END ARCHITECTURE:
- Project Structure: In Ascent, each screen is its own standalone HTML file (e.g. index.html, dashboard.html, history.html, settings.html) sharing /js/*.js scripts and ${useTailwind ? 'Tailwind utility classes' : '/css/styles.css'}.
- NO React, Vue, TypeScript, or backend server code.
- Data persists in-browser only via localStorage or IndexedDB.

Strict Rules:
1. Output between 5 and 8 ordered screens.
2. The sequence MUST be in strict dependency order: each screen may only depend on screens that come earlier (e.g., initial entry/landing index.html & input forms BEFORE analytics/dashboards BEFORE detail modals/settings/exports).
3. The screens must be deeply specific to "${spec.appName}", NOT generic templates.
4. Each screen must have a distinct 'name' (2-4 words) and a crisp 'description' explaining what user actions and data mutations occur on it.`

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate the ordered screen plan (5 to 8 screens) for "${spec.appName}".`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              screens: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ['name', 'description']
                }
              }
            },
            required: ['screens']
          }
        }
      })
      return {
        text: response.text,
        tokens: response.usageMetadata?.totalTokenCount || 'N/A'
      }
    }

    let rawText: string | undefined
    let tokenCount: any = 'N/A'
    let planResult: any
    let attempts = 0
    let lastError: any = null

    while (attempts < 2 && !planResult) {
      attempts++
      try {
        const result = await callGemini()
        rawText = result.text
        tokenCount = result.tokens
        if (rawText) {
          planResult = cleanAndParseJSON(rawText)
          if (!Array.isArray(planResult.screens) || planResult.screens.length < 3) {
            planResult = null
            throw new Error('Screen plan contains insufficient screens')
          }
        }
      } catch (e: any) {
        lastError = e
        logEvent('generate_screen_plan_attempt_failed', { attempt: attempts, error: e?.message })
      }
    }

    if (!planResult) {
      const cleanError = extractGeminiErrorMessage(lastError)
      return res.status(502).json({
        success: false,
        error: cleanError,
        model: GEMINI_MODEL,
        rawGeminiText: rawText || null,
        retryable: true
      })
    }

    const duration = Date.now() - startTime
    return res.json({
      success: true,
      screens: planResult.screens.slice(0, 8),
      model: GEMINI_MODEL,
      latencyMs: duration,
      rawGeminiText: rawText,
      tokensUsed: tokenCount
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    return res.status(500).json({
      success: false,
      error: cleanError,
      model: GEMINI_MODEL,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/llm/generate-syllabus
// SLICE 2: Real Gemini structured syllabus generation for the current screen
// Input: spec, currentScreen, projectMemory; Output: 4-7 modules in dependency order
// -------------------------------------------------------------
app.post('/api/llm/generate-syllabus', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { spec, currentScreen, projectMemory } = req.body

    if (!spec || !currentScreen || !currentScreen.screenName) {
      return res.status(400).json({ success: false, error: 'Valid spec and currentScreen are required', retryable: false })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated' || spec?.isCurated === true
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        model: GEMINI_MODEL,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    const useTailwind = spec.useTailwind !== undefined ? spec.useTailwind : spec.techStack?.useTailwind !== undefined ? spec.techStack.useTailwind : true
    const stylingDetail = useTailwind ? 'Tailwind CSS utility classes' : 'Plain semantic CSS'

    const memoryContext = projectMemory
      ? `\nProject Architecture Context:\n- Tech Stack: HTML + CSS + JavaScript (${stylingDetail})\n- Naming Conventions: ${(projectMemory.namingConventions || []).join(', ') || 'semantic HTML tags, kebab-case classes or Tailwind utilities, camelCase JS functions and variables'}\n- File Tree Existing: ${(projectMemory.fileTree || []).join(', ') || 'index.html, /js/app.js'}`
      : ''

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Generate a structured teach-then-build syllabus for ONE SPECIFIC SCREEN of the student's project:
App: "${spec.appName}"
Target Screen: "${currentScreen.screenName}"
Screen Role: "${currentScreen.description}"
Stack: HTML, CSS, and vanilla JavaScript (${stylingDetail})
${memoryContext}

STRICT FIXED STACK MANDATE:
- Everything is built purely in vanilla HTML, CSS, and JavaScript.
- NO React, NO Vue, NO TypeScript, NO npm libraries.
- DOM manipulation via standard Web APIs (document.querySelector, addEventListener, innerHTML/createElement).
- Data storage strictly in localStorage or IndexedDB.
- Styling: ${useTailwind ? 'Tailwind CSS utility classes' : 'Semantic CSS with Flexbox/Grid in /css/styles.css'}.

Strict Rules:
1. Generate exactly 4 to 7 progressive modules for this screen in strict dependency order (e.g. 1. HTML markup & structural layout, 2. CSS styles or Tailwind utility styling, 3. DOM event listeners & user interactions, 4. localStorage data persistence & rendering).
2. Each module must have:
   - title: concise action-oriented title (e.g., "Build Semantic Feeding Form Markup", "Wire Up Add Meal Event Listener with localStorage", "Render Dynamic History Table from Browser Storage")
   - learningObjective: 1-2 clear sentences stating the exact web standard/DOM concept learned
   - componentType: e.g., "html_structure" | "css_layout" | "dom_event" | "local_storage" | "dom_render"
3. Output strictly valid JSON matching the schema.`

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate syllabus modules (4 to 7 modules) for Screen "${currentScreen.screenName}" in project "${spec.appName}".`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              screenName: { type: Type.STRING },
              modules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    learningObjective: { type: Type.STRING },
                    componentType: { type: Type.STRING }
                  },
                  required: ['title', 'learningObjective', 'componentType']
                }
              }
            },
            required: ['modules']
          }
        }
      })
      return {
        text: response.text,
        tokens: response.usageMetadata?.totalTokenCount || 'N/A'
      }
    }

    let rawText: string | undefined
    let tokenCount: any = 'N/A'
    let syllabusResult: any
    let attempts = 0
    let lastError: any = null

    while (attempts < 3 && !syllabusResult) {
      attempts++
      try {
        const result = await callGemini()
        rawText = result.text
        tokenCount = result.tokens
        if (rawText) {
          syllabusResult = cleanAndParseJSON(rawText)
          if (!Array.isArray(syllabusResult.modules) || syllabusResult.modules.length < 3) {
            syllabusResult = null
            throw new Error('Syllabus contains insufficient modules')
          }
        }
      } catch (e: any) {
        lastError = e
        logEvent('generate_syllabus_attempt_failed', { attempt: attempts, error: e?.message })
        if (attempts < 3) {
          await new Promise(r => setTimeout(r, 1500))
        }
      }
    }

    if (!syllabusResult) {
      const cleanError = extractGeminiErrorMessage(lastError)
      return res.status(502).json({
        success: false,
        error: cleanError,
        model: GEMINI_MODEL,
        rawGeminiText: rawText || null,
        retryable: true
      })
    }

    const duration = Date.now() - startTime
    return res.json({
      success: true,
      screenName: currentScreen.screenName,
      modules: syllabusResult.modules.slice(0, 7),
      model: GEMINI_MODEL,
      latencyMs: duration,
      rawGeminiText: rawText,
      tokensUsed: tokenCount
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    return res.status(500).json({
      success: false,
      error: cleanError,
      model: GEMINI_MODEL,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/llm/generate-page
// SLICE 2 + SLICE 5: Single page & component syllabus (Page 1 or Next Page) with ProjectMemory + hard-stop page budget.
// Input: confirmed spec (incl. assumptions and outOfScope), useTailwind, ProjectMemory (incl. completedPages, completedFiles)
// Output: ONE page with 4-10 modules in HTML document/build order, OR { projectComplete: true }
// -------------------------------------------------------------
app.post('/api/llm/generate-page', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { spec, useTailwind: rawTailwind, projectMemory } = req.body

    if (!spec || !spec.appName) {
      return res.status(400).json({ success: false, error: 'Valid ProjectSpec is required', retryable: false })
    }

    const completedPages: Array<{ name: string; fileName: string; description?: string; purpose?: string }> =
      Array.isArray(projectMemory?.completedPages) ? projectMemory.completedPages : []
    const completedPagesCount = completedPages.length
    const estimatedScreens = Number(spec.estimatedScreenCount) || 3
    const maxPages = Math.max(1, estimatedScreens + 1)

    // Hard-stop server-side: never build more than estimatedScreenCount + 1 pages
    if (completedPagesCount >= maxPages) {
      const duration = Date.now() - startTime
      logEvent('generate_page_hard_stop', {
        appName: spec.appName,
        completedPagesCount,
        maxPages
      })
      return res.json({
        success: true,
        projectComplete: true,
        hardcodedStop: true,
        model: GEMINI_MODEL,
        latencyMs: duration,
        tokensUsed: 0
      })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated' || spec?.isCurated === true
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        model: GEMINI_MODEL,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    const useTailwind = rawTailwind !== undefined ? Boolean(rawTailwind) : Boolean(spec.useTailwind)
    const stylingDetail = useTailwind
      ? 'Tailwind CSS utility classes directly on elements'
      : 'Plain semantic CSS with Flexbox/Grid and CSS variables'

    const isNextPage = completedPagesCount > 0
    const completedFilesObj: Record<string, string> =
      projectMemory?.completedFiles && typeof projectMemory.completedFiles === 'object'
        ? projectMemory.completedFiles
        : {}
    const fileTreeList: string[] = Array.isArray(projectMemory?.fileTree) && projectMemory.fileTree.length > 0
      ? projectMemory.fileTree
      : Object.keys(completedFilesObj)

    const actualFilesPreview = Object.entries(completedFilesObj)
      .slice(0, 12)
      .map(([filePath, content]) => {
        const snippet = String(content || '').slice(0, 1800)
        return `--- ${filePath} ---\n${snippet}`
      })
      .join('\n\n')

    const memoryContext = isNextPage
      ? `\nNEXT PAGE GENERATION CONTEXT (Pages completed so far: ${completedPagesCount} of max ${maxPages}):
- Completed Pages:\n${completedPages.map((p, idx) => `  ${idx + 1}. ${p.name} (${p.fileName}) — ${p.purpose || p.description || ''}`).join('\n')}
- Existing File Tree: ${fileTreeList.join(', ') || 'index.html, styles.css, app.js'}
- Decisions Made: ${(projectMemory?.decisionsMade || []).join('; ') || 'None'}
- Learner's ACTUAL Code So Far:\n${actualFilesPreview || '(empty)'}`
      : projectMemory && fileTreeList.length > 0
        ? `\nProject Architecture Context (Existing files built so far):\n- Files Built: ${fileTreeList.join(', ')}\n- Decisions Made: ${(projectMemory.decisionsMade || []).join('; ') || 'None'}`
        : '\nInitial Project Page: This is the very first page of the project (home / core landing page).'

    const nextPageRules = isNextPage
      ? `STRICT NEXT-PAGE & MULTI-PAGE RULES:
1. Decide first if ALL core features and user flows in the spec (estimatedScreenCount: ${estimatedScreens}, max budget: ${maxPages} pages) are already fulfilled by the completed page(s) above OR if another distinct HTML page adds genuine value without exceeding the budget.
   - If the app is already complete or only out-of-scope features remain, return { projectComplete: true } immediately (no page or modules).
2. Otherwise return { projectComplete: false, page, modules } for EXACTLY ONE new HTML page (unique fileName ending in .html, distinct from completed pages: ${completedPages.map(p => p.fileName).join(', ')}).
3. REUSE shared CSS/JS files (e.g. styles.css, app.js) that already exist in the project instead of duplicating styling or scripts.
4. LINK CONSISTENTLY: ensure consistent navigation links (<a href="...">) between existing completed pages and this new page. The FIRST module(s) of this new page MAY extend existing shared files (or existing navigation headers) to add nav links to the new page!
5. NEVER repeat work or components already built in completed pages.
6. Stay strictly within spec and NEVER add anything from outOfScope.`
      : `STRICT ARCHITECTURE & SYLLABUS RULES:
1. Return EXACTLY ONE page. No list of other pages.
   - For the first page, it must be the logical starting point of the app (usually index.html).`

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Generate either the next SINGLE PAGE and its component-by-component syllabus OR signal { projectComplete: true } when complete.

App: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Features: ${(spec.primaryFeatures || []).map((f: any) => typeof f === 'string' ? f : `${f.name}: ${f.description}`).join('; ')}
User Flows: ${(spec.userFlows || []).map((u: any) => `${u.flowName}: ${(u.steps || []).join(' -> ')}`).join(' | ')}
Assumptions Made: ${(spec.assumptions || []).join('; ')}
Out of Scope (MUST NOT PLAN ANY SCREENS OR MODULES FOR THESE): ${(spec.outOfScope || []).join('; ')}
Stack: HTML, CSS, and vanilla JavaScript (${stylingDetail})
Estimated Screen Count: ${estimatedScreens} (Hard Page Cap: ${maxPages}, Remaining Budget: ${maxPages - completedPagesCount})
${memoryContext}

${nextPageRules}
${isNextPage ? '7' : '2'}. When generating a page (projectComplete: false), generate 4 to 8 progressive modules for THIS page in HTML document/build order:
   - Order: document-head (doctype, meta, title, link to shared styles/scripts) -> body-layout -> header -> navigation (consistent links across existing pages & this page) -> main-section / content-blocks -> forms -> footer -> script-behavior.
   - Each module represents ONE component taught by building it: its markup, then its styling (${useTailwind ? 'Tailwind utility classes' : 'plain semantic CSS'}), and behavior where applicable.
   - Modules must be cumulative: each builds on the learner's existing workspace files + the new HTML file so the project works after every module.
   - componentType MUST be one of:
     "document-head" | "body-layout" | "header" | "navigation" | "main-section" | "content-block" | "form" | "footer" | "script-behavior"
${isNextPage ? '8' : '3'}. DO NOT include anything from outOfScope.
${isNextPage ? '9' : '4'}. Titles must be specific action titles for "${spec.appName}". No generic titles like "Introduction".
${isNextPage ? '' : '5. For this starting page, set projectComplete: false. You MUST return both \'page\' and 5 to 10 progressive \'modules\' in HTML document order.'}`

    const userPrompt = isNextPage
      ? `Decide whether "${spec.appName}" needs another page within its ${maxPages}-page budget (${completedPagesCount} already built: ${completedPages.map(p => p.fileName).join(', ')}). If all core user flows are complete, set "projectComplete": true with empty strings for "page" and "modules": []. Otherwise set "projectComplete": false, provide the next "page", and provide 4 to 8 progressive modules in "modules" reusing existing shared files and adding consistent navigation links.`
      : `Generate the starting HTML page and its 5-10 component modules in HTML document order for "${spec.appName}". Set projectComplete to false and return BOTH "page" and "modules" (5-10 items).`

    let repairNote = ''
    const callGemini = async () => {
      const promptWithRepair = repairNote
        ? `${userPrompt}\n\nREPAIR INSTRUCTION: ${repairNote}`
        : userPrompt
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptWithRepair,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              projectComplete: { type: Type.BOOLEAN },
              page: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  fileName: { type: Type.STRING },
                  purpose: { type: Type.STRING }
                },
                required: ['name', 'description', 'fileName', 'purpose']
              },
              modules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    learningObjective: { type: Type.STRING },
                    componentType: { type: Type.STRING }
                  },
                  required: ['title', 'learningObjective', 'componentType']
                }
              }
            },
            required: ['projectComplete', 'page', 'modules']
          }
        }
      })
      return {
        text: response.text,
        tokens: response.usageMetadata?.totalTokenCount || 'N/A'
      }
    }

    let rawText: string | undefined
    let tokenCount: any = 'N/A'
    let pageResult: any
    let attempts = 0
    let lastError: any = null

    while (attempts < 3 && !pageResult) {
      attempts++
      try {
        const result = await callGemini()
        rawText = result.text
        tokenCount = result.tokens
        if (rawText) {
          pageResult = cleanAndParseJSON(rawText)
          const isComplete = Boolean(pageResult.projectComplete)
          if (isComplete) {
            pageResult = { projectComplete: true }
          } else {
            if (!pageResult.page || !Array.isArray(pageResult.modules) || pageResult.modules.length < 4) {
              const hadPage = Boolean(pageResult.page?.fileName)
              const modCount = Array.isArray(pageResult.modules) ? pageResult.modules.length : 0
              repairNote = `Your previous response returned projectComplete: false (${hadPage ? `for page ${pageResult.page.fileName}` : 'without page'}) with ${modCount} modules. You MUST include the full "modules" array containing 4 to 8 module objects (each with title, learningObjective, componentType) alongside "page".`
              pageResult = null
              throw new Error('Incomplete page syllabus payload returned from model')
            }
            const existingNames = new Set(completedPages.map(p => p.fileName.toLowerCase()))
            if (isNextPage && existingNames.has(String(pageResult.page.fileName || '').toLowerCase())) {
              const slugBase = String(pageResult.page.name || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `page-${completedPagesCount + 1}`
              pageResult.page.fileName = `${slugBase}.html`
            }
          }
        }
      } catch (e: any) {
        lastError = e
        logEvent('generate_page_attempt_failed', { attempt: attempts, error: e?.message })
        if (attempts < 3) {
          await new Promise(r => setTimeout(r, 1500))
        }
      }
    }

    if (!pageResult) {
      const cleanError = extractGeminiErrorMessage(lastError)
      return res.status(502).json({
        success: false,
        error: cleanError,
        model: GEMINI_MODEL,
        rawGeminiText: rawText || null,
        retryable: true
      })
    }

    const duration = Date.now() - startTime
    logEvent('generate_page_success', { pageName: pageResult.page?.name, duration, model: GEMINI_MODEL })

    return res.json({
      success: true,
      projectComplete: Boolean(pageResult.projectComplete),
      page: pageResult.page,
      modules: pageResult.modules || [],
      model: GEMINI_MODEL,
      latencyMs: duration,
      rawGeminiText: rawText,
      tokensUsed: tokenCount
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    return res.status(500).json({
      success: false,
      error: cleanError,
      model: GEMINI_MODEL,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/llm/generate-module-content
// SLICE 3: Real Gemini structured generation for Module Lesson, Task, Starter/Solution files, Declarative Checks, and Hints.
// Server-side JSDOM verification:
// 1. Checks MUST fail on starterFiles (at least one fails, ensuring checks evaluate new work).
// 2. Checks MUST pass on solutionFiles (100% pass).
// 3. One automated repair attempt if verification fails.
// -------------------------------------------------------------
function isAllowedReferenceUrl(rawUrl: string, allowTailwind: boolean): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'developer.mozilla.org') return true
    if (allowTailwind && (host === 'tailwindcss.com' || host === 'www.tailwindcss.com')) return true
    return false
  } catch {
    return false
  }
}

app.post('/api/llm/generate-module-content', async (req: Request, res: Response) => {
  const requestStartTime = Date.now()
  const attemptLogs: AttemptLog[] = []
  const getRemainingBudgetMs = () => Math.max(0, TIMEOUT_CONFIG.SERVER_OVERALL_BUDGET_MS - (Date.now() - requestStartTime))

  const simulateTransient503 = req.headers['x-simulate-transient-503'] === 'true' || process.env.ASCENT_SIMULATE_TRANSIENT_503 === '1'
  const simulatePermanent503 = req.headers['x-simulate-permanent-503'] === 'true' || process.env.ASCENT_SIMULATE_PERMANENT_503 === '1'

  try {
    const { spec, page, module, useTailwind, projectMemory, currentFiles, assets } = req.body

    if (!spec || !module || !module.title) {
      return res.status(400).json({
        success: false,
        code: 'CONFIG_ERROR',
        message: 'Valid spec and module are required',
        error: 'Valid spec and module are required',
        retryable: false,
        attempts: attemptLogs,
        totalTimeMs: Date.now() - requestStartTime
      })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated' || spec?.isCurated === true
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        message: clientResult.error,
        error: clientResult.error,
        model: GEMINI_MODEL,
        retryable: clientResult.code !== 'no_key',
        attempts: attemptLogs,
        totalTimeMs: Date.now() - requestStartTime
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    // Determine learner's current baseline files and binary assets
    const normalizedAssets: Array<{ path: string; mimeType?: string; size?: number }> = Array.isArray(assets)
      ? assets
      : Array.isArray(projectMemory?.assets)
        ? projectMemory.assets
        : []
    const baselineFiles: { path: string; content: string }[] = []
    if (Array.isArray(currentFiles) && currentFiles.length > 0) {
      baselineFiles.push(...currentFiles)
    } else if (projectMemory?.completedFiles && Object.keys(projectMemory.completedFiles).length > 0) {
      for (const [path, content] of Object.entries(projectMemory.completedFiles)) {
        baselineFiles.push({ path, content: content as string })
      }
    } else {
      baselineFiles.push({
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${spec.appName || 'Web Application'}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n</body>\n</html>`
      })
      baselineFiles.push({
        path: 'styles.css',
        content: `/* Styles for ${spec.appName || 'Web Application'} */\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n`
      })
      baselineFiles.push({
        path: 'app.js',
        content: `// Logic for ${spec.appName || 'Web Application'}\nconsole.log('${spec.appName} initialized');\n`
      })
    }

    const baselineJson = JSON.stringify(baselineFiles, null, 2)
    const assetsListText = normalizedAssets.length > 0
      ? normalizedAssets.map(a => `${a.path} (${a.mimeType || 'binary'})`).join(', ')
      : 'None yet (live project starts with no binary assets)'
    const stylingDetail = useTailwind
      ? 'Tailwind CSS utility classes (use classContains in checks for utility classes)'
      : 'Plain semantic CSS (use styleEquals or elementExists for styled elements)'
    const referenceHostGuidance = useTailwind
      ? 'ONLY official MDN (`https://developer.mozilla.org/...`) or official Tailwind (`https://tailwindcss.com/docs/...`) URLs.'
      : 'ONLY official MDN (`https://developer.mozilla.org/...`) URLs. Do NOT include any Tailwind or third-party blog URLs.'

    const completedPagesText = Array.isArray(projectMemory?.completedPages) && projectMemory.completedPages.length > 0
      ? `Completed Pages Already Built: ${projectMemory.completedPages.map((p: any) => `${p.name} (${p.fileName})`).join(', ')}`
      : 'None yet (this is the first page)'

    const systemInstruction = `You are Ascent, an expert front-end coding instructor.
Generate a complete lesson, structured task with explicit requirements, starter/solution code, monotonic declarative DOM checks, reference links, and progressive hints for a single module in the learner's web application.

Application: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Target Page: ${page?.name || 'Home Page'} (${page?.fileName || 'index.html'})
${completedPagesText}
Current Module to Teach & Build:
- Title: "${module.title}"
- Objective: "${module.learningObjective}"
- Component Type: "${module.componentType}"
- Styling: ${stylingDetail}
Assumptions: ${(spec.assumptions || []).join('; ')}
Out of Scope: ${(spec.outOfScope || []).join('; ')}
Available Binary Assets: ${assetsListText}

LEARNER'S CURRENT FILES (BASELINE BEFORE THIS MODULE):
${baselineJson}

CRITICAL RULES FOR GENERATION:
1. starterFiles: MUST match the learner's current baseline files above. Do NOT replace them with an idealized version.
2. solutionFiles: Exactly the starterFiles plus the additions for THIS module's task.
3. lesson: Markdown explaining the core front-end concept in 2-3 short, friendly paragraphs. Include a tiny code example showing how the concept works in general (unrelated to the student's exact project answer so they apply the knowledge).
4. requirements: A precise array of bullet strings listing every required element, id, class, text snippet, attribute, style/behavior, or file path that checks rely on (no vague hints—state exact identifiers).
5. expectedResult: 1-2 sentences describing what the live preview should look like or do when the learner finishes.
6. task: Concrete markdown instructions organized as:
   - Brief goal paragraph
   - Exact requirements summary (naming every required id, class, tag, text, or asset path)
   - Tiny unrelated code snippet illustrating the pattern
   - "If you're stuck" pointer encouraging the learner to check the Hints or References below.
7. references: 2 to 4 relevant documentation links ({ title, url, note }).
   - ${referenceHostGuidance}
8. checks: 3 to 5 monotonic, robust declarative DOM checks.
   - Allowed types: "elementExists" | "elementCount" | "textContains" | "attributeEquals" | "classContains" | "styleEquals" | "scriptDefines" | "eventResult" | "imageLoaded" | "assetExists".
   - Assert presence or behavior ONLY. NEVER assert absence or exact element counts or full-text equality unless explicitly specified in requirements.
   - Include "requirementRef" (matching or summarizing the requirement item this check verifies).
   - At least one check MUST FAIL when evaluated against starterFiles, and ALL checks MUST PASS when evaluated against solutionFiles.
   - For Tailwind projects, use "classContains" (with selector and expected class name like "flex", "bg-blue-600", "p-4").
   - For Plain CSS projects, use "styleEquals" (property and expected) or "elementExists".
   - For interactive JavaScript behavior, prefer "eventResult" with action { type: "click"|"input"|"submit", selector: "..." } over raw source-text checks.
9. hints: 2 to 3 progressive hints (never dump the complete solution verbatim):
   - Hint 1: Gentle nudge reminding of syntax or tag.
   - Hint 2: Specific clue naming property/attribute/event pattern.
   - Hint 3: Near-solution structure or pseudo-code.`

    const promptText = `Generate module content for module "${module.title}" (${module.learningObjective}). Return structured JSON matching the ModuleContentSchema.`

    const generateContent = async (phase: 'initial' | 'repair' = 'initial', repairContext?: string) => {
      const contents = repairContext
        ? `${promptText}\n\nIMPORTANT REPAIR REQUEST:\nThe previous attempt failed automated test harness verification:\n${repairContext}\nPlease adjust checks and solutionFiles so that checks FAIL on starterFiles and ALL PASS on solutionFiles.`
        : promptText

      const response = await generateContentWithTransientRetry(ai, {
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lesson: { type: Type.STRING },
              task: { type: Type.STRING },
              requirements: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              expectedResult: { type: Type.STRING },
              references: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING },
                    note: { type: Type.STRING }
                  },
                  required: ['title', 'url', 'note']
                }
              },
              starterFiles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    content: { type: Type.STRING }
                  },
                  required: ['path', 'content']
                }
              },
              solutionFiles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    content: { type: Type.STRING }
                  },
                  required: ['path', 'content']
                }
              },
              checks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING },
                    selector: { type: Type.STRING },
                    path: { type: Type.STRING },
                    expected: { type: Type.STRING },
                    property: { type: Type.STRING },
                    message: { type: Type.STRING },
                    requirementRef: { type: Type.STRING },
                    action: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING },
                        selector: { type: Type.STRING },
                        value: { type: Type.STRING }
                      }
                    }
                  },
                  required: ['id', 'description', 'type']
                }
              },
              hints: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['lesson', 'task', 'requirements', 'expectedResult', 'references', 'starterFiles', 'solutionFiles', 'checks', 'hints']
          }
        }
      }, {
        phase,
        attemptLogs,
        getRemainingBudgetMs,
        simulateTransient503: phase === 'initial' ? simulateTransient503 : false,
        simulatePermanent503
      })
      return response
    }

    const filterAllowedReferences = (raw: any) => {
      if (Array.isArray(raw?.references)) {
        raw.references = raw.references.filter(
          (r: any) => r && typeof r.url === 'string' && isAllowedReferenceUrl(r.url, Boolean(useTailwind))
        )
      }
    }

    let response = await generateContent('initial')
    let rawText = response.text || ''
    let parsedResult = cleanAndParseJSON(rawText)
    // Authoritative starterFiles must match learner's actual current files
    parsedResult.starterFiles = baselineFiles
    filterAllowedReferences(parsedResult)

    const targetEntryHtml = page?.fileName || 'index.html'
    let zodCheck = ModuleContentSchema.safeParse(parsedResult)
    let starterHarness = zodCheck.success
      ? await runChecksOnFiles(zodCheck.data.checks, zodCheck.data.starterFiles, normalizedAssets, { entryHtmlPath: targetEntryHtml })
      : { allPassed: true, passedCount: 0, totalCount: 0, results: [] }
    let solutionHarness = zodCheck.success
      ? await runChecksOnFiles(zodCheck.data.checks, zodCheck.data.solutionFiles, normalizedAssets, { entryHtmlPath: targetEntryHtml })
      : { allPassed: false, passedCount: 0, totalCount: 0, results: [] }

    const initialHarness = {
      starterHarness,
      solutionHarness
    }

    const needsRepair = !zodCheck.success || !solutionHarness.allPassed || starterHarness.allPassed
    let repairAttempted = false

    if (needsRepair && getRemainingBudgetMs() >= 8000) {
      repairAttempted = true
      const repairReasons: string[] = []
      if (!zodCheck.success) {
        repairReasons.push(`Schema validation failed: ${zodCheck.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
      }
      if (!solutionHarness.allPassed) {
        repairReasons.push(`Solution failed ${solutionHarness.totalCount - solutionHarness.passedCount} checks: ${solutionHarness.results.filter(r => !r.passed).map(r => r.message || r.id).join('; ')}`)
      }
      if (starterHarness.allPassed) {
        repairReasons.push('All checks passed on starter files! The checks must test new additions made in this module, so at least one check must fail on starter files.')
      }

      try {
        telemetry.geminiCalls++
        response = await generateContent('repair', repairReasons.join('\n'))
        rawText = response.text || ''
        parsedResult = cleanAndParseJSON(rawText)
        parsedResult.starterFiles = baselineFiles
        filterAllowedReferences(parsedResult)

        zodCheck = ModuleContentSchema.safeParse(parsedResult)
        if (zodCheck.success) {
          starterHarness = await runChecksOnFiles(zodCheck.data.checks, zodCheck.data.starterFiles, normalizedAssets, { entryHtmlPath: targetEntryHtml })
          solutionHarness = await runChecksOnFiles(zodCheck.data.checks, zodCheck.data.solutionFiles, normalizedAssets, { entryHtmlPath: targetEntryHtml })
        }
      } catch (repairErr: any) {
        // Keep initial state so gate below returns explicit retryable error
      }
    }

    const succeededAttempt = attemptLogs.find(a => a.success)?.attempt || 1

    if (!zodCheck.success || !solutionHarness.allPassed || starterHarness.allPassed) {
      const failureDetails: string[] = []
      if (!zodCheck.success) {
        failureDetails.push(`Schema validation failed: ${zodCheck.error.issues[0]?.message || 'Invalid JSON structure'}`)
      } else {
        if (starterHarness.allPassed) {
          failureDetails.push('All checks passed on starterFiles without requiring new work.')
        }
        if (!solutionHarness.allPassed) {
          const failedList = solutionHarness.results.filter(r => !r.passed).map(r => r.message || r.id).join('; ')
          failureDetails.push(`Solution failed verification: ${failedList}`)
        }
      }

      return res.status(422).json({
        success: false,
        code: 'VALIDATION_FAILED',
        error: `Module generation failed automated JSDOM verification after ${repairAttempted ? 'repair attempt' : 'generation'}: ${failureDetails.join(' ')}`,
        message: `Generated module failed automated test harness verification: ${failureDetails.join(' ')}`,
        retryable: true,
        model: GEMINI_MODEL,
        attempts: attemptLogs,
        attemptCount: attemptLogs.length,
        succeededAttempt,
        totalTimeMs: Date.now() - requestStartTime,
        verification: {
          starterHarness,
          solutionHarness,
          initialHarness,
          repairAttempted
        }
      })
    }

    return res.json({
      success: true,
      moduleContent: zodCheck.data,
      verification: {
        starterHarness,
        solutionHarness,
        initialHarness,
        repairAttempted
      },
      latencyMs: Date.now() - requestStartTime,
      model: GEMINI_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount || 'N/A',
      attempts: attemptLogs,
      attemptCount: attemptLogs.length,
      succeededAttempt,
      totalTimeMs: Date.now() - requestStartTime
    })
  } catch (err: any) {
    const { errorType, statusCode, message } = isTransientGeminiError(err)
    let errorCode = 'INTERNAL_ERROR'
    if (statusCode === 503 || errorType === 'HTTP_503_UNAVAILABLE') {
      errorCode = 'GEMINI_UNAVAILABLE'
    } else if (err?.name === 'TimeoutError' || errorType.includes('TIMEOUT') || (err as any).code === 'GENERATION_TIMEOUT') {
      errorCode = 'GENERATION_TIMEOUT'
    } else if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      errorCode = 'CONFIG_ERROR'
    } else if (errorType === 'SAFETY_POLICY_BLOCK') {
      errorCode = 'SAFETY_POLICY_BLOCK'
    }

    const isRetryable = statusCode !== 400 && statusCode !== 401 && statusCode !== 403 && errorCode !== 'SAFETY_POLICY_BLOCK'

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      code: errorCode,
      message: message || 'Failed to generate module lesson & tasks.',
      error: message || 'Failed to generate module lesson & tasks.',
      retryable: isRetryable,
      model: GEMINI_MODEL,
      attempts: attemptLogs,
      attemptCount: attemptLogs.length,
      totalTimeMs: Date.now() - requestStartTime
    })
  }
})

// -------------------------------------------------------------
// POST /api/llm/review-submission
// SLICE 4: Socratic code explanation for failed checks.
// Explains errors and guides learner toward fix without revealing full solution.
// -------------------------------------------------------------
app.post('/api/llm/review-submission', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { module, userFiles, failedChecks } = req.body

    if (!module || !failedChecks) {
      return res.status(400).json({ success: false, error: 'Module and failedChecks are required', retryable: false })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated'
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.geminiCalls++

    const systemInstruction = `You are Ascent's Socratic Coding Mentor.
A learner is working on a module in their vanilla web project and has failed one or more automated DOM assertions.
Your job is to guide them to fix the errors themselves.

PEDAGOGICAL RULES:
1. Explain WHAT is missing or incorrect in simple, encouraging terms.
2. Provide 2 to 3 targeted suggestions (pointing out the specific HTML tag, CSS property, or JS event listener to check).
3. NEVER provide the complete copy-paste solution code. Keep hints conceptual or short syntax snippets.`

    const contents = `Module: "${module.title}"
Task: ${module.task || module.learningObjective || 'Complete module task'}
Failed Checks:
${JSON.stringify(failedChecks, null, 2)}

Learner's Current Files:
${JSON.stringify(userFiles, null, 2)}

Provide feedback explaining why the checks failed and actionable suggestions.`

    const callReview = (repairHint?: string) => generateContentWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: repairHint ? `${contents}\n\nREPAIR VALIDATION ERROR:\n${repairHint}` : contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feedback: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['feedback', 'suggestions']
        }
      }
    })

    let response = await callReview()
    let rawText = response.text || ''
    let parsed = cleanAndParseJSON(rawText)
    let reviewCheck = ReviewSubmissionResponseSchema.safeParse(parsed)

    if (!reviewCheck.success) {
      telemetry.geminiCalls++
      response = await callReview(reviewCheck.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
      rawText = response.text || ''
      parsed = cleanAndParseJSON(rawText)
      reviewCheck = ReviewSubmissionResponseSchema.safeParse(parsed)
    }

    if (!reviewCheck.success) {
      return res.status(422).json({
        success: false,
        error: `Review output failed schema validation: ${reviewCheck.error.issues[0]?.message || 'Invalid format'}`,
        retryable: true,
        model: GEMINI_MODEL
      })
    }

    return res.json({
      success: true,
      review: reviewCheck.data,
      latencyMs: Date.now() - startTime,
      model: GEMINI_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount || 'N/A'
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    return res.status(500).json({
      success: false,
      error: cleanError,
      model: GEMINI_MODEL,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/generate-curriculum
// Real AI-powered project curriculum decomposition
// STRICT: Returns error on failure, zero mock fallbacks.
// -------------------------------------------------------------
app.post('/api/generate-curriculum', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { prompt, techStack = ['React 19', 'JavaScript', 'Tailwind CSS'] } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt is required' })
    }

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated'
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.curriculumGenerations++

    const systemInstruction = `You are Ascent, an expert computer science curriculum architect and senior software engineer.
A student wants to build: "${prompt}" using ${techStack.join(', ')}.
Decompose this into a structured teach-then-build coding syllabus with real starter code and test cases.
Output strictly valid JSON matching:
{
  "title": "Project Title",
  "domain": "ecommerce | dashboard | taskmanager | portfolio | tool",
  "concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "wireframe": {
    "type": "dashboard",
    "title": "Main Screen",
    "route": "/app",
    "layout": "Header Top + 3-Col KPI Grid + Main Data Table",
    "colorTheme": "Cyber Cyan & Slate Dark",
    "accentColor": "#00F0FF",
    "components": [
      { "id": "wf-1", "name": "Header", "type": "Header", "role": "Navigation", "mockPreview": "Preview" }
    ]
  },
  "starterFiles": {
    "src/components/Header.jsx": "// Code here"
  },
  "moduleDetails": {
    "title": "Module 1",
    "theoryMarkdown": "Theory",
    "testCases": [
      { "id": "tc-1", "description": "Test description", "testCode": "expect(allCode).toMatch(/header/i);" }
    ]
  }
}`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Synthesize a modular teach-then-build curriculum plan for: "${prompt}". Stack: ${techStack.join(', ')}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    })

    const rawText = response.text?.trim()
    if (!rawText) {
      throw new Error('Gemini returned an empty curriculum response.')
    }

    const parsed = cleanAndParseJSON(rawText)
    const duration = Date.now() - startTime

    return res.json({
      success: true,
      isAIGenerated: true,
      curriculum: parsed,
      model: GEMINI_MODEL,
      latencyMs: duration
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    logEvent('curriculum_generation_error', { error: cleanError })
    return res.status(502).json({
      success: false,
      error: cleanError,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/evaluate-code
// Real Gemini code review evaluation
// STRICT: Returns error on failure, zero mock fallbacks.
// -------------------------------------------------------------
app.post('/api/evaluate-code', async (req: Request, res: Response) => {
  try {
    const { codeFiles = {}, moduleTitle = '', componentName = '' } = req.body

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated'
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.codeEvaluations++

    const allCode = Object.entries(codeFiles)
      .map(([filePath, content]) => `// File: ${filePath}\n${content}`)
      .join('\n\n')

    const prompt = `Review this student's code implementation for the component "${componentName}" in module "${moduleTitle}".
Code files:
${allCode}

Evaluate whether the student has implemented meaningful, working logic according to modern engineering practices.
Respond ONLY in JSON format:
{
  "passed": true/false,
  "score": number between 0 and 100,
  "feedback": "Encouraging Socratic feedback analyzing what they wrote",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    })

    const text = response.text?.trim()
    if (!text) {
      throw new Error('Empty evaluation received from model.')
    }

    const parsed = cleanAndParseJSON(text)
    if (parsed.passed) {
      telemetry.codeEvaluationsPassed++
    }

    return res.json({
      success: true,
      evaluation: parsed,
      model: GEMINI_MODEL
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    logEvent('code_evaluation_error', { error: cleanError })
    return res.status(502).json({
      success: false,
      error: cleanError,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// POST /api/ask-tutor
// Real Socratic tutor chat
// STRICT: Returns error on failure, zero mock fallbacks.
// -------------------------------------------------------------
app.post('/api/ask-tutor', async (req: Request, res: Response) => {
  try {
    const { question, activeFile = '', currentCode = '', moduleTitle = '', testFailureLog = '' } = req.body

    const isCurated = req.body?.isCurated === true || req.body?.curated === true || req.body?.source === 'curated'
    const clientResult = getClientForRequest(req, isCurated)
    if (!clientResult.ai) {
      return res.status(clientResult.code === 'no_key' ? 400 : 503).json({
        success: false,
        code: clientResult.code || 'no_key',
        error: clientResult.error,
        retryable: clientResult.code !== 'no_key'
      })
    }
    const ai = clientResult.ai

    telemetry.tutorQueries++

    const systemInstruction = `You are Ascent's Socratic Mentor, an elite, patient senior engineering coach.
Strict Rules:
- STRICTLY BAN full completed solutions or direct code dumps for current student tasks.
- Keep answers strictly under 120 words.
- Provide conceptual explanations, analogies, and small 2-3 line syntax snippets only.
- If test failure logs are provided, diagnose why the test failed conceptually without giving away the answer.`

    const diagnosticContext = testFailureLog ? `\nRecent Test Failure Diagnostic: "${testFailureLog}"` : ''

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `The student is working on file "${activeFile}" in "${moduleTitle}".${diagnosticContext}
Current code snippet:
\`\`\`
${currentCode.slice(0, 1000)}
\`\`\`
Student's question: "${question}"`,
      config: {
        systemInstruction
      }
    })

    const text = response.text?.trim()
    if (!text) {
      throw new Error('Empty tutor answer received from model.')
    }

    return res.json({
      success: true,
      answer: text,
      model: GEMINI_MODEL
    })
  } catch (err: any) {
    const cleanError = extractGeminiErrorMessage(err)
    logEvent('tutor_query_error', { error: cleanError })
    return res.status(502).json({
      success: false,
      error: cleanError,
      retryable: true
    })
  }
})

// -------------------------------------------------------------
// Mount Vite middlewares in development
// -------------------------------------------------------------
async function startServer() {
  try {
    // Initialize MongoDB connection (or resilient memory store fallback)
    await connectToMongo().catch(err => {
      console.warn('[Server] MongoDB background connection warning:', err)
    })

    if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(__dirname, 'dist')
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath))
        app.get('*', (req, res, next) => {
          if (req.path.startsWith('/api')) return next()
          res.sendFile(path.join(distPath, 'index.html'))
        })
      }
    } else {
      const { createServer: createViteServer } = await import('vite')
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa'
      })

      app.use(vite.middlewares)
    }

    const server = app.listen(PORT, HOST, () => {
      console.log(`Ascent Full-Stack Server running on http://${HOST}:${PORT}`)
      verifyModelAtStartup().catch(err => {
        console.warn('[Gemini Startup Check] Background check error:', err)
      })
    })

    server.timeout = TIMEOUT_CONFIG.SERVER_REQUEST_TIMEOUT_MS
    server.requestTimeout = TIMEOUT_CONFIG.SERVER_REQUEST_TIMEOUT_MS
    server.headersTimeout = TIMEOUT_CONFIG.SERVER_REQUEST_TIMEOUT_MS + 5_000
    server.keepAliveTimeout = 65_000

    server.on('error', (err) => {
      console.error('[Server] Fatal listen error:', err)
    })
  } catch (err) {
    console.error('[Server] Failed to initialize server:', err)
  }
}

export { app }

const isDirectExecution = Boolean(
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js'))
)

if (isDirectExecution && !process.env.NODE_TEST_CONTEXT) {
  startServer()
}
