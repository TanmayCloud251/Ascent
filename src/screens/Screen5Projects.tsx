import React from 'react'
import { useApp } from '../context/AppContext'
import { Plus, ArrowRight, Clock, CheckCircle2, Terminal, Layers, Sparkles } from 'lucide-react'

export const Screen5Projects: React.FC = () => {
  const { projects, selectProject, setScreen } = useApp()

  const hasProjects = projects.length > 0

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
            <span>WORKSPACE REPOSITORY / {projects.length} ACTIVE</span>
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
          {projects.map((proj) => {
            const isCompleted = proj.status === 'completed' || proj.completedScreens === proj.totalScreens
            const progressPercent = Math.round((proj.completedScreens / (proj.totalScreens || 1)) * 100)

            return (
              <div
                key={proj.id}
                onClick={() => selectProject(proj.id)}
                className="cyber-card p-5 flex flex-col justify-between space-y-5 cursor-pointer hover:border-[#00F0FF]/50 hover:bg-[#141424] group transition-all"
              >
                {/* Status & Timestamp Header */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                    isCompleted
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse"></span>}
                    {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                  </span>
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {proj.lastActiveFormatted}
                  </span>
                </div>

                {/* Project Title & Prompt Description */}
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-white group-hover:text-[#00F0FF] transition-colors">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 font-sans">
                    {proj.prompt}
                  </p>
                </div>

                {/* Tech Stack Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {proj.techStack.map((tech) => (
                    <span key={tech} className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400 border border-white/5">
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Progress Bar & Counter */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-[#00F0FF] font-bold">
                      {proj.completedScreens} of {proj.totalScreens} screens
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00F0FF] to-cyan-400 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
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
            <span>Automatic resume: projects with 1 active state load directly into IDE</span>
          </div>

          <div className="flex items-center gap-4">
            <span>SESSION ID: #ASC-9921</span>
            <span>•</span>
            <span>LATENCY: 12ms</span>
          </div>
        </div>

      </div>
    </div>
  )
}
