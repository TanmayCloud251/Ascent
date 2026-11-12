import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, Type } from '@google/genai'
import {
  CuratedCourseSchema,
  CuratedCourse,
  CuratedCourseIndexItem,
  CuratedAsset,
  Check,
  ModuleContent,
  ReferenceLink
} from '../src/schemas/course'
import { runChecksOnFiles } from '../src/services/checkRunner'
import { inferMimeType } from '../src/services/fileUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Safely load .env if API keys are not already present in process.env (never logs/prints .env)
if (!process.env.GEMINI_API_KEY && !process.env.ASCENT_API_KEY && !process.env.API_KEY) {
  try {
    const envPath = path.join(rootDir, '.env')
    if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
      ;(process as any).loadEnvFile(envPath)
    }
  } catch {
    // Ignore when .env cannot be loaded
  }
}

const curatedProjectsDir = fs.existsSync('/curated-projects')
  ? '/curated-projects'
  : path.join(rootDir, 'curated-projects')

const outputDataDir = path.join(rootDir, 'src', 'data', 'curated')
const publicAssetsRoot = path.join(rootDir, 'public', 'curated-assets')

const CODE_TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.md', '.txt'])

const DEFAULT_META: Record<
  string,
  { title: string; shortDescription: string; difficulty: 'beginner' | 'intermediate' | 'advanced'; estimatedHours: number }
> = {
  'currency-converter': {
    title: 'Currency Converter',
    shortDescription: 'Live exchange rate calculation with currency dropdowns and localStorage history.',
    difficulty: 'beginner',
    estimatedHours: 3
  },
  'rock-paper-scissors': {
    title: 'Rock Paper Scissors',
    shortDescription: 'Classic interactive game against computer AI with score tracking and animations.',
    difficulty: 'beginner',
    estimatedHours: 2.5
  },
  'tic-tac-toe': {
    title: 'Tic Tac Toe',
    shortDescription: '2-player grid board with win-state detection, turn indicators, and match resets.',
    difficulty: 'beginner',
    estimatedHours: 3
  },
  'login-greeting': {
    title: 'Login Greeting Form',
    shortDescription: 'Interactive username login form that validates input and displays a personalized greeting.',
    difficulty: 'beginner',
    estimatedHours: 0.3
  }
}

function getGeminiClient(): GoogleGenAI {
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
    throw new Error('No valid Gemini API key found in environment (GEMINI_API_KEY or ASCENT_API_KEY).')
  }

  return new GoogleGenAI({ apiKey: validKey })
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'

interface ScannedCuratedProject {
  textFiles: { path: string; content: string }[]
  assets: CuratedAsset[]
}

/**
 * Recursively scans a curated project directory, reading all text code files and copying
 * every non-text asset (images, icons, sounds, fonts) to public/curated-assets/<slug>/.
 */
export function scanAndCopyCuratedProject(slug: string, projectDir: string, publicAssetsBaseDir = publicAssetsRoot): ScannedCuratedProject {
  const textFiles: { path: string; content: string }[] = []
  const assets: CuratedAsset[] = []

  const targetAssetDir = path.join(publicAssetsBaseDir, slug)
  if (fs.existsSync(targetAssetDir)) {
    fs.rmSync(targetAssetDir, { recursive: true, force: true })
  }

  const walk = (dir: string, relBase: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dir, entry.name)
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        walk(fullPath, relPath)
        continue
      }

      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (CODE_TEXT_EXTENSIONS.has(ext)) {
        textFiles.push({
          path: relPath,
          content: fs.readFileSync(fullPath, 'utf-8')
        })
      } else {
        const destFile = path.join(targetAssetDir, ...relPath.split('/'))
        fs.mkdirSync(path.dirname(destFile), { recursive: true })
        fs.copyFileSync(fullPath, destFile)
        const stats = fs.statSync(fullPath)
        assets.push({
          path: relPath,
          mimeType: inferMimeType(relPath),
          size: stats.size
        })
      }
    }
  }

  walk(projectDir, '')
  return { textFiles, assets }
}

const urlVerificationCache = new Map<string, boolean>()

function isAllowedCuratedReferenceUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    return u.protocol === 'https:' && u.hostname.toLowerCase() === 'developer.mozilla.org'
  } catch {
    return false
  }
}

async function verifyReferenceUrlHttp(rawUrl: string): Promise<boolean> {
  if (!isAllowedCuratedReferenceUrl(rawUrl)) return false
  if (urlVerificationCache.has(rawUrl)) {
    return urlVerificationCache.get(rawUrl)!
  }

  let ok = false
  try {
    let resp = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    })
    if (resp.status === 405 || resp.status === 403) {
      resp = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      })
    }
    ok = resp.status >= 200 && resp.status < 300
  } catch {
    ok = false
  }

  urlVerificationCache.set(rawUrl, ok)
  return ok
}

