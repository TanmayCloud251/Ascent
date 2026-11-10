import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  Terminal,
  ArrowRight,
  Sparkles,
  Sliders,
  Code2,
  Layers,
  Cpu,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { TechStackConfig } from '../types/ascent'

const SUGGESTED_TEMPLATES = [
  {
    title: 'SaaS Analytics Dashboard',
    prompt: 'real-time cloud telemetry and SaaS analytics dashboard with live metric KPI cards, event feed, and query filtering',
    stack: { runtime: 'React 19' as const, styling: 'Tailwind CSS v4', stateManagement: 'React State / Hooks', backendSim: 'Browser In-Memory State' }
  },
  {
    title: 'E-Commerce Storefront & Cart',
    prompt: 'modern e-commerce storefront with product catalog, category filters, and optimistic slide-over cart drawer',
    stack: { runtime: 'React 19' as const, styling: 'Tailwind CSS v4', stateManagement: 'Zustand', backendSim: 'Browser In-Memory State' }
  },
  {
    title: 'Agile Kanban Sprint Board',
    prompt: 'collaborative agile sprint kanban board with drag-and-drop lanes, task filtering, and priority tagging',
    stack: { runtime: 'React 19' as const, styling: 'Tailwind CSS v4', stateManagement: 'React State / Hooks', backendSim: 'Browser In-Memory State' }
  },
  {
    title: 'Developer Terminal Portfolio',
    prompt: 'cyberpunk interactive developer terminal portfolio with command line prompt, project showcase, and system specs readout',
    stack: { runtime: 'Vanilla DOM' as const, styling: 'Tailwind CSS v4', stateManagement: 'Vanilla Event Emitter', backendSim: 'Browser In-Memory State' }
  }
]

