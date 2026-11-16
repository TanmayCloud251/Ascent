import { Check, CheckResult } from '../schemas/course'

export interface EvaluationSummary {
  allPassed: boolean
  passedCount: number
  totalCount: number
  results: CheckResult[]
}

/**
 * Runs declarative DOM checks against an array of virtual file objects using JSDOM.
 * Used on server for LLM generation verification and automated testing.
 */
export async function runChecksOnFiles(
  checks: Check[],
  files: { path: string; content: string }[]
): Promise<EvaluationSummary> {
  const { JSDOM } = await import('jsdom')
  const htmlFile = files.find(f => f.path.endsWith('.html'))
  const cssFiles = files.filter(f => f.path.endsWith('.css'))
  const jsFiles = files.filter(f => f.path.endsWith('.js'))

  let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><head></head><body></body></html>'

  // If HTML doesn't include CSS or JS in JSDOM, inline them for accurate DOM styling/script testing
  if (cssFiles.length > 0) {
    const combinedCSS = cssFiles.map(c => c.content).join('\n')
    if (!htmlContent.includes('<style>') && !htmlContent.includes(combinedCSS.slice(0, 20))) {
      htmlContent = htmlContent.replace('</head>', `<style>${combinedCSS}</style></head>`)
    }
  }

  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    url: 'http://localhost/'
  })

  const window = dom.window
  const document = window.document

  // Execute JS scripts in JSDOM window context
  for (const js of jsFiles) {
    if (js.content && js.content.trim()) {
      try {
        window.eval(js.content)
      } catch (e: any) {
        // Syntax or runtime warning during partial implementation
      }
    }
  }

  const results: CheckResult[] = []

  for (const check of checks) {
    try {
      const res = await evaluateSingleCheck(check, document, window, jsFiles)
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

/**
 * Evaluates a single check against a Document and Window object.
 */
export async function evaluateSingleCheck(
  check: Check,
  document: Document,
  window: any,
  jsFiles: { path: string; content: string }[] = []
): Promise<CheckResult> {
  const { id, type, selector, expected, property, action, message } = check

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
      const attrName = property || inferTargetAttribute(selector, el)
      const actualVal = el.getAttribute(attrName)
      const passed = actualVal === expected || (!property && Array.from(el.attributes).some(a => a.value === expected))
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
      const inlineStyle = el.style ? (el.style as any)[prop] : undefined
      const computedStyle = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue(prop) : undefined
      const actual = inlineStyle || computedStyle || ''
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
      const inSource = jsFiles.some(f => f.content.includes(target))
      const passed = inWindow || inSource
      return {
        id,
        passed,
        message: passed ? undefined : message || `Identifier or function "${target}" was not defined in JavaScript.`
      }
    }

    case 'eventResult': {
      let actionObj: { type: string; selector: string; value?: string } | null = null
      if (typeof action === 'object' && action !== null) {
        actionObj = action as any
      } else if (typeof action === 'string') {
        actionObj = { type: action, selector: selector || 'button' }
      }

      if (actionObj && actionObj.selector) {
        const triggerEl = document.querySelector(actionObj.selector) as HTMLElement | null
        if (!triggerEl) {
          return { id, passed: false, message: message || `Trigger element "${actionObj.selector}" not found.` }
        }

        if (actionObj.type === 'click') {
          triggerEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
        } else if (actionObj.type === 'input') {
          if ('value' in triggerEl && actionObj.value !== undefined) {
            (triggerEl as any).value = actionObj.value
          }
          triggerEl.dispatchEvent(new window.Event('input', { bubbles: true }))
          triggerEl.dispatchEvent(new window.Event('change', { bubbles: true }))
        } else if (actionObj.type === 'submit') {
          triggerEl.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
        }

        // Allow microtask cycle for event handlers to execute
        await new Promise(r => setTimeout(r, 20))
      }

      // Assert target outcome
      if (selector) {
        const targetEl = document.querySelector(selector)
        if (!targetEl) return { id, passed: false, message: message || `Target element "${selector}" not found after event.` }
        if (expected) {
          const text = (targetEl.textContent || '') + ' ' + (targetEl.getAttribute('value') || '')
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

function inferTargetAttribute(selector: string, el: Element): string {
  // Prefer bare [attr] without '=' first
  const bareMatch = selector.match(/\[([a-zA-Z0-9_-]+)\]/)
  if (bareMatch) return bareMatch[1]
  const tag = el.tagName.toUpperCase()
  if (tag === 'LINK' || tag === 'A') return 'href'
  if (tag === 'IMG' || tag === 'SCRIPT' || tag === 'SOURCE') return 'src'
  if (tag === 'META') return 'content'
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'OPTION') return 'value'
  const filterMatch = selector.match(/\[([a-zA-Z0-9_-]+)/)
  return filterMatch ? filterMatch[1] : 'src'
}

export { getIframeCheckRunnerScript } from './iframeCheckScript'
