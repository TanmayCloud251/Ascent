import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { TIMEOUT_CONFIG } from '../src/config/timeouts.js'
import {
  app,
  isTransientGeminiError,
  generateContentWithTransientRetry,
  AttemptLog
} from '../server.js'
import { computeStarterFilesHash } from '../src/services/fileUtils.js'
import { storageService } from '../src/services/storageService.js'

test('1. Timeout configuration matches exact specifications', () => {
  assert.strictEqual(TIMEOUT_CONFIG.CLIENT_FETCH_TIMEOUT_MS, 120_000, 'Client fetch timeout must be 120 seconds')
  assert.strictEqual(TIMEOUT_CONFIG.CLIENT_SPEC_TIMEOUT_MS, 90_000, 'Client spec timeout must be 90 seconds')
  assert.strictEqual(TIMEOUT_CONFIG.SERVER_OVERALL_BUDGET_MS, 110_000, 'Server overall budget must be 110 seconds')
  assert.strictEqual(TIMEOUT_CONFIG.SERVER_GEMINI_CALL_TIMEOUT_MS, 60_000, 'Gemini call timeout must be 60 seconds')
  assert.strictEqual(TIMEOUT_CONFIG.SERVER_REQUEST_TIMEOUT_MS, 130_000, 'Server request timeout must be at least 130 seconds')
  assert.strictEqual(TIMEOUT_CONFIG.SERVER_MAX_TRANSIENT_RETRIES, 2, 'Server max retries must be 2 (3 attempts total)')
  assert.ok(
    TIMEOUT_CONFIG.SERVER_REQUEST_TIMEOUT_MS > TIMEOUT_CONFIG.CLIENT_FETCH_TIMEOUT_MS,
    'Server request timeout must exceed client fetch timeout'
  )
  assert.ok(
    TIMEOUT_CONFIG.SERVER_OVERALL_BUDGET_MS > TIMEOUT_CONFIG.SERVER_GEMINI_CALL_TIMEOUT_MS,
    'Server overall budget must exceed individual call timeout'
  )
})

test('2. isTransientGeminiError correctly classifies transient vs non-transient errors', () => {
  // Transient cases: 429, 500, 502, 503, 504, timeout, network error
  const err503 = { status: 503, message: 'The model is overloaded. Please try again later.' }
  const res503 = isTransientGeminiError(err503)
  assert.strictEqual(res503.isTransient, true, '503 must be transient')
  assert.strictEqual(res503.errorType, 'HTTP_503_UNAVAILABLE')

  const err429 = { status: 429, message: 'RESOURCE_EXHAUSTED: Rate limit exceeded' }
  const res429 = isTransientGeminiError(err429)
  assert.strictEqual(res429.isTransient, true, '429 must be transient')
  assert.strictEqual(res429.errorType, 'HTTP_429_RATE_LIMIT')

  const err500 = { status: 500, message: 'Internal Server Error' }
  assert.strictEqual(isTransientGeminiError(err500).isTransient, true, '500 must be transient')

  const err502 = { status: 502, message: 'Bad Gateway' }
  assert.strictEqual(isTransientGeminiError(err502).isTransient, true, '502 must be transient')

  const err504 = { status: 504, message: 'Gateway Timeout' }
  assert.strictEqual(isTransientGeminiError(err504).isTransient, true, '504 must be transient')

  const timeoutErr = new Error('Gemini API call timed out after 60s')
  timeoutErr.name = 'TimeoutError'
  const resTimeout = isTransientGeminiError(timeoutErr)
  assert.strictEqual(resTimeout.isTransient, true, 'TimeoutError must be transient')
  assert.strictEqual(resTimeout.errorType, 'NETWORK_TIMEOUT_OR_CONNECTION_ERROR')

  const networkErr = new Error('fetch failed: connect ECONNRESET')
  assert.strictEqual(isTransientGeminiError(networkErr).isTransient, true, 'Network reset must be transient')

  // Non-transient cases: 400, 401, 403, safety block
  const err400 = { status: 400, message: 'INVALID_ARGUMENT: Bad API key format' }
  const res400 = isTransientGeminiError(err400)
  assert.strictEqual(res400.isTransient, false, '400 must NOT be transient')
  assert.strictEqual(res400.errorType, 'HTTP_400_INVALID_ARGUMENT')

  const err401 = { status: 401, message: 'UNAUTHENTICATED' }
  assert.strictEqual(isTransientGeminiError(err401).isTransient, false, '401 must NOT be transient')

  const err403 = { status: 403, message: 'PERMISSION_DENIED: API key not authorized' }
  const res403 = isTransientGeminiError(err403)
  assert.strictEqual(res403.isTransient, false, '403 must NOT be transient')
  assert.strictEqual(res403.errorType, 'HTTP_403_PERMISSION_DENIED')

  const safetyErr = new Error('Content generation blocked by HARM_CATEGORY_DANGEROUS safety policy')
  const resSafety = isTransientGeminiError(safetyErr)
  assert.strictEqual(resSafety.isTransient, false, 'Safety policy block must NOT be transient')
  assert.strictEqual(resSafety.errorType, 'SAFETY_POLICY_BLOCK')
})

