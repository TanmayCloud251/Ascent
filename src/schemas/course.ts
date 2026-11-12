import { z } from 'zod'

// ============================================================================
// Shared Declarative DOM Check Schema
// Runs in preview iframe or headless JSDOM test harness
// ============================================================================

export const CheckTypeSchema = z.enum([
  'elementExists',
  'textContains',
  'attributeEquals',
  'styleEquals',
  'eventResult',
  'scriptDefines'
])
export type CheckType = z.infer<typeof CheckTypeSchema>

export const CheckSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: CheckTypeSchema,
  selector: z.string().optional(),
  expected: z.string().optional(),
  action: z.string().optional()
})
export type Check = z.infer<typeof CheckSchema>

// ============================================================================
// File Entry Schema
// ============================================================================

export const FileEntrySchema = z.object({
  path: z.string(),
  content: z.string()
})
export type FileEntry = z.infer<typeof FileEntrySchema>

// ============================================================================
// Project Specification Schema
// ============================================================================

export const FeatureItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5)
})
export type FeatureItem = z.infer<typeof FeatureItemSchema>

export const UserFlowItemSchema = z.object({
  flowName: z.string().min(2),
  steps: z.array(z.string()).min(2)
})
export type UserFlowItem = z.infer<typeof UserFlowItemSchema>

export const DataEntityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional()
})
export type DataEntityField = z.infer<typeof DataEntityFieldSchema>

export const DataEntitySchema = z.object({
  name: z.string(),
  storageKey: z.string(),
  fields: z.array(DataEntityFieldSchema).min(1)
})
export type DataEntity = z.infer<typeof DataEntitySchema>

export const TechStackConfigSchema = z.object({
  runtime: z.literal('HTML + CSS + JavaScript').default('HTML + CSS + JavaScript'),
  styling: z.enum(['Tailwind CSS', 'Plain CSS']).default('Tailwind CSS'),
  stateManagement: z.literal('Browser In-Memory State / DOM').default('Browser In-Memory State / DOM'),
  backendSim: z.literal('In-Browser LocalStorage / IndexedDB').default('In-Browser LocalStorage / IndexedDB'),
  useTailwind: z.boolean().default(true)
})
export type TechStackConfig = z.infer<typeof TechStackConfigSchema>

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
  estimatedScreenCount: z.number().int().min(1).max(8).default(1),
  difficulty: z.enum(['beginner', 'intermediate']).default('beginner'),
  estimatedHours: z.number().min(1).max(20).default(3)
})
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>

// ============================================================================
// Component Type & Module Schema
// ============================================================================

export const ComponentTypeSchema = z.enum([
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
export type ComponentType = z.infer<typeof ComponentTypeSchema>

export const ModuleSchema = z.object({
  id: z.string(),
  pageId: z.string().default('page_1'),
  order: z.number().int(),
  title: z.string().min(2),
  learningObjective: z.string().min(6),
  componentType: ComponentTypeSchema,
  status: z.enum(['locked', 'active', 'done']).default('locked')
})
export type Module = z.infer<typeof ModuleSchema>

// ============================================================================
// Module Content Schema (Slice 3 Live & Curated Shared Interchangeable Shape)
// ============================================================================

export const ModuleContentSchema = z.object({
  lesson: z.string(), // Markdown
  task: z.string(),   // Markdown
  starterFiles: z.array(FileEntrySchema),
  solutionFiles: z.array(FileEntrySchema),
  checks: z.array(CheckSchema).min(1),
  hints: z.array(z.string()).default([])
})
export type ModuleContent = z.infer<typeof ModuleContentSchema>

// Unified Full Module (Module Metadata + Content)
export const FullModuleSchema = ModuleSchema.merge(ModuleContentSchema)
export type FullModule = z.infer<typeof FullModuleSchema>

// ============================================================================
// Page Schema
// ============================================================================

export const PageSchema = z.object({
  id: z.string(),
  projectId: z.string().default('project_main'),
  order: z.number().int().default(1),
  name: z.string().min(2),
  description: z.string().min(6),
  fileName: z.string().min(4).default('index.html'),
  purpose: z.string().min(6),
  status: z.enum(['active', 'done']).default('active'),
  modules: z.array(ModuleSchema)
})
export type Page = z.infer<typeof PageSchema>

// ============================================================================
// Curated Course Schema
// ============================================================================

export const CuratedCourseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  difficulty: z.enum(['beginner', 'intermediate']),
  estimatedHours: z.number(),
  useTailwind: z.literal(false),
  spec: ProjectSpecSchema,
  page: PageSchema,
  modules: z.array(FullModuleSchema).min(4),
  finalFiles: z.array(FileEntrySchema)
})
export type CuratedCourse = z.infer<typeof CuratedCourseSchema>

export const CuratedCourseIndexItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  difficulty: z.enum(['beginner', 'intermediate']),
  estimatedHours: z.number()
})
export type CuratedCourseIndexItem = z.infer<typeof CuratedCourseIndexItemSchema>
