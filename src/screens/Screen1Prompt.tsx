import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Terminal, ArrowRight, Zap, Sparkles, Sliders, ShieldCheck, Cpu, Code2 } from 'lucide-react'

const SUGGESTED_TEMPLATES = [
  {
    title: 'E-Commerce Engine (Stripe + Webhooks)',
    prompt: 'a real-time e-commerce storefront with optimistic cart and Stripe webhooks',
    stack: ['React 19', 'Next.js 15', 'Stripe', 'Zustand']
  },
  {
    title: 'Distributed Task Queue (Redis + Go)',
    prompt: 'distributed task queue worker system with Redis and Go concurrency',
    stack: ['Go', 'Redis', 'Docker', 'gRPC']
  },
  {
    title: 'Audio Synthesizer & Canvas FFT',
    prompt: 'Web Audio API synthesizer with real-time Canvas 2D FFT visualizer',
    stack: ['TypeScript', 'Web Audio API', 'Canvas 2D', 'Vite']
  },
  {
    title: 'Multiplayer Whiteboard (CRDT + WebRTC)',
    prompt: 'real-time collaborative canvas using Yjs CRDTs and WebRTC data channels',
    stack: ['React 19', 'WebRTC', 'Yjs CRDT', 'Canvas']
  }
]

export const Screen1Prompt: React.FC = () => {
  const { createNewProject } = useApp()
  const [promptInput, setPromptInput] = useState('a real-time trading orderbook with WebSockets and Canvas 2D')
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [selectedTechStack, setSelectedTechStack] = useState<string[]>(['TypeScript', 'Next.js 15', 'WebSockets', 'Canvas 2D'])

  const handleLaunch = (overridePrompt?: string, overrideStack?: string[]) => {
    const finalPrompt = overridePrompt || promptInput
    const finalStack = overrideStack || selectedTechStack
    if (!finalPrompt.trim()) return
    createNewProject(finalPrompt, finalStack)
  }

  const handleSelectTemplate = (tmpl: typeof SUGGESTED_TEMPLATES[0]) => {
    setPromptInput(tmpl.prompt)
    setSelectedTechStack(tmpl.stack)
    handleLaunch(tmpl.prompt, tmpl.stack)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Background Subtle Atmosphere */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#00F0FF]/5 blur-[120px] pointer-events-none rounded-full"></div>
      
      <div className="w-full max-w-4xl space-y-8 relative z-10">
        
        {/* Top Header Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#12121A] border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping"></span>
            <span className="text-slate-300">ENGINE COCKPIT V2.4 // READY</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">LATENCY <span className="text-[#00F0FF]">8ms</span></span>
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
            Describe any product or architecture. Ascent compiles your architectural curriculum and pairs with you as you write the production code.
          </p>
        </div>

        {/* Main Terminal Input Console */}
        <div className="cyber-card-glow bg-[#0C0C14] border border-[#00F0FF]/40 rounded-xl overflow-hidden shadow-2xl">
          {/* Console Header Bar */}
          <div className="px-4 py-2.5 bg-[#08080E] border-b border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="ml-2 text-cyan-400 font-semibold flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" /> user@ascent:~$ init project
              </span>
            </div>
            <span className="text-slate-500">UTF-8</span>
          </div>

          {/* Console Form Input */}
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-3">
              <span className="text-[#00F0FF] font-mono text-lg font-bold select-none">&gt;</span>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. an e-commerce app using React and Tailwind..."
                rows={2}
                className="w-full bg-transparent border-none outline-none text-white font-mono text-base md:text-lg resize-none placeholder:text-slate-600 focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleLaunch()
                  }
                }}
              />
            </div>

            {/* Auto Detected Stack Tags */}
            <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> DETECTED STACK:
                </span>
                {selectedTechStack.map((tech) => (
                  <span key={tech} className="px-2.5 py-1 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF]">
                    {tech}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>4 MODULES GEN</span>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Press ↵ Return</span>
                <span>to launch</span>
              </div>

              <button
                onClick={() => handleLaunch()}
                className="cyber-btn-primary group"
              >
                <span>Start Building</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion Chips Section */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase text-slate-500 tracking-wider flex items-center gap-2">
            <span>PROMPT TEMPLATES</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUGGESTED_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                onClick={() => handleSelectTemplate(tmpl)}
                className="cyber-card p-3.5 text-left flex items-start gap-3 hover:border-[#00F0FF]/50 hover:bg-[#141420] group transition-all"
              >
                <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#00F0FF]/50 group-hover:text-[#00F0FF] transition-colors">
                  <Code2 className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF]" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {tmpl.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-mono">
                    {tmpl.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Configuration Trigger */}
        <div className="text-center pt-2">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="text-xs font-mono text-slate-400 hover:text-[#00F0FF] inline-flex items-center gap-2 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Or configure manually via stack selector</span>
          </button>
        </div>

        {/* Footer Hardware & Security Bar */}
        <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]"></span>
              LSP: RUST-ANALYZER
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]"></span>
              COPILOT: ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>SECURE CONTAINER SANDBOX</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Manual Stack Selector Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="cyber-card bg-[#101018] border border-white/20 p-6 max-w-lg w-full rounded-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00F0FF]" /> Stack Selector Wizard
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
                <label className="text-slate-300 block mb-1.5">Frontend Framework</label>
                <div className="grid grid-cols-3 gap-2">
                  {['React 19', 'Next.js 15', 'Vue 3'].map(fw => (
                    <button
                      key={fw}
                      onClick={() => setSelectedTechStack([...selectedTechStack.filter(s => !['React 19', 'Next.js 15', 'Vue 3'].includes(s)), fw])}
                      className={`p-2 rounded border text-center ${selectedTechStack.includes(fw) ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-[#00F0FF]' : 'border-white/10 text-slate-400'}`}
                    >
                      {fw}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1.5">State & Data Layer</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Zustand', 'WebSockets', 'Stripe', 'Redis', 'Canvas 2D'].map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        if (selectedTechStack.includes(st)) {
                          setSelectedTechStack(selectedTechStack.filter(s => s !== st))
                        } else {
                          setSelectedTechStack([...selectedTechStack, st])
                        }
                      }}
                      className={`p-2 rounded border text-center ${selectedTechStack.includes(st) ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-[#00F0FF]' : 'border-white/10 text-slate-400'}`}
                    >
                      {st}
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
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsWizardOpen(false)
                  handleLaunch()
                }}
                className="cyber-btn-primary"
              >
                Apply & Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
