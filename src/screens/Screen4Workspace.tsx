import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useApp } from '../context/AppContext'
import { buildIframeSrcDoc } from '../services/previewBuilder'
import {
  FolderTree,
  FileCode,
  HelpCircle,
  Terminal,
  CheckCircle2,
  XCircle,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Code2,
  ArrowRight,
  ArrowLeft,
  Download,
  AlertCircle,
  Lightbulb,
  Check,
  RefreshCw,
  Eye,
  ShieldCheck,
  Trophy,
  X,
  ListChecks,
  Cpu
} from 'lucide-react'

function getMonacoLanguage(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  return 'plaintext'
}

/**
 * Lightweight, safe Markdown-like renderer for Lesson & Task copy.
 * Handles fenced code blocks, headings, bullets, and inline code without external dependencies.
 */
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    const lines = (content || '').split('\n')
    const parsed: Array<{ type: 'code' | 'h' | 'ul' | 'p'; lang?: string; text?: string; items?: string[]; level?: number }> = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim()
        const codeLines: string[] = []
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        parsed.push({ type: 'code', lang, text: codeLines.join('\n') })
        i++
        continue
      }
      const hMatch = line.match(/^(#{1,3})\s+(.*)$/)
      if (hMatch) {
        parsed.push({ type: 'h', level: hMatch[1].length, text: hMatch[2] })
        i++
        continue
      }
      if (line.trim().match(/^[-*]\s+/) || line.trim().match(/^\d+\.\s+/)) {
        const items: string[] = []
        while (i < lines.length && (lines[i].trim().match(/^[-*]\s+/) || lines[i].trim().match(/^\d+\.\s+/))) {
          items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ''))
          i++
        }
        parsed.push({ type: 'ul', items })
        continue
      }
      if (line.trim() !== '') {
        const pLines: string[] = [line]
        i++
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !lines[i].trim().startsWith('```') &&
          !lines[i].match(/^#{1,3}\s+/) &&
          !lines[i].trim().match(/^([-*]|\d+\.)\s+/)
        ) {
          pLines.push(lines[i])
          i++
        }
        parsed.push({ type: 'p', text: pLines.join(' ') })
        continue
      }
      i++
    }
    return parsed
  }, [content])

  const renderInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="px-1.5 py-0.5 rounded bg-white/10 text-[#00F0FF] font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>
    })
  }

  return (
    <div className="space-y-3 text-xs text-slate-300 font-sans leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'h') {
          return (
            <h4
              key={idx}
              className={`font-display font-bold text-white tracking-tight pt-1 ${
                block.level === 1 ? 'text-base' : block.level === 2 ? 'text-sm text-[#00F0FF]' : 'text-xs uppercase tracking-wider text-cyan-300'
              }`}
            >
              {renderInline(block.text || '')}
            </h4>
          )
        }
        if (block.type === 'code') {
          return (
            <pre
              key={idx}
              className="p-3 rounded-lg bg-[#050509] border border-white/10 text-[11px] font-mono text-cyan-200 overflow-x-auto leading-relaxed"
            >
              <code>{block.text}</code>
            </pre>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="space-y-1.5 pl-1">
              {(block.items || []).map((item, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className="text-[#00F0FF] mt-0.5 shrink-0">•</span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        return <p key={idx}>{renderInline(block.text || '')}</p>
      })}
    </div>
  )
}

interface ConsoleEntry {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export const Screen4Workspace: React.FC = () => {
  const {
    activeSpec,
    currentPage,
    activeModules,
    activePageModule,
    activeModuleContent,
    isLoadingModule,
    moduleLoadError,
    userFiles,
    activeFile,
    setActiveFile,
    useTailwind,
    moduleProgress,
    checkResults,
    isExplainingErrors,
    errorExplanation,
    isPageComplete,
    setIsPageComplete,
    openModuleInWorkspace,
    retryLoadModule,
    updateUserFile,
    persistUserFiles,
    resetModuleToStarter,
    revealNextHint,
    recordCheckResults,
    explainSubmissionErrors,
    applySolutionToEditor,
    advanceToNextPageModule,
    downloadProjectZip,
    setScreen
  } = useApp()

  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [rightTab, setRightTab] = useState<'lesson' | 'task' | 'hints'>('lesson')
  const [bottomTab, setBottomTab] = useState<'preview' | 'results' | 'console'>('preview')
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSolution, setConfirmSolution] = useState(false)
  const [isCheckingWork, setIsCheckingWork] = useState(false)
  const [checkTimeoutError, setCheckTimeoutError] = useState<string | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const [previewVersion, setPreviewVersion] = useState(1)
  const [livePreviewFiles, setLivePreviewFiles] = useState<Record<string, string>>({})

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pendingCheckRunRef = useRef<boolean>(false)
  const checkTimeoutRef = useRef<number | null>(null)

