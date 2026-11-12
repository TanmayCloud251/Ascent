import express from 'express'
import type { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, Type } from '@google/genai'
import { runChecksOnFiles } from './src/services/checkRunner.js'
import { ModuleContentSchema, ReviewSubmissionResponseSchema } from './src/schemas/course.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000
const HOST = '0.0.0.0'

app.use(express.json({ limit: '10mb' }))

// ============================================================================
// GEMINI MODEL CONFIGURATION
// Note: gemini-3.6-flash and 3.5-flash have reached their 20-req/day Free Tier quota on this key.
// gemini-3.1-flash-lite has healthy quota, supports JSON schemas, and is fully active.
// ============================================================================
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'

// Dynamic Gemini client resolution (finds the first non-placeholder key)
export function getGeminiClient(): GoogleGenAI | null {
  const candidateKeys = [
    process.env.GEMINI_API_KEY,
    process.env.ASCENT_API_KEY,
    process.env.API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  ]

  const validKey = candidateKeys.find(k => {
    if (!k || typeof k !== 'string') return false
    const trimmed = k.trim()
    return (
      trimmed !== '' &&
      trimmed !== 'MY_GEMINI_API_KEY' &&
      trimmed !== 'MY_ASCENT_API_KEY' &&
      trimmed !== 'undefined' &&
      trimmed !== 'null'
    )
  })

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
  try {
    const parsed = JSON.parse(message)
    if (parsed?.error?.message) {
      if (parsed.error.code === 400 && parsed.error.status === 'INVALID_ARGUMENT') {
        return 'Gemini API key is invalid or not yet configured. Please verify your API key in Settings > Secrets and click Retry.'
      }
      if (parsed.error.code === 403 || parsed.error.status === 'PERMISSION_DENIED') {
        return 'Gemini API permission denied. Please verify your API key in Settings > Secrets, then click Retry.'
      }
      if (parsed.error.code === 429) {
        return 'Gemini API rate limit reached. Please wait a moment and click Retry.'
      }
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'The Gemini 3.8 Flash model is currently experiencing a temporary demand spike on Google servers (503 Service Unavailable). Your quota has NOT ended. Please wait 15–30 seconds and click Retry.'
      }
      return parsed.error.message
    }
  } catch {
    // not JSON string
  }
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return 'Gemini API key is invalid or expired. Please check your key in Settings > Secrets and click Retry.'
  }
  if (message.includes('503') || message.includes('high demand') || message.includes('UNAVAILABLE')) {
    return 'The Gemini 3.8 Flash model is currently experiencing a temporary demand spike on Google servers (503 Service Unavailable). Your quota has NOT ended. Please wait 15–30 seconds and click Retry.'
  }
  return message
}

// -------------------------------------------------------------
// Real Model Verification at Server Startup
// -------------------------------------------------------------
async function verifyModelAtStartup() {
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
}

// -------------------------------------------------------------
// GET /api/health
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  const ai = getGeminiClient()
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
app.get('/api/llm/status', (_req: Request, res: Response) => {
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

app.use('/api/llm', rateLimitMiddleware)

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

    const ai = getGeminiClient()
    if (!ai) {
      logEvent('generate_spec_no_api_key', { prompt })
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        model: GEMINI_MODEL,
        retryable: true
      })
    }

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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        model: GEMINI_MODEL,
        retryable: true
      })
    }

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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        model: GEMINI_MODEL,
        retryable: true
      })
    }

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
// SLICE 2 REVISED: Real Gemini structured generation for a SINGLE PAGE and its Component Syllabus
// Input: confirmed spec (incl. assumptions and outOfScope), useTailwind, ProjectMemory
// Output: ONE page with 5-10 modules in HTML document/build order
// -------------------------------------------------------------
app.post('/api/llm/generate-page', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { spec, useTailwind: rawTailwind, projectMemory } = req.body

    if (!spec || !spec.appName) {
      return res.status(400).json({ success: false, error: 'Valid ProjectSpec is required', retryable: false })
    }

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        model: GEMINI_MODEL,
        retryable: true
      })
    }

    telemetry.geminiCalls++

    const useTailwind = rawTailwind !== undefined ? Boolean(rawTailwind) : Boolean(spec.useTailwind)
    const stylingDetail = useTailwind
      ? 'Tailwind CSS utility classes directly on elements'
      : 'Plain semantic CSS with Flexbox/Grid and CSS variables'

    const memoryContext = projectMemory && projectMemory.fileTree && projectMemory.fileTree.length > 0
      ? `\nProject Architecture Context (Existing files built so far):\n- Files Built: ${projectMemory.fileTree.join(', ')}\n- Decisions Made: ${(projectMemory.decisionsMade || []).join('; ') || 'None'}`
      : '\nInitial Project Page: This is the very first page of the project (home / core landing page).'

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Generate a SINGLE PAGE and its component-by-component syllabus for the student's project.

