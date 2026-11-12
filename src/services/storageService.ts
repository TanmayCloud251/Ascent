import { UserProfile, Project, ProjectMemory } from '../types/ascent'
import { LearnerProgress, ModuleContent, ProjectFile } from '../schemas/course'
import { projectFilesToTextMap, textMapToProjectFiles } from './fileUtils'

// ============================================================================
// StorageService Abstraction Layer
// Strictly real data persistence: no mock fallbacks, no canned seeds.
// ============================================================================

export interface StoredAssetRecord {
  assetRef: string
  projectId: string
  path: string
  mimeType: string
  size: number
  blob: Blob
}

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

  // Learner Code Persistence per Module (legacy text map + rich ProjectFile tree)
  getUserFiles(projectId: string, moduleId: string): Record<string, string> | null
  saveUserFiles(projectId: string, moduleId: string, files: Record<string, string>): void
  getProjectFiles(projectId: string, moduleId: string): ProjectFile[] | null
  saveProjectFiles(projectId: string, moduleId: string, files: ProjectFile[]): void
  getProjectFolders(projectId: string): string[]
  saveProjectFolders(projectId: string, folders: string[]): void

  // Binary Assets Persistence (IndexedDB + memory fallback in headless tests)
  saveAssetBlob(record: StoredAssetRecord): Promise<void>
  getAssetBlob(assetRef: string): Promise<StoredAssetRecord | null>
  deleteAssetBlob(assetRef: string): Promise<void>
  deleteProjectAssets(projectId: string): Promise<void>

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

const IDB_DB_NAME = 'ascent_assets_db'
const IDB_STORE_NAME = 'assets'
const IDB_VERSION = 1

const memoryAssetStore = new Map<string, StoredAssetRecord>()

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        const store = db.createObjectStore(IDB_STORE_NAME, { keyPath: 'assetRef' })
        store.createIndex('by_projectId', 'projectId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'))
  })
}

export async function blobToDataUrl(blob: Blob, fallbackMimeType?: string): Promise<string> {
  const mimeType = blob.type || fallbackMimeType || 'application/octet-stream'
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const res = typeof reader.result === 'string' ? reader.result : ''
        resolve(res)
      }
      reader.onerror = () => reject(reader.error || new Error('Failed to read asset blob'))
      reader.readAsDataURL(blob)
    })
  }
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}

const STORAGE_PREFIX = 'ascent_v2'

