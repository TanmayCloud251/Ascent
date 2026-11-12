import {
  ProjectSpec,
  ProjectSpecSchema,
  TechStackConfig,
  PageItem,
  PageModuleItem,
  PageResponseSchema,
  ProjectMemory
} from '../types/ascent'
import { storageService } from './storageService'
import {
  ModuleContent,
  ModuleContentSchema,
  ReviewSubmissionResponse,
  ReviewSubmissionResponseSchema,
  Check
} from '../schemas/course'

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
  isCurated?: boolean
  error?: string | null
  harnessResults?: { starterHarness?: any; solutionHarness?: any }
}

export interface GenerateModuleContentOptions {
  spec: ProjectSpec
  page: PageItem
  module: PageModuleItem
  useTailwind?: boolean
  projectMemory?: ProjectMemory | null
  currentFiles?: { path: string; content: string }[]
  forceRefresh?: boolean
}

export interface GenerateModuleContentResult {
  moduleContent: ModuleContent
  fromCache: boolean
  latencyMs: number
  trace: LLMTraceEvent
}

export interface ReviewSubmissionOptions {
  module: { id: string; title: string; task?: string; learningObjective: string }
  userFiles: Record<string, string>
  failedChecks: Check[]
}

export interface ReviewSubmissionResult {
  review: ReviewSubmissionResponse
  latencyMs: number
  trace: LLMTraceEvent
}

export interface GenerateSpecOptions {
  prompt: string
  useTailwind?: boolean
  techStack?: Partial<TechStackConfig>
  forceRefresh?: boolean
}

export interface GenerateSpecResult {
  spec: ProjectSpec
  fromCache: boolean
  latencyMs: number
  trace: LLMTraceEvent
}

export interface GeneratePageOptions {
  spec: ProjectSpec
  useTailwind?: boolean
  projectMemory?: ProjectMemory | null
  forceRefresh?: boolean
}