App: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Features: ${(spec.primaryFeatures || []).map((f: any) => typeof f === 'string' ? f : `${f.name}: ${f.description}`).join('; ')}
Assumptions Made: ${(spec.assumptions || []).join('; ')}
Out of Scope (MUST NOT PLAN ANY SCREENS OR MODULES FOR THESE): ${(spec.outOfScope || []).join('; ')}
Stack: HTML, CSS, and vanilla JavaScript (${stylingDetail})
${memoryContext}

STRICT ARCHITECTURE & SYLLABUS RULES:
1. Return EXACTLY ONE page. No list of other pages.
   - For the first page, it must be the logical starting point of the app (usually index.html).
2. Generate 5 to 10 progressive modules for THIS page in HTML document/build order:
   - Order: document-head (doctype, meta, title, stylesheet or Tailwind CDN setup) -> body-layout -> header -> navigation -> main-section / content-blocks (cards, tables, lists) -> forms -> footer -> script-behavior (DOM manipulation, event listeners, localStorage persistence).
   - Each module represents ONE component of THAT page taught by building it: its markup, then its styling (${useTailwind ? 'Tailwind utility classes' : 'plain semantic CSS'}), and behavior where applicable.
   - Modules must be cumulative: each builds on the same page file so the page works after every module.
   - componentType MUST be one of:
     "document-head" | "body-layout" | "header" | "navigation" | "main-section" | "content-block" | "form" | "footer" | "script-behavior"
