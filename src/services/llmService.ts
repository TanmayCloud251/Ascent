import {
  ProjectSpec,
  ProjectSpecSchema,
  TechStackConfig,
  ScreenPlanItem,
  ScreenPlanResponseSchema,
  ModuleItem,
  SyllabusResponseSchema,
  ProjectMemory
} from '../types/ascent'
import { storageService } from './storageService'

export interface LLMTraceEvent {
  id: string
  timestamp: string
  endpoint: string
  model: string
  requestPayload: Record<string, any>
  rawResponseText: string
  parsedResult: any
  validationSuccess: boolean
  validationError?: string | null
  latencyMs: number
  tokensUsed?: number | string
  isCached: boolean
  error?: string | null
}

export interface GenerateSpecOptions {
  prompt: string
  useTailwind?: boolean
  techStack?: Partial<TechStackConfig>
  previousSpec?: ProjectSpec
  clarifyingAnswers?: Record<string, string>
  forceRefresh?: boolean
}

export interface GenerateSpecResult {
  spec: ProjectSpec
  fromCache: boolean
  latencyMs: number
  trace: LLMTraceEvent
}

export interface GenerateScreenPlanOptions {
  spec: ProjectSpec
  forceRefresh?: boolean
}

export interface GenerateScreenPlanResult {
  screens: ScreenPlanItem[]
  fromCache: boolean
  latencyMs: number
  trace: LLMTraceEvent
}

export interface GenerateSyllabusOptions {
  spec: ProjectSpec
  currentScreen: ScreenPlanItem
  projectMemory?: ProjectMemory | null
  forceRefresh?: boolean
}

export interface GenerateSyllabusResult {
  modules: ModuleItem[]
  fromCache: boolean
  latencyMs: number
  trace: LLMTraceEvent
}

