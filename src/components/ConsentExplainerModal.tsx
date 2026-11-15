import React from 'react'
import { ShieldCheck, GitBranch, Lock, Key, X, ArrowRight } from 'lucide-react'

interface ConsentExplainerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export const ConsentExplainerModal: React.FC<ConsentExplainerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F111A] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GitHub Access Permission</h2>
            <p className="text-xs text-slate-400">What Ascent requests and why</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-300 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Private Repository Creation</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ascent creates a private repository named <code className="text-cyan-300 bg-cyan-950/50 px-1 py-0.5 rounded">ASCENT-&lt;project&gt;</code> on your personal GitHub account.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Automated Code Commits</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every time you pass a module's tests, Ascent commits your clean code files and updates the curriculum checklist README via GitHub's Git Data API.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Token Encryption & Privacy</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your token is encrypted at rest using AES-256-GCM. It is never logged and never sent to your browser. You can disconnect or revoke access at any time.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200">
            <strong>Least-Privilege Verification:</strong> GitHub personal account private repo creation requires a classic OAuth App with <code className="text-cyan-300">repo</code> scope to create repositories directly on personal profiles.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            {isLoading ? (
              <span>Redirecting...</span>
            ) : (
              <>
                <span>Continue to GitHub</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
