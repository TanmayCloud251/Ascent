import express from 'express'
import type { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, Type } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000
const HOST = '0.0.0.0'

app.use(express.json({ limit: '10mb' }))

// ============================================================================
// GEMINI MODEL CONFIGURATION (Defined in ONE constant as required by spec)
// ============================================================================
export const GEMINI_MODEL = 'gemini-3.8-flash'

// Dynamic Gemini client resolution (reads GEMINI_API_KEY or ASCENT_API_KEY on each invocation)
export function getGeminiClient(): GoogleGenAI | null {
  const currentKey =
    process.env.GEMINI_API_KEY ||
    process.env.ASCENT_API_KEY ||
    process.env.API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''

  if (
    !currentKey ||
    currentKey === 'MY_GEMINI_API_KEY' ||
    currentKey === 'MY_ASCENT_API_KEY' ||
    currentKey.trim() === ''
  ) {
    return null
  }
  return new GoogleGenAI({
    apiKey: currentKey,
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
      return parsed.error.message
    }
  } catch {
    // not JSON string
  }
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return 'Gemini API key is invalid or expired. Please check your key in Settings > Secrets and click Retry.'
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
    const { prompt, techStack, previousSpec, clarifyingAnswers } = req.body

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

    const runtimeChoice = techStack?.runtime === 'Vanilla DOM' ? 'Vanilla DOM' : 'React 19'
    const stylingChoice = techStack?.styling || 'Tailwind CSS v4'
    const stateChoice = techStack?.stateManagement || (runtimeChoice === 'React 19' ? 'React State / Hooks' : 'Vanilla Event Emitter')
    const backendChoice = techStack?.backendSim || 'Browser In-Memory State'

    const answersContext = clarifyingAnswers && Object.keys(clarifyingAnswers).length > 0
      ? `\nStudent Decisions on Architectural Questions:\n${Object.entries(clarifyingAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nIncorporate these decisions directly into the revised architectureHighlights and primaryFeatures.`
      : ''

    const previousSpecContext = previousSpec
      ? `\nPrevious Draft Spec to Refine:\n${JSON.stringify({ appName: previousSpec.appName, summary: previousSpec.summary, features: previousSpec.primaryFeatures }, null, 2)}`
      : ''

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Analyze the user's project idea and synthesize a complete, production-grade project specification.

Student Idea: "${prompt.trim()}"
Preferred Stack:
- Runtime: ${runtimeChoice}
- Styling: ${stylingChoice}
- State Management: ${stateChoice}
- Backend Simulation: ${backendChoice}
${answersContext}${previousSpecContext}

Strict Constraints:
1. appName: Creative, crisp, memorable name (e.g., "ApexPulse", "OmniBoard", "FluxCommerce").
2. tagline: Under 12 words, active and punchy.
3. summary: Concise 2-3 sentences explaining what problem it solves and what the user experience feels like.
4. targetAudience: Specific user persona or developer target.
5. primaryFeatures: Exactly 4 to 6 concrete, interactive features that will be built screen-by-screen.
6. techStack: MUST strictly match the requested runtime ("${runtimeChoice}"), styling ("${stylingChoice}"), stateManagement ("${stateChoice}"), and backendSim ("${backendChoice}").
7. architectureHighlights: 3 to 4 technical patterns or architectural constraints reflecting user choices.
8. clarifyingQuestions: Exactly 2 to 3 genuine architectural clarifying questions to present to the student before building. Each question must include an id (e.g. "q1", "q2"), a clear question string, and 2 to 4 distinct plain-text option strings. If previous answers are provided, preserve question IDs and mark selectedAnswer.`

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate a production project specification for: "${prompt.trim()}"`,
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
                items: { type: Type.STRING }
              },
              techStack: {
                type: Type.OBJECT,
                properties: {
                  runtime: { type: Type.STRING },
                  styling: { type: Type.STRING },
                  stateManagement: { type: Type.STRING },
                  backendSim: { type: Type.STRING }
                },
                required: ['runtime', 'styling', 'stateManagement', 'backendSim']
              },
              architectureHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              clarifyingQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ['id', 'question', 'options']
                }
              }
            },
            required: [
              'appName',
              'tagline',
              'summary',
              'targetAudience',
              'primaryFeatures',
              'techStack',
              'architectureHighlights',
              'clarifyingQuestions'
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
    if (!spec.clarifyingQuestions || !Array.isArray(spec.clarifyingQuestions)) {
      spec.clarifyingQuestions = []
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

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Given the confirmed specification for the student's project, generate an ordered screen plan.
App: "${spec.appName}" - ${spec.tagline}
Summary: ${spec.summary}
Primary Features: ${spec.primaryFeatures.join(', ')}
Tech Stack: ${spec.techStack.runtime}, ${spec.techStack.styling}, ${spec.techStack.stateManagement}

Strict Rules:
1. Output between 5 and 8 ordered screens.
2. The sequence MUST be in strict dependency order: each screen may only depend on screens that come earlier (e.g., shell/layout & data entry/input BEFORE aggregate dashboards/analytics BEFORE detail modals/export settings).
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

    const memoryContext = projectMemory
      ? `\nProject Architecture Context:\n- Tech Stack: ${projectMemory.techStack || spec.techStack.runtime}\n- Naming Conventions: ${(projectMemory.namingConventions || []).join(', ') || 'PascalCase components, camelCase hooks'}\n- File Tree Existing: ${(projectMemory.fileTree || []).join(', ') || 'None yet (initial screen)'}`
      : ''

    const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
Generate a structured teach-then-build syllabus for ONE SPECIFIC SCREEN of the student's project:
App: "${spec.appName}"
Target Screen: "${currentScreen.screenName}"
Screen Role: "${currentScreen.description}"
Stack: ${spec.techStack.runtime}, ${spec.techStack.styling}, ${spec.techStack.stateManagement}
${memoryContext}

Strict Rules:
1. Generate exactly 4 to 7 progressive modules for this screen in strict dependency order (e.g. types/contracts first, state hook/store second, subcomponent primitives third, integrated container screen view fourth).
2. Each module must have:
   - title: concise action-oriented title (e.g., "Define TypeScript Feed Event Schema", "Implement Feeding Store with Zustand")
   - learningObjective: 1-2 clear sentences stating the exact engineering concept learned
   - componentType: e.g., "type_definition" | "state_hook" | "ui_atom" | "container_view" | "validation" | "service"
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

    while (attempts < 2 && !syllabusResult) {
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
