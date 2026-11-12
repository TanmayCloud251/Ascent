import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, ArrowRight, Clock, CheckCircle2, Layers, Trash2 } from 'lucide-react'
import { computeProjectCompletionSummary } from '../utils/learnerStats'

function formatProjectDate(iso?: string): string {
  if (!iso) return 'Recently'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const Screen5Projects: React.FC = () => {
  const {
    storedProjects,
    allUserProgressByKey,
    activeProjectId,
    selectProject,
    deleteProject,
    setScreen
  } = useApp()

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const hasProjects = storedProjects.length > 0

  if (!hasProjects) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
        <div className="w-full max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#12121A] border border-white/10 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span>WORKSPACE EMPTY // 0 ACTIVE</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
            You haven’t started a project yet
          </h2>

          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Describe any web app, microservice, or tool. Ascent will architect an interactive curriculum from scratch.
          </p>

          <button
            onClick={() => setScreen(1)}
            className="cyber-btn-primary px-8 py-3.5 text-base mx-auto"
          >
            <Plus className="w-5 h-5" />
            <span>START YOUR FIRST PROJECT</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00F0FF]" />
            <span>WORKSPACE REPOSITORY / {storedProjects.length} ACTIVE</span>
          </div>
          <span>RETURNING LEARNER</span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
            Your projects
          </h2>
        </div>

        {/* Projects Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {storedProjects.map((proj) => {
            const summary = computeProjectCompletionSummary(proj, allUserProgressByKey)
            const isCompleted = summary.isCompleted
            const isCurrentActive = proj.id === activeProjectId
            const isConfirmingDelete = confirmingDeleteId === proj.id
            const title = proj.spec?.appName || 'Untitled Project'
            const stylingLabel = proj.useTailwind ? 'Tailwind CSS' : 'Plain CSS'
            const pagesCount = proj.pages?.length || 0

            return (
              <div
                key={proj.id}
                onClick={() => selectProject(proj.id)}
                data-project-card-id={proj.id}
                className={`cyber-card p-5 flex flex-col justify-between space-y-5 cursor-pointer hover:border-[#00F0FF]/50 hover:bg-[#141424] group transition-all ${
                  isCurrentActive ? 'border-[#00F0FF]/40' : ''
                }`}
              >
                {/* Status, Timestamp & Delete Button Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse"></span>
                      )}
                      {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                    </span>
                    {isCurrentActive && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/15">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatProjectDate(proj.updatedAt || proj.createdAt)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${title}`}
                      title={`Delete ${title}`}
                      data-testid={`delete-project-${proj.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmingDeleteId(isConfirmingDelete ? null : proj.id)
                      }}
                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Delete Confirmation Bar */}
                {isConfirmingDelete && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 flex items-center justify-between gap-2 text-xs font-mono"
                  >
                    <span className="text-rose-200">Delete project?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmingDeleteId(null)
                        }}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid={`confirm-delete-project-${proj.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmingDeleteId(null)
                          deleteProject(proj.id)
                        }}
                        className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Project Title & Prompt Description */}
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-white group-hover:text-[#00F0FF] transition-colors">
                    {title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 font-sans">
                    {proj.userPrompt}
                  </p>
                </div>

                {/* Tech Stack Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400 border border-white/5">
                    HTML + CSS + JS
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400 border border-white/5">
                    {stylingLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400 border border-white/5">
                    {proj.source === 'curated' ? 'Curated' : `${pagesCount || 0} ${pagesCount === 1 ? 'page' : 'pages'}`}
                  </span>
                </div>

                {/* Progress Bar & Counter */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-[#00F0FF] font-bold">
                      {summary.completedModules} of {summary.totalModules} modules ({summary.percentComplete}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#00F0FF] to-cyan-400'
                      }`}
                      style={{ width: `${summary.percentComplete}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* "+ Start New Project" Card */}
          <div
            onClick={() => setScreen(1)}
            className="cyber-card p-6 border-dashed border-white/20 hover:border-[#00F0FF]/50 bg-[#0C0C14] hover:bg-[#12121E] cursor-pointer flex flex-col items-center justify-center text-center space-y-3 group transition-all min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center group-hover:border-[#00F0FF] group-hover:scale-110 transition-all">
              <Plus className="w-6 h-6 text-[#00F0FF]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-[#00F0FF] transition-colors">
                Start new project
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs font-sans">
                Describe any project or stack to architect a new custom syllabus.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Session Resume Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF]"></span>
            <span>Click any project to resume, or use the trash icon to delete it cleanly.</span>
          </div>

          <div className="flex items-center gap-4">
            <span>{storedProjects.length} {storedProjects.length === 1 ? 'PROJECT' : 'PROJECTS'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