const DEFAULT_GUEST_USER: UserProfile = {
  id: 'usr_guest_lead',
  name: 'Lead Developer',
  handle: '@builder',
  avatarSeed: 'asc_lead_01',
  tier: 'tier2',
  streakDays: 0,
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
  private projectFilesPrefix = `${STORAGE_PREFIX}:project_files:`
  private foldersPrefix = `${STORAGE_PREFIX}:folders:`
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

      localStorage.removeItem(`${this.memoryPrefix}${projectId}`)
      localStorage.removeItem(`${this.foldersPrefix}${projectId}`)
      localStorage.removeItem(`${STORAGE_PREFIX}:active_module_id:${projectId}`)
      localStorage.removeItem(`${STORAGE_PREFIX}:completion_view:${projectId}`)

      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (
          key.startsWith(`${this.userFilesPrefix}${projectId}:`) ||
          key.startsWith(`${this.projectFilesPrefix}${projectId}:`) ||
          key.startsWith(`${this.contentPrefix}${projectId}__`) ||
          (key.startsWith(this.progressPrefix) && key.includes(`:${projectId}__`))
        ) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key)
      }

      void this.deleteProjectAssets(projectId)
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

  getProjectFiles(projectId: string, moduleId: string): ProjectFile[] | null {
    try {
      const raw = localStorage.getItem(`${this.projectFilesPrefix}${projectId}:${moduleId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed as ProjectFile[]
        }
      }
      // Graceful migration from legacy text-only storage
      const legacy = this.getUserFiles(projectId, moduleId)
      if (legacy) {
        return textMapToProjectFiles(legacy)
      }
      return null
    } catch {
      return null
    }
  }

  saveProjectFiles(projectId: string, moduleId: string, files: ProjectFile[]): void {
    try {
      localStorage.setItem(`${this.projectFilesPrefix}${projectId}:${moduleId}`, JSON.stringify(files))
      // Keep legacy text map synchronized for compatibility
      this.saveUserFiles(projectId, moduleId, projectFilesToTextMap(files))
    } catch (e) {
      console.error('Failed to save project files:', e)
    }
  }

  getProjectFolders(projectId: string): string[] {
    try {
      const raw = localStorage.getItem(`${this.foldersPrefix}${projectId}`)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : []
    } catch {
      return []
    }
  }

  saveProjectFolders(projectId: string, folders: string[]): void {
    try {
      const unique = Array.from(new Set(folders.map(f => f.trim()).filter(Boolean))).sort()
      localStorage.setItem(`${this.foldersPrefix}${projectId}`, JSON.stringify(unique))
    } catch (e) {
      console.error('Failed to save project folders:', e)
    }
  }

  async saveAssetBlob(record: StoredAssetRecord): Promise<void> {
    memoryAssetStore.set(record.assetRef, record)
    if (!hasIndexedDB()) return
    try {
      const db = await openAssetDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
        const store = tx.objectStore(IDB_STORE_NAME)
        store.put(record)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error || new Error('IndexedDB saveAssetBlob failed'))
        }
      })
    } catch (e) {
      console.warn('IndexedDB saveAssetBlob fell back to memory store:', e)
    }
  }

  async getAssetBlob(assetRef: string): Promise<StoredAssetRecord | null> {
    if (!hasIndexedDB()) {
      return memoryAssetStore.get(assetRef) || null
    }
    try {
      const db = await openAssetDb()
      const found = await new Promise<StoredAssetRecord | null>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly')
        const store = tx.objectStore(IDB_STORE_NAME)
        const req = store.get(assetRef)
        req.onsuccess = () => resolve((req.result as StoredAssetRecord | undefined) || null)
        req.onerror = () => reject(req.error || new Error('IndexedDB getAssetBlob failed'))
        tx.oncomplete = () => db.close()
        tx.onerror = () => db.close()
      })
      if (found) {
        memoryAssetStore.set(assetRef, found)
        return found
      }
    } catch (e) {
      console.warn('IndexedDB getAssetBlob failed, checking memory store:', e)
    }
    return memoryAssetStore.get(assetRef) || null
  }

  async deleteAssetBlob(assetRef: string): Promise<void> {
    memoryAssetStore.delete(assetRef)
    if (!hasIndexedDB()) return
    try {
      const db = await openAssetDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
        tx.objectStore(IDB_STORE_NAME).delete(assetRef)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error || new Error('IndexedDB deleteAssetBlob failed'))
        }
      })
    } catch (e) {
      console.warn('IndexedDB deleteAssetBlob failed:', e)
    }
  }

  async deleteProjectAssets(projectId: string): Promise<void> {
    for (const [key, rec] of memoryAssetStore.entries()) {
      if (rec.projectId === projectId) {
        memoryAssetStore.delete(key)
      }
    }
    if (!hasIndexedDB()) return
    try {
      const db = await openAssetDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
        const store = tx.objectStore(IDB_STORE_NAME)
        const index = store.index('by_projectId')
        const req = index.getAllKeys(IDBKeyRange.only(projectId))
        req.onsuccess = () => {
          const keys = req.result || []
          for (const key of keys) {
            store.delete(key)
          }
        }
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error || new Error('IndexedDB deleteProjectAssets failed'))
        }
      })
    } catch (e) {
      console.warn('IndexedDB deleteProjectAssets failed:', e)
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
