import React, { createContext, useContext, useState } from 'react'
import {
  ScreenIndex,
  Project,
  PlannedPage,
  LearningModule,
  LearnerProfile,
  CalibrationTier
} from '../types'

// Pre-populated initial project for instant demo & interactive experience
const MOCK_MODULE_02: LearningModule = {
  id: 'mod-02',
  componentId: 'comp-cart-drawer',
  title: 'Zustand vs React Context',
  theoryMarkdown: `In high-frequency e-commerce UI (like cart drawer increments), Context triggers full subtree re-renders whenever \`items[]\` updates. Zustand allows selective subscription via atom slices.

### Recommended Implementation
\`\`\`typescript
// src/store/useCartStore.ts
export const useCartStore = create((set) => ({
  items: [],
  addItem: (sku, qty) => set((state) => ({ items: [...state.items, { sku, qty }] })),
  optimisticQty: 0
}))
\`\`\``,
  initialFiles: {
    'src/components/cart/CartDrawer.tsx': `import React from 'react'
import { useCartStore } from '../../store/useCartStore'

export const CartDrawer = () => {
  // TODO: ASCENT_MODULE_TASK - Wire Zustand optimistic cart badge
  const totalItems = 0; // replace with state selector

  return (
    <div className="cart-drawer p-4 bg-slate-900 border border-cyan-500/30 rounded-lg">
      <h3 className="text-lg font-bold text-white">Shopping Cart</h3>
      <p className="text-sm text-cyan-400">Items in cart: {totalItems}</p>
      {/* Slide-over cart items list */}
    </div>
  );
};`,
    'src/store/useCartStore.ts': `// Zustand store setup for cart drawer optimistic state
export interface CartItem {
  sku: string;
  qty: number;
}
`
  },
  coreInterfaces: [
    { name: 'useCartStore()', type: 'Hook' },
    { name: 'addItem(sku, qty)', type: 'Action' },
    { name: 'optimisticQty', type: 'Derived state' }
  ],
  targetMinutes: 15,
  hints: [
    {
      id: 'h1',
      hintOrder: 1,
      content: 'Make sure to apply aria-expanded and role="dialog" on your overlay wrapper. The test runner checks accessibility tags before snapshot matching!',
      pointCost: 0,
      unlocked: true
    },
    {
      id: 'h2',
      hintOrder: 2,
      content: 'Use Zustand custom selector `(state) => state.items.reduce((acc, item) => acc + item.qty, 0)` to prevent redundant re-renders.',
      pointCost: 10,
      unlocked: false
    }
  ],
  testCases: [
    {
      id: 't1',
      description: 'CartDrawer renders optimistic count badge correctly',
      testCode: 'expect(screen.getByText(/Items in cart/i)).toBeInTheDocument()',
      passed: true
    },
    {
      id: 't2',
      description: 'Zustand store updates items array without full subtree re-render',
      testCode: 'expect(useCartStore.getState().items).toBeDefined()',
      passed: false
    }
  ],
  tasks: [
    {
      id: 'task-1',
      title: '01. SHELL & LAYOUT',
      status: 'passed',
      subtasks: [{ id: 'st1', title: 'Next.js App Router root layout & font loading', completed: true }]
    },
    {
      id: 'task-2',
      title: '02. CART DRAWER & STATE',
      status: 'active',
      subtasks: [
        { id: 'st2a', title: 'a. Zustand store setup', completed: true },
        { id: 'st2b', title: 'b. Slide-over drawer component', completed: true },
        { id: 'st2c', title: 'c. Optimistic quantity badge', completed: false }
      ]
    },
    {
      id: 'task-3',
      title: '03. STRIPE INTENT HANDLER',
      status: 'locked',
      subtasks: [{ id: 'st3', title: 'Payment gateway client & tokenization', completed: false }]
    },
    {
      id: 'task-4',
      title: '04. WEBHOOK & PERSISTENCE',
      status: 'locked',
      subtasks: [{ id: 'st4', title: 'Stripe signature verification & DB insert', completed: false }]
    }
  ],
  status: 'active'
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'E-Commerce Storefront & Cart',
    prompt: 'e-commerce app using React and Tailwind',
    status: 'active',
    techStack: ['Next.js 15', 'Zustand', 'Stripe'],
    plannedScreens: [
      { id: 'p1', name: 'Storefront & Hero', description: 'Curated product grid with instant category filtering', pageOrder: 1, status: 'completed', components: [] },
      { id: 'p2', name: 'Product Detail & Specs', description: 'Interactive variant selector & live stock availability', pageOrder: 2, status: 'completed', components: [] },
      { id: 'p3', name: 'Slide-Over Cart Drawer', description: 'Optimistic state updates & subtotal calculation', pageOrder: 3, status: 'active', components: [{ id: 'c1', name: 'CartDrawer', selectorOrPath: 'src/components/cart/CartDrawer.tsx', module: MOCK_MODULE_02 }] },
      { id: 'p4', name: 'Stripe Checkout & Order Flow', description: 'Secure payment intent handling & webhooks', pageOrder: 4, status: 'pending', components: [] },
      { id: 'p5', name: 'User Auth & Order History', description: 'JWT session persistence & receipts', pageOrder: 5, status: 'pending', components: [] }
    ],
    activePageId: 'p3',
    activeModuleId: 'mod-02',
    totalScreens: 8,
    completedScreens: 5,
    lastActiveFormatted: 'active 24m ago',
    createdAt: '2026-09-24'
  },
  {
    id: 'proj-2',
    title: 'Realtime AI Agent Cockpit',
    prompt: 'multi-agent orchestrator with WebSocket streaming',
    status: 'active',
    techStack: ['FastAPI', 'WebSockets', 'Redis'],
    plannedScreens: [
      { id: 'pa1', name: 'Agent Fleet Dashboard', description: 'Live agent health grid & token metrics', pageOrder: 1, status: 'completed', components: [] },
      { id: 'pa2', name: 'Interactive Prompt Canvas', description: 'Streaming markdown log output', pageOrder: 2, status: 'active', components: [] }
    ],
    totalScreens: 6,
    completedScreens: 2,
    lastActiveFormatted: 'active 2d ago',
    createdAt: '2026-09-22'
  },
  {
    id: 'proj-3',
    title: 'Distributed Telemetry Dashboard',
    prompt: 'ClickHouse metrics ingest pipeline with sparklines',
    status: 'completed',
    techStack: ['Go', 'ClickHouse', 'Tailwind'],
    plannedScreens: [],
    totalScreens: 4,
    completedScreens: 4,
    lastActiveFormatted: 'active 1w ago',
    createdAt: '2026-09-15'
  }
]