// Compute deterministic hash of any exact request payload
function hashExactPayload(prefix: string, payload: any): string {
  const normalized = JSON.stringify(payload)
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${prefix}_${hex}_${normalized.length}`
}

type TraceListener = (trace: LLMTraceEvent) => void
const traceListeners: Set<TraceListener> = new Set()
let currentLatestTrace: LLMTraceEvent | null = null

export const subscribeToLLMTraces = (fn: TraceListener): (() => void) => {
  traceListeners.add(fn)
  if (currentLatestTrace) {
    fn(currentLatestTrace)
  }
  return () => traceListeners.delete(fn)
}

function broadcastTrace(trace: LLMTraceEvent) {
  currentLatestTrace = trace
  traceListeners.forEach(listener => {
    try {
      listener(trace)
    } catch (e) {
      console.warn('Trace listener error:', e)
    }
  })
}

export const getLatestLLMTrace = (): LLMTraceEvent | null => currentLatestTrace

/**
 * Client-Side LLM Service Proxy
 * Enforces:
 * 1. Zero hardcoded/mock output.
 * 2. Caching strictly of verified previous Gemini responses.
 * 3. End-to-end execution telemetry for LLM Trace inspector.
 */
export const llmService = {
  async generateSpec(options: GenerateSpecOptions): Promise<GenerateSpecResult> {
    const { prompt, useTailwind = true, techStack, previousSpec, clarifyingAnswers, forceRefresh = false } = options
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      throw new Error('Please enter a project description or idea.')
    }

    const requestPayload = {
      prompt: trimmedPrompt,
      useTailwind,
      techStack,
      previousSpec,
      clarifyingAnswers
    }

    const cacheKey = hashExactPayload('spec', requestPayload)

    // 1. Check exact-hash cache (only contains previous real responses)
    if (!forceRefresh) {
      const cached = storageService.getCachedLLMResponse<ProjectSpec>(cacheKey)
      if (cached) {
        const parsed = ProjectSpecSchema.safeParse(cached)
        if (parsed.success) {
          const trace: LLMTraceEvent = {
            id: `tr_${Date.now()}_cache`,
            timestamp: new Date().toISOString(),
            endpoint: 'POST /api/llm/generate-spec',
            model: 'gemini-3.8-flash',
            requestPayload,
            rawResponseText: JSON.stringify(parsed.data, null, 2),
            parsedResult: parsed.data,
            validationSuccess: true,
            latencyMs: 0,
            tokensUsed: '0 (cache hit)',
            isCached: true
          }
          broadcastTrace(trace)
          return {
            spec: parsed.data,
            fromCache: true,
            latencyMs: 0,
            trace
          }
        }
      }
    }

    // 2. Make real server-side Gemini API call
    const startTime = Date.now()
    let response: Response
    let responseText = ''
    let payload: any = {}

    try {
      response = await fetch('/api/llm/generate-spec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      })

      responseText = await response.text()
      try {
        payload = JSON.parse(responseText)
      } catch {
        payload = { error: responseText }
      }
    } catch (networkErr: any) {
      const latencyMs = Date.now() - startTime
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-spec',
        model: 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: networkErr?.message || 'Network Fetch Failed',
        parsedResult: null,
        validationSuccess: false,
        validationError: networkErr?.message,
        latencyMs,
        isCached: false,
        error: networkErr?.message || 'Network connection failed'
      }
      broadcastTrace(trace)
      throw networkErr
    }

    const latencyMs = Date.now() - startTime

    if (!response.ok || !payload.success) {
      const errorMsg = payload.error || `Server returned HTTP ${response.status}: ${responseText}`
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-spec',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || responseText,
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: errorMsg
      }
      broadcastTrace(trace)

      const error = new Error(errorMsg) as Error & { retryable?: boolean; trace?: LLMTraceEvent }
      error.retryable = payload.retryable !== false
      error.trace = trace
      throw error
    }

    // 3. Runtime Zod Schema Validation
    const validation = ProjectSpecSchema.safeParse(payload.spec)
    if (!validation.success) {
      const validationErrorMsg = JSON.stringify(validation.error.format(), null, 2)
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_val_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-spec',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || JSON.stringify(payload.spec, null, 2),
        parsedResult: payload.spec,
        validationSuccess: false,
        validationError: validationErrorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: 'Generated output failed Zod schema validation.'
      }
      broadcastTrace(trace)
      throw new Error(`Generated specification failed schema validation: ${validationErrorMsg}`)
    }

    const validatedSpec = validation.data

    // 4. Save ONLY validated real response to cache
    storageService.setCachedLLMResponse(cacheKey, validatedSpec)

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/generate-spec',
      model: payload.model || 'gemini-3.8-flash',
      requestPayload,
      rawResponseText: payload.rawGeminiText || JSON.stringify(validatedSpec, null, 2),
      parsedResult: validatedSpec,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false
    }
    broadcastTrace(trace)

    return {
      spec: validatedSpec,
      fromCache: false,
      latencyMs,
      trace
    }
  },

  async generateScreenPlan(options: GenerateScreenPlanOptions): Promise<GenerateScreenPlanResult> {
    const { spec, forceRefresh = false } = options
    const requestPayload = { spec }
    const cacheKey = hashExactPayload('screen_plan', {
      appName: spec.appName,
      stack: spec.techStack,
      features: spec.primaryFeatures
    })

    if (!forceRefresh) {
      const cached = storageService.getCachedLLMResponse<ScreenPlanItem[]>(cacheKey)
      if (cached && Array.isArray(cached) && cached.length >= 3) {
        const trace: LLMTraceEvent = {
          id: `tr_${Date.now()}_cache`,
          timestamp: new Date().toISOString(),
          endpoint: 'POST /api/llm/generate-screen-plan',
          model: 'gemini-3.8-flash',
          requestPayload,
          rawResponseText: JSON.stringify(cached, null, 2),
          parsedResult: cached,
          validationSuccess: true,
          latencyMs: 0,
          tokensUsed: '0 (cache hit)',
          isCached: true
        }
        broadcastTrace(trace)
        return {
          screens: cached,
          fromCache: true,
          latencyMs: 0,
          trace
        }
      }
    }

    const startTime = Date.now()
    let response: Response
    let responseText = ''
    let payload: any = {}

    try {
      response = await fetch('/api/llm/generate-screen-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })
      responseText = await response.text()
      try {
        payload = JSON.parse(responseText)
      } catch {
        payload = { error: responseText }
      }
    } catch (networkErr: any) {
      const latencyMs = Date.now() - startTime
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-screen-plan',
        model: 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: networkErr?.message || 'Network Fetch Failed',
        parsedResult: null,
        validationSuccess: false,
        validationError: networkErr?.message,
        latencyMs,
        isCached: false,
        error: networkErr?.message || 'Network connection failed'
      }
      broadcastTrace(trace)
      throw networkErr
    }

    const latencyMs = Date.now() - startTime

    if (!response.ok || !payload.success) {
      const errorMsg = payload.error || `Server returned HTTP ${response.status}: ${responseText}`
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-screen-plan',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || responseText,
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: errorMsg
      }
      broadcastTrace(trace)
      const error = new Error(errorMsg) as Error & { retryable?: boolean; trace?: LLMTraceEvent }
      error.retryable = payload.retryable !== false
      error.trace = trace
      throw error
    }

    // Validate with Zod
    const validation = ScreenPlanResponseSchema.safeParse(payload)
    if (!validation.success) {
      const validationErrorMsg = JSON.stringify(validation.error.format(), null, 2)
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_val_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-screen-plan',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || JSON.stringify(payload.screens, null, 2),
        parsedResult: payload.screens,
        validationSuccess: false,
        validationError: validationErrorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: 'Screen plan failed Zod validation.'
      }
      broadcastTrace(trace)
      throw new Error(`Screen plan failed validation: ${validationErrorMsg}`)
    }

    const validatedScreens: ScreenPlanItem[] = validation.data.screens.map((s, idx) => ({
      id: `screen_${idx + 1}`,
      order: idx + 1,
      screenName: s.name,
      description: s.description,
      status: idx === 0 ? 'active' : 'locked'
    }))

    storageService.setCachedLLMResponse(cacheKey, validatedScreens)

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/generate-screen-plan',
      model: payload.model || 'gemini-3.8-flash',
      requestPayload,
      rawResponseText: payload.rawGeminiText || JSON.stringify(validatedScreens, null, 2),
      parsedResult: validatedScreens,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false
    }
    broadcastTrace(trace)

    return {
      screens: validatedScreens,
      fromCache: false,
      latencyMs,
      trace
    }
  },

  async generateSyllabus(options: GenerateSyllabusOptions): Promise<GenerateSyllabusResult> {
    const { spec, currentScreen, projectMemory, forceRefresh = false } = options
    const requestPayload = { spec, currentScreen, projectMemory }
    const cacheKey = hashExactPayload('syllabus', {
      appName: spec.appName,
      screenName: currentScreen.screenName,
      screenDesc: currentScreen.description
    })

    if (!forceRefresh) {
      const cached = storageService.getCachedLLMResponse<ModuleItem[]>(cacheKey)
      if (cached && Array.isArray(cached) && cached.length >= 4) {
        const trace: LLMTraceEvent = {
          id: `tr_${Date.now()}_cache`,
          timestamp: new Date().toISOString(),
          endpoint: 'POST /api/llm/generate-syllabus',
          model: 'gemini-3.8-flash',
          requestPayload,
          rawResponseText: JSON.stringify(cached, null, 2),
          parsedResult: cached,
          validationSuccess: true,
          latencyMs: 0,
          tokensUsed: '0 (cache hit)',
          isCached: true
        }
        broadcastTrace(trace)
        return {
          modules: cached,
          fromCache: true,
          latencyMs: 0,
          trace
        }
      }
    }

    const startTime = Date.now()
    let response: Response
    let responseText = ''
    let payload: any = {}

    try {
      response = await fetch('/api/llm/generate-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })
      responseText = await response.text()
      try {
        payload = JSON.parse(responseText)
      } catch {
        payload = { error: responseText }
      }
    } catch (networkErr: any) {
      const latencyMs = Date.now() - startTime
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-syllabus',
        model: 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: networkErr?.message || 'Network Fetch Failed',
        parsedResult: null,
        validationSuccess: false,
        validationError: networkErr?.message,
        latencyMs,
        isCached: false,
        error: networkErr?.message || 'Network connection failed'
      }
      broadcastTrace(trace)
      throw networkErr
    }

    const latencyMs = Date.now() - startTime

    if (!response.ok || !payload.success) {
      const errorMsg = payload.error || `Server returned HTTP ${response.status}: ${responseText}`
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-syllabus',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || responseText,
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: errorMsg
      }
      broadcastTrace(trace)
      const error = new Error(errorMsg) as Error & { retryable?: boolean; trace?: LLMTraceEvent }
      error.retryable = payload.retryable !== false
      error.trace = trace
      throw error
    }

    const validation = SyllabusResponseSchema.safeParse(payload)
    if (!validation.success) {
      const validationErrorMsg = JSON.stringify(validation.error.format(), null, 2)
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_val_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-syllabus',
        model: payload.model || 'gemini-3.8-flash',
        requestPayload,
        rawResponseText: payload.rawGeminiText || JSON.stringify(payload.modules, null, 2),
        parsedResult: payload.modules,
        validationSuccess: false,
        validationError: validationErrorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: 'Syllabus failed Zod validation.'
      }
      broadcastTrace(trace)
      throw new Error(`Syllabus failed validation: ${validationErrorMsg}`)
    }

    const validatedModules: ModuleItem[] = validation.data.modules.map((m, idx) => ({
      id: `mod_${idx + 1}`,
      order: idx + 1,
      title: m.title,
      learningObjective: m.learningObjective,
      componentType: m.componentType,
      status: idx === 0 ? 'active' : 'locked'
    }))

    storageService.setCachedLLMResponse(cacheKey, validatedModules)

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/generate-syllabus',
      model: payload.model || 'gemini-3.8-flash',
      requestPayload,
      rawResponseText: payload.rawGeminiText || JSON.stringify(validatedModules, null, 2),
      parsedResult: validatedModules,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false
    }
    broadcastTrace(trace)

    return {
      modules: validatedModules,
      fromCache: false,
      latencyMs,
      trace
    }
  }
}