function cleanAndParseJSON(rawText: string): any {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

async function callGeminiWithRetry(ai: GoogleGenAI, config: Parameters<GoogleGenAI['models']['generateContent']>[0]) {
  let attempt = 0
  let delayMs = 2000
  while (true) {
    try {
      return await ai.models.generateContent(config)
    } catch (err: any) {
      attempt++
      const msg = err?.message || ''
      const retryable =
        err?.status === 429 ||
        err?.status === 503 ||
        err?.status === 500 ||
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('fetch failed')
      if (!retryable || attempt >= 5) throw err
      console.warn(`  Gemini transient error (${err?.status || msg.slice(0, 40)}), retrying in ${delayMs}ms...`)
      await new Promise(r => setTimeout(r, delayMs))
      delayMs *= 2
    }
  }
}

interface ModuleVerificationRow {
  order: number
  id: string
  title: string
  starterFailedCount: number
  starterTotal: number
  starterFailsAtLeastOne: boolean
  solutionPassed: number
  solutionTotal: number
  solutionAllPass: boolean
  originalPassed: number
  originalTotal: number
  originalAllPass: boolean
  passedAllConditions: boolean
  failures: string[]
}

interface CourseVerificationReport {
  slug: string
  verifiedAt: string
  model: string
  assetsCount: number
  repairedModules: string[]
  droppedUrls: { moduleId: string; url: string; reason: string }[]
  allModulesValid: boolean
  modules: ModuleVerificationRow[]
}

async function verifyAllModules(
  course: CuratedCourse,
  originalFiles: { path: string; content: string }[]
): Promise<{
  rows: ModuleVerificationRow[]
  brokenUrls: { moduleId: string; moduleTitle: string; url: string; reason: string }[]
  structuralErrors: string[]
}> {
  const rows: ModuleVerificationRow[] = []
  const brokenUrls: { moduleId: string; moduleTitle: string; url: string; reason: string }[] = []
  const structuralErrors: string[] = []

  // Validate Zod schema first
  const parsed = CuratedCourseSchema.safeParse(course)
  if (!parsed.success) {
    structuralErrors.push(
      `CuratedCourseSchema validation error: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    )
  }

  // Validate cumulative file presence & final module completeness
  for (let i = 0; i < course.modules.length - 1; i++) {
    const sol = course.modules[i].solutionFiles
    const nextStart = course.modules[i + 1].starterFiles
    for (const f of sol) {
      if (!nextStart.find(nf => nf.path === f.path)) {
        structuralErrors.push(`Module ${i + 1} solution file "${f.path}" is missing in Module ${i + 2} starterFiles.`)
      }
    }
  }
  const lastMod = course.modules[course.modules.length - 1]
  if (lastMod) {
    for (const orig of originalFiles) {
      if (!lastMod.solutionFiles.find(sf => sf.path === orig.path)) {
        structuralErrors.push(`Final module "${lastMod.title}" solutionFiles is missing original file "${orig.path}".`)
      }
    }
  }

  // Evaluate (a), (b), (c) and verify HTTP reference URLs for every module
  const origFileMap = new Map(originalFiles.map(f => [f.path, f.content]))
  for (const mod of course.modules) {
    const failures: string[] = []

    const scopedOriginalFiles = mod.solutionFiles.map(sf => ({
      path: sf.path,
      content: origFileMap.get(sf.path) ?? sf.content
    }))

    const starterRes = await runChecksOnFiles(mod.checks, mod.starterFiles, course.assets)
    const solutionRes = await runChecksOnFiles(mod.checks, mod.solutionFiles, course.assets)
    const originalRes = await runChecksOnFiles(mod.checks, originalFiles, course.assets)
    const scopedOriginalRes = await runChecksOnFiles(mod.checks, scopedOriginalFiles, course.assets)

    const starterFailedCount = starterRes.totalCount - starterRes.passedCount
    const starterFailsAtLeastOne = starterFailedCount >= 1
    const solutionAllPass = solutionRes.allPassed
    const originalAllPass = originalRes.allPassed && scopedOriginalRes.allPassed

    if (!starterFailsAtLeastOne) {
      failures.push(`(a) All ${starterRes.totalCount} check(s) already pass on starterFiles; at least 1 must fail.`)
    }
    if (!solutionAllPass) {
      const failedMsgs = solutionRes.results
        .filter(r => !r.passed)
        .map(r => `[${r.id}] ${r.message || 'failed'}`)
        .join('; ')
      failures.push(`(b) solutionFiles failed ${solutionRes.totalCount - solutionRes.passedCount}/${solutionRes.totalCount}: ${failedMsgs}`)
    }
    if (!originalAllPass) {
      const combinedOrigFailures = [
        ...originalRes.results.filter(r => !r.passed).map(r => `[full:${r.id}] ${r.message || 'failed'}`),
        ...scopedOriginalRes.results.filter(r => !r.passed).map(r => `[scoped:${r.id}] ${r.message || 'failed'}`)
      ]
      failures.push(`(c) ORIGINAL PROJECT FILES failed check(s): ${combinedOrigFailures.join('; ')}`)
    }

    if (!mod.requirements || mod.requirements.length === 0) {
      failures.push('Module is missing requirements[] list.')
    }
    if (!mod.expectedResult || !mod.expectedResult.trim()) {
      failures.push('Module is missing expectedResult.')
    }

    // Check reference URLs
    const refs = mod.references || []
    if (refs.length < 2) {
      failures.push(`Module has only ${refs.length} reference link(s); require 2-4 verified MDN links.`)
    }
    for (const ref of refs) {
      if (!isAllowedCuratedReferenceUrl(ref.url)) {
        const reason = `Disallowed host or scheme (must be https://developer.mozilla.org/...): ${ref.url}`
        brokenUrls.push({ moduleId: mod.id, moduleTitle: mod.title, url: ref.url, reason })
        failures.push(reason)
      } else {
        const ok = await verifyReferenceUrlHttp(ref.url)
        if (!ok) {
          const reason = `HTTP verification failed (non-200 or unreachable): ${ref.url}`
          brokenUrls.push({ moduleId: mod.id, moduleTitle: mod.title, url: ref.url, reason })
          failures.push(reason)
        }
      }
    }

    rows.push({
      order: mod.order,
      id: mod.id,
      title: mod.title,
      starterFailedCount,
      starterTotal: starterRes.totalCount,
      starterFailsAtLeastOne,
      solutionPassed: solutionRes.passedCount,
      solutionTotal: solutionRes.totalCount,
      solutionAllPass,
      originalPassed: originalRes.passedCount,
      originalTotal: originalRes.totalCount,
      originalAllPass,
      passedAllConditions: failures.length === 0,
      failures
    })
  }

  return { rows, brokenUrls, structuralErrors }
}

const ALLOWED_COMPONENT_TYPES = [
  'document-head',
  'body-layout',
  'header',
  'navigation',
  'main-section',
  'content-block',
  'form',
  'footer',
  'script-behavior'
] as const

const ALLOWED_COMPONENT_SET = new Set<string>(ALLOWED_COMPONENT_TYPES)

const moduleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    pageId: { type: Type.STRING },
    order: { type: Type.INTEGER },
    title: { type: Type.STRING },
    learningObjective: { type: Type.STRING },
    componentType: { type: Type.STRING, enum: [...ALLOWED_COMPONENT_TYPES] },
    status: { type: Type.STRING, enum: ['locked', 'active', 'done'] },
    lesson: { type: Type.STRING },
    task: { type: Type.STRING },
    requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
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
          type: {
            type: Type.STRING,
            enum: [
              'elementExists',
              'textContains',
              'styleEquals',
              'attributeEquals',
              'scriptDefines',
              'eventResult',
              'imageLoaded',
              'assetExists'
            ]
          },
          selector: {
            type: Type.STRING,
            description: 'Valid CSS selector using SINGLE quotes inside brackets (e.g. link[href=\'styles.css\'] or input[type=\'number\']). For eventResult, this is the TARGET/OUTPUT element whose text or value is verified AFTER action runs (e.g. "#result" or "#from-currency"), NOT the clicked button unless checking the button itself! Set to "" only for scriptDefines/assetExists.'
          },
          path: {
            type: Type.STRING,
            description: 'Relative asset path for assetExists (e.g. "images/logo.png"). Set to "" for other check types.'
          },
          property: {
            type: Type.STRING,
            description: 'Attribute name (for attributeEquals, e.g. "href") or camelCase CSS property (for styleEquals, e.g. "display"). For eventResult on <input>/<select>, you may set "value" or leave "".'
          },
          expected: {
            type: Type.STRING,
            description: 'Non-empty expected string for textContains, attributeEquals, styleEquals, scriptDefines, and eventResult. Set to "" for elementExists, imageLoaded, and assetExists.'
          },
          message: { type: Type.STRING },
          requirementRef: { type: Type.STRING },
          action: {
            type: Type.OBJECT,
            description: 'Required for eventResult: identifies the TRIGGER element and DOM event to fire before asserting top-level selector.',
            properties: {
              type: { type: Type.STRING, description: 'DOM event type: click | input | change | submit' },
              selector: { type: Type.STRING, description: 'CSS selector of the TRIGGER element to click/input/submit (e.g. "#greet-btn" or "#username").' },
              value: { type: Type.STRING, description: 'Optional new value to assign before dispatching input/change event.' }
            },
            required: ['type', 'selector']
          }
        },
        required: ['id', 'description', 'type', 'selector', 'property', 'expected', 'requirementRef']
      }
    },
    hints: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [
    'id',
    'pageId',
    'order',
    'title',
    'learningObjective',
    'componentType',
    'status',
    'lesson',
    'task',
    'requirements',
    'expectedResult',
    'references',
    'starterFiles',
    'solutionFiles',
    'checks',
    'hints'
  ]
}