test('3. Transient 503 simulation: auto-retries and succeeds on attempt 2 without user intervention', async () => {
  const attemptLogs: AttemptLog[] = []
  let geminiCallCount = 0

  const mockAi = {
    models: {
      generateContent: async () => {
        geminiCallCount++
        return {
          text: JSON.stringify({ lesson: 'Test Lesson', task: 'Test Task' }),
          usageMetadata: { totalTokenCount: 150 }
        }
      }
    }
  } as any

  const startMs = Date.now()
  const response = await generateContentWithTransientRetry(mockAi, {
    model: 'gemini-3.8-flash',
    contents: 'Test Prompt'
  }, {
    phase: 'initial',
    attemptLogs,
    getRemainingBudgetMs: () => 110_000 - (Date.now() - startMs),
    simulateTransient503: true
  })

  assert.ok(response, 'Transient retry should ultimately return the successful response')
  assert.strictEqual(attemptLogs.length, 2, 'Should have exactly 2 attempts logged')
  assert.strictEqual(attemptLogs[0].attempt, 1, 'First attempt must be logged as #1')
  assert.strictEqual(attemptLogs[0].success, false, 'First attempt must fail due to transient 503')
  assert.strictEqual(attemptLogs[0].errorType, 'HTTP_503_UNAVAILABLE')

  assert.strictEqual(attemptLogs[1].attempt, 2, 'Second attempt must be logged as #2')
  assert.strictEqual(attemptLogs[1].success, true, 'Second attempt must succeed')
  assert.strictEqual(geminiCallCount, 1, 'Mock Gemini call should only be made on successful attempt')
})

test('4. Permanent 503 simulation: retries up to budget and surfaces structured error', async () => {
  const attemptLogs: AttemptLog[] = []
  const startMs = Date.now()

  const mockAi = {
    models: {
      generateContent: async () => {
        const err = new Error('Server 503 error')
        ;(err as any).status = 503
        throw err
      }
    }
  } as any

  await assert.rejects(
    async () => {
      await generateContentWithTransientRetry(mockAi, {
        model: 'gemini-3.8-flash',
        contents: 'Test Prompt'
      }, {
        phase: 'initial',
        attemptLogs,
        getRemainingBudgetMs: () => 110_000 - (Date.now() - startMs),
        simulatePermanent503: true
      })
    },
    (err: any) => {
      assert.strictEqual(err.status, 503)
      return true
    }
  )

  // Max retries = 2, so 3 attempts total
  assert.strictEqual(attemptLogs.length, 3, 'Must execute exactly 3 attempts (1 initial + 2 retries)')
  assert.ok(attemptLogs.every(a => a.success === false), 'All attempts must be marked as failed')
  assert.ok(attemptLogs.every(a => a.errorType === 'HTTP_503_UNAVAILABLE'), 'All errors must be 503')
  assert.ok(attemptLogs.every(a => typeof a.durationMs === 'number'), 'Each attempt must log latency')
})

test('5. Non-transient errors (e.g. 400 Bad Request) fail immediately on attempt 1 with zero retries', async () => {
  const attemptLogs: AttemptLog[] = []
  const startMs = Date.now()

  const mockAi = {
    models: {
      generateContent: async () => {
        const err = new Error('API key is invalid')
        ;(err as any).status = 400
        throw err
      }
    }
  } as any

  await assert.rejects(
    async () => {
      await generateContentWithTransientRetry(mockAi, {
        model: 'gemini-3.8-flash',
        contents: 'Test Prompt'
      }, {
        phase: 'initial',
        attemptLogs,
        getRemainingBudgetMs: () => 110_000 - (Date.now() - startMs)
      })
    },
    (err: any) => {
      assert.strictEqual(err.status, 400)
      return true
    }
  )

  assert.strictEqual(attemptLogs.length, 1, 'Non-transient errors must NOT be retried')
  assert.strictEqual(attemptLogs[0].attempt, 1)
  assert.strictEqual(attemptLogs[0].success, false)
  assert.strictEqual(attemptLogs[0].errorType, 'HTTP_400_INVALID_ARGUMENT')
})

