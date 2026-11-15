import React, { useState } from 'react'
import {
  ShieldCheck,
  GitBranch,
  Lock,
  Key,
  X,
  ArrowRight,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Zap,
  RefreshCw
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F111A] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 text-white max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {error ? (
          /* Missing GitHub OAuth Credentials Warning State */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">GitHub OAuth Not Configured</h2>
                <p className="text-xs text-amber-400/90">Why you saw a 404 on GitHub</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              GitHub shows a <strong>404 page</strong> when the authorization URL contains an empty or invalid{' '}
              <code className="text-amber-300 bg-amber-950/40 px-1 py-0.5 rounded">client_id</code>.
              Your <code className="text-cyan-300">.env</code> file is missing GitHub OAuth App credentials.
            </p>

            {/* Quick Setup Box */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 mb-5">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Authorization Callback URL</span>
              </div>
              <div className="flex items-center gap-2 bg-black/60 border border-slate-700/80 rounded-lg p-2 font-mono text-xs text-cyan-300 overflow-x-auto">
                <span className="flex-1 select-all">{callbackUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyCallback}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans flex items-center gap-1 shrink-0 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300 block mb-1.5">Quick Setup (30 Seconds):</span>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>
                    Open{' '}
                    <a
                      href="https://github.com/settings/developers"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline inline-flex items-center gap-0.5 hover:text-cyan-300"
                    >
                      <span>GitHub Developer Settings</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and click <strong>New OAuth App</strong>.
                  </li>
                  <li>Paste the Callback URL above into <strong>Authorization callback URL</strong>.</li>
                  <li>Generate a Client Secret and copy your Client ID.</li>
                  <li>
                    Add both into your <code className="text-cyan-300">.env</code> file:
                    <pre className="mt-1.5 p-2 bg-black/80 rounded text-[11px] text-slate-300 font-mono overflow-x-auto">
                      GITHUB_CLIENT_ID=your_client_id{'\n'}
                      GITHUB_CLIENT_SECRET=your_client_secret
                    </pre>
                  </li>
                </ol>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition order-3 sm:order-1"
              >
                Close
              </button>

              {onDevLogin && (
                <button
                  type="button"
                  onClick={onDevLogin}
                  disabled={isDevLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 transition disabled:opacity-50 order-2"
                >
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>{isDevLoading ? 'Logging in...' : 'Dev Demo Login'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 order-1 sm:order-3"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Checking .env...' : 'Retry GitHub Login'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal GitHub Consent Explainer */
          <div>
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
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>Continue to GitHub</span>
                    <ArrowRight className="w-4 h-4" />
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