interface PlannedModuleOutline {
  id: string
  order: number
  title: string
  learningObjective: string
  componentType: string
}

function buildStarterShell(filePath: string, title: string, singleFileInline = false): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    if (singleFileInline) {
      return `<!DOCTYPE html>\n<html lang="en">\n<head>\n</head>\n<body>\n</body>\n</html>\n`
    }
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${title}</title>\n</head>\n<body>\n</body>\n</html>\n`
  }
  if (lower.endsWith('.css')) {
    return `/* Styles for ${title} */\n`
  }
  if (lower.endsWith('.js')) {
    return `// Interactive logic for ${title}\n`
  }
  return ''
}

function filesArrayToMap(files: Array<{ path: string; content: string }> = []): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of files) {
    if (f && typeof f.path === 'string' && typeof f.content === 'string') {
      out[f.path] = f.content
    }
  }
  return out
}

function mapToFilesArray(map: Record<string, string>): Array<{ path: string; content: string }> {
  return Object.entries(map).map(([filePath, content]) => ({ path: filePath, content }))
}

async function generateCourseOutlineWithGemini(
  ai: GoogleGenAI,
  slug: string,
  meta: { title: string; shortDescription: string; difficulty: 'beginner' | 'intermediate' | 'advanced'; estimatedHours: number },
  originalFiles: { path: string; content: string }[],
  assets: CuratedAsset[]
): Promise<{ spec: any; page: any; plannedModules: PlannedModuleOutline[] }> {
  const originalCodeSection = originalFiles
    .map(f => `=== FILE: ${f.path} ===\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')
  const assetListSection = assets.length > 0
    ? assets.map(a => `- ${a.path} (${a.mimeType}, ${a.size || 0} bytes)`).join('\n')
    : 'None (no binary files in project directory)'

  const isSingleFileInline = originalFiles.length === 1 && originalFiles[0].path === 'index.html'
  const modulePlanInstructions = isSingleFileInline
    ? `5. This is a SINGLE-FILE inline HTML project (index.html ONLY — inline <style> and inline <script>, no styles.css or app.js files!).
   plannedModules MUST contain EXACTLY 5 small progressive modules (15-20 minutes total) in HTML document order:
   - Module 1 (componentType: "document-head"): Document Head Setup (<!DOCTYPE html>, <meta charset>, <meta name="viewport">, <title>)
   - Module 2 (componentType: "body-layout"): Body Layout & Heading (main.login-card container and h1 heading matching index.html)
   - Module 3 (componentType: "form"): Login Form Markup (<label for="username">, input#username, button#greet-btn, and p#greeting inside index.html)
   - Module 4 (componentType: "main-section"): Inline CSS Styling (<style> block in <head> matching ORIGINAL index.html styles)
   - Module 5 (componentType: "script-behavior"): Inline JavaScript Greeting Behavior (<script> block at end of <body> handling #greet-btn click to show "Hello, <name>!" when non-empty and "Please enter your username." when empty)`
    : `5. plannedModules MUST contain EXACTLY 5 progressive modules (order 1..5):
   - Module 1: Document Head & Structural HTML Skeleton (linked stylesheet & core layout container)
   - Module 2: Base Styling & Theme Layout (CSS variables, card/board styling matching styles.css)
   - Module 3: Core UI Elements & Interactive Controls (buttons, inputs, or board grid matching index.html)
   - Module 4: Core JavaScript Logic & Event Handling (primary user interaction in app.js)
   - Module 5: State Persistence / Reset & Final Integration (localStorage/reset/complete app matching original files)`

  const prompt = `You are Ascent, an expert curriculum architect.
Design the Product Specification and 5-module progressive syllabus for building the vanilla HTML + CSS + JavaScript project "${meta.title}" (${slug}).

BINARY ASSETS:
${assetListSection}

COMPLETE ORIGINAL SOURCE CODE:
${originalCodeSection}

STRICT RULES:
1. spec.primaryFeatures MUST have >= 3 items.
2. spec.userFlows MUST have >= 2 distinct flows.
3. spec.architectureHighlights MUST have >= 3 items; assumptions >= 2; outOfScope >= 2.
4. spec.techStack MUST describe HTML + CSS + JavaScript (Plain CSS).
${modulePlanInstructions}
6. componentType MUST be one of: ${ALLOWED_COMPONENT_TYPES.join(', ')}.
7. NEVER use the word "demo" anywhere in appName, tagline, summary, features, flows, highlights, page, or module titles/objectives.

Return JSON { spec, page, plannedModules }.`

  const response = await callGeminiWithRetry(ai, {
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          spec: {
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
                  properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
                  required: ['name', 'description']
                }
              },
              userFlows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { flowName: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.STRING } } },
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
                        properties: { name: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } },
                        required: ['name', 'type', 'description']
                      }
                    }
                  },
                  required: ['name', 'storageKey', 'fields']
                }
              },
              techStack: {
                type: Type.OBJECT,
                properties: {
                  runtime: { type: Type.STRING },
                  styling: { type: Type.STRING },
                  stateManagement: { type: Type.STRING },
                  backendSim: { type: Type.STRING },
                  useTailwind: { type: Type.BOOLEAN }
                },
                required: ['runtime', 'styling', 'stateManagement', 'backendSim']
              },
              useTailwind: { type: Type.BOOLEAN },
              architectureHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['appName', 'tagline', 'summary', 'targetAudience', 'primaryFeatures', 'userFlows', 'dataEntities', 'techStack', 'architectureHighlights', 'assumptions', 'outOfScope']
          },
          page: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              projectId: { type: Type.STRING },
              order: { type: Type.INTEGER },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              fileName: { type: Type.STRING },
              purpose: { type: Type.STRING }
            },
            required: ['id', 'projectId', 'order', 'name', 'description', 'fileName', 'purpose']
          },
          plannedModules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                order: { type: Type.INTEGER },
                title: { type: Type.STRING },
                learningObjective: { type: Type.STRING },
                componentType: { type: Type.STRING, enum: [...ALLOWED_COMPONENT_TYPES] }
              },
              required: ['id', 'order', 'title', 'learningObjective', 'componentType']
            }
          }
        },
        required: ['spec', 'page', 'plannedModules']
      }
    }
  })

  const raw = cleanAndParseJSON(response.text || '{}')
  const safeDifficulty = meta.difficulty === 'advanced' ? 'intermediate' : meta.difficulty
  const pageId = raw.page?.id || `page_${slug}`
  const plannedModules: PlannedModuleOutline[] = (Array.isArray(raw.plannedModules) ? raw.plannedModules : []).map(
    (m: any, idx: number) => ({
      id: m.id || `mod_${idx + 1}`,
      order: idx + 1,
      title: m.title || `Module ${idx + 1}`,
      learningObjective: m.learningObjective || m.title || 'Implement step',
      componentType: ALLOWED_COMPONENT_SET.has(m.componentType) ? m.componentType : (idx === 0 ? 'document-head' : 'content-block')
    })
  )

  const normalizedSpec = {
    ...raw.spec,
    useTailwind: false,
    estimatedScreenCount: 1,
    difficulty: safeDifficulty,
    estimatedHours: meta.estimatedHours,
    techStack: {
      runtime: 'HTML + CSS + JavaScript' as const,
      styling: 'Plain CSS' as const,
      stateManagement: 'Browser In-Memory State / DOM' as const,
      backendSim: 'In-Browser LocalStorage / IndexedDB' as const,
      useTailwind: false
    }
  }

  const normalizedPage = {
    id: pageId,
    projectId: raw.page?.projectId || `proj_curated_${slug}`,
    order: 1,
    name: raw.page?.name || meta.title,
    description: raw.page?.description || meta.shortDescription,
    fileName: raw.page?.fileName || 'index.html',
    purpose: raw.page?.purpose || meta.shortDescription,
    modules: plannedModules.map((m, idx) => ({
      ...m,
      pageId,
      status: (idx === 0 ? 'active' : 'locked') as 'locked' | 'active' | 'done'
    }))
  }

  return { spec: normalizedSpec, page: normalizedPage, plannedModules }
}

