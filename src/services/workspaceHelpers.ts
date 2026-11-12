import { Check, FileEntry } from '../schemas/course'

/**
 * Merges a module's template starterFiles with the learner's accumulated files from
 * completed previous modules so every subsequent module builds directly on the learner's work.
 */
export function mergeModuleStarterFiles(
  rawStarterFiles: FileEntry[],
  completedFiles: Record<string, string> | undefined,
  isFirstModule: boolean
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const file of rawStarterFiles) {
    result[file.path] = file.content
  }

  if (!isFirstModule && completedFiles && Object.keys(completedFiles).length > 0) {
    for (const [path, content] of Object.entries(completedFiles)) {
      result[path] = content
    }
  }

  return result
}

/**
 * Generates deterministic architectural notes comparing starter files against
 * passing learner files for ProjectMemory.decisionsMade (no LLM call).
 */
export function computeDeterministicMemoryDiff(
  starterFiles: Record<string, string>,
  completedFiles: Record<string, string>,
  moduleOrder: number,
  moduleTitle: string
): string[] {
  const notes: string[] = []
  const allPaths = Array.from(new Set([...Object.keys(starterFiles), ...Object.keys(completedFiles)])).sort()

  for (const filePath of allPaths) {
    const before = starterFiles[filePath] || ''
    const after = completedFiles[filePath] || ''
    if (before === after) continue

    if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      const idsBefore = new Set(Array.from(before.matchAll(/id=["']([^"']+)["']/g)).map(m => m[1]))
      const newIds = Array.from(after.matchAll(/id=["']([^"']+)["']/g))
        .map(m => m[1])
        .filter((id, idx, arr) => !idsBefore.has(id) && arr.indexOf(id) === idx)
      if (newIds.length > 0) {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Added HTML elements #${newIds.slice(0, 6).join(', #')} in ${filePath}.`)
      } else {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Updated markup structure in ${filePath}.`)
      }
    } else if (filePath.endsWith('.css')) {
      const varsBefore = new Set(Array.from(before.matchAll(/--[a-zA-Z0-9_-]+/g)).map(m => m[0]))
      const newVars = Array.from(after.matchAll(/--[a-zA-Z0-9_-]+/g))
        .map(m => m[0])
        .filter((v, idx, arr) => !varsBefore.has(v) && arr.indexOf(v) === idx)
      if (newVars.length > 0) {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Defined CSS tokens ${newVars.slice(0, 5).join(', ')} in ${filePath}.`)
      } else {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Added/updated styling rules in ${filePath}.`)
      }
    } else if (filePath.endsWith('.js')) {
      const fnsBefore = new Set(Array.from(before.matchAll(/(?:function\s+|(?:const|let)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g)).map(m => m[1]))
      const newFns = Array.from(after.matchAll(/(?:function\s+|(?:const|let)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g))
        .map(m => m[1])
        .filter((fn, idx, arr) => !fnsBefore.has(fn) && arr.indexOf(fn) === idx)
      if (newFns.length > 0) {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Implemented JS bindings (${newFns.slice(0, 5).join(', ')}) in ${filePath}.`)
      } else {
        notes.push(`Module ${moduleOrder} (${moduleTitle}): Updated interactive script logic in ${filePath}.`)
      }
    } else {
      notes.push(`Module ${moduleOrder} (${moduleTitle}): Modified ${filePath}.`)
    }
  }

  return notes.slice(0, 3)
}

/**
 * Deterministic "what to look at" clue for a failed DOM check (never reveals solution code).
 */
export function getDeterministicCheckGuidance(check: Check): string {
  const sel = check.selector ? `"${check.selector}"` : 'the target element'
  switch (check.type) {
    case 'elementExists':
      return `Look at your HTML structure in index.html: check that an element matching ${sel} exists with exact tag, id, or class spelling.`
    case 'elementCount':
      return `Count the matching elements in index.html (or dynamically rendered DOM) for ${sel} — expected ${check.expected || 1}.`
    case 'textContains':
      return `Inspect the text content inside ${sel} and make sure it includes "${check.expected || ''}".`
    case 'attributeEquals':
      return `Inspect the attributes on ${sel} (check "${check.property || 'href / src / type'}") and confirm its value is "${check.expected || ''}".`
    case 'classContains':
      return `Inspect the class attribute on ${sel} and verify the class "${check.expected || check.property || ''}" is attached.`
    case 'styleEquals':
      return `Check your CSS rule for ${sel} in styles.css (look closely at "${check.property || 'the target style'}" expected to match "${check.expected || ''}").`
    case 'scriptDefines':
      return `Check your JavaScript file (app.js) and console output to ensure "${check.expected || check.property || 'the required symbol'}" is defined without runtime errors.`
    case 'eventResult': {
      const actionLabel = typeof check.action === 'string'
        ? check.action
        : check.action?.selector
          ? `${check.action.type} on "${check.action.selector}"`
          : 'the user interaction'
      return `Trace your event handler for ${actionLabel} in app.js and verify it updates ${sel}${check.expected ? ` with "${check.expected}"` : ''}.`
    }
    default:
      return 'Inspect the corresponding HTML element, CSS rule, or JS handler mentioned in the task.'
  }
}