export const Screen1Prompt: React.FC = () => {
  const { generateProjectSpec, specError, isGeneratingSpec, clearSpecError, activePrompt, setActivePrompt } = useApp()
  const [promptInput, setPromptInput] = useState(
    activePrompt || 'enterprise cloud telemetry dashboard with real-time query metrics, sparkline graphs, and cluster health status'
  )
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [techStackConfig, setTechStackConfig] = useState<TechStackConfig>({
    runtime: 'React 19',
    styling: 'Tailwind CSS v4',
    stateManagement: 'React State / Hooks',
    backendSim: 'Browser In-Memory State'
  })

  // Keep input in sync if activePrompt changed via Header presets
  useEffect(() => {
    if (activePrompt) {
      setPromptInput(activePrompt)
    }
  }, [activePrompt])

  const handleLaunch = async (overridePrompt?: string, overrideStack?: TechStackConfig) => {
    const finalPrompt = overridePrompt || promptInput
    const finalStack = overrideStack || techStackConfig
    if (!finalPrompt.trim()) return
    clearSpecError()
    setActivePrompt(finalPrompt)
    await generateProjectSpec(finalPrompt, finalStack)
  }

  const handleSelectTemplate = (tmpl: typeof SUGGESTED_TEMPLATES[0]) => {
    setPromptInput(tmpl.prompt)
    setActivePrompt(tmpl.prompt)
    setTechStackConfig(tmpl.stack)
    // Presets ONLY pre-fill the prompt text box; they never auto-launch
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Background Subtle Atmosphere */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#00F0FF]/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-4xl space-y-8 relative z-10">
        {/* Top Header Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#12121A] border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
            <span className="text-slate-300">SOCRATIC CURRICULUM COMPILER</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400 font-semibold">GEMINI 3.8 FLASH SPEC ENGINE</span>
          </div>
        </div>

        {/* Hero Headlines */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight leading-tight">
            Build what you imagine.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-cyan-300 to-indigo-400">
              Screen by screen, line by line.
            </span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
            Describe any web application. Ascent synthesizes your technical architecture, generates an interactive specification with real-time AI, and guides you through teach-then-build implementation.
          </p>
        </div>

        {/* Error Banner (if previous call failed) */}
        {specError && (
          <div className="cyber-card p-4 bg-rose-950/40 border-rose-500/50 rounded-xl flex items-start justify-between gap-4 text-xs font-mono">
            <div className="flex items-start gap-2.5 text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-100 flex items-center gap-2">
                  <span>Gemini API Notice</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">HTTP 503 / Action Required</span>
                </p>
                <p className="text-rose-300/90 mt-1 font-sans leading-relaxed">{specError}</p>
                <div className="mt-2 text-[11px] text-slate-400 font-mono bg-black/40 p-2 rounded border border-rose-500/20">
                  <span className="text-cyan-300">How to activate:</span> Open <span className="text-white font-semibold">Settings &gt; Secrets</span> in AI Studio, add your key to <code className="text-[#00F0FF] font-bold">GEMINI_API_KEY</code>, and click <strong className="text-white">Retry</strong> below.
                </div>
              </div>
            </div>
            <button
              onClick={() => handleLaunch()}
              className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 shrink-0 flex items-center gap-1.5 font-semibold transition-all shadow-md cursor-pointer hover:border-rose-400"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Main Terminal Input Console */}
        <div className="cyber-card-glow bg-[#0C0C14] border border-[#00F0FF]/40 rounded-xl overflow-hidden shadow-2xl">
          {/* Console Header Bar */}
          <div className="px-4 py-2.5 bg-[#08080E] border-b border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-cyan-400 font-semibold flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" /> student@ascent:~$ init project
              </span>
            </div>
            <span className="text-slate-500">STRUCTURED JSON // SLICE 1</span>
          </div>

          {/* Console Form Input */}
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-3">
              <span className="text-[#00F0FF] font-mono text-lg font-bold select-none">&gt;</span>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="What do you want to build? (e.g. an e-commerce dashboard using React, a developer portfolio, a Kanban board...)"
                rows={3}
                disabled={isGeneratingSpec}
                className="w-full bg-transparent border-none outline-none text-white font-mono text-base md:text-lg resize-none placeholder:text-slate-600 focus:ring-0 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleLaunch()
                  }
                }}
              />
            </div>

            {/* Configured Stack Tags */}
            <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> TARGET STACK:
                </span>
                <span className="px-2.5 py-1 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF]">
                  {techStackConfig.runtime}
                </span>
                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">
                  {techStackConfig.styling}
                </span>
                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">
                  {techStackConfig.stateManagement}
                </span>
              </div>

              <button
                onClick={() => setIsWizardOpen(true)}
                className="text-slate-400 hover:text-[#00F0FF] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize Stack</span>
              </button>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Press ↵ Return
                </span>
                <span>to compile project specification</span>
              </div>

              <button
                onClick={() => handleLaunch()}
                disabled={isGeneratingSpec || !promptInput.trim()}
                className="cyber-btn-primary group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingSpec ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#00F0FF]" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Spec & Review</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Preset Cards for Quick Launch */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase text-slate-500 tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> QUICK STARTER ARCHITECTURES
            </span>
            <div className="flex-1 h-px bg-white/10 mx-3" />
            <span className="text-slate-600">CLICK TO LOAD</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUGGESTED_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                onClick={() => handleSelectTemplate(tmpl)}
                disabled={isGeneratingSpec}
                className="cyber-card p-3.5 text-left flex items-start gap-3 hover:border-[#00F0FF]/50 hover:bg-[#141420] group transition-all disabled:opacity-50 cursor-pointer"
              >
                <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#00F0FF]/50 group-hover:text-[#00F0FF] transition-colors">
                  <Code2 className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate">
                      {tmpl.title}
                    </h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {tmpl.stack.runtime}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-mono">
                    {tmpl.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer System Specs */}
        <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              STORAGE LAYER: LOCALSTORAGE ABSTRACTION (ACTIVE)
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
              STRUCTURED OUTPUT: ZOD VALIDATED
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>ZERO MOCK DATA · DETERMINISTIC PERSISTENCE</span>
          </div>
        </div>
      </div>

      {/* Tech Stack Customization Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="cyber-card bg-[#101018] border border-white/20 p-6 max-w-lg w-full rounded-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00F0FF]" /> Tech Stack Specifications
              </h3>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1.5 font-bold">1. Primary Runtime Paradigm</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'React 19 Component Mode', val: 'React 19' as const },
                    { label: 'Vanilla HTML5 + JS DOM Mode', val: 'Vanilla DOM' as const }
                  ].map(opt => {
                    const isSelected = techStackConfig.runtime === opt.val
                    return (
                      <button
                        key={opt.val}
                        onClick={() => setTechStackConfig(prev => ({ ...prev, runtime: opt.val }))}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF] font-bold'
                            : 'border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-bold">2. Styling Framework</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Tailwind CSS v4', 'CSS Grid & Modern CSS'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTechStackConfig(prev => ({ ...prev, styling: opt }))}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        techStackConfig.styling === opt
                          ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF] font-bold'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5 font-bold">3. State Management</label>
                <div className="grid grid-cols-2 gap-2">
                  {['React State / Hooks', 'Zustand Store'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTechStackConfig(prev => ({ ...prev, stateManagement: opt }))}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        techStackConfig.stateManagement === opt
                          ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF] font-bold'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setIsWizardOpen(false)}
                className="cyber-btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="cyber-btn-primary"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