const singleModuleContentSchema = {
  type: Type.OBJECT,
  properties: {
    lesson: { type: Type.STRING },
    task: { type: Type.STRING },
    requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    expectedResult: { type: Type.STRING },
    references: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, note: { type: Type.STRING } },
        required: ['title', 'url', 'note']
      }
    },
    solutionFiles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { path: { type: Type.STRING }, content: { type: Type.STRING } },
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
          type: {
            type: Type.STRING,
            enum: [
              'elementExists',
              'textContains',
              'styleEquals',
              'attributeEquals',
              'scriptDefines',
              'eventResult',
              'imageLoaded',
              'assetExists'
            ]
          },
          selector: {
            type: Type.STRING,
            description: 'Valid CSS selector using SINGLE quotes inside brackets (e.g. link[href=\'styles.css\'] or input[type=\'number\']). For eventResult, this is the TARGET/OUTPUT element whose text or value is verified AFTER action runs (e.g. "#result" or "#from-currency"), NOT the clicked button unless checking the button itself! Set to "" only for scriptDefines/assetExists.'
          },
          path: {
            type: Type.STRING,
            description: 'Relative asset path for assetExists (e.g. "images/logo.png"). Set to "" for other check types.'
          },
          property: {
            type: Type.STRING,
            description: 'Attribute name (for attributeEquals, e.g. "href") or camelCase CSS property (for styleEquals, e.g. "display"). For eventResult on <input>/<select>, you may set "value" or leave "".'
          },
          expected: {
            type: Type.STRING,
            description: 'Non-empty expected string for textContains, attributeEquals, styleEquals, scriptDefines, and eventResult. Set to "" for elementExists, imageLoaded, and assetExists.'
          },
          message: { type: Type.STRING },
          requirementRef: { type: Type.STRING },
          action: {
            type: Type.OBJECT,
            description: 'Required for eventResult: identifies the TRIGGER element and DOM event to fire before asserting top-level selector.',
            properties: {
              type: { type: Type.STRING, description: 'DOM event type: click | input | change | submit' },
              selector: { type: Type.STRING, description: 'CSS selector of the TRIGGER element to click/input/submit (e.g. "#greet-btn" or "#username").' },
              value: { type: Type.STRING, description: 'Optional new value to assign before dispatching input/change event.' }
            },
            required: ['type', 'selector']
          }
        },
        required: ['id', 'description', 'type', 'selector', 'property', 'expected', 'requirementRef']
      }
    },
    hints: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['lesson', 'task', 'requirements', 'expectedResult', 'references', 'solutionFiles', 'checks', 'hints']
}

