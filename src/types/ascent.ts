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
  avatarInitials?: string
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
  runtime: 'HTML + CSS + JavaScript'
  styling: 'Tailwind CSS' | 'Plain CSS'
  stateManagement: 'Browser In-Memory State / DOM'
  backendSim: 'In-Browser LocalStorage / IndexedDB'
  useTailwind: boolean
}

export interface FeatureItem {
  name: string
  description: string
}

export interface UserFlowItem {
  flowName: string
  steps: string[]
}

export interface DataEntityField {
  name: string
  type: string
  description?: string
}

export interface DataEntity {
  name: string
  storageKey: string
  fields: DataEntityField[]
}

export interface ProjectSpec {
  appName: string
  tagline: string
  summary: string
  targetAudience: string
  primaryFeatures: FeatureItem[]
  userFlows: UserFlowItem[]
  dataEntities: DataEntity[]
  techStack: TechStackConfig
  useTailwind: boolean
  architectureHighlights: string[]
  assumptions: string[]
  outOfScope: string[]
  estimatedScreenCount: number
  difficulty: 'beginner' | 'intermediate'
  estimatedHours: number
}

// Zod Schemas
export const FeatureItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5)
})

export const UserFlowItemSchema = z.object({
  flowName: z.string().min(2),
  steps: z.array(z.string()).min(2)
})

export const DataEntityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional()
})

export const DataEntitySchema = z.object({
  name: z.string(),
  storageKey: z.string(),
  fields: z.array(DataEntityFieldSchema).min(1)
})

export const TechStackConfigSchema = z.object({
  runtime: z.literal('HTML + CSS + JavaScript').default('HTML + CSS + JavaScript'),
  styling: z.enum(['Tailwind CSS', 'Plain CSS']).default('Tailwind CSS'),
  stateManagement: z.literal('Browser In-Memory State / DOM').default('Browser In-Memory State / DOM'),
  backendSim: z.literal('In-Browser LocalStorage / IndexedDB').default('In-Browser LocalStorage / IndexedDB'),
  useTailwind: z.boolean().default(true)
})

export const ProjectSpecSchema = z.object({
  appName: z.string().min(2),
  tagline: z.string().min(5),
  summary: z.string().min(10),
  targetAudience: z.string().default('General Web Users'),
  primaryFeatures: z.array(FeatureItemSchema).min(2),
  userFlows: z.array(UserFlowItemSchema).min(2).max(4).default([]),
  dataEntities: z.array(DataEntitySchema).min(1).default([]),
  techStack: TechStackConfigSchema,
  useTailwind: z.boolean().default(true),
  architectureHighlights: z.array(z.string()).min(2),
  assumptions: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()).min(1),
  estimatedScreenCount: z.number().int().min(1).max(8).default(3),
  difficulty: z.enum(['beginner', 'intermediate']).default('beginner'),
  estimatedHours: z.number().min(1).max(20).default(4)
})

export type ProjectStatus = 'draft_spec' | 'spec_confirmed' | 'in_progress' | 'completed'

// ============================================================================
// Slice 2 Revised: Page + Component Syllabus
// ============================================================================

export type ComponentType =
  | 'document-head'
  | 'body-layout'
  | 'header'
  | 'navigation'
  | 'main-section'
  | 'content-block'
  | 'form'
  | 'footer'
  | 'script-behavior'

export interface PageModuleItem {
  id: string
  pageId: string
  order: number
  title: string
  learningObjective: string
  componentType: ComponentType
  status: 'locked' | 'active' | 'done'
}

export const PageModuleItemSchema = z.object({
  title: z.string().min(2),
  learningObjective: z.string().min(6),
  componentType: z.enum([
    'document-head',
    'body-layout',
    'header',
    'navigation',
    'main-section',
    'content-block',
    'form',
    'footer',
    'script-behavior'
  ])
})

export interface PageItem {
  id: string
  projectId: string
  order: number
  name: string
  description: string
  fileName: string // e.g. index.html
  purpose: string
  status: 'active' | 'done'
  modules: PageModuleItem[]
}

export const PageResponseSchema = z
  .object({
    projectComplete: z.boolean().default(false),
    page: z
      .object({
        name: z.string().min(2),
        description: z.string().min(6),
        fileName: z.string().min(4),
        purpose: z.string().min(6)
      })
      .optional(),
    modules: z.array(PageModuleItemSchema).min(4).max(10).optional()
  })
  .superRefine((val, ctx) => {
    if (!val.projectComplete && (!val.page || !val.modules || val.modules.length < 4)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Incomplete page syllabus when projectComplete is false'
      })
    }
  })

export type PageResponse = z.infer<typeof PageResponseSchema>

export type ProjectSource = 'curated' | 'generated'

export interface Project {
  id: string
  userId: string
  userPrompt: string
  spec: ProjectSpec
  useTailwind: boolean
  currentPageIndex: number
  pages: PageItem[]
  status: ProjectStatus
  source: ProjectSource
  curatedSlug?: string
  createdAt: string
  updatedAt: string
}

export interface CompletedPageSummary {
  id: string
  name: string
  fileName: string
  description: string
  purpose: string
}

export interface ProjectMemory {
  projectId: string
  techStack: string
  useTailwind: boolean
  namingConventions: string[]
  fileTree: string[]
  decisionsMade: string[]
  completedFiles: Record<string, string>
  completedPages?: CompletedPageSummary[]
  assets?: Array<{
    path: string
    assetRef: string
    mimeType: string
    size?: number
    isProvided?: boolean
  }>
}


