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
  AlertCircle,
  Coins,
  Gamepad2,
  Grid3X3,
  Palette,
  BookOpen
} from 'lucide-react'
import { TechStackConfig } from '../types/ascent'

const QUICK_STARTERS = [
  {
    id: 'currency-converter',
    title: 'Currency Converter',
    description: 'Live exchange rate calculation with country currency dropdowns and localStorage history.',
    badge: 'Vanilla JS · Plain CSS',
    isDirectLaunch: true,
    slug: 'currency-converter',
    iconName: 'coins' as const
  },
  {
    id: 'rock-paper-scissors',
    title: 'Rock Paper Scissors',
    description: 'Classic interactive game against computer AI with animations and persistent score tracking.',
    badge: 'Vanilla JS · Plain CSS',
    isDirectLaunch: true,
    slug: 'rock-paper-scissors',
    iconName: 'gamepad' as const
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    description: '2-player turn-based grid board with win-state algorithms, turn alerts, and match resets.',
    badge: 'Vanilla JS · Plain CSS',
    isDirectLaunch: true,
    slug: 'tic-tac-toe',
    iconName: 'grid' as const
  },
  {
    id: 'background-changer',
    title: 'Background Color Changer',
    description: 'Interactive color explorer with hex code picker, random palette generator, and copy toast.',
    badge: 'Vanilla HTML/CSS/JS',
    isDirectLaunch: false,
    prompt: 'interactive background color changer with hex code picker, random palette generator button, and copy-to-clipboard toast',
    useTailwind: true,
    iconName: 'palette' as const
  },
  {
    id: 'blog-page',
    title: 'Minimalist Blog Reader',
    description: 'Clean personal blog reader with article list, reading time badges, tag filters, and dark mode reading view.',
    badge: 'Vanilla HTML/CSS/JS',
    isDirectLaunch: false,
    prompt: 'clean personal blog reader with article list, reading time badges, tag filters, and dark mode reading view',
    useTailwind: true,
    iconName: 'book' as const
  }
]