async function generateSingleModuleWithGemini(
  ai: GoogleGenAI,
  slug: string,
  meta: { title: string },
  pageId: string,
  planItem: PlannedModuleOutline,
  allModules: PlannedModuleOutline[],
  starterFiles: { path: string; content: string }[],
  originalFiles: { path: string; content: string }[],
  assets: CuratedAsset[],
  repairFeedback?: string
): Promise<ModuleContent> {
  const totalModules = allModules.length
  const isFinal = planItem.order === totalModules
  const upcomingModules = allModules.filter(m => m.order > planItem.order)
  const upcomingSection = upcomingModules.length > 0
    ? `\nUPCOMING MODULES AFTER THIS (DO NOT IMPLEMENT THESE YET — leave their HTML controls, CSS, and JS out of solutionFiles for now!):\n${upcomingModules.map(m => `- Module ${m.order}: ${m.title} (${m.componentType}) — ${m.learningObjective}`).join('\n')}`
    : '\nUPCOMING MODULES: None — this is the FINAL module.'

  const isSingleFileInline = originalFiles.length === 1 && originalFiles[0].path === 'index.html'
  const scopeGuidance =
    planItem.order === 1
      ? isSingleFileInline
        ? 'SCOPE FOR MODULE 1: Implement ONLY the document <head> (<!DOCTYPE html>, lang, charset, viewport, <title> matching ORIGINAL SOURCE CODE) in index.html. Keep <body> minimal/empty without the login card, form, <style>, or <script> yet.'
        : 'SCOPE FOR MODULE 1: Implement ONLY the document <head> (charset, viewport, <title>, <link rel="stylesheet" href="styles.css">), outer page wrapper/card container, and main heading/subtitle matching ORIGINAL SOURCE CODE. Do NOT add interactive inputs, buttons, game boards, result boxes, or <script src="app.js"> yet — save those for later modules!'
      : !isFinal
        ? `SCOPE FOR MODULE ${planItem.order}: Implement ONLY the features needed for "${planItem.title}" (${planItem.componentType}).${isSingleFileInline ? ' Keep EVERYTHING in single-file index.html (inline <style> / inline <script>, never create separate .css or .js files!).' : ''} CRITICAL: DO NOT copy all of ORIGINAL SOURCE CODE yet! Explicitly OMIT features reserved for upcoming module(s) (${upcomingModules.map(m => m.title).join(', ')}) — e.g. save <script> interactivity for Module ${totalModules} so Module ${totalModules} has real code left to build and verify!`
        : `SCOPE FOR FINAL MODULE: Complete ALL remaining features${isSingleFileInline ? ' (inline <script> behavior matching index.html, including greeting "Hello, <name>!" and empty prompt message "Please enter your username.")' : ''} so solutionFiles converges cleanly on ORIGINAL SOURCE CODE. For eventResult checks testing form/greeting behavior: ALWAYS set BOTH action.selector (trigger element) AND top-level property ("text" or "value") and selector (target element). Example: 1) { type: "eventResult", action: { type: "click", selector: "#greet-btn" }, selector: "#greeting", property: "text", expected: "Please enter your username." }, 2) { type: "eventResult", action: { type: "input", selector: "#username", value: "Alice" }, selector: "#username", property: "value", expected: "Alice" }, 3) { type: "eventResult", action: { type: "click", selector: "#greet-btn" }, selector: "#greeting", property: "text", expected: "Hello, Alice!" }.`

  const originalCodeSection = originalFiles
    .map(f => `=== ORIGINAL FILE: ${f.path} ===\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')
  const starterCodeSection = starterFiles
    .map(f => `=== STARTER FILE BEFORE THIS MODULE: ${f.path} ===\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const repairNote = repairFeedback
    ? `\n\nIMPORTANT REPAIR REQUEST FOR PREVIOUS ATTEMPT:\n${repairFeedback}\nAnalyze why the previous attempt failed by comparing STARTER FILES BEFORE THIS MODULE against solutionFiles and ORIGINAL SOURCE CODE:\n- If (a) failed, EVERY check you wrote was ALREADY satisfied in starterFiles! Write checks ONLY for elements, attributes, computed styles, or interactive eventResult behaviors that are MISSING from starterFiles and NEWLY ADDED in your solutionFiles (while also present in ORIGINAL SOURCE CODE).\n- For sequential form interactions (like typing a username then clicking a submit button): checks execute in array order on the same DOM. You MUST put an input check FIRST (action: { type: "input", selector: "#username", value: "Alice" }, selector: "#username", property: "value", expected: "Alice") BEFORE the click check (action: { type: "click", selector: "#greet-btn" }, selector: "#greeting", property: "text", expected: "Hello, Alice!"). Clicking a button does NOT set input values, and typing into an input does NOT click the button!\n- For \`attributeEquals\`, ALWAYS set BOTH \`property\` AND non-empty \`expected\`.\n- Replace any failing or 404 MDN URL with a real verified \`https://developer.mozilla.org/en-US/docs/Web/...\` URL.`
    : ''

  const prompt = `You are Ascent, generating Module ${planItem.order} of ${totalModules} for "${meta.title}" (${slug}).

MODULE TARGET:
- ID: ${planItem.id}
- Title: ${planItem.title}
- Objective: ${planItem.learningObjective}
- Component Type: ${planItem.componentType}
- ${scopeGuidance}
${upcomingSection}

ASSETS INCLUDED: ${assets.length > 0 ? assets.map(a => a.path).join(', ') : 'None'}

${starterCodeSection}

COMPLETE ORIGINAL SOURCE CODE (checks MUST ALSO PASS on this!):
${originalCodeSection}

STRICT RULES:
1. solutionFiles MUST include ALL ${originalFiles.length} file(s) (${originalFiles.map(f => f.path).join(', ')}). Keep everything from STARTER FILES intact unless intentionally updated for THIS module, and ensure every selector, id, class, tag, attribute, and behavior matches ORIGINAL SOURCE CODE (never rename classes or IDs!).
   ${isFinal ? '- Because this is the FINAL module, solutionFiles MUST contain the complete finished code matching ORIGINAL SOURCE CODE.' : ''}
2. checks: Provide 2 to 4 monotonic declarative DOM checks testing ONLY what is NEWLY added/changed in THIS module (things NOT yet present in STARTER FILES above):
   - (a) At least one check MUST FAIL on STARTER FILES above.
   - (b) ALL checks MUST PASS on your solutionFiles.
   - (c) ALL checks MUST PASS on the COMPLETE ORIGINAL SOURCE CODE above!
   - ALLOWED check.type values ONLY (never invent types like "textEquals"):
     * \`elementExists\`: set \`selector\`, \`property: ""\`, \`expected: ""\`
     * \`textContains\`: set \`selector\`, \`property: ""\`, and NON-EMPTY \`expected\`
     * \`attributeEquals\`: set \`selector\`, NON-EMPTY \`property\` (e.g. \`"href"\`), and NON-EMPTY \`expected\` (e.g. \`"styles.css"\`)
     * \`styleEquals\`: set \`selector\`, NON-EMPTY \`property\` (e.g. \`"display"\`), and NON-EMPTY literal \`expected\` (NEVER \`var(--...)\` or shorthands)
     * \`scriptDefines\`: set \`selector: ""\`, \`property: ""\`, and NON-EMPTY \`expected\` (function/variable name)
     * \`eventResult\`: Checks run sequentially in the same DOM! \`action: { type: "click"|"input"|"submit", selector: "<TRIGGER element>", value? }\` (BOTH \`action.type\` AND \`action.selector\` are MANDATORY) triggers the interaction, and TOP-LEVEL \`selector\` + NON-EMPTY \`property\` ("text" | "value" | "class") asserts the target element against NON-EMPTY \`expected\`. If typing into an input before clicking a button, put the \`input\` check BEFORE the \`click\` check! (Never check random \`Math.random()\` outcomes).
     * \`imageLoaded\`: set \`selector\`, \`property: ""\`, \`expected: ""\`
     * \`assetExists\`: set \`selector: ""\`, \`property: ""\`, \`expected: ""\`, and NON-EMPTY \`path\`
   - CRITICAL for CSS selectors: Use SINGLE quotes inside attribute selectors (e.g. \`link[href='styles.css']\`, \`script[src='app.js']\`, \`input[type='number']\`) — NEVER write unquoted \`href=styles.css\` and avoid escaped double quotes inside JSON!
   - Include \`requirementRef\` on every check matching one of \`requirements[]\`.
3. requirements[]: precise bullet strings naming EVERY required id, class, tag, attribute, text string, event, and file path that any check tests.
4. expectedResult: 1-2 sentences describing what the live preview renders or does when done.
5. lesson: 2-3 friendly paragraphs explaining the general front-end concept + tiny UNRELATED code snippet.
6. task: Structured markdown with: brief goal paragraph, exact requirements list, tiny UNRELATED example, and "If you're stuck" pointer to Hints & References.
7. references[]: 2 to 4 live MDN links strictly starting with \`https://developer.mozilla.org/en-US/docs/Web/...\` (do NOT use legacy \`/docs/Learn/\` paths which 404). Every URL will be HTTP-checked.
8. hints[]: 2 to 3 progressive hints (never dump full solution).
9. NEVER use the word "demo" (case-insensitive) anywhere in title, lesson, task, requirements, expectedResult, or hints.${repairNote}

Return JSON for this single module.`

  let raw: any
  for (let jsonAttempt = 0; jsonAttempt < 3; jsonAttempt++) {
    try {
      const response = await callGeminiWithRetry(ai, {
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: singleModuleContentSchema
        }
      })
      raw = cleanAndParseJSON(response.text || '{}')
      break
    } catch (parseErr: any) {
      if (jsonAttempt >= 2) throw parseErr
      console.warn(`    Malformed JSON from Gemini for ${planItem.id} (attempt ${jsonAttempt + 1}/3): ${parseErr?.message?.slice(0, 80)}; retrying...`)
    }
  }
  // Preserve starterFiles deterministically & merge generated solutionFiles over starterFiles
  const starterMap = filesArrayToMap(starterFiles)
  const mergedSolutionMap = { ...starterMap, ...filesArrayToMap(raw.solutionFiles) }
  const normalizedChecks = (Array.isArray(raw.checks) ? raw.checks : []).map((chk: any) => {
    const cleaned = { ...chk }
    if (cleaned.selector === '') delete cleaned.selector
    if (cleaned.path === '') delete cleaned.path
    if (cleaned.property === '') delete cleaned.property
    if (cleaned.expected === '' && !['textContains', 'styleEquals', 'attributeEquals', 'scriptDefines', 'eventResult'].includes(cleaned.type)) {
      delete cleaned.expected
    }
    return cleaned
  })

  return {
    id: planItem.id,
    pageId,
    order: planItem.order,
    title: planItem.title,
    learningObjective: planItem.learningObjective,
    componentType: planItem.componentType as any,
    status: planItem.order === 1 ? 'active' : 'locked',
    lesson: raw.lesson || '',
    task: raw.task || '',
    requirements: Array.isArray(raw.requirements) ? raw.requirements : [],
    expectedResult: raw.expectedResult || '',
    references: Array.isArray(raw.references) ? raw.references : [],
    starterFiles,
    solutionFiles: mapToFilesArray(mergedSolutionMap),
    checks: normalizedChecks,
    hints: Array.isArray(raw.hints) ? raw.hints : []
  }
}

