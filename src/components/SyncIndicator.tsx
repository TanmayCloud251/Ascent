import React, { useState, useEffect } from 'react'
import {
  GitBranch,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  GitCommitHorizontal
} from 'lucide-react'
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
    <div className="flex items-center gap-2 text-xs font-mono">
      {syncState.status === 'syncing' && (
        <div className="flex items-center gap-2 text-cyan-300 bg-cyan-950/50 border border-cyan-500/40 px-3 py-1 rounded-full shadow-[0_0_12px_-2px_rgba(6,182,212,0.4)] animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Syncing to GitHub...</span>
        </div>
      )}

      {syncState.status === 'synced' && (
        <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/40 border border-emerald-500/35 px-3 py-1 rounded-full shadow-sm">
          <GitCommitHorizontal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Synced</span>
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-white transition flex items-center gap-0.5 ml-0.5"
              title="Open GitHub Repository"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {syncState.status === 'failed' && (
        <div className="flex items-center gap-2 text-rose-300 bg-rose-950/40 border border-rose-500/40 px-3 py-1 rounded-full shadow-sm">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Sync pending</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-[11px] font-bold underline hover:text-white ml-1 cursor-pointer"
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
          className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 bg-slate-900/90 border border-slate-800 hover:border-cyan-500/30 px-3 py-1 rounded-full transition shadow-sm"
          title="Open repository on GitHub"
        >
          <GitBranch className="w-3 h-3 text-cyan-400" />
          <span>Repo</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
        </a>
      )}
    </div>
  )
}
