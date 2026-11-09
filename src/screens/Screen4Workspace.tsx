import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  FolderTree,
  FileCode,
  HelpCircle,
  Terminal,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Code2,
  Copy,
  ArrowRight,
  ExternalLink,
  Layers,
  Download,
  GitBranch,
  Check,
  AlertCircle,
  MessageSquare,
  Lightbulb,
  Maximize2
} from 'lucide-react'
import { buildLivePreviewHtml } from '../services/curriculumGenerator'

export const Screen4Workspace: React.FC = () => {
  const {
    activeProject,
    activeModule,
    activeComponentIndex,
    setActiveComponentIndex,
    activeFile,
    setActiveFile,
    codeFiles,
    updateFileCode,
    runTestCases,
    isTestRunning,
    testStatus,
    evaluationResult,
    unlockHint,
    setScreen,
    downloadProjectZip,
    syncToGithub,
    isSyncingGithub,
    advanceToNextComponent,
    restoreStarterCode,
    learnerProfile
  } = useApp()

  const [activeRailTab, setActiveRailTab] = useState<'modules' | 'files' | 'hints' | 'assistant'>('modules')
  const [activeMainTab, setActiveMainTab] = useState<'editor' | 'preview' | 'review'>('editor')
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [githubSyncedSuccess, setGithubSyncedSuccess] = useState(false)
  const [previewMode, setPreviewMode] = useState<'interactive' | 'wireframe'>('interactive')
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md space-y-4">
          <Terminal className="w-8 h-8 text-[#00F0FF] mx-auto" />
          <h2 className="text-2xl font-bold text-white font-display">No Active Project in Workspace</h2>
          <p className="text-xs text-slate-400 font-sans">
            Please start a project on Screen 1 to compile your specification and starter files with Gemini.
          </p>
          <button onClick={() => setScreen(1)} className="cyber-btn-primary mx-auto">
            <span>Go to Prompt Screen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const filesList = Object.keys(codeFiles)
  const currentCode = codeFiles[activeFile] || ''

  const availableComponents = activeProject?.plannedScreens?.[0]?.components || []
  const hasMultipleComponents = availableComponents.length > 1
  const isCurrentModulePassed = activeModule.status === 'passed' || testStatus === 'pass'
  const hasNextComponent = activeComponentIndex + 1 < availableComponents.length

  // Build live preview HTML string
  const previewHtml = buildLivePreviewHtml(codeFiles, activeProject?.title || 'Ascent Preview')

  // Update iframe on code or tab change
  useEffect(() => {
    if (activeMainTab === 'preview' && iframeRef.current) {
      iframeRef.current.srcdoc = previewHtml
    }
  }, [codeFiles, activeMainTab, previewHtml])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  const handleGithubSync = async () => {
    const success = await syncToGithub()
    if (success) {
      setGithubSyncedSuccess(true)
      setTimeout(() => setGithubSyncedSuccess(false), 3000)
    }
  }

  const [isAskingTutor, setIsAskingTutor] = useState(false)

  const askSocraticAssistant = async (question: string) => {
    setIsAskingTutor(true)
    setAssistantMessage('Thinking...')

    try {
      const response = await fetch('/api/ask-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          activeFile,
          currentCode,
          moduleTitle: activeModule.title
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.answer) {
          setAssistantMessage(`💡 ${data.answer}`)
          return
        }
      }
    } catch {
      // Fallback below
    } finally {
      setIsAskingTutor(false)
    }

    if (question.includes('TODO') || question.includes('hint')) {
      setAssistantMessage(
        `💡 Focus on the active file "${activeFile}". Look for the line starting with \`// TODO: ASCENT_TASK\`. Replace the placeholder logic with dynamic props or event handling.`
      )
    } else if (question.includes('state') || question.includes('derived')) {
      setAssistantMessage(
        `💡 In modern web architecture, derived state is computed on-the-fly during render (e.g. \`items.filter(...)\`) rather than storing a duplicated second list in memory. This prevents synchronization bugs.`
      )
    } else {
      setAssistantMessage(
        `💡 Component-driven development isolates UI concerns into single-responsibility units. Each component manages its own markup and handles state transformations cleanly.`
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#08080E] text-slate-200 overflow-hidden select-none">
      
      {/* Top Workspace Header Bar */}
      <div className="h-11 bg-[#0C0C14] border-b border-white/10 px-4 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="text-[#00F0FF] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> {activeProject?.title} / {activeFile}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-[10px]">
            COMP {String(activeComponentIndex + 1).padStart(2, '0')} // {isCurrentModulePassed ? 'VERIFIED ✓' : 'IN PROGRESS'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          {/* GitHub Sync Button */}
          <button
            onClick={handleGithubSync}
            disabled={isSyncingGithub}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] transition-colors ${
              githubSyncedSuccess
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 hover:border-[#00F0FF]/40 text-slate-300'
            }`}
            title="Push verified module code to GitHub repository"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>
              {isSyncingGithub
                ? 'Pushing...'
                : githubSyncedSuccess
                ? 'Pushed to GitHub ✓'
                : `Sync ${learnerProfile.githubUsername || 'GitHub'}`}
            </span>
          </button>

          {/* Download Project ZIP */}
          <button
            onClick={downloadProjectZip}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:border-[#00F0FF]/40 text-slate-300 hover:text-white text-[11px] transition-colors"
            title="Download full project codebase as .zip"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export ZIP</span>
          </button>

          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Sandbox: Active
          </span>
        </div>
      </div>

      {/* Main 3-Column IDE Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Far-Left Activity Rail (VS Code Style) */}
        <div className="w-12 bg-[#090910] border-r border-white/10 flex flex-col items-center justify-between py-3 shrink-0">
          <div className="space-y-4">
            <button
              onClick={() => setActiveRailTab('modules')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'modules' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Components & Objectives"
            >
              <Layers className="w-5 h-5" />
              {activeRailTab === 'modules' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>

            <button
              onClick={() => setActiveRailTab('files')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'files' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="File Explorer Tree"
            >
              <FolderTree className="w-5 h-5" />
              {activeRailTab === 'files' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>

            <button
              onClick={() => setActiveRailTab('hints')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'hints' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="AI Architectural Hints"
            >
              <HelpCircle className="w-5 h-5" />
              {activeRailTab === 'hints' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>

            <button
              onClick={() => setActiveRailTab('assistant')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'assistant' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Socratic Tutor Assistant"
            >
              <Sparkles className="w-5 h-5" />
              {activeRailTab === 'assistant' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>
          </div>

          <button
            onClick={() => setScreen(6)}
            className="p-2 text-slate-500 hover:text-[#00F0FF] transition-colors"
            title="View Full Roadmap & Activity Calendar"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Panel (Driven by Rail Selection) */}
        <div className="w-72 bg-[#0C0C14] border-r border-white/10 flex flex-col justify-between shrink-0 overflow-y-auto">
          
          {/* Rail 1: Modules & Component Stepper */}
          {activeRailTab === 'modules' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-2">
                <span className="text-white font-bold tracking-wider">TEACHABLE COMPONENTS</span>
                <span className="text-[#00F0FF]">
                  {activeComponentIndex + 1}/{availableComponents.length || 1}
                </span>
              </div>

              {/* Component Stepper List */}
              <div className="space-y-2">
                {availableComponents.map((comp, idx) => {
                  const isCurrent = activeComponentIndex === idx
                  const isPassed = comp.module?.status === 'passed'
                  return (
                    <button
                      key={comp.id}
                      onClick={() => setActiveComponentIndex(idx)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-white shadow-md'
                          : isPassed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300 hover:bg-emerald-500/10'
                          : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                          isPassed ? 'bg-emerald-500/20 text-emerald-400' : isCurrent ? 'bg-[#00F0FF] text-black' : 'bg-white/10 text-slate-400'
                        }`}>
                          {isPassed ? '✓' : idx + 1}
                        </span>
                        <span className="truncate max-w-[170px]">{comp.name}</span>
                      </div>
                      {isPassed && <span className="text-emerald-400 text-[10px]">PASS</span>}
                    </button>
                  )
                })}
              </div>

              {/* Current Module Tasks */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                  ACTIVE TASKS IN SCOPE
                </div>
                {activeModule.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border text-xs font-mono space-y-2 transition-all ${
                      task.status === 'passed' || isCurrentModulePassed
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : task.status === 'active'
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40 shadow-lg shadow-[#00F0FF]/5'
                        : 'bg-white/5 border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        {task.status === 'passed' || isCurrentModulePassed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
                        )}
                        {task.title}
                      </span>
                    </div>

                    {task.subtasks.length > 0 && (
                      <div className="pl-4 space-y-1 text-[11px]">
                        {task.subtasks.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 text-slate-400">
                            <span className={sub.completed || isCurrentModulePassed ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                              {sub.completed || isCurrentModulePassed ? '✓' : '•'}
                            </span>
                            <span className={sub.completed || isCurrentModulePassed ? 'line-through text-slate-500' : 'text-slate-300'}>
                              {sub.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rail 2: File Explorer */}
          {activeRailTab === 'files' && (
            <div className="p-4 space-y-3 font-mono text-xs">
              <div className="text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10 font-bold">
                WORKSPACE CODEBASE
              </div>
              <div className="space-y-1">
                {filesList.map((file) => (
                  <button
                    key={file}
                    onClick={() => setActiveFile(file)}
                    className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 transition-colors ${
                      activeFile === file ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-semibold' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <FileCode className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span className="truncate">{file}</span>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={restoreStarterCode}
                  className="cyber-btn-secondary text-xs w-full py-1.5 justify-center flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Starter Boilerplate</span>
                </button>
              </div>
            </div>
          )}

          {/* Rail 3: Progressive Hints Drawer */}
          {activeRailTab === 'hints' && (
            <div className="p-4 space-y-3 text-xs font-mono">
              <div className="text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10 font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> PROGRESSIVE HINTS
                </span>
                <span className="text-[10px] text-cyan-400">TIER 1-3</span>
              </div>
              <div className="space-y-3">
                {activeModule.hints.map((hint, idx) => {
                  const tierLabel = idx === 0 ? 'Tier 1: Conceptual Direction' : idx === 1 ? 'Tier 2: Architectural Approach' : 'Tier 3: Pseudo-code Structure'
                  return (
                    <div key={hint.id} className="p-3 rounded-lg bg-[#101018] border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-white font-semibold">{tierLabel}</span>
                        <span className="text-[#00F0FF]">{hint.pointCost === 0 ? 'FREE' : `-${hint.pointCost} pts`}</span>
                      </div>
                      {hint.unlocked ? (
                        <p className="text-slate-200 font-sans leading-relaxed">{hint.content}</p>
                      ) : (
                        <button
                          onClick={() => unlockHint(hint.id)}
                          className="cyber-btn-secondary text-xs w-full py-1.5 justify-center flex items-center gap-1.5"
                        >
                          <Lock className="w-3 h-3 text-[#00F0FF]" />
                          <span>Unlock {tierLabel.split(':')[0]} ({hint.pointCost} pts)</span>
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Socratic On-Demand Hint Button */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setActiveRailTab('assistant')
                      askSocraticAssistant('Give me a progressive architectural hint for the active task in ' + activeFile)
                    }}
                    className="w-full py-2 px-3 rounded-lg border border-[#00F0FF]/30 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ask Socratic AI for Custom Hint</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rail 4: Socratic AI Tutor */}
          {activeRailTab === 'assistant' && (
            <div className="p-4 space-y-3 text-xs font-mono">
              <div className="text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10 font-bold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#00F0FF]" /> SOCRATIC AI TUTOR
              </div>
              <p className="text-slate-400 font-sans text-xs">
                Ask architectural questions or request guidance without giving away the full answer:
              </p>
              <div className="space-y-2 pt-1">
                {[
                  'What should I write for this TODO task?',
                  'Why use derived calculations vs duplicate state?',
                  'Explain component separation of concerns'
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => askSocraticAssistant(q)}
                    className="w-full text-left p-2 rounded bg-white/5 border border-white/10 hover:border-[#00F0FF]/40 text-slate-300 hover:text-white transition-colors"
                  >
                    💬 {q}
                  </button>
                ))}
              </div>

              {assistantMessage && (
                <div className="p-3 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-slate-200 font-sans text-xs space-y-1 mt-3">
                  <span className="font-mono text-[#00F0FF] font-bold block">TUTOR EXPLANATION:</span>
                  <p>{assistantMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Bottom Sidebar Action Link */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setScreen(6)}
              className="text-xs font-mono text-slate-400 hover:text-[#00F0FF] flex items-center gap-1.5 transition-colors"
            >
              <span>View full roadmap & syllabus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Theory & Lesson Drawer Column */}
        <div className="w-80 md:w-96 bg-[#0E0E18] border-r border-white/10 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-5 space-y-5">
            
            {/* Lesson Title Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#00F0FF] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> LESSON // COMPONENT ARCHITECTURE
                </span>
                <span className="text-slate-500">Step {activeComponentIndex + 1} of {availableComponents.length || 1}</span>
              </div>
              <h3 className="text-lg md:text-xl font-display font-bold text-white tracking-tight">
                {activeModule.title}
              </h3>
            </div>

            {/* Markdown Theory Content */}
            <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-3">
              <div className="p-3.5 rounded-lg bg-black/40 border border-white/5">
                <pre className="font-sans whitespace-pre-wrap">{activeModule.theoryMarkdown}</pre>
              </div>
            </div>

            {/* Core Interfaces in Scope */}
            {activeModule.coreInterfaces?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                  CORE INTERFACES & EXPORTS
                </div>
                <div className="space-y-1.5 font-mono text-xs">
                  {activeModule.coreInterfaces.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-cyan-400 font-bold">{item.name}</span>
                      <span className="text-slate-500 text-[10px]">{item.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Code Reviewer Status / Feedback Card */}
            {evaluationResult && (
              <div className={`p-4 rounded-xl border space-y-2 ${
                evaluationResult.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className={evaluationResult.passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {evaluationResult.passed ? '✓ AI CODE REVIEW PASSED' : '⚠ CODE REVIEW FEEDBACK'}
                  </span>
                  <span className="text-white font-bold">{evaluationResult.score}/100</span>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {evaluationResult.feedback}
                </p>
                {evaluationResult.suggestions.length > 0 && (
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    {evaluationResult.suggestions.map((s, idx) => (
                      <p key={idx} className="text-[11px] text-slate-400 font-sans flex items-start gap-1.5">
                        <span className="text-[#00F0FF]">•</span>
                        <span>{s}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Target Time Info */}
          <div className="p-4 border-t border-white/10 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>Target: ~{activeModule.targetMinutes || 15} mins</span>
            </span>
            {isCurrentModulePassed && (
              <span className="text-emerald-400 font-bold">100% Passed</span>
            )}
          </div>
        </div>

        {/* Main Code Editor & Live Preview Panel */}
        <div className="flex-1 flex flex-col bg-[#07070C] overflow-hidden">
          
          {/* Main Tab Switcher Bar */}
          <div className="h-10 bg-[#090910] border-b border-white/10 px-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveMainTab('editor')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'editor'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF] font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{activeFile}</span>
              </button>
              <button
                onClick={() => setActiveMainTab('preview')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'preview'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF] font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Web Preview</span>
              </button>
              <button
                onClick={() => setActiveMainTab('review')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'review'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF] font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>AI Review & Test Output</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <button onClick={handleCopyCode} title="Copy Code" className="hover:text-white flex items-center gap-1 text-[11px]">
                <Copy className="w-3 h-3" />
                <span>{copiedSnippet ? 'Copied!' : 'Copy'}</span>
              </button>
              <button onClick={restoreStarterCode} title="Reset to Starter Boilerplate">
                <RotateCcw className="w-3.5 h-3.5 hover:text-white" />
              </button>
            </div>
          </div>

          {/* Main Content Render Area */}
          <div className="flex-1 relative overflow-hidden flex">
            
            {/* Tab 1: Professional IDE Code Editor Pane */}
            {activeMainTab === 'editor' && (
              <div className="w-full h-full flex flex-col font-mono text-xs bg-[#06060B]">
                <div className="flex-1 flex overflow-hidden">
                  {/* Left Gutter: Line Numbers */}
                  <div className="w-12 py-4 select-none text-right pr-3 text-slate-600 bg-[#07070E] border-r border-white/5 font-mono text-xs leading-relaxed shrink-0">
                    {currentCode.split('\n').map((_, i) => (
                      <div key={i} className="hover:text-slate-400">{i + 1}</div>
                    ))}
                  </div>

                  {/* Editor Input Area */}
                  <textarea
                    value={currentCode}
                    onChange={(e) => updateFileCode(activeFile, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const target = e.currentTarget
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        const val = target.value
                        target.value = val.substring(0, start) + '  ' + val.substring(end)
                        target.selectionStart = target.selectionEnd = start + 2
                        updateFileCode(activeFile, target.value)
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault()
                        runTestCases()
                      }
                    }}
                    className="flex-1 bg-transparent text-slate-100 p-4 font-mono outline-none border-none resize-none leading-relaxed selection:bg-[#00F0FF]/25 overflow-y-auto"
                    spellCheck={false}
                  />
                </div>

                {/* Editor Bottom Micro Status Strip */}
                <div className="h-6 bg-[#080810] border-t border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <div className="flex items-center gap-3">
                    <span>Lines: {currentCode.split('\n').length}</span>
                    <span>Chars: {currentCode.length}</span>
                    <span className="text-[#00F0FF]">Tab: 2 spaces</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>Press Ctrl+S to verify</span>
                    <span>UTF-8</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Sandboxed Live Web Preview (User Goal #6) */}
            {activeMainTab === 'preview' && (
              <div className="w-full h-full flex flex-col bg-[#05050A]">
                <div className="h-8 bg-[#0A0A14] border-b border-white/10 px-4 flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>SANDBOXED IFRAME RUNNER // PORT 3000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (iframeRef.current) {
                          iframeRef.current.srcdoc = previewHtml
                        }
                      }}
                      title="Recompile and re-execute student code"
                      className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1"
                    >
                      <RotateCcw className="w-2.5 h-2.5 text-[#00F0FF]" />
                      <span>Reload Execution</span>
                    </button>
                    <button
                      onClick={() => setPreviewMode('interactive')}
                      className={`px-2 py-0.5 rounded text-[10px] ${previewMode === 'interactive' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30' : 'text-slate-500'}`}
                    >
                      Interactive Execution
                    </button>
                    <button
                      onClick={() => setPreviewMode('wireframe')}
                      className={`px-2 py-0.5 rounded text-[10px] ${previewMode === 'wireframe' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30' : 'text-slate-500'}`}
                    >
                      Target Wireframe
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-3 flex flex-col">
                  {previewMode === 'interactive' ? (
                    <iframe
                      ref={iframeRef}
                      title="Ascent Live Preview"
                      sandbox="allow-scripts"
                      className="w-full h-full rounded-lg border border-white/10 bg-[#08080E]"
                    />
                  ) : (
                    <div className="w-full h-full p-6 bg-[#08080E] rounded-lg border border-white/10 overflow-y-auto space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/10 pb-2">
                        <span className="text-[#00F0FF] font-bold">WIREFRAME TARGET REFERENCE</span>
                        <span>Single-Page Architecture</span>
                      </div>
                      <p className="text-xs text-slate-300 font-sans">
                        Here is the target architectural composition your components assemble into:
                      </p>
                      <div className="p-4 rounded-xl border border-dashed border-[#00F0FF]/40 bg-[#0C0C18] space-y-3">
                        <div className="p-3 rounded bg-black/40 border border-white/10 text-xs font-mono text-cyan-300">
                          1. [Header & Brand Shell] - Active count & branding
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-300">
                          <div className="p-3 rounded bg-black/40 border border-white/5">2a. KPI 1: Activity</div>
                          <div className="p-3 rounded bg-black/40 border border-white/5">2b. KPI 2: Efficiency</div>
                          <div className="p-3 rounded bg-black/40 border border-white/5">2c. KPI 3: Latency</div>
                        </div>
                        <div className="p-4 rounded bg-black/40 border border-white/10 text-xs font-mono text-slate-400">
                          3. [Data Table & Filter Feed] - Live interactive state mutations
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Terminal Console & AI Review Output */}
            {activeMainTab === 'review' && (
              <div className="w-full h-full p-4 bg-[#05050A] font-mono text-xs text-slate-300 space-y-3 overflow-y-auto">
                <div className="text-slate-500">$ ascent-verifier test --module="{activeModule.title}"</div>
                
                {/* Real Test Output */}
                {activeModule.testCases.map((tc) => {
                  const passed = isCurrentModulePassed || tc.passed
                  return (
                    <div key={tc.id} className="flex items-center gap-2">
                      <span className={passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {passed ? '✓' : '❯'}
                      </span>
                      <span className={passed ? 'text-slate-200' : 'text-slate-400'}>
                        {tc.description}
                      </span>
                      <span className="text-slate-600 ml-auto">14ms</span>
                    </div>
                  )
                })}

                {evaluationResult && (
                  <div className="pt-4 border-t border-white/10 space-y-2">
                    <div className="text-cyan-400 font-bold">
                      [AI Socratic Review Report]
                    </div>
                    <p className="text-slate-300 font-sans leading-relaxed">
                      {evaluationResult.feedback}
                    </p>
                    {evaluationResult.suggestions.length > 0 && (
                      <div className="p-3 rounded bg-black/50 border border-cyan-500/20 text-slate-300 font-sans space-y-1">
                        <span className="font-mono text-cyan-400 text-[11px] font-bold block">
                          SUGGESTED ARCHITECTURAL IMPROVEMENTS:
                        </span>
                        {evaluationResult.suggestions.map((s, i) => (
                          <p key={i} className="text-xs text-slate-300">
                            • {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {testStatus === 'pass' && (
                  <div className="text-emerald-400 font-bold pt-3">
                    Test Files  1 passed (1)<br />
                    Assertions  {activeModule.testCases.length} passed ({activeModule.testCases.length})<br />
                    Status      VERIFIED & READY FOR NEXT COMPONENT
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Verification Test Runner Bar */}
          <div className="h-14 bg-[#0A0A12] border-t border-white/10 px-6 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 uppercase font-bold">TEST VERIFICATION:</span>
              {testStatus === 'not_run' && (
                <span className="text-slate-500">Not verified yet</span>
              )}
              {testStatus === 'running' && (
                <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> CHECKING WITH AST ANALYZER...
                </span>
              )}
              {testStatus === 'pass' && (
                <span className="badge-pass flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ALL ASSERTIONS PASSED
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> PENDING CODE TASKS
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* If passed and next component exists, show Advance Button */}
              {isCurrentModulePassed && hasNextComponent && (
                <button
                  onClick={advanceToNextComponent}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <span>Build Next Component</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Run Verification Button */}
              <button
                onClick={runTestCases}
                disabled={isTestRunning}
                className="cyber-btn-primary px-6 py-2 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isTestRunning ? 'RUNNING ASSERTIONS...' : 'RUN & CHECK CODE WITH AI'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