async function verifySingleModule(
  mod: ModuleContent,
  originalFiles: { path: string; content: string }[],
  assets: CuratedAsset[],
  checkRefsStrict: boolean,
  isFinal = false
): Promise<{ row: ModuleVerificationRow; brokenUrls: string[] }> {
  const origFileMap = new Map(originalFiles.map(f => [f.path, f.content]))
  const scopedOriginalFiles = mod.solutionFiles.map(sf => ({
    path: sf.path,
    content: origFileMap.get(sf.path) ?? sf.content
  }))

  const usesRandom = [...mod.solutionFiles, ...originalFiles].some(f => f.content.includes('Math.random'))
  const randomSeeds = usesRandom ? [0.05, 0.45, 0.85] : [undefined]

  const starterRes = await runChecksOnFiles(mod.checks, mod.starterFiles, assets)

  let solutionRes = await runChecksOnFiles(mod.checks, mod.solutionFiles, assets, { fixedRandom: randomSeeds[0] })
  let originalRes = await runChecksOnFiles(mod.checks, originalFiles, assets, { fixedRandom: randomSeeds[0] })
  let scopedOriginalRes = await runChecksOnFiles(mod.checks, scopedOriginalFiles, assets, { fixedRandom: randomSeeds[0] })
  for (const seed of randomSeeds.slice(1)) {
    if (solutionRes.allPassed) {
      solutionRes = await runChecksOnFiles(mod.checks, mod.solutionFiles, assets, { fixedRandom: seed })
    }
    if (originalRes.allPassed) {
      originalRes = await runChecksOnFiles(mod.checks, originalFiles, assets, { fixedRandom: seed })
    }
    if (scopedOriginalRes.allPassed) {
      scopedOriginalRes = await runChecksOnFiles(mod.checks, scopedOriginalFiles, assets, { fixedRandom: seed })
    }
  }

  const starterFailedCount = starterRes.totalCount - starterRes.passedCount
  const starterFailsAtLeastOne = starterFailedCount >= 1
  const solutionAllPass = solutionRes.allPassed
  const originalAllPass = originalRes.allPassed && scopedOriginalRes.allPassed

  const failures: string[] = []
  if (!mod.checks || mod.checks.length === 0) {
    failures.push('checks[] cannot be empty.')
  }
  const checkMap = new Map((mod.checks || []).map(c => [c.id, c]))
  for (const c of mod.checks || []) {
    if (c.type === 'attributeEquals' && (!c.property || c.expected === undefined || c.expected === '')) {
      failures.push(`Check [${c.id}] (${JSON.stringify(c)}) uses attributeEquals without both non-empty "property" and "expected".`)
    }
    if (['textContains', 'styleEquals', 'scriptDefines', 'eventResult'].includes(c.type) && (c.expected === undefined || c.expected === '')) {
      failures.push(`Check [${c.id}] (${JSON.stringify(c)}) is missing required non-empty "expected".`)
    }
    if (
      ['elementExists', 'textContains', 'styleEquals', 'attributeEquals', 'imageLoaded'].includes(c.type) &&
      (!c.selector || !c.selector.trim())
    ) {
      failures.push(`Check [${c.id}] (${JSON.stringify(c)}) is missing required "selector".`)
    }
  }
  if (!starterFailsAtLeastOne) {
    failures.push(`(a) All ${starterRes.totalCount} check(s) already pass on starterFiles; at least 1 must fail.`)
  }
  if (!solutionAllPass) {
    const failedMsgs = solutionRes.results
      .filter(r => !r.passed)
      .map(r => `[${r.id}] ${r.message || 'failed'} (check=${JSON.stringify(checkMap.get(r.id))})`)
      .join('; ')
    failures.push(`(b) solutionFiles failed ${solutionRes.totalCount - solutionRes.passedCount}/${solutionRes.totalCount}: ${failedMsgs}`)
  }
  if (!originalAllPass) {
    const combinedOrigFailures = [
      ...originalRes.results.filter(r => !r.passed).map(r => `[full:${r.id}] ${r.message || 'failed'} (check=${JSON.stringify(checkMap.get(r.id))})`),
      ...scopedOriginalRes.results.filter(r => !r.passed).map(r => `[scoped:${r.id}] ${r.message || 'failed'}`)
    ]
    failures.push(`(c) ORIGINAL PROJECT FILES failed check(s): ${combinedOrigFailures.join('; ')}`)
  }
  if (!mod.requirements || mod.requirements.length === 0) {
    failures.push('Missing requirements[] list.')
  }
  if (!mod.expectedResult || !mod.expectedResult.trim()) {
    failures.push('Missing expectedResult.')
  }
  const moduleTextFields = [
    mod.lesson || '',
    mod.task || '',
    mod.expectedResult || '',
    ...(mod.requirements || []),
    ...(mod.hints || [])
  ].join('\n')
  if (/\bdemo\b/i.test(moduleTextFields)) {
    failures.push('Module text contains forbidden word "demo". Replace it cleanly.')
  }
  if (!isFinal) {
    const normalizeWs = (s: string) => s.replace(/\s+/g, '')
    const solMap = new Map(mod.solutionFiles.map(f => [f.path, normalizeWs(f.content)]))
    const allMatchOriginal = originalFiles.every(f => solMap.get(f.path) === normalizeWs(f.content))
    if (allMatchOriginal) {
      failures.push(
        `Premature full convergence: Module ${mod.order} (non-final) already wrote 100% of ORIGINAL SOURCE CODE, leaving zero unbuilt features for the final module. Remove the final module's features (e.g. persistence/localStorage/history/reset/replay helpers) from solutionFiles.`
      )
    }
  }

  const brokenUrls: string[] = []
  const refs = mod.references || []
  for (const ref of refs) {
    const allowed = isAllowedCuratedReferenceUrl(ref.url)
    const ok = allowed ? await verifyReferenceUrlHttp(ref.url) : false
    if (!ok) {
      brokenUrls.push(ref.url)
      if (checkRefsStrict) {
        failures.push(`Unverified reference URL: ${ref.url}`)
      }
    }
  }
  if (checkRefsStrict && refs.length - brokenUrls.length < 2) {
    failures.push(`Need at least 2 verified https://developer.mozilla.org/en-US/docs/Web/... URLs (currently ${refs.length - brokenUrls.length} valid).`)
  }

  return {
    row: {
      order: mod.order,
      id: mod.id,
      title: mod.title,
      starterFailedCount,
      starterTotal: starterRes.totalCount,
      starterFailsAtLeastOne,
      solutionPassed: solutionRes.passedCount,
      solutionTotal: solutionRes.totalCount,
      solutionAllPass,
      originalPassed: originalRes.passedCount,
      originalTotal: originalRes.totalCount,
      originalAllPass,
      passedAllConditions: failures.length === 0,
      failures
    },
    brokenUrls
  }
}

