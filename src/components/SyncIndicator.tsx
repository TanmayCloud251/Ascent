import React, { useState, useEffect } from 'react'
import { GitBranch, Check, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'
import { syncService, SyncStatusState } from '../services/syncService'

interface SyncIndicatorProps {
  projectId?: string
  repoUrl?: string
  onRetry?: () => void
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ projectId, repoUrl, onRetry }) => {
  const [syncState, setSyncState] = useState<SyncStatusState>(syncService.getStatus())

  useEffect(() => {
    const unsubscribe = syncService.subscribe(state => {
      setSyncState(state)
    })
    return () => unsubscribe()
  }, [])

  if (!projectId) return null

  return (
    <div className="flex items-center gap-2 text-xs">
      {syncState.status === 'syncing' && (
        <div className="flex items-center gap-1.5 text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2.5 py-1 rounded-full animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing to GitHub...</span>
        </div>
      )}

      {syncState.status === 'synced' && (
        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full">
          <Check className="w-3.5 h-3.5" />
          <span>GitHub Synced</span>
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300 hover:text-white ml-0.5"
              title="Open GitHub Repository"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {syncState.status === 'failed' && (
        <div className="flex items-center gap-2 text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2.5 py-1 rounded-full">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Sync failed</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-[11px] font-semibold underline hover:text-white"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {syncState.status === 'idle' && repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full transition"
        >
          <GitBranch className="w-3 h-3" />
          <span>Repo</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  )
}

