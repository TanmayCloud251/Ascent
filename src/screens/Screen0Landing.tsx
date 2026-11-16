import React, { useState } from 'react'
import {
  Sparkles,
  GitBranch,
  Terminal,
  CheckCircle2,
  Lock,
  Flame,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Code2,
  FolderGit2,
  GitCommitHorizontal,
  Layers,
  KeyRound,
  ExternalLink
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ConsentExplainerModal, GitHubConfigError } from '../components/ConsentExplainerModal'

interface Screen0LandingProps {
  onStartCuratedDemo?: () => void
}

export const Screen0Landing: React.FC<Screen0LandingProps> = () => {
  const { checkAuth } = useApp()
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isDevLoading, setIsDevLoading] = useState(false)
  const [configError, setConfigError] = useState<GitHubConfigError | null>(null)

  const handleStartLogin = async () => {
    setIsRedirecting(true)
    try {
      const resp = await fetch('/api/auth/github/url')
      const data = await resp.json()

      if (resp.ok && data.url) {
        window.location.href = data.url
      } else if (data.code === 'GITHUB_NOT_CONFIGURED') {
        setConfigError({
          message: data.message,
          instructions: data.instructions
        })
        setShowConsentModal(true)
        setIsRedirecting(false)
      } else {
        alert(`Could not start GitHub login: ${data.message || 'Unknown error'}`)
        setIsRedirecting(false)
      }
    } catch (err: any) {
      alert(`Login error: ${err?.message || err}`)
      setIsRedirecting(false)
    }
  }

  const handleDevLogin = async () => {
    setIsDevLoading(true)
    try {
      const resp = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      const data = await resp.json()
      if (resp.ok && data.success) {
        setShowConsentModal(false)
        await checkAuth()
      } else {
        alert(`Dev login failed: ${data.message || 'Unknown server response'}`)
      }
    } catch (err: any) {
      alert(`Dev login request failed: ${err?.message || err}`)
    } finally {
      setIsDevLoading(false)
    }
  }

  const isDevMode = process.env.NODE_ENV !== 'production'

  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      {/* Background Grid Pattern & Ambient Gradients */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-96 left-1/4 w-[400px] h-[400px] bg-purple-600/5 blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-wider text-white">ASCENT</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 font-mono bg-cyan-950/40">
              v2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/terms-privacy"
            className="text-xs text-slate-400 hover:text-white transition hidden sm:inline-block font-mono"
          >
            Terms & Privacy
          </a>

          {isDevMode && (
            <button
              onClick={handleDevLogin}
              disabled={isDevLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition cursor-pointer"
              title="Instant local development bypass without OAuth"
            >
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{isDevLoading ? 'Connecting...' : 'Dev Demo'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setConfigError(null)
              setShowConsentModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sign in with GitHub</span>
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
        {/* Engineering Philosophy Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wide mb-8 backdrop-blur-md shadow-lg shadow-cyan-950/40">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>SOCRATIC CURRICULUM • DECLARATIVE DOM HARNESS • REAL GIT COMMITS</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08] mb-6">
          The AI coding academy that commits{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
            real code to your GitHub
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed font-sans">
          Zero canned exercises. Every project generates a customized full-stack curriculum, tests your code against strict DOM assertions in a sandboxed runtime, and pushes automated commits to private repositories on your GitHub account.
        </p>

        {/* Hero CTA Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <button
            onClick={() => {
              setConfigError(null)
              setShowConsentModal(true)
            }}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-extrabold bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-[0_0_35px_-5px_rgba(6,182,212,0.45)] transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <GitBranch className="w-5 h-5 text-slate-950" />
            <span>Start Learning with GitHub</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {isDevMode && (
            <button
              onClick={handleDevLogin}
              disabled={isDevLoading}
              className="flex items-center gap-2.5 px-6 py-4 rounded-2xl text-sm font-mono font-bold bg-slate-900/90 border border-slate-700/80 hover:border-amber-400 text-slate-300 hover:text-white transition cursor-pointer backdrop-blur-sm"
            >
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>Continue as Demo Engineer</span>
            </button>
          )}
        </div>

        {/* Interactive Loop Preview Mockup */}
        <div className="w-full max-w-3xl mb-16 rounded-2xl bg-[#0C0E16]/90 border border-cyan-500/25 p-4 sm:p-6 shadow-2xl text-left backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs font-mono text-slate-400 ml-2">ASCENT-portfolio / module-02.ts</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
              <GitCommitHorizontal className="w-3.5 h-3.5" />
              <span>Git Data API Sync Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> 1. Socratic Spec
              </div>
              <div className="text-white font-semibold">Gemini 2.5 Architecture</div>
              <p className="text-[11px] text-slate-400 font-sans">Multi-stage curriculum generated with real files.</p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 2. DOM Assertion
              </div>
              <div className="text-white font-semibold">Live Sandbox Runner</div>
              <p className="text-[11px] text-slate-400 font-sans">Monotonic unit tests verified directly in your browser.</p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FolderGit2 className="w-3 h-3 text-cyan-400" /> 3. GitHub Push
              </div>
              <div className="text-white font-semibold">Private Repo Commit</div>
              <p className="text-[11px] text-slate-400 font-sans">Atomic commit + updated README syllabus checklist.</p>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full text-left">
          <div className="p-6 rounded-2xl bg-[#0D101A]/80 border border-slate-800 hover:border-cyan-500/40 transition backdrop-blur-sm shadow-lg group">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span>Private GitHub Sync</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Automatically provisions private repositories named <code className="text-cyan-300 font-mono bg-cyan-950/40 px-1 py-0.5 rounded">ASCENT-&lt;project&gt;</code> on your personal account, serializing commits in the background after every module.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0D101A]/80 border border-slate-800 hover:border-emerald-500/40 transition backdrop-blur-sm shadow-lg group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span>Monotonic Verification</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Strict DOM test harness tests your actual code in real time inside a sandboxed iframe. Zero artificial shortcuts or canned completions.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0D101A]/80 border border-slate-800 hover:border-purple-500/40 transition backdrop-blur-sm shadow-lg group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span>Bring Your Own Key</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Use your free Gemini API key stored strictly in your browser IndexedDB. Delivered per request via HTTPS header, never logged or stored on our servers.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-8 border-t border-slate-900 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
        <div>© 2026 Ascent AI Coding Academy • Pure Vanilla JS Engineering</div>
        <div className="flex items-center gap-6">
          <a href="/terms-privacy" className="hover:text-slate-300 transition">
            Terms of Service & Privacy
          </a>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <GitCommitHorizontal className="w-3.5 h-3.5" />
            <span>GitHub Git Data API Connected</span>
          </span>
        </div>
      </footer>

      {/* Consent Explainer / Setup Modal */}
      <ConsentExplainerModal
        isOpen={showConsentModal}
        onClose={() => {
          setShowConsentModal(false)
          setConfigError(null)
        }}
        onConfirm={handleStartLogin}
        isLoading={isRedirecting}
        error={configError}
        onDevLogin={isDevMode ? handleDevLogin : undefined}
        isDevLoading={isDevLoading}
      />
    </div>
  )
}
