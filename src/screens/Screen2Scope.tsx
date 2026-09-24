import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ArrowLeft, ArrowRight, Check, Plus, X, Layers, Clock, Sparkles, HelpCircle } from 'lucide-react'

const CLARIFYING_OPTIONS = [
  {
    id: 'a',
    title: 'Stripe Embedded Checkout',
    badge: 'RECOMMENDED',
    description: 'Full PCI-compliant modal flow with hosted secure elements and Apple Pay/Google Pay integration.'
  },
  {
    id: 'b',
    title: 'Custom Multi-Step Cart & API',
    description: 'Direct server-side payment intent orchestrator paired with custom tailored checkout steps and analytics hooks.'
  },
  {
    id: 'c',
    title: 'External Redirect',
    tag: 'Shopify / LemonSqueezy',
    description: 'Hands off cart inventory and customer billing sessions entirely to a trusted 3rd-party checkout host.'
  },
  {
    id: 'd',
    title: 'Mock / Sandbox Mode',
    badge: 'Zero Setup',
    description: 'Local browser state simulation for rapid UX wireframing without requiring live gateway credentials.'
  }
]

export const Screen2Scope: React.FC = () => {
  const {
    activeProject,
    confirmScope,
    addScreenToScope,
    removeScreenFromScope,
    setScreen,
    clarifyingQuestionAnswered,
    setClarifyingAnswered
  } = useApp()

  const [selectedClarifyingId, setSelectedClarifyingId] = useState('a')
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenDesc, setNewScreenDesc] = useState('')
  const [isAddingScreen, setIsAddingScreen] = useState(false)
  const [techStackTags, setTechStackTags] = useState<string[]>(
    activeProject?.techStack || ['React 19', 'Next.js (App Router)', 'Tailwind CSS', 'Stripe API', 'SQLite / Drizzle']
  )
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const plannedScreens = activeProject?.plannedScreens || []

  const handleAddScreenSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newScreenName.trim()) return
    addScreenToScope(newScreenName, newScreenDesc || 'Custom screen component and logic')
    setNewScreenName('')
    setNewScreenDesc('')
    setIsAddingScreen(false)
  }

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagInput.trim()) return
    setTechStackTags([...techStackTags, newTagInput.trim()])
    setNewTagInput('')
    setIsAddingTag(false)
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTechStackTags(techStackTags.filter(t => t !== tagToRemove))
  }

  // Render Clarifying Question view first if not answered yet
  if (!clarifyingQuestionAnswered) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-3xl space-y-8">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <button
              onClick={() => setScreen(1)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> BACK TO PROMPT
            </button>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]"></span>
                SYS.STATE // AWAITING_INPUT
              </span>
              <span>STEP <strong className="text-[#00F0FF]">02</strong> / 04</span>
            </div>
          </div>

          {/* Question Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-mono">
              <HelpCircle className="w-3.5 h-3.5" /> QUESTION 01 // ARCHITECTURAL SCOPE
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight leading-tight">
              How will customers complete<br />purchases on this store?
            </h2>
          </div>

          {/* Options Cards List */}
          <div className="space-y-3">
            {CLARIFYING_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedClarifyingId(opt.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                  selectedClarifyingId === opt.id
                    ? 'bg-[#141424] border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10'
                    : 'bg-[#101018] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                    selectedClarifyingId === opt.id ? 'bg-[#00F0FF] text-black' : 'bg-white/10 text-slate-400'
                  }`}>
                    {opt.id.toUpperCase()}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-semibold text-white">{opt.title}</h4>
                      {opt.badge && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          opt.badge === 'RECOMMENDED' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                      {opt.tag && (
                        <span className="text-[10px] font-mono text-slate-500">{opt.tag}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">{opt.description}</p>
                  </div>
                </div>

                <div className="shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedClarifyingId === opt.id ? 'border-[#00F0FF] bg-[#00F0FF]' : 'border-slate-600'
                  }`}>
                    {selectedClarifyingId === opt.id && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Action Confirm Button */}
          <div className="text-center space-y-3 pt-2">
            <button
              onClick={() => setClarifyingAnswered(true)}
              className="cyber-btn-primary px-8 py-3.5 text-base w-full max-w-md mx-auto justify-center"
            >
              <span>CONFIRM & GENERATE PLAN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p>
              <button
                onClick={() => setClarifyingAnswered(true)}
                className="text-xs font-mono text-slate-500 hover:text-slate-300 underline underline-offset-4"
              >
                Skip for now (use recommended default)
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render Plan Confirmation Screen after clarifying step
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header Synth Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>SPECIFICATION SYNTHESIS • PRD-8821 // v1.2</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-300">{plannedScreens.length} screens planned</span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Est. build time ~3h 45m
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
              Alt Flow: Clarifying Prompt
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
            Here's what we'll build
          </h2>
        </div>

        {/* Screens Roadmap List */}
        <div className="space-y-2">
          {plannedScreens.map((screen, idx) => (
            <div
              key={screen.id}
              className="cyber-card p-4 flex items-center justify-between gap-4 group hover:bg-[#141422] transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-[#00F0FF] transition-colors">
                    {screen.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    {screen.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeScreenFromScope(screen.id)}
                className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove screen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add Screen Affordance */}
          {isAddingScreen ? (
            <form onSubmit={handleAddScreenSubmit} className="cyber-card p-4 space-y-3 border-[#00F0FF]/40 bg-[#0E0E18]">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Screen Name (e.g., User Profile & Settings)"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  className="cyber-input flex-1 text-sm"
                  autoFocus
                />
                <button type="submit" className="cyber-btn-primary text-xs py-2">
                  Add Screen
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingScreen(false)}
                  className="cyber-btn-secondary text-xs py-2"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                placeholder="Short description of UI components & features..."
                value={newScreenDesc}
                onChange={(e) => setNewScreenDesc(e.target.value)}
                className="cyber-input w-full text-xs font-sans text-slate-300"
              />
            </form>
          ) : (
            <button
              onClick={() => setIsAddingScreen(true)}
              className="w-full p-3 rounded-xl border border-dashed border-white/15 text-xs font-mono text-slate-400 hover:text-white hover:border-[#00F0FF]/50 hover:bg-[#12121E] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#00F0FF]" />
              <span>Add a screen to specification</span>
            </button>
          )}
        </div>

        {/* Inferred Stack Tags Section */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            INFERRED STACK
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {techStackTags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded bg-[#12121C] border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 group"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-slate-500 hover:text-rose-400"
                >
                  ✕
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <form onSubmit={handleAddTagSubmit} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  placeholder="e.g. Prisma"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  className="cyber-input text-xs py-1 px-2 w-28"
                  autoFocus
                />
                <button type="submit" className="text-xs text-[#00F0FF] hover:underline">Add</button>
                <button type="button" onClick={() => setIsAddingTag(false)} className="text-xs text-slate-500">✕</button>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="px-2.5 py-1 rounded border border-dashed border-white/20 text-xs font-mono text-slate-400 hover:text-white hover:border-[#00F0FF]/40 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-[#00F0FF]" /> Add tag
              </button>
            )}
          </div>
        </div>

        {/* Action Footer Bar */}
        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <button
              onClick={() => {
                setClarifyingAnswered(false)
                setScreen(1)
              }}
              className="hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Edit initial prompt
            </button>
            <span>•</span>
            <button
              onClick={() => setScreen(1)}
              className="hover:text-white"
            >
              Start over
            </button>
          </div>

          <button
            onClick={() => confirmScope(plannedScreens)}
            className="cyber-btn-primary px-8 py-3 text-base shadow-xl shadow-[#00F0FF]/20"
          >
            <span>LOOKS GOOD, LET'S BUILD</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  )
}
