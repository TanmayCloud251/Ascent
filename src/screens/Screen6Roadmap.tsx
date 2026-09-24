import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, Flame, Calendar, ChevronDown, ChevronUp, Layers, Sparkles } from 'lucide-react'

export const Screen6Roadmap: React.FC = () => {
  const { activeProject, setScreen, addScreenToScope } = useApp()
  const [expandedPageId, setExpandedPageId] = useState<string | null>('p3')
  const [newScreenTitle, setNewScreenTitle] = useState('')
  const [newScreenDesc, setNewScreenDesc] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const plannedScreens = activeProject?.plannedScreens || []

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newScreenTitle.trim()) return
    addScreenToScope(newScreenTitle, newScreenDesc || 'Appended roadmap module')
    setNewScreenTitle('')
    setNewScreenDesc('')
    setIsAdding(false)
  }

  // Generate 52 weeks x 7 days contribution grid data
  const contributionGrid = Array.from({ length: 140 }, (_, i) => {
    const level = i % 11 === 0 ? 3 : i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0
    return { id: i, level }
  })

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <span className="text-xs font-mono text-[#00F0FF] uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5" /> PROJECT ROADMAP // SYLLABUS
            </span>
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">
              {activeProject?.title || 'Your roadmap'}
            </h2>
          </div>

          <button
            onClick={() => setScreen(4)}
            className="cyber-btn-secondary text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to course workspace</span>
          </button>
        </div>

        {/* Linear Progress Timeline Graph */}
        <div className="space-y-6 relative">
          
          {/* Vertical Timeline Connecting Line */}
          <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-white/10 -z-0"></div>

          {plannedScreens.map((page, idx) => {
            const isComplete = page.status === 'completed'
            const isActive = page.status === 'active'
            const isExpanded = expandedPageId === page.id

            return (
              <div key={page.id} className="relative z-10 flex items-start gap-4 group">
                
                {/* Timeline Node Badge */}
                <div className="pt-1">
                  <div
                    onClick={() => setExpandedPageId(isExpanded ? null : page.id)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold cursor-pointer transition-all ${
                      isComplete
                        ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400'
                        : isActive
                        ? 'bg-[#00F0FF]/15 border-2 border-[#00F0FF] text-[#00F0FF] shadow-lg shadow-[#00F0FF]/25 animate-pulse'
                        : 'bg-[#12121A] border border-white/10 text-slate-500 hover:border-white/20'
                    }`}
                  >
                    {isComplete ? <CheckCircle2 className="w-5 h-5" /> : String(idx + 1).padStart(2, '0')}
                  </div>
                </div>

                {/* Node Content Card */}
                <div
                  className={`flex-1 cyber-card p-5 rounded-xl border transition-all ${
                    isActive
                      ? 'border-[#00F0FF]/40 bg-[#121220]'
                      : 'border-white/10 bg-[#0E0E16]'
                  }`}
                >
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedPageId(isExpanded ? null : page.id)}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-white group-hover:text-[#00F0FF] transition-colors">
                          {page.name}
                        </h3>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isComplete ? 'badge-pass' : isActive ? 'badge-cyan' : 'bg-white/5 text-slate-500'
                        }`}>
                          {page.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans">{page.description}</p>
                    </div>

                    <button className="text-slate-500 hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Expanded Modules Breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2 font-mono text-xs">
                      <div className="text-slate-500 uppercase tracking-wider text-[10px]">INCLUDED LEARNING MODULES</div>
                      <div className="space-y-1.5">
                        <div className="p-2.5 rounded bg-black/40 border border-white/5 flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span>01. Shell & App LayoutScaffolding</span>
                          </span>
                          <span className="text-emerald-400 text-[10px]">PASSED</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-between text-[#00F0FF]">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse"></span>
                            <span>02. Cart Drawer & Optimistic Zustand State</span>
                          </span>
                          <span className="text-[10px]">IN PROGRESS</span>
                        </div>
                        <div className="p-2.5 rounded bg-black/20 border border-white/5 flex items-center justify-between text-slate-500">
                          <span className="flex items-center gap-2">
                            <span>•</span>
                            <span>03. Stripe Payment Intent & Webhooks</span>
                          </span>
                          <span className="text-[10px]">LOCKED</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          })}

          {/* Append-Only Scope Addition Affordance */}
          <div className="relative z-10 pl-16">
            {isAdding ? (
              <form onSubmit={handleAddSubmit} className="cyber-card p-4 space-y-3 bg-[#10101C] border-[#00F0FF]/40">
                <input
                  type="text"
                  placeholder="New Screen Name (e.g. Analytics & Reports)"
                  value={newScreenTitle}
                  onChange={(e) => setNewScreenTitle(e.target.value)}
                  className="cyber-input w-full text-xs font-mono"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Short description of features & components..."
                  value={newScreenDesc}
                  onChange={(e) => setNewScreenDesc(e.target.value)}
                  className="cyber-input w-full text-xs font-sans text-slate-300"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="cyber-btn-secondary text-xs py-1.5">Cancel</button>
                  <button type="submit" className="cyber-btn-primary text-xs py-1.5">Append Screen</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="p-3 rounded-xl border border-dashed border-white/20 text-xs font-mono text-slate-400 hover:text-white hover:border-[#00F0FF]/50 hover:bg-[#121220] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#00F0FF]" />
                <span>+ Add a screen to roadmap specification</span>
              </button>
            )}
          </div>

        </div>

        {/* Streak & Contribution Activity Heatmap */}
        <div className="pt-8 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between font-mono">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-4 h-4 text-[#00F0FF]" />
              <span>LEARNING ACTIVITY & CONTRIBUTION CALENDAR</span>
            </div>

            <div className="flex items-center gap-2 text-sm font-bold text-[#00F0FF]">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>12 DAY STREAK</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="cyber-card p-4 bg-[#090910] border-white/5 space-y-3">
            <div className="flex gap-1 flex-wrap justify-between">
              {contributionGrid.map((day) => (
                <div
                  key={day.id}
                  className={`w-3.5 h-3.5 rounded-sm transition-all ${
                    day.level === 3
                      ? 'bg-[#00F0FF] shadow-sm shadow-[#00F0FF]'
                      : day.level === 2
                      ? 'bg-[#00F0FF]/60'
                      : day.level === 1
                      ? 'bg-[#00F0FF]/25'
                      : 'bg-white/5'
                  }`}
                  title={`Activity level: ${day.level}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
              <span>Less</span>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-white/5"></div>
                <div className="w-2.5 h-2.5 rounded-sm bg-[#00F0FF]/25"></div>
                <div className="w-2.5 h-2.5 rounded-sm bg-[#00F0FF]/60"></div>
                <div className="w-2.5 h-2.5 rounded-sm bg-[#00F0FF]"></div>
              </div>
              <span>More</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
