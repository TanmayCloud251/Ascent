import React from 'react'
import { useApp } from '../context/AppContext'
import {
  Layers,
  Sparkles,
  Lock,
  Play,
  CheckCircle2,
  Cpu,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FolderTree,
  Terminal,
  BookOpen,
  Code2,
  Compass
} from 'lucide-react'

export const Screen3ProjectOverview: React.FC = () => {
  const {
    activeSpec,
    activeScreens,
    activeModules,
    currentScreenIndex,
    selectActiveScreen,
    projectMemory,
    isGeneratingPlan,
    planStage,
    planError,
    confirmProjectSpec,
    setScreen
  } = useApp()

  const currentScreen = activeScreens[currentScreenIndex] || activeScreens[0]

  // Loading state during plan or syllabus generation
  if (isGeneratingPlan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#0A0A0F]">
        <div className="w-full max-w-xl space-y-6 relative z-10 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/10">
            <span className="flex items-center gap-2 text-[#00F0FF]">
              <Cpu className="w-4 h-4 animate-spin text-[#00F0FF]" />
              <span>ORCHESTRATING // SCREEN PLAN & SYLLABUS</span>
            </span>
            <span className="text-slate-500 text-[11px]">MODEL: GEMINI-3.8-FLASH</span>
          </div>

          <div className="cyber-card p-6 bg-[#0B0B14] border-[#00F0FF]/40 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-display">
                Synthesizing Architecture for {activeSpec?.appName || 'Project'}
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Decomposing technical features into dependency-ordered screens and syllabus modules.
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                planStage === 'plan'
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF]/50 text-white'
                  : planStage === 'syllabus'
                  ? 'bg-black/40 border-emerald-500/30 text-slate-300'
                  : 'bg-black/20 border-white/5 text-slate-500'
              }`}>
                {planStage === 'syllabus' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">1. Dependency-Ordered Screen Plan (5-8 screens)</div>
                  <div className="text-[11px] text-slate-400">Strict dependency order for "{activeSpec?.appName}"</div>
                </div>
              </div>

              <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                planStage === 'syllabus'
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF]/50 text-white'
                  : 'bg-black/20 border-white/5 text-slate-500'
              }`}>
                {planStage === 'syllabus' ? (
                  <div className="w-4 h-4 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] shrink-0">
                    2
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">2. Screen 1 Teach-Then-Build Syllabus (4-7 modules)</div>
                  <div className="text-[11px] text-slate-400">Targeted modules with learning objectives</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-2 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
                {planStage === 'plan' ? 'Generating screens with Gemini structured JSON...' : 'Compiling syllabus modules...'}
              </span>
              <span>NO MOCK DATA</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state with Retry button
  if (planError || activeScreens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#0A0A0F]">
        <div className="w-full max-w-xl space-y-6 relative z-10 font-mono">
          <div className="cyber-card p-6 bg-[#160B0F] border-rose-500/50 rounded-xl space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Screen Plan Generation Notice
                </h3>
                <p className="text-xs text-rose-300/80">API_OR_VALIDATION_ERROR</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-black/60 border border-rose-500/20 text-xs text-rose-200/90 leading-relaxed">
              {planError || 'No screen plan has been compiled yet. Confirm your specification on Screen 2 to trigger real Gemini synthesis.'}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setScreen(2)}
                className="cyber-btn-secondary flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Spec</span>
              </button>

              <button
                onClick={() => confirmProjectSpec()}
                className="cyber-btn-primary flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 border-rose-400 text-white"
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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0A0A0F]">
      {/* Top Banner / Project Context */}
      <div className="border-b border-white/10 px-6 py-3 bg-[#0D0D14]/90 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <Compass className="w-4 h-4 text-[#00F0FF]" />
            <span className="font-display text-sm tracking-tight">{activeSpec?.appName || 'Project Overview'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 hidden sm:inline">{activeSpec?.tagline}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-[11px]">
            SCREEN {currentScreenIndex + 1} OF {activeScreens.length}
          </span>
          <button
            onClick={() => setScreen(4)}
            className="cyber-btn-primary px-3 py-1 text-xs flex items-center gap-1.5"
          >
            <span>Enter IDE Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left = Full Screen Plan; Right = Current Screen's Syllabus */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Full Screen Plan (Ordered, 5-8 screens, status: locked/active/done) */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-white/10 bg-[#09090F] flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-white/5 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> ORDERED SCREEN PLAN
              </span>
              <span className="text-slate-600 font-mono text-[10px]">{activeScreens.length} SCREENS</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Dependency order: Each screen builds upon foundational state & components established in earlier screens.
            </p>
          </div>

          <div className="p-3 space-y-2.5 flex-1">
            {activeScreens.map((screen, idx) => {
              const isSelected = idx === currentScreenIndex
              const isLocked = screen.status === 'locked' && idx !== 0
              const isDone = screen.status === 'done'

              return (
                <button
                  key={screen.id || idx}
                  disabled={isLocked}
                  onClick={() => selectActiveScreen(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all relative font-mono text-xs ${
                    isSelected
                      ? 'bg-[#121224] border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10 text-white'
                      : isDone
                      ? 'bg-black/30 border-emerald-500/30 text-slate-300 hover:border-emerald-500/50'
                      : isLocked
                      ? 'bg-black/20 border-white/5 text-slate-600 cursor-not-allowed opacity-60'
                      : 'bg-[#0E0E16] border-white/10 hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isSelected
                          ? 'bg-[#00F0FF] text-black'
                          : isDone
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold truncate max-w-[170px] text-slate-200">
                        {screen.screenName}
                      </span>
                    </span>

                    {isDone ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 px-1.5 py-0.5 rounded border border-[#00F0FF]/30 font-bold">
                        <Play className="w-3 h-3 fill-current" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                    {screen.description}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Project Memory Card */}
          {projectMemory && (
            <div className="p-3 m-3 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono space-y-2.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FolderTree className="w-3 h-3 text-[#00F0FF]" /> PROJECT MEMORY
                </span>
                <span className="text-emerald-400 font-semibold">INITIALIZED</span>
              </div>
              <div className="text-slate-400 space-y-1.5 text-[10px]">
                <div><span className="text-slate-500">Fixed Stack:</span> {projectMemory.techStack}</div>
                <div>
                  <span className="text-slate-500 block mb-1">Target App Files ({projectMemory.fileTree.length}):</span>
                  <div className="space-y-0.5 max-h-28 overflow-y-auto pl-1.5 border-l border-white/10 font-mono text-[10px]">
                    {projectMemory.fileTree.map(file => (
                      <div key={file} className="flex items-center gap-1.5 text-slate-300">
                        <span className="text-[#00F0FF]">{file.endsWith('.html') ? '📄' : file.endsWith('.css') ? '🎨' : '⚡'}</span>
                        <span className={file.endsWith('.html') ? 'text-white' : 'text-slate-400'}>{file}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div><span className="text-slate-500">Decisions:</span> {projectMemory.decisionsMade.length} design choices recorded</div>
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT MAIN AREA: Current Screen's Teach-Then-Build Syllabus */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Active Screen Hero Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-xs font-mono text-[#00F0FF]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>CURRENT SCREEN SYLLABUS // SCREEN {currentScreenIndex + 1}: {currentScreen?.screenName}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
              {currentScreen?.screenName}
            </h2>
            <p className="text-slate-400 text-sm max-w-3xl leading-relaxed">
              {currentScreen?.description}
            </p>
          </div>

          {/* Module Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
              <span className="text-white font-semibold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#00F0FF]" />
                <span>SYLLABUS MODULES ({activeModules.length})</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                {currentScreenIndex === 0 ? 'ONLY MODULE 1 UNLOCKED INITIALLY' : 'SCREEN LOCKED'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {activeModules.map((mod, mIdx) => {
                const isActive = mod.status === 'active' || (mIdx === 0 && currentScreenIndex === 0)
                const isLocked = mod.status === 'locked' && !isActive

                return (
                  <div
                    key={mod.id || mIdx}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#12121E] border-[#00F0FF]/60 shadow-lg shadow-[#00F0FF]/10'
                        : 'bg-[#0B0B12] border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                          isActive ? 'bg-[#00F0FF] text-black' : 'bg-white/10 text-slate-500'
                        }`}>
                          {mIdx + 1}
                        </span>
                        <h4 className="font-semibold text-white text-sm">
                          {mod.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 text-[10px] uppercase">
                          {mod.componentType}
                        </span>
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 text-[10px] font-bold flex items-center gap-1">
                            <Play className="w-3 h-3 fill-current" /> ACTIVE NOW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-black/40 text-slate-600 border border-white/5 text-[10px] flex items-center gap-1">
                            <Lock className="w-3 h-3" /> LOCKED
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pl-8 space-y-1">
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        <strong className="text-slate-400 font-mono text-[11px]">Learning Objective: </strong>
                        {mod.learningObjective}
                      </p>
                    </div>

                    {isActive && (
                      <div className="mt-4 pt-3 border-t border-white/10 pl-8 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-cyan-300">
                          Ready to write and evaluate student code in sandbox
                        </span>
                        <button
                          onClick={() => setScreen(4)}
                          className="cyber-btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Open in Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
