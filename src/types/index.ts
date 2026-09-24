export type ScreenIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type ProjectStatus = 'draft' | 'planning' | 'active' | 'completed';
export type PageStatus = 'pending' | 'generated' | 'active' | 'completed';
export type ModuleStatus = 'locked' | 'active' | 'passed';
export type CalibrationTier = 'tier_1' | 'tier_2' | 'tier_3' | 'external';

export interface TestCase {
  id: string;
  description: string;
  testCode: string;
  passed?: boolean;
}

export interface Hint {
  id: string;
  hintOrder: number;
  content: string;
  pointCost: number;
  unlocked: boolean;
}

export interface ModuleTask {
  id: string;
  title: string;
  status: 'passed' | 'active' | 'locked';
  subtasks: { id: string; title: string; completed: boolean }[];
}

export interface LearningModule {
  id: string;
  componentId: string;
  title: string;
  theoryMarkdown: string;
  initialFiles: Record<string, string>;
  coreInterfaces: { name: string; type: string }[];
  targetMinutes: number;
  hints: Hint[];
  testCases: TestCase[];
  tasks: ModuleTask[];
  status: ModuleStatus;
}

export interface ComponentItem {
  id: string;
  name: string;
  selectorOrPath: string;
  module?: LearningModule;
}

export interface PlannedPage {
  id: string;
  name: string;
  description: string;
  pageOrder: number;
  status: PageStatus;
  components: ComponentItem[];
}

export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: ProjectStatus;
  techStack: string[];
  plannedScreens: PlannedPage[];
  activePageId?: string;
  activeModuleId?: string;
  totalScreens: number;
  completedScreens: number;
  lastActiveFormatted: string;
  createdAt: string;
}

export interface LearnerProfile {
  name: string;
  email: string;
  calibrationTier: CalibrationTier;
  streakDays: number;
  activeProjectId?: string;
}
