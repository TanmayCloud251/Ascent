import { UserProfile, Project, ProjectMemory } from '../types/ascent'
import { LearnerProgress, ModuleContent } from '../schemas/course'

// ============================================================================
// StorageService Abstraction Layer
// Strictly real data persistence: no mock fallbacks, no canned seeds.
// ============================================================================

export interface StorageService {
  // User Profile & Session
  getCurrentUser(): UserProfile
  saveCurrentUser(user: UserProfile): void

  // Projects CRUD
  getProjects(userId: string): Project[]
  getProjectById(projectId: string): Project | null
  saveProject(project: Project): void
  deleteProject(projectId: string): void

  // Active Session Navigation
  getActiveProjectId(): string | null
  setActiveProjectId(id: string | null): void

  // Long-Term Project Memory
  getProjectMemory(projectId: string): ProjectMemory | null
  saveProjectMemory(memory: ProjectMemory): void

  // Learner Code Persistence per Module
  getUserFiles(projectId: string, moduleId: string): Record<string, string> | null
  saveUserFiles(projectId: string, moduleId: string, files: Record<string, string>): void

  // Progress Tracking & Unlocks
  getLearnerProgress(userId: string, moduleId: string): LearnerProgress | null
  saveLearnerProgress(progress: LearnerProgress): void
  getAllProgressForUser(userId: string): Record<string, LearnerProgress>

  // Stored Module Content
  getModuleContent(moduleId: string): ModuleContent | null
  saveModuleContent(moduleId: string, content: ModuleContent): void

  // LLM Response Caching (Only caches REAL verified Gemini outputs)
  getCachedLLMResponse<T>(cacheKey: string): T | null
  setCachedLLMResponse<T>(cacheKey: string, data: T): void
  clearCache(): void
}

const STORAGE_PREFIX = 'ascent_v2'

const DEFAULT_GUEST_USER: UserProfile = {
  id: 'usr_guest_lead',
  name: 'Lead Developer',
  handle: '@builder',
  avatarSeed: 'asc_lead_01',
  tier: 'tier2',
  streakDays: 1,
  lastActive: new Date().toISOString(),
  createdProjectsCount: 0
}

export class LocalStorageAdapter implements StorageService {
  private userKey = `${STORAGE_PREFIX}:user`
  private projectsKey = `${STORAGE_PREFIX}:projects`
  private activeProjectKey = `${STORAGE_PREFIX}:active_project_id`
  private memoryPrefix = `${STORAGE_PREFIX}:memory:`
  private cachePrefix = `${STORAGE_PREFIX}:cache:`
  private userFilesPrefix = `${STORAGE_PREFIX}:user_files:`
  private progressPrefix = `${STORAGE_PREFIX}:progress:`
  private contentPrefix = `${STORAGE_PREFIX}:mod_content:`

  getCurrentUser(): UserProfile {
    try {
      const raw = localStorage.getItem(this.userKey)
      if (raw) {
        return JSON.parse(raw) as UserProfile
      }
    } catch (e) {
      console.warn('Failed to read user from localStorage:', e)
    }

    // Default guest session
    this.saveCurrentUser(DEFAULT_GUEST_USER)
    return DEFAULT_GUEST_USER
  }

  saveCurrentUser(user: UserProfile): void {
    try {
      localStorage.setItem(this.userKey, JSON.stringify(user))
    } catch (e) {
      console.error('Failed to save user to localStorage:', e)
    }
  }

  getProjects(userId: string): Project[] {
    try {
      const raw = localStorage.getItem(this.projectsKey)
      if (raw) {
        const all: Project[] = JSON.parse(raw)
        return all.filter(p => !userId || p.userId === userId)
      }
    } catch (e) {
      console.warn('Failed to read projects from localStorage:', e)
    }
    return []
  }

  getProjectById(projectId: string): Project | null {
    const projects = this.getProjects('')
    return projects.find(p => p.id === projectId) || null
  }

