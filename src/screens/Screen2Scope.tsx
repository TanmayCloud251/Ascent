import React from 'react'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Cpu,
  Layers,
  Code2,
  RefreshCw,
  CheckCircle2,
  BookmarkCheck,
  Zap,
  Terminal,
  ShieldAlert,
  Database,
  GitBranch,
  Clock,
  Gauge,
  AlertTriangle,
  Ban
} from 'lucide-react'

export const Screen2Scope: React.FC = () => {
  const {
    activeSpec,
    activePrompt,
    specStage,
    specError,
    isGeneratingSpec,
    lastGenerationFromCache,
    retryGenerateSpec,
    generateProjectSpec,
    confirmProjectSpec,
    setScreen,
    activeProject,
    loadCuratedProject
  } = useApp()

  // =========================================================================
  // STATE 1: ACTIVE GENERATION TELEMETRY & LOADING CONSOLE
  // =========================================================================
  if (isGeneratingSpec) {
    const stageDetails: Record<string, string> = {
      idle: 'Initializing request...',
      analyzing: 'Parsing domain requirements & constraints...',
      synthesizing: 'Calling LLM with structured spec schema...',
      validating: 'Verifying Zod runtime contracts & schema integrity...',
      done: 'Specification compiled successfully.',
      error: 'An error occurred during generation.'
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#0A0A0F]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#00F0FF]/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="w-full max-w-2xl space-y-6 relative z-10 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/10">
            <span className="flex items-center gap-2 text-[#00F0FF]">
              <Cpu className="w-4 h-4 animate-spin text-[#00F0FF]" />
              <span>ORCHESTRATOR // SPECIFICATION SYNTHESIS</span>
            </span>
            <span className="text-slate-500 text-[11px]">MODEL: LLM</span>
          </div>

          <div className="cyber-card p-6 bg-[#0B0B14] border-[#00F0FF]/40 space-y-5 shadow-2xl rounded-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Synthesizing Spec for</span>
                  <span className="text-[#00F0FF]">"{activePrompt ? activePrompt.slice(0, 32) + '...' : 'Project'}"</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[10px] font-mono border border-[#00F0FF]/30">
                  REAL RUNTIME LLM
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Ascent is inferring architecture details, data entities, user flows, and boundary constraints.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {[
                { stage: 'analyzing', title: '1. Domain & Constraint Inference', desc: 'Analyzing prompt, user flows, and vanilla web requirements' },
                { stage: 'synthesizing', title: '2. Gemini Structured Spec Synthesis', desc: 'Generating features, data entities, assumptions, and out-of-scope boundaries' },
                { stage: 'validating', title: '3. Zod Runtime Validation', desc: 'Verifying payload against strict ProjectSpecSchema' }
              ].map((step, idx) => {
                const isCurrent = specStage === step.stage
                const isPast = (specStage === 'synthesizing' && idx === 0) || (specStage === 'validating' && idx <= 1)

                return (
                  <div
                    key={step.title}
                    className={`p-3 rounded-lg border transition-all flex items-start gap-3 ${
                      isCurrent
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF]/50 text-white'
                        : isPast
                        ? 'bg-black/40 border-emerald-500/30 text-slate-300'
                        : 'bg-black/20 border-white/5 text-slate-500'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isPast ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-semibold flex items-center gap-2">
                        <span>{step.title}</span>
                        {isCurrent && <span className="text-[10px] text-[#00F0FF] animate-pulse">In Progress...</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">{step.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-2 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
                {stageDetails[specStage] || 'Synthesizing specification...'}
              </span>
              <span>NO MOCK DATA</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // STATE 2: ERROR SCREEN WITH RETRY AFFORDANCE
  // =========================================================================
  if (specError || (!activeSpec && !isGeneratingSpec)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#0A0A0F]">
        <div className="w-full max-w-xl space-y-6 relative z-10 font-mono">
          <div className="cyber-card p-6 bg-[#160B0F] border-rose-500/50 rounded-xl space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Specification Synthesis Notice
                </h3>
                <p className="text-xs text-rose-300/80">
                  LLM_STRUCTURED_API_ERROR
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-black/60 border border-rose-500/20 text-xs text-rose-200/90 leading-relaxed font-sans">
              {specError || 'No active specification found. Please enter a prompt on Screen 1.'}
            </div>

            <div className="text-xs text-slate-300 font-sans space-y-2 bg-black/40 p-3.5 rounded-lg border border-white/5">
              <p className="font-semibold text-white">How to connect your Gemini API key:</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-400 font-mono text-[11px]">
                <li>Click <span className="text-cyan-300 font-semibold">Settings &gt; Secrets</span> in the AI Studio header.</li>
                <li>Verify your key is set under <code className="text-[#00F0FF] font-bold">ASCENT_API_KEY</code> or <code className="text-[#00F0FF] font-bold">GEMINI_API_KEY</code>.</li>
                <li>Click the <strong className="text-white">Retry Generation</strong> button below to resume.</li>
              </ol>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setScreen(1)}
                className="cyber-btn-secondary flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Prompt</span>
              </button>

              <button
                onClick={() => retryGenerateSpec()}
                className="cyber-btn-primary flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-900/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Generation</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // STATE 3: FULL ONE-PAGE READ-ONLY SPECIFICATION REVIEW (DOCS STYLE)
  // =========================================================================
  const {
    appName,
    tagline,
    summary,
    targetAudience,
    primaryFeatures = [],
    userFlows = [],
    dataEntities = [],
    techStack,
    useTailwind,
    architectureHighlights = [],
    assumptions = [],
    outOfScope = [],
    estimatedScreenCount = 1,
    difficulty = 'beginner',
    estimatedHours = 4
  } = activeSpec!

  const isCurated = activeProject?.source === 'curated'

  const handleConfirm = () => {
    confirmProjectSpec()
  }

  const handleRegenerate = () => {
    if (isCurated && activeProject?.curatedSlug) {
      loadCuratedProject(activeProject.curatedSlug)
    } else {
      generateProjectSpec(activePrompt, undefined, true)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0A0A0F]">
      {/* Top Document Header Bar */}
      <div className="border-b border-white/10 px-6 py-2.5 bg-[#0D0D14]/90 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="text-white font-semibold">2. SPECIFICATION REVIEW</span>
          <span className="text-slate-600">·</span>
          <span className="text-[#00F0FF] truncate max-w-[200px]">{appName}</span>
        </div>

        <div className="flex items-center gap-3">
          {isCurated ? (
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] flex items-center gap-1 font-bold">
              <Sparkles className="w-3 h-3 text-purple-400" /> PRE-BUILT (CURATED)
            </span>
          ) : lastGenerationFromCache ? (
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#00F0FF]" /> CACHED SPEC
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> LIVE LLM
            </span>
          )}
          <span className="text-slate-500 text-[11px] hidden sm:inline">READ-ONLY ONE-PAGE SPEC</span>
        </div>
      </div>

      {/* Scrollable Document Container (Docs View) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
        {/* Document "Paper" Sheet */}
        <div className="w-full max-w-4xl bg-[#0D0D18] border border-white/15 rounded-2xl shadow-2xl p-6 sm:p-10 md:p-12 space-y-8 font-sans text-slate-200">

          {/* Doc Title & Identity */}
          <div className="border-b border-white/10 pb-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[11px] font-mono border border-[#00F0FF]/30 font-semibold tracking-wider uppercase">
                Software Specification Document
              </span>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span className="capitalize">{difficulty}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-300" />
                  <span>~{estimatedHours} hours</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{estimatedScreenCount} page{estimatedScreenCount > 1 ? 's' : ''}</span>
                </span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
              {appName}
            </h1>
            <p className="text-base md:text-lg text-cyan-300 font-medium">
              {tagline}
            </p>

            {/* Target Audience & Stack Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
                Audience: <strong className="text-white font-semibold">{targetAudience}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF]">
                HTML + CSS + JavaScript
              </span>
              <span className={`px-2.5 py-1 rounded-md border ${
                useTailwind
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}>
                {useTailwind ? 'Tailwind CSS Utilities' : 'Plain Semantic CSS'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-400">
                Client LocalStorage
              </span>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-semibold flex items-center gap-1.5">
              <span>1. Executive Summary</span>
            </h2>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed font-sans">
              {summary}
            </p>
          </section>

          {/* Section 2: Primary Features */}
          <section className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>2. Primary Features ({primaryFeatures.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              {primaryFeatures.map((feat, idx) => {
                const isObject = typeof feat === 'object' && feat !== null
                const name = isObject ? feat.name : `Feature ${idx + 1}`
                const desc = isObject ? feat.description : String(feat)

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-start gap-3 hover:border-white/20 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-md bg-[#00F0FF]/10 text-[#00F0FF] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-white font-sans">{name}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Section 3: User Flows */}
          {userFlows && userFlows.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-semibold flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                <span>3. Key User Flows</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userFlows.map((flow, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wide">
                      {flow.flowName}
                    </h4>
                    <ol className="space-y-1.5 text-xs text-slate-300 list-decimal pl-4">
                      {flow.steps.map((st, sIdx) => (
                        <li key={sIdx} className="leading-relaxed pl-1 text-slate-300">
                          {st}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: Data Entities & Client Storage */}
          {dataEntities && dataEntities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>4. Data Entities & Browser Storage</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dataEntities.map((entity, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{entity.name}</span>
                      <code className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#00F0FF] text-[11px] font-mono">
                        {entity.storageKey}
                      </code>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-white/5">
                      {entity.fields.map((f, fIdx) => (
                        <div key={fIdx} className="flex items-baseline justify-between text-xs font-mono">
                          <span className="text-slate-300">{f.name}</span>
                          <span className="text-slate-500 text-[11px]">{f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 5: Architecture Highlights */}
          {architectureHighlights && architectureHighlights.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-semibold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>5. Architecture Highlights</span>
              </h2>
              <div className="space-y-2">
                {architectureHighlights.map((hl, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-black/30 border border-white/5 flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shrink-0 mt-1.5" />
                    <span className="leading-relaxed">{hl}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 6 & 7: Assumptions and Out of Scope (VISIBLY HIGHLIGHTED CALLOUTS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Architectural Assumptions (Decisions model made on user's behalf) */}
            <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>ARCHITECTURAL ASSUMPTIONS</span>
              </div>
              <p className="text-[11px] text-amber-200/80 font-sans">
                Decisions inferred on your behalf to maintain a clean, zero-friction front-end project:
              </p>
              <ul className="space-y-1.5 text-xs text-amber-100/90 font-sans list-disc pl-4">
                {assumptions.map((assump, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {assump}
                  </li>
                ))}
              </ul>
            </div>

            {/* Deliberately Out of Scope (Front-End Boundary) */}
            <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold">
                <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                <span>OUT OF SCOPE (DELIBERATELY EXCLUDED)</span>
              </div>
              <p className="text-[11px] text-rose-200/80 font-sans">
                Excluded to ensure a self-contained, client-side curriculum with zero server complexity:
              </p>
              <ul className="space-y-1.5 text-xs text-rose-100/90 font-sans list-disc pl-4">
                {outOfScope.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Action Bar with TWO BUTTONS ONLY + Back Link */}
      <footer className="sticky bottom-0 bg-[#0B0B14]/95 backdrop-blur-md border-t border-white/10 px-6 py-3.5 z-20 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <button
          onClick={() => setScreen(1)}
          className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back / Edit prompt</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerate}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCurated ? 'text-purple-400' : 'text-[#00F0FF]'}`} />
            <span>{isCurated ? 'Reload Course' : 'Regenerate'}</span>
          </button>

          <button
            onClick={handleConfirm}
            className="cyber-btn-primary px-6 py-2.5 text-sm shadow-xl shadow-[#00F0FF]/20 flex items-center gap-2 cursor-pointer font-bold"
          >
            <BookmarkCheck className="w-4 h-4 text-black" />
            <span>Confirm Spec & Continue</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </footer>
    </div>
  )
}
