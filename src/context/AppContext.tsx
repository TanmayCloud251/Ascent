import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import {
  ScreenIndex,
  Project as LegacyProject,
  PlannedPage,
  LearningModule,
  LearnerProfile,
  CalibrationTier
} from '../types'
import {
  UserProfile,
  ProjectSpec,
  TechStackConfig,
  Project as AscentProject,
  PageItem,
  PageModuleItem,
  ProjectMemory
} from '../types/ascent'
import {
  Check,
  CheckResult,
  CuratedAsset,
  LearnerProgress,
  ModuleContent,
  ProjectFile,
  ReviewSubmissionResponse
} from '../schemas/course'
import { storageService, blobToDataUrl } from '../services/storageService'
import {
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_PROJECT_BYTES,
  computeTotalProjectBytes,
  formatBytes,
  getTextByteSize,
  inferMimeType,
  isAudioMime,
  isFontMime,
  isImageMime,
  isTextCodePath,
  projectFilesToTextMap,
  sanitizeProjectPath,
  textMapToProjectFiles
} from '../services/fileUtils'
import { llmService } from '../services/llmService'
import {
  CodeEvaluationResult,
  ThinkingPlan
} from '../services/curriculumGenerator'
import {
  computeDeterministicMemoryDiff,
  mergeModuleStarterFiles
} from '../services/workspaceHelpers'
import {
  computeProfileStats,
  ProfileStats,
  StreakMetrics
} from '../utils/learnerStats'
import curatedIndex from '../data/curated/index.json'
import currencyConverterCourse from '../data/curated/currency-converter.json'
import rockPaperScissorsCourse from '../data/curated/rock-paper-scissors.json'
import ticTacToeCourse from '../data/curated/tic-tac-toe.json'
import loginGreetingCourse from '../data/curated/login-greeting.json'

export const DEFAULT_STARTER_PROMPT =
  'A simple login form where the user enters a username and clicks a button to be greeted by name'

export function normalizePromptText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

const CURATED_COURSES: Record<string, any> = {
  'currency-converter': currencyConverterCourse,
  'rock-paper-scissors': rockPaperScissorsCourse,
  'tic-tac-toe': ticTacToeCourse,
  'login-greeting': loginGreetingCourse
}

export type SpecGenerationStage = 'idle' | 'analyzing' | 'synthesizing' | 'validating' | 'done' | 'error'

const EMPTY_MODULE: LearningModule = {
  id: 'mod_placeholder',
  componentId: 'comp_root',
  title: 'Workspace Initializing',
  theoryMarkdown: 'Complete Screen 1 and Screen 2 to synthesize your custom project curriculum with Gemini.',
  initialFiles: {
    'src/App.jsx': '// Complete project specification on Screen 1 & 2 to generate your starter files\nexport default function App() {\n  return <div className="p-8 text-white">Project Initializing...</div>\n}\n'
  },
  coreInterfaces: [],
  targetMinutes: 15,
  hints: [],
  testCases: [],
  tasks: [],
  status: 'locked'
}

interface AppContextType {
  // Screen & Navigation
  currentScreen: ScreenIndex
  setScreen: (screen: ScreenIndex) => void

  // User Profile Session
  currentUser: UserProfile
  updateCurrentUser: (updates: Partial<UserProfile>) => void
  learnerProfile: LearnerProfile
  setCalibrationTier: (tier: CalibrationTier) => void

  // Slice 1: Spec Generation & Real AI Pipeline
  activeSpec: ProjectSpec | null
  activePrompt: string
  setActivePrompt: (prompt: string) => void
  useTailwind: boolean
  setUseTailwind: (val: boolean) => void
  isTailwindLocked: boolean
  specStage: SpecGenerationStage
  specError: string | null
  isGeneratingSpec: boolean
  lastGenerationFromCache: boolean
  generateProjectSpec: (prompt: string, techStack?: Partial<TechStackConfig>, forceRefresh?: boolean) => Promise<void>
  retryGenerateSpec: () => Promise<void>
  updateProjectSpec: (spec: ProjectSpec) => void
  confirmProjectSpec: () => Promise<void>
  clearSpecError: () => void
  curatedCoursesList: Array<{
    slug: string
    title: string
    shortDescription: string
    difficulty: string
    estimatedHours: number
  }>
  loadCuratedProject: (slug: string) => Promise<void>

  // Slice 2 Revised: Page + Component Syllabus
  currentPage: PageItem | null
  pages: PageItem[]
  activeModules: PageModuleItem[]
  currentScreenIndex: number
  selectActiveScreen: (index: number) => Promise<void>
  projectMemory: ProjectMemory | null
  isGeneratingPlan: boolean
  planStage: 'idle' | 'page' | 'done' | 'error'
  planError: string | null

  // Projects State
  activeProjectId: string | null
  storedProjects: AscentProject[]
  allUserProgressByKey: Record<string, LearnerProgress>
  streakMetrics: StreakMetrics
  profileStats: ProfileStats
  refreshStatsFromStorage: () => void
  projects: LegacyProject[]
  activeProject: LegacyProject | null
  selectProject: (id: string) => void
  deleteProject: (id: string) => void
  openProjectModule: (projectId: string, pageIndex: number, moduleIndex: number) => Promise<void>
  createNewProject: (promptText: string, customStack?: string[]) => Promise<void>
  confirmScope: (screens: PlannedPage[]) => void
  addScreenToScope: (name: string, description: string) => void
  removeScreenFromScope: (id: string) => void

  // Workspace & IDE State
  activeModule: LearningModule
  activeComponentIndex: number
  setActiveComponentIndex: (index: number) => void
  activeFile: string
  setActiveFile: (file: string) => void
  codeFiles: Record<string, string>
  updateFileCode: (filePath: string, newCode: string) => void
  runTestCases: () => void
  isTestRunning: boolean
  testStatus: 'not_run' | 'running' | 'pass' | 'fail'
  evaluationResult: CodeEvaluationResult | null
  unlockHint: (hintId: string) => void
  isThinking: boolean
  skipThinking: () => void
  thinkingPlan: ThinkingPlan | null
  downloadProjectZip: () => Promise<void>
  connectGithub: (username: string) => void
  syncToGithub: () => Promise<boolean>
  isSyncingGithub: boolean
  loadPresetProject: (key: 'ecommerce' | 'dashboard' | 'taskmanager' | 'portfolio') => void
  advanceToNextComponent: () => void
  restoreStarterCode: () => void

  // Slices 3 + 4 + File/Asset Management: IDE Workspace, Validation, Progress & Unlock Logic
  activeModuleIndex: number
  activeModuleItem: PageModuleItem | null
  activeModuleContent: ModuleContent | null
  isLoadingModuleContent: boolean
  moduleContentError: string | null
  userFiles: Record<string, string>
  projectFiles: ProjectFile[]
  projectFolders: string[]
  assetUrlMap: Record<string, string>
  assetError: string | null
  clearAssetError: () => void
  hasMissingProvidedAssets: boolean
  moduleProgressMap: Record<string, LearnerProgress>
  allModulesProgressMap: Record<string, LearnerProgress>
  isModuleRedoMode: boolean
  isPageCompleteView: boolean
  setIsPageCompleteView: (val: boolean) => void
  isProjectCompleteView: boolean
  setIsProjectCompleteView: (val: boolean) => void
  finishActivePage: () => void
  isGeneratingNextPage: boolean
  nextPageError: string | null
  clearNextPageError: () => void
  generateNextPage: (forceRefresh?: boolean) => Promise<void>
  resetToNewProject: () => void
  activeProjectSource: 'curated' | 'generated'
  getModuleProgress: (moduleId: string) => LearnerProgress | null
  getEffectiveModuleStatus: (moduleId: string, fallbackIndex: number) => 'done' | 'active' | 'locked'
  isModuleOpenable: (index: number) => boolean
  openModule: (index: number, options?: { navigate?: boolean; forceRefresh?: boolean }) => Promise<void>
  retryLoadModuleContent: () => Promise<void>
  updateUserFile: (filePath: string, content: string) => void
  flushUserFilesSave: () => void
  resetToStarter: () => void
  createNewFile: (rawPath: string, initialContent?: string) => boolean
  createNewFolder: (rawPath: string) => boolean
  uploadProjectFiles: (
    items: FileList | File[] | Array<{ file: File; targetFolder?: string }>
  ) => Promise<{ added: string[]; errors: string[] }>
  renameProjectEntry: (oldPath: string, newPathInput: string, isFolder?: boolean) => Promise<boolean>
  deleteProjectEntry: (targetPath: string, isFolder?: boolean) => Promise<void>
  restoreProvidedAssets: () => Promise<void>
  revealNextHint: () => number
  recordFailedCheckAttempt: () => LearnerProgress | null
  completeActiveModule: (options?: { usedSolution?: boolean }) => void
  requestSubmissionReview: (failedChecks: Array<{ check: Check; result: CheckResult }>) => Promise<ReviewSubmissionResponse>
  enableModuleRedo: () => void
}

