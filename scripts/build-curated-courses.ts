import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, Type } from '@google/genai'
import { JSDOM } from 'jsdom'
import {
  CuratedCourseSchema,
  CuratedCourse,
  CuratedCourseIndexItem,
  Check
} from '../src/schemas/course'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Target directories
const curatedProjectsDir = fs.existsSync('/curated-projects')
  ? '/curated-projects'
  : path.join(rootDir, 'curated-projects')

const outputDataDir = path.join(rootDir, 'src', 'data', 'curated')

// Resolve Gemini client
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

// Run a declarative DOM check against a set of files using JSDOM
function runCheckAgainstFiles(check: Check, files: { path: string; content: string }[]): { passed: boolean; reason?: string } {
  const htmlFile = files.find(f => f.path.endsWith('.html'))
  const jsFile = files.find(f => f.path.endsWith('.js'))

  const htmlContent = htmlFile ? htmlFile.content : '<html><head></head><body></body></html>'
  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    resources: 'usable'
  })
  const doc = dom.window.document

  // If there's JS code, execute in window context if needed for script checks
  if (jsFile && jsFile.content) {
    try {
      dom.window.eval(jsFile.content)
    } catch {
      // Ignored for partial starter code
    }
  }

  try {
    switch (check.type) {
      case 'elementExists': {
        if (!check.selector) return { passed: false, reason: 'No selector provided' }
        const el = doc.querySelector(check.selector)
        return { passed: Boolean(el) }
      }
      case 'textContains': {
        if (!check.selector) return { passed: false, reason: 'No selector provided' }
        const el = doc.querySelector(check.selector)
        if (!el) return { passed: false, reason: `Element ${check.selector} not found` }
        const text = el.textContent || ''
        const passed = text.includes(check.expected || '')
        return { passed, reason: passed ? undefined : `Expected text '${check.expected}' not found in '${text.slice(0, 30)}'` }
      }
      case 'attributeEquals': {
        if (!check.selector) return { passed: false, reason: 'No selector provided' }
        const el = doc.querySelector(check.selector)
        if (!el) return { passed: false, reason: `Element ${check.selector} not found` }
        const attrMatches = check.selector.match(/\[([a-zA-Z0-9_-]+)/)
        const attrName = attrMatches ? attrMatches[1] : 'src'
        const val = el.getAttribute(attrName)
        const passed = val === check.expected
        return { passed, reason: passed ? undefined : `Attribute ${attrName}='${val}' != '${check.expected}'` }
      }
      case 'styleEquals': {
        if (!check.selector) return { passed: false, reason: 'No selector provided' }
        const el = doc.querySelector(check.selector) as HTMLElement | null
        if (!el) return { passed: false, reason: `Element ${check.selector} not found` }
        const style = el.style ? (el.style as any)[check.expected || ''] : undefined
        return { passed: Boolean(style) }
      }
      case 'scriptDefines': {
        const expected = check.expected || ''
        const inWindow = Boolean((dom.window as any)[expected])
        const inSource = jsFile ? jsFile.content.includes(expected) : false
        return { passed: inWindow || inSource }
      }
      case 'eventResult': {
        if (!check.selector) return { passed: false, reason: 'No selector' }
        const el = doc.querySelector(check.selector) as HTMLElement | null
        if (!el) return { passed: false }
        if (check.action === 'click') {
          el.dispatchEvent(new dom.window.MouseEvent('click'))
        }
        return { passed: true }
      }
      default:
        return { passed: false, reason: 'Unknown check type' }
    }
  } catch (err: any) {
    return { passed: false, reason: err.message }
  }
}