interface AppContextType {
  currentScreen: ScreenIndex;
  setScreen: (screen: ScreenIndex) => void;
  projects: Project[];
  activeProject: Project | null;
  selectProject: (id: string) => void;
  createNewProject: (promptText: string, customStack?: string[]) => void;
  confirmScope: (screens: PlannedPage[]) => void;
  addScreenToScope: (name: string, description: string) => void;
  removeScreenFromScope: (id: string) => void;
  learnerProfile: LearnerProfile;
  setCalibrationTier: (tier: CalibrationTier) => void;
  activeModule: LearningModule;
  activeFile: string;
  setActiveFile: (file: string) => void;
  codeFiles: Record<string, string>;
  updateFileCode: (filePath: string, newCode: string) => void;
  runTestCases: () => void;
  isTestRunning: boolean;
  testStatus: 'not_run' | 'running' | 'pass' | 'fail';
  unlockHint: (hintId: string) => void;
  clarifyingQuestionAnswered: boolean;
  setClarifyingAnswered: (ans: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setScreen] = useState<ScreenIndex>(1)
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-1')
  const [clarifyingQuestionAnswered, setClarifyingAnswered] = useState<boolean>(false)
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<'not_run' | 'running' | 'pass' | 'fail'>('not_run')

  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>({
    name: 'Dev',
    email: 'learner@ascent.ai',
    calibrationTier: 'tier_2',
    streakDays: 12,
    activeProjectId: 'proj-1'
  })

