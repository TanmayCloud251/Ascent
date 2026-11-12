import { getIframeCheckRunnerScript } from './checkRunner'

export interface PreviewBuildOptions {
  useTailwind: boolean
  title?: string
}

/**
 * Builds the standalone srcdoc HTML for the sandboxed preview iframe.
 *
 * Rules:
 * 1. Sandboxed iframe runs with `sandbox="allow-scripts"` (NO `allow-same-origin`).
 * 2. If `useTailwind` is true, injects Tailwind Play CDN script strictly into the iframe HTML
 *    (never touches or saves to the student's actual source files).
 * 3. Inlines all student CSS and JS files so preview updates live without network latency.
 * 4. Injects the client-side check runner script with postMessage communication and console log forwarding.
 */
export function buildIframeSrcDoc(
  files: Record<string, string>,
  options: PreviewBuildOptions
): string {
  // Locate primary HTML file
  let html = files['index.html'] || files['index.htm'] || '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n</head>\n<body>\n</body>\n</html>'

  // If HTML document structure is incomplete, wrap it cleanly
  if (!html.includes('<html')) {
    html = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n</head>\n<body>\n${html}\n</body>\n</html>`
  }

  if (!html.includes('<head>')) {
    html = html.replace(/<html[^>]*>/i, '$&\n<head>\n</head>')
  }

  // Collect CSS files
  const cssContents: string[] = []
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css') && content && content.trim()) {
      cssContents.push(`/* Inlined ${path} */\n${content}`)
    }
  }

  // Collect JS files
  const jsContents: string[] = []
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.js') && content && content.trim()) {
      jsContents.push(`// Inlined ${path}\n${content}`)
    }
  }

  // Head injections: Tailwind CDN (if enabled) + Inlined Stylesheets
  const headInjections: string[] = []

  if (options.useTailwind) {
    headInjections.push('<script src="https://cdn.tailwindcss.com"></script>')
  }

  if (cssContents.length > 0) {
    headInjections.push(`<style id="ascent-styles">\n${cssContents.join('\n\n')}\n</style>`)
  }

  if (headInjections.length > 0) {
    html = html.replace('</head>', `${headInjections.join('\n  ')}\n</head>`)
  }

  // Body injections: Student Scripts + Injected Check Runner Harness
  const bodyInjections: string[] = []

  if (jsContents.length > 0) {
    bodyInjections.push(
      `<script id="ascent-student-script">\n` +
      `window.addEventListener('DOMContentLoaded', function() {\n` +
      `  try {\n` +
      `    ${jsContents.join('\n\n')}\n` +
      `  } catch (err) {\n` +
      `    console.error('Runtime script error:', err);\n` +
      `  }\n` +
      `});\n` +
      `</script>`
    )
  }

  bodyInjections.push(`<script id="ascent-check-runner">\n${getIframeCheckRunnerScript()}\n</script>`)

  if (html.includes('</body>')) {
    html = html.replace('</body>', `${bodyInjections.join('\n  ')}\n</body>`)
  } else {
    html = `${html}\n${bodyInjections.join('\n')}`
  }

  return html
}