export interface GeneratePageResult {
  projectComplete: boolean
  page?: PageItem
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
  recordCuratedTrace(slug: string, course: any): LLMTraceEvent {
    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_curated`,
      timestamp: new Date().toISOString(),
      endpoint: `STATIC: src/data/curated/${slug}.json`,
      model: 'PRE-BUILT',
      requestPayload: { curatedSlug: slug, source: 'curated' },
      rawResponseText: JSON.stringify({
        source: 'curated',
        slug,
        status: 'Loaded from pre-built static course catalog. Zero LLM API calls executed.'
      }, null, 2),
      parsedResult: course,
      validationSuccess: true,
      latencyMs: 0,
      tokensUsed: '0 (Pre-built curated course)',
      isCached: false,
      isCurated: true
    }
    broadcastTrace(trace)
    return trace
  },

  async generateSpec(options: GenerateSpecOptions): Promise<GenerateSpecResult> {
    const { prompt, useTailwind = true, techStack, forceRefresh = false } = options
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      throw new Error('Please enter a project description or idea.')
    }

    const requestPayload = {
      prompt: trimmedPrompt,
      useTailwind,
      techStack
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
            model: 'LLM',
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

  async generatePage(options: GeneratePageOptions): Promise<GeneratePageResult> {
    const { spec, useTailwind = true, projectMemory, forceRefresh = false } = options
    const requestPayload = { spec, useTailwind, projectMemory }
    const completedPagesCount = projectMemory?.completedPages?.length || 0
    const pageOrder = completedPagesCount + 1
    const cacheKey = hashExactPayload(`page_${pageOrder}`, {
      appName: spec.appName,
      useTailwind,
      fileTree: projectMemory?.fileTree || [],
      completedPages: (projectMemory?.completedPages || []).map(p => p.fileName),
      decisionsMade: projectMemory?.decisionsMade || []
    })

    if (!forceRefresh) {
      const cached = storageService.getCachedLLMResponse<any>(cacheKey)
      if (cached && cached.projectComplete === true) {
        const trace: LLMTraceEvent = {
          id: `tr_${Date.now()}_cache_done`,
          timestamp: new Date().toISOString(),
          endpoint: 'POST /api/llm/generate-page',
          model: 'LLM',
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
          projectComplete: true,
          fromCache: true,
          latencyMs: 0,
          trace
        }
      }
      if (cached && cached.modules && cached.modules.length >= 4) {
        const trace: LLMTraceEvent = {
          id: `tr_${Date.now()}_cache`,
          timestamp: new Date().toISOString(),
          endpoint: 'POST /api/llm/generate-page',
          model: 'LLM',
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
          projectComplete: false,
          page: cached,
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
      response = await fetch('/api/llm/generate-page', {
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
        endpoint: 'POST /api/llm/generate-page',
        model: 'LLM',
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
        endpoint: 'POST /api/llm/generate-page',
        model: payload.model || 'LLM',
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

    const normalizedPayload = payload?.projectComplete
      ? { ...payload, projectComplete: true, page: undefined, modules: undefined }
      : payload
    const validation = PageResponseSchema.safeParse(normalizedPayload)
    if (!validation.success) {
      const validationErrorMsg = JSON.stringify(validation.error.format(), null, 2)
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_val_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-page',
        model: payload.model || 'LLM',
        requestPayload,
        rawResponseText: payload.rawGeminiText || JSON.stringify(payload, null, 2),
        parsedResult: payload,
        validationSuccess: false,
        validationError: validationErrorMsg,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'N/A',
        isCached: false,
        error: 'Page syllabus failed Zod validation.'
      }
      broadcastTrace(trace)
      throw new Error(`Page syllabus failed validation: ${validationErrorMsg}`)
    }

    if (validation.data.projectComplete || !validation.data.page) {
      storageService.setCachedLLMResponse(cacheKey, { projectComplete: true })
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_done`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-page',
        model: payload.model || 'LLM',
        requestPayload,
        rawResponseText: payload.rawGeminiText || JSON.stringify(validation.data, null, 2),
        parsedResult: validation.data,
        validationSuccess: true,
        latencyMs,
        tokensUsed: payload.tokensUsed || 'Calculated at runtime',
        isCached: false
      }
      broadcastTrace(trace)
      return {
        projectComplete: true,
        fromCache: false,
        latencyMs,
        trace
      }
    }

    const pageData = validation.data.page
    const pageId = `page_${pageOrder}_${(pageData.fileName || 'index.html').replace(/[^a-z0-9]/gi, '_')}`

    const validatedModules: PageModuleItem[] = (validation.data.modules || []).map((m, idx) => ({
      id: `p${pageOrder}_mod_${idx + 1}`,
      pageId,
      order: idx + 1,
      title: m.title,
      learningObjective: m.learningObjective,
      componentType: m.componentType as any,
      status: idx === 0 ? 'active' : 'locked'
    }))

    const pageItem: PageItem = {
      id: pageId,
      projectId: projectMemory?.projectId || 'current_project',
      order: pageOrder,
      name: pageData.name,
      description: pageData.description,
      fileName: pageData.fileName,
      purpose: pageData.purpose,
      status: 'active',
      modules: validatedModules
    }

    storageService.setCachedLLMResponse(cacheKey, pageItem)

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/generate-page',
      model: payload.model || 'LLM',
      requestPayload,
      rawResponseText: payload.rawGeminiText || JSON.stringify(pageItem, null, 2),
      parsedResult: pageItem,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false
    }
    broadcastTrace(trace)

    return {
      projectComplete: false,
      page: pageItem,
      fromCache: false,
      latencyMs,
      trace
    }
  },

  async generateModuleContent(options: GenerateModuleContentOptions): Promise<GenerateModuleContentResult> {
    const { spec, page, module, useTailwind, projectMemory, currentFiles, forceRefresh = false } = options

    const requestPayload = {
      spec,
      page,
      module,
      useTailwind,
      projectMemory,
      currentFiles
    }

    const cacheKey = hashExactPayload(`mod_content_${module.id}`, {
      specAppName: spec.appName,
      pageName: page?.name,
      pageFileName: page?.fileName,
      moduleTitle: module.title,
      useTailwind,
      currentFiles
    })

    if (!forceRefresh) {
      const cached = storageService.getCachedLLMResponse<ModuleContent>(cacheKey)
      if (cached) {
        const trace: LLMTraceEvent = {
          id: `tr_${Date.now()}_cache`,
          timestamp: new Date().toISOString(),
          endpoint: 'POST /api/llm/generate-module-content',
          model: 'LLM',
          requestPayload,
          rawResponseText: JSON.stringify(cached, null, 2),
          parsedResult: cached,
          validationSuccess: true,
          latencyMs: 0,
          tokensUsed: '0 (Deterministic cache)',
          isCached: true
        }
        broadcastTrace(trace)
        return {
          moduleContent: cached,
          fromCache: true,
          latencyMs: 0,
          trace
        }
      }
    }

    const startTime = Date.now()
    const res = await fetch('/api/llm/generate-module-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    })

    const payload = await res.json()
    const latencyMs = Date.now() - startTime

    if (!res.ok || !payload.success) {
      const errorMsg = payload.error || 'Failed to generate module lesson & tasks.'
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-module-content',
        model: payload.model || 'LLM',
        requestPayload,
        rawResponseText: JSON.stringify(payload, null, 2),
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        isCached: false,
        harnessResults: payload.verification,
        error: errorMsg
      }
      broadcastTrace(trace)
      throw new Error(errorMsg)
    }

    const validation = ModuleContentSchema.safeParse(payload.moduleContent)
    if (!validation.success) {
      const errorMsg = `Module schema validation failed: ${validation.error.message}`
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_val_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/generate-module-content',
        model: payload.model || 'LLM',
        requestPayload,
        rawResponseText: JSON.stringify(payload.moduleContent, null, 2),
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        isCached: false,
        harnessResults: payload.verification,
        error: errorMsg
      }
      broadcastTrace(trace)
      throw new Error(errorMsg)
    }

    const moduleContent = validation.data
    storageService.setCachedLLMResponse(cacheKey, moduleContent)

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/generate-module-content',
      model: payload.model || 'LLM',
      requestPayload,
      rawResponseText: JSON.stringify(moduleContent, null, 2),
      parsedResult: moduleContent,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false,
      harnessResults: payload.verification
    }
    broadcastTrace(trace)

    return {
      moduleContent,
      fromCache: false,
      latencyMs,
      trace
    }
  },

  async reviewSubmission(options: ReviewSubmissionOptions): Promise<ReviewSubmissionResult> {
    const { module, userFiles, failedChecks } = options

    const requestPayload = {
      module,
      userFiles,
      failedChecks
    }

    const startTime = Date.now()
    const res = await fetch('/api/llm/review-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    })

    const payload = await res.json()
    const latencyMs = Date.now() - startTime

    if (!res.ok || !payload.success) {
      const errorMsg = payload.error || 'Failed to review submission with tutor.'
      const trace: LLMTraceEvent = {
        id: `tr_${Date.now()}_err`,
        timestamp: new Date().toISOString(),
        endpoint: 'POST /api/llm/review-submission',
        model: payload.model || 'LLM',
        requestPayload,
        rawResponseText: JSON.stringify(payload, null, 2),
        parsedResult: null,
        validationSuccess: false,
        validationError: errorMsg,
        latencyMs,
        isCached: false,
        harnessResults: payload.verification,
        error: errorMsg
      }
      broadcastTrace(trace)
      throw new Error(errorMsg)
    }

    const validation = ReviewSubmissionResponseSchema.safeParse(payload.review)
    if (!validation.success) {
      const errorMsg = `Review validation failed: ${validation.error.message}`
      throw new Error(errorMsg)
    }

    const trace: LLMTraceEvent = {
      id: `tr_${Date.now()}_ok`,
      timestamp: new Date().toISOString(),
      endpoint: 'POST /api/llm/review-submission',
      model: payload.model || 'LLM',
      requestPayload,
      rawResponseText: JSON.stringify(validation.data, null, 2),
      parsedResult: validation.data,
      validationSuccess: true,
      latencyMs,
      tokensUsed: payload.tokensUsed || 'Calculated at runtime',
      isCached: false
    }
    broadcastTrace(trace)

    return {
      review: validation.data,
      latencyMs,
      trace
    }
  }
}


