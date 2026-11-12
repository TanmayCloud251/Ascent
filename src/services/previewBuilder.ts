import { getIframeCheckRunnerScript } from './iframeCheckScript'

export interface PreviewBuildOptions {
  useTailwind: boolean
  title?: string
  targetHtmlFile?: string
  previewId?: string
  assetUrlMap?: Record<string, string>
  allProjectPaths?: string[]
  onMissingAssets?: (warnings: string[]) => void
}

export interface PreviewBuildResult {
  srcDoc: string
  missingAssets: string[]
}

const ASSET_EXTENSION_RE = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif|mp3|wav|ogg|m4a|flac|woff2?|ttf|otf|eot)$/i

/**
 * Normalizes and resolves a relative asset/file reference from a source file path inside the virtual project.
 * Returns null for external URLs, data/blob URIs, hashes, and unsupported schemes.
 */
export function resolveRelativeProjectPath(rawRef: string, fromFilePath = 'index.html'): string | null {
  const cleaned = rawRef.trim().replace(/\\/g, '/')
  if (!cleaned) return null
  if (
    /^(https?:)?\/\//i.test(cleaned) ||
    /^(data|blob|mailto|tel|javascript):/i.test(cleaned) ||
    cleaned.startsWith('#')
  ) {
    return null
  }

  const withoutQuery = cleaned.split(/[?#]/)[0]
  if (!withoutQuery) return null

  const fromDir = fromFilePath.replace(/\\/g, '/').split('/').slice(0, -1)
  const segments = withoutQuery.startsWith('/') ? [] : [...fromDir]

  for (const part of withoutQuery.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (segments.length > 0) segments.pop()
    } else {
      segments.push(part)
    }
  }

  return segments.join('/')
}

function getAttrValue(attrs: string, attrName: string): string | null {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = attrs.match(re)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3] ?? ''
}

function stripAttr(attrs: string, attrName: string): string {
  const re = new RegExp(`\\s+${attrName}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi')
  return attrs.replace(re, '')
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Rewrites CSS `url(...)` references on a COPY of stylesheet text to data:/blob: URLs.
 */
function rewriteCssUrls(
  cssText: string,
  cssFilePath: string,
  assetUrlMap: Record<string, string>,
  knownPaths: Set<string>,
  missingAssets: Set<string>
): string {
  return cssText.replace(/url\(\s*(['"]?)([^'"()\n\r]+)\1\s*\)/gi, (full, _q, rawUrl: string) => {
    const resolved = resolveRelativeProjectPath(rawUrl, cssFilePath)
    if (!resolved) return full
    const dataUrl = assetUrlMap[resolved]
    if (dataUrl) {
      return `url("${dataUrl}")`
    }
    if (!knownPaths.has(resolved)) {
      missingAssets.add(`${rawUrl.trim()} not found`)
    }
    return full
  })
}

/**
 * Rewrites JS string/template literals that match known project asset paths (or css url(...)) on a COPY only.
 * Never mutates learner files on disk/storage.
 */
function rewriteJsAssetPaths(
  jsText: string,
  jsFilePath: string,
  baseHtmlPath: string,
  assetUrlMap: Record<string, string>,
  knownPaths: Set<string>,
  missingAssets: Set<string>
): string {
  const len = jsText.length
  let out = ''
  let i = 0

  const rewriteLiteralValue = (rawVal: string): { changed: boolean; value: string } => {
    // Handle `url(...)` strings in JS (CSS properties resolve against document URL)
    if (/url\(/i.test(rawVal)) {
      const updated = rewriteCssUrls(rawVal, baseHtmlPath, assetUrlMap, knownPaths, missingAssets)
      return { changed: updated !== rawVal, value: updated }
    }
    // Browser JS executes with document URL (baseHtmlPath) as base; also support jsFilePath-relative paths
    const resolvedFromHtml = resolveRelativeProjectPath(rawVal, baseHtmlPath)
    const resolvedFromJs = resolveRelativeProjectPath(rawVal, jsFilePath)
    if (resolvedFromHtml && assetUrlMap[resolvedFromHtml]) {
      return { changed: true, value: assetUrlMap[resolvedFromHtml] }
    }
    if (resolvedFromJs && assetUrlMap[resolvedFromJs]) {
      return { changed: true, value: assetUrlMap[resolvedFromJs] }
    }
    const candidate = resolvedFromHtml || resolvedFromJs
    if (
      candidate &&
      ASSET_EXTENSION_RE.test(candidate) &&
      !knownPaths.has(resolvedFromHtml || '') &&
      !knownPaths.has(resolvedFromJs || '')
    ) {
      missingAssets.add(`${rawVal.trim()} not found`)
    }
    return { changed: false, value: rawVal }
  }

  while (i < len) {
    const ch = jsText[i]

    // Preserve line comments
    if (ch === '/' && jsText[i + 1] === '/') {
      const start = i
      i += 2
      while (i < len && jsText[i] !== '\n') i++
      out += jsText.slice(start, i)
      continue
    }

    // Preserve block comments
    if (ch === '/' && jsText[i + 1] === '*') {
      const start = i
      i += 2
      while (i < len && !(jsText[i] === '*' && jsText[i + 1] === '/')) i++
      i = Math.min(len, i + 2)
      out += jsText.slice(start, i)
      continue
    }

    // Inspect string / simple template literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      const start = i
      i++
      let rawInner = ''
      let hasInterpolationOrEscape = false
      while (i < len) {
        const c = jsText[i]
        if (c === '\\') {
          hasInterpolationOrEscape = true
          rawInner += jsText.slice(i, i + 2)
          i += 2
          continue
        }
        if (quote === '`' && c === '$' && jsText[i + 1] === '{') {
          hasInterpolationOrEscape = true
        }
        if (c === quote) {
          i++
          break
        }
        rawInner += c
        i++
      }
      const token = jsText.slice(start, i)
      if (!hasInterpolationOrEscape && !rawInner.includes('\n')) {
        const res = rewriteLiteralValue(rawInner)
        if (res.changed) {
          out += JSON.stringify(res.value)
          continue
        }
      }
      out += token
      continue
    }

    out += ch
    i++
  }

  return out
}

