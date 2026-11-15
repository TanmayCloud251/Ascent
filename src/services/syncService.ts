import { LearnerProgress } from '../schemas/course'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed'

export interface SyncStatusState {
  status: SyncStatus
  lastSyncedAt?: Date
  error?: string
}

type SyncListener = (state: SyncStatusState) => void

class SyncService {
  private isDirty = false
  private idleTimer: any = null
  private listeners = new Set<SyncListener>()
  private currentState: SyncStatusState = { status: 'idle' }
  private pendingPayload: {
    projectId?: string
    progress?: LearnerProgress[]
    files?: Record<string, string>
    completedModule?: { moduleIndex: number; moduleTitle: string }
    allModules?: Array<{ id: string; title: string; learningObjective?: string }>
    completedPages?: string[]
  } = {}

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    listener(this.currentState)
    return () => this.listeners.delete(listener)
  }

  private updateStatus(status: SyncStatus, error?: string) {
    this.currentState = {
      status,
      lastSyncedAt: status === 'synced' ? new Date() : this.currentState.lastSyncedAt,
      error
    }
    this.listeners.forEach(l => {
      try {
        l(this.currentState)
      } catch (e) {
        console.warn('Sync listener error:', e)
      }
    })
  }

  getStatus(): SyncStatusState {
    return this.currentState
  }

  /**
   * Marks working copy dirty and starts a 30s debounced idle timer.
   */
  markDirty(data: {
    projectId: string
    files?: Record<string, string>
    progress?: LearnerProgress[]
  }) {
    this.isDirty = true
    this.pendingPayload = {
      ...this.pendingPayload,
      projectId: data.projectId,
      files: data.files || this.pendingPayload.files,
      progress: data.progress || this.pendingPayload.progress
    }

    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      if (this.isDirty) {
        this.syncNow()
      }
    }, 30000) // 30 seconds idle
  }

  /**
   * Immediately syncs pending state to server REST endpoints.
   */
  async syncNow(immediateOptions?: {
    projectId?: string
    progress?: LearnerProgress[]
    files?: Record<string, string>
    completedModule?: { moduleIndex: number; moduleTitle: string }
    allModules?: Array<{ id: string; title: string; learningObjective?: string }>
    completedPages?: string[]
  }): Promise<boolean> {
    if (this.idleTimer) clearTimeout(this.idleTimer)

    const payload = {
      ...this.pendingPayload,
      ...immediateOptions
    }

    if (!payload.projectId) {
      return true
    }

    this.updateStatus('syncing')
    try {
      const resp = await fetch('/api/sync/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!resp.ok) {
        const errText = await resp.text()
        this.updateStatus('failed', errText || `Sync HTTP ${resp.status}`)
        return false
      }

      this.isDirty = false
      this.pendingPayload = {}
      this.updateStatus('synced')
      return true
    } catch (err: any) {
      this.updateStatus('failed', err?.message || 'Network sync error')
      return false
    }
  }
}

export const syncService = new SyncService()