  // If user navigated to Screen 4 directly and no activePageModule is loaded yet, open the first active module
  useEffect(() => {
    if (!activePageModule && !isLoadingModule && !moduleLoadError && activeModules.length > 0) {
      const target = activeModules.find(m => m.status === 'active') || activeModules[0]
      if (target && target.status !== 'locked') {
        openModuleInWorkspace(target.id)
      }
    }
  }, [activePageModule, activeModules, isLoadingModule, moduleLoadError, openModuleInWorkspace])

  // Sync open tabs and live preview files when module switches or files populate
  const fileNames = useMemo(() => Object.keys(userFiles), [userFiles])
  useEffect(() => {
    if (fileNames.length > 0) {
      setOpenTabs(prev => {
        const validExisting = prev.filter(f => fileNames.includes(f))
        if (validExisting.length > 0) return validExisting
        return fileNames.slice(0, 3)
      })
      if (!fileNames.includes(activeFile)) {
        setActiveFile(fileNames[0])
      }
    }
  }, [fileNames, activeFile, setActiveFile])

  // Reset live preview snapshot whenever a new module loads
  useEffect(() => {
    if (activePageModule && Object.keys(userFiles).length > 0) {
      setLivePreviewFiles(userFiles)
      setConsoleLogs([])
      setPreviewVersion(v => v + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageModule?.id, activeModuleContent])

  // Debounced 500ms auto-save of learner's edits per module
  useEffect(() => {
    if (!activePageModule || Object.keys(userFiles).length === 0) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      persistUserFiles(userFiles)
      setSaveState('saved')
    }, 500)
    return () => window.clearTimeout(timer)
  }, [userFiles, activePageModule, persistUserFiles])

  // Build srcDoc strictly with allow-scripts sandbox safety & conditional Tailwind Play CDN
  const previewSrcDoc = useMemo(() => {
    const source = Object.keys(livePreviewFiles).length > 0 ? livePreviewFiles : userFiles
    return buildIframeSrcDoc(source, {
      useTailwind,
      title: activeSpec?.appName || 'Ascent Sandbox Preview'
    })
  }, [livePreviewFiles, userFiles, useTailwind, activeSpec?.appName])