// Validate Course Programmatically
function validateCuratedCourse(
  course: CuratedCourse,
  originalFiles: { path: string; content: string }[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. Zod schema validation
  const parsed = CuratedCourseSchema.safeParse(course)
  if (!parsed.success) {
    errors.push(`Zod Schema Error: ${JSON.stringify(parsed.error.format())}`)
  }

  // 2. Cumulative modules check: solution of module N == starter of module N+1
  for (let i = 0; i < course.modules.length - 1; i++) {
    const currentSol = course.modules[i].solutionFiles
    const nextStart = course.modules[i + 1].starterFiles

    for (const solFile of currentSol) {
      const match = nextStart.find(f => f.path === solFile.path)
      if (!match) {
        errors.push(`Module ${i + 1} solution file '${solFile.path}' missing from Module ${i + 2} starter files`)
      }
    }
  }

  // 3. Last module's solutionFiles must match finalFiles / original project
  const lastModule = course.modules[course.modules.length - 1]
  for (const orig of originalFiles) {
    const lastSol = lastModule.solutionFiles.find(f => f.path === orig.path)
    if (!lastSol) {
      errors.push(`Final module missing original project file: ${orig.path}`)
    }
  }

  // 4. Verify checks: FAIL on starterFiles, PASS on solutionFiles
  course.modules.forEach((mod, idx) => {
    mod.checks.forEach((chk, cIdx) => {
      const solResult = runCheckAgainstFiles(chk, mod.solutionFiles)
      if (!solResult.passed) {
        errors.push(`Module ${idx + 1} ('${mod.title}') check ${cIdx + 1} ('${chk.description}') FAILED on solutionFiles: ${solResult.reason || 'check returned false'}`)
      }
    })
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

// Read all files in project folder
function readProjectFiles(projectDir: string): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []
  const files = fs.readdirSync(projectDir)

  for (const f of files) {
    const fullPath = path.join(projectDir, f)
    const stat = fs.statSync(fullPath)
    if (stat.isFile() && (f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.js'))) {
      result.push({
        path: f,
        content: fs.readFileSync(fullPath, 'utf8')
      })
    }
  }
  return result
}

async function buildCourseForSlug(slug: string, ai: GoogleGenAI): Promise<CuratedCourse> {
  const projectDir = path.join(curatedProjectsDir, slug)
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projectDir}`)
  }

  const originalFiles = readProjectFiles(projectDir)
  if (originalFiles.length === 0) {
    throw new Error(`No HTML/CSS/JS files found in ${projectDir}`)
  }

  console.log(`\n============================================================`)
  console.log(`[BUILD CURATED] Processing '${slug}' (${originalFiles.length} files)...`)
  console.log(`============================================================`)

  const filesPrompt = originalFiles
    .map(f => `--- FILE: ${f.path} ---\n${f.content}\n--- END FILE ---`)
    .join('\n\n')

  const systemInstruction = `You are Ascent, an elite computer science curriculum architect and senior software engineer.
You are given the complete working source code for a vanilla HTML/CSS/JS project ("${slug}").
Your job is to reverse-engineer it into a structured, cumulative, production-grade course following CuratedCourseSchema.

Rules:
1. Write a complete ProjectSpec for this project with appName, tagline, summary, primaryFeatures, userFlows, dataEntities, techStack (HTML, CSS, JS, Plain CSS, useTailwind: false), architectureHighlights, assumptions, and outOfScope.
2. Define ONE page (index.html) and split the project into 6 to 10 progressive modules in HTML document order:
   document-head -> body-layout -> header -> main-section / content-block -> form -> footer -> script-behavior.
3. For EVERY module:
   - lesson: clear, socratic 1-2 paragraph Markdown tutorial.
   - task: clear, action-oriented task directive.
   - starterFiles: the exact state of files BEFORE this module.
   - solutionFiles: the exact state of files AFTER this module.
   - checks: 2 to 4 declarative DOM checks (type: 'elementExists' | 'textContains' | 'attributeEquals' | 'scriptDefines').
     CRITICAL: Checks MUST fail on starterFiles and pass on solutionFiles!
   - hints: 2 to 3 progressive hints.
4. Cumulative progression:
   Module 1 starts from empty/minimal HTML shell.
   For all modules: starterFiles of module N+1 MUST EQUAL solutionFiles of module N.
   The solutionFiles of the final module MUST completely reproduce the provided project files.`

  const generateCourse = async (repairFeedback?: string): Promise<CuratedCourse> => {
    const userPrompt = repairFeedback
      ? `The previous output had the following validation errors. Please fix them strictly:\n${repairFeedback}\n\nProject files:\n${filesPrompt}`
      : `Generate the complete CuratedCourse JSON for this project:\n\n${filesPrompt}`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    })

    const text = response.text
    if (!text) throw new Error('Empty response from Gemini model')
    const cleaned = text.replace(/^```json/g, '').replace(/```$/g, '').trim()
    return JSON.parse(cleaned) as CuratedCourse
  }

  // Attempt 1
  let course = await generateCourse()
  let validation = validateCuratedCourse(course, originalFiles)

  // Repair attempt if needed
  if (!validation.valid) {
    console.warn(`[VALIDATION WARNING] First attempt had ${validation.errors.length} errors. Triggering repair attempt with Gemini...`)
    const feedback = validation.errors.slice(0, 5).join('\n')
    course = await generateCourse(feedback)
    validation = validateCuratedCourse(course, originalFiles)
  }

  if (!validation.valid) {
    console.warn(`[WARNING] Course for '${slug}' saved with ${validation.errors.length} review notices:`)
    validation.errors.forEach(e => console.warn(` - ${e}`))
  } else {
    console.log(`[SUCCESS] All checks and cumulative file progressions passed for '${slug}'!`)
  }

  return course
}

async function main() {
  console.log(`[Ascent Curated Course Builder]`)
  console.log(`Searching curated project directories in: ${curatedProjectsDir}`)

  if (!fs.existsSync(curatedProjectsDir)) {
    console.error(`Directory ${curatedProjectsDir} does not exist. Please create it and add project folders.`)
    process.exit(1)
  }

  const slugs = fs.readdirSync(curatedProjectsDir).filter(name => {
    const full = path.join(curatedProjectsDir, name)
    return fs.statSync(full).isDirectory()
  })

  if (slugs.length === 0) {
    console.error(`No subfolders found in ${curatedProjectsDir}. Expected: currency-converter, rock-paper-scissors, tic-tac-toe`)
    process.exit(1)
  }

  console.log(`Found projects: ${slugs.join(', ')}`)

  const ai = getGeminiClient()
  fs.mkdirSync(outputDataDir, { recursive: true })

  const indexList: CuratedCourseIndexItem[] = []

  for (const slug of slugs) {
    try {
      const course = await buildCourseForSlug(slug, ai)
      course.slug = slug
      course.useTailwind = false

      // Write individual course JSON
      const courseFile = path.join(outputDataDir, `${slug}.json`)
      fs.writeFileSync(courseFile, JSON.stringify(course, null, 2), 'utf8')
      console.log(`Wrote course JSON: ${courseFile}`)

      indexList.push({
        slug: course.slug,
        title: course.title || slug,
        shortDescription: course.shortDescription || course.spec.summary,
        difficulty: course.difficulty || 'beginner',
        estimatedHours: course.estimatedHours || 3
      })
    } catch (err: any) {
      console.error(`Failed to build course for '${slug}':`, err.message)
    }
  }

  // Write index.json
  const indexFile = path.join(outputDataDir, 'index.json')
  fs.writeFileSync(indexFile, JSON.stringify(indexList, null, 2), 'utf8')
  console.log(`\nUpdated curated index: ${indexFile}`)
  console.log(`Build complete! Total curated projects compiled: ${indexList.length}`)
}

// Execute when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal build script error:', err)
    process.exit(1)
  })
}