3. DO NOT include anything from outOfScope.
4. Titles must be specific action titles for "${spec.appName}" (e.g. "Build Axolotl Feeding Log Table Markup", "Wire Up Add Meal Button and LocalStorage Event"). No generic titles like "Introduction".
5. For this starting page, set projectComplete: false. You MUST return both 'page' and 5 to 10 progressive 'modules' in HTML document order.`

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate the starting HTML page and its 5-10 component modules in HTML document order for "${spec.appName}". Set projectComplete to false and provide all modules.`,
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
          if (!pageResult.projectComplete && (!pageResult.page || !Array.isArray(pageResult.modules) || pageResult.modules.length < 4)) {
            pageResult = null
            throw new Error('Incomplete page syllabus payload returned from model')
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
app.post('/api/llm/generate-module-content', async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { spec, page, module, useTailwind, projectMemory, currentFiles } = req.body

    if (!spec || !module || !module.title) {
      return res.status(400).json({ success: false, error: 'Valid spec and module are required', retryable: false })
    }

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        model: GEMINI_MODEL,
        retryable: true
      })
    }

    telemetry.geminiCalls++

    // Determine learner's current baseline files
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
    const stylingDetail = useTailwind
      ? 'Tailwind CSS utility classes (use classContains in checks for utility classes)'
      : 'Plain semantic CSS (use styleEquals or elementExists for styled elements)'

    const systemInstruction = `You are Ascent, an expert front-end coding instructor.
Generate a complete lesson, task, starter/solution code, declarative DOM checks, and progressive hints for a single module in the learner's web application.

Application: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Target Page: ${page?.name || 'Home Page'} (${page?.fileName || 'index.html'})
Current Module to Teach & Build:
- Title: "${module.title}"
- Objective: "${module.learningObjective}"
- Component Type: "${module.componentType}"
- Styling: ${stylingDetail}
Assumptions: ${(spec.assumptions || []).join('; ')}
Out of Scope: ${(spec.outOfScope || []).join('; ')}

LEARNER'S CURRENT FILES (BASELINE BEFORE THIS MODULE):
${baselineJson}

CRITICAL RULES FOR GENERATION:
1. starterFiles: MUST match the learner's current baseline files above. Do NOT replace them with an idealized version.
2. solutionFiles: Exactly the starterFiles plus the additions for THIS module's task.
3. lesson: Markdown explaining the core front-end concept in 2-3 short, friendly paragraphs. Include a tiny code example showing how the concept works in general (unrelated to the student's exact project answer so they apply the knowledge).
4. task: Concrete, step-by-step instructions specifying exactly what HTML elements, CSS styles, or JS behavior to add.
5. checks: 3 to 5 declarative DOM checks.
   - Allowed types: "elementExists" | "elementCount" | "textContains" | "attributeEquals" | "classContains" | "styleEquals" | "scriptDefines" | "eventResult".
   - Each check MUST test the NEW work required in this module.
   - Therefore, at least one check (and ideally all new-work checks) MUST FAIL when evaluated against starterFiles, and ALL checks MUST PASS when evaluated against solutionFiles.
   - For Tailwind projects, use "classContains" (with selector and expected class name like "flex", "bg-blue-600", "p-4").
   - For Plain CSS projects, use "styleEquals" (property and expected) or "elementExists".
   - For interactive JavaScript behavior, use "eventResult" with action { type: "click"|"input", selector: "..." } or "scriptDefines".
6. hints: 2 to 3 progressive hints:
   - Hint 1: Gentle nudge reminding of syntax or tag.
   - Hint 2: More specific architectural clue with property/attribute name.
   - Hint 3: Near-solution structure or pseudo-code.`

    const promptText = `Generate module content for module "${module.title}" (${module.learningObjective}). Return structured JSON matching the ModuleContentSchema.`

    const generateContent = async (repairContext?: string) => {
      const contents = repairContext
        ? `${promptText}\n\nIMPORTANT REPAIR REQUEST:\nThe previous attempt failed automated test harness verification:\n${repairContext}\nPlease adjust checks and solutionFiles so that checks FAIL on starterFiles and ALL PASS on solutionFiles.`
        : promptText

      const response = await ai.models.generateContent({
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
                    expected: { type: Type.STRING },
                    property: { type: Type.STRING },
                    message: { type: Type.STRING },
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
            required: ['lesson', 'task', 'starterFiles', 'solutionFiles', 'checks', 'hints']
          }
        }
      })
      return response
    }

    let response = await generateContent()
    let rawText = response.text || ''
    let parsedResult = cleanAndParseJSON(rawText)

    let starterHarness = await runChecksOnFiles(parsedResult.checks || [], parsedResult.starterFiles || [])
    let solutionHarness = await runChecksOnFiles(parsedResult.checks || [], parsedResult.solutionFiles || [])

    const needsRepair = !solutionHarness.allPassed || starterHarness.allPassed

    if (needsRepair) {
      const repairReasons: string[] = []
      if (!solutionHarness.allPassed) {
        repairReasons.push(`Solution failed ${solutionHarness.totalCount - solutionHarness.passedCount} checks: ${solutionHarness.results.filter(r => !r.passed).map(r => r.message || r.id).join('; ')}`)
      }
      if (starterHarness.allPassed) {
        repairReasons.push('All checks passed on starter files! The checks must test new additions made in this module, so at least one check must fail on starter files.')
      }

      try {
        response = await generateContent(repairReasons.join('\n'))
        rawText = response.text || ''
        parsedResult = cleanAndParseJSON(rawText)

        starterHarness = await runChecksOnFiles(parsedResult.checks || [], parsedResult.starterFiles || [])
        solutionHarness = await runChecksOnFiles(parsedResult.checks || [], parsedResult.solutionFiles || [])
      } catch (repairErr: any) {
        // Fall back to first generation if repair threw API error
      }
    }

    const validated = ModuleContentSchema.parse(parsedResult)

    return res.json({
      success: true,
      moduleContent: validated,
      verification: {
        starterHarness,
        solutionHarness
      },
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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        retryable: true
      })
    }

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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
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

    const rawText = response.text || ''
    const parsed = cleanAndParseJSON(rawText)
    const validated = ReviewSubmissionResponseSchema.parse(parsed)

    return res.json({
      success: true,
      review: validated,
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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        retryable: true
      })
    }

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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        retryable: true
      })
    }

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

    const ai = getGeminiClient()
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please set ASCENT_API_KEY or GEMINI_API_KEY in Settings > Secrets, then click Retry.',
        retryable: true
      })
    }

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
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa'
    })

    app.use(vite.middlewares)

    const server = app.listen(PORT, HOST, () => {
      console.log(`Ascent Full-Stack Dev Server running on http://${HOST}:${PORT}`)
      // Run model verification asynchronously in background so server listens immediately
      verifyModelAtStartup().catch(err => {
        console.warn('[Gemini Startup Check] Background check error:', err)
      })
    })

    server.on('error', (err) => {
      console.error('[Server] Fatal listen error:', err)
    })
  } catch (err) {
    console.error('[Server] Failed to initialize dev server:', err)
  }
}

startServer()
