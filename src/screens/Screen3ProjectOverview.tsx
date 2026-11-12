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
  FileCode,
  Code2,
  FileText,
  Compass
} from 'lucide-react'

export const Screen3ProjectOverview: React.FC = () => {
  const {
    activeSpec,
    currentPage,
    pages,
    activeModules,
    projectMemory,
    isGeneratingPlan,
    planStage,
    planError,
    confirmProjectSpec,
    useTailwind,
    setScreen,
    openModule,
    getEffectiveModuleStatus,
    getModuleProgress,
    finishActivePage,
    selectActiveScreen,
    activeProjectSource
  } = useApp()

  // Loading state during single page + component syllabus generation
  if (isGeneratingPlan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#0A0A0F]">
        <div className="w-full max-w-xl space-y-6 relative z-10 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/10">
            <span className="flex items-center gap-2 text-[#00F0FF]">
              <Cpu className="w-4 h-4 animate-spin text-[#00F0FF]" />
              <span>ORCHESTRATING // PAGE & COMPONENT SYLLABUS</span>
            </span>
            <span className="text-slate-500 text-[11px]">MODEL: LLM</span>
          </div>

          <div className="cyber-card p-6 bg-[#0B0B14] border-[#00F0FF]/40 space-y-5 shadow-2xl rounded-xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-display">
                Decomposing Page Architecture for {activeSpec?.appName || 'Project'}
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Generating the primary page structure and ordering cumulative HTML/CSS component modules.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/40 text-xs text-white flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin shrink-0" />
              <div>
                <div className="font-semibold">Synthesizing Page Blueprint with LLM</div>
                <div className="text-[11px] text-slate-300">
                  Targeting HTML document order: Head → Layout → Header → Main → Form/List → Script
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-2 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
                Compiling progressive syllabus modules...
              </span>
              <span>NO MOCK DATA</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state with Retry button
  if (planError || !currentPage) {
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
                  Page Generation Notice
                </h3>
                <p className="text-xs text-rose-300/80">LLM_PAGE_GENERATION_FAILED</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-black/60 border border-rose-500/20 text-xs text-rose-200/90 leading-relaxed font-sans">
              {planError || 'No page blueprint has been compiled yet. Confirm your specification on Screen 2 to trigger LLM synthesis.'}
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

  const completedModulesCount = activeModules.filter((m, idx) => getEffectiveModuleStatus(m.id, idx) === 'done').length
  const totalModulesCount = activeModules.length
  const activeIdx = activeModules.findIndex((m, idx) => getEffectiveModuleStatus(m.id, idx) === 'active')
  const allModulesCompleted = totalModulesCount > 0 && completedModulesCount === totalModulesCount

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0A0A0F]">
      {/* Top Header: App Name, Tagline, Stack Label, Link to View Spec */}
      <div className="border-b border-white/10 px-6 py-3 bg-[#0D0D14]/90 flex flex-wrap items-center justify-between gap-3 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <Compass className="w-4 h-4 text-[#00F0FF]" />
            <span className="font-display text-sm tracking-tight">{activeSpec?.appName || 'Project Overview'}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 hidden md:inline truncate max-w-sm">{activeSpec?.tagline}</span>
        </div>

        {/* Stack Label + Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px]">
            <span>HTML + CSS + JS</span>
            <span className="text-slate-600">·</span>
            <span className={useTailwind ? 'text-[#00F0FF]' : 'text-slate-400'}>
              {useTailwind ? 'Tailwind: On' : 'Tailwind: Off'}
            </span>
          </div>

          <button
            onClick={() => setScreen(2)}
            className="hover:text-[#00F0FF] text-slate-400 flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Full Spec</span>
          </button>

          <button
            onClick={() => {
              if (allModulesCompleted) {
                finishActivePage()
              } else {
                openModule(activeIdx >= 0 ? activeIdx : 0)
              }
            }}
            className="cyber-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span>
              {allModulesCompleted
                ? activeProjectSource === 'curated'
                  ? 'Project Complete Summary'
                  : 'Page Complete Summary'
                : completedModulesCount > 0
                ? 'Continue Module'
                : 'Start Module 1'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left = Pages Built So Far + Current Page; Right = Component Modules */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Pages Built So Far + Current Active Page (No future pages planned ahead) */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-white/10 bg-[#09090F] flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-white/5 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> PROJECT PAGES
              </span>
              <span className="text-slate-600 font-mono text-[10px]">
                {pages.length} PAGE{pages.length > 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Single-page iterative curriculum: Each page is developed and verified in isolation. Future pages are designed after the current page passes.
            </p>
          </div>

          {/* Page List: Completed pages + Current Active Page */}
          <div className="p-3 space-y-2.5 flex-1">
            {pages.map((pg, idx) => {
              const isCurrent = pg.fileName === currentPage.fileName
              const isDone = pg.status === 'done'

              return (
                <button
                  type="button"
                  key={pg.id || idx}
                  onClick={() => selectActiveScreen(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all font-mono text-xs cursor-pointer ${
                    isCurrent
                      ? 'bg-[#121224] border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10 text-white'
                      : isDone
                      ? 'bg-black/30 border-emerald-500/30 text-slate-300 hover:border-emerald-400/60'
                      : 'bg-[#0E0E16] border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-[#00F0FF]" />
                      <span className="font-semibold text-white">{pg.name}</span>
                    </span>

                    {isDone ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 px-1.5 py-0.5 rounded border border-[#00F0FF]/30 font-bold">
                        <Play className="w-3 h-3 fill-current" /> Active
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-cyan-300/90 font-mono mb-1">
                    File: <code className="text-white font-bold">{pg.fileName}</code>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    {pg.purpose || pg.description}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Project Memory & File Tree Card */}
          {projectMemory && (
            <div className="p-3 m-3 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono space-y-2.5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FolderTree className="w-3 h-3 text-[#00F0FF]" /> PROJECT MEMORY
                </span>
                <span className="text-emerald-400 font-semibold">ACTIVE</span>
              </div>
              <div className="text-slate-400 space-y-1.5 text-[10px]">
                <div><span className="text-slate-500">Target Stack:</span> {projectMemory.techStack}</div>
                <div>
                  <span className="text-slate-500 block mb-1">Built Artifacts:</span>
                  <div className="space-y-0.5 pl-1.5 border-l border-white/10 font-mono text-[10px]">
                    {(projectMemory.fileTree.length > 0 ? projectMemory.fileTree : [currentPage.fileName]).map((filePath) => (
                      <div key={filePath} className="flex items-center gap-1.5 text-white">
                        <span className="text-[#00F0FF]">📄</span>
                        <span>{filePath}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {projectMemory.decisionsMade && projectMemory.decisionsMade.length > 0 && (
                  <div>
                    <span className="text-slate-500">Assumptions:</span> {projectMemory.decisionsMade.length} decisions logged
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT MAIN AREA: Current Page's Component Syllabus in HTML Document Order */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Active Page Header & Progress Summary */}
          <div className="space-y-3 pb-4 border-b border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-xs font-mono text-[#00F0FF]">
                <FileCode className="w-3.5 h-3.5" />
                <span>PAGE BLUEPRINT // {currentPage.fileName}</span>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">Progress:</span>
                <span className="text-[#00F0FF] font-bold">
                  {completedModulesCount} of {totalModulesCount} modules completed
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
                {currentPage.name}
              </h2>
              <p className="text-slate-300 text-sm max-w-3xl leading-relaxed mt-1 font-sans">
                {currentPage.description}
              </p>
            </div>
          </div>

          {/* Component Modules in Document Order */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
              <span className="text-white font-semibold flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#00F0FF]" />
                <span>COMPONENT MODULES ({activeModules.length})</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                HTML DOCUMENT ORDER · CUMULATIVE BUILD
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {activeModules.map((mod, mIdx) => {
                const effectiveStatus = getEffectiveModuleStatus(mod.id, mIdx)
                const isActive = effectiveStatus === 'active'
                const isDone = effectiveStatus === 'done'
                const prog = getModuleProgress(mod.id)
                const completedWithSolution = Boolean(prog?.completedWithSolution || prog?.usedSolution)

                return (
                  <div
                    key={mod.id || mIdx}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#12121E] border-[#00F0FF]/60 shadow-lg shadow-[#00F0FF]/10'
                        : isDone
                        ? 'bg-[#0E1512] border-emerald-500/30'
                        : 'bg-[#0B0B12] border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                          isActive
                            ? 'bg-[#00F0FF] text-black'
                            : isDone
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/10 text-slate-500'
                        }`}>
                          {mIdx + 1}
                        </span>
                        <h4 className="font-semibold text-white text-sm font-sans">
                          {mod.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 text-[10px] font-mono uppercase">
                          {mod.componentType}
                        </span>

                        {isDone ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 font-mono border ${
                            completedWithSolution
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            {completedWithSolution ? 'DONE (SOLUTION)' : 'DONE'}
                          </span>
                        ) : isActive ? (
                          <span className="px-2 py-0.5 rounded bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <Play className="w-3 h-3 fill-current" /> ACTIVE NOW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-black/40 text-slate-600 border border-white/5 text-[10px] flex items-center gap-1 font-mono">
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
                          Build this component in the live browser sandbox
                        </span>
                        <button
                          onClick={() => openModule(mIdx)}
                          className="cyber-btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-bold"
                        >
                          <span>Start This Component</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {isDone && (
                      <div className="mt-4 pt-3 border-t border-emerald-500/15 pl-8 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-300/80">
                          {prog ? `${prog.attempts} check attempt${prog.attempts === 1 ? '' : 's'} · ${prog.hintsUsed} hint${prog.hintsUsed === 1 ? '' : 's'} used` : 'Completed module — opens read-only'}
                        </span>
                        <button
                          onClick={() => openModule(mIdx)}
                          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <span>Review Code</span>
                          <ArrowRight className="w-3 h-3" />
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
