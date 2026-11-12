import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  Flame,
  FolderGit2,
  HelpCircle,
  Layers,
  Lock,
  Play,
  Plus,
  Repeat,
  ShieldAlert,
  Trophy,
  User
} from 'lucide-react'
import {
  computeActivityHeatmap,
  computePageModuleStatuses,
  computeProjectCompletionSummary,
  getUserInitials,
  HeatmapDayCell
} from '../utils/learnerStats'

const WEEKDAY_ROW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const Screen6Roadmap: React.FC = () => {
  const {
    currentUser,
    updateCurrentUser,
    activeProjectId,
    storedProjects,
    allUserProgressByKey,
    streakMetrics,
    profileStats,
    openProjectModule,
    setScreen
  } = useApp()

  // Selected project for the vertical roadmap journey (defaults to active project or most recent)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (activeProjectId && storedProjects.some(p => p.id === activeProjectId)) {
      return activeProjectId
    }
    return storedProjects[0]?.id || ''
  })

  useEffect(() => {
    if (storedProjects.length === 0) {
      setSelectedProjectId('')
      return
    }
    if (!selectedProjectId || !storedProjects.some(p => p.id === selectedProjectId)) {
      const preferred =
        activeProjectId && storedProjects.some(p => p.id === activeProjectId)
          ? activeProjectId
          : storedProjects[0].id
      setSelectedProjectId(preferred)
    }
  }, [storedProjects, activeProjectId, selectedProjectId])

  // Profile editor local form state (saves cleanly through StorageService via updateCurrentUser)
  const [displayNameDraft, setDisplayNameDraft] = useState<string>(currentUser.name)
  const [initialsDraft, setInitialsDraft] = useState<string>(currentUser.avatarInitials || '')
  const [profileSavedToast, setProfileSavedToast] = useState<boolean>(false)

  useEffect(() => {
    setDisplayNameDraft(currentUser.name)
    setInitialsDraft(currentUser.avatarInitials || '')
  }, [currentUser.name, currentUser.avatarInitials])

  const [hoveredCell, setHoveredCell] = useState<HeatmapDayCell | null>(null)
  const [openingModuleKey, setOpeningModuleKey] = useState<string | null>(null)

  const selectedProject = useMemo(
    () => storedProjects.find(p => p.id === selectedProjectId) || storedProjects[0] || null,
    [storedProjects, selectedProjectId]
  )

  const selectedProjectSummary = useMemo(
    () =>
      selectedProject
        ? computeProjectCompletionSummary(selectedProject, allUserProgressByKey)
        : null,
    [selectedProject, allUserProgressByKey]
  )

  const allProgressRecords = useMemo(
    () => Object.values(allUserProgressByKey),
    [allUserProgressByKey]
  )

  const heatmap = useMemo(
    () => computeActivityHeatmap(allProgressRecords, new Date(), 26),
    [allProgressRecords]
  )

  const previewInitials = getUserInitials({
    name: displayNameDraft,
    avatarInitials: initialsDraft
  })

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = displayNameDraft.trim() || 'Lead Developer'
    const cleanInitials = initialsDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
    updateCurrentUser({
      name: cleanName,
      avatarInitials: cleanInitials
    })
    setDisplayNameDraft(cleanName)
    setInitialsDraft(cleanInitials)
    setProfileSavedToast(true)
    setTimeout(() => setProfileSavedToast(false), 1800)
  }

  const handleOpenModule = async (projectId: string, pageIdx: number, modIdx: number, modId: string) => {
    const key = `${projectId}:${pageIdx}:${modId}`
    setOpeningModuleKey(key)
    try {
      await openProjectModule(projectId, pageIdx, modIdx)
    } finally {
      setOpeningModuleKey(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#0A0A0F]">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <span className="text-xs font-mono text-[#00F0FF] uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5" /> ROADMAP // PROGRESS &amp; ACTIVITY TELEMETRY
            </span>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">
              Learner Roadmap &amp; Stats
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {selectedProject ? (
              <button
                onClick={() => setScreen(4)}
                className="cyber-btn-secondary text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Workspace</span>
              </button>
            ) : (
              <button
                onClick={() => setScreen(1)}
                className="cyber-btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start a Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Card + Streak Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile Editor Card */}
          <form
            onSubmit={handleSaveProfile}
            className="cyber-card p-5 bg-[#10101C] border-white/10 rounded-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Developer Profile</span>
              </div>
              {profileSavedToast && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5">
              <div
                data-testid="profile-avatar-preview"
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 border border-white/25 flex items-center justify-center text-white font-mono text-sm font-bold shrink-0"
              >
                {previewInitials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {displayNameDraft.trim() || 'Lead Developer'}
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {currentUser.handle} ·{' '}
                  <span className={streakMetrics.currentStreak > 0 ? 'text-amber-300' : 'text-slate-500'}>
                    {streakMetrics.currentStreak}d current streak
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label htmlFor="roadmap-display-name" className="block text-[11px] font-mono text-slate-400 mb-1">
                  Display Name
                </label>
                <input
                  id="roadmap-display-name"
                  type="text"
                  value={displayNameDraft}
                  onChange={e => setDisplayNameDraft(e.target.value)}
                  className="cyber-input w-full text-xs py-1.5 px-2.5"
                  placeholder="Lead Developer"
                />
              </div>

              <div>
                <label htmlFor="roadmap-avatar-initials" className="block text-[11px] font-mono text-slate-400 mb-1">
                  Initials
                </label>
                <input
                  id="roadmap-avatar-initials"
                  type="text"
                  maxLength={3}
                  value={initialsDraft}
                  onChange={e => setInitialsDraft(e.target.value.toUpperCase().slice(0, 3))}
                  className="cyber-input w-full text-xs py-1.5 px-2.5 uppercase text-center"
                  placeholder={getUserInitials({ name: displayNameDraft })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="cyber-btn-primary text-xs py-1.5 px-3.5"
              >
                Save Profile
              </button>
            </div>
          </form>

          {/* Streak Card */}
          <div className="lg:col-span-2 cyber-card p-5 bg-[#0E0E18] border-white/10 rounded-xl flex flex-col justify-between gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Learning Streak (Local Calendar)</span>
              </div>
              <span
                className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                  streakMetrics.isAliveToday
                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {streakMetrics.isAliveToday ? 'STREAK ALIVE' : 'NO ACTIVE STREAK'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-black/35 border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase">Current Streak</div>
                <div className="text-2xl font-display font-bold text-white flex items-baseline gap-1.5">
                  <span>{streakMetrics.currentStreak}</span>
                  <span className="text-xs font-mono text-slate-400">
                    {streakMetrics.currentStreak === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-black/35 border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase">Longest Streak</div>
                <div className="text-2xl font-display font-bold text-[#00F0FF] flex items-baseline gap-1.5">
                  <span>{streakMetrics.longestStreak}</span>
                  <span className="text-xs font-mono text-slate-400">
                    {streakMetrics.longestStreak === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-black/35 border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase">Days Until Streak Lost</div>
                <div
                  className={`text-2xl font-display font-bold flex items-baseline gap-1.5 ${
                    streakMetrics.daysUntilLost === 2
                      ? 'text-emerald-400'
                      : streakMetrics.daysUntilLost === 1
                      ? 'text-amber-300'
                      : 'text-slate-500'
                  }`}
                >
                  <span>{streakMetrics.daysUntilLost}</span>
                  <span className="text-xs font-mono text-slate-400">
                    {streakMetrics.daysUntilLost === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-300 flex items-center gap-2 bg-black/25 px-3 py-2 rounded-lg border border-white/5">
              {streakMetrics.activeDaysCount === 0 ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400">No activity yet</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{streakMetrics.statusLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Modules Done</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-display font-bold text-white" data-testid="stat-modules-completed">
              {profileStats.totalModulesCompleted}
            </div>
          </div>

          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Projects</span>
              <FolderGit2 className="w-3.5 h-3.5 text-[#00F0FF]" />
            </div>
            <div className="text-lg font-display font-bold text-white leading-tight" data-testid="stat-projects-counts">
              {profileStats.projectsStarted} <span className="text-xs font-mono text-slate-400 font-normal">started</span>
              <div className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">
                {profileStats.projectsCompleted} completed
              </div>
            </div>
          </div>

          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Hints Used</span>
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-display font-bold text-white" data-testid="stat-hints-used">
              {profileStats.totalHintsUsed}
            </div>
          </div>

          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Solutions Viewed</span>
              <Eye className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-display font-bold text-white" data-testid="stat-solutions-viewed">
              {profileStats.solutionsViewed}
            </div>
          </div>

          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Avg Attempts</span>
              <Repeat className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-display font-bold text-white" data-testid="stat-avg-attempts">
              {profileStats.attemptedModulesCount > 0 ? profileStats.averageAttemptsPerModule.toFixed(1) : '0'}
            </div>
          </div>

          <div className="cyber-card p-4 bg-[#10101A] border-white/10 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Active Days</span>
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-2xl font-display font-bold text-white" data-testid="stat-active-days">
              {profileStats.totalActiveDays}
            </div>
          </div>
        </div>

        {/* 26-Week GitHub-Style Activity Calendar */}
        <div className="cyber-card p-5 bg-[#090910] border-white/10 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#00F0FF]" />
              <span>Activity Calendar · Last 26 Weeks</span>
            </div>

            <div className="text-xs font-mono text-slate-400">
              {hoveredCell
                ? `${hoveredCell.dateLabel}: ${hoveredCell.count} ${
                    hoveredCell.count === 1 ? 'module' : 'modules'
                  } completed`
                : heatmap.totalCompletionsInWindow === 0
                ? 'No activity yet'
                : `${heatmap.totalCompletionsInWindow} module ${
                    heatmap.totalCompletionsInWindow === 1 ? 'completion' : 'completions'
                  } in the last 26 weeks`}
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-block min-w-full">
              {/* Month Labels Row */}
              <div className="flex items-center mb-1.5 pl-8 relative h-4 text-[10px] font-mono text-slate-400">
                {heatmap.weeks.map(week => {
                  const monthLabel = heatmap.monthLabels.find(m => m.weekIndex === week.weekIndex)
                  return (
                    <div key={week.weekIndex} className="w-3.5 mr-1 shrink-0 relative">
                      {monthLabel && (
                        <span className="absolute left-0 top-0 whitespace-nowrap">
                          {monthLabel.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Weekday Labels + 26 Week Columns */}
              <div className="flex items-start">
                <div className="flex flex-col gap-1 pr-2 text-[10px] font-mono text-slate-500 w-8 shrink-0">
                  {WEEKDAY_ROW_LABELS.map((label, idx) => (
                    <div key={label} className="h-3.5 flex items-center">
                      {idx === 1 || idx === 3 || idx === 5 ? label : ''}
                    </div>
                  ))}
                </div>

                <div className="flex gap-1" data-testid="activity-heatmap-grid">
                  {heatmap.weeks.map(week => (
                    <div key={week.weekIndex} className="flex flex-col gap-1">
                      {week.days.map(cell => {
                        const tooltipText = cell.isFuture
                          ? `${cell.dateLabel}: Upcoming`
                          : `${cell.dateLabel}: ${cell.count} ${
                              cell.count === 1 ? 'module' : 'modules'
                            } completed`

                        const cellColorClass = cell.isFuture
                          ? 'bg-transparent border border-white/[0.03]'
                          : cell.level === 4
                          ? 'bg-[#00F0FF] shadow-sm shadow-[#00F0FF]/50'
                          : cell.level === 3
                          ? 'bg-[#00F0FF]/70'
                          : cell.level === 2
                          ? 'bg-[#00F0FF]/45'
                          : cell.level === 1
                          ? 'bg-[#00F0FF]/20'
                          : 'bg-white/[0.06]'

                        return (
                          <div
                            key={cell.dateKey}
                            title={tooltipText}
                            aria-label={tooltipText}
                            data-date={cell.dateKey}
                            data-count={cell.count}
                            onMouseEnter={() => !cell.isFuture && setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`w-3.5 h-3.5 rounded-[3px] transition-transform ${
                              !cell.isFuture ? 'hover:scale-125 cursor-default' : ''
                            } ${cell.isToday ? 'ring-1 ring-white/40' : ''} ${cellColorClass}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-500">
            <span>
              {heatmap.totalCompletionsInWindow === 0
                ? 'No activity yet — complete modules in the Workspace to light up your calendar.'
                : 'Hover any square to inspect daily completions.'}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.06]" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#00F0FF]/20" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#00F0FF]/45" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#00F0FF]/70" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#00F0FF]" />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Project Switcher & Vertical Roadmap Journey */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#00F0FF]" />
              <span>Project Journey Roadmap</span>
            </h2>
            {storedProjects.length > 0 && (
              <span className="text-xs font-mono text-slate-400">
                {storedProjects.length} {storedProjects.length === 1 ? 'project' : 'projects'}
              </span>
            )}
          </div>

          {storedProjects.length === 0 ? (
            <div className="cyber-card p-10 bg-[#0E0E18] border-white/10 rounded-xl text-center space-y-4">
              <div className="text-sm font-mono text-slate-300">No activity yet</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Start a project from Screen 1 or open a curated course to build your vertical page-and-module roadmap.
              </p>
              <button
                onClick={() => setScreen(1)}
                className="cyber-btn-primary text-xs px-5 py-2 mx-auto inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start a New Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Project Switcher */}
              <div className="lg:col-span-4 space-y-2.5" data-testid="roadmap-project-switcher">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Your Projects
                </div>
                <div className="space-y-2">
                  {storedProjects.map(proj => {
                    const summary = computeProjectCompletionSummary(proj, allUserProgressByKey)
                    const isSelected = selectedProject?.id === proj.id
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setSelectedProjectId(proj.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-[#121224] border-[#00F0FF]/60 shadow-lg shadow-[#00F0FF]/10'
                            : 'bg-[#0E0E18] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {proj.spec?.appName || 'Untitled Project'}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {summary.completedModules} / {summary.totalModules} modules ·{' '}
                              {proj.source === 'curated' ? 'Curated' : 'AI Spec'}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-mono font-bold shrink-0 ${
                              summary.isCompleted ? 'text-emerald-400' : 'text-[#00F0FF]'
                            }`}
                          >
                            {summary.percentComplete}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              summary.isCompleted
                                ? 'bg-emerald-400'
                                : 'bg-gradient-to-r from-[#00F0FF] to-cyan-400'
                            }`}
                            style={{ width: `${summary.percentComplete}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Selected Project Vertical Pages -> Modules Journey */}
              <div className="lg:col-span-8 space-y-5">
                {selectedProject && selectedProjectSummary && (
                  <>
                    {/* Selected Project Progress Header Card */}
                    <div className="cyber-card p-5 bg-[#10101C] border-white/10 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono text-slate-400">
                            SELECTED PROJECT
                          </div>
                          <h3 className="text-xl font-display font-bold text-white">
                            {selectedProject.spec?.appName || 'Untitled Project'}
                          </h3>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-sm font-bold text-[#00F0FF]">
                            {selectedProjectSummary.percentComplete}% complete
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {selectedProjectSummary.completedModules} of {selectedProjectSummary.totalModules} modules done
                          </div>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            selectedProjectSummary.isCompleted
                              ? 'bg-emerald-400'
                              : 'bg-gradient-to-r from-[#00F0FF] to-indigo-400'
                          }`}
                          style={{ width: `${selectedProjectSummary.percentComplete}%` }}
                        />
                      </div>
                    </div>

                    {/* Vertical Timeline: Pages -> Modules */}
                    {(!selectedProject.pages || selectedProject.pages.length === 0) ? (
                      <div className="cyber-card p-6 bg-[#0E0E18] border-white/10 rounded-xl text-center space-y-2">
                        <div className="text-sm font-mono text-slate-300">No activity yet</div>
                        <p className="text-xs text-slate-400">
                          Confirm this project’s specification on Screen 2 to generate its pages and modules.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6 relative" data-testid="roadmap-pages-journey">
                        <div className="hidden sm:block absolute left-[22px] top-6 bottom-6 w-0.5 bg-white/10 z-0" />

                        {selectedProject.pages.map((page, pageIdx) => {
                          const moduleEntries = computePageModuleStatuses(
                            selectedProject.id,
                            page,
                            allUserProgressByKey
                          )
                          const pageDoneCount = moduleEntries.filter(e => e.status === 'done').length
                          const isPageDone =
                            page.status === 'done' ||
                            (moduleEntries.length > 0 && pageDoneCount === moduleEntries.length)

                          return (
                            <div key={page.id} className="relative z-10 flex items-start gap-4">
                              <div
                                className={`hidden sm:flex w-11 h-11 rounded-xl shrink-0 items-center justify-center font-mono text-xs font-bold border ${
                                  isPageDone
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-[#00F0FF]/15 border-[#00F0FF]/60 text-[#00F0FF]'
                                }`}
                              >
                                {isPageDone ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  String(pageIdx + 1).padStart(2, '0')
                                )}
                              </div>

                              <div className="flex-1 cyber-card p-5 bg-[#0E0E18] border-white/10 rounded-xl space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-base font-bold text-white">{page.name}</h4>
                                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                                        {page.fileName}
                                      </span>
                                      <span
                                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                          isPageDone
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                            : 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
                                        }`}
                                      >
                                        {isPageDone ? 'DONE' : 'ACTIVE'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{page.description}</p>
                                  </div>
                                  <div className="text-xs font-mono text-slate-400">
                                    {pageDoneCount} / {moduleEntries.length} done
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  {moduleEntries.map((entry, modIdx) => {
                                    const { module: mod, status, progress } = entry
                                    const isOpenable = status === 'done' || status === 'active'
                                    const attempts = progress?.attempts || 0
                                    const hintsUsed = progress?.hintsUsed || 0
                                    const completedWithSolution = Boolean(progress?.completedWithSolution)
                                    const modKey = `${selectedProject.id}:${pageIdx}:${mod.id}`
                                    const isOpening = openingModuleKey === modKey

                                    return (
                                      <button
                                        key={mod.id}
                                        type="button"
                                        disabled={!isOpenable || isOpening}
                                        onClick={() =>
                                          isOpenable &&
                                          void handleOpenModule(selectedProject.id, pageIdx, modIdx, mod.id)
                                        }
                                        data-module-id={mod.id}
                                        data-module-status={status}
                                        className={`w-full text-left p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                                          status === 'done'
                                            ? 'bg-emerald-500/[0.06] border-emerald-500/25 hover:border-emerald-400/60 cursor-pointer'
                                            : status === 'active'
                                            ? 'bg-[#00F0FF]/[0.08] border-[#00F0FF]/40 hover:border-[#00F0FF] cursor-pointer'
                                            : 'bg-black/30 border-white/5 opacity-60 cursor-not-allowed'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3 min-w-0">
                                          <div className="mt-0.5 shrink-0">
                                            {status === 'done' ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            ) : status === 'active' ? (
                                              <Play className="w-4 h-4 text-[#00F0FF]" />
                                            ) : (
                                              <Lock className="w-4 h-4 text-slate-500" />
                                            )}
                                          </div>
                                          <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-xs font-mono text-slate-400">
                                                #{modIdx + 1}
                                              </span>
                                              <span className="text-xs font-semibold text-white">
                                                {mod.title}
                                              </span>
                                              <span
                                                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                                                  status === 'done'
                                                    ? 'bg-emerald-500/15 text-emerald-300'
                                                    : status === 'active'
                                                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                                                    : 'bg-white/5 text-slate-500'
                                                }`}
                                              >
                                                {status}
                                              </span>
                                              {completedWithSolution && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300">
                                                  <Award className="w-3 h-3" />
                                                  Completed with solution
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 flex-wrap">
                                              <span>Attempts: {attempts}</span>
                                              <span>Hints used: {hintsUsed}</span>
                                              {progress?.usedSolution && !completedWithSolution && (
                                                <span className="text-purple-300">Solution viewed</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {isOpenable && (
                                          <span className="text-[11px] font-mono text-[#00F0FF] flex items-center gap-1 shrink-0 self-end sm:self-center">
                                            <span>{isOpening ? 'Opening...' : status === 'done' ? 'Review' : 'Continue'}</span>
                                            <ArrowRight className="w-3 h-3" />
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
