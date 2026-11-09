import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  HelpCircle,
  Cpu,
  Layers,
  Code2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BookmarkCheck,
  Zap,
  Terminal,
  ShieldAlert
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
    updateClarifyingAnswer,
    confirmProjectSpec,
    setScreen
  } = useApp()

  const [isConfirmed, setIsConfirmed] = useState(false)

  // =========================================================================
  // STATE 1: ACTIVE GENERATION TELEMETRY & LOADING CONSOLE
  // =========================================================================
  if (isGeneratingSpec) {
    const stageDetails = {
      idle: 'Initializing request...',
      analyzing: 'Parsing domain requirements & developer constraints...',
      synthesizing: 'Calling Gemini 3.8 Flash with structured JSON schema...',
      validating: 'Verifying Zod runtime contracts & architecture highlights...',
      done: 'Specification compiled successfully.',
      error: 'An error occurred during generation.'
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-[#00F0FF]/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="w-full max-w-2xl space-y-6 relative z-10">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
            <span className="flex items-center gap-2 text-[#00F0FF]">
              <Cpu className="w-4 h-4 animate-spin text-[#00F0FF]" />
              <span>ORCHESTRATOR // SPECIFICATION SYNTHESIS</span>
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              MODEL: GEMINI-3.8-FLASH
            </span>
          </div>

          <div className="cyber-card p-6 bg-[#0B0B14] border-[#00F0FF]/40 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Decomposing</span>
                  <span className="text-[#00F0FF]">"{activePrompt ? activePrompt.slice(0, 36) + '...' : 'Project'}"</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[10px] font-mono border border-[#00F0FF]/30">
                  REAL RUNTIME LLM
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Ascent is orchestrating technical requirements, designing features, and formulating clarifying architectural questions.
              </p>
            </div>

            {/* Stage Stepper Display */}
            <div className="space-y-3 font-mono text-xs">
              {[
                { stage: 'analyzing', title: '1. Domain & Stack Analysis', desc: 'Determining architecture boundaries and runtime paradigm' },
                { stage: 'synthesizing', title: '2. Gemini Structured Synthesis', desc: 'Generating features, tagline, and architectural questions' },
                { stage: 'validating', title: '3. Zod Schema Verification', desc: 'Validating payload against TypeScript specification contracts' }
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

            <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="w-full max-w-xl space-y-6 relative z-10">
          <div className="cyber-card p-6 bg-[#160B0F] border-rose-500/50 rounded-xl space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Specification Synthesis Failed
                </h3>
                <p className="text-xs font-mono text-rose-300/80">
                  GEMINI_STRUCTURED_API_ERROR
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-black/60 border border-rose-500/20 font-mono text-xs text-rose-200/90 leading-relaxed">
              {specError || 'No active specification found. Please enter a prompt on Screen 1.'}
            </div>

            <div className="text-xs text-slate-300 font-sans space-y-2 bg-black/40 p-3.5 rounded-lg border border-white/5">
              <p className="font-semibold text-white">How to connect your Gemini API key:</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-400 font-mono text-[11px]">
                <li>Click <span className="text-cyan-300 font-semibold">Settings &gt; Secrets</span> in the AI Studio header.</li>
                <li>Add or set secret named <code className="text-[#00F0FF] font-bold">GEMINI_API_KEY</code> with your Gemini API key.</li>
                <li>Click the <strong className="text-white">Retry Generation</strong> button below. Ascent will immediately detect the key and compile your spec with Gemini 3.8 Flash.</li>
              </ol>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setScreen(1)}
                className="cyber-btn-secondary flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Edit Prompt</span>
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
  // STATE 3: FULL PROJECT SPECIFICATION REVIEW
  // =========================================================================
  const { appName, tagline, summary, targetAudience, primaryFeatures, techStack, architectureHighlights, clarifyingQuestions } = activeSpec!

  const handleConfirm = () => {
    confirmProjectSpec()
    setIsConfirmed(true)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 relative overflow-y-auto">
      <div className="w-full max-w-5xl space-y-6">

        {/* Top Status Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="text-white font-semibold">PROJECT SPECIFICATION COMPILED</span>
            <span className="text-slate-600">·</span>
            <span className="text-[#00F0FF]">{appName}</span>
          </div>

          <div className="flex items-center gap-3">
            {lastGenerationFromCache ? (
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#00F0FF]" /> 0 TOKENS (CACHED)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> REALTIME GEMINI
              </span>
            )}
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">SLICE 1: SPEC REVIEW</span>
          </div>
        </div>

        {/* Confirmation Success Banner (if confirmed) */}
        {isConfirmed && (
          <div className="cyber-card p-4 bg-emerald-950/40 border-emerald-500/50 rounded-xl flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3 text-emerald-200">
              <BookmarkCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Specification Confirmed & Saved in LocalStorage Database</p>
                <p className="text-emerald-300/80 font-sans text-[11px] mt-0.5">
                  Slice 1 completed successfully! Ready for Slice 2 (Screen Planning & Syllabus Decomposition).
                </p>
              </div>
            </div>
            <button
              onClick={() => setScreen(5)}
              className="px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 shrink-0 flex items-center gap-1.5 transition-colors"
            >
              <span>View in Projects Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hero Spec Header */}
        <div className="cyber-card p-6 md:p-8 bg-[#0D0D18] border-[#00F0FF]/30 rounded-xl space-y-4 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[11px] font-mono border border-[#00F0FF]/30 mb-2">
                <Terminal className="w-3 h-3" /> APP SPECIFICATION
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
                {appName}
              </h1>
              <p className="text-base text-cyan-300/90 font-medium mt-1">
                {tagline}
              </p>
            </div>

            <div className="text-right font-mono text-xs text-slate-400 shrink-0">
              <span className="text-slate-500 uppercase tracking-wider block text-[10px]">TARGET AUDIENCE</span>
              <span className="text-slate-200 font-semibold">{targetAudience}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              EXECUTIVE ARCHITECTURAL SUMMARY
            </h4>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed font-sans">
              {summary}
            </p>
          </div>

          {/* Tech Stack Readout */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 uppercase tracking-wider text-[11px] mr-2">TECH STACK:</span>
            <span className="px-3 py-1 rounded-md bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] font-semibold">
              {techStack.runtime}
            </span>
            <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              {techStack.styling}
            </span>
            <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              {techStack.stateManagement}
            </span>
            <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              {techStack.backendSim}
            </span>
          </div>
        </div>

        {/* Two-Column Grid: Features & Architecture Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Features */}
          <div className="cyber-card p-6 bg-[#0B0B14] border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Layers className="w-4 h-4 text-[#00F0FF]" />
                <span>Primary Features</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                {primaryFeatures.length} SCREEN MODULES
              </span>
            </div>

            <div className="space-y-2.5 font-sans text-xs">
              {primaryFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#10101C] border border-white/5 flex items-start gap-3 hover:border-white/15 transition-colors"
                >
                  <span className="w-5 h-5 rounded bg-[#00F0FF]/10 text-[#00F0FF] font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-slate-300 leading-relaxed font-medium">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture Highlights */}
          <div className="cyber-card p-6 bg-[#0B0B14] border-white/10 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>Architecture Highlights</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                PATTERNS
              </span>
            </div>

            <div className="space-y-2.5 font-sans text-xs">
              {architectureHighlights.map((hl, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#10101C] border border-white/5 flex items-start gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                  <span className="text-slate-300 leading-relaxed">{hl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clarifying Questions Section (Real Gemini Output) */}
        {clarifyingQuestions && clarifyingQuestions.length > 0 && (
          <div className="cyber-card p-6 bg-[#0C0C16] border-[#00F0FF]/25 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00F0FF]">
                  <HelpCircle className="w-3.5 h-3.5" /> ARCHITECTURAL CLARIFICATIONS
                </div>
                <h3 className="text-lg font-bold text-white font-display">
                  Tailor your implementation blueprint
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  The AI architect identified key decisions for your project. Choose your preferences:
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px] font-mono">
                PERSISTED TO STORAGE
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {clarifyingQuestions.map((q, qIdx) => (
                <div key={q.id || qIdx} className="space-y-2 p-4 rounded-lg bg-black/40 border border-white/5">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="text-[#00F0FF] font-mono text-xs font-bold">Q{qIdx + 1}:</span>
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {q.options.map((opt) => {
                      const isSelected = q.selectedAnswer === opt || (!q.selectedAnswer && opt === q.options[0])

                      return (
                        <button
                          key={opt}
                          onClick={() => updateClarifyingAnswer(q.id, opt)}
                          className={`p-3 rounded-lg border text-left text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-white shadow-md shadow-[#00F0FF]/10 font-medium'
                              : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                          }`}
                        >
                          <span className="leading-snug">{opt}</span>
                          <span className="shrink-0 mt-0.5">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-[#00F0FF] bg-[#00F0FF]' : 'border-slate-600'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                            </div>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Footer Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <button
              onClick={() => setScreen(1)}
              className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Prompt
            </button>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => generateProjectSpec(activePrompt, undefined, true)}
              className="hover:text-[#00F0FF] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate Spec (New Ideas)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              className="cyber-btn-primary px-8 py-3 text-base shadow-xl shadow-[#00F0FF]/20 flex items-center gap-2 cursor-pointer"
            >
              <BookmarkCheck className="w-5 h-5 text-black" />
              <span>CONFIRM SPEC & GENERATE SCREEN PLAN</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
