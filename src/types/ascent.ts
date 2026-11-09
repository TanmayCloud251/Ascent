import { z } from 'zod'

// ============================================================================
// Ascent Data Models — Strictly Typed & Validated
// ============================================================================

export type UserTier = 'tier1' | 'tier2' | 'tier3' | 'review'

export interface UserProfile {
  id: string
  name: string
  handle: string
  avatarSeed: string
  tier: UserTier
  streakDays: number
  lastActive: string // ISO date
  createdProjectsCount: number
}

export interface ClarifyingQuestion {
  id: string
  question: string
  options: string[]
  selectedAnswer?: string
}

export interface TechStackConfig {
  runtime: 'React 19' | 'Vanilla DOM'
  styling: string
  stateManagement: string
  backendSim: string
}

export interface ProjectSpec {
  appName: string
  tagline: string
  summary: string
  targetAudience: string
  primaryFeatures: string[]
  techStack: TechStackConfig
  architectureHighlights: string[]
  clarifyingQuestions: ClarifyingQuestion[]
}

// Zod Schema for Gemini API validation
export const ClarifyingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2),
  selectedAnswer: z.string().optional()
})

export const TechStackConfigSchema = z.object({
  runtime: z.enum(['React 19', 'Vanilla DOM']).default('React 19'),
  styling: z.string().default('Tailwind CSS v4'),
  stateManagement: z.string().default('React State / Hooks'),
  backendSim: z.string().default('Browser In-Memory State')
})

export const ProjectSpecSchema = z.object({
  appName: z.string().min(2),
  tagline: z.string().min(5),
  summary: z.string().min(10),
  targetAudience: z.string().default('General Developers & Users'),
  primaryFeatures: z.array(z.string()).min(2),
  techStack: TechStackConfigSchema,
  architectureHighlights: z.array(z.string()).min(2),
  clarifyingQuestions: z.array(ClarifyingQuestionSchema).default([])
})

export type ProjectStatus = 'draft_spec' | 'spec_confirmed' | 'in_progress' | 'completed'

export interface ScreenPlanItem {
  id: string
  order: number
  screenName: string
  description: string
  estimatedModulesCount?: number
  keyComponents?: string[]
  status: 'locked' | 'active' | 'done'
}

export const ScreenPlanItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(6)
})

export const ScreenPlanResponseSchema = z.object({
  screens: z.array(ScreenPlanItemSchema).min(3).max(8)
})

export interface ModuleItem {
  id: string
  order: number
  title: string
  learningObjective: string
  componentType: string
  status: 'locked' | 'active' | 'done'
}

export const ModuleItemSchema = z.object({
  title: z.string().min(2),
  learningObjective: z.string().min(6),
  componentType: z.string().min(2)
})

export const SyllabusResponseSchema = z.object({
  screenName: z.string().optional(),
  modules: z.array(ModuleItemSchema).min(4).max(7)
})

export interface ModuleCheck {
  id: string
  description: string
  testCode?: string
  passed?: boolean
}

export interface Module {
  id: string
  screenId: string
  order: number
  title: string
  conceptSummary: string
  taskInstructions: string
  targetFile: string
  starterCode: string
  solutionCode?: string
  checks: ModuleCheck[]
  hints: string[]
  status: 'locked' | 'unlocked' | 'in_progress' | 'passed'
  userCode: string
}

export interface Project {
  id: string
  userId: string
  userPrompt: string
  spec: ProjectSpec
  screens: ScreenPlanItem[]
  currentScreenIndex: number
  modulesByScreen?: Record<string, ModuleItem[]>
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface ProjectMemory {
  projectId: string
  fileTree: string[]
  techStack: string
  namingConventions: string[]
  decisionsMade: string[]
  completedFiles: Record<string, string>
}