/**
 * Builds the standalone srcdoc HTML and returns both the HTML and any missing-asset warnings.
 */
export function buildPreviewDocument(input: {
  files: Record<string, string>
  useTailwind: boolean
  title?: string
  targetHtmlFile?: string
  previewId?: string
  assetUrlMap?: Record<string, string>
  allProjectPaths?: string[]
}): PreviewBuildResult {
  const { files, useTailwind } = input
  const missingAssets = new Set<string>()

  // Normalize assetUrlMap & automatically expose inline .svg text files as data URLs too
  const normalizedAssetUrls: Record<string, string> = {}
  if (input.assetUrlMap) {
    for (const [k, v] of Object.entries(input.assetUrlMap)) {
      const norm = resolveRelativeProjectPath(k, 'index.html') || k.replace(/\\/g, '/').replace(/^\/+/, '')
      if (norm && v) normalizedAssetUrls[norm] = v
    }
  }

  const normalizedTextFiles: Record<string, string> = {}
  for (const [k, v] of Object.entries(files)) {
    const norm = resolveRelativeProjectPath(k, 'index.html') || k.replace(/\\/g, '/').replace(/^\/+/, '')
    normalizedTextFiles[norm] = v
    if (norm.toLowerCase().endsWith('.svg') && !normalizedAssetUrls[norm]) {
      normalizedAssetUrls[norm] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(v)}`
    }
  }

  const knownPaths = new Set<string>([
    ...Object.keys(normalizedTextFiles),
    ...Object.keys(normalizedAssetUrls),
    ...(input.allProjectPaths || []).map(
      p => resolveRelativeProjectPath(p, 'index.html') || p.replace(/\\/g, '/').replace(/^\/+/, '')
    )
  ])

  // Locate target or primary HTML file
  const requestedHtmlKey = input.targetHtmlFile
    ? resolveRelativeProjectPath(input.targetHtmlFile, 'index.html') ||
      input.targetHtmlFile.replace(/\\/g, '/').replace(/^\/+/, '')
    : null
  const htmlEntryKey =
    (requestedHtmlKey && normalizedTextFiles[requestedHtmlKey] !== undefined ? requestedHtmlKey : undefined) ||
    Object.keys(normalizedTextFiles).find(p => p === 'index.html') ||
    Object.keys(normalizedTextFiles).find(p => p === 'index.htm') ||
    Object.keys(normalizedTextFiles).find(p => p.endsWith('.html'))

  let html = htmlEntryKey
    ? normalizedTextFiles[htmlEntryKey]
    : '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n</head>\n<body>\n</body>\n</html>'
  const baseHtmlPath = htmlEntryKey || 'index.html'

  // If HTML document structure is incomplete, wrap it cleanly
  if (!/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n</head>\n<body>\n${html}\n</body>\n</html>`
  }

  if (!/<head[\s>]/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, '$&\n<head>\n</head>')
  }
  if (!/<\/head>/i.test(html)) {
    if (/<body[\s>]/i.test(html)) {
      html = html.replace(/<body[^>]*>/i, '</head>\n$&')
    } else {
      html = `${html}\n</head><body></body>`
    }
  }
  if (!/<\/body>/i.test(html)) {
    html = html.includes('</html>') ? html.replace(/<\/html>/i, '</body>\n</html>') : `${html}\n</body>`
  }

  // Track whether HTML explicitly references local CSS stylesheets or JS scripts
  let sawLocalStylesheetLink = false
  let sawLocalScriptTag = false

  // 1. Replace local <link> tags (stylesheets & icons/assets) in exact HTML order
  html = html.replace(/<link\b([^>]*)>/gi, (full, attrs = '') => {
    const rel = (getAttrValue(attrs, 'rel') || '').toLowerCase()
    const rawHref = getAttrValue(attrs, 'href')
    if (!rawHref) return full

    const resolved = resolveRelativeProjectPath(rawHref, baseHtmlPath)
    if (!resolved) return full // external CDN or data: URI

    const otherAttrs = stripAttr(attrs, 'href')
    const origAttr = `data-ascent-orig-href="${escapeHtmlAttr(rawHref)}"`

    if (rel.includes('stylesheet') || resolved.toLowerCase().endsWith('.css')) {
      sawLocalStylesheetLink = true
      const cssContent = normalizedTextFiles[resolved]
      if (cssContent !== undefined) {
        const rewrittenCss = rewriteCssUrls(
          cssContent,
          resolved,
          normalizedAssetUrls,
          knownPaths,
          missingAssets
        ).replace(/<\/style/gi, '<\\/style')
        return `<link${otherAttrs} ${origAttr} href="data:text/css,">\n<style data-ascent-source="${escapeHtmlAttr(resolved)}">\n/* Inlined ${resolved} */\n${rewrittenCss}\n</style>`
      }
      missingAssets.add(`${rawHref.trim()} not found`)
      return `<link${otherAttrs} ${origAttr} href="data:text/css,">`
    }

    // Other <link> tags such as rel="icon"
    const assetUrl = normalizedAssetUrls[resolved]
    if (assetUrl) {
      return `<link${otherAttrs} ${origAttr} href="${escapeHtmlAttr(assetUrl)}">`
    }
    if (!knownPaths.has(resolved)) {
      missingAssets.add(`${rawHref.trim()} not found`)
    }
    return `<link${otherAttrs} ${origAttr} href="about:blank">`
  })

  // 2. Rewrite inline <style> blocks url(...) references
  html = html.replace(/<style(\b[^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs = '', cssBody = '') => {
    if (/data-ascent-source\s*=/i.test(attrs)) return full
    const rewritten = rewriteCssUrls(cssBody, baseHtmlPath, normalizedAssetUrls, knownPaths, missingAssets)
    return `<style${attrs}>${rewritten}</style>`
  })

  // 3. Rewrite inline style="...url(...)..." attributes
  html = html.replace(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (_full, prefix, quote, styleVal) => {
    const rewritten = rewriteCssUrls(styleVal, baseHtmlPath, normalizedAssetUrls, knownPaths, missingAssets)
    return `${prefix}${quote}${rewritten}${quote}`
  })

  // 4. Rewrite media src attributes (<img src>, <audio src>, <video src>, <source src>)
  html = html.replace(/<(img|audio|video|source)\b([^>]*)>/gi, (full, tag, attrs = '') => {
    const rawSrc = getAttrValue(attrs, 'src')
    if (!rawSrc) return full

    const resolved = resolveRelativeProjectPath(rawSrc, baseHtmlPath)
    if (!resolved) return full // external or data/blob URI

    const otherAttrs = stripAttr(attrs, 'src')
    const origAttr = `data-ascent-orig-src="${escapeHtmlAttr(rawSrc)}"`
    const dataUrl = normalizedAssetUrls[resolved]

    if (dataUrl) {
      return `<${tag}${otherAttrs} ${origAttr} src="${escapeHtmlAttr(dataUrl)}">`
    }

    if (!knownPaths.has(resolved)) {
      missingAssets.add(`${rawSrc.trim()} not found`)
    }
    return `<${tag}${otherAttrs} ${origAttr} src="data:image/gif;base64,">`
  })

  // 5. Rewrite/inline <script> blocks (both external src and inline script) in exact HTML order
  const loopHelperPreamble =
    `var __ascentLoopCount = 0;\n` +
    `setInterval(function() { __ascentLoopCount = 0; }, 250);\n` +
    `function __ascentGuard() {\n` +
    `  if (++__ascentLoopCount > 200000) {\n` +
    `    throw new Error('Infinite loop protection triggered: loop exceeded 200,000 iterations.');\n` +
    `  }\n` +
    `  return true;\n` +
    `}`

  html = html.replace(/<script(\b[^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs = '', body = '') => {
    const rawSrc = getAttrValue(attrs, 'src')
    if (rawSrc !== null) {
      const resolved = resolveRelativeProjectPath(rawSrc, baseHtmlPath)
      if (!resolved) return full // external CDN like tailwindcss
      sawLocalScriptTag = true

      const otherAttrs = stripAttr(attrs, 'src')
      const origAttr = `data-ascent-orig-src="${escapeHtmlAttr(rawSrc)}"`
      const jsContent = normalizedTextFiles[resolved]
      if (jsContent !== undefined) {
        const rewrittenJs = rewriteJsAssetPaths(
          jsContent,
          resolved,
          baseHtmlPath,
          normalizedAssetUrls,
          knownPaths,
          missingAssets
        )
        const guardedJs = instrumentLoopsForPreview(rewrittenJs).replace(/<\/script/gi, '<\\/script')
        return (
          `<script${otherAttrs} ${origAttr} src="data:text/javascript,"></script>\n` +
          `<script data-ascent-source="${escapeHtmlAttr(resolved)}">\n// Inlined ${resolved}\n${guardedJs}\n</script>`
        )
      }
      missingAssets.add(`${rawSrc.trim()} not found`)
      return `<script${otherAttrs} ${origAttr} src="data:text/javascript,"></script>`
    }

    if (!body.trim()) return full
    const rewrittenBody = rewriteJsAssetPaths(
      body,
      baseHtmlPath,
      baseHtmlPath,
      normalizedAssetUrls,
      knownPaths,
      missingAssets
    )
    const inlineSourceAttr = /data-ascent-source\s*=/i.test(attrs) ? '' : ` data-ascent-source="${escapeHtmlAttr(baseHtmlPath)}"`
    return `<script${attrs}${inlineSourceAttr}>\n${instrumentLoopsForPreview(rewrittenBody)}\n</script>`
  })

  // 6. Fallback CSS/JS inlining ONLY if HTML did not explicitly include local <link>/<script src> tags
  const fallbackCssContents: string[] = []
  if (!sawLocalStylesheetLink) {
    for (const [path, content] of Object.entries(normalizedTextFiles).sort(([a], [b]) => a.localeCompare(b))) {
      if (path.toLowerCase().endsWith('.css') && content && content.trim()) {
        const rewritten = rewriteCssUrls(content, path, normalizedAssetUrls, knownPaths, missingAssets)
        fallbackCssContents.push(`/* Inlined ${path} */\n${rewritten}`)
      }
    }
  }

  const fallbackJsContents: string[] = []
  if (!sawLocalScriptTag) {
    for (const [path, content] of Object.entries(normalizedTextFiles).sort(([a], [b]) => a.localeCompare(b))) {
      if (path.toLowerCase().endsWith('.js') && content && content.trim()) {
        const rewritten = rewriteJsAssetPaths(content, path, baseHtmlPath, normalizedAssetUrls, knownPaths, missingAssets)
        fallbackJsContents.push(`// Inlined ${path}\n${rewritten}`)
      }
    }
  }

  // Head injections: Tailwind CDN (if enabled) + fallback Stylesheets + Check runner + Asset manifest & warnings
  const headInjections: string[] = []

  if (useTailwind && !html.includes('cdn.tailwindcss.com')) {
    headInjections.push('<script src="https://cdn.tailwindcss.com"></script>')
  }

  if (fallbackCssContents.length > 0) {
    const safeCss = fallbackCssContents.join('\n\n').replace(/<\/style/gi, '<\\/style')
    headInjections.push(`<style id="ascent-styles">\n${safeCss}\n</style>`)
  }

  headInjections.push(
    `<script id="ascent-check-runner">\n` +
    `${loopHelperPreamble}\n` +
    `${getIframeCheckRunnerScript()}\n` +
    `</script>`
  )

  const missingWarningsList = Array.from(missingAssets)
  const manifestScriptLines = [
    `window.__ascentProjectFiles = ${JSON.stringify(Array.from(knownPaths).sort())};`,
    ...missingWarningsList.map(msg => `console.warn(${JSON.stringify(msg)});`)
  ]
  headInjections.push(`<script id="ascent-asset-manifest">\n${manifestScriptLines.join('\n')}\n</script>`)

  html = html.replace(/<\/head>/i, `${headInjections.join('\n  ')}\n</head>`)

  // Body injections: fallback student scripts + ready signal
  const bodyInjections: string[] = []
  if (fallbackJsContents.length > 0) {
    const combinedJs = fallbackJsContents.join('\n\n')
    const guardedJs = instrumentLoopsForPreview(combinedJs).replace(/<\/script/gi, '<\\/script')
    bodyInjections.push(`<script id="ascent-student-script">\n${guardedJs}\n</script>`)
  }
  const navPreviewId = input.previewId || ''
  const htmlFilesList = Object.keys(normalizedTextFiles).filter(p => /\.html?$/i.test(p))
  const navInterceptorScript = `<script id="ascent-multipage-nav">
(function(){
  var basePath = ${JSON.stringify(baseHtmlPath)};
  var previewId = ${JSON.stringify(navPreviewId)};
  var knownHtml = ${JSON.stringify(htmlFilesList)};
  function resolveRel(href, from) {
    var noHash = href.split('#')[0].split('?')[0].trim().replace(/\\\\/g, '/');
    if (!noHash) return null;
    if (/^(https?:)?\\/\\//i.test(noHash) || /^(data|blob|mailto|tel|javascript):/i.test(noHash)) return null;
    var baseParts = from.split('/').slice(0, -1);
    var combined = noHash.charAt(0) === '/' ? noHash.slice(1).split('/') : baseParts.concat(noHash.split('/'));
    var out = [];
    for (var i = 0; i < combined.length; i++) {
      var seg = combined[i];
      if (!seg || seg === '.') continue;
      if (seg === '..') { if (out.length === 0) return null; out.pop(); continue; }
      out.push(seg);
    }
    return out.join('/');
  }
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var rawHref = el.getAttribute('href');
    if (!rawHref || rawHref.charAt(0) === '#') return;
    var resolved = resolveRel(rawHref, basePath);
    if (!resolved) return;
    if (/\\.html?$/i.test(resolved) || knownHtml.indexOf(resolved) !== -1) {
      e.preventDefault();
      try {
        window.parent.postMessage({ type: 'ASCENT_NAVIGATE_PAGE', targetPath: resolved, previewId: previewId }, '*');
      } catch (err) {}
    }
  });
})();
</script>`
  bodyInjections.push(navInterceptorScript)
  bodyInjections.push(`<script>try{window.parent.postMessage({type:'PREVIEW_READY',pagePath:${JSON.stringify(baseHtmlPath)},previewId:${JSON.stringify(navPreviewId)}},'*');}catch(e){}</script>`)

  html = html.replace(/<\/body>/i, `${bodyInjections.join('\n  ')}\n</body>`)

  return {
    srcDoc: html,
    missingAssets: missingWarningsList
  }
}

/**
 * Backwards-compatible wrapper building the standalone srcdoc HTML for the sandboxed preview iframe.
 */
export function buildIframeSrcDoc(
  files: Record<string, string>,
  options: PreviewBuildOptions
): string {
  const result = buildPreviewDocument({
    files,
    useTailwind: options.useTailwind,
    title: options.title,
    targetHtmlFile: options.targetHtmlFile,
    previewId: options.previewId,
    assetUrlMap: options.assetUrlMap,
    allProjectPaths: options.allProjectPaths
  })
  options.onMissingAssets?.(result.missingAssets)
  return result.srcDoc
}

/**
 * Instruments `while` and `for` loop conditions in preview JS with `__ascentGuard()`
 * so accidental infinite loops throw safely instead of freezing the browser tab.
 */
function instrumentLoopsForPreview(code: string): string {
  const len = code.length
  let out = ''
  let i = 0

  const isIdentChar = (c: string) => /[A-Za-z0-9_$]/.test(c)

  while (i < len) {
    const ch = code[i]

    // Skip line comments
    if (ch === '/' && code[i + 1] === '/') {
      const start = i
      i += 2
      while (i < len && code[i] !== '\n') i++
      out += code.slice(start, i)
      continue
    }

    // Skip block comments
    if (ch === '/' && code[i + 1] === '*') {
      const start = i
      i += 2
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++
      i = Math.min(len, i + 2)
      out += code.slice(start, i)
      continue
    }

    // Skip string & template literals (simple escape-aware scan)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      const start = i
      i++
      while (i < len) {
        if (code[i] === '\\') {
          i += 2
          continue
        }
        if (code[i] === quote) {
          i++
          break
        }
        i++
      }
      out += code.slice(start, i)
      continue
    }

    // Detect `while` or `for` keyword at identifier boundary
    if ((code.startsWith('while', i) || code.startsWith('for', i)) && (i === 0 || !isIdentChar(code[i - 1]))) {
      const kw = code.startsWith('while', i) ? 'while' : 'for'
      const afterKw = i + kw.length
      if (afterKw >= len || !isIdentChar(code[afterKw])) {
        let j = afterKw
        while (j < len && /\s/.test(code[j])) j++
        if (code[j] === '(') {
          const parenStart = j
          let depth = 0
          let k = j
          while (k < len) {
            const c = code[k]
            if (c === '"' || c === "'" || c === '`') {
              const q = c
              k++
              while (k < len) {
                if (code[k] === '\\') { k += 2; continue }
                if (code[k] === q) { k++; break }
                k++
              }
              continue
            }
            if (c === '/' && code[k + 1] === '/') {
              while (k < len && code[k] !== '\n') k++
              continue
            }
            if (c === '/' && code[k + 1] === '*') {
              k += 2
              while (k < len && !(code[k] === '*' && code[k + 1] === '/')) k++
              k += 2
              continue
            }
            if (c === '(') depth++
            else if (c === ')') {
              depth--
              if (depth === 0) break
            }
            k++
          }

          if (depth === 0 && code[k] === ')') {
            const inner = code.slice(parenStart + 1, k)
            out += code.slice(i, parenStart + 1)

            if (kw === 'while') {
              out += `(__ascentGuard() && (${inner}))`
            } else {
              // Split `for (...)` on top-level `;`
              const semis: number[] = []
              let d = 0
              for (let p = 0; p < inner.length; p++) {
                const ic = inner[p]
                if (ic === '"' || ic === "'" || ic === '`') {
                  const q = ic
                  p++
                  while (p < inner.length) {
                    if (inner[p] === '\\') { p++; p++; continue }
                    if (inner[p] === q) break
                    p++
                  }
                  continue
                }
                if (ic === '(' || ic === '[' || ic === '{') d++
                else if (ic === ')' || ic === ']' || ic === '}') d--
                else if (ic === ';' && d === 0) semis.push(p)
              }

              if (semis.length === 2) {
                const initPart = inner.slice(0, semis[0])
                const condPart = inner.slice(semis[0] + 1, semis[1])
                const stepPart = inner.slice(semis[1] + 1)
                const guardedCond = condPart.trim()
                  ? ` (__ascentGuard() && (${condPart}))`
                  : ` __ascentGuard()`
                out += `${initPart};${guardedCond};${stepPart}`
              } else {
                out += inner
              }
            }

            out += ')'
            i = k + 1
            continue
          }
        }
      }
    }

    out += ch
    i++
  }

  return out
}
