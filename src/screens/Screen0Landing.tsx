import React, { useState } from 'react'
import {
  Sparkles,
  GitBranch,
  Terminal,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  FolderGit2,
  GitCommitHorizontal,
  KeyRound,
  ExternalLink,
  Cpu,
  Layers,
  Code2
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
      {/* Background Matrix & Subtle Gradient Radiance */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-[450px] right-10 w-[400px] h-[400px] bg-purple-600/5 blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-lg font-black tracking-wider text-white">ASCENT</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 bg-cyan-950/40">
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer font-mono"
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* Main Hero with Integrated Login Form */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-10 md:py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-16">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wide backdrop-blur-md shadow-lg shadow-cyan-950/40">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>SOCRATIC CURRICULUM • REAL GIT COMMITS</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.08]">
              The AI coding academy that commits{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                real code to your GitHub
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl font-sans">
              Zero canned templates. Every project generates an interactive curriculum, verifies your raw DOM logic in an isolated sandbox, and pushes automated commits to private repositories on your personal account.
            </p>

            <div className="space-y-3 pt-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <FolderGit2 className="w-3 h-3" />
                </div>
                <span>Private repo creation: <code className="text-cyan-300 font-bold bg-cyan-950/40 px-1 py-0.5 rounded">ASCENT-&lt;project&gt;</code></span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <span>Monotonic DOM test assertions with instant verification</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <KeyRound className="w-3 h-3" />
                </div>
                <span>Bring Your Own Key (BYOK) stored exclusively in your browser</span>
              </div>
            </div>
          </div>

          {/* Right Column: Prominent Login Form Card */}
          <div className="lg:col-span-5 w-full">
            <div className="rounded-2xl bg-[#0D101A]/95 border border-cyan-500/35 p-6 sm:p-7 shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)] backdrop-blur-xl relative">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="text-xs font-mono text-slate-400 ml-2">auth-gateway // session</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>GATEWAY READY</span>
                </div>
              </div>

              {/* Login Form Header */}
              <div className="text-left mb-6 space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Sign In to Your Workspace</h2>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Authenticate with GitHub to initialize curriculum tracking and private repository code sync.
                </p>
              </div>

              {/* Primary GitHub Auth Action */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfigError(null)
                    setShowConsentModal(true)
                  }}
                  disabled={isRedirecting}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)] transition transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-slate-950" />
                    <span>Continue with GitHub</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Requests <code className="text-cyan-300">repo</code> scope solely to create and sync strictly private <code className="text-cyan-300">ASCENT-*</code> repositories.
                  </span>
                </div>
              </div>

              {/* Development Mode Access */}
              {isDevMode && (
                <div className="pt-5 mt-5 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    <span>Local Development</span>
                    <span className="text-amber-400">Zero OAuth Required</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDevLogin}
                    disabled={isDevLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition cursor-pointer disabled:opacity-50"
                  >
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>{isDevLoading ? 'Authenticating...' : 'Launch as Demo Engineer'}</span>
                  </button>
                </div>
              )}

              {/* Security Footnote */}
              <div className="pt-4 mt-5 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>AES-256-GCM Token Encryption • Zero Stored Secrets</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARDS AT THE BOTTOM OF THE '/' URL (REFINED SHOWCASE CARDS)              */}
        {/* ========================================================================= */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between mb-6 font-mono text-left">
            <span className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Core Architectural Pillars</span>
            </span>
            <span className="text-[11px] text-slate-500">Ascent Technical Foundation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            {/* Card 1: Private GitHub Sync */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-cyan-950/20 via-[#0C0F1A]/90 to-[#07080C] border border-cyan-500/30 hover:border-cyan-400/60 transition shadow-xl group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300">
                    GIT DATA API
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-cyan-300 transition">
                    Private GitHub Synchronization
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                    Provisions strictly private repositories named <code className="text-cyan-300 font-mono bg-black/40 px-1 py-0.5 rounded">ASCENT-&lt;project&gt;</code> on your personal profile. Completing each module creates an atomic commit and updates your README syllabus checklist.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-cyan-400/80">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Private Repos</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Atomic Commits</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Syllabus Sync</span>
              </div>
            </div>

            {/* Card 2: Monotonic Verification */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-950/20 via-[#0C1412]/90 to-[#07080C] border border-emerald-500/30 hover:border-emerald-400/60 transition shadow-xl group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_-3px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
                    TEST HARNESS
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition">
                    Monotonic Verification Engine
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                    Strict declarative DOM assertions execute against your code in an isolated sandboxed iframe. Zero canned completions or artificial pass states—your code must satisfy every specification before advancing.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-emerald-400/80">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">DOM Assertions</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Isolated Iframe</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Zero Mock Data</span>
              </div>
            </div>

            {/* Card 3: Bring Your Own Key */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-purple-950/20 via-[#120D1A]/90 to-[#07080C] border border-purple-500/30 hover:border-purple-400/60 transition shadow-xl group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_20px_-3px_rgba(168,85,247,0.3)] group-hover:scale-105 transition-transform">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-300">
                    CLIENT-SIDE ONLY
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-purple-300 transition">
                    Bring Your Own Key (BYOK)
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                    Store your free Google Gemini API key securely in browser IndexedDB. Delivered per request via HTTPS header (<code className="text-purple-300 font-mono bg-black/40 px-1 py-0.5 rounded">x-user-api-key</code>), never persisted in MongoDB, and redacted from all logs.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-purple-400/80">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Browser IndexedDB</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Zero Server Store</span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">Logs Redacted</span>
              </div>
            </div>
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
