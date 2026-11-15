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
  Zap
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
    <div className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Glow ambient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-black tracking-wider text-white">ASCENT</span>
            <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 font-mono">
              2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/terms-privacy"
            className="text-xs text-slate-400 hover:text-white transition hidden sm:inline-block"
          >
            Terms & Privacy
          </a>

          {isDevMode && (
            <button
              onClick={handleDevLogin}
              disabled={isDevLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition"
              title="Quick dev login without GitHub OAuth"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{isDevLoading ? 'Logging in...' : 'Dev Demo'}</span>
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
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-6 animate-pulse">
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Learn by building real vanilla code with automated test verification</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-tight sm:leading-none mb-6">
          The AI coding academy that commits{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            real code to your GitHub
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-8 leading-relaxed">
          No mock simulations. Every project generates a real Socratic curriculum, runs declarative DOM assertions against your code, and pushes automated commits to private repositories on your personal GitHub account.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
          <button
            onClick={() => {
              setConfigError(null)
              setShowConsentModal(true)
            }}
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-extrabold bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-xl shadow-cyan-500/25 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <GitBranch className="w-5 h-5 text-slate-950" />
            <span>Start Learning with GitHub</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {isDevMode && (
            <button
              onClick={handleDevLogin}
              disabled={isDevLoading}
              className="flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Continue as Demo Engineer</span>
            </button>
          )}
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Private GitHub Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creates private repositories named <code className="text-cyan-300">ASCENT-&lt;project&gt;</code> and commits clean code after each passed module.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Monotonic Verification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict DOM test harness tests your actual code in real time with zero canned answers or fake completions.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Bring Your Own Key</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use your free Gemini API key stored strictly in your browser. Curated tracks require no key at all.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>© 2026 Ascent AI Coding Academy. Real Engineering Mastery.</div>
        <div className="flex items-center gap-6">
          <a href="/terms-privacy" className="hover:text-slate-300 transition">
            Terms of Service & Privacy
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-300 transition flex items-center gap-1"
          >
            <span>Powered by GitHub OAuth</span>
          </a>
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