  const [activeModule, setActiveModule] = useState<LearningModule>(MOCK_MODULE_02)
  const [activeFile, setActiveFile] = useState<string>('src/components/cart/CartDrawer.tsx')
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>(MOCK_MODULE_02.initialFiles)

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0]

  const selectProject = (id: string) => {
    setActiveProjectId(id)
    setScreen(4)
  }

  const createNewProject = (promptText: string, customStack: string[] = ['React 19', 'Next.js', 'TailwindCSS', 'SQLite']) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      title: promptText.length > 28 ? promptText.substring(0, 28) + '...' : promptText,
      prompt: promptText,
      status: 'planning',
      techStack: customStack,
      plannedScreens: [
        { id: 'p-1', name: 'Storefront & Navigation', description: 'Curated product catalog & filter pills', pageOrder: 1, status: 'active', components: [] },
        { id: 'p-2', name: 'Product Detail & Specs', description: 'Interactive variant selector & inventory query', pageOrder: 2, status: 'pending', components: [] },
        { id: 'p-3', name: 'Slide-Over Cart Drawer', description: 'State persistence & subtotal calculation', pageOrder: 3, status: 'pending', components: [] },
        { id: 'p-4', name: 'Checkout & Order History', description: 'Payment gateway integration & receipts', pageOrder: 4, status: 'pending', components: [] }
      ],
      totalScreens: 4,
      completedScreens: 0,
      lastActiveFormatted: 'active just now',
      createdAt: new Date().toISOString()
    }

    setProjects([newProj, ...projects])
    setActiveProjectId(newProj.id)
    // If prompt contains 'ecommerce' or ambiguous term, trigger clarifying question on Screen 2
    setClarifyingAnswered(false)
    setScreen(2)
  }

  const confirmScope = (screens: PlannedPage[]) => {
    if (activeProject) {
      setProjects(projects.map(p => p.id === activeProject.id ? { ...p, status: 'active', plannedScreens: screens, totalScreens: screens.length } : p))
    }
    setScreen(3)
  }

  const addScreenToScope = (name: string, description: string) => {
    if (!activeProject) return
    const newPage: PlannedPage = {
      id: `p-${Date.now()}`,
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
  }

  const updateFileCode = (filePath: string, newCode: string) => {
    setCodeFiles({ ...codeFiles, [filePath]: newCode })
  }

  const unlockHint = (hintId: string) => {
    const updatedHints = activeModule.hints.map(h => h.id === hintId ? { ...h, unlocked: true } : h)
    setActiveModule({ ...activeModule, hints: updatedHints })
  }

  const runTestCases = () => {
    setIsTestRunning(true)
    setTestStatus('running')

    setTimeout(() => {
      setIsTestRunning(false)
      const isPassed = true
      setTestStatus(isPassed ? 'pass' : 'fail')
      if (isPassed) {
        // Update module task status
        const updatedTasks = activeModule.tasks.map(t => t.id === 'task-2' ? { ...t, status: 'passed' as const } : t)
        setActiveModule({ ...activeModule, tasks: updatedTasks, status: 'passed' })
      }
    }, 1200)
  }

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setScreen,
        projects,
        activeProject,
        selectProject,
        createNewProject,
        confirmScope,
        addScreenToScope,
        removeScreenFromScope,
        learnerProfile,
        setCalibrationTier,
        activeModule,
        activeFile,
        setActiveFile,
        codeFiles,
        updateFileCode,
        runTestCases,
        isTestRunning,
        testStatus,
        unlockHint,
        clarifyingQuestionAnswered,
        setClarifyingAnswered
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