export const Screen1Prompt: React.FC = () => {
  const {
    generateProjectSpec,
    specError,
    isGeneratingSpec,
    clearSpecError,
    activePrompt,
    useTailwind,
    setUseTailwind,
    isTailwindLocked,
    curatedCoursesList,
    loadCuratedProject
  } = useApp()

  const [promptInput, setPromptInput] = useState(
    activePrompt || 'interactive background color changer with hex code display, random generator button, and saved favorite colors'
  )
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  // Keep input in sync if activePrompt changed via Header presets
  useEffect(() => {
    if (activePrompt) {
      setPromptInput(activePrompt)
    }
  }, [activePrompt])

  const handleLaunch = async (overridePrompt?: string, overrideTailwind?: boolean) => {
    const finalPrompt = overridePrompt || promptInput
    if (!finalPrompt.trim()) return
    clearSpecError()
    const targetTailwind = overrideTailwind !== undefined ? overrideTailwind : useTailwind
    await generateProjectSpec(finalPrompt, {
      runtime: 'HTML + CSS + JavaScript',
      styling: targetTailwind ? 'Tailwind CSS' : 'Plain CSS',
      stateManagement: 'Browser In-Memory State / DOM',
      backendSim: 'In-Browser LocalStorage / IndexedDB',
      useTailwind: targetTailwind
    })
  }

  const handleSelectTemplate = (promptText: string, tmplUseTailwind: boolean = true) => {
    setPromptInput(promptText)
    if (!isTailwindLocked) {
      setUseTailwind(tmplUseTailwind)
    }
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
            <span className="text-emerald-400 font-semibold">LLM SPEC ENGINE</span>
          </div>
        </div>

        {/* Hero Headlines */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight leading-tight">
            Build what you imagine.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-cyan-300 to-indigo-400">
              From Idea to Implementation
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
                  <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> FIXED STACK:
                </span>
                <span className="px-2.5 py-1 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-semibold">
                  HTML + CSS + JavaScript
                </span>
                <span className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 ${
                  useTailwind
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${useTailwind ? 'bg-[#00F0FF]' : 'bg-slate-500'}`} />
                  {useTailwind ? 'Tailwind CSS Utilities' : 'Plain Semantic CSS'}
                </span>
                <span className="px-2.5 py-1 rounded bg-black/40 border border-white/5 text-slate-400">
                  In-Browser Storage
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Single Tailwind CSS Toggle */}
                <button
                  type="button"
                  disabled={isTailwindLocked}
                  onClick={() => setUseTailwind(!useTailwind)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                    isTailwindLocked
                      ? 'opacity-60 cursor-not-allowed bg-black/40 border-white/10 text-slate-500'
                      : useTailwind
                      ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]'
                      : 'border-white/20 bg-black/40 text-slate-400 hover:text-white hover:border-white/40'
                  }`}
                  title={isTailwindLocked ? 'Tailwind styling choice is locked after spec confirmation' : 'Toggle Tailwind CSS vs Plain CSS'}
                >
                  <Sliders className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Use Tailwind CSS:</span>
                  <span className={`font-bold ${useTailwind ? 'text-[#00F0FF]' : 'text-slate-400'}`}>
                    {useTailwind ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
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

        {/* Quick Starter Architectures */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase text-slate-500 tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> QUICK STARTER ARCHITECTURES
            </span>
            <div className="flex-1 h-px bg-white/10 mx-3" />
            <span className="text-slate-500 text-[10px] font-mono">CLICK TO LAUNCH OR LOAD</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_STARTERS.map((item) => {
              const renderIcon = () => {
                switch (item.iconName) {
                  case 'coins':
                    return <Coins className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                  case 'gamepad':
                    return <Gamepad2 className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                  case 'grid':
                    return <Grid3X3 className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                  case 'palette':
                    return <Palette className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                  case 'book':
                    return <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                  default:
                    return <Code2 className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                }
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.isDirectLaunch && item.slug) {
                      loadCuratedProject(item.slug)
                    } else if (item.prompt) {
                      handleSelectTemplate(item.prompt, item.useTailwind)
                    }
                  }}
                  disabled={isGeneratingSpec}
                  className="cyber-card p-4 text-left flex flex-col justify-between hover:border-[#00F0FF]/50 hover:bg-[#141420] group transition-all duration-200 disabled:opacity-50 cursor-pointer rounded-xl bg-[#0C0C14] border-white/10"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#00F0FF]/40 transition-colors">
                        {renderIcon()}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 font-sans leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-500 group-hover:text-[#00F0FF] transition-colors">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {item.isDirectLaunch ? 'Instant Blueprint' : 'Interactive Idea'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold group-hover:translate-x-0.5 transition-transform">
                      {item.isDirectLaunch ? 'Launch Blueprint' : 'Load Prompt'} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer System Specs */}
        <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              STACK: VANILLA HTML + CSS + JS (RESTRICTED)
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
              STRUCTURED OUTPUT: ZOD VALIDATED
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>ZERO MOCK DATA · IN-BROWSER PERSISTENCE</span>
          </div>
        </div>
      </div>

      {/* Tech Stack Customization Modal (Scope-Restricted) */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="cyber-card bg-[#101018] border border-white/20 p-6 max-w-md w-full rounded-xl space-y-5">
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
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block font-semibold">Fixed Course Stack</span>
                <p className="text-white font-bold text-sm">HTML + CSS + JavaScript</p>
                <p className="text-slate-400 text-[11px] font-sans">
                  Ascent is dedicated to teaching foundational front-end mastery. Zero frameworks, zero bundlers, pure browser web APIs.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#00F0FF]/5 border border-[#00F0FF]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-bold block text-sm">Use Tailwind CSS</label>
                    <span className="text-[11px] text-slate-400 font-sans block mt-0.5">
                      {useTailwind
                        ? 'Project uses HTML + Tailwind utility classes + vanilla JS DOM code.'
                        : 'Project uses HTML + plain CSS (semantic classes, Flexbox/Grid) + vanilla JS.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isTailwindLocked}
                    onClick={() => setUseTailwind(!useTailwind)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                      isTailwindLocked
                        ? 'opacity-60 cursor-not-allowed bg-black/40 border-white/10 text-slate-500'
                        : useTailwind
                        ? 'bg-[#00F0FF] text-black border-[#00F0FF]'
                        : 'bg-black/60 border-white/20 text-slate-300 hover:border-white/40'
                    }`}
                  >
                    {useTailwind ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                {isTailwindLocked && (
                  <p className="text-[10px] text-amber-400 font-sans">
                    * The Tailwind choice is locked for this project because the specification has been confirmed.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsWizardOpen(false)}
                className="cyber-btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