  // Listen to postMessage events from the sandboxed preview iframe
  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      // Only handle messages originating from our preview iframe window
      if (iframeRef.current && ev.source !== iframeRef.current.contentWindow) {
        return
      }
      const data = ev.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [
          ...prev.slice(-49),
          {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            level: data.level || 'info',
            message: String(data.message || ''),
            timestamp: new Date().toLocaleTimeString()
          }
        ])
      } else if (data.type === 'PREVIEW_READY') {
        if (pendingCheckRunRef.current && activeModuleContent && iframeRef.current?.contentWindow) {
          pendingCheckRunRef.current = false
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'RUN_CHECKS',
              checks: activeModuleContent.checks
            },
            '*'
          )
        }
      } else if (data.type === 'CHECKS_RESULT') {
        if (checkTimeoutRef.current) {
          window.clearTimeout(checkTimeoutRef.current)
          checkTimeoutRef.current = null
        }
        setIsCheckingWork(false)
        setCheckTimeoutError(null)
        recordCheckResults(Array.isArray(data.results) ? data.results : [])
        setBottomTab('results')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeModuleContent, recordCheckResults])

  // Run preview refresh
  const handleRunPreview = useCallback(() => {
    persistUserFiles(userFiles)
    setConsoleLogs([])
    setLivePreviewFiles({ ...userFiles })
    setPreviewVersion(v => v + 1)
    setBottomTab('preview')
  }, [persistUserFiles, userFiles])

  // Check My Work: saves, reloads iframe with latest code, then executes DOM checks via postMessage
  const handleCheckMyWork = useCallback(() => {
    if (!activeModuleContent) return
    persistUserFiles(userFiles)
    setCheckTimeoutError(null)
    setIsCheckingWork(true)
    setConsoleLogs([])
    pendingCheckRunRef.current = true
    setLivePreviewFiles({ ...userFiles })
    setPreviewVersion(v => v + 1)

    if (checkTimeoutRef.current) {
      window.clearTimeout(checkTimeoutRef.current)
    }
    checkTimeoutRef.current = window.setTimeout(() => {
      if (pendingCheckRunRef.current || isCheckingWork) {
        pendingCheckRunRef.current = false
        setIsCheckingWork(false)
        setCheckTimeoutError('Preview verification timed out after 4s. Check Console for syntax or infinite loop errors.')
        setBottomTab('results')
      }
    }, 4500)
  }, [activeModuleContent, isCheckingWork, persistUserFiles, userFiles])

  const handleOpenFileTab = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path])
    }
    setActiveFile(path)
  }

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (openTabs.length <= 1) return
    const nextTabs = openTabs.filter(t => t !== path)
    setOpenTabs(nextTabs)
    if (activeFile === path) {
      setActiveFile(nextTabs[nextTabs.length - 1])
    }
  }

  // Empty state if no project syllabus exists yet
  if (!currentPage || activeModules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#08080E]">
        <div className="w-full max-w-md space-y-4">
          <Terminal className="w-8 h-8 text-[#00F0FF] mx-auto" />
          <h2 className="text-2xl font-bold text-white font-display">No Active Course Workspace</h2>
          <p className="text-xs text-slate-400 font-sans">
            Create or select a project and confirm its specification to launch your interactive IDE workspace.
          </p>
          <button onClick={() => setScreen(1)} className="cyber-btn-primary mx-auto">
            <span>Go to Prompt Screen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Loading state for lazy Gemini module content synthesis
  if (isLoadingModule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#08080E]">
        <div className="w-full max-w-lg cyber-card p-6 bg-[#0D0D16] border-[#00F0FF]/40 space-y-5 font-mono">
          <div className="flex items-center justify-between text-xs text-[#00F0FF] border-b border-white/10 pb-3">
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 animate-spin" />
              <span>SYNTHESIZING MODULE WORKSPACE</span>
            </span>
            <span className="text-[11px] text-slate-400">JSDOM HARNESS VERIFIED</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white font-display">{activePageModule?.title || 'Loading Module'}</h3>
            <p className="text-xs text-slate-400 font-sans">
              Generating tailored lesson, task criteria, your baseline code files, and declarative DOM assertions...
            </p>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-[#00F0FF] animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  // Error state with Retry
  if (moduleLoadError || !activeModuleContent || !activePageModule) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#08080E]">
        <div className="w-full max-w-lg cyber-card p-6 bg-[#160B0F] border-rose-500/50 space-y-4 font-mono">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-white font-display">Failed to Load Module Content</h3>
              <p className="text-xs text-rose-300/80">MODULE_GENERATION_OR_VERIFICATION_ERROR</p>
            </div>
          </div>
          <div className="p-3 rounded bg-black/50 border border-rose-500/20 text-xs text-rose-200 font-sans">
            {moduleLoadError || 'Module content could not be initialized.'}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setScreen(3)} className="cyber-btn-secondary text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to overview</span>
            </button>
            <button
              onClick={retryLoadModule}
              className="cyber-btn-primary text-xs bg-rose-600 hover:bg-rose-500 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Generation</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentModIndex = activeModules.findIndex(m => m.id === activePageModule.id)
  const hasNextModule = currentModIndex !== -1 && currentModIndex + 1 < activeModules.length
  const totalHints = activeModuleContent.hints.length
  const hintsRevealedCount = Math.min(totalHints, moduleProgress?.hintsUsed || 0)
  const attemptsCount = moduleProgress?.attempts || 0
  const isModulePassed = Boolean(moduleProgress?.passed || activePageModule.status === 'done')
  const solutionUnlocked = attemptsCount >= 3 || isModulePassed
  const failedChecksList = checkResults.filter(r => !r.passed)
  const passedChecksCount = checkResults.filter(r => r.passed).length
  const hasRunChecks = checkResults.length > 0
  const allChecksPassed = hasRunChecks && failedChecksList.length === 0

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#08080E] text-slate-200 overflow-hidden">
      {/* TOP BAR: Project Name, Module Title, Progress Dots, Back to Overview */}
      <div className="h-11 bg-[#0C0C14] border-b border-white/10 px-4 flex items-center justify-between gap-4 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setScreen(3)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>Back to overview</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">|</span>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#00F0FF] font-bold truncate max-w-[140px] md:max-w-xs">
              {activeSpec?.appName || currentPage.name}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-white font-semibold truncate max-w-[180px] md:max-w-sm">
              Module {currentModIndex + 1} of {activeModules.length}: {activePageModule.title}
            </span>
          </div>
        </div>

        {/* Center/Right: Progress Dots + Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Progress Dots */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-white/10" title="Module Progress">
            {activeModules.map((mod, idx) => {
              const isCurrent = mod.id === activePageModule.id
              const isDone = mod.status === 'done'
              const isLocked = mod.status === 'locked'
              return (
                <button
                  key={mod.id}
                  disabled={isLocked}
                  onClick={() => !isLocked && openModuleInWorkspace(mod.id)}
                  title={`${idx + 1}. ${mod.title} (${mod.status})`}
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-[#00F0FF] text-black ring-2 ring-[#00F0FF]/40 cursor-pointer'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 cursor-pointer'
                      : mod.status === 'active'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-pointer'
                      : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isDone ? '✓' : isLocked ? <Lock className="w-2.5 h-2.5" /> : idx + 1}
                </button>
              )
            })}
          </div>

          <span className={`text-[10px] px-2 py-0.5 rounded border ${saveState === 'saving' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
            {saveState === 'saving' ? 'Saving...' : 'Saved'}
          </span>

          <button
            onClick={downloadProjectZip}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:border-[#00F0FF]/40 text-slate-300 hover:text-white text-[11px] cursor-pointer"
            title="Download project ZIP"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>ZIP</span>
          </button>
        </div>
      </div>

      {/* MAIN IDE GRID */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANE: File Explorer */}
        <aside className="w-full lg:w-52 bg-[#0A0A12] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 pb-1.5 border-b border-white/10 font-bold">
              <span className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-[#00F0FF]" /> EXPLORER
              </span>
              <span className="text-slate-600">{fileNames.length} FILES</span>
            </div>

            <div className="flex lg:flex-col gap-1 overflow-x-auto">
              {fileNames.map(path => {
                const isSelected = activeFile === path
                return (
                  <button
                    key={path}
                    onClick={() => handleOpenFileTab(path)}
                    className={`text-left px-2.5 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-semibold'
                        : 'text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span className="truncate">{path}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hidden lg:block p-3 border-t border-white/10 space-y-2 font-mono text-[10px] text-slate-500">
            <div className="flex items-center justify-between">
              <span>STACK</span>
              <span className="text-slate-300">{useTailwind ? 'HTML + Tailwind + JS' : 'HTML + CSS + JS'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>ATTEMPTS</span>
              <span className="text-white font-bold">{attemptsCount}</span>
            </div>
          </div>
        </aside>

        {/* CENTER PANE: Monaco Editor + Toolbar */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#07070C] border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden">
          {/* Editor Tabs & Actions Bar */}
          <div className="h-10 bg-[#090910] border-b border-white/10 px-3 flex items-center justify-between gap-2 shrink-0 font-mono text-xs overflow-x-auto">
            {/* File Tabs */}
            <div className="flex items-center gap-1 shrink-0">
              {openTabs.map(tab => {
                const isActive = activeFile === tab
                return (
                  <div
                    key={tab}
                    onClick={() => setActiveFile(tab)}
                    className={`px-3 py-1.5 rounded-t border-t border-x flex items-center gap-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#1e1e1e] border-white/15 text-[#00F0FF] font-semibold'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{tab}</span>
                    {openTabs.length > 1 && (
                      <button
                        onClick={e => handleCloseTab(tab, e)}
                        className="text-slate-500 hover:text-white ml-1"
                        title="Close tab"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Action Buttons: Run, Check My Work, Get Hint, Reset */}
            <div className="flex items-center gap-2 shrink-0">
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Reset this module's code to starter files"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset to starter</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/40 px-2 py-0.5 rounded text-[11px]">
                  <span className="text-rose-300">Reset?</span>
                  <button
                    onClick={() => {
                      resetModuleToStarter()
                      setConfirmReset(false)
                    }}
                    className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-500 cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-1.5 py-0.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setRightTab('hints')
                  if (hintsRevealedCount === 0 && totalHints > 0) {
                    revealNextHint()
                  }
                }}
                className="px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Lightbulb className="w-3 h-3" />
                <span className="hidden sm:inline">Get Hint</span>
              </button>

              <button
                onClick={handleRunPreview}
                className="px-3 py-1 rounded border border-white/15 bg-white/10 hover:bg-white/15 text-white flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <Play className="w-3 h-3 text-emerald-400 fill-current" />
                <span>Run</span>
              </button>

              <button
                onClick={handleCheckMyWork}
                disabled={isCheckingWork}
                className="cyber-btn-primary px-3 py-1 text-[11px] rounded font-bold cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isCheckingWork ? 'Checking...' : 'Check My Work'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-[260px] bg-[#1e1e1e]">
            <Editor
              height="100%"
              theme="vs-dark"
              path={activeFile}
              language={getMonacoLanguage(activeFile)}
              value={userFiles[activeFile] ?? ''}
              onChange={val => updateUserFile(activeFile, val ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                lineNumbers: 'on',
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>

          {/* BOTTOM PANE: Sandboxed Live Preview & Check Results */}
          <div className="h-[44%] min-h-[220px] border-t border-white/15 flex flex-col bg-[#06060B]">
            <div className="h-9 bg-[#0B0B14] border-b border-white/10 px-3 flex items-center justify-between font-mono text-[11px] shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBottomTab('preview')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === 'preview' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Preview</span>
                </button>
                <button
                  onClick={() => setBottomTab('results')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === 'results' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Results</span>
                  {hasRunChecks && (
                    <span className={`px-1.5 rounded text-[10px] ${allChecksPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {passedChecksCount}/{checkResults.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setBottomTab('console')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === 'console' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Console ({consoleLogs.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  sandbox="allow-scripts"
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {/* Keep iframe mounted cleanly so postMessage works regardless of active bottom tab */}
              <div className={`w-full h-full bg-white ${bottomTab === 'preview' ? 'block' : 'hidden'}`}>
                <iframe
                  key={previewVersion}
                  ref={iframeRef}
                  title="Ascent Sandboxed Preview"
                  sandbox="allow-scripts"
                  srcDoc={previewSrcDoc}
                  className="w-full h-full border-0 bg-white"
                />
              </div>

              {/* Results Tab */}
              {bottomTab === 'results' && (
                <div className="w-full h-full overflow-y-auto p-4 space-y-3 bg-[#07070D]">
                  {isCheckingWork && (
                    <div className="p-3 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-xs font-mono text-[#00F0FF] flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Executing declarative DOM checks in sandboxed iframe...</span>
                    </div>
                  )}

                  {checkTimeoutError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300">
                      {checkTimeoutError}
                    </div>
                  )}

                  {!hasRunChecks && !isCheckingWork && (
                    <div className="text-xs text-slate-400 font-mono p-4 border border-dashed border-white/10 rounded-lg text-center">
                      Click <strong>Check My Work</strong> to evaluate your code against this module&apos;s {activeModuleContent.checks.length} assertions.
                    </div>
                  )}

                  {allChecksPassed && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-emerald-300 font-display">
                            All {checkResults.length} Checks Passed!
                          </div>
                          <div className="text-xs text-emerald-200/80 font-sans">
                            {hasNextModule
                              ? 'Your changes were saved to Project Memory and the next module is now unlocked.'
                              : 'You have completed every component module on this page!'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={advanceToNextPageModule}
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{hasNextModule ? 'Next Module' : 'View Page Complete Summary'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {hasRunChecks && (
                    <div className="space-y-2">
                      {activeModuleContent.checks.map(check => {
                        const res = checkResults.find(r => r.id === check.id)
                        const passed = res?.passed ?? false
                        return (
                          <div
                            key={check.id}
                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                              passed
                                ? 'bg-emerald-500/5 border-emerald-500/25 text-slate-200'
                                : 'bg-rose-500/5 border-rose-500/30 text-slate-200'
                            }`}
                          >
                            {passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="font-semibold text-white">{check.description}</div>
                              {!passed && (res?.message || check.message) && (
                                <div className="text-[11px] text-rose-200/90 font-mono">
                                  What to look at: {res?.message || check.message}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Failed Controls: Explain My Errors + 3-Attempt Show Solution */}
                  {hasRunChecks && !allChecksPassed && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={explainSubmissionErrors}
                        disabled={isExplainingErrors}
                        className="px-3 py-1.5 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/40 text-[#00F0FF] text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isExplainingErrors ? 'Analyzing errors...' : 'Explain my errors'}</span>
                      </button>

                      {solutionUnlocked ? (
                        !confirmSolution ? (
                          <button
                            onClick={() => setConfirmSolution(true)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Show solution</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs font-mono">
                            <span className="text-amber-200">Apply reference solution (marks completed with solution)?</span>
                            <button
                              onClick={() => {
                                applySolutionToEditor()
                                setConfirmSolution(false)
                              }}
                              className="px-2 py-0.5 rounded bg-amber-500 text-black font-bold hover:bg-amber-400 cursor-pointer"
                            >
                              Apply Solution
                            </button>
                            <button
                              onClick={() => setConfirmSolution(false)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Solution unlocks after {Math.max(0, 3 - attemptsCount)} more failed attempt(s)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Socratic Error Explanation Box */}
                  {errorExplanation && (
                    <div className="p-4 rounded-xl bg-[#0D1520] border border-[#00F0FF]/40 space-y-2.5">
                      <div className="text-xs font-mono font-bold text-[#00F0FF] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>MENTOR FEEDBACK</span>
                      </div>
                      <p className="text-xs text-slate-200 font-sans leading-relaxed">
                        {errorExplanation.feedback}
                      </p>
                      {errorExplanation.suggestions.length > 0 && (
                        <ul className="space-y-1 pt-1 border-t border-white/10">
                          {errorExplanation.suggestions.map((s, idx) => (
                            <li key={idx} className="text-[11px] text-cyan-200 font-sans flex items-start gap-1.5">
                              <span className="text-[#00F0FF]">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Console Tab */}
              {bottomTab === 'console' && (
                <div className="w-full h-full overflow-y-auto p-3 bg-[#05050A] font-mono text-xs space-y-1.5">
                  {consoleLogs.length === 0 ? (
                    <div className="text-slate-500 text-[11px]">No console output or runtime errors captured yet.</div>
                  ) : (
                    consoleLogs.map(entry => (
                      <div
                        key={entry.id}
                        className={`px-2 py-1 rounded text-[11px] flex items-start gap-2 ${
                          entry.level === 'error'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            : entry.level === 'warn'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'text-slate-300 border border-white/5'
                        }`}
                      >
                        <span className="text-slate-600 shrink-0">[{entry.timestamp}]</span>
                        <span className="uppercase font-bold shrink-0">{entry.level}:</span>
                        <span className="break-all">{entry.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Lesson | Task | Hints */}
        <aside className="w-full lg:w-96 bg-[#0C0C15] flex flex-col shrink-0 overflow-hidden">
          <div className="h-10 bg-[#0A0A12] border-b border-white/10 px-3 flex items-center gap-1 font-mono text-xs shrink-0">
            <button
              onClick={() => setRightTab('lesson')}
              className={`px-3 py-1.5 rounded-t border-t border-x flex items-center gap-1.5 cursor-pointer ${
                rightTab === 'lesson'
                  ? 'bg-[#0C0C15] border-white/10 text-[#00F0FF] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lesson</span>
            </button>
            <button
              onClick={() => setRightTab('task')}
              className={`px-3 py-1.5 rounded-t border-t border-x flex items-center gap-1.5 cursor-pointer ${
                rightTab === 'task'
                  ? 'bg-[#0C0C15] border-white/10 text-[#00F0FF] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Task</span>
            </button>
            <button
              onClick={() => setRightTab('hints')}
              className={`px-3 py-1.5 rounded-t border-t border-x flex items-center gap-1.5 cursor-pointer ${
                rightTab === 'hints'
                  ? 'bg-[#0C0C15] border-white/10 text-[#00F0FF] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Hints ({hintsRevealedCount}/{totalHints})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {rightTab === 'lesson' && (
              <div className="space-y-4">
                <div className="space-y-1 border-b border-white/10 pb-3">
                  <div className="text-[10px] font-mono uppercase text-[#00F0FF]">
                    {activePageModule.componentType}
                  </div>
                  <h3 className="text-lg font-display font-bold text-white leading-snug">
                    {activePageModule.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    {activePageModule.learningObjective}
                  </p>
                </div>

                <SimpleMarkdown content={activeModuleContent.lesson} />

                <div className="pt-2">
                  <button
                    onClick={() => setRightTab('task')}
                    className="cyber-btn-secondary w-full justify-center text-xs py-2 cursor-pointer"
                  >
                    <span>Go to Build Task</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {rightTab === 'task' && (
              <div className="space-y-4">
                <div className="space-y-1 border-b border-white/10 pb-3">
                  <div className="text-[10px] font-mono uppercase text-[#00F0FF]">YOUR MISSION</div>
                  <h3 className="text-base font-display font-bold text-white">
                    {activePageModule.title}
                  </h3>
                </div>

                <SimpleMarkdown content={activeModuleContent.task} />

                <div className="space-y-2 pt-3 border-t border-white/10">
                  <div className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                    ACCEPTANCE CHECKS ({activeModuleContent.checks.length})
                  </div>
                  <div className="space-y-1.5">
                    {activeModuleContent.checks.map((c, idx) => {
                      const res = checkResults.find(r => r.id === c.id)
                      return (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs flex items-start gap-2"
                        >
                          {res?.passed ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px] shrink-0">{idx + 1}.</span>
                          )}
                          <span className={res?.passed ? 'text-emerald-300' : 'text-slate-300'}>
                            {c.description}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {rightTab === 'hints' && (
              <div className="space-y-4">
                <div className="space-y-1 border-b border-white/10 pb-3">
                  <div className="text-[10px] font-mono uppercase text-amber-400">PROGRESSIVE HINTS</div>
                  <h3 className="text-base font-display font-bold text-white">Stuck? Reveal one step at a time</h3>
                  <p className="text-xs text-slate-400 font-sans">
                    Hints used are recorded on your module progress ({hintsRevealedCount} of {totalHints} unlocked).
                  </p>
                </div>

                {totalHints === 0 ? (
                  <div className="text-xs text-slate-400 font-mono">No hints available for this module.</div>
                ) : (
                  <div className="space-y-3">
                    {activeModuleContent.hints.slice(0, hintsRevealedCount).map((hint, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-amber-300 uppercase">
                          Hint {idx + 1} of {totalHints}
                        </div>
                        <SimpleMarkdown content={hint} />
                      </div>
                    ))}

                    {hintsRevealedCount < totalHints ? (
                      <button
                        onClick={revealNextHint}
                        className="w-full py-2.5 px-4 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <span>Reveal Hint {hintsRevealedCount + 1} of {totalHints}</span>
                      </button>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-500 text-center py-2">
                        All {totalHints} hints have been revealed.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* PAGE COMPLETE SUMMARY MODAL */}
      {isPageComplete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg cyber-card p-6 bg-[#0D111A] border-emerald-500/50 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                    PAGE MILESTONE COMPLETE
                  </div>
                  <h3 className="text-xl font-display font-bold text-white">
                    {currentPage.name} ({currentPage.fileName})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsPageComplete(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Congratulations! You completed all {activeModules.length} cumulative component modules for{' '}
              <strong className="text-white">{activeSpec?.appName || currentPage.name}</strong> and verified every DOM assertion in the sandbox.
            </p>

            <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
              {activeModules.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {idx + 1}. {m.title}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setIsPageComplete(false)
                  setScreen(3)
                }}
                className="cyber-btn-secondary text-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Overview</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadProjectZip}
                  className="px-3.5 py-2 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/40 text-[#00F0FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ZIP</span>
                </button>

                <button
                  disabled
                  title="Multi-page expansion is coming in the next milestone"
                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 font-mono text-xs cursor-not-allowed opacity-60"
                >
                  Generate next page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