function printVerificationTable(slug: string, rows: ModuleVerificationRow[]) {
  console.log(`\nVerification Table for [${slug}]:`)
  console.log('Mod | Title                                    | (a) Starter Fails | (b) Solution Passes | (c) Original Passes | Result')
  console.log('----+------------------------------------------+-------------------+---------------------+---------------------+-------')
  for (const r of rows) {
    const titleClip = r.title.length > 40 ? `${r.title.slice(0, 37)}...` : r.title.padEnd(40, ' ')
    const aCol = `${r.starterFailedCount}/${r.starterTotal} ${r.starterFailsAtLeastOne ? 'OK' : 'FAIL'}`.padEnd(17, ' ')
    const bCol = `${r.solutionPassed}/${r.solutionTotal} ${r.solutionAllPass ? 'OK' : 'FAIL'}`.padEnd(19, ' ')
    const cCol = `${r.originalPassed}/${r.originalTotal} ${r.originalAllPass ? 'OK' : 'FAIL'}`.padEnd(19, ' ')
    const resCol = r.passedAllConditions ? 'PASS' : 'FAIL'
    console.log(`${String(r.order).padEnd(3, ' ')} | ${titleClip} | ${aCol} | ${bCol} | ${cCol} | ${resCol}`)
  }
}

async function buildSingleCuratedCourse(ai: GoogleGenAI, slug: string): Promise<{
  indexItem: CuratedCourseIndexItem
  report: CourseVerificationReport
}> {
  const projectDir = path.join(curatedProjectsDir, slug)
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Curated project directory not found: ${projectDir}`)
  }

  console.log(`\n=== Building curated course: ${slug} ===`)
  const { textFiles, assets } = scanAndCopyCuratedProject(slug, projectDir)
  console.log(`  Found ${textFiles.length} code file(s), copied ${assets.length} binary asset(s) to public/curated-assets/${slug}/`)

  const meta = DEFAULT_META[slug] || {
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    shortDescription: `Build ${slug} step-by-step in vanilla HTML, CSS, and JavaScript.`,
    difficulty: 'beginner' as const,
    estimatedHours: 3
  }

  // Stage 1: Generate spec + page + 5-module syllabus
  let outline = await generateCourseOutlineWithGemini(ai, slug, meta, textFiles, assets)
  if (outline.plannedModules.length < 4) {
    console.warn(`  Initial syllabus had ${outline.plannedModules.length} modules (<4); regenerating outline once...`)
    outline = await generateCourseOutlineWithGemini(ai, slug, meta, textFiles, assets)
  }
  outline.page.modules = outline.plannedModules.map((m, idx) => ({
    ...m,
    pageId: outline.page.id,
    status: (idx === 0 ? 'active' : 'locked') as 'locked' | 'active' | 'done'
  }))

  // Stage 2: Build + verify each module cumulatively with 1 targeted repair per failing module
  const isSingleFileInline = textFiles.length === 1 && textFiles[0].path === 'index.html'
  outline.spec.estimatedHours = meta.estimatedHours
  outline.spec.estimatedScreenCount = 1
  outline.spec.useTailwind = false
  if (outline.spec.techStack) outline.spec.techStack.useTailwind = false

  let currentWorkspaceFiles: { path: string; content: string }[] = textFiles.map(f => ({
    path: f.path,
    content: buildStarterShell(f.path, meta.title, isSingleFileInline)
  }))

  const builtModules: ModuleContent[] = []
  const rows: ModuleVerificationRow[] = []
  const repairedModules: string[] = []
  const droppedUrls: { moduleId: string; url: string; reason: string }[] = []

  for (let i = 0; i < outline.plannedModules.length; i++) {
    const planItem = outline.plannedModules[i]
    console.log(`  [${slug}] Generating Module ${planItem.order}/${outline.plannedModules.length}: ${planItem.title}...`)

    let mod = await generateSingleModuleWithGemini(
      ai,
      slug,
      meta,
      outline.page.id,
      planItem,
      outline.plannedModules,
      currentWorkspaceFiles,
      textFiles,
      assets
    )

    const isFinalMod = planItem.order === outline.plannedModules.length
    let { row } = await verifySingleModule(mod, textFiles, assets, true, isFinalMod)
    if (!row.passedAllConditions) {
      console.warn(`    Module ${planItem.order} needs repair: ${row.failures.join(' | ')}`)
      repairedModules.push(mod.id)
      mod = await generateSingleModuleWithGemini(
        ai,
        slug,
        meta,
        outline.page.id,
        planItem,
        outline.plannedModules,
        currentWorkspaceFiles,
        textFiles,
        assets,
        row.failures.join('\n')
      )

      // Drop any remaining unverified/non-MDN reference URLs after repair
      const keptRefs: ReferenceLink[] = []
      for (const ref of mod.references || []) {
        const allowed = isAllowedCuratedReferenceUrl(ref.url)
        const ok = allowed ? await verifyReferenceUrlHttp(ref.url) : false
        if (ok) {
          keptRefs.push(ref)
        } else {
          const reason = allowed ? 'HTTP non-200/unreachable after repair' : 'Disallowed host (non-MDN)'
          droppedUrls.push({ moduleId: mod.id, url: ref.url, reason })
          console.warn(`    Dropped unverified URL in ${mod.id}: ${ref.url} (${reason})`)
        }
      }
      mod.references = keptRefs

      row = (await verifySingleModule(mod, textFiles, assets, false, isFinalMod)).row
    }

    if (!row.starterFailsAtLeastOne || !row.solutionAllPass || !row.originalAllPass) {
      printVerificationTable(slug, [...rows, row])
      throw new Error(
        `ABORTED [${slug}] at Module ${mod.order} ("${mod.title}"): ${row.failures.join(' | ')}`
      )
    }

    builtModules.push(mod)
    rows.push(row)
    currentWorkspaceFiles = mod.solutionFiles.map(f => ({ path: f.path, content: f.content }))
  }

  const course: CuratedCourse = {
    slug,
    title: meta.title,
    shortDescription: meta.shortDescription,
    difficulty: meta.difficulty,
    estimatedHours: meta.estimatedHours,
    useTailwind: false,
    assets,
    spec: outline.spec,
    page: outline.page,
    modules: builtModules,
    finalFiles: textFiles
  }

  printVerificationTable(slug, rows)

  const finalZod = CuratedCourseSchema.safeParse(course)
  if (!finalZod.success) {
    const issues = finalZod.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`ABORTED [${slug}] CuratedCourseSchema validation failed: ${issues}`)
  }

  const report: CourseVerificationReport = {
    slug,
    verifiedAt: new Date().toISOString(),
    model: GEMINI_MODEL,
    assetsCount: assets.length,
    repairedModules,
    droppedUrls,
    allModulesValid: true,
    modules: rows
  }

  fs.mkdirSync(outputDataDir, { recursive: true })
  const courseOutPath = path.join(outputDataDir, `${slug}.json`)
  const reportOutPath = path.join(outputDataDir, `${slug}.verification.json`)
  fs.writeFileSync(courseOutPath, JSON.stringify(finalZod.data, null, 2), 'utf-8')
  fs.writeFileSync(reportOutPath, JSON.stringify(report, null, 2), 'utf-8')

  console.log(`  Wrote verified course -> ${path.relative(rootDir, courseOutPath)}`)
  console.log(`  Wrote verification report -> ${path.relative(rootDir, reportOutPath)}`)

  return {
    indexItem: {
      slug: finalZod.data.slug,
      title: finalZod.data.title,
      shortDescription: finalZod.data.shortDescription,
      difficulty: finalZod.data.difficulty,
      estimatedHours: finalZod.data.estimatedHours
    },
    report
  }
}

async function main() {
  const ai = getGeminiClient()
  const argSlugs = process.argv.slice(2).filter(s => !s.startsWith('-'))
  const allDirs = fs
    .readdirSync(curatedProjectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  const targetSlugs = argSlugs.length > 0 ? argSlugs : allDirs
  if (targetSlugs.length === 0) {
    throw new Error(`No curated project directories found in ${curatedProjectsDir}`)
  }

  const existingIndexPath = path.join(outputDataDir, 'index.json')
  let indexItems: CuratedCourseIndexItem[] = []
  if (argSlugs.length > 0 && fs.existsSync(existingIndexPath)) {
    try {
      indexItems = JSON.parse(fs.readFileSync(existingIndexPath, 'utf-8'))
    } catch {
      indexItems = []
    }
  }

  const reports: CourseVerificationReport[] = []
  for (const slug of targetSlugs) {
    const { indexItem, report } = await buildSingleCuratedCourse(ai, slug)
    reports.push(report)
    if (slug !== 'login-greeting') {
      const idx = indexItems.findIndex(item => item.slug === slug)
      if (idx >= 0) indexItems[idx] = indexItem
      else indexItems.push(indexItem)
    }
  }

  // Ensure canonical order matching catalog cards (never expose login-greeting card)
  indexItems = indexItems.filter(item => item.slug !== 'login-greeting')
  indexItems.sort((a, b) => a.slug.localeCompare(b.slug))
  fs.writeFileSync(existingIndexPath, JSON.stringify(indexItems, null, 2), 'utf-8')

  console.log('\n=== CURATED BUILD COMPLETE ===')
  for (const r of reports) {
    console.log(
      `- ${r.slug}: ${r.modules.length} modules verified, ${r.assetsCount} assets, repaired=[${r.repairedModules.join(', ')}], droppedUrls=${r.droppedUrls.length}`
    )
  }
}

// Run when invoked directly via CLI
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)
if (isDirectExecution) {
  main().catch(err => {
    console.error('\nCURATED BUILD FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
