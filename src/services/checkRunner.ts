import { Check, CheckResult } from '../schemas/course'
import { JSDOM } from 'jsdom'

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
    resources: 'usable',
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
      const attrName = property || extractAttributeNameFromSelector(selector) || 'src'
      const actualVal = el.getAttribute(attrName)
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

function extractAttributeNameFromSelector(selector: string): string | null {
  const match = selector.match(/\[([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

/**
 * Returns the client-side JavaScript snippet to inject into the sandboxed preview iframe.
 * The script listens for postMessage `{ type: 'RUN_CHECKS', checks }`, executes them against
 * the iframe's DOM, and posts back `{ type: 'CHECKS_RESULT', results }`.
 */
export function getIframeCheckRunnerScript(): string {
  return `
(function() {
  // Capture console messages and runtime errors
  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalError = console.error;

  function sendConsole(level, args) {
    try {
      var text = Array.from(args).map(function(a) {
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch(e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'CONSOLE_LOG', level: level, message: text }, '*');
    } catch(e) {}
  }

  console.log = function() { sendConsole('info', arguments); originalLog.apply(console, arguments); };
  console.warn = function() { sendConsole('warn', arguments); originalWarn.apply(console, arguments); };
  console.error = function() { sendConsole('error', arguments); originalError.apply(console, arguments); };

  window.addEventListener('error', function(event) {
    window.parent.postMessage({
      type: 'CONSOLE_LOG',
      level: 'error',
      message: (event.message || 'Error') + ' at line ' + (event.lineno || 0)
    }, '*');
  });

  // Listen for parent check runner requests
  window.addEventListener('message', async function(ev) {
    var data = ev.data;
    if (!data || data.type !== 'RUN_CHECKS') return;

    var checks = data.checks || [];
    var results = [];

    for (var i = 0; i < checks.length; i++) {
      var check = checks[i];
      var checkResult = { id: check.id, passed: false, message: check.message };

      try {
        var timeoutPromise = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Check timed out after 2000ms')); }, 2000);
        });

        var execPromise = (async function() {
          var sel = check.selector;
          var exp = check.expected;
          var prop = check.property;

          switch(check.type) {
            case 'elementExists': {
              var el = document.querySelector(sel);
              return Boolean(el);
            }
            case 'elementCount': {
              var count = document.querySelectorAll(sel).length;
              var target = parseInt(exp || '1', 10);
              return count === target;
            }
            case 'textContains': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var txt = (el.textContent || '').trim().toLowerCase();
              return txt.indexOf((exp || '').trim().toLowerCase()) !== -1;
            }
            case 'attributeEquals': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var attrName = prop || (sel && sel.match(/\\[([a-zA-Z0-9_-]+)/) ? sel.match(/\\[([a-zA-Z0-9_-]+)/)[1] : 'src');
              return el.getAttribute(attrName) === exp;
            }
            case 'classContains': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var targetCls = (exp || prop || '').trim();
              return el.classList.contains(targetCls) || el.className.indexOf(targetCls) !== -1;
            }
            case 'styleEquals': {
              var el = document.querySelector(sel);
              if (!el) return false;
              var p = prop || 'color';
              var inline = el.style ? el.style[p] : '';
              var comp = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue(p) : '';
              var actual = (inline || comp || '').toLowerCase();
              return actual.indexOf((exp || '').toLowerCase()) !== -1;
            }
            case 'scriptDefines': {
              var target = (exp || prop || '').trim();
              return Boolean(window[target]);
            }
            case 'eventResult': {
              var act = check.action;
              var triggerSel = (act && act.selector) || sel;
              var triggerEl = triggerSel ? document.querySelector(triggerSel) : null;
              if (triggerEl) {
                var actType = (act && act.type) || (typeof act === 'string' ? act : 'click');
                if (actType === 'click') {
                  triggerEl.click();
                } else if (actType === 'input') {
                  if ('value' in triggerEl && act && act.value !== undefined) {
                    triggerEl.value = act.value;
                  }
                  triggerEl.dispatchEvent(new Event('input', { bubbles: true }));
                  triggerEl.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (actType === 'submit') {
                  triggerEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
                await new Promise(function(r) { setTimeout(r, 60); });
              }

              if (sel && exp) {
                var targetEl = document.querySelector(sel);
                if (!targetEl) return false;
                var content = (targetEl.textContent || '') + ' ' + (targetEl.value || '');
                return content.toLowerCase().indexOf(exp.toLowerCase()) !== -1;
              }
              return true;
            }
            default:
              return false;
          }
        })();

        var passed = await Promise.race([execPromise, timeoutPromise]);
        checkResult.passed = Boolean(passed);
        if (!checkResult.passed && !checkResult.message) {
          checkResult.message = check.description || 'Check assertion failed';
        }
      } catch (err) {
        checkResult.passed = false;
        checkResult.message = err.message || 'Execution error during check';
      }

      results.push(checkResult);
    }

    window.parent.postMessage({ type: 'CHECKS_RESULT', results: results }, '*');
  });

  // Ready signal
  window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
})();
`
}
