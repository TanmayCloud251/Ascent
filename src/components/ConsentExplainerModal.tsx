import React, { useState } from 'react'
import {
  ShieldCheck,
  GitBranch,
  Lock,
  KeyRound,
  X,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  RefreshCw,
  FolderGit2,
  GitCommitHorizontal
} from 'lucide-react'

export interface GitHubConfigError {
  message: string
  instructions?: {
    callbackUrl: string
    appUrl: string
    steps: string[]
  }
}

interface ConsentExplainerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
  error?: GitHubConfigError | null
  onDevLogin?: () => void
  isDevLoading?: boolean
}

export const ConsentExplainerModal: React.FC<ConsentExplainerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  error = null,
  onDevLogin,
  isDevLoading = false
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const callbackUrl =
    error?.instructions?.callbackUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/github/callback`
      : 'http://localhost:3000/api/auth/github/callback')

  const handleCopyCallback = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(callbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0C0F17] border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)] text-white max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {error ? (
          /* OAuth Configuration Required State */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_-3px_rgba(245,158,11,0.25)]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">GitHub OAuth Setup Required</h2>
                <p className="text-xs font-mono text-amber-400/90">Authentication credentials missing in .env</p>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-300 mb-5 leading-relaxed font-sans">
              GitHub returns a <strong>404 page</strong> when the authorization URL contains an unconfigured{' '}
              <code className="text-amber-300 bg-amber-950/40 px-1 py-0.5 rounded font-mono text-xs">client_id</code>.
              To connect your real GitHub account, register a free OAuth application:
            </p>

            {/* Quick Setup Box */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 mb-6">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Authorization Callback URL</span>
                <span className="text-[10px] text-cyan-400 font-semibold">Exact Match Required</span>
              </div>
              <div className="flex items-center gap-2 bg-black/60 border border-slate-700/80 rounded-lg p-2 font-mono text-xs text-cyan-300 overflow-x-auto">
                <span className="flex-1 select-all">{callbackUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyCallback}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Quick 30-Second Setup:</span>
                <div className="space-y-1.5 text-xs text-slate-400 font-sans leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Open{' '}
                      <a
                        href="https://github.com/settings/developers"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline inline-flex items-center gap-0.5 hover:text-cyan-300 font-medium"
                      >
                        <span>GitHub Developer Settings</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>{' '}
                      and click <strong>New OAuth App</strong>.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Paste the Callback URL above into <strong>Authorization callback URL</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                      3
                    </span>
                    <span>Copy the Client ID, generate a Client Secret, and paste into <code className="text-cyan-300 font-mono">.env</code>:</span>
                  </div>
                </div>
                <pre className="p-2.5 bg-black/80 rounded-lg text-[11px] text-cyan-300/90 font-mono overflow-x-auto border border-white/5">
                  GITHUB_CLIENT_ID=your_client_id{'\n'}
                  GITHUB_CLIENT_SECRET=your_client_secret
                </pre>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition order-3 sm:order-1 cursor-pointer"
              >
                Cancel
              </button>

              {onDevLogin && (
                <button
                  type="button"
                  onClick={onDevLogin}
                  disabled={isDevLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition disabled:opacity-50 order-2 cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>{isDevLoading ? 'Connecting...' : 'Dev Quick Login'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 order-1 sm:order-3 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Checking .env...' : 'Retry GitHub Auth'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal GitHub Permissions Consent View */
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]">
                <GitBranch className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">GitHub Access Permission</h2>
                <p className="text-xs text-slate-400 font-mono">Least-privilege private repository synchronization</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-300 mb-6">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-xs block">Private Repository Provisioning</span>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Ascent creates a private repository named <code className="text-cyan-300 font-mono bg-cyan-950/50 px-1 py-0.5 rounded">ASCENT-&lt;project&gt;</code> on your personal account. Your code is never exposed publicly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <GitCommitHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-xs block">Automated Git Commits</span>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Passing a module's tests automatically creates a clean commit with your verified files and updates the curriculum checklist README via GitHub's Git Data API.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-xs block">AES-256-GCM Token Encryption</span>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Your GitHub access token is encrypted at rest using AES-256-GCM. It is never sent to the client browser and never logged.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 font-mono">
                <strong>Least-Privilege Verification:</strong> Creating private repositories directly on a user's personal profile requires a classic OAuth App with <code className="text-cyan-300">repo</code> scope.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>Continue to GitHub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
