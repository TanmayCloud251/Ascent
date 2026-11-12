import { Check, CheckResult } from '../schemas/course'
import { JSDOM } from 'jsdom'
import { resolveRelativeProjectPath } from './previewBuilder'

export interface EvaluationSummary {
  allPassed: boolean
  passedCount: number
  totalCount: number
  results: CheckResult[]
}

export interface CheckAssetEntry {
  path: string
  mimeType?: string
  size?: number
}

function normalizeAssetLookupPath(raw: string): string {
  return raw.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

function getTagAttr(attrs: string, attrName: string): string | null {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = attrs.match(re)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3] ?? ''
}

function stripTagAttr(attrs: string, attrName: string): string {
  const re = new RegExp(`\\s+${attrName}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi')
  return attrs.replace(re, '')
}

/**
 * Runs declarative DOM checks against an array of virtual file objects using JSDOM.
 * Used on server for LLM generation verification, curated build verification, and automated testing.
 */
export async function runChecksOnFiles(
  checks: Check[],
  files: { path: string; content: string }[],
  assets: CheckAssetEntry[] = [],
  options?: { fixedRandom?: number; entryHtmlPath?: string }
): Promise<EvaluationSummary> {
  const normalizedFiles = files.map(f => ({
    path: normalizeAssetLookupPath(f.path),
    content: f.content
  }))
  const fileMap = new Map(normalizedFiles.map(f => [f.path, f.content]))
  const assetMap = new Map(
    assets.map(a => [normalizeAssetLookupPath(a.path), a])
  )

  const requestedHtml = options?.entryHtmlPath ? normalizeAssetLookupPath(options.entryHtmlPath) : ''
  const htmlFile =
    (requestedHtml ? normalizedFiles.find(f => f.path === requestedHtml) : undefined) ||
    normalizedFiles.find(f => f.path === 'index.html') ||
    normalizedFiles.find(f => f.path === 'index.htm') ||
    normalizedFiles.find(f => f.path.endsWith('.html'))
  const baseHtmlPath = htmlFile ? htmlFile.path : 'index.html'
  const cssFiles = normalizedFiles
    .filter(f => f.path.toLowerCase().endsWith('.css'))
    .sort((a, b) => a.path.localeCompare(b.path))
  const jsFiles = normalizedFiles
    .filter(f => f.path.toLowerCase().endsWith('.js'))
    .sort((a, b) => a.path.localeCompare(b.path))

  let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><head></head><body></body></html>'
  if (!/<html[\s>]/i.test(htmlContent)) {
    htmlContent = `<!DOCTYPE html><html><head></head><body>${htmlContent}</body></html>`
  }
  if (!/<head[\s>]/i.test(htmlContent)) {
    htmlContent = htmlContent.replace(/<html[^>]*>/i, '$&\n<head></head>')
  }
  if (!/<\/head>/i.test(htmlContent)) {
    htmlContent = htmlContent.replace(/<body[^>]*>/i, '</head>\n$&')
  }

  let sawLocalCssLink = false
  htmlContent = htmlContent.replace(/<link\b([^>]*)>/gi, (full, attrs = '') => {
    const rel = (getTagAttr(attrs, 'rel') || '').toLowerCase()
    const rawHref = getTagAttr(attrs, 'href')
    if (!rawHref) return full
    const resolved = resolveRelativeProjectPath(rawHref, baseHtmlPath)
    if (!resolved) return full
    if (rel.includes('stylesheet') || resolved.toLowerCase().endsWith('.css')) {
      sawLocalCssLink = true
      const cssBody = fileMap.get(resolved)
      if (cssBody !== undefined) {
        return `${full}<style>${cssBody.replace(/<\/style/gi, '<\\/style')}</style>`
      }
      return full
    }
    return full
  })

  // Fallback CSS inlining if HTML has no local stylesheet link tags
  if (!sawLocalCssLink && cssFiles.length > 0) {
    const combinedCSS = cssFiles.map(c => c.content).join('\n')
    if (!htmlContent.includes('<style>') && !htmlContent.includes(combinedCSS.slice(0, 20))) {
      htmlContent = htmlContent.replace(/<\/head>/i, `<style>${combinedCSS.replace(/<\/style/gi, '<\\/style')}</style></head>`)
    }
  }

  // Determine ordered JS scripts to execute (either HTML-referenced script order or fallback all JS files)
  // Keep original `<script src="...">` tags intact in JSDOM DOM so selectors like `script[src="app.js"]` match directly.
  const orderedJsFiles: { path: string; content: string }[] = []
  let sawLocalScriptSrc = false
  const scriptSrcRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  while ((sm = scriptSrcRe.exec(htmlContent)) !== null) {
    const attrs = sm[1] || ''
    const rawSrc = getTagAttr(attrs, 'src')
    if (rawSrc !== null) {
      const resolved = resolveRelativeProjectPath(rawSrc, baseHtmlPath)
      if (resolved) {
        sawLocalScriptSrc = true
        const content = fileMap.get(resolved)
        if (content !== undefined) {
          orderedJsFiles.push({ path: resolved, content })
        }
      }
    }
  }

  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    url: 'http://localhost/'
  })

  const window = dom.window
  const document = window.document
  if (typeof options?.fixedRandom === 'number') {
    window.Math.random = () => options.fixedRandom!
  }

  const scriptsToRun = sawLocalScriptSrc ? orderedJsFiles : jsFiles
  for (const js of scriptsToRun) {
    if (js.content && js.content.trim()) {
      try {
        window.eval(js.content)
      } catch (e: any) {
        // Syntax or runtime warning during partial implementation
      }
    }
  }

  const knownAllPaths = new Set<string>([
    ...normalizedFiles.map(f => f.path),
    ...assets.map(a => normalizeAssetLookupPath(a.path))
  ])

  const results: CheckResult[] = []

  for (const check of checks) {
    try {
      const res = await evaluateSingleCheck(check, document, window, normalizedFiles, {
        knownPaths: knownAllPaths,
        assetMap,
        fileMap,
        baseHtmlPath
      })
      results.push(res)
    } catch (err: any) {
      results.push({
        id: check.id,
        passed: false,
        message: check.message || `Check error: ${err.message}`
      })
    }
  }

  const passedCount = results.filter(r => r.passed).length
  return {
    allPassed: passedCount === results.length && results.length > 0,
    passedCount,
    totalCount: results.length,
    results
  }
}

export interface CheckEvalContext {
  knownPaths?: Set<string>
  assetMap?: Map<string, CheckAssetEntry>
  fileMap?: Map<string, string>
  baseHtmlPath?: string
}

/**
 * Evaluates a single check against a Document and Window object.
 */
export async function evaluateSingleCheck(
  check: Check,
  document: Document,
  window: any,
  jsFiles: { path: string; content: string }[] = [],
  context: CheckEvalContext = {}
): Promise<CheckResult> {
  const { id, type, selector, expected, property, action, message, path: checkPath } = check
  const allJsFiles = jsFiles.filter(f => f.path.toLowerCase().endsWith('.js'))

  switch (type) {
    case 'elementExists': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const el = document.querySelector(selector)
      const passed = Boolean(el)
      return {
        id,
        passed,
        message: passed ? undefined : message || `Element "${selector}" was not found in the document.`
      }
    }

    case 'elementCount': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const count = document.querySelectorAll(selector).length
      const targetCount = parseInt(expected || '1', 10)
      const passed = count === targetCount
      return {
        id,
        passed,
        message: passed ? undefined : message || `Expected ${targetCount} of "${selector}", but found ${count}.`
      }
    }

    case 'textContains': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const el = document.querySelector(selector)
      if (!el) return { id, passed: false, message: message || `Element "${selector}" not found.` }
      const text = (el.textContent || '').trim()
      const target = (expected || '').trim()
      const passed = text.toLowerCase().includes(target.toLowerCase())
      return {
        id,
        passed,
        message: passed ? undefined : message || `Element "${selector}" text does not include "${target}".`
      }
    }

    case 'attributeEquals': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const el = document.querySelector(selector)
      if (!el) return { id, passed: false, message: message || `Element "${selector}" not found.` }
      const attrName = property || extractAttributeNameFromSelector(selector, el.tagName, expected) || 'src'
      const origAttr = (attrName === 'src' || attrName === 'href') ? el.getAttribute(`data-ascent-orig-${attrName}`) : null
      const actualVal = origAttr !== null ? origAttr : el.getAttribute(attrName)
      const passed = actualVal === expected
      return {
        id,
        passed,
        message: passed ? undefined : message || `Attribute "${attrName}" is "${actualVal || ''}", expected "${expected}".`
      }
    }

    case 'classContains': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const el = document.querySelector(selector)
      if (!el) return { id, passed: false, message: message || `Element "${selector}" not found.` }
      const targetClass = (expected || property || '').trim()
      const classes = Array.from(el.classList)
      const passed = classes.includes(targetClass) || el.className.includes(targetClass)
      return {
        id,
        passed,
        message: passed ? undefined : message || `Element "${selector}" is missing class "${targetClass}".`
      }
    }

    case 'styleEquals': {
      if (!selector) return { id, passed: false, message: 'Missing selector' }
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) return { id, passed: false, message: message || `Element "${selector}" not found.` }
      const prop = property || 'color'
      const kebabProp = prop.includes('-') ? prop : prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
      const inlineStyle = el.style ? ((el.style as any)[prop] || el.style.getPropertyValue(kebabProp)) : undefined
      const cs = window.getComputedStyle ? window.getComputedStyle(el) : undefined
      const computedStyle = cs ? (cs.getPropertyValue(kebabProp) || cs.getPropertyValue(prop) || (cs as any)[prop]) : undefined
      const actual = String(inlineStyle || computedStyle || '')
      const passed = actual.toLowerCase().includes((expected || '').toLowerCase())
      return {
        id,
        passed,
        message: passed ? undefined : message || `CSS property "${prop}" is "${actual}", expected "${expected}".`
      }
    }

    case 'scriptDefines': {
      const target = (expected || property || '').trim()
      const inWindow = Boolean(window[target])
      const inJsFiles = allJsFiles.some(f => f.content.includes(target))
      const inlineScripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n')
      const inInlineScripts = inlineScripts.includes(target)
      const passed = inWindow || inJsFiles || inInlineScripts
      return {
        id,
        passed,
        message: passed ? undefined : message || `Identifier or function "${target}" was not defined in JavaScript.`
      }
    }

    case 'imageLoaded': {
      if (!selector) return { id, passed: false, message: 'Missing selector for imageLoaded' }
      const el = document.querySelector(selector) as HTMLImageElement | null
      if (!el) return { id, passed: false, message: message || `Image element "${selector}" not found.` }
      if (el.tagName.toUpperCase() !== 'IMG') {
        return { id, passed: false, message: message || `Element "${selector}" is not an <img>.` }
      }
      const origSrc = el.getAttribute('data-ascent-orig-src') || el.getAttribute('src') || ''
      if (!origSrc.trim()) {
        return { id, passed: false, message: message || `Image "${selector}" has an empty src attribute.` }
      }
      if ((el as any).naturalWidth > 0) {
        return { id, passed: true }
      }
      if (/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i.test(origSrc) || /^data:image\/svg\+xml/i.test(origSrc)) {
        const commaIdx = origSrc.indexOf(',')
        const payload = commaIdx >= 0 ? origSrc.slice(commaIdx + 1).trim() : ''
        const passed = payload.length > 0
        return {
          id,
          passed,
          message: passed ? undefined : message || `Image "${selector}" has empty data URI payload.`
        }
      }
      const resolved = resolveRelativeProjectPath(origSrc, context.baseHtmlPath || 'index.html')
      if (resolved) {
        const matchedAsset = context.assetMap?.get(resolved)
        const matchedSvg = resolved.toLowerCase().endsWith('.svg') ? context.fileMap?.get(resolved) : undefined
        const passed = Boolean(
          (matchedAsset && (matchedAsset.size === undefined || matchedAsset.size > 0)) ||
          (matchedSvg && matchedSvg.trim().length > 0)
        )
        return {
          id,
          passed,
          message: passed ? undefined : message || `Image "${selector}" references missing asset "${origSrc}".`
        }
      }
      return {
        id,
        passed: false,
        message: message || `Image "${selector}" did not load (src="${origSrc}").`
      }
    }

    case 'assetExists': {
      const rawPath = String(checkPath || expected || property || selector || '').trim()
      if (!rawPath) return { id, passed: false, message: 'Missing file path for assetExists' }
      const normPath = normalizeAssetLookupPath(rawPath)
      const existsInKnown = context.knownPaths?.has(normPath)
      const existsInPassedFiles = jsFiles.some(f => normalizeAssetLookupPath(f.path) === normPath)
      const passed = Boolean(existsInKnown || existsInPassedFiles)
      return {
        id,
        passed,
        message: passed ? undefined : message || `Project asset "${normPath}" does not exist.`
      }
    }

    case 'eventResult': {
      let actionObj: { type: string; selector: string; value?: string } | null = null
      if (typeof action === 'object' && action !== null) {
        actionObj = action as { type: string; selector: string; value?: string }
      } else if (typeof action === 'string') {
        const trimmed = action.trim()
        const inputEqMatch = trimmed.match(/^(input|change)\s+([^\s=]+)(?:\s*=\s*|\s+)(.*)$/i)
        const simpleMatch = trimmed.match(/^(click|submit|focus|blur|input|change)\s+(.+)$/i)
        if (inputEqMatch) {
          actionObj = { type: inputEqMatch[1].toLowerCase(), selector: inputEqMatch[2], value: inputEqMatch[3] }
        } else if (simpleMatch) {
          actionObj = { type: simpleMatch[1].toLowerCase(), selector: simpleMatch[2].trim() }
        } else {
          actionObj = { type: trimmed.toLowerCase(), selector: selector || 'button' }
        }
      }

      if (actionObj && actionObj.selector) {
        const triggerEl = document.querySelector(actionObj.selector) as HTMLElement | null
        if (!triggerEl) {
          return { id, passed: false, message: message || `Trigger element "${actionObj.selector}" not found.` }
        }

        if (actionObj.type === 'click') {
          triggerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
        } else if (actionObj.type === 'input' || actionObj.type === 'change') {
          if ('value' in triggerEl && actionObj.value !== undefined) {
            (triggerEl as any).value = actionObj.value
          }
          triggerEl.dispatchEvent(new window.Event('input', { bubbles: true }))
          triggerEl.dispatchEvent(new window.Event('change', { bubbles: true }))
        } else if (actionObj.type === 'submit') {
          triggerEl.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
        } else {
          triggerEl.dispatchEvent(new window.Event(actionObj.type, { bubbles: true, cancelable: true }))
        }

        // Allow microtask/timer cycle for event handlers to execute
        await new Promise(r => setTimeout(r, 25))
      }

      // Assert target outcome
      if (selector) {
        const targetEl = document.querySelector(selector)
        if (!targetEl) return { id, passed: false, message: message || `Target element "${selector}" not found after event.` }

        if (property && expected !== undefined) {
          if (property === 'class' || property === 'className') {
            const passed = targetEl.classList.contains(expected) || (targetEl.className || '').split(/\s+/).includes(expected)
            return {
              id,
              passed,
              message: passed ? undefined : message || `Expected "${selector}" to have class "${expected}" after event.`
            }
          }
          if (property === 'text' || property === 'textContent') {
            const actualText = targetEl.textContent || ''
            const passed = actualText.toLowerCase().includes(expected.toLowerCase())
            return {
              id,
              passed,
              message: passed ? undefined : message || `Expected text "${expected}" on "${selector}" after event (got "${actualText.trim()}").`
            }
          }
          if (property === 'value') {
            const actualVal = String((targetEl as any).value ?? targetEl.getAttribute('value') ?? '')
            const passed = actualVal === expected || actualVal.toLowerCase().includes(expected.toLowerCase())
            return {
              id,
              passed,
              message: passed ? undefined : message || `Expected value "${expected}" on "${selector}" after event (got "${actualVal}").`
            }
          }
          const attrVal = targetEl.getAttribute(property)
          if (attrVal !== null) {
            const passed = attrVal === expected
            return {
              id,
              passed,
              message: passed ? undefined : message || `Expected attribute "${property}"="${expected}" on "${selector}" after event (got "${attrVal}").`
            }
          }
          const styleVal = window.getComputedStyle(targetEl).getPropertyValue(property) || (targetEl as HTMLElement).style?.getPropertyValue(property) || ''
          const domProp = (targetEl as any)[property]
          const actual = styleVal || (domProp !== undefined ? String(domProp) : '')
          const passed = actual === expected || actual.toLowerCase() === expected.toLowerCase()
          return {
            id,
            passed,
            message: passed ? undefined : message || `Expected "${property}" to be "${expected}" on "${selector}" after event (got "${actual}").`
          }
        }

        if (expected) {
          const text = (targetEl.textContent || '') + ' ' + String((targetEl as any).value ?? targetEl.getAttribute('value') ?? '')
          const passed = text.toLowerCase().includes(expected.toLowerCase())
          return {
            id,
            passed,
            message: passed ? undefined : message || `Expected "${expected}" after event on "${selector}".`
          }
        }
      }

      return { id, passed: true }
    }

    default:
      return { id, passed: false, message: `Unknown check type: ${type}` }
  }
}

function extractAttributeNameFromSelector(selector: string, tagName?: string, expected?: string): string | null {
  // Prefer a standalone attribute selector without a value comparison (e.g., input[placeholder])
  const valueless = selector.match(/\[([a-zA-Z0-9_-]+)\]/)
  if (valueless) return valueless[1]
  const tag = (tagName || '').toLowerCase()
  if (tag === 'link' || tag === 'a' || /^\s*(link|a)\b/i.test(selector) || (expected && expected.endsWith('.css'))) {
    return 'href'
  }
  if (tag === 'script' || tag === 'img' || /^\s*(script|img)\b/i.test(selector)) {
    return 'src'
  }
  const match = selector.match(/\[([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export { getIframeCheckRunnerScript } from './iframeCheckScript'