test('6. Budget enforcement: aborts if remaining budget is insufficient', async () => {
  const attemptLogs: AttemptLog[] = []

  const mockAi = {
    models: {
      generateContent: async () => ({ text: 'ok' })
    }
  } as any

  await assert.rejects(
    async () => {
      await generateContentWithTransientRetry(mockAi, {
        model: 'gemini-3.8-flash',
        contents: 'Test Prompt'
      }, {
        phase: 'initial',
        attemptLogs,
        getRemainingBudgetMs: () => 2000 // Less than 3000ms threshold
      })
    },
    (err: any) => {
      assert.strictEqual(err.code, 'GENERATION_TIMEOUT')
      assert.strictEqual(err.status, 504)
      return true
    }
  )

  assert.strictEqual(attemptLogs.length, 0, 'No attempt should be executed when budget is already exhausted')
})

test('7. computeStarterFilesHash is deterministic and detects code changes', () => {
  const filesA = [
    { path: 'index.html', content: '<h1>Hello</h1>' },
    { path: 'styles.css', content: 'h1 { color: red; }' }
  ]
  const filesB = [
    { path: 'styles.css', content: 'h1 { color: red; }' },
    { path: 'index.html', content: '<h1>Hello</h1>' }
  ]
  const filesC = [
    { path: 'index.html', content: '<h1>Hello World</h1>' },
    { path: 'styles.css', content: 'h1 { color: red; }' }
  ]

  const hashA = computeStarterFilesHash(filesA)
  const hashB = computeStarterFilesHash(filesB)
  const hashC = computeStarterFilesHash(filesC)

  assert.strictEqual(hashA, hashB, 'File ordering differences must produce identical hash')
  assert.notStrictEqual(hashA, hashC, 'Content changes must produce distinct hash')
})

test('8. StorageService prefetched module cache storage and invalidation', () => {
  const testModuleId = 'proj_test_mod_2'
  const testStarterFiles = [{ path: 'index.html', content: '<div>Base</div>' }]
  const starterHash = computeStarterFilesHash(testStarterFiles)

  const mockContent: any = {
    lesson: 'Prefetched Lesson',
    task: 'Prefetched Task',
    requirements: ['req 1'],
    expectedResult: 'Works',
    references: [],
    starterFiles: testStarterFiles,
    solutionFiles: [{ path: 'index.html', content: '<div>Base Updated</div>' }],
    checks: [],
    hints: ['Hint 1']
  }

  // 1. Save prefetched module
  storageService.savePrefetchedModule(testModuleId, mockContent, starterHash)

  // 2. Retrieve prefetched module
  const prefetched = storageService.getPrefetchedModule(testModuleId)
  assert.ok(prefetched, 'Prefetched module should exist in storage')
  assert.strictEqual(prefetched.starterHash, starterHash, 'Starter hash must match')
  assert.strictEqual(prefetched.content.lesson, 'Prefetched Lesson')

  // 3. Test matching vs mismatching hash
  assert.strictEqual(prefetched.starterHash === starterHash, true, 'Matches current code')
  const modifiedCodeHash = computeStarterFilesHash([{ path: 'index.html', content: '<div>User typed new code</div>' }])
  assert.strictEqual(prefetched.starterHash === modifiedCodeHash, false, 'Mismatches modified code')

  // 4. Delete prefetched module
  storageService.deletePrefetchedModule(testModuleId)
  assert.strictEqual(storageService.getPrefetchedModule(testModuleId), null, 'Prefetched module should be deleted')
})

test('9. HTTP API: POST /api/llm/generate-module-content returns structured error on permanent failure', async () => {
  const server = http.createServer(app)
  await new Promise<void>(resolve => server.listen(0, resolve))
  const port = (server.address() as any).port

  try {
    const payload = {
      spec: { appName: 'Test App', summary: 'A test web app', assumptions: [], outOfScope: [] },
      page: { name: 'Home', fileName: 'index.html' },
      module: { title: 'Header Component', learningObjective: 'Build header' },
      useTailwind: false,
      currentFiles: [{ path: 'index.html', content: '<!DOCTYPE html><html><body></body></html>' }]
    }

    const res = await fetch(`http://127.0.0.1:${port}/api/llm/generate-module-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simulate-permanent-503': 'true'
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    assert.strictEqual(res.status, 503, 'Should respond with HTTP 503')
    assert.strictEqual(data.success, false)
    assert.strictEqual(data.code, 'GEMINI_UNAVAILABLE')
    assert.strictEqual(data.retryable, true)
    assert.ok(Array.isArray(data.attempts), 'Must return structured attempts array')
    assert.strictEqual(data.attempts.length, 3, 'Must have attempted 3 times (1 initial + 2 retries)')
    assert.ok(data.totalTimeMs > 0, 'Must record totalTimeMs')
    assert.ok(typeof data.error === 'string' && data.error.length > 0, 'Must provide real error message')
  } finally {
    server.close()
  }
})
