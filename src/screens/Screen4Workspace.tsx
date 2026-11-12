import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useApp } from '../context/AppContext'
import { Check, CheckResult, ReviewSubmissionResponse } from '../schemas/course'
import { buildIframeSrcDoc } from '../services/previewBuilder'
import { getDeterministicCheckGuidance } from '../services/workspaceHelpers'
import { SimpleMarkdown } from '../components/SimpleMarkdown'
import { FileExplorer } from '../components/FileExplorer'
import { AssetViewer } from '../components/AssetViewer'
import {
  Play,
  CheckCircle2,
  XCircle,
  Lightbulb,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Lock,
  FileCode,
  FileText,
  Terminal,
  Eye,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Download,
  Code2,
  BookOpen,
  ListChecks,
  HelpCircle,
  X,
  Trophy,
  Layers,
  ExternalLink,
  Clock,
  Rocket,
  Map as MapIcon,
  PlusCircle
} from 'lucide-react'
import type { LearnerProgress } from '../schemas/course'

function formatDurationFromProgress(entries: LearnerProgress[]): string {
  if (!entries || entries.length === 0) return '< 1 min'
  let totalMs = 0
  let earliestStart = Number.POSITIVE_INFINITY
  let latestEnd = 0

  for (const entry of entries) {
    const startMs = entry.startedAt ? Date.parse(entry.startedAt) : NaN
    const endMs = entry.completedAt ? Date.parse(entry.completedAt) : NaN
    if (!Number.isNaN(startMs)) earliestStart = Math.min(earliestStart, startMs)
    if (!Number.isNaN(endMs)) latestEnd = Math.max(latestEnd, endMs)
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      totalMs += Math.max(1000, endMs - startMs)
    }
  }

  if (totalMs === 0 && earliestStart < latestEnd) {
    totalMs = latestEnd - earliestStart
  }
  if (totalMs <= 0) return '< 1 min'

  const totalSec = Math.round(totalMs / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs}h ${remMins}m`
}

interface ConsoleEntry {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

function getMonacoLanguage(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.svg') || lower.endsWith('.xml')) return 'xml'
  return 'plaintext'
}

export const Screen4Workspace: React.FC = () => {
  const {
    activeSpec,
    currentPage,
    pages,
    activeModules,
    projectMemory,
    useTailwind,
    setScreen,
    activeModuleIndex,
    activeModuleItem,
    activeModuleContent,
    isLoadingModuleContent,
    moduleContentError,
    userFiles,
    projectFiles,
    projectFolders,
    assetUrlMap,
    assetError,
    clearAssetError,
    hasMissingProvidedAssets,
    activeFile,
    setActiveFile,
    isModuleRedoMode,
    isPageCompleteView,
    setIsPageCompleteView,
    isProjectCompleteView,
    finishActivePage,
    isGeneratingNextPage,
    nextPageError,
    clearNextPageError,
    generateNextPage,
    resetToNewProject,
    activeProjectSource,
    allModulesProgressMap,
    getModuleProgress,
    getEffectiveModuleStatus,
    isModuleOpenable,
    openModule,
    retryLoadModuleContent,
    updateUserFile,
    flushUserFilesSave,
    resetToStarter,
    createNewFile,
    createNewFolder,
    uploadProjectFiles,
    renameProjectEntry,
    deleteProjectEntry,
    restoreProvidedAssets,
    revealNextHint,
    recordFailedCheckAttempt,
    completeActiveModule,
    requestSubmissionReview,
    enableModuleRedo,
    downloadProjectZip
  } = useApp()

  const [rightInfoTab, setRightInfoTab] = useState<'lesson' | 'task' | 'hints'>('lesson')
  const [bottomPanelTab, setBottomPanelTab] = useState<'checks' | 'console'>('checks')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showSolutionModal, setShowSolutionModal] = useState(false)
  const [solutionTabFile, setSolutionTabFile] = useState<string>('index.html')

  // Multi-page preview navigation state (workspace + Page/Project Complete)
  const [previewTargetHtml, setPreviewTargetHtml] = useState<string>(currentPage?.fileName || 'index.html')
  const [previewNavHistory, setPreviewNavHistory] = useState<string[]>([])
  const [previewNavNotice, setPreviewNavNotice] = useState<string | null>(null)
  const summaryIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Sandboxed iframe preview state (800ms debounce + manual Run)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [previewKey, setPreviewKey] = useState<number>(0)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const [missingAssetWarnings, setMissingAssetWarnings] = useState<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBuiltFilesJsonRef = useRef<string>('')
  const iframeReadyRef = useRef<boolean>(false)
  const readyWaitersRef = useRef<Array<() => void>>([])

  // Check execution + results state
  const [isRunningChecks, setIsRunningChecks] = useState(false)
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null)
  const [allChecksPassed, setAllChecksPassed] = useState(false)
  const pendingCheckRunRef = useRef<{
    runId: string
    resolve: (results: CheckResult[]) => void
  } | null>(null)

  // Socratic LLM error review state
  const [isReviewingErrors, setIsReviewingErrors] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [submissionReview, setSubmissionReview] = useState<ReviewSubmissionResponse | null>(null)

  const currentProgress = activeModuleItem ? getModuleProgress(activeModuleItem.id) : null
  const effectiveStatus = activeModuleItem
    ? getEffectiveModuleStatus(activeModuleItem.id, activeModuleIndex)
    : 'active'
  const isReadOnly = effectiveStatus === 'done' && !isModuleRedoMode
  const attempts = currentProgress?.attempts || 0
  const hintsUsed = currentProgress?.hintsUsed || 0

  const rebuildPreviewNow = useCallback((filesToBuild: Record<string, string>, overrideTargetHtml?: string) => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
      previewDebounceRef.current = null
    }
    const targetHtml = overrideTargetHtml || previewTargetHtml || currentPage?.fileName || 'index.html'
    const allPaths = projectFiles.map(f => f.path)
    const serialized = JSON.stringify({ filesToBuild, targetHtml, assetKeys: Object.keys(assetUrlMap).sort(), allPaths })
    lastBuiltFilesJsonRef.current = serialized
    iframeReadyRef.current = false
    setConsoleLogs([])
    let detectedMissing: string[] = []
    const doc = buildIframeSrcDoc(filesToBuild, {
      useTailwind,
      title: activeSpec?.appName || 'Ascent Preview',
      targetHtmlFile: targetHtml,
      previewId: 'workspace_preview',
      assetUrlMap,
      allProjectPaths: allPaths,
      onMissingAssets: warnings => {
        detectedMissing = warnings
      }
    })
    setMissingAssetWarnings(detectedMissing)
    setPreviewHtml(doc)
    setPreviewKey(k => k + 1)
  }, [useTailwind, activeSpec?.appName, assetUrlMap, projectFiles, previewTargetHtml, currentPage?.fileName])

  // Clear per-module transient state when switching modules or pages
  useEffect(() => {
    setCheckResults(null)
    setAllChecksPassed(false)
    setSubmissionReview(null)
    setReviewError(null)
    setShowResetConfirm(false)
    setShowSolutionModal(false)
    setRightInfoTab('lesson')
    setPreviewNavHistory([])
    setPreviewNavNotice(null)
    setPreviewTargetHtml(currentPage?.fileName || 'index.html')
    lastBuiltFilesJsonRef.current = ''
  }, [activeModuleItem?.id, currentPage?.fileName])

  useEffect(() => {
    if (isProjectCompleteView) {
      setPreviewNavHistory([])
      setPreviewNavNotice(null)
      const siteFiles = { ...(projectMemory?.completedFiles || {}), ...userFiles }
      const defaultEntry = siteFiles['index.html'] !== undefined ? 'index.html' : (currentPage?.fileName || 'index.html')
      setPreviewTargetHtml(defaultEntry)
    } else if (isPageCompleteView && currentPage?.fileName) {
      setPreviewNavHistory([])
      setPreviewNavNotice(null)
      setPreviewTargetHtml(currentPage.fileName)
    }
  }, [isPageCompleteView, isProjectCompleteView, currentPage?.fileName])

  // Initial preview build + 800ms debounced rebuild on edits or asset updates
  useEffect(() => {
    if (Object.keys(userFiles).length === 0 && projectFiles.length === 0) return
    const allPaths = projectFiles.map(f => f.path)
    const targetHtml = previewTargetHtml || currentPage?.fileName || 'index.html'
    const serialized = JSON.stringify({ filesToBuild: userFiles, targetHtml, assetKeys: Object.keys(assetUrlMap).sort(), allPaths })
    if (!previewHtml || lastBuiltFilesJsonRef.current === '') {
      rebuildPreviewNow(userFiles, targetHtml)
      return
    }
    if (serialized === lastBuiltFilesJsonRef.current) return

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
    }
    previewDebounceRef.current = setTimeout(() => {
      rebuildPreviewNow(userFiles, targetHtml)
    }, 800)

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
    }
  }, [userFiles, assetUrlMap, projectFiles, previewHtml, previewTargetHtml, currentPage?.fileName, rebuildPreviewNow])

  const allMergedTextFiles = useMemo(() => {
    return {
      ...(projectMemory?.completedFiles || {}),
      ...userFiles
    }
  }, [projectMemory?.completedFiles, userFiles])

  const availableHtmlFiles = useMemo(() => {
    const keys = Object.keys(allMergedTextFiles).filter(p => /\.html?$/i.test(p))
    return keys.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
  }, [allMergedTextFiles])

  const handlePreviewBack = useCallback(() => {
    setPreviewNavNotice(null)
    setPreviewNavHistory(prev => {
      if (prev.length === 0) return prev
      const previousPage = prev[prev.length - 1]
      setPreviewTargetHtml(previousPage)
      return prev.slice(0, -1)
    })
  }, [])

  const handlePreviewSelectHtml = useCallback((targetPath: string) => {
    setPreviewNavNotice(null)
    if (targetPath === previewTargetHtml) return
    setPreviewNavHistory(prev => [...prev, previewTargetHtml])
    setPreviewTargetHtml(targetPath)
  }, [previewTargetHtml])

  // Listen to messages strictly from our sandboxed preview iframes (workspace or summary)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const fromWorkspaceIframe = Boolean(iframeRef.current && event.source === iframeRef.current.contentWindow)
      const fromSummaryIframe = Boolean(summaryIframeRef.current && event.source === summaryIframeRef.current.contentWindow)
      if (!fromWorkspaceIframe && !fromSummaryIframe) return

      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'ASCENT_NAVIGATE_PAGE' && typeof data.targetPath === 'string') {
        const cleanTarget = data.targetPath.trim().replace(/^\.\//, '').replace(/^\/+/, '')
        if (allMergedTextFiles[cleanTarget] !== undefined) {
          setPreviewNavNotice(null)
          setPreviewNavHistory(prev => [...prev, previewTargetHtml])
          setPreviewTargetHtml(cleanTarget)
        } else {
          const msg = `Page "${cleanTarget}" has not been created yet.`
          setPreviewNavNotice(msg)
          setConsoleLogs(prev => [
            ...prev.slice(-99),
            {
              id: `log_nav_${Date.now()}`,
              level: 'warn',
              message: msg,
              timestamp: new Date().toLocaleTimeString()
            }
          ])
        }
        return
      }

      if (!fromWorkspaceIframe) return

      if (data.type === 'PREVIEW_READY') {
        iframeReadyRef.current = true
        const waiters = readyWaitersRef.current.splice(0)
        waiters.forEach(fn => fn())
      } else if (data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [
          ...prev.slice(-99),
          {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            level: data.level === 'error' ? 'error' : data.level === 'warn' ? 'warn' : 'info',
            message: String(data.message || ''),
            timestamp: new Date().toLocaleTimeString()
          }
        ])
      } else if (data.type === 'CHECKS_RESULT') {
        const pending = pendingCheckRunRef.current
        if (pending && (!data.runId || data.runId === pending.runId)) {
          pendingCheckRunRef.current = null
          pending.resolve(Array.isArray(data.results) ? data.results : [])
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [allMergedTextFiles, previewTargetHtml])

  const waitForIframeReady = (): Promise<void> => {
    if (iframeReadyRef.current) return Promise.resolve()
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, 1800)
      readyWaitersRef.current.push(() => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  const handleRunPreview = () => {
    flushUserFilesSave()
    rebuildPreviewNow(userFiles)
    setBottomPanelTab('console')
  }

  const handleCheckMyWork = async () => {
    if (!activeModuleContent || isRunningChecks) return

    flushUserFilesSave()
    setIsRunningChecks(true)
    setSubmissionReview(null)
    setReviewError(null)
    setBottomPanelTab('checks')

    try {
      const expectedCheckHtml = currentPage?.fileName || 'index.html'
      if (previewTargetHtml !== expectedCheckHtml) {
        setPreviewTargetHtml(expectedCheckHtml)
      }
      // Ensure preview reflects latest userFiles and target page before posting RUN_CHECKS
      const serialized = JSON.stringify({
        filesToBuild: userFiles,
        targetHtml: expectedCheckHtml,
        assetKeys: Object.keys(assetUrlMap).sort(),
        allPaths: projectFiles.map(f => f.path)
      })
      if (serialized !== lastBuiltFilesJsonRef.current || !iframeReadyRef.current) {
        rebuildPreviewNow(userFiles, expectedCheckHtml)
        await waitForIframeReady()
        // Allow scripts one short tick after PREVIEW_READY
        await new Promise(r => setTimeout(r, 80))
      }

      const targetWin = iframeRef.current?.contentWindow
      if (!targetWin) {
        throw new Error('Preview sandbox window is unavailable.')
      }

      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const results = await new Promise<CheckResult[]>(resolve => {
        const timer = setTimeout(() => {
          if (pendingCheckRunRef.current?.runId === runId) {
            pendingCheckRunRef.current = null
            resolve(
              activeModuleContent.checks.map(chk => ({
                id: chk.id,
                passed: false,
                message: 'Check execution timed out inside preview sandbox (check for runtime or syntax errors in console).'
              }))
            )
          }
        }, 6500)

        pendingCheckRunRef.current = {
          runId,
          resolve: res => {
            clearTimeout(timer)
            resolve(res)
          }
        }

        targetWin.postMessage(
          {
            type: 'RUN_CHECKS',
            runId,
            checks: activeModuleContent.checks
          },
          '*'
        )
      })

      setCheckResults(results)
      const passedAll = results.length > 0 && results.every(r => r.passed)
      setAllChecksPassed(passedAll)

      if (passedAll) {
        completeActiveModule({ usedSolution: false })
      } else {
        recordFailedCheckAttempt()
      }
    } catch (err: any) {
      setCheckResults(
        activeModuleContent.checks.map(chk => ({
          id: chk.id,
          passed: false,
          message: err?.message || 'Failed to execute checks inside sandbox.'
        }))
      )
      setAllChecksPassed(false)
      recordFailedCheckAttempt()
    } finally {
      setIsRunningChecks(false)
    }
  }

  const handleExplainErrors = async () => {
    if (!activeModuleContent || !checkResults) return
    const failedPairs = activeModuleContent.checks
      .map(chk => {
        const res = checkResults.find(r => r.id === chk.id)
        return res && !res.passed ? { check: chk, result: res } : null
      })
      .filter((item): item is { check: Check; result: CheckResult } => Boolean(item))

    if (failedPairs.length === 0) return

    setIsReviewingErrors(true)
    setReviewError(null)
    try {
      const review = await requestSubmissionReview(failedPairs)
      setSubmissionReview(review)
    } catch (err: any) {
      setReviewError(err?.message || 'Unable to generate AI error explanation.')
    } finally {
      setIsReviewingErrors(false)
    }
  }

  const handleRevealSolution = () => {
    if (!activeModuleContent) return
    if (activeModuleContent.solutionFiles.length > 0) {
      setSolutionTabFile(activeModuleContent.solutionFiles[0].path)
    }
    setShowSolutionModal(true)
    completeActiveModule({ usedSolution: true })
  }

  const summarySrcDoc = useMemo(() => {
    if (!isPageCompleteView && !isProjectCompleteView) return ''
    const mergedFiles =
      Object.keys(allMergedTextFiles).length > 0 ? allMergedTextFiles : userFiles
    return buildIframeSrcDoc(mergedFiles, {
      useTailwind,
      title: activeSpec?.appName || currentPage?.name || 'Completed Project',
      targetHtmlFile: previewTargetHtml || currentPage?.fileName || 'index.html',
      previewId: 'summary_preview',
      assetUrlMap,
      allProjectPaths: projectFiles.map(f => f.path)
    })
  }, [
    isPageCompleteView,
    isProjectCompleteView,
    allMergedTextFiles,
    userFiles,
    useTailwind,
    activeSpec?.appName,
    currentPage?.name,
    currentPage?.fileName,
    previewTargetHtml,
    assetUrlMap,
    projectFiles
  ])

  const fileList = useMemo(() => Object.keys(userFiles), [userFiles])
  const activeProjectFile = useMemo(
    () => projectFiles.find(f => f.path === activeFile) || null,
    [projectFiles, activeFile]
  )
  const explorerTabPaths = useMemo(
    () => (projectFiles.length > 0 ? projectFiles.map(f => f.path) : fileList),
    [projectFiles, fileList]
  )
  const isLastModule = activeModuleIndex >= activeModules.length - 1
  const totalHints = activeModuleContent?.hints?.length || 0
  const visibleHints = activeModuleContent?.hints?.slice(0, hintsUsed) || []

  // Current Page stats (for Page Complete)
  const pageProgressEntries = useMemo(
    () =>
      activeModules
        .map(m => getModuleProgress(m.id))
        .filter((p): p is LearnerProgress => Boolean(p)),
    [activeModules, getModuleProgress]
  )
  const pageHintsUsedTotal = useMemo(
    () => pageProgressEntries.reduce((sum, p) => sum + (p.hintsUsed || 0), 0),
    [pageProgressEntries]
  )
  const pageSolutionsViewedTotal = useMemo(
    () => pageProgressEntries.filter(p => p.usedSolution || p.completedWithSolution).length,
    [pageProgressEntries]
  )
  const pageTimeSpentLabel = useMemo(
    () => formatDurationFromProgress(pageProgressEntries),
    [pageProgressEntries]
  )

  // Project-wide stats across ALL pages (for Project Complete)
  const allProjectModules = useMemo(
    () => pages.flatMap(pg => pg.modules || []),
    [pages]
  )
  const allProjectProgressEntries = useMemo(
    () =>
      allProjectModules
        .map(m => allModulesProgressMap[m.id] || getModuleProgress(m.id))
        .filter((p): p is LearnerProgress => Boolean(p)),
    [allProjectModules, allModulesProgressMap, getModuleProgress]
  )
  const totalProjectHints = useMemo(
    () => allProjectProgressEntries.reduce((sum, p) => sum + (p.hintsUsed || 0), 0),
    [allProjectProgressEntries]
  )
  const totalProjectSolutions = useMemo(
    () => allProjectProgressEntries.filter(p => p.usedSolution || p.completedWithSolution).length,
    [allProjectProgressEntries]
  )
  const totalProjectTimeLabel = useMemo(
    () => formatDurationFromProgress(allProjectProgressEntries),
    [allProjectProgressEntries]
  )

  // ===========================================================================
  // VIEW 1B: PROJECT COMPLETE SUMMARY VIEW (Slice 5)
  // ===========================================================================
  if (isProjectCompleteView) {
    const completedModCount = allProjectModules.filter(m => m.status === 'done' || Boolean(allModulesProgressMap[m.id]?.passed)).length

    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#0A0A0F] p-6 md:p-8 pb-16">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          {/* Congratulation Banner */}
          <div className="p-6 rounded-2xl border border-[#00F0FF]/40 bg-gradient-to-r from-[#091824] via-[#0E1324] to-[#170D28] flex flex-wrap items-center justify-between gap-4 shadow-2xl">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
                <Trophy className="w-3.5 h-3.5" /> PROJECT COMPLETE
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-display">
                Congratulations! {activeSpec?.appName || 'Your Application'} Is Complete
              </h1>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {activeSpec?.summary || 'All planned pages and component modules have been built, verified, and packaged.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={downloadProjectZip}
                className="cyber-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer border-[#00F0FF]/50 text-[#00F0FF]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download project (.zip)</span>
              </button>

              <button
                onClick={() => setScreen(6)}
                className="cyber-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>View Roadmap</span>
              </button>

              <button
                onClick={resetToNewProject}
                className="cyber-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Start a new project</span>
              </button>
            </div>
          </div>

          {/* Project-Wide Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Pages Built</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{Math.max(1, pages.length)}</div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Modules Done</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {completedModCount}/{allProjectModules.length}
              </div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Hints Used</div>
              <div className="text-xl font-bold text-amber-300 font-mono mt-1">{totalProjectHints}</div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Solutions Viewed</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-1">{totalProjectSolutions}</div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl col-span-2 sm:col-span-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00F0FF]" /> Time Spent
              </div>
              <div className="text-xl font-bold text-[#00F0FF] font-mono mt-1">{totalProjectTimeLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Built Pages & Artifacts */}
            <div className="lg:col-span-5 space-y-4">
              <div className="cyber-card p-5 bg-[#0D0D14] border-white/10 rounded-xl space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> Built Pages ({pages.length})
                </h2>
                <div className="space-y-2">
                  {pages.map((pg, idx) => (
                    <button
                      type="button"
                      key={pg.id}
                      onClick={() => handlePreviewSelectHtml(pg.fileName)}
                      className={`w-full text-left p-3 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                        previewTargetHtml === pg.fileName
                          ? 'bg-[#00F0FF]/10 border-[#00F0FF]/50 text-white'
                          : 'bg-black/40 border-white/5 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {idx + 1}. {pg.name}
                        </div>
                        <div className="text-[11px] font-mono text-cyan-300 truncate">{pg.fileName}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                        {(pg.modules || []).length} modules
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {projectMemory && projectMemory.fileTree.length > 0 && (
                <div className="cyber-card p-5 bg-[#0D0D14] border-white/10 rounded-xl space-y-2.5">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Project Files ({projectMemory.fileTree.length})
                  </h2>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {projectMemory.fileTree.map(fp => (
                      <span key={fp} className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-slate-300">
                        {fp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full-Site Multi-Page Preview */}
            <div className="lg:col-span-7 cyber-card border-white/10 bg-[#0D0D14] rounded-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-4 py-2.5 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {previewNavHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePreviewBack}
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Eye className="w-3.5 h-3.5" /> Multi-Page Preview: <strong className="text-white">{previewTargetHtml}</strong>
                  </span>
                </div>

                {availableHtmlFiles.length > 1 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {availableHtmlFiles.map(hf => (
                      <button
                        type="button"
                        key={hf}
                        onClick={() => handlePreviewSelectHtml(hf)}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer border ${
                          previewTargetHtml === hf
                            ? 'bg-[#00F0FF]/20 border-[#00F0FF]/60 text-[#00F0FF]'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {hf}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {previewNavNotice && (
                <div className="px-4 py-1.5 bg-amber-950/50 border-b border-amber-500/30 text-amber-200 text-[11px] font-mono">
                  {previewNavNotice}
                </div>
              )}
              <iframe
                ref={summaryIframeRef}
                title="Complete Project Multi-Page Preview"
                sandbox="allow-scripts"
                srcDoc={summarySrcDoc}
                className="flex-1 w-full bg-white border-0 min-h-[440px]"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===========================================================================
  // VIEW 1A: PAGE COMPLETE SUMMARY VIEW (Slice 4 + Slice 5)
  // ===========================================================================
  if (isPageCompleteView && currentPage) {
    const doneModulesCount = activeModules.filter(m => m.status === 'done').length
    const isCurated = activeProjectSource === 'curated'

    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#0A0A0F] p-6 md:p-8 pb-16">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          {/* Banner */}
          <div className="p-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-[#0E151B] to-[#110D1B] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
                <Trophy className="w-3.5 h-3.5" /> PAGE COMPLETE
              </div>
              <h1 className="text-2xl font-bold text-white font-display">
                {currentPage.name} ({currentPage.fileName}) Built &amp; Verified
              </h1>
              <p className="text-xs text-slate-300 max-w-2xl">
                {currentPage.purpose || currentPage.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setIsPageCompleteView(false)
                  setScreen(3)
                }}
                className="cyber-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Overview</span>
              </button>

              <button
                onClick={downloadProjectZip}
                className="cyber-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer border-[#00F0FF]/40 text-[#00F0FF]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download project (.zip)</span>
              </button>

              {!isCurated && (
                <button
                  onClick={() => generateNextPage(false)}
                  disabled={isGeneratingNextPage}
                  className="cyber-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isGeneratingNextPage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating next page...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      <span>Generate next page</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Next-Page Error Alert with Retry */}
          {nextPageError && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{nextPageError}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearNextPageError}
                  className="px-2.5 py-1 rounded border border-white/15 text-slate-300 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => generateNextPage(true)}
                  disabled={isGeneratingNextPage}
                  className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Page Metrics Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Modules Done</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {doneModulesCount}/{activeModules.length}
              </div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Hints Used</div>
              <div className="text-xl font-bold text-amber-300 font-mono mt-1">{pageHintsUsedTotal}</div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Solutions Viewed</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-1">{pageSolutionsViewedTotal}</div>
            </div>
            <div className="cyber-card p-4 bg-[#0D0D14] border-white/10 rounded-xl">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00F0FF]" /> Time Spent
              </div>
              <div className="text-xl font-bold text-[#00F0FF] font-mono mt-1">{pageTimeSpentLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Summary Stats & Decisions */}
            <div className="lg:col-span-5 space-y-4">
              <div className="cyber-card p-5 bg-[#0D0D14] border-white/10 rounded-xl space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#00F0FF]" /> Modules Completed ({doneModulesCount}/{activeModules.length})
                </h2>
                <div className="space-y-2">
                  {activeModules.map((mod, idx) => {
                    const prog = getModuleProgress(mod.id)
                    const withSol = Boolean(prog?.completedWithSolution || prog?.usedSolution)
                    return (
                      <div key={mod.id} className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${withSol ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span className="text-white truncate">{idx + 1}. {mod.title}</span>
                        </div>
                        <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                          withSol ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                        }`}>
                          {withSol ? 'Solution' : `${prog?.attempts || 1} tries`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {projectMemory && projectMemory.decisionsMade.length > 0 && (
                <div className="cyber-card p-5 bg-[#0D0D14] border-white/10 rounded-xl space-y-2.5">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    ProjectMemory Architectural Log
                  </h2>
                  <ul className="space-y-1.5 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto pr-1">
                    {projectMemory.decisionsMade.map((dec, idx) => (
                      <li key={idx} className="p-2 rounded bg-black/40 border border-white/5 leading-relaxed">
                        {dec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Live Preview of Finished Page (with Multi-Page Navigation) */}
            <div className="lg:col-span-7 cyber-card border-white/10 bg-[#0D0D14] rounded-xl overflow-hidden flex flex-col min-h-[480px]">
              <div className="px-4 py-2.5 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {previewNavHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePreviewBack}
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                  <span className="flex items-center gap-2 text-emerald-300">
                    <Eye className="w-3.5 h-3.5" /> Live Preview ({previewTargetHtml})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {availableHtmlFiles.length > 1 && availableHtmlFiles.map(hf => (
                    <button
                      type="button"
                      key={hf}
                      onClick={() => handlePreviewSelectHtml(hf)}
                      className={`px-2 py-0.5 rounded text-[10px] cursor-pointer border ${
                        previewTargetHtml === hf
                          ? 'bg-[#00F0FF]/20 border-[#00F0FF]/60 text-[#00F0FF]'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {hf}
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500">sandbox=&quot;allow-scripts&quot;</span>
                </div>
              </div>
              {previewNavNotice && (
                <div className="px-4 py-1.5 bg-amber-950/50 border-b border-amber-500/30 text-amber-200 text-[11px] font-mono">
                  {previewNavNotice}
                </div>
              )}
              <iframe
                ref={summaryIframeRef}
                title="Finished Page Live Preview"
                sandbox="allow-scripts"
                srcDoc={summarySrcDoc}
                className="flex-1 w-full bg-white border-0 min-h-[430px]"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===========================================================================
  // VIEW 2: LAZY MODULE CONTENT LOADING OR ERROR STATE (Requirement B)
  // ===========================================================================
  if (isLoadingModuleContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0A0A0F]">
        <div className="max-w-md w-full cyber-card p-6 bg-[#0E0E17] border-[#00F0FF]/40 rounded-xl space-y-4 font-mono">
          <div className="flex items-center gap-3 text-[#00F0FF]">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">Generating Module Content</span>
          </div>
          <h2 className="text-base font-bold text-white font-display">
            {activeModuleItem?.title || `Module ${activeModuleIndex + 1}`}
          </h2>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Synthesizing lesson, task, progressive hints, and DOM verification checks from your current project files, then validating in JSDOM...
          </p>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-[#00F0FF] animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (moduleContentError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0A0A0F]">
        <div className="max-w-lg w-full cyber-card p-6 bg-[#160B0F] border-rose-500/50 rounded-xl space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white font-display">Module Generation Failed</h2>
              <p className="text-[11px] font-mono text-rose-300/80">JSDOM_VERIFICATION_OR_LLM_ERROR</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-black/60 border border-rose-500/20 text-xs text-rose-200 font-mono leading-relaxed">
            {moduleContentError}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setScreen(3)}
              className="cyber-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to overview
            </button>
            <button
              onClick={() => retryLoadModuleContent()}
              className="cyber-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-500 border-rose-400 text-white font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Generation
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!activeModuleContent || !activeModuleItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0A0A0F] space-y-4">
        <p className="text-sm text-slate-400 font-mono">No active module selected.</p>
        <button
          onClick={() => setScreen(3)}
          className="cyber-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to overview
        </button>
      </div>
    )
  }

  // ===========================================================================
  // VIEW 3: FULL VS CODE-LIKE COURSE / IDE WORKSPACE (Requirements C, D, E, F)
  // ===========================================================================
  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0A0A0F] pb-7">
      {/* TOP BAR */}
      <div className="px-4 py-2 border-b border-white/10 bg-[#0D0D14] flex flex-wrap items-center justify-between gap-3 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              flushUserFilesSave()
              setScreen(3)
            }}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to overview</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-slate-400 truncate">
            <span className="text-white font-bold truncate max-w-[160px]">{activeSpec?.appName || 'Project'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#00F0FF] font-semibold truncate">
              M{activeModuleIndex + 1}/{activeModules.length}: {activeModuleItem.title}
            </span>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center gap-1.5" aria-label="Module progress">
          {activeModules.map((mod, idx) => {
            const st = getEffectiveModuleStatus(mod.id, idx)
            const openable = isModuleOpenable(idx)
            const isCurrent = idx === activeModuleIndex
            return (
              <button
                key={mod.id}
                disabled={!openable}
                onClick={() => openable && openModule(idx)}
                title={`Module ${idx + 1}: ${mod.title} (${st})`}
                className={`h-6 min-w-[24px] px-1.5 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'ring-2 ring-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                    : st === 'done'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer'
                    : st === 'active'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-pointer'
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                }`}
              >
                {st === 'locked' ? <Lock className="w-2.5 h-2.5" /> : idx + 1}
              </button>
            )
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] border ${
            useTailwind
              ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/30'
              : 'bg-white/5 text-slate-400 border-white/10'
          }`}>
            {useTailwind ? 'Tailwind' : 'Plain CSS'}
          </span>

          <button
            onClick={downloadProjectZip}
            title="Download current files as ZIP"
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN IDE 3-COLUMN GRID */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* LEFT COLUMN: FILE EXPLORER TREE */}
        <aside className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#09090F] flex flex-col justify-between shrink-0 min-h-0">
          <FileExplorer
            projectFiles={projectFiles}
            projectFolders={projectFolders}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            isReadOnly={isReadOnly}
            assetError={assetError}
            onClearError={clearAssetError}
            hasMissingProvidedAssets={hasMissingProvidedAssets}
            onRestoreProvidedAssets={restoreProvidedAssets}
            onCreateFile={path => createNewFile(path)}
            onCreateFolder={path => createNewFolder(path)}
            onUploadFiles={uploadProjectFiles}
            onRenameEntry={renameProjectEntry}
            onDeleteEntry={deleteProjectEntry}
          />

          {/* Reset to Starter */}
          <div className="p-3 border-t border-white/10 space-y-2 shrink-0">
            {!showResetConfirm ? (
              <button
                disabled={isReadOnly}
                onClick={() => setShowResetConfirm(true)}
                className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono flex items-center justify-center gap-1.5 transition-colors ${
                  isReadOnly
                    ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                    : 'bg-white/5 hover:bg-rose-500/15 border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 cursor-pointer'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to starter</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-2 text-[11px]">
                <p className="text-rose-200 font-sans">Reset current edits back to module starter files?</p>
                <div className="flex items-center gap-2 font-mono">
                  <button
                    onClick={() => {
                      resetToStarter()
                      setCheckResults(null)
                      setAllChecksPassed(false)
                      setShowResetConfirm(false)
                    }}
                    className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: MONACO EDITOR OR READ-ONLY ASSET VIEWER + ACTION TOOLBAR */}
        <section className="flex-1 flex flex-col min-w-0 min-h-[280px] border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0B0B11]">
          {/* Tabs + Action Buttons */}
          <div className="px-3 py-1.5 border-b border-white/10 bg-[#0D0D15] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {explorerTabPaths.map(filePath => (
                <button
                  key={filePath}
                  onClick={() => setActiveFile(filePath)}
                  className={`px-3 py-1 rounded-t text-xs font-mono flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
                    activeFile === filePath
                      ? 'bg-[#161622] text-white border-[#00F0FF]'
                      : 'text-slate-400 hover:text-slate-200 border-transparent'
                  }`}
                >
                  <Code2 className="w-3 h-3 text-[#00F0FF]" />
                  <span>{filePath}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={handleRunPreview}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-400 fill-current" />
                <span>Run</span>
              </button>

              <button
                onClick={handleCheckMyWork}
                disabled={isRunningChecks}
                className="cyber-btn-primary px-3.5 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isRunningChecks ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Check My Work</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Read-only banner for already-completed modules */}
          {isReadOnly && (
            <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
              <span className="text-emerald-300 font-mono">
                Completed module — viewing in read-only mode
              </span>
              <div className="flex items-center gap-2">
                {currentPage?.status === 'done' && (
                  <button
                    onClick={finishActivePage}
                    className="px-2.5 py-1 rounded bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/40 text-[#00F0FF] font-mono text-[11px] cursor-pointer"
                  >
                    {activeProjectSource === 'curated' ? 'Project Complete Summary' : 'Page Complete Summary'}
                  </button>
                )}
                <button
                  onClick={enableModuleRedo}
                  className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-mono text-[11px] cursor-pointer"
                >
                  Redo
                </button>
              </div>
            </div>
          )}

          {/* Monaco Code Editor OR Read-Only Asset Viewer */}
          <div className="flex-1 min-h-0">
            {activeProjectFile?.kind === 'binary' ? (
              <AssetViewer
                file={activeProjectFile}
                dataUrl={assetUrlMap[activeProjectFile.path]}
              />
            ) : !activeFile ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                Select or create a file in the Explorer to begin.
              </div>
            ) : (
              <Editor
                height="100%"
                theme="vs-dark"
                loading={
                  <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400 bg-[#0B0B11]">
                    Initializing Monaco Editor...
                  </div>
                }
                path={activeFile}
                language={getMonacoLanguage(activeFile)}
                value={userFiles[activeFile] ?? ''}
                onChange={(val) => {
                  if (!isReadOnly) {
                    updateUserFile(activeFile, val ?? '')
                  }
                }}
                options={{
                  readOnly: isReadOnly,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineHeight: 20,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                  scrollBeyondLastLine: false,
                  padding: { top: 10, bottom: 10 }
                }}
              />
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: LESSON/TASK/HINTS + SANDBOX PREVIEW + RESULTS */}
        <section className="w-full lg:w-[46%] flex flex-col min-w-0 min-h-0 bg-[#0A0A10]">
          {/* TOP HALF: LESSON | TASK | HINTS */}
          <div className="flex-1 min-h-[200px] max-h-[42%] flex flex-col border-b border-white/10">
            <div className="px-3 py-1.5 border-b border-white/10 bg-[#0D0D14] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  onClick={() => setRightInfoTab('lesson')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    rightInfoTab === 'lesson' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Lesson</span>
                </button>
                <button
                  onClick={() => setRightInfoTab('task')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    rightInfoTab === 'task' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Task</span>
                </button>
                <button
                  onClick={() => setRightInfoTab('hints')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer ${
                    rightInfoTab === 'hints' ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Hints ({hintsUsed}/{totalHints})</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setRightInfoTab('hints')
                  if (hintsUsed < totalHints) revealNextHint()
                }}
                className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
              >
                <Lightbulb className="w-3 h-3" />
                <span>Get Hint</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {rightInfoTab === 'lesson' && (
                <SimpleMarkdown content={activeModuleContent.lesson} />
              )}

              {rightInfoTab === 'task' && (
                <div className="space-y-4">
                  {/* Requirements Section (above Task prose) */}
                  {activeModuleContent.requirements && activeModuleContent.requirements.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#00F0FF]/5 border border-[#00F0FF]/25 space-y-1.5">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00F0FF]">
                        Requirements
                      </div>
                      <ul className="space-y-1 text-xs text-slate-200">
                        {activeModuleContent.requirements.map((req, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#00F0FF] font-mono shrink-0">•</span>
                            <span className="leading-relaxed">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <SimpleMarkdown content={activeModuleContent.task} />

                  {/* Expected Result Section */}
                  {activeModuleContent.expectedResult && (
                    <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/25 space-y-1">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                        Expected Result
                      </div>
                      <p className="text-xs text-emerald-100/90 leading-relaxed">
                        {activeModuleContent.expectedResult}
                      </p>
                    </div>
                  )}

                  {/* Verified Documentation References */}
                  {activeModuleContent.references && activeModuleContent.references.length > 0 && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                        References
                      </div>
                      <ul className="space-y-2 text-xs">
                        {activeModuleContent.references.map((ref, idx) => (
                          <li key={idx} className="space-y-0.5">
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[#00F0FF] hover:underline font-medium"
                            >
                              <span>{ref.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            {ref.note && (
                              <p className="text-[11px] text-slate-400 leading-snug">{ref.note}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Verification Checklist ({activeModuleContent.checks.length})
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {activeModuleContent.checks.map(chk => (
                        <li key={chk.id} className="flex items-start gap-2">
                          <span className="text-[#00F0FF] font-mono">•</span>
                          <span>{chk.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {rightInfoTab === 'hints' && (
                <div className="space-y-3">
                  {visibleHints.length === 0 ? (
                    <div className="p-4 rounded-lg bg-black/40 border border-white/10 text-xs text-slate-400 space-y-2">
                      <p>Hints are revealed progressively one at a time so you retain problem-solving mastery.</p>
                      <button
                        onClick={() => revealNextHint()}
                        className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Reveal Hint 1 of {totalHints}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {visibleHints.map((hint, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/30 space-y-1">
                          <div className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                            Hint {idx + 1} of {totalHints}
                          </div>
                          <SimpleMarkdown content={hint} />
                        </div>
                      ))}
                      {hintsUsed < totalHints && (
                        <button
                          onClick={() => revealNextHint()}
                          className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Reveal Hint {hintsUsed + 1} of {totalHints}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE: LIVE SANDBOXED IFRAME PREVIEW */}
          <div className="flex-1 min-h-[190px] flex flex-col border-b border-white/10">
            <div className="px-3 py-1 border-b border-white/10 bg-[#0D0D14] flex items-center justify-between text-[11px] font-mono shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {previewNavHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePreviewBack}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[10px] cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                )}
                <span className="flex items-center gap-1.5 text-slate-300 truncate">
                  <Eye className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" /> Live Preview ({previewTargetHtml})
                </span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">sandbox=&quot;allow-scripts&quot; (isolated)</span>
            </div>
            {previewNavNotice && (
              <div className="px-3 py-1 bg-amber-950/60 border-b border-amber-500/30 text-amber-200 text-[10px] font-mono shrink-0">
                {previewNavNotice}
              </div>
            )}
            <iframe
              key={previewKey}
              ref={iframeRef}
              title="Module Live Preview Sandbox"
              sandbox="allow-scripts"
              srcDoc={previewHtml}
              className="flex-1 w-full bg-white border-0"
            />
          </div>

          {/* BOTTOM: RESULTS PANEL & CONSOLE */}
          <div className="h-[30%] min-h-[165px] flex flex-col bg-[#08080D] shrink-0">
            <div className="px-3 py-1.5 border-b border-white/10 bg-[#0D0D14] flex items-center justify-between shrink-0 font-mono text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBottomPanelTab('checks')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer ${
                    bottomPanelTab === 'checks' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    Results
                    {checkResults
                      ? ` (${checkResults.filter(r => r.passed).length}/${checkResults.length})`
                      : ''}
                  </span>
                </button>
                <button
                  onClick={() => setBottomPanelTab('console')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer ${
                    bottomPanelTab === 'console' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Console ({consoleLogs.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {attempts > 0 && (
                  <span className="text-[10px] text-slate-500">
                    Attempts: {attempts}
                  </span>
                )}
                {bottomPanelTab === 'console' && consoleLogs.length > 0 && (
                  <button
                    onClick={() => setConsoleLogs([])}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
              {missingAssetWarnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 font-mono text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Missing Asset Console Warnings</span>
                  </div>
                  {missingAssetWarnings.map((warn, idx) => (
                    <div key={idx} className="pl-5">• {warn}</div>
                  ))}
                </div>
              )}
              {bottomPanelTab === 'checks' ? (
                !checkResults ? (
                  <div className="text-slate-500 font-mono text-[11px] py-4 text-center">
                    Click &quot;Check My Work&quot; to run automated DOM checks inside the sandboxed preview.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Pass CTA Banner */}
                    {allChecksPassed && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>All checks passed! Module complete.</span>
                        </div>
                        {isLastModule ? (
                          <button
                            onClick={finishActivePage}
                            className="cyber-btn-primary px-3 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white"
                          >
                            <span>Finish page</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openModule(activeModuleIndex + 1)}
                            className="cyber-btn-primary px-3 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Next module</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Check Result Items */}
                    {activeModuleContent.checks.map(chk => {
                      const res = checkResults.find(r => r.id === chk.id)
                      const passed = Boolean(res?.passed)
                      return (
                        <div
                          key={chk.id}
                          className={`p-2.5 rounded-lg border space-y-1 ${
                            passed
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-rose-950/25 border-rose-500/35'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className={`font-medium ${passed ? 'text-emerald-200' : 'text-rose-200'}`}>
                                {chk.description}
                              </div>
                              {!passed && res?.message && (
                                <p className="text-[11px] font-mono text-rose-300/90 mt-0.5">
                                  {res.message}
                                </p>
                              )}
                              {!passed && chk.requirementRef && (
                                <p className="text-[11px] text-[#00F0FF]/90 font-mono mt-0.5">
                                  Requirement: {chk.requirementRef}
                                </p>
                              )}
                              {!passed && (
                                <p className="text-[11px] text-amber-200/90 mt-1 flex items-start gap-1.5">
                                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{getDeterministicCheckGuidance(chk)}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Failure Action Bar: Explain My Errors + Show Solution after >= 3 attempts */}
                    {!allChecksPassed && (
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={handleExplainErrors}
                          disabled={isReviewingErrors}
                          className="px-3 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isReviewingErrors ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Analyzing errors...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Explain my errors</span>
                            </>
                          )}
                        </button>

                        {attempts >= 3 && effectiveStatus !== 'done' ? (
                          <button
                            onClick={handleRevealSolution}
                            className="px-3 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Show solution</span>
                          </button>
                        ) : effectiveStatus !== 'done' ? (
                          <span className="text-[10px] font-mono text-slate-500">
                            Solution unlocks after 3 failed attempts ({attempts}/3)
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Manual Socratic LLM Review Output */}
                    {reviewError && (
                      <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[11px] font-mono">
                        {reviewError}
                      </div>
                    )}

                    {submissionReview && (
                      <div className="p-3 rounded-lg bg-cyan-950/25 border border-cyan-500/35 space-y-2">
                        <div className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI Error Guidance
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{submissionReview.feedback}</p>
                        {submissionReview.suggestions.length > 0 && (
                          <ul className="list-disc pl-4 space-y-1 text-[11px] text-cyan-100/90">
                            {submissionReview.suggestions.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : consoleLogs.length === 0 ? (
                <div className="text-slate-500 font-mono text-[11px] py-4 text-center">
                  No console messages yet. console.log() and runtime errors from the preview appear here.
                </div>
              ) : (
                <div className="space-y-1 font-mono text-[11px]">
                  {consoleLogs.map(entry => (
                    <div
                      key={entry.id}
                      className={`px-2 py-1 rounded border flex items-start gap-2 ${
                        entry.level === 'error'
                          ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                          : entry.level === 'warn'
                          ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                          : 'bg-white/5 border-white/5 text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500 shrink-0">[{entry.timestamp}]</span>
                      <span className="uppercase font-bold shrink-0">{entry.level}:</span>
                      <span className="break-all">{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* READ-ONLY SOLUTION MODAL (Only reachable after >= 3 failed attempts) */}
      {showSolutionModal && activeModuleContent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0D0D15] border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-[#14111A]">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Module Reference Solution (Read-Only)</span>
                </h3>
                <p className="text-[11px] font-mono text-amber-300/90">
                  Marked completedWithSolution — next module is now unlocked.
                </p>
              </div>
              <button
                onClick={() => setShowSolutionModal(false)}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-white/10 bg-black/40 flex items-center gap-2 font-mono text-xs overflow-x-auto">
              {activeModuleContent.solutionFiles.map(sf => (
                <button
                  key={sf.path}
                  onClick={() => setSolutionTabFile(sf.path)}
                  className={`px-3 py-1 rounded cursor-pointer ${
                    solutionTabFile === sf.path
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sf.path}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 bg-[#07070B]">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                {activeModuleContent.solutionFiles.find(sf => sf.path === solutionTabFile)?.content || ''}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-white/10 bg-[#0D0D15] flex items-center justify-between">
              <button
                onClick={() => setShowSolutionModal(false)}
                className="cyber-btn-secondary px-4 py-1.5 text-xs cursor-pointer"
              >
                Close
              </button>
              {isLastModule ? (
                <button
                  onClick={() => {
                    setShowSolutionModal(false)
                    finishActivePage()
                  }}
                  className="cyber-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Finish page</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowSolutionModal(false)
                    openModule(activeModuleIndex + 1)
                  }}
                  className="cyber-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Next Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