const ACTIVE_SCREEN_KEY = 'ascent_v2:active_screen'
const activeModuleStorageKey = (projectId: string) => `ascent_v2:active_module_id:${projectId}`
const completionViewStorageKey = (projectId: string) => `ascent_v2:completion_view:${projectId}`
export const scopedModuleKey = (projectId: string, moduleId: string) => `${projectId}__${moduleId}`

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => storageService.getCurrentUser())
  const [currentScreen, setCurrentScreenState] = useState<ScreenIndex>(() => {
    try {
      const saved = window.localStorage.getItem(ACTIVE_SCREEN_KEY)
      const parsed = saved ? Number(saved) : 1
      if (parsed >= 1 && parsed <= 6) return parsed as ScreenIndex
    } catch {
      // ignore storage errors
    }
    return 1
  })

  const setCurrentScreen = useCallback((screen: ScreenIndex) => {
    setCurrentScreenState(screen)
    try {
      window.localStorage.setItem(ACTIVE_SCREEN_KEY, String(screen))
    } catch {
      // ignore
    }
  }, [])

  // Slice 1 State: Real Spec Generation & Review (FIXED VANILLA STACK)
  const [activeSpec, setActiveSpec] = useState<ProjectSpec | null>(null)
  const [activePrompt, setActivePrompt] = useState<string>('')
  const [useTailwind, setUseTailwindState] = useState<boolean>(true)
  const [isTailwindLocked, setIsTailwindLocked] = useState<boolean>(false)

  const [activeStackConfig, setActiveStackConfig] = useState<TechStackConfig>({
    runtime: 'HTML + CSS + JavaScript',
    styling: 'Tailwind CSS',
    stateManagement: 'Browser In-Memory State / DOM',
    backendSim: 'In-Browser LocalStorage / IndexedDB',
    useTailwind: true
  })

  const setUseTailwind = useCallback((val: boolean) => {
    if (isTailwindLocked) return
    setUseTailwindState(val)
    setActiveStackConfig(prev => ({
      ...prev,
      useTailwind: val,
      styling: val ? 'Tailwind CSS' : 'Plain CSS'
    }))
  }, [isTailwindLocked])
  const [specStage, setSpecStage] = useState<SpecGenerationStage>('idle')
  const [specError, setSpecError] = useState<string | null>(null)
  const [lastGenerationFromCache, setLastGenerationFromCache] = useState<boolean>(false)

  // Real projects from StorageService — zero mock data
  const [projects, setProjects] = useState<LegacyProject[]>(() => {
    const raw = storageService.getProjects(currentUser.id)
    return raw.map(p => ({
      id: p.id,
      title: p.spec?.appName || 'Ascent Project',
      prompt: p.userPrompt,
      status: (p.status === 'spec_confirmed' ? 'active' : 'planning') as any,
      techStack: [p.spec?.techStack?.runtime || 'HTML + CSS + JavaScript', p.spec?.techStack?.styling || 'Plain CSS'],
      plannedScreens: [],
      thinkingPlan: null as any,
      activePageId: 'page-1',
      activeModuleId: 'mod_1',
      totalScreens: p.spec?.primaryFeatures?.length || 1,
      completedScreens: 0,
      lastActiveFormatted: 'active just now',
      source: p.source || 'generated',
      curatedSlug: p.curatedSlug,
      createdAt: p.createdAt
    }))
  })

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    return storageService.getActiveProjectId()
  })
  const [statsVersion, setStatsVersion] = useState<number>(0)
  const refreshStatsFromStorage = useCallback(() => {
    setStatsVersion(v => v + 1)
  }, [])

  const [clarifyingQuestionAnswered, setClarifyingAnswered] = useState<boolean>(true)
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<'not_run' | 'running' | 'pass' | 'fail'>('not_run')
  const [evaluationResult, setEvaluationResult] = useState<CodeEvaluationResult | null>(null)
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [isSyncingGithub, setIsSyncingGithub] = useState<boolean>(false)

  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>({
    name: currentUser.name,
    email: `${currentUser.handle.replace('@', '')}@ascent.dev`,
    calibrationTier: (currentUser.tier === 'tier1' ? 'tier_1' : currentUser.tier === 'tier3' ? 'tier_3' : 'tier_2') as CalibrationTier,
    streakDays: currentUser.streakDays,
    activeProjectId: activeProjectId || undefined,
    githubUsername: currentUser.handle.replace('@', ''),
    isGithubConnected: true
  })

  const updateCurrentUser = useCallback((updates: Partial<UserProfile>) => {
    setCurrentUser(prev => {
      const updated = { ...prev, ...updates }
      storageService.saveCurrentUser(updated)
      return updated
    })
  }, [])

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || null
  const currentPlannedPage = activeProject?.plannedScreens?.[0]
  const availableComponents = currentPlannedPage?.components || []

  const [activeComponentIndex, setActiveComponentIndex] = useState<number>(0)
  const activeComponent = availableComponents[activeComponentIndex] || null

  const [activeModule, setActiveModule] = useState<LearningModule>(
    activeComponent?.module || EMPTY_MODULE
  )

  const initialFilesForMod = activeModule?.initialFiles || EMPTY_MODULE.initialFiles
  const defaultFile = Object.keys(initialFilesForMod)[0] || 'src/App.jsx'

  const [activeFile, setActiveFile] = useState<string>(defaultFile)
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>(initialFilesForMod)
  const [thinkingPlan, setThinkingPlan] = useState<ThinkingPlan | null>(null)

  // Restore active project spec from storage on mount if available
  useEffect(() => {
    const storedProjects = storageService.getProjects(currentUser.id)
    if (storedProjects.length > 0) {
      const activeStored = storedProjects.find(p => p.id === activeProjectId) || storedProjects[0]
      if (activeStored) {
        if (activeStored.spec) {
          setActiveSpec(activeStored.spec)
          const isTailwind = activeStored.useTailwind !== undefined
            ? activeStored.useTailwind
            : activeStored.spec.useTailwind !== undefined
            ? activeStored.spec.useTailwind
            : true
          setUseTailwindState(isTailwind)
          setActiveStackConfig({
            runtime: 'HTML + CSS + JavaScript',
            styling: isTailwind ? 'Tailwind CSS' : 'Plain CSS',
            stateManagement: 'Browser In-Memory State / DOM',
            backendSim: 'In-Browser LocalStorage / IndexedDB',
            useTailwind: isTailwind
          })
        }
        if (
          activeStored.source === 'curated' ||
          activeStored.status === 'spec_confirmed' ||
          activeStored.status === 'in_progress' ||
          activeStored.status === 'completed'
        ) {
          setIsTailwindLocked(true)
        } else {
          setIsTailwindLocked(false)
        }
        if (activeStored.curatedSlug === 'login-greeting') {
          setActivePrompt(DEFAULT_STARTER_PROMPT)
        } else if (activeStored.userPrompt) {
          setActivePrompt(activeStored.userPrompt)
        }
      }
    }
  }, [activeProjectId, currentUser.id])

  useEffect(() => {
    if (activeProjectId) {
      storageService.setActiveProjectId(activeProjectId)
    }
  }, [activeProjectId])

  // ==========================================================================
  // SLICE 1: REAL GEMINI SPECIFICATION GENERATION PIPELINE
  // ==========================================================================

  const loadCuratedProjectRef = useRef<((slug: string) => Promise<void>) | null>(null)

  const generateProjectSpec = useCallback(async (
    prompt: string,
    techStack?: Partial<TechStackConfig>,
    forceRefresh: boolean = false
  ) => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setSpecError('Please enter a project description or idea.')
      return
    }

    // Exact normalized match to the starter default prompt launches curated login-greeting
    if (
      !forceRefresh &&
      normalizePromptText(trimmed) === normalizePromptText(DEFAULT_STARTER_PROMPT) &&
      loadCuratedProjectRef.current
    ) {
      await loadCuratedProjectRef.current('login-greeting')
      return
    }

    setActivePrompt(trimmed)
    if (techStack) {
      setActiveStackConfig(prev => ({ ...prev, ...techStack }))
    }

    setSpecError(null)
    setSpecStage('analyzing')
    setCurrentScreen(2)

    try {
      setSpecStage('synthesizing')
      const targetTailwind = techStack?.useTailwind !== undefined ? techStack.useTailwind : useTailwind
      const result = await llmService.generateSpec({
        prompt: trimmed,
        useTailwind: targetTailwind,
        techStack: {
          runtime: 'HTML + CSS + JavaScript',
          styling: targetTailwind ? 'Tailwind CSS' : 'Plain CSS',
          stateManagement: 'Browser In-Memory State / DOM',
          backendSim: 'In-Browser LocalStorage / IndexedDB',
          useTailwind: targetTailwind
        },
        forceRefresh
      })

      setSpecStage('validating')
      setActiveSpec(result.spec)
      setLastGenerationFromCache(result.fromCache)
      setUseTailwindState(result.spec.useTailwind)

      const newProjectId = `proj_${Date.now()}`
      const newProject: AscentProject = {
        id: newProjectId,
        userId: currentUser.id,
        userPrompt: trimmed,
        spec: result.spec,
        useTailwind: result.spec.useTailwind,
        currentPageIndex: 0,
        pages: [],
        status: 'draft_spec',
        source: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      storageService.saveProject(newProject)
      storageService.setActiveProjectId(newProjectId)
      setActiveProjectId(newProjectId)

      setSpecStage('done')
    } catch (err: any) {
      console.error('Spec generation error:', err)
      const errorMsg = err.message || 'Failed to generate specification. Please check server logs.'
      setSpecError(errorMsg)
      setSpecStage('error')
    }
  }, [activeStackConfig, currentUser.id, useTailwind])

  const retryGenerateSpec = useCallback(async () => {
    if (activePrompt) {
      await generateProjectSpec(activePrompt, activeStackConfig, true)
    }
  }, [activePrompt, activeStackConfig, generateProjectSpec])

  const loadCuratedProject = useCallback(async (slug: string) => {
    const course = CURATED_COURSES[slug]
    if (!course) {
      setSpecError(`Curated course "${slug}" not found.`)
      return
    }

    const effectivePrompt =
      slug === 'login-greeting'
        ? DEFAULT_STARTER_PROMPT
        : `${course.title}: ${course.shortDescription}`

    setSpecError(null)
    setAssetError(null)
    // Curated projects strictly use plain CSS (no Tailwind) and are locked
    setUseTailwindState(false)
    setIsTailwindLocked(true)
    setActivePrompt(effectivePrompt)
    setActiveStackConfig({
      runtime: 'HTML + CSS + JavaScript',
      styling: 'Plain CSS',
      stateManagement: 'Browser In-Memory State / DOM',
      backendSim: 'In-Browser LocalStorage / IndexedDB',
      useTailwind: false
    })

    // Reset workspace state for clean project onboarding
    setActiveModuleContent(null)
    setModuleContentError(null)
    setModuleProgressMap({})
    setIsModuleRedoMode(false)
    setIsPageCompleteView(false)
    setProjectFiles([])
    setProjectFolders([])
    setAssetUrlMap({})
    setIsProjectCompleteViewState(false)
    setNextPageError(null)
    restoredWorkspaceForProjectRef.current = null

    // Staged telemetry transition: analyzing -> synthesizing -> validating -> done
    setSpecStage('analyzing')
    setCurrentScreen(2)

    // Record static trace immediately for telemetry inspector
    llmService.recordCuratedTrace(slug, course)

    const newProjectId = `proj_curated_${slug}_${Date.now()}`
    const courseAssets: CuratedAsset[] = Array.isArray(course.assets) ? course.assets : []

    // Fetch any curated assets in parallel with telemetry staging
    const assetFetchPromise = Promise.all(
      courseAssets.map(async (asset) => {
        const cleanPath = sanitizeProjectPath(asset.path)
        if (!cleanPath) return null
        try {
          const resp = await fetch(`/curated-assets/${slug}/${cleanPath}`)
          if (!resp.ok) return null
          const blob = await resp.blob()
          const mimeType = asset.mimeType || blob.type || inferMimeType(cleanPath)
          const assetRef = `${newProjectId}::provided::${cleanPath}`
          await storageService.saveAssetBlob({
            assetRef,
            projectId: newProjectId,
            path: cleanPath,
            mimeType,
            size: blob.size,
            blob
          })
          const dataUrl = await blobToDataUrl(blob, mimeType)
          return {
            descriptor: {
              path: cleanPath,
              assetRef,
              mimeType,
              size: blob.size,
              isProvided: true
            },
            dataUrl
          }
        } catch {
          return null
        }
      })
    )

    await new Promise(r => setTimeout(r, 700))
    setSpecStage('synthesizing')
    await new Promise(r => setTimeout(r, 900))
    setSpecStage('validating')
    await new Promise(r => setTimeout(r, 600))

    const fetchedAssets = (await assetFetchPromise).filter((x): x is NonNullable<typeof x> => Boolean(x))
    const memoryAssets = fetchedAssets.map(a => a.descriptor)
    const initialAssetUrls: Record<string, string> = {}
    const derivedFolders = new Set<string>()
    for (const item of fetchedAssets) {
      initialAssetUrls[item.descriptor.path] = item.dataUrl
      const parts = item.descriptor.path.split('/')
      for (let i = 1; i < parts.length; i++) {
        derivedFolders.add(parts.slice(0, i).join('/'))
      }
    }

    const pageItem: PageItem = {
      id: course.page?.id || `page_${slug}_1`,
      projectId: newProjectId,
      order: course.page?.order || 1,
      name: course.page?.name || course.title,
      description: course.page?.description || course.shortDescription,
      fileName: course.page?.fileName || 'index.html',
      purpose: course.page?.purpose || course.shortDescription,
      status: 'active',
      modules: (course.modules || []).map((m: any, idx: number) => ({
        id: m.id || `mod_${slug}_${idx + 1}`,
        pageId: course.page?.id || `page_${slug}_1`,
        order: m.order || (idx + 1),
        title: m.title,
        learningObjective: m.learningObjective || (m.task ? m.task.slice(0, 100) : 'Implement module specifications'),
        componentType: m.componentType || 'content-block',
        status: (idx === 0 ? 'active' : 'locked') as 'locked' | 'active' | 'done'
      }))
    }

    const newProject: AscentProject = {
      id: newProjectId,
      userId: currentUser.id,
      userPrompt: effectivePrompt,
      spec: course.spec,
      useTailwind: false,
      currentPageIndex: 0,
      pages: [pageItem],
      status: 'draft_spec',
      source: 'curated',
      curatedSlug: slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    storageService.saveProject(newProject)
    storageService.setActiveProjectId(newProjectId)
    setActiveProjectId(newProjectId)
    setActiveSpec(course.spec)
    setPages([pageItem])
    setCurrentPage(pageItem)
    setActiveModules(pageItem.modules)
    setCurrentScreenIndex(0)

    const initialFolders = Array.from(derivedFolders).sort()
    storageService.saveProjectFolders(newProjectId, initialFolders)
    setProjectFolders(initialFolders)
    setAssetUrlMap(initialAssetUrls)

    const initialFileTreePaths = Array.isArray(course.finalFiles) && course.finalFiles.length > 0
      ? course.finalFiles.map((f: any) => f.path).filter(Boolean)
      : [pageItem.fileName]
    const memory: ProjectMemory = {
      projectId: newProjectId,
      techStack: 'HTML + CSS + JavaScript (Plain CSS, semantic styles)',
      useTailwind: false,
      namingConventions: [
        'Single page vanilla web app',
        'Semantic HTML and pure CSS custom properties',
        'Modular vanilla JavaScript event handlers'
      ],
      fileTree: Array.from(new Set([...initialFileTreePaths, ...memoryAssets.map(a => a.path)])),
      decisionsMade: [...(course.spec?.assumptions || [])],
      completedFiles: {},
      completedPages: [],
      assets: memoryAssets
    }
    storageService.saveProjectMemory(memory)
    setProjectMemory(memory)

    // Update projects list for sidebar/history
    setProjects(prev => [
      {
        id: newProjectId,
        title: course.spec.appName,
        prompt: newProject.userPrompt,
        status: 'planning',
        techStack: ['HTML + CSS + JavaScript', 'Plain CSS'],
        plannedScreens: [],
        totalScreens: course.spec.primaryFeatures?.length || 1,
        completedScreens: 0,
        lastActiveFormatted: 'active just now',
        source: 'curated',
        curatedSlug: slug,
        createdAt: newProject.createdAt
      },
      ...prev.filter(p => p.id !== newProjectId)
    ])

    // Load initial code & binary assets for module 0 if present
    if (course.modules?.[0]?.starterFiles && course.modules[0].starterFiles.length > 0) {
      const initCode: Record<string, string> = {}
      for (const f of course.modules[0].starterFiles) {
        initCode[f.path] = f.content
      }
      const binaryProjectFiles: ProjectFile[] = memoryAssets.map(a => ({
        path: a.path,
        kind: 'binary',
        assetRef: a.assetRef,
        mimeType: a.mimeType,
        size: a.size,
        isProvided: a.isProvided
      }))
      const combined = textMapToProjectFiles(initCode, binaryProjectFiles)
      setProjectFiles(combined)
      setCodeFiles(initCode)
      setActiveFile(course.modules[0].starterFiles[0].path)
    }

    setSpecStage('done')
  }, [currentUser.id])

  useEffect(() => {
    loadCuratedProjectRef.current = loadCuratedProject
  }, [loadCuratedProject])

  // Slice 2 Revised: Page + Component Syllabus
  const [currentPage, setCurrentPage] = useState<PageItem | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [activeModules, setActiveModules] = useState<PageModuleItem[]>([])
  const [currentScreenIndex, setCurrentScreenIndex] = useState<number>(0)
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false)
  const [planStage, setPlanStage] = useState<'idle' | 'page' | 'done' | 'error'>('idle')
  const [planError, setPlanError] = useState<string | null>(null)

  // Slices 3 + 4 State: IDE Workspace, Validation, Progress & Unlock Logic
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0)
  const [activeModuleContent, setActiveModuleContent] = useState<ModuleContent | null>(null)
  const [isLoadingModuleContent, setIsLoadingModuleContent] = useState<boolean>(false)
  const [moduleContentError, setModuleContentError] = useState<string | null>(null)
  const [userFiles, setUserFiles] = useState<Record<string, string>>({})
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
  const [projectFolders, setProjectFolders] = useState<string[]>([])
  const [assetUrlMap, setAssetUrlMap] = useState<Record<string, string>>({})
  const [assetError, setAssetError] = useState<string | null>(null)
  const [moduleProgressMap, setModuleProgressMap] = useState<Record<string, LearnerProgress>>({})
  const [allModulesProgressMap, setAllModulesProgressMap] = useState<Record<string, LearnerProgress>>({})
  const [isModuleRedoMode, setIsModuleRedoMode] = useState<boolean>(false)
  const [isPageCompleteView, setIsPageCompleteViewState] = useState<boolean>(false)
  const [isProjectCompleteView, setIsProjectCompleteViewState] = useState<boolean>(false)
  const [isGeneratingNextPage, setIsGeneratingNextPage] = useState<boolean>(false)
  const [nextPageError, setNextPageError] = useState<string | null>(null)
  const [activeProjectSource, setActiveProjectSource] = useState<'curated' | 'generated'>('generated')

  const setIsPageCompleteView = useCallback((val: boolean) => {
    setIsPageCompleteViewState(val)
    if (val) setIsProjectCompleteViewState(false)
    if (activeProjectId) {
      try {
        window.localStorage.setItem(
          completionViewStorageKey(activeProjectId),
          val ? 'page' : 'none'
        )
      } catch {
        // ignore
      }
    }
  }, [activeProjectId])

  const setIsProjectCompleteView = useCallback((val: boolean) => {
    setIsProjectCompleteViewState(val)
    if (val) setIsPageCompleteViewState(false)
    if (activeProjectId) {
      try {
        window.localStorage.setItem(
          completionViewStorageKey(activeProjectId),
          val ? 'project' : 'none'
        )
      } catch {
        // ignore
      }
    }
  }, [activeProjectId])

  const clearNextPageError = useCallback(() => setNextPageError(null), [])
  const clearAssetError = useCallback(() => setAssetError(null), [])

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestFilesContextRef = useRef<{ projectId: string; moduleId: string; files: Record<string, string>; projectFiles?: ProjectFile[] } | null>(null)
  const effectiveStarterRef = useRef<Record<string, string>>({})
  const restoredWorkspaceForProjectRef = useRef<string | null>(null)

  const refreshProjectProgressMap = useCallback((projectId: string, modulesList: PageModuleItem[], allPagesList?: PageItem[]) => {
    const nextMap: Record<string, LearnerProgress> = {}
    for (const mod of modulesList) {
      const p = storageService.getLearnerProgress(currentUser.id, scopedModuleKey(projectId, mod.id))
      if (p) {
        nextMap[mod.id] = p
      }
    }
    setModuleProgressMap(nextMap)

    if (allPagesList) {
      const allMap: Record<string, LearnerProgress> = {}
      for (const pg of allPagesList) {
        for (const mod of pg.modules || []) {
          const p = storageService.getLearnerProgress(currentUser.id, scopedModuleKey(projectId, mod.id))
          if (p) {
            allMap[mod.id] = p
          }
        }
      }
      setAllModulesProgressMap(allMap)
    } else {
      setAllModulesProgressMap(prev => ({ ...prev, ...nextMap }))
    }
    return nextMap
  }, [currentUser.id])

  // Restore Slice 2 page, modules, memory, and progress map from storage on project load
  useEffect(() => {
    if (activeProjectId) {
      const stored = storageService.getProjectById(activeProjectId)
      if (stored) {
        setActiveProjectSource(stored.source === 'curated' ? 'curated' : 'generated')
        if (stored.pages && stored.pages.length > 0) {
          setPages(stored.pages)
          const activePg = stored.pages[stored.currentPageIndex || 0] || stored.pages[0]
          setCurrentPage(activePg)
          const mods = activePg.modules || []
          setActiveModules(mods)
          refreshProjectProgressMap(activeProjectId, mods, stored.pages)
        } else {
          setPages([])
          setCurrentPage(null)
          setActiveModules([])
          setModuleProgressMap({})
          setAllModulesProgressMap({})
        }
        if (stored.currentPageIndex !== undefined) {
          setCurrentScreenIndex(stored.currentPageIndex)
        }
        let savedCompletionView: string | null = null
        try {
          savedCompletionView = window.localStorage.getItem(completionViewStorageKey(activeProjectId))
        } catch {
          savedCompletionView = null
        }
        if (stored.status === 'completed' || savedCompletionView === 'project') {
          setIsProjectCompleteViewState(true)
          setIsPageCompleteViewState(false)
        } else if (savedCompletionView === 'page') {
          setIsPageCompleteViewState(true)
          setIsProjectCompleteViewState(false)
        } else {
          setIsPageCompleteViewState(false)
          setIsProjectCompleteViewState(false)
        }
      } else {
        setCurrentScreen(1)
      }
      const mem = storageService.getProjectMemory(activeProjectId)
      if (mem) {
        setProjectMemory(mem)
      }
      setProjectFolders(storageService.getProjectFolders(activeProjectId))
    } else if (currentScreen > 1 && currentScreen !== 5) {
      setCurrentScreen(1)
    }
  }, [activeProjectId, refreshProjectProgressMap, setCurrentScreen])

  const updateProjectSpec = useCallback((updated: ProjectSpec) => {
    setActiveSpec(updated)
    if (activeProjectId) {
      const stored = storageService.getProjectById(activeProjectId)
      if (stored) {
        stored.spec = updated
        storageService.saveProject(stored)
      }
    }
  }, [activeProjectId])

  // SLICE 2: Confirm Spec triggers Single Page + Component Syllabus Generation
  const confirmProjectSpec = useCallback(async () => {
    if (!activeSpec || !activeProjectId) return

    setPlanError(null)
    setIsGeneratingPlan(true)
    setPlanStage('page')
    setIsTailwindLocked(true) // LOCK TOGGLE AFTER CONFIRMATION
    setCurrentScreen(3) // Navigate to Screen 3 (Project Overview)

    try {
      // For curated projects: bypass LLM generation completely! Pre-built syllabus already loaded.
      const storedCurated = storageService.getProjectById(activeProjectId)
      if (storedCurated?.source === 'curated') {
        storedCurated.status = 'spec_confirmed'
        storageService.saveProject(storedCurated)
        setPlanStage('done')
        setIsGeneratingPlan(false)
        return
      }

      // 1. Initialize or load Project Memory
      let memory: ProjectMemory = storageService.getProjectMemory(activeProjectId) || {
        projectId: activeProjectId,
        techStack: `HTML + CSS + JavaScript (${activeSpec.useTailwind ? 'Tailwind CSS utilities' : 'Plain semantic CSS'})`,
        useTailwind: activeSpec.useTailwind,
        namingConventions: [
          'Single page at a time with dedicated progressive component modules',
          activeSpec.useTailwind
            ? 'Tailwind utility classes directly on HTML elements'
            : 'Semantic class names and CSS custom properties',
          'camelCase for vanilla JavaScript DOM behavior and localStorage persistence'
        ],
        fileTree: [],
        decisionsMade: [...activeSpec.assumptions],
        completedFiles: {}
      }
      storageService.saveProjectMemory(memory)
      setProjectMemory(memory)

      // 2. Call LLM to generate the SINGLE PAGE + Component Syllabus
      const pageResult = await llmService.generatePage({
        spec: activeSpec,
        useTailwind: activeSpec.useTailwind,
        projectMemory: memory
      })

      if (!pageResult.page) {
        throw new Error('LLM did not return a valid page blueprint.')
      }

      const generatedPage = pageResult.page
      setCurrentPage(generatedPage)
      setPages([generatedPage])
      setActiveModules(generatedPage.modules)
      setCurrentScreenIndex(0)
      setActiveProjectSource('generated')
      setNextPageError(null)

      // Update memory fileTree
      memory.fileTree = [generatedPage.fileName]
      memory.completedPages = []
      storageService.saveProjectMemory(memory)
      setProjectMemory({ ...memory })

      // 3. Persist to storage abstraction
      const stored = storageService.getProjectById(activeProjectId)
      if (stored) {
        stored.status = 'spec_confirmed'
        stored.spec = activeSpec
        stored.useTailwind = activeSpec.useTailwind
        stored.pages = [generatedPage]
        stored.currentPageIndex = 0
        storageService.saveProject(stored)
      }

      setPlanStage('done')
      setIsGeneratingPlan(false)
      setActiveModuleContent(null)
      setModuleProgressMap({})
      setAllModulesProgressMap({})
      setIsModuleRedoMode(false)
      setIsPageCompleteView(false)
      setIsProjectCompleteView(false)
      restoredWorkspaceForProjectRef.current = activeProjectId
    } catch (err: any) {
      const msg = err.message || 'Failed to generate page blueprint.'
      setPlanError(msg)
      setPlanStage('error')
      setIsGeneratingPlan(false)
    }
  }, [activeProjectId, activeSpec])

  const flushUserFilesSaveRef = useRef<(() => void) | null>(null)

  const selectActiveScreen = useCallback(async (index: number) => {
    if (!pages[index] || !activeProjectId) return
    flushUserFilesSaveRef.current?.()
    setCurrentScreenIndex(index)
    const targetPage = pages[index]
    setCurrentPage(targetPage)
    setActiveModules(targetPage.modules)
    refreshProjectProgressMap(activeProjectId, targetPage.modules, pages)
    setActiveModuleContent(null)
    setModuleContentError(null)
    setIsPageCompleteView(false)
    setIsProjectCompleteView(false)
    const stored = storageService.getProjectById(activeProjectId)
    if (stored) {
      stored.currentPageIndex = index
      storageService.saveProject(stored)
    }
  }, [pages, activeProjectId, refreshProjectProgressMap, setIsPageCompleteView, setIsProjectCompleteView])

  const clearSpecError = useCallback(() => {
    setSpecError(null)
    setSpecStage('idle')
  }, [])

  // ==========================================================================
  // Preset Selection: PRE-FILLS PROMPT ONLY (RULE #2)
  // ==========================================================================
  const loadPresetProject = (key: 'ecommerce' | 'dashboard' | 'taskmanager' | 'portfolio') => {
    const presets: Record<string, { prompt: string; useTailwind: boolean }> = {
      ecommerce: {
        prompt: 'interactive pet axolotl feeding schedule and aquarium tank chemistry tracker with log tables and localStorage persistence',
        useTailwind: true
      },
      dashboard: {
        prompt: 'vanilla web telemetry dashboard with KPI metric cards, sparkline trends, search filtering, and client-side data export',
        useTailwind: true
      },
      taskmanager: {
        prompt: 'collaborative agile sprint kanban board with drag-and-drop lanes, priority tags, and browser localStorage',
        useTailwind: true
      },
      portfolio: {
        prompt: 'cyberpunk interactive developer terminal portfolio with command line prompt, project showcase modal, and custom CSS styling',
        useTailwind: false
      }
    }

    const target = presets[key] || presets.dashboard
    // ONLY pre-fill prompt and stack; never launch or map to canned specs
    setActivePrompt(target.prompt)
    if (!isTailwindLocked) {
      setUseTailwind(target.useTailwind)
    }
    setCurrentScreen(1)
  }

  // ==========================================================================
  // Workspace / Navigation Helpers
  // ==========================================================================
  const selectComponent = (idx: number) => {
    if (idx >= 0 && idx < availableComponents.length) {
      setActiveComponentIndex(idx)
      const targetComponent = availableComponents[idx]
      if (targetComponent?.module) {
        setActiveModule(targetComponent.module)
        setCodeFiles(targetComponent.module.initialFiles)
        setActiveFile(Object.keys(targetComponent.module.initialFiles)[0])
        setTestStatus('not_run')
        setEvaluationResult(null)
      }
    }
  }

  const selectProject = (id: string) => {
    setActiveProjectId(id)
    storageService.setActiveProjectId(id)
    const stored = storageService.getProjectById(id)
    setActiveModuleContent(null)
    setModuleContentError(null)
    setIsModuleRedoMode(false)
    setIsPageCompleteView(false)
    restoredWorkspaceForProjectRef.current = null
    if (stored && stored.spec) {
      setActiveSpec(stored.spec)
      setActivePrompt(
        stored.curatedSlug === 'login-greeting'
          ? DEFAULT_STARTER_PROMPT
          : stored.userPrompt
      )
      const isTailwind = stored.useTailwind !== undefined ? stored.useTailwind : Boolean(stored.spec.useTailwind)
      setUseTailwindState(isTailwind)
      setIsTailwindLocked(
        stored.source === 'curated' ||
        stored.status === 'spec_confirmed' ||
        stored.status === 'in_progress' ||
        stored.status === 'completed'
      )
    }
    if (stored && stored.pages && stored.pages.length > 0) {
      setCurrentScreen(3)
    } else {
      setCurrentScreen(2)
    }
  }

  const deleteProject = useCallback((id: string) => {
    flushUserFilesSaveRef.current?.()
    const deletingActive = activeProjectId === id
    storageService.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))

    const remaining = storageService.getProjects(currentUser.id)
    const nextActive = deletingActive
      ? (remaining[0] || null)
      : remaining.find(p => p.id === activeProjectId) || null

    if (deletingActive) {
      storageService.setActiveProjectId(nextActive?.id || null)
      setActiveProjectId(nextActive?.id || null)
      setActiveModuleContent(null)
      setModuleContentError(null)
      setIsModuleRedoMode(false)
      setIsPageCompleteViewState(false)
      setIsProjectCompleteViewState(false)
      setNextPageError(null)
      restoredWorkspaceForProjectRef.current = null
      if (!nextActive) {
        setActiveSpec(null)
        setActivePrompt(DEFAULT_STARTER_PROMPT)
        setIsTailwindLocked(false)
        setSpecStage('idle')
        setSpecError(null)
        setPages([])
        setCurrentPage(null)
        setActiveModules([])
        setCurrentScreenIndex(0)
        setProjectMemory(null)
        setUserFiles({})
        setCodeFiles({})
        setProjectFiles([])
        setProjectFolders([])
        setAssetUrlMap({})
        setModuleProgressMap({})
        setAllModulesProgressMap({})
      }
    }
    refreshStatsFromStorage()
  }, [activeProjectId, currentUser.id, refreshStatsFromStorage])

  const createNewProject = async (promptText: string, customStack: string[] = ['HTML', 'CSS', 'JavaScript']) => {
    const targetTailwind = customStack.includes('Tailwind') || useTailwind
    await generateProjectSpec(promptText, {
      runtime: 'HTML + CSS + JavaScript',
      styling: targetTailwind ? 'Tailwind CSS' : 'Plain CSS',
      stateManagement: 'Browser In-Memory State / DOM',
      backendSim: 'In-Browser LocalStorage / IndexedDB',
      useTailwind: targetTailwind
    })
  }

  const skipThinking = () => setIsThinking(false)

  const confirmScope = (screens: PlannedPage[]) => {
    if (activeProject) {
      setProjects(projects.map(p => p.id === activeProject.id ? { ...p, status: 'active', plannedScreens: screens, totalScreens: screens.length } : p))
    }
    setCurrentScreen(3)
  }

  const addScreenToScope = (name: string, description: string) => {
    if (!activeProject) return
    const newPage: PlannedPage = {
      id: `page-${Date.now()}`,
      name,
      description,
      pageOrder: activeProject.plannedScreens.length + 1,
      status: 'pending',
      components: []
    }
    const updatedScreens = [...activeProject.plannedScreens, newPage]
    setProjects(projects.map(p => p.id === activeProject.id ? { ...p, plannedScreens: updatedScreens, totalScreens: updatedScreens.length } : p))
  }

  const removeScreenFromScope = (id: string) => {
    if (!activeProject) return
    const updatedScreens = activeProject.plannedScreens.filter(s => s.id !== id)
    setProjects(projects.map(p => p.id === activeProject.id ? { ...p, plannedScreens: updatedScreens, totalScreens: updatedScreens.length } : p))
  }

  const setCalibrationTier = (tier: CalibrationTier) => {
    setLearnerProfile({ ...learnerProfile, calibrationTier: tier })
    updateCurrentUser({ tier: tier === 'tier_1' ? 'tier1' : tier === 'tier_3' ? 'tier3' : 'tier2' })
  }

  const updateFileCode = (filePath: string, newCode: string) => {
    setCodeFiles(prev => ({ ...prev, [filePath]: newCode }))
  }

  const unlockHint = (hintId: string) => {
    const updatedHints = activeModule.hints.map(h => h.id === hintId ? { ...h, unlocked: true } : h)
    setActiveModule({ ...activeModule, hints: updatedHints })
  }

  const restoreStarterCode = () => {
    if (activeModule?.initialFiles) {
      setCodeFiles(activeModule.initialFiles)
    }
  }

  const runTestCases = async () => {
    setIsTestRunning(true)
    setTestStatus('running')

    try {
      const response = await fetch('/api/evaluate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeFiles,
          moduleTitle: activeModule.title,
          componentName: activeModule.title
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Automated code evaluation failed.')
      }

      setEvaluationResult(data.evaluation)
      setTestStatus(data.evaluation.passed ? 'pass' : 'fail')

      if (data.evaluation.passed) {
        updateCurrentUser({ streakDays: currentUser.streakDays + 1 })
      }
    } catch (err: any) {
      setTestStatus('fail')
      setEvaluationResult({
        passed: false,
        score: 0,
        feedback: `Evaluation Error: ${err.message}`,
        suggestions: ['Check server LLM Trace or try running tests again.']
      })
    } finally {
      setIsTestRunning(false)
    }
  }

  const advanceToNextComponent = () => {
    const nextIdx = activeComponentIndex + 1
    if (nextIdx < availableComponents.length) {
      selectComponent(nextIdx)
    } else {
      setCurrentScreen(6)
    }
  }

  const flushUserFilesSave = useCallback(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    const pending = latestFilesContextRef.current
    if (pending) {
      if (pending.projectFiles) {
        storageService.saveProjectFiles(pending.projectId, pending.moduleId, pending.projectFiles)
      } else {
        storageService.saveUserFiles(pending.projectId, pending.moduleId, pending.files)
      }
    }
  }, [])

  useEffect(() => {
    flushUserFilesSaveRef.current = flushUserFilesSave
  }, [flushUserFilesSave])

  useEffect(() => {
    const onBeforeUnload = () => flushUserFilesSave()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      flushUserFilesSave()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flushUserFilesSave])

  const getModuleProgress = useCallback((moduleId: string): LearnerProgress | null => {
    if (moduleProgressMap[moduleId]) return moduleProgressMap[moduleId]
    if (!activeProjectId) return null
    return storageService.getLearnerProgress(currentUser.id, scopedModuleKey(activeProjectId, moduleId))
  }, [moduleProgressMap, activeProjectId, currentUser.id])

  const getEffectiveModuleStatus = useCallback((moduleId: string, fallbackIndex: number): 'done' | 'active' | 'locked' => {
    const isModDone = (mod: PageModuleItem): boolean => {
      const prog = moduleProgressMap[mod.id]
      return mod.status === 'done' || Boolean(prog?.passed) || Boolean(prog?.completedWithSolution)
    }
    const targetMod = activeModules[fallbackIndex]
    if (targetMod && isModDone(targetMod)) return 'done'
    const firstIncompleteIdx = activeModules.findIndex(m => !isModDone(m))
    if (firstIncompleteIdx === fallbackIndex) return 'active'
    return 'locked'
  }, [activeModules, moduleProgressMap])

  const isModuleOpenable = useCallback((index: number): boolean => {
    const mod = activeModules[index]
    if (!mod) return false
    return getEffectiveModuleStatus(mod.id, index) !== 'locked'
  }, [activeModules, getEffectiveModuleStatus])

  const activeModuleItem = activeModules[activeModuleIndex] || null

  const openModuleInternal = useCallback(async (
    targetProjectId: string,
    targetSpec: ProjectSpec,
    targetPage: PageItem,
    targetModules: PageModuleItem[],
    targetPageIndex: number,
    index: number,
    options?: { navigate?: boolean; forceRefresh?: boolean }
  ) => {
    const mod = targetModules[index]
    if (!targetProjectId || !targetSpec || !targetPage || !mod) return

    flushUserFilesSave()

    setActiveModuleIndex(index)
    setModuleContentError(null)
    setIsModuleRedoMode(false)
    setIsPageCompleteView(false)
    setIsProjectCompleteView(false)
    restoredWorkspaceForProjectRef.current = targetProjectId

    try {
      window.localStorage.setItem(activeModuleStorageKey(targetProjectId), mod.id)
    } catch {
      // ignore
    }

    if (options?.navigate !== false) {
      setCurrentScreen(4)
    }

    const stored = storageService.getProjectById(targetProjectId)
    const latestMem = storageService.getProjectMemory(targetProjectId) || projectMemory

    try {
      let rawContent: ModuleContent | null = null

      if (stored?.source === 'curated' && stored.curatedSlug) {
        const course = CURATED_COURSES[stored.curatedSlug]
        const courseMod = course?.modules?.[index]
        if (!courseMod) {
          throw new Error(`Curated module #${index + 1} not found in course "${stored.curatedSlug}".`)
        }
        rawContent = {
          lesson: courseMod.lesson,
          task: courseMod.task,
          requirements: courseMod.requirements || [],
          expectedResult: courseMod.expectedResult || '',
          references: courseMod.references || [],
          starterFiles: courseMod.starterFiles,
          solutionFiles: courseMod.solutionFiles,
          checks: courseMod.checks,
          hints: courseMod.hints
        }
      } else {
        const scopedId = scopedModuleKey(targetProjectId, mod.id)
        const cached = !options?.forceRefresh ? storageService.getModuleContent(scopedId) : null
        if (cached) {
          rawContent = cached
        } else {
          setIsLoadingModuleContent(true)
          const completed = latestMem?.completedFiles || {}
          const targetHtmlName = targetPage.fileName || 'index.html'
          const hasSharedCss = Object.keys(completed).some(p => p.toLowerCase() === 'styles.css')
          const hasSharedJs = Object.keys(completed).some(p => p.toLowerCase() === 'app.js')
          const newPageSkeleton = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${targetPage.name} — ${targetSpec.appName}</title>${hasSharedCss ? '\n  <link rel="stylesheet" href="styles.css">' : ''}\n</head>\n<body>\n  <!-- ${targetPage.name}: ${targetPage.purpose || targetPage.description} -->\n${hasSharedJs ? '  <script src="app.js"></script>\n' : ''}</body>\n</html>`

          let baselineFiles: { path: string; content: string }[] = []
          if (Object.keys(completed).length > 0) {
            baselineFiles = Object.entries(completed).map(([path, content]) => ({ path, content }))
            if (!completed[targetHtmlName]) {
              baselineFiles.push({ path: targetHtmlName, content: newPageSkeleton })
            }
          } else {
            baselineFiles = [
              {
                path: targetHtmlName,
                content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${targetSpec.appName}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n</body>\n</html>`
              },
              {
                path: 'styles.css',
                content: `/* Styles for ${targetSpec.appName} */\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n`
              },
              {
                path: 'app.js',
                content: `// Logic for ${targetSpec.appName}\n`
              }
            ]
          }

          const result = await llmService.generateModuleContent({
            spec: targetSpec,
            page: targetPage,
            module: { ...mod, id: scopedId },
            useTailwind: Boolean(targetSpec.useTailwind),
            projectMemory: latestMem,
            currentFiles: baselineFiles,
            forceRefresh: Boolean(options?.forceRefresh)
          })
          rawContent = result.moduleContent
          storageService.saveModuleContent(scopedId, rawContent)
        }
      }

      // Preserve learner's accumulated project files across ALL pages (skip only Module 1 of Page 1)
      const isInitialProjectModule = targetPageIndex === 0 && index === 0
      const effectiveStarter = mergeModuleStarterFiles(
        rawContent.starterFiles,
        latestMem?.completedFiles,
        isInitialProjectModule
      )
      effectiveStarterRef.current = effectiveStarter

      const normalizedContent: ModuleContent = {
        ...rawContent,
        starterFiles: Object.entries(effectiveStarter).map(([path, content]) => ({ path, content }))
      }
      setActiveModuleContent(normalizedContent)

      const savedRichFiles = storageService.getProjectFiles(targetProjectId, mod.id)
      const memBinaryFiles: ProjectFile[] = (latestMem?.assets || []).map(a => ({
        path: a.path,
        kind: 'binary',
        assetRef: a.assetRef,
        mimeType: a.mimeType,
        size: a.size,
        isProvided: a.isProvided
      }))

      let resolvedProjectFiles: ProjectFile[]
      if (savedRichFiles && savedRichFiles.length > 0) {
        resolvedProjectFiles = savedRichFiles
      } else {
        resolvedProjectFiles = textMapToProjectFiles(effectiveStarter, memBinaryFiles)
      }

      const initialTextMap = projectFilesToTextMap(resolvedProjectFiles)
      latestFilesContextRef.current = {
        projectId: targetProjectId,
        moduleId: mod.id,
        files: initialTextMap,
        projectFiles: resolvedProjectFiles
      }
      setProjectFiles(resolvedProjectFiles)
      setUserFiles(initialTextMap)
      setCodeFiles(initialTextMap)

      const existingFolders = new Set<string>(storageService.getProjectFolders(targetProjectId))
      for (const pf of resolvedProjectFiles) {
        const parts = pf.path.split('/')
        for (let i = 1; i < parts.length; i++) {
          existingFolders.add(parts.slice(0, i).join('/'))
        }
      }
      const nextFolders = Array.from(existingFolders).sort()
      storageService.saveProjectFolders(targetProjectId, nextFolders)
      setProjectFolders(nextFolders)

      const binaries = resolvedProjectFiles.filter(f => f.kind === 'binary' && f.assetRef)
      if (binaries.length > 0) {
        void Promise.all(
          binaries.map(async b => {
            if (!b.assetRef) return null
            const rec = await storageService.getAssetBlob(b.assetRef)
            if (!rec) return null
            const url = await blobToDataUrl(rec.blob, b.mimeType)
            return [b.path, url] as const
          })
        ).then(entries => {
          const map: Record<string, string> = {}
          for (const entry of entries) {
            if (entry) map[entry[0]] = entry[1]
          }
          setAssetUrlMap(map)
        })
      } else {
        setAssetUrlMap({})
      }

      const allPaths = resolvedProjectFiles.map(f => f.path)
      if (allPaths.length > 0) {
        const preferredFile = targetPage.fileName || 'index.html'
        setActiveFile(
          allPaths.includes(preferredFile)
            ? preferredFile
            : allPaths.includes('index.html')
            ? 'index.html'
            : allPaths[0]
        )
      }

      const scopedId = scopedModuleKey(targetProjectId, mod.id)
      const nowIso = new Date().toISOString()
      const existingProg = storageService.getLearnerProgress(currentUser.id, scopedId)
      if (!existingProg) {
        const initProg: LearnerProgress = {
          userId: currentUser.id,
          moduleId: scopedId,
          passed: mod.status === 'done',
          attempts: 0,
          hintsUsed: 0,
          usedSolution: false,
          completedWithSolution: false,
          startedAt: nowIso
        }
        storageService.saveLearnerProgress(initProg)
        setModuleProgressMap(prev => ({ ...prev, [mod.id]: initProg }))
        setAllModulesProgressMap(prev => ({ ...prev, [mod.id]: initProg }))
        refreshStatsFromStorage()
      } else if (!existingProg.startedAt) {
        const updatedProg: LearnerProgress = { ...existingProg, startedAt: nowIso }
        storageService.saveLearnerProgress(updatedProg)
        setModuleProgressMap(prev => ({ ...prev, [mod.id]: updatedProg }))
        setAllModulesProgressMap(prev => ({ ...prev, [mod.id]: updatedProg }))
        refreshStatsFromStorage()
      }
    } catch (err: any) {
      setModuleContentError(err?.message || 'Failed to load module content.')
      setActiveModuleContent(null)
    } finally {
      setIsLoadingModuleContent(false)
    }
  }, [projectMemory, currentUser.id, flushUserFilesSave, setCurrentScreen, setIsPageCompleteView, setIsProjectCompleteView, refreshStatsFromStorage])

  const openModule = useCallback(async (
    index: number,
    options?: { navigate?: boolean; forceRefresh?: boolean }
  ) => {
    if (!activeProjectId || !activeSpec || !currentPage || !activeModules[index]) return
    await openModuleInternal(
      activeProjectId,
      activeSpec,
      currentPage,
      activeModules,
      currentScreenIndex,
      index,
      options
    )
  }, [activeProjectId, activeSpec, currentPage, activeModules, currentScreenIndex, openModuleInternal])

  const openProjectModule = useCallback(async (
    projectId: string,
    pageIndex: number,
    moduleIndex: number
  ) => {
    const stored = storageService.getProjectById(projectId)
    if (!stored || !stored.spec) return
    const targetPage = stored.pages?.[pageIndex]
    const targetMod = targetPage?.modules?.[moduleIndex]
    if (!targetPage || !targetMod) return

    flushUserFilesSave()

    stored.currentPageIndex = pageIndex
    storageService.saveProject(stored)
    storageService.setActiveProjectId(projectId)
    setActiveProjectId(projectId)
    setActiveProjectSource(stored.source === 'curated' ? 'curated' : 'generated')
    setActiveSpec(stored.spec)
    setActivePrompt(
      stored.curatedSlug === 'login-greeting'
        ? DEFAULT_STARTER_PROMPT
        : stored.userPrompt
    )
    const isTailwind = stored.useTailwind !== undefined ? stored.useTailwind : Boolean(stored.spec.useTailwind)
    setUseTailwindState(isTailwind)
    setIsTailwindLocked(
      stored.source === 'curated' ||
      stored.status === 'spec_confirmed' ||
      stored.status === 'in_progress' ||
      stored.status === 'completed'
    )
    setPages(stored.pages)
    setCurrentPage(targetPage)
    setActiveModules(targetPage.modules)
    setCurrentScreenIndex(pageIndex)
    refreshProjectProgressMap(projectId, targetPage.modules, stored.pages)
    const mem = storageService.getProjectMemory(projectId)
    if (mem) setProjectMemory(mem)
    restoredWorkspaceForProjectRef.current = projectId
    refreshStatsFromStorage()

    await openModuleInternal(
      projectId,
      stored.spec,
      targetPage,
      targetPage.modules,
      pageIndex,
      moduleIndex,
      { navigate: true }
    )
  }, [flushUserFilesSave, refreshProjectProgressMap, refreshStatsFromStorage, openModuleInternal])

  const retryLoadModuleContent = useCallback(async () => {
    await openModule(activeModuleIndex, { navigate: false, forceRefresh: true })
  }, [openModule, activeModuleIndex])

  // Auto-restore active Screen 4 module on browser reload (unless showing Page Complete or Project Complete)
  useEffect(() => {
    if (
      currentScreen === 4 &&
      !isPageCompleteView &&
      !isProjectCompleteView &&
      activeProjectId &&
      activeSpec &&
      currentPage &&
      activeModules.length > 0 &&
      restoredWorkspaceForProjectRef.current !== activeProjectId
    ) {
      let targetIdx = 0
      try {
        const savedModId = window.localStorage.getItem(activeModuleStorageKey(activeProjectId))
        if (savedModId) {
          const found = activeModules.findIndex(m => m.id === savedModId)
          if (found >= 0 && isModuleOpenable(found)) {
            targetIdx = found
          }
        }
      } catch {
        // ignore
      }
      if (!isModuleOpenable(targetIdx)) {
        const firstIncomplete = activeModules.findIndex((m, idx) => getEffectiveModuleStatus(m.id, idx) !== 'locked')
        targetIdx = firstIncomplete >= 0 ? firstIncomplete : 0
      }
      openModule(targetIdx, { navigate: false })
    }
  }, [currentScreen, activeProjectId, activeSpec, currentPage, activeModules, isModuleOpenable, getEffectiveModuleStatus, openModule])

  const updateUserFile = useCallback((filePath: string, content: string) => {
    if (!activeProjectId || !activeModuleItem) return
    const nextBytes = getTextByteSize(content)
    if (nextBytes > MAX_SINGLE_FILE_BYTES) {
      setAssetError(`"${filePath}" exceeds single file limit (${formatBytes(MAX_SINGLE_FILE_BYTES)}).`)
      return
    }
    const existingList = latestFilesContextRef.current?.projectFiles || projectFiles
    const updatedList = existingList.some(f => f.path === filePath)
      ? existingList.map(f => (f.path === filePath ? { ...f, kind: 'text' as const, content, size: nextBytes } : f))
      : [...existingList, { path: filePath, kind: 'text' as const, content, mimeType: inferMimeType(filePath), size: nextBytes }]
    const nextTotal = computeTotalProjectBytes(updatedList)
    if (nextTotal > MAX_TOTAL_PROJECT_BYTES) {
      setAssetError(`Project exceeds total size cap of ${formatBytes(MAX_TOTAL_PROJECT_BYTES)} (currently ${formatBytes(nextTotal)}).`)
      return
    }
    setAssetError(null)
    setProjectFiles(updatedList)
    const nextMap = projectFilesToTextMap(updatedList)
    setUserFiles(nextMap)
    setCodeFiles(nextMap)
    latestFilesContextRef.current = {
      projectId: activeProjectId,
      moduleId: activeModuleItem.id,
      files: nextMap,
      projectFiles: updatedList
    }
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }
    saveDebounceRef.current = setTimeout(() => {
      storageService.saveProjectFiles(activeProjectId, activeModuleItem.id, updatedList)
      saveDebounceRef.current = null
    }, 500)
  }, [activeProjectId, activeModuleItem, projectFiles])

  const resetToStarter = useCallback(() => {
    if (!activeProjectId || !activeModuleItem) return
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    const starterCopy = { ...effectiveStarterRef.current }
    if (Object.keys(starterCopy).length === 0 && activeModuleContent) {
      for (const f of activeModuleContent.starterFiles) {
        starterCopy[f.path] = f.content
      }
    }
    const existingBinaries = (latestFilesContextRef.current?.projectFiles || projectFiles).filter(f => f.kind === 'binary')
    const resetRich = textMapToProjectFiles(starterCopy, existingBinaries)
    latestFilesContextRef.current = {
      projectId: activeProjectId,
      moduleId: activeModuleItem.id,
      files: starterCopy,
      projectFiles: resetRich
    }
    storageService.saveProjectFiles(activeProjectId, activeModuleItem.id, resetRich)
    setProjectFiles(resetRich)
    setUserFiles(starterCopy)
    setCodeFiles(starterCopy)
    setAssetError(null)
  }, [activeProjectId, activeModuleItem, activeModuleContent, projectFiles])

  const commitRichFilesState = useCallback((
    nextFiles: ProjectFile[],
    nextFolders: string[],
    nextAssetUrls?: Record<string, string>
  ) => {
    if (!activeProjectId || !activeModuleItem) return
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    const nextTextMap = projectFilesToTextMap(nextFiles)
    const uniqueFolders = Array.from(new Set(nextFolders)).sort()
    latestFilesContextRef.current = {
      projectId: activeProjectId,
      moduleId: activeModuleItem.id,
      files: nextTextMap,
      projectFiles: nextFiles
    }
    storageService.saveProjectFiles(activeProjectId, activeModuleItem.id, nextFiles)
    storageService.saveProjectFolders(activeProjectId, uniqueFolders)
    setProjectFiles(nextFiles)
    setProjectFolders(uniqueFolders)
    setUserFiles(nextTextMap)
    setCodeFiles(nextTextMap)
    if (nextAssetUrls) {
      setAssetUrlMap(nextAssetUrls)
    }

    const baseMem = storageService.getProjectMemory(activeProjectId) || projectMemory
    if (baseMem) {
      const updatedMem: ProjectMemory = {
        ...baseMem,
        fileTree: Array.from(new Set([...nextFiles.map(f => f.path)])),
        assets: nextFiles
          .filter(f => f.kind === 'binary' && f.assetRef)
          .map(f => ({
            path: f.path,
            assetRef: f.assetRef!,
            mimeType: f.mimeType,
            size: f.size,
            isProvided: f.isProvided
          }))
      }
      storageService.saveProjectMemory(updatedMem)
      setProjectMemory(updatedMem)
    }
  }, [activeProjectId, activeModuleItem, projectMemory])

  const createNewFile = useCallback((rawPath: string, initialContent = ''): boolean => {
    if (!activeProjectId || !activeModuleItem) return false
    const cleanPath = sanitizeProjectPath(rawPath)
    if (!cleanPath) {
      setAssetError('Invalid file path. Paths must stay inside the project and cannot use "..", leading slashes, or invalid characters.')
      return false
    }
    const lower = cleanPath.toLowerCase()
    const currentList = latestFilesContextRef.current?.projectFiles || projectFiles
    if (currentList.some(f => f.path.toLowerCase() === lower)) {
      setAssetError(`A file named "${cleanPath}" already exists.`)
      return false
    }
    if (projectFolders.some(d => d.toLowerCase() === lower)) {
      setAssetError(`A folder named "${cleanPath}" already exists.`)
      return false
    }
    // Also reject creating a file inside a path segment that is already an existing file
    const parts = cleanPath.split('/')
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/').toLowerCase()
      if (currentList.some(f => f.path.toLowerCase() === prefix)) {
        setAssetError(`Cannot create "${cleanPath}" because "${parts.slice(0, i).join('/')}" is a file.`)
        return false
      }
    }

    const mime = inferMimeType(cleanPath)
    if (!isTextCodePath(cleanPath) && (isImageMime(mime, cleanPath) || isAudioMime(mime, cleanPath) || isFontMime(mime, cleanPath))) {
      setAssetError(`Use Upload to add binary assets like "${cleanPath}".`)
      return false
    }

    const size = getTextByteSize(initialContent)
    if (size > MAX_SINGLE_FILE_BYTES) {
      setAssetError(`File exceeds single file size cap of ${formatBytes(MAX_SINGLE_FILE_BYTES)}.`)
      return false
    }
    const newFile: ProjectFile = {
      path: cleanPath,
      kind: 'text',
      content: initialContent,
      mimeType: mime,
      size
    }
    const nextList = [...currentList, newFile]
    if (computeTotalProjectBytes(nextList) > MAX_TOTAL_PROJECT_BYTES) {
      setAssetError(`Project exceeds maximum total size limit (${formatBytes(MAX_TOTAL_PROJECT_BYTES)}).`)
      return false
    }

    const nextFolders = [...projectFolders]
    for (let i = 1; i < parts.length; i++) {
      const parentDir = parts.slice(0, i).join('/')
      if (!nextFolders.includes(parentDir)) nextFolders.push(parentDir)
    }

    setAssetError(null)
    commitRichFilesState(nextList, nextFolders)
    setActiveFile(cleanPath)
    return true
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, commitRichFilesState])

  const createNewFolder = useCallback((rawPath: string): boolean => {
    if (!activeProjectId || !activeModuleItem) return false
    const cleanPath = sanitizeProjectPath(rawPath)
    if (!cleanPath) {
      setAssetError('Invalid folder name. Paths cannot use "..", leading slashes, or invalid characters.')
      return false
    }
    const lower = cleanPath.toLowerCase()
    const currentList = latestFilesContextRef.current?.projectFiles || projectFiles
    if (projectFolders.some(d => d.toLowerCase() === lower)) {
      setAssetError(`Folder "${cleanPath}" already exists.`)
      return false
    }
    if (currentList.some(f => f.path.toLowerCase() === lower || lower.startsWith(`${f.path.toLowerCase()}/`))) {
      setAssetError(`Cannot create folder "${cleanPath}" because a conflicting file exists.`)
      return false
    }
    const parts = cleanPath.split('/')
    const nextFolders = [...projectFolders]
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (!nextFolders.some(d => d.toLowerCase() === dir.toLowerCase())) {
        nextFolders.push(dir)
      }
    }
    setAssetError(null)
    commitRichFilesState(currentList, nextFolders)
    return true
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, commitRichFilesState])

  const uploadProjectFiles = useCallback(async (
    items: FileList | File[] | Array<{ file: File; targetFolder?: string }>
  ): Promise<{ added: string[]; errors: string[] }> => {
    if (!activeProjectId || !activeModuleItem) {
      return { added: [], errors: ['No active project workspace.'] }
    }
    const normalizedItems: Array<{ file: File; targetFolder?: string }> = []
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && 'file' in item) normalizedItems.push(item)
        else if (item) normalizedItems.push({ file: item as File })
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        const f = items.item(i)
        if (f) normalizedItems.push({ file: f })
      }
    }

    const currentList = [...(latestFilesContextRef.current?.projectFiles || projectFiles)]
    const nextFolders = [...projectFolders]
    const nextAssetUrls = { ...assetUrlMap }
    const added: string[] = []
    const errors: string[] = []

    for (const { file, targetFolder } of normalizedItems) {
      const rawTarget = targetFolder ? `${targetFolder}/${file.name}` : file.name
      const cleanPath = sanitizeProjectPath(rawTarget)
      if (!cleanPath) {
        errors.push(`"${file.name}": invalid path.`)
        continue
      }
      if (currentList.some(f => f.path.toLowerCase() === cleanPath.toLowerCase())) {
        errors.push(`"${cleanPath}": a file with this name already exists.`)
        continue
      }
      if (file.size > MAX_SINGLE_FILE_BYTES) {
        errors.push(`"${cleanPath}" (${formatBytes(file.size)}) exceeds the ${formatBytes(MAX_SINGLE_FILE_BYTES)} single-file limit.`)
        continue
      }
      const runningBytes = computeTotalProjectBytes(currentList)
      if (runningBytes + file.size > MAX_TOTAL_PROJECT_BYTES) {
        errors.push(`Uploading "${cleanPath}" would exceed the ${formatBytes(MAX_TOTAL_PROJECT_BYTES)} total project limit.`)
        continue
      }

      const inferredMime = inferMimeType(cleanPath)
      const mime = inferredMime === 'application/octet-stream' && file.type ? file.type : inferredMime
      const isCodeText = isTextCodePath(cleanPath) && !cleanPath.toLowerCase().endsWith('.svg')
      const isSupportedBinary = isImageMime(mime, cleanPath) || isAudioMime(mime, cleanPath) || isFontMime(mime, cleanPath)

      if (!isCodeText && !isSupportedBinary) {
        errors.push(`"${cleanPath}": unsupported file type (${mime}). Upload images, SVG, audio, fonts, or code/text files.`)
        continue
      }

      const parts = cleanPath.split('/')
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/')
        if (!nextFolders.includes(dir)) nextFolders.push(dir)
      }

      if (isCodeText) {
        const content = await file.text()
        currentList.push({
          path: cleanPath,
          kind: 'text',
          content,
          mimeType: mime,
          size: getTextByteSize(content)
        })
      } else {
        const assetRef = `${activeProjectId}::upload::${Date.now()}_${Math.random().toString(36).slice(2, 8)}::${cleanPath}`
        await storageService.saveAssetBlob({
          assetRef,
          projectId: activeProjectId,
          path: cleanPath,
          mimeType: mime,
          size: file.size,
          blob: file
        })
        const dataUrl = await blobToDataUrl(file, mime)
        nextAssetUrls[cleanPath] = dataUrl
        currentList.push({
          path: cleanPath,
          kind: 'binary',
          assetRef,
          mimeType: mime,
          size: file.size,
          isProvided: false
        })
      }
      added.push(cleanPath)
    }

    if (added.length > 0) {
      commitRichFilesState(currentList, nextFolders, nextAssetUrls)
      setActiveFile(added[0])
    }

    if (errors.length > 0) {
      setAssetError(errors.join(' '))
    } else {
      setAssetError(null)
    }
    return { added, errors }
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, assetUrlMap, commitRichFilesState])

  const renameProjectEntry = useCallback(async (
    oldPath: string,
    newPathInput: string,
    isFolder = false
  ): Promise<boolean> => {
    if (!activeProjectId || !activeModuleItem) return false
    const cleanNew = sanitizeProjectPath(newPathInput)
    if (!cleanNew) {
      setAssetError('Invalid target name. Paths cannot use "..", leading slashes, or invalid characters.')
      return false
    }
    const cleanOld = sanitizeProjectPath(oldPath)
    if (!cleanOld) return false
    if (cleanNew === cleanOld) return true

    const currentList = latestFilesContextRef.current?.projectFiles || projectFiles
    const nextAssetUrls = { ...assetUrlMap }

    if (isFolder) {
      if (projectFolders.some(d => d.toLowerCase() === cleanNew.toLowerCase())) {
        setAssetError(`Folder "${cleanNew}" already exists.`)
        return false
      }
      if (currentList.some(f => f.path.toLowerCase() === cleanNew.toLowerCase())) {
        setAssetError(`A file named "${cleanNew}" already exists.`)
        return false
      }
      const oldPrefix = `${cleanOld}/`
      const newPrefix = `${cleanNew}/`
      const nextFiles = currentList.map(f => {
        if (!f.path.startsWith(oldPrefix)) return f
        const renamedPath = `${newPrefix}${f.path.slice(oldPrefix.length)}`
        if (nextAssetUrls[f.path]) {
          nextAssetUrls[renamedPath] = nextAssetUrls[f.path]
          delete nextAssetUrls[f.path]
        }
        return { ...f, path: renamedPath }
      })
      // Verify no path collisions resulted
      const lowerSeen = new Set<string>()
      for (const f of nextFiles) {
        const l = f.path.toLowerCase()
        if (lowerSeen.has(l)) {
          setAssetError(`Rename conflict on "${f.path}".`)
          return false
        }
        lowerSeen.add(l)
      }
      const nextFolders = projectFolders.map(d => {
        if (d === cleanOld) return cleanNew
        if (d.startsWith(oldPrefix)) return `${newPrefix}${d.slice(oldPrefix.length)}`
        return d
      })
      commitRichFilesState(nextFiles, nextFolders, nextAssetUrls)
      if (activeFile.startsWith(oldPrefix)) {
        setActiveFile(`${newPrefix}${activeFile.slice(oldPrefix.length)}`)
      }
      setAssetError(null)
      return true
    }

    // Single file rename
    if (currentList.some(f => f.path.toLowerCase() === cleanNew.toLowerCase())) {
      setAssetError(`A file named "${cleanNew}" already exists.`)
      return false
    }
    if (projectFolders.some(d => d.toLowerCase() === cleanNew.toLowerCase())) {
      setAssetError(`A folder named "${cleanNew}" already exists.`)
      return false
    }
    const parts = cleanNew.split('/')
    const nextFolders = [...projectFolders]
    for (let i = 1; i < parts.length; i++) {
      const parentDir = parts.slice(0, i).join('/')
      if (!nextFolders.includes(parentDir)) nextFolders.push(parentDir)
    }

    const nextFiles = currentList.map(f => {
      if (f.path !== cleanOld) return f
      const updatedMime = f.kind === 'text' ? inferMimeType(cleanNew) : f.mimeType
      if (nextAssetUrls[cleanOld]) {
        nextAssetUrls[cleanNew] = nextAssetUrls[cleanOld]
        delete nextAssetUrls[cleanOld]
      }
      return { ...f, path: cleanNew, mimeType: updatedMime }
    })

    // Sync IndexedDB metadata if binary
    const targetFile = nextFiles.find(f => f.path === cleanNew && f.kind === 'binary' && f.assetRef)
    if (targetFile?.assetRef) {
      const rec = await storageService.getAssetBlob(targetFile.assetRef)
      if (rec) {
        await storageService.saveAssetBlob({ ...rec, path: cleanNew })
      }
    }

    commitRichFilesState(nextFiles, nextFolders, nextAssetUrls)
    if (activeFile === cleanOld) {
      setActiveFile(cleanNew)
    }
    setAssetError(null)
    return true
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, assetUrlMap, activeFile, commitRichFilesState])

  const deleteProjectEntry = useCallback(async (targetPath: string, isFolder = false): Promise<void> => {
    if (!activeProjectId || !activeModuleItem) return
    const currentList = latestFilesContextRef.current?.projectFiles || projectFiles
    const nextAssetUrls = { ...assetUrlMap }
    const deletedAssetRefs: string[] = []

    const isAffected = (p: string) => (isFolder ? p === targetPath || p.startsWith(`${targetPath}/`) : p === targetPath)
    const remainingFiles = currentList.filter(f => {
      if (isAffected(f.path)) {
        if (f.kind === 'binary' && f.assetRef) deletedAssetRefs.push(f.assetRef)
        delete nextAssetUrls[f.path]
        return false
      }
      return true
    })

    const nextFolders = isFolder
      ? projectFolders.filter(d => d !== targetPath && !d.startsWith(`${targetPath}/`))
      : projectFolders

    commitRichFilesState(remainingFiles, nextFolders, nextAssetUrls)

    for (const ref of deletedAssetRefs) {
      await storageService.deleteAssetBlob(ref)
    }

    if (isAffected(activeFile)) {
      const remainingPaths = remainingFiles.map(f => f.path)
      setActiveFile(remainingPaths.includes('index.html') ? 'index.html' : (remainingPaths[0] || ''))
    }
    setAssetError(null)
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, assetUrlMap, activeFile, commitRichFilesState])

  const hasMissingProvidedAssets = React.useMemo(() => {
    if (!activeProjectId) return false
    const stored = storageService.getProjectById(activeProjectId)
    if (stored?.source !== 'curated' || !stored.curatedSlug) return false
    const course = CURATED_COURSES[stored.curatedSlug]
    const courseAssets: CuratedAsset[] = Array.isArray(course?.assets) ? course.assets : []
    if (courseAssets.length === 0) return false
    return courseAssets.some(ca => !projectFiles.some(pf => pf.path === ca.path))
  }, [activeProjectId, projectFiles])

  const restoreProvidedAssets = useCallback(async (): Promise<void> => {
    if (!activeProjectId || !activeModuleItem) return
    const stored = storageService.getProjectById(activeProjectId)
    if (stored?.source !== 'curated' || !stored.curatedSlug) return
    const course = CURATED_COURSES[stored.curatedSlug]
    const courseAssets: CuratedAsset[] = Array.isArray(course?.assets) ? course.assets : []
    if (courseAssets.length === 0) return

    const currentList = [...(latestFilesContextRef.current?.projectFiles || projectFiles)]
    const nextFolders = [...projectFolders]
    const nextAssetUrls = { ...assetUrlMap }
    let restoredAny = false

    for (const asset of courseAssets) {
      const cleanPath = sanitizeProjectPath(asset.path)
      if (!cleanPath || currentList.some(f => f.path === cleanPath)) continue
      try {
        const resp = await fetch(`/curated-assets/${stored.curatedSlug}/${cleanPath}`)
        if (!resp.ok) continue
        const blob = await resp.blob()
        const mimeType = asset.mimeType || blob.type || inferMimeType(cleanPath)
        const assetRef = `${activeProjectId}::provided::${cleanPath}`
        await storageService.saveAssetBlob({
          assetRef,
          projectId: activeProjectId,
          path: cleanPath,
          mimeType,
          size: blob.size,
          blob
        })
        nextAssetUrls[cleanPath] = await blobToDataUrl(blob, mimeType)
        currentList.push({
          path: cleanPath,
          kind: 'binary',
          assetRef,
          mimeType,
          size: blob.size,
          isProvided: true
        })
        const parts = cleanPath.split('/')
        for (let i = 1; i < parts.length; i++) {
          const dir = parts.slice(0, i).join('/')
          if (!nextFolders.includes(dir)) nextFolders.push(dir)
        }
        restoredAny = true
      } catch {
        // Ignore unfetchable asset
      }
    }

    if (restoredAny) {
      commitRichFilesState(currentList, nextFolders, nextAssetUrls)
      setAssetError(null)
    }
  }, [activeProjectId, activeModuleItem, projectFiles, projectFolders, assetUrlMap, commitRichFilesState])

  const revealNextHint = useCallback((): number => {
    if (!activeProjectId || !activeModuleItem || !activeModuleContent) return 0
    const scopedId = scopedModuleKey(activeProjectId, activeModuleItem.id)
    const existing = storageService.getLearnerProgress(currentUser.id, scopedId) || {
      userId: currentUser.id,
      moduleId: scopedId,
      passed: false,
      attempts: 0,
      hintsUsed: 0,
      usedSolution: false,
      completedWithSolution: false
    }
    const nextHints = Math.min(existing.hintsUsed + 1, activeModuleContent.hints.length)
    const updated: LearnerProgress = {
      ...existing,
      startedAt: existing.startedAt || new Date().toISOString(),
      hintsUsed: nextHints
    }
    storageService.saveLearnerProgress(updated)
    setModuleProgressMap(prev => ({ ...prev, [activeModuleItem.id]: updated }))
    setAllModulesProgressMap(prev => ({ ...prev, [activeModuleItem.id]: updated }))
    refreshStatsFromStorage()
    return nextHints
  }, [activeProjectId, activeModuleItem, activeModuleContent, currentUser.id, refreshStatsFromStorage])

  const recordFailedCheckAttempt = useCallback((): LearnerProgress | null => {
    if (!activeProjectId || !activeModuleItem) return null
    const scopedId = scopedModuleKey(activeProjectId, activeModuleItem.id)
    const existing = storageService.getLearnerProgress(currentUser.id, scopedId) || {
      userId: currentUser.id,
      moduleId: scopedId,
      passed: false,
      attempts: 0,
      hintsUsed: 0,
      usedSolution: false,
      completedWithSolution: false,
      startedAt: new Date().toISOString()
    }
    const updated: LearnerProgress = {
      ...existing,
      startedAt: existing.startedAt || new Date().toISOString(),
      attempts: existing.attempts + 1
    }
    storageService.saveLearnerProgress(updated)
    setModuleProgressMap(prev => ({ ...prev, [activeModuleItem.id]: updated }))
    setAllModulesProgressMap(prev => ({ ...prev, [activeModuleItem.id]: updated }))
    refreshStatsFromStorage()
    return updated
  }, [activeProjectId, activeModuleItem, currentUser.id, refreshStatsFromStorage])

  const completeActiveModule = useCallback((options?: { usedSolution?: boolean }) => {
    if (!activeProjectId || !activeModuleItem || !currentPage) return

    flushUserFilesSave()
    const usedSolution = Boolean(options?.usedSolution)
    const scopedId = scopedModuleKey(activeProjectId, activeModuleItem.id)
    const existing = storageService.getLearnerProgress(currentUser.id, scopedId)
    const now = new Date().toISOString()

    const nextProgress: LearnerProgress = {
      userId: currentUser.id,
      moduleId: scopedId,
      passed: !usedSolution || Boolean(existing?.passed),
      attempts: (existing?.attempts || 0) + (usedSolution ? 0 : 1),
      hintsUsed: existing?.hintsUsed || 0,
      usedSolution: usedSolution || Boolean(existing?.usedSolution),
      completedWithSolution: usedSolution || Boolean(existing?.completedWithSolution),
      startedAt: existing?.startedAt || now,
      completedAt: now
    }
    storageService.saveLearnerProgress(nextProgress)
    setModuleProgressMap(prev => ({ ...prev, [activeModuleItem.id]: nextProgress }))
    setAllModulesProgressMap(prev => ({ ...prev, [activeModuleItem.id]: nextProgress }))
    refreshStatsFromStorage()

    // Build files to promote into ProjectMemory (learner's passing files, or solutionFiles if unlocked via Show Solution)
    let filesToCommit = { ...(latestFilesContextRef.current?.files || userFiles) }
    if (usedSolution && activeModuleContent) {
      const solMap: Record<string, string> = {}
      for (const f of activeModuleContent.solutionFiles) {
        solMap[f.path] = f.content
      }
      filesToCommit = solMap
    }

    const baseMem: ProjectMemory = storageService.getProjectMemory(activeProjectId) || projectMemory || {
      projectId: activeProjectId,
      techStack: activeSpec?.useTailwind ? 'HTML + CSS + JavaScript (Tailwind CSS)' : 'HTML + CSS + JavaScript (Plain CSS)',
      useTailwind: Boolean(activeSpec?.useTailwind),
      namingConventions: [],
      fileTree: [],
      decisionsMade: [],
      completedFiles: {}
    }

    const updatedCompletedFiles = { ...baseMem.completedFiles, ...filesToCommit }
    const activeBinaryAssets = (latestFilesContextRef.current?.projectFiles || projectFiles)
      .filter(f => f.kind === 'binary' && f.assetRef)
      .map(f => ({
        path: f.path,
        assetRef: f.assetRef!,
        mimeType: f.mimeType,
        size: f.size,
        isProvided: f.isProvided
      }))
    const updatedFileTree = Array.from(
      new Set([
        ...baseMem.fileTree,
        ...Object.keys(updatedCompletedFiles),
        ...activeBinaryAssets.map(a => a.path)
      ])
    )
    const diffNotes = computeDeterministicMemoryDiff(
      effectiveStarterRef.current,
      filesToCommit,
      activeModuleItem.order,
      activeModuleItem.title
    )
    const updatedDecisions = Array.from(new Set([...baseMem.decisionsMade, ...diffNotes]))

    const updatedMemory: ProjectMemory = {
      ...baseMem,
      fileTree: updatedFileTree,
      completedFiles: updatedCompletedFiles,
      assets: activeBinaryAssets,
      decisionsMade: updatedDecisions
    }
    storageService.saveProjectMemory(updatedMemory)
    setProjectMemory(updatedMemory)

    // Unlock next module or finish page
    const updatedModules: PageModuleItem[] = activeModules.map((m, idx) => {
      if (idx === activeModuleIndex) {
        return { ...m, status: 'done' }
      }
      if (idx === activeModuleIndex + 1 && m.status === 'locked') {
        return { ...m, status: 'active' }
      }
      return m
    })

    const allDone = updatedModules.every(m => m.status === 'done')
    const updatedPage: PageItem = {
      ...currentPage,
      status: allDone ? 'done' : currentPage.status,
      modules: updatedModules
    }

    if (allDone) {
      const existingCompletedPages = Array.isArray(updatedMemory.completedPages) ? updatedMemory.completedPages : []
      const nextCompletedPages = [
        ...existingCompletedPages.filter(p => p.id !== updatedPage.id && p.fileName !== updatedPage.fileName),
        {
          id: updatedPage.id,
          name: updatedPage.name,
          fileName: updatedPage.fileName,
          description: updatedPage.description,
          purpose: updatedPage.purpose
        }
      ]
      const memWithPages: ProjectMemory = {
        ...updatedMemory,
        completedPages: nextCompletedPages
      }
      storageService.saveProjectMemory(memWithPages)
      setProjectMemory(memWithPages)
    }

    setActiveModules(updatedModules)
    setCurrentPage(updatedPage)
    setPages(prev => prev.map((pg, idx) => (idx === currentScreenIndex ? updatedPage : pg)))

    const stored = storageService.getProjectById(activeProjectId)
    if (stored) {
      const nextPages = (stored.pages || []).map((pg, idx) => (idx === currentScreenIndex ? updatedPage : pg))
      stored.pages = nextPages
      if (allDone && stored.source === 'curated') {
        stored.status = 'completed'
      } else if (stored.status === 'spec_confirmed' || stored.status === 'draft_spec') {
        stored.status = 'in_progress'
      }
      stored.updatedAt = now
      storageService.saveProject(stored)
    }
    setIsModuleRedoMode(false)
    refreshStatsFromStorage()
  }, [
    activeProjectId,
    activeModuleItem,
    activeModuleIndex,
    activeModules,
    activeModuleContent,
    currentPage,
    currentScreenIndex,
    currentUser.id,
    projectMemory,
    projectFiles,
    activeSpec,
    userFiles,
    flushUserFilesSave,
    refreshStatsFromStorage
  ])

  const finishActivePage = useCallback(() => {
    if (!activeProjectId || !currentPage) return
    flushUserFilesSave()
    const stored = storageService.getProjectById(activeProjectId)
    if (stored?.source === 'curated') {
      stored.status = 'completed'
      stored.updatedAt = new Date().toISOString()
      storageService.saveProject(stored)
      refreshStatsFromStorage()
      setIsPageCompleteView(false)
      setIsProjectCompleteView(true)
      setCurrentScreen(4)
      return
    }
    setIsProjectCompleteView(false)
    setIsPageCompleteView(true)
    setCurrentScreen(4)
  }, [activeProjectId, currentPage, flushUserFilesSave, refreshStatsFromStorage, setIsPageCompleteView, setIsProjectCompleteView, setCurrentScreen])

  const generateNextPage = useCallback(async (forceRefresh: boolean = false) => {
    if (!activeProjectId || !activeSpec || isGeneratingNextPage) return
    const stored = storageService.getProjectById(activeProjectId)
    if (stored?.source === 'curated') {
      if (stored) {
        stored.status = 'completed'
        stored.updatedAt = new Date().toISOString()
        storageService.saveProject(stored)
      }
      setIsPageCompleteView(false)
      setIsProjectCompleteView(true)
      return
    }

    flushUserFilesSave()
    setNextPageError(null)
    setIsGeneratingNextPage(true)

    try {
      const latestMem = storageService.getProjectMemory(activeProjectId) || projectMemory || {
        projectId: activeProjectId,
        techStack: `HTML + CSS + JavaScript (${activeSpec.useTailwind ? 'Tailwind CSS utilities' : 'Plain semantic CSS'})`,
        useTailwind: activeSpec.useTailwind,
        namingConventions: [],
        fileTree: [],
        decisionsMade: [...activeSpec.assumptions],
        completedFiles: {}
      }

      const mergedCompletedFiles = {
        ...latestMem.completedFiles,
        ...(latestFilesContextRef.current?.files || userFiles)
      }
      const currentCompletedPages = pages.map(pg => ({
        id: pg.id,
        name: pg.name,
        fileName: pg.fileName,
        description: pg.description,
        purpose: pg.purpose
      }))
      const updatedMemory: ProjectMemory = {
        ...latestMem,
        fileTree: Array.from(new Set([...latestMem.fileTree, ...Object.keys(mergedCompletedFiles)])),
        completedFiles: mergedCompletedFiles,
        completedPages: currentCompletedPages
      }
      storageService.saveProjectMemory(updatedMemory)
      setProjectMemory(updatedMemory)

      const res = await llmService.generatePage({
        spec: activeSpec,
        useTailwind: activeSpec.useTailwind,
        projectMemory: updatedMemory,
        forceRefresh
      })

      if (res.projectComplete || !res.page) {
        if (stored) {
          stored.status = 'completed'
          stored.updatedAt = new Date().toISOString()
          storageService.saveProject(stored)
        }
        setIsPageCompleteView(false)
        setIsProjectCompleteView(true)
        return
      }

      const newPage: PageItem = {
        ...res.page,
        projectId: activeProjectId,
        order: pages.length + 1
      }
      const nextPages: PageItem[] = [
        ...pages.map(pg => ({ ...pg, status: 'done' as const })),
        newPage
      ]
      const nextIdx = nextPages.length - 1

      const memWithNewPage: ProjectMemory = {
        ...updatedMemory,
        fileTree: Array.from(new Set([...updatedMemory.fileTree, newPage.fileName]))
      }
      storageService.saveProjectMemory(memWithNewPage)
      setProjectMemory(memWithNewPage)

      if (stored) {
        stored.pages = nextPages
        stored.currentPageIndex = nextIdx
        stored.status = 'in_progress'
        stored.updatedAt = new Date().toISOString()
        storageService.saveProject(stored)
      }

      setPages(nextPages)
      setCurrentPage(newPage)
      setActiveModules(newPage.modules)
      setCurrentScreenIndex(nextIdx)
      refreshProjectProgressMap(activeProjectId, newPage.modules, nextPages)
      setActiveModuleContent(null)
      setModuleContentError(null)
      setIsModuleRedoMode(false)
      setIsPageCompleteView(false)
      setIsProjectCompleteView(false)
      restoredWorkspaceForProjectRef.current = activeProjectId
      setCurrentScreen(3)
    } catch (err: any) {
      setNextPageError(err?.message || 'Failed to generate next page.')
    } finally {
      setIsGeneratingNextPage(false)
    }
  }, [
    activeProjectId,
    activeSpec,
    isGeneratingNextPage,
    flushUserFilesSave,
    projectMemory,
    userFiles,
    pages,
    setIsPageCompleteView,
    setIsProjectCompleteView,
    refreshProjectProgressMap,
    setCurrentScreen
  ])

  const resetToNewProject = useCallback(() => {
    flushUserFilesSave()
    storageService.setActiveProjectId('')
    setActiveProjectId(null)
    setActiveSpec(null)
    setActivePrompt(DEFAULT_STARTER_PROMPT)
    setIsTailwindLocked(false)
    setSpecStage('idle')
    setSpecError(null)
    setPages([])
    setCurrentPage(null)
    setActiveModules([])
    setCurrentScreenIndex(0)
    setProjectMemory(null)
    setActiveModuleContent(null)
    setModuleContentError(null)
    setUserFiles({})
    setCodeFiles({})
    setProjectFiles([])
    setProjectFolders([])
    setAssetUrlMap({})
    setModuleProgressMap({})
    setAllModulesProgressMap({})
    setIsPageCompleteViewState(false)
    setIsProjectCompleteViewState(false)
    setNextPageError(null)
    restoredWorkspaceForProjectRef.current = null
    setCurrentScreen(1)
  }, [flushUserFilesSave, setCurrentScreen])

  const enableModuleRedo = useCallback(() => {
    setIsModuleRedoMode(true)
  }, [])

  const requestSubmissionReview = useCallback(async (
    failedChecks: Array<{ check: Check; result: CheckResult }>
  ): Promise<ReviewSubmissionResponse> => {
    if (!activeModuleItem || !activeModuleContent) {
      throw new Error('No active module loaded for error review.')
    }
    const response = await llmService.reviewSubmission({
      module: {
        id: activeModuleItem.id,
        title: activeModuleItem.title,
        learningObjective: activeModuleItem.learningObjective,
        task: activeModuleContent.task
      },
      userFiles,
      failedChecks: failedChecks.map(f => ({
        ...f.check,
        message: f.result.message || f.check.message
      }))
    })
    return response.review
  }, [activeModuleItem, activeModuleContent, userFiles])

  const downloadProjectZip = async () => {
    const zip = new JSZip()
    const exportSource =
      Object.keys(userFiles).length > 0
        ? { ...(projectMemory?.completedFiles || {}), ...userFiles }
        : Object.keys(projectMemory?.completedFiles || {}).length > 0
        ? projectMemory!.completedFiles
        : codeFiles

    for (const [filePath, content] of Object.entries(exportSource)) {
      zip.file(filePath, content)
    }

    // Include all binary assets (images, audio, fonts) from IndexedDB
    const binaryEntries = projectFiles.filter(f => f.kind === 'binary' && f.assetRef)
    for (const bf of binaryEntries) {
      if (!bf.assetRef) continue
      const rec = await storageService.getAssetBlob(bf.assetRef)
      if (rec?.blob) {
        zip.file(bf.path, rec.blob)
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(activeSpec?.appName || 'ascent-project').toLowerCase().replace(/[^a-z0-9]/g, '-')}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const connectGithub = (username: string) => {
    updateCurrentUser({ handle: `@${username || 'builder'}` })
    setLearnerProfile(prev => ({
      ...prev,
      githubUsername: username || 'developer',
      isGithubConnected: true
    }))
  }

  const syncToGithub = async (): Promise<boolean> => {
    setIsSyncingGithub(true)
    await new Promise(r => setTimeout(r, 800))
    setIsSyncingGithub(false)
    return true
  }

  const storedProjects = React.useMemo(() => {
    void statsVersion
    void activeProjectId
    void pages
    void currentScreen
    return storageService.getProjects(currentUser.id)
  }, [currentUser.id, statsVersion, activeProjectId, pages, currentScreen])

  const allUserProgressByKey = React.useMemo(() => {
    void statsVersion
    void moduleProgressMap
    void allModulesProgressMap
    void currentScreen
    return storageService.getAllProgressForUser(currentUser.id)
  }, [currentUser.id, statsVersion, moduleProgressMap, allModulesProgressMap, currentScreen])

  const profileStats = React.useMemo(() => {
    return computeProfileStats(storedProjects, Object.values(allUserProgressByKey))
  }, [storedProjects, allUserProgressByKey])

  const streakMetrics = profileStats.streak

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setScreen: setCurrentScreen,
        currentUser,
        updateCurrentUser,
        learnerProfile,
        setCalibrationTier,
        activeSpec,
        activePrompt,
        setActivePrompt,
        useTailwind,
        setUseTailwind,
        isTailwindLocked,
        specStage,
        specError,
        isGeneratingSpec: specStage === 'analyzing' || specStage === 'synthesizing' || specStage === 'validating',
        lastGenerationFromCache,
        generateProjectSpec,
        retryGenerateSpec,
        updateProjectSpec,
        confirmProjectSpec,
        clearSpecError,
        curatedCoursesList: curatedIndex,
        loadCuratedProject,
        currentPage,
        pages,
        activeModules,
        currentScreenIndex,
        selectActiveScreen,
        projectMemory,
        isGeneratingPlan,
        planStage,
        planError,
        activeProjectId,
        storedProjects,
        allUserProgressByKey,
        streakMetrics,
        profileStats,
        refreshStatsFromStorage,
        projects,
        activeProject,
        selectProject,
        deleteProject,
        openProjectModule,
        createNewProject,
        confirmScope,
        addScreenToScope,
        removeScreenFromScope,
        activeModule,
        activeComponentIndex,
        setActiveComponentIndex: selectComponent,
        activeFile,
        setActiveFile,
        codeFiles,
        updateFileCode,
        runTestCases,
        isTestRunning,
        testStatus,
        evaluationResult,
        unlockHint,
        isThinking,
        skipThinking,
        thinkingPlan,
        downloadProjectZip,
        connectGithub,
        syncToGithub,
        isSyncingGithub,
        loadPresetProject,
        advanceToNextComponent,
        restoreStarterCode,
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
        moduleProgressMap,
        allModulesProgressMap,
        isModuleRedoMode,
        isPageCompleteView,
        setIsPageCompleteView,
        isProjectCompleteView,
        setIsProjectCompleteView,
        finishActivePage,
        isGeneratingNextPage,
        nextPageError,
        clearNextPageError,
        generateNextPage,
        resetToNewProject,
        activeProjectSource,
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
        enableModuleRedo
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
