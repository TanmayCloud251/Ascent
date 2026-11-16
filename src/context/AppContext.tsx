import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
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
import { storageService } from '../services/storageService'
import { llmService } from '../services/llmService'
import {
  ModuleContent,
  ModuleContentSchema,
  CheckResult,
  LearnerProgress,
  ReviewSubmissionResponse
} from '../schemas/course'
import {
  CodeEvaluationResult,
  ThinkingPlan
} from '../services/curriculumGenerator'
import curatedIndex from '../data/curated/index.json'
import currencyConverterCourse from '../data/curated/currency-converter.json'
import rockPaperScissorsCourse from '../data/curated/rock-paper-scissors.json'
import ticTacToeCourse from '../data/curated/tic-tac-toe.json'

const CURATED_COURSES: Record<string, any> = {
  'currency-converter': currencyConverterCourse,
  'rock-paper-scissors': rockPaperScissorsCourse,
  'tic-tac-toe': ticTacToeCourse
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
  projects: LegacyProject[]
  activeProject: LegacyProject | null
  selectProject: (id: string) => void
  createNewProject: (promptText: string, customStack?: string[]) => Promise<void>
  confirmScope: (screens: PlannedPage[]) => void
  addScreenToScope: (name: string, description: string) => void
  removeScreenFromScope: (id: string) => void

  // Slice 3 + 4: Workspace, IDE, Validation, Progress & Unlock Logic
  activePageModule: PageModuleItem | null
  activeModuleContent: ModuleContent | null
  isLoadingModule: boolean
  moduleLoadError: string | null
  userFiles: Record<string, string>
  moduleProgress: LearnerProgress | null
  allProgress: Record<string, LearnerProgress>
  checkResults: CheckResult[]
  isExplainingErrors: boolean
  errorExplanation: ReviewSubmissionResponse | null
  isPageComplete: boolean
  setIsPageComplete: (val: boolean) => void
  openModuleInWorkspace: (moduleId: string, forceRefresh?: boolean) => Promise<void>
  retryLoadModule: () => Promise<void>
  updateUserFile: (filePath: string, content: string) => void
  persistUserFiles: (files?: Record<string, string>) => void
  resetModuleToStarter: () => void
  revealNextHint: () => void
  recordCheckResults: (results: CheckResult[]) => void
  explainSubmissionErrors: () => Promise<void>
  applySolutionToEditor: () => void
  advanceToNextPageModule: () => Promise<void>

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
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => storageService.getCurrentUser())
  const [currentScreen, setCurrentScreen] = useState<ScreenIndex>(1)

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
      techStack: [p.spec?.techStack?.runtime || 'React 19', p.spec?.techStack?.styling || 'Tailwind CSS'],
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
        if (activeStored.status === 'spec_confirmed' || activeStored.status === 'in_progress' || activeStored.status === 'completed') {
          setIsTailwindLocked(true)
        } else {
          setIsTailwindLocked(false)
        }
        if (activeStored.userPrompt) {
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

    setSpecError(null)
    // Curated projects strictly use plain CSS (no Tailwind) and are locked
    setUseTailwindState(false)
    setIsTailwindLocked(true)
    setActivePrompt(`${course.title}: ${course.shortDescription}`)
    setActiveStackConfig({
      runtime: 'HTML + CSS + JavaScript',
      styling: 'Plain CSS',
      stateManagement: 'Browser In-Memory State / DOM',
      backendSim: 'In-Browser LocalStorage / IndexedDB',
      useTailwind: false
    })

    // Staged telemetry transition: analyzing -> synthesizing -> validating -> done
    setSpecStage('analyzing')
    setCurrentScreen(2)

    // Record static trace immediately for telemetry inspector
    llmService.recordCuratedTrace(slug, course)

    await new Promise(r => setTimeout(r, 700))
    setSpecStage('synthesizing')
    await new Promise(r => setTimeout(r, 900))
    setSpecStage('validating')
    await new Promise(r => setTimeout(r, 600))

    const newProjectId = `proj_curated_${slug}_${Date.now()}`
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
      userPrompt: `${course.title} — ${course.shortDescription}`,
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

    const memory: ProjectMemory = {
      projectId: newProjectId,
      techStack: 'HTML + CSS + JavaScript (Plain CSS, semantic styles)',
      useTailwind: false,
      namingConventions: [
        'Single page vanilla web app',
        'Semantic HTML and pure CSS custom properties',
        'Modular vanilla JavaScript event handlers'
      ],
      fileTree: [pageItem.fileName, 'styles.css', 'app.js'],
      decisionsMade: [...(course.spec?.assumptions || [])],
      completedFiles: {}
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

    // Load initial code for module 0 if present
    if (course.modules?.[0]?.starterFiles && course.modules[0].starterFiles.length > 0) {
      const initCode: Record<string, string> = {}
      for (const f of course.modules[0].starterFiles) {
        initCode[f.path] = f.content
      }
      setCodeFiles(initCode)
      setActiveFile(course.modules[0].starterFiles[0].path)
    }

    setSpecStage('done')
  }, [currentUser.id])

  // Slice 2 Revised: Page + Component Syllabus
  const [currentPage, setCurrentPage] = useState<PageItem | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [activeModules, setActiveModules] = useState<PageModuleItem[]>([])
  const [currentScreenIndex, setCurrentScreenIndex] = useState<number>(0)
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false)
  const [planStage, setPlanStage] = useState<'idle' | 'page' | 'done' | 'error'>('idle')
  const [planError, setPlanError] = useState<string | null>(null)

  // Slice 3 + 4 State
  const [activePageModule, setActivePageModule] = useState<PageModuleItem | null>(null)
  const [activeModuleContent, setActiveModuleContent] = useState<ModuleContent | null>(null)
  const [isLoadingModule, setIsLoadingModule] = useState<boolean>(false)
  const [moduleLoadError, setModuleLoadError] = useState<string | null>(null)
  const [userFiles, setUserFiles] = useState<Record<string, string>>({})
  const [moduleProgress, setModuleProgress] = useState<LearnerProgress | null>(null)
  const [allProgress, setAllProgress] = useState<Record<string, LearnerProgress>>(() =>
    storageService.getAllProgressForUser(storageService.getCurrentUser().id)
  )
  const [checkResults, setCheckResults] = useState<CheckResult[]>([])
  const [isExplainingErrors, setIsExplainingErrors] = useState<boolean>(false)
  const [errorExplanation, setErrorExplanation] = useState<ReviewSubmissionResponse | null>(null)
  const [isPageComplete, setIsPageComplete] = useState<boolean>(false)

  // Restore Slice 2 page and modules from storage on project load
  useEffect(() => {
    if (activeProjectId) {
      const stored = storageService.getProjectById(activeProjectId)
      if (stored) {
        if (stored.pages && stored.pages.length > 0) {
          setPages(stored.pages)
          const activePg = stored.pages[stored.currentPageIndex || 0] || stored.pages[0]
          setCurrentPage(activePg)
          setActiveModules(activePg.modules || [])
          setIsPageComplete(activePg.status === 'done')
        }
        if (stored.currentPageIndex !== undefined) {
          setCurrentScreenIndex(stored.currentPageIndex)
        }
      }
      const mem = storageService.getProjectMemory(activeProjectId)
      if (mem) {
        setProjectMemory(mem)
      }
      setAllProgress(storageService.getAllProgressForUser(currentUser.id))
    }
  }, [activeProjectId, currentUser.id])

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

      // Update memory fileTree
      memory.fileTree = [generatedPage.fileName]
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
    } catch (err: any) {
      const msg = err.message || 'Failed to generate page blueprint.'
      setPlanError(msg)
      setPlanStage('error')
      setIsGeneratingPlan(false)
    }
  }, [activeProjectId, activeSpec])

  const selectActiveScreen = useCallback(async (index: number) => {
    if (!pages[index]) return
    setCurrentScreenIndex(index)
    const targetPage = pages[index]
    setCurrentPage(targetPage)
    setActiveModules(targetPage.modules)
  }, [pages])

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
    if (stored && stored.spec) {
      setActiveSpec(stored.spec)
      setActivePrompt(stored.userPrompt)
    }
    setCurrentScreen(2)
  }

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

  // ==========================================================================
  // SLICES 3 + 4: Module Content Loader, Progress, Check Runner & Unlock Logic
  // ==========================================================================

  const openModuleInWorkspace = useCallback(async (moduleId: string, forceRefresh: boolean = false) => {
    if (!activeProjectId || !currentPage) return

    const modIndex = activeModules.findIndex(m => m.id === moduleId)
    if (modIndex === -1) return
    const targetMod = activeModules[modIndex]

    // Unlock rule: locked modules cannot be opened directly
    if (targetMod.status === 'locked') {
      return
    }

    setActivePageModule(targetMod)
    setCurrentScreen(4)
    setIsLoadingModule(true)
    setModuleLoadError(null)
    setCheckResults([])
    setErrorExplanation(null)
    setIsPageComplete(false)

    const scopedKey = `${activeProjectId}:${targetMod.id}`
    const existingProg = storageService.getLearnerProgress(currentUser.id, scopedKey) || {
      userId: currentUser.id,
      moduleId: scopedKey,
      passed: targetMod.status === 'done',
      attempts: 0,
      hintsUsed: 0,
      usedSolution: false,
      completedWithSolution: false
    }
    setModuleProgress(existingProg)

    try {
      const storedProject = storageService.getProjectById(activeProjectId)
      let loadedContent: ModuleContent | null = null

      if (storedProject?.source === 'curated' && storedProject.curatedSlug) {
        // Curated path: strictly read pre-built static JSON, zero LLM calls
        const course = CURATED_COURSES[storedProject.curatedSlug]
        const curatedMod = course?.modules?.find((m: any) => m.id === targetMod.id) || course?.modules?.[modIndex]
        if (!curatedMod) {
          throw new Error(`Curated module content not found for "${targetMod.title}".`)
        }
        const parsed = ModuleContentSchema.safeParse({
          lesson: curatedMod.lesson,
          task: curatedMod.task,
          starterFiles: curatedMod.starterFiles,
          solutionFiles: curatedMod.solutionFiles,
          checks: curatedMod.checks,
          hints: curatedMod.hints || []
        })
        if (!parsed.success) {
          throw new Error(`Invalid curated module structure: ${parsed.error.message}`)
        }
        loadedContent = parsed.data
        llmService.recordCuratedTrace(storedProject.curatedSlug, curatedMod)
      } else {
        // Generated path: check local storage cache first unless forced
        if (!forceRefresh) {
          loadedContent = storageService.getModuleContent(scopedKey)
        }
        if (!loadedContent) {
          const latestMemory = storageService.getProjectMemory(activeProjectId) || projectMemory
          const baselineFiles = latestMemory?.completedFiles && Object.keys(latestMemory.completedFiles).length > 0
            ? Object.entries(latestMemory.completedFiles).map(([path, content]) => ({ path, content }))
            : undefined

          const res = await llmService.generateModuleContent({
            spec: activeSpec!,
            page: currentPage,
            module: targetMod,
            useTailwind: activeSpec?.useTailwind ?? useTailwind,
            projectMemory: latestMemory,
            currentFiles: baselineFiles,
            forceRefresh
          })
          loadedContent = res.moduleContent
          storageService.saveModuleContent(scopedKey, loadedContent)
        }
      }

      setActiveModuleContent(loadedContent)

      // Restore learner's saved userFiles if present, otherwise initialize from starterFiles
      const savedFiles = storageService.getUserFiles(activeProjectId, targetMod.id)
      let initialMap: Record<string, string> = {}
      if (savedFiles && Object.keys(savedFiles).length > 0) {
        initialMap = savedFiles
      } else {
        for (const f of loadedContent.starterFiles) {
          initialMap[f.path] = f.content
        }
        storageService.saveUserFiles(activeProjectId, targetMod.id, initialMap)
      }

      setUserFiles(initialMap)
      setCodeFiles(initialMap)
      const preferredFirst = initialMap['index.html'] !== undefined ? 'index.html' : Object.keys(initialMap)[0] || 'index.html'
      setActiveFile(preferredFirst)
      setIsLoadingModule(false)
    } catch (err: any) {
      setModuleLoadError(err?.message || 'Failed to load module content.')
      setIsLoadingModule(false)
    }
  }, [activeProjectId, activeModules, activeSpec, currentPage, currentUser.id, projectMemory, useTailwind])

  const retryLoadModule = useCallback(async () => {
    if (activePageModule) {
      await openModuleInWorkspace(activePageModule.id, true)
    }
  }, [activePageModule, openModuleInWorkspace])

  const updateUserFile = useCallback((filePath: string, content: string) => {
    setUserFiles(prev => ({ ...prev, [filePath]: content }))
    setCodeFiles(prev => ({ ...prev, [filePath]: content }))
  }, [])

  const persistUserFiles = useCallback((filesToSave?: Record<string, string>) => {
    if (!activeProjectId || !activePageModule) return
    const target = filesToSave || userFiles
    storageService.saveUserFiles(activeProjectId, activePageModule.id, target)
  }, [activeProjectId, activePageModule, userFiles])

  const resetModuleToStarter = useCallback(() => {
    if (!activeProjectId || !activePageModule || !activeModuleContent) return
    const starterMap: Record<string, string> = {}
    for (const f of activeModuleContent.starterFiles) {
      starterMap[f.path] = f.content
    }
    setUserFiles(starterMap)
    setCodeFiles(starterMap)
    storageService.saveUserFiles(activeProjectId, activePageModule.id, starterMap)
    setCheckResults([])
    setErrorExplanation(null)
  }, [activeProjectId, activePageModule, activeModuleContent])

  const revealNextHint = useCallback(() => {
    if (!activeProjectId || !activePageModule || !activeModuleContent) return
    const totalHints = activeModuleContent.hints.length
    if (totalHints === 0) return

    const scopedKey = `${activeProjectId}:${activePageModule.id}`
    const currentProg = moduleProgress || {
      userId: currentUser.id,
      moduleId: scopedKey,
      passed: false,
      attempts: 0,
      hintsUsed: 0,
      usedSolution: false,
      completedWithSolution: false
    }
    const nextUsed = Math.min(totalHints, (currentProg.hintsUsed || 0) + 1)
    const updated: LearnerProgress = { ...currentProg, hintsUsed: nextUsed }
    setModuleProgress(updated)
    setAllProgress(prev => ({ ...prev, [scopedKey]: updated }))
    storageService.saveLearnerProgress(updated)
  }, [activeProjectId, activePageModule, activeModuleContent, currentUser.id, moduleProgress])

  const recordCheckResults = useCallback((results: CheckResult[]) => {
    setCheckResults(results)
    if (!activeProjectId || !activePageModule || !currentPage) return

    const allPassed = results.length > 0 && results.every(r => r.passed)
    const scopedKey = `${activeProjectId}:${activePageModule.id}`
    const prevProg = moduleProgress || {
      userId: currentUser.id,
      moduleId: scopedKey,
      passed: false,
      attempts: 0,
      hintsUsed: 0,
      usedSolution: false,
      completedWithSolution: false
    }

    const wasAlreadyPassed = prevProg.passed
    const updatedProg: LearnerProgress = {
      ...prevProg,
      attempts: (prevProg.attempts || 0) + 1,
      passed: wasAlreadyPassed || allPassed,
      completedAt: allPassed && !wasAlreadyPassed ? new Date().toISOString() : prevProg.completedAt
    }
    setModuleProgress(updatedProg)
    setAllProgress(prev => ({ ...prev, [scopedKey]: updatedProg }))
    storageService.saveLearnerProgress(updatedProg)

    if (allPassed) {
      setErrorExplanation(null)
      storageService.saveUserFiles(activeProjectId, activePageModule.id, userFiles)

      // Update modules unlock state
      const currentIdx = activeModules.findIndex(m => m.id === activePageModule.id)
      const updatedModules = activeModules.map((m, idx) => {
        if (idx === currentIdx) return { ...m, status: 'done' as const }
        if (idx === currentIdx + 1 && m.status === 'locked') return { ...m, status: 'active' as const }
        return m
      })

      const allModulesDone = updatedModules.every(m => m.status === 'done')
      const updatedPage: PageItem = {
        ...currentPage,
        status: allModulesDone ? 'done' : currentPage.status,
        modules: updatedModules
      }

      setActiveModules(updatedModules)
      setCurrentPage(updatedPage)
      setActivePageModule(updatedModules[currentIdx] || activePageModule)

      const updatedPages = pages.map(p => p.id === updatedPage.id ? updatedPage : p)
      setPages(updatedPages)

      if (allModulesDone) {
        setIsPageComplete(true)
      }

      // Persist Project changes
      const storedProject = storageService.getProjectById(activeProjectId)
      if (storedProject) {
        storedProject.pages = updatedPages
        storedProject.status = allModulesDone ? 'completed' : 'in_progress'
        storageService.saveProject(storedProject)
      }

      // Update ProjectMemory with learner's actual files and diff summary
      const existingMem = storageService.getProjectMemory(activeProjectId) || projectMemory || {
        projectId: activeProjectId,
        techStack: `HTML + CSS + JavaScript (${useTailwind ? 'Tailwind CSS' : 'Plain CSS'})`,
        useTailwind,
        namingConventions: [],
        fileTree: [],
        decisionsMade: [],
        completedFiles: {}
      }

      const prevFiles = existingMem.completedFiles || {}
      const changedSummary: string[] = []
      for (const [path, content] of Object.entries(userFiles)) {
        if (prevFiles[path] !== content) {
          const prevLines = prevFiles[path] ? prevFiles[path].split('\n').length : 0
          const newLines = content.split('\n').length
          const delta = newLines - prevLines
          changedSummary.push(`${path} (${delta >= 0 ? `+${delta}` : delta} lines)`)
        }
      }

      const decisionEntry = `Module ${activePageModule.order} (${activePageModule.title}): updated ${
        changedSummary.length > 0 ? changedSummary.join(', ') : Object.keys(userFiles).join(', ')
      }`

      const updatedMem: ProjectMemory = {
        ...existingMem,
        fileTree: Object.keys(userFiles),
        completedFiles: { ...userFiles },
        decisionsMade: existingMem.decisionsMade.includes(decisionEntry)
          ? existingMem.decisionsMade
          : [...existingMem.decisionsMade, decisionEntry]
      }
      storageService.saveProjectMemory(updatedMem)
      setProjectMemory(updatedMem)

      if (!wasAlreadyPassed) {
        updateCurrentUser({ streakDays: (currentUser.streakDays || 0) + 1 })
      }
    }
  }, [
    activeModules,
    activePageModule,
    activeProjectId,
    currentPage,
    currentUser.id,
    currentUser.streakDays,
    moduleProgress,
    pages,
    projectMemory,
    updateCurrentUser,
    useTailwind,
    userFiles
  ])

  const explainSubmissionErrors = useCallback(async () => {
    if (!activePageModule || !activeModuleContent) return
    const failedIds = new Set(checkResults.filter(r => !r.passed).map(r => r.id))
    const failedChecks = activeModuleContent.checks.filter(c => failedIds.has(c.id))
    if (failedChecks.length === 0) return

    setIsExplainingErrors(true)
    try {
      const res = await llmService.reviewSubmission({
        module: {
          id: activePageModule.id,
          title: activePageModule.title,
          task: activeModuleContent.task,
          learningObjective: activePageModule.learningObjective
        },
        userFiles,
        failedChecks
      })
      setErrorExplanation(res.review)
    } catch (err: any) {
      setErrorExplanation({
        feedback: err?.message || 'Unable to reach AI mentor right now.',
        suggestions: ['Verify the selectors and requirements listed in the Task tab and re-run Check My Work.']
      })
    } finally {
      setIsExplainingErrors(false)
    }
  }, [activeModuleContent, activePageModule, checkResults, userFiles])

  const applySolutionToEditor = useCallback(() => {
    if (!activeProjectId || !activePageModule || !activeModuleContent) return
    const attempts = moduleProgress?.attempts || 0
    if (attempts < 3 && !moduleProgress?.passed) return

    const solutionMap: Record<string, string> = {}
    for (const f of activeModuleContent.solutionFiles) {
      solutionMap[f.path] = f.content
    }
    setUserFiles(solutionMap)
    setCodeFiles(solutionMap)
    storageService.saveUserFiles(activeProjectId, activePageModule.id, solutionMap)

    const scopedKey = `${activeProjectId}:${activePageModule.id}`
    const updated: LearnerProgress = {
      ...(moduleProgress || {
        userId: currentUser.id,
        moduleId: scopedKey,
        passed: false,
        attempts: 3,
        hintsUsed: 0,
        usedSolution: false,
        completedWithSolution: false
      }),
      usedSolution: true,
      completedWithSolution: true
    }
    setModuleProgress(updated)
    setAllProgress(prev => ({ ...prev, [scopedKey]: updated }))
    storageService.saveLearnerProgress(updated)
  }, [activeModuleContent, activePageModule, activeProjectId, currentUser.id, moduleProgress])

  const advanceToNextPageModule = useCallback(async () => {
    if (!activePageModule) return
    const idx = activeModules.findIndex(m => m.id === activePageModule.id)
    if (idx !== -1 && idx + 1 < activeModules.length) {
      const nextMod = activeModules[idx + 1]
      await openModuleInWorkspace(nextMod.id)
    } else {
      setIsPageComplete(true)
    }
  }, [activeModules, activePageModule, openModuleInWorkspace])

  const downloadProjectZip = async () => {
    const filesToZip = Object.keys(userFiles).length > 0 ? userFiles : codeFiles
    const zip = new JSZip()
    for (const [path, content] of Object.entries(filesToZip)) {
      zip.file(path, content)
    }
    zip.file(
      'package.json',
      JSON.stringify(
        {
          name: (activeSpec?.appName || 'ascent-project').toLowerCase().replace(/[^a-z0-9]/g, '-'),
          private: true,
          version: '1.0.0',
          type: 'module'
        },
        null,
        2
      )
    )

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
        activePageModule,
        activeModuleContent,
        isLoadingModule,
        moduleLoadError,
        userFiles,
        moduleProgress,
        allProgress,
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
        projects,
        activeProject,
        selectProject,
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
        restoreStarterCode
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
