import React, { useState } from 'react'
import {
  ShieldCheck,
  X,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  RefreshCw,
  FolderGit2,
  GitCommitHorizontal,
  KeyRound
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#07080C]/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#13131B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E4E1ED] max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#1F1F27] flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#292932] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.25)] shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white tracking-tight">
                  {error ? 'GitHub OAuth Setup Required' : 'GitHub Access Permission'}
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 bg-[#00F0FF]/10 text-[#00F0FF] rounded border border-[#00F0FF]/20 font-semibold">
                  OAuth 2.0
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400 mt-0.5">
                {error ? 'Authentication credentials missing in .env' : 'Least-privilege private repository synchronization'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#292932] transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {error ? (
            /* OAuth Configuration Required State */
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                GitHub returns a <strong>404 page</strong> when the authorization URL contains an unconfigured{' '}
                <code className="text-[#FFB95F] bg-[#1F1F27] px-1.5 py-0.5 rounded font-mono text-xs border border-white/5">client_id</code>.
                To connect your real GitHub account, register a free OAuth application:
              </p>

              {/* Quick Setup Box */}
              <div className="p-4 rounded-xl bg-[#0D0D15] border border-white/10 space-y-3 font-mono">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Authorization Callback URL</span>
                  <span className="text-[10px] text-[#00F0FF] font-semibold">Exact Match Required</span>
                </div>
                <div className="flex items-center gap-2 bg-[#13131B] border border-white/10 rounded-lg p-2 text-xs text-[#00F0FF] overflow-x-auto">
                  <span className="flex-1 select-all">{callbackUrl}</span>
                  <button
                    type="button"
                    onClick={handleCopyCallback}
                    className="px-2.5 py-1 rounded bg-[#292932] hover:bg-[#34343D] text-slate-200 text-xs font-sans flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#5DFFD2]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block font-sans">Quick 30-Second Setup:</span>
                  <div className="space-y-1.5 text-xs text-slate-400 font-sans leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Open{' '}
                        <a
                          href="https://github.com/settings/developers"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00F0FF] underline inline-flex items-center gap-0.5 hover:text-[#7DF4FF] font-medium"
                        >
                          <span>GitHub Developer Settings</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>{' '}
                        and click <strong>New OAuth App</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Paste the Callback URL above into <strong>Authorization callback URL</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Copy Client ID, generate Client Secret, and paste into <code className="text-[#00F0FF] font-mono">.env</code>:</span>
                    </div>
                  </div>
                  <pre className="p-2.5 bg-[#13131B] rounded-lg text-[11px] text-[#00F0FF] font-mono overflow-x-auto border border-white/5">
                    GITHUB_CLIENT_ID=your_client_id{'\n'}
                    GITHUB_CLIENT_SECRET=your_client_secret
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            /* Normal GitHub Permissions Consent View */
            <div className="space-y-3.5">
              {/* Technical Details Card 1 */}
              <div className="p-4 bg-[#1F1F27] rounded-xl flex items-start gap-3.5 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shrink-0 mt-0.5">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-semibold text-white">Private Repository Provisioning</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    Ascent creates a private repository named <code className="font-mono text-[11px] bg-[#0D0D15] text-[#00F0FF] px-1.5 py-0.5 rounded border border-white/5">ASCENT-&lt;project&gt;</code> on your personal account. Your code is never exposed publicly without your explicit change in repository settings.
                  </p>
                </div>
              </div>

              {/* Technical Details Card 2 */}
              <div className="p-4 bg-[#1F1F27] rounded-xl flex items-start gap-3.5 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#5DFFD2]/10 border border-[#5DFFD2]/30 flex items-center justify-center text-[#5DFFD2] shrink-0 mt-0.5">
                  <GitCommitHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-semibold text-white">Automated Git Commits</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    Passing a module's tests automatically creates a clean commit with your verified files and updates the curriculum checklist README via GitHub's Git Data API.
                  </p>
                </div>
              </div>

              {/* Technical Details Card 3 */}
              <div className="p-4 bg-[#1F1F27] rounded-xl flex items-start gap-3.5 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-semibold text-white">AES-256-GCM Token Encryption</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    Your GitHub access token is encrypted at rest using AES-256-GCM authenticated cipher. It is never sent to the client browser and never logged into telemetry.
                  </p>
                </div>
              </div>

              {/* Security Disclosure Callout */}
              <div className="p-3.5 bg-[#0D0D15] rounded-xl border border-white/5 flex gap-3 items-start">
                <ShieldCheck className="w-4 h-4 text-[#FFB95F] shrink-0 mt-0.5" />
                <div className="font-mono text-[11px] leading-relaxed text-slate-400">
                  <span className="text-[#FFB95F] font-semibold uppercase tracking-wider block mb-0.5">
                    Least-Privilege Verification:
                  </span>
                  Creating private repositories directly on a user's personal profile requires a classic OAuth App with{' '}
                  <code className="text-[#00F0FF] font-mono">repo</code> scope. Ascent only touches repositories created by its engine prefix.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#1F1F27] flex items-center justify-between border-t border-white/5 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#292932] transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {error && onDevLogin && (
              <button
                type="button"
                onClick={onDevLogin}
                disabled={isDevLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#292932] hover:bg-[#34343D] text-[#E4E1ED] border border-white/10 transition cursor-pointer disabled:opacity-50"
              >
                <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>{isDevLoading ? 'Connecting...' : 'Dev Quick Login'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 bg-[#00F0FF] hover:bg-[#7DF4FF] text-[#07080C] font-mono font-bold px-5 py-2 rounded-xl transition-all shadow-[0_0_16px_rgba(0,240,255,0.4)] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : error ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry GitHub Auth</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      fillRule="evenodd"
                    />
                  </svg>
                  <span>Continue to GitHub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
