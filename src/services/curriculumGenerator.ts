import { PlannedPage, LearningModule } from '../types'

export interface WireframeComponent {
  id: string
  name: string
  type: string
  role: string
  mockPreview: string
  gridArea?: string
}

export interface WireframeLayout {
  type: 'dashboard' | 'ecommerce' | 'taskmanager' | 'portfolio' | 'tool'
  title: string
  route: string
  layout: string
  colorTheme: string
  accentColor: string
  components: WireframeComponent[]
}

export interface ThinkingPlan {
  concepts: string[]
  steps: { title: string; detail: string; status: 'done' | 'active' | 'pending' }[]
  tokensUsed: number
  wireframe: WireframeLayout
  generatedTimestamp: string
}

export interface ProjectCurriculum {
  title: string
  domain: string
  techStack: string[]
  thinkingPlan: ThinkingPlan
  plannedScreens: PlannedPage[]
  activeModule: LearningModule
  starterFiles: Record<string, string>
}

export interface CodeEvaluationResult {
  passed: boolean
  score: number
  feedback: string
  suggestions: string[]
  lineFindings?: string[]
  completedTasksCount?: number
  totalTasksCount?: number
}

/**
 * Builds an isolated live preview HTML document with React UMD, Tailwind CSS v4,
 * and virtual module resolution for running code inside a sandboxed iframe.
 */
export function buildLivePreviewHtml(files: Record<string, string>, projectTitle: string = 'Ascent Project'): string {
  // Transpile files and construct virtual module registry
  let combinedModulesRegistration = `
    window.__ascent_modules__ = {};
    window.__ascent_css__ = '';
  `

  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css')) {
      combinedModulesRegistration += `
        window.__ascent_css__ += \`${content.replace(/`/g, '\\`')}\`;
      `
    } else if (path.endsWith('.jsx') || path.endsWith('.js') || path.endsWith('.tsx') || path.endsWith('.ts')) {
      const sanitized = content
        .replace(/import\s+.*from\s+['"].*['"];?/g, '')
        .replace(/export\s+default\s+function/g, 'function')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+function/g, 'function')
        .replace(/export\s+const/g, 'const')
        .replace(/export\s+let/g, 'let')
        .replace(/export\s+class/g, 'class')

      combinedModulesRegistration += `
// ---- File Module: ${path} ----
try {
  ${sanitized}
  if (typeof Header !== 'undefined') window.__ascent_modules__['Header'] = Header;
  if (typeof MetricCards !== 'undefined') window.__ascent_modules__['MetricCards'] = MetricCards;
  if (typeof DataTable !== 'undefined') window.__ascent_modules__['DataTable'] = DataTable;
  if (typeof App !== 'undefined') window.__ascent_modules__['App'] = App;
} catch (e) {
  console.warn('Evaluation note in ${path}:', e.message);
}
`
    }
  }

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectTitle} - Live Execution</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            cyan: { 400: '#00F0FF', 500: '#00D0DF' },
            slate: { 900: '#0D0D18', 950: '#07070D' }
          },
          fontFamily: {
            mono: ['JetBrains Mono', 'monospace'],
            sans: ['Inter', 'sans-serif']
          }
        }
      }
    }
  </script>

  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <style>
    body {
      background-color: #0A0A0F;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: #0A0A0F; }
    ::-webkit-scrollbar-thumb { background: #1E1E2D; border-radius: 3px; }
  </style>
</head>
<body class="p-4 md:p-6 bg-[#0A0A0F] text-slate-100 min-h-screen">
  <div id="error-boundary-banner" style="display: none;" class="mb-4 p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 font-mono text-xs">
    <div class="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
      <span>⚠ Runtime Syntax / Evaluation Error</span>
    </div>
    <div id="error-message-text" class="text-rose-200"></div>
  </div>

  <div id="root">
    <div class="flex items-center justify-center p-12 text-slate-500 text-xs font-mono">
      Compiling virtual module tree with Babel...
    </div>
  </div>

  <script>
    window.__ascent_show_error__ = function(msg) {
      var banner = document.getElementById('error-boundary-banner');
      var text = document.getElementById('error-message-text');
      if (banner && text) {
        text.innerText = msg;
        banner.style.display = 'block';
      }
    };
    window.onerror = function(message, source, lineno, colno, error) {
      window.__ascent_show_error__(message + (lineno ? ' (Line ' + lineno + ')' : ''));
      return false;
    };
  </script>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    class AscentErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, errorInfo) {
        console.error('Ascent ErrorBoundary caught:', error, errorInfo);
        window.__ascent_show_error__(error.message || 'React rendering exception');
      }
      render() {
        if (this.state.hasError) {
          return (
            <div className="p-6 rounded-xl border border-rose-500/30 bg-[#0E0E18] text-rose-300 font-mono text-xs space-y-2">
              <div className="font-bold text-rose-400">⚠ Component Rendering Crash Caught</div>
              <div>{this.state.error?.message}</div>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-2 px-3 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs"
              >
                Retry Render
              </button>
            </div>
          );
        }
        return this.props.children;
      }
    }

    try {
      ${combinedModulesRegistration}

      let RootComponent = null;
      if (typeof App !== 'undefined') {
        RootComponent = App;
      } else if (window.__ascent_modules__['App']) {
        RootComponent = window.__ascent_modules__['App'];
      } else {
        const HeaderComp = typeof Header !== 'undefined' ? Header : window.__ascent_modules__['Header'];
        const MetricsComp = typeof MetricCards !== 'undefined' ? MetricCards : window.__ascent_modules__['MetricCards'];
        const TableComp = typeof DataTable !== 'undefined' ? DataTable : window.__ascent_modules__['DataTable'];

        RootComponent = () => (
          <div className="space-y-6 max-w-5xl mx-auto">
            {HeaderComp && <HeaderComp appName="${projectTitle}" />}
            {MetricsComp && <MetricsComp />}
            {TableComp && <TableComp />}
          </div>
        );
      }

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        <AscentErrorBoundary>
          <RootComponent />
        </AscentErrorBoundary>
      );
    } catch (err) {
      console.error('Babel execution error:', err);
      window.__ascent_show_error__(err.message);
    }
  </script>
</body>
</html>`
}