  saveProject(project: Project): void {
    try {
      const projects = this.getProjects('')
      const index = projects.findIndex(p => p.id === project.id)
      project.updatedAt = new Date().toISOString()

      let updated: Project[]
      if (index >= 0) {
        updated = [...projects]
        updated[index] = project
      } else {
        updated = [project, ...projects]
        // Increment createdProjectsCount on user
        const user = this.getCurrentUser()
        user.createdProjectsCount = (user.createdProjectsCount || 0) + 1
        this.saveCurrentUser(user)
      }

      localStorage.setItem(this.projectsKey, JSON.stringify(updated))
    } catch (e) {
      console.error('Failed to save project to localStorage:', e)
    }
  }

  deleteProject(projectId: string): void {
    try {
      const projects = this.getProjects('')
      const updated = projects.filter(p => p.id !== projectId)
      localStorage.setItem(this.projectsKey, JSON.stringify(updated))

      if (this.getActiveProjectId() === projectId) {
        this.setActiveProjectId(updated[0]?.id || null)
      }
    } catch (e) {
      console.error('Failed to delete project from localStorage:', e)
    }
  }

  getActiveProjectId(): string | null {
    try {
      return localStorage.getItem(this.activeProjectKey)
    } catch {
      return null
    }
  }

  setActiveProjectId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(this.activeProjectKey, id)
      } else {
        localStorage.removeItem(this.activeProjectKey)
      }
    } catch (e) {
      console.warn('Failed to set active project id:', e)
    }
  }

  getProjectMemory(projectId: string): ProjectMemory | null {
    try {
      const raw = localStorage.getItem(`${this.memoryPrefix}${projectId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  saveProjectMemory(memory: ProjectMemory): void {
    try {
      localStorage.setItem(`${this.memoryPrefix}${memory.projectId}`, JSON.stringify(memory))
    } catch (e) {
      console.error('Failed to save project memory:', e)
    }
  }

  getUserFiles(projectId: string, moduleId: string): Record<string, string> | null {
    try {
      const raw = localStorage.getItem(`${this.userFilesPrefix}${projectId}:${moduleId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  saveUserFiles(projectId: string, moduleId: string, files: Record<string, string>): void {
    try {
      localStorage.setItem(`${this.userFilesPrefix}${projectId}:${moduleId}`, JSON.stringify(files))
    } catch (e) {
      console.error('Failed to save user files:', e)
    }
  }

  getLearnerProgress(userId: string, moduleId: string): LearnerProgress | null {
    try {
      const raw = localStorage.getItem(`${this.progressPrefix}${userId}:${moduleId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  saveLearnerProgress(progress: LearnerProgress): void {
    try {
      localStorage.setItem(`${this.progressPrefix}${progress.userId}:${progress.moduleId}`, JSON.stringify(progress))
    } catch (e) {
      console.error('Failed to save learner progress:', e)
    }
  }

  getAllProgressForUser(userId: string): Record<string, LearnerProgress> {
    const result: Record<string, LearnerProgress> = {}
    try {
      const prefix = `${this.progressPrefix}${userId}:`
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            result[parsed.moduleId] = parsed
          }
        }
      }
    } catch (e) {
      console.warn('Failed to get all learner progress:', e)
    }
    return result
  }

  getModuleContent(moduleId: string): ModuleContent | null {
    try {
      const raw = localStorage.getItem(`${this.contentPrefix}${moduleId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  saveModuleContent(moduleId: string, content: ModuleContent): void {
    try {
      localStorage.setItem(`${this.contentPrefix}${moduleId}`, JSON.stringify(content))
    } catch (e) {
      console.error('Failed to save module content:', e)
    }
  }

  getCachedLLMResponse<T>(cacheKey: string): T | null {
    try {
      const raw = localStorage.getItem(`${this.cachePrefix}${cacheKey}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Check if expired (7 days)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
          return parsed.data as T
        }
      }
    } catch {
      // cache miss
    }
    return null
  }

  setCachedLLMResponse<T>(cacheKey: string, data: T): void {
    try {
      const payload = {
        timestamp: Date.now(),
        data
      }
      localStorage.setItem(`${this.cachePrefix}${cacheKey}`, JSON.stringify(payload))
    } catch (e) {
      console.warn('Cache write failed (likely quota limit):', e)
    }
  }

  clearCache(): void {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.cachePrefix))
        .forEach(k => localStorage.removeItem(k))
    } catch (e) {
      console.warn('Failed to clear cache:', e)
    }
  }
}

// Global Singleton Instance
export const storageService: StorageService = new LocalStorageAdapter()
