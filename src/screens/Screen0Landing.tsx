import React, { useState } from 'react'
import {
  Sparkles,
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
  Code2,
  RefreshCw,
  Flame,
  Check,
  Radio,
  UploadCloud
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
    <div className="min-h-screen bg-[#07080C] text-[#E4E1ED] flex flex-col justify-between selection:bg-[#00F0FF] selection:text-[#07080C] relative overflow-x-hidden">
      {/* Background Matrix & Subtle Gradient Radiance */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(#3B494B 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-[#00F0FF]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-[48rem] right-[-10rem] w-[500px] h-[500px] bg-[#00E3B6]/5 rounded-full blur-[160px] pointer-events-none" />
      </div>

      {/* Top Navigation Header */}
      <header className="fixed top-0 w-full z-50 bg-[#07080C]/85 backdrop-blur-xl border-b border-white/5">
        <div className="h-14 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="#overview" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_15px_-3px_rgba(0,240,255,0.4)]">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold tracking-tight text-white text-base">ASCENT</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse" />
              </div>
            </a>

            <span className="font-mono text-[10px] uppercase px-2.5 py-0.5 bg-[#1F1F27] text-[#00F0FF] rounded border border-white/10 hidden sm:inline-block">
              DEV_BUILD v2.4.1
            </span>

            <nav className="hidden lg:flex items-center gap-5 ml-2 font-mono text-xs text-slate-400">
              <a href="#overview" className="hover:text-white transition-colors">Overview</a>
              <a href="#architecture" className="hover:text-white transition-colors">How It Works</a>
              <a href="#preview" className="hover:text-white transition-colors">Runtime Artifact</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="/terms-privacy" className="hover:text-white transition-colors">Terms & Privacy</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 bg-[#13131B] px-3 py-1 rounded-md border border-white/5 text-[11px] font-mono text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#5DFFD2] animate-pulse" />
              <span>Node 20.x · Ready · 14ms</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-[#13131B] px-3 py-1 rounded-md border border-white/5 text-[11px] font-mono text-[#00F0FF]">
              <Flame className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="font-semibold">18d streak</span>
            </div>

            {isDevMode && (
              <button
                onClick={handleDevLogin}
                disabled={isDevLoading}
                className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#292932] hover:bg-[#34343D] text-[#E4E1ED] border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Instant bypass for local development"
              >
                <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>{isDevLoading ? 'Booting...' : 'Try Demo'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setConfigError(null)
                setShowConsentModal(true)
              }}
              className="flex items-center gap-2 font-mono text-xs font-bold px-3.5 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#7DF4FF] text-[#07080C] shadow-[0_0_15px_rgba(0,240,255,0.35)] transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  fillRule="evenodd"
                />
              </svg>
              <span>Sign In with GitHub</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full pt-20 flex-1 flex flex-col items-center">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section id="overview" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 md:pt-16 pb-12 flex flex-col items-start w-full">
          {/* Terminal Kicker */}
          <div className="inline-flex items-center gap-2.5 bg-[#1F1F27]/90 px-3.5 py-1.5 rounded-full mb-6 border border-white/5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#43FECE] animate-ping inline-block" />
            <span className="font-mono text-xs tracking-widest text-[#00F0FF] uppercase font-semibold">
              AI-NATIVE ARCHITECTURE // PROJECT-FIRST LEARNING
            </span>
          </div>

          {/* Monumental Header */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white max-w-4xl tracking-tight leading-[1.08] mb-6">
            Describe your vision. <br />
            <span className="text-[#00F0FF] drop-shadow-[0_0_25px_rgba(0,240,255,0.35)]">
              Ascent architects
            </span>{' '}
            the curriculum, sandbox, and repository.
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-8 leading-relaxed font-sans">
            A project-first coding engine. Learn full-stack and distributed systems engineering by building real production applications from scratch with automated testing and continuous Git commits.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button
              onClick={() => {
                setConfigError(null)
                setShowConsentModal(true)
              }}
              disabled={isRedirecting}
              className="group relative flex items-center gap-3 bg-[#00F0FF] hover:bg-[#7DF4FF] text-[#07080C] font-mono text-sm font-bold px-6 py-3.5 rounded-xl transition-all duration-200 shadow-[0_0_24px_rgba(0,240,255,0.4)] cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  fillRule="evenodd"
                />
              </svg>
              <span>Continue with GitHub</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {isDevMode && (
              <button
                onClick={handleDevLogin}
                disabled={isDevLoading}
                className="flex items-center gap-2.5 bg-[#1F1F27] hover:bg-[#292932] text-white font-mono text-sm px-5 py-3.5 rounded-xl border border-white/10 transition-colors duration-200 cursor-pointer disabled:opacity-50"
              >
                <Terminal className="w-4 h-4 text-[#00F0FF]" />
                <span>{isDevLoading ? 'Booting V8 Sandbox...' : 'Explore as Demo User'}</span>
              </button>
            )}

            <div className="hidden lg:flex items-center gap-2 text-slate-400 font-mono text-xs ml-4">
              <ShieldCheck className="w-4 h-4 text-[#5DFFD2]" />
              <span>Zero simulated fake code. 100% real runtimes.</span>
            </div>
          </div>

          {/* Trust & Spec Bar (Monospace Technical Metrics) */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-4 p-4 bg-[#13131B]/80 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-[#1F1F27] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shrink-0">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col font-mono">
                <span className="text-xs text-white font-semibold">Automated Git Sync</span>
                <span className="text-[11px] text-slate-400">Real commits directly to personal repo</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#13131B]/80 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-[#1F1F27] border border-[#5DFFD2]/30 flex items-center justify-center text-[#5DFFD2] shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex flex-col font-mono">
                <span className="text-xs text-white font-semibold">V8 / Container Sandbox</span>
                <span className="text-[11px] text-slate-400">Low-latency live micro-environments</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#13131B]/80 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-[#1F1F27] border border-[#7DF4FF]/30 flex items-center justify-center text-[#7DF4FF] shrink-0">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col font-mono">
                <span className="text-xs text-white font-semibold">100% Production Code</span>
                <span className="text-[11px] text-slate-400">Real AST tests &amp; end-to-end linting</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* VISUAL BLUEPRINT INTERACTIVE STRIP (HERO PREVIEW ARTIFACT)               */}
        {/* ========================================================================= */}
        <section id="preview" className="max-w-7xl mx-auto px-4 sm:px-6 w-full mb-16">
          <div className="w-full bg-[#13131B] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
            {/* Chrome Bar */}
            <div className="h-10 bg-[#1F1F27] px-4 flex items-center justify-between border-b border-white/5 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-slate-400 ml-2">ascent-runtime://workspace/kv-store-engine</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="flex items-center gap-1.5 text-[#5DFFD2]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5DFFD2] animate-pulse" />
                  <span>12/12 Tests Passing</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00F0FF]">Commit #8c412f1 synced</span>
              </div>
            </div>

            {/* Split Layout Preview: Live Architecture Spec + Code */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
              {/* Module Navigator & Checklist (4 cols) */}
              <div className="lg:col-span-4 bg-[#0D0D15]/95 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/5">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      SYLLABUS GRAPH
                    </span>
                    <span className="font-mono text-xs text-[#5DFFD2] bg-[#00E3B6]/10 px-2 py-0.5 rounded border border-[#5DFFD2]/20">
                      STEP 04 OF 09
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white mb-2">Write-Ahead Log (WAL) Compaction</h3>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed font-sans">
                    Persist immutable append-only telemetry. Calculate segment offsets and flush memory tables safely to NVMe disk simulation.
                  </p>

                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center gap-2.5 p-2 bg-[#1F1F27]/60 rounded text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-[#5DFFD2] shrink-0" />
                      <span>01_binary_encoder.rs</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 bg-[#1F1F27]/60 rounded text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-[#5DFFD2] shrink-0" />
                      <span>02_crc32_checksum.rs</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 bg-[#00F0FF]/10 text-[#00F0FF] rounded border border-[#00F0FF]/30">
                      <RefreshCw className="w-4 h-4 text-[#00F0FF] animate-spin shrink-0" />
                      <span className="font-semibold">03_segment_compactor.rs</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 text-slate-500 rounded opacity-60">
                      <Radio className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>04_snapshot_isolation.rs</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 bg-[#13131B] rounded-xl p-3 border border-white/5 font-mono">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Target Repo:</span>
                    <span className="text-[#00F0FF] font-semibold">dev-profile/ASCENT-distributed-kv</span>
                  </div>
                  <div className="w-full bg-[#1F1F27] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#00F0FF] h-full w-2/3 shadow-[0_0_8px_#00F0FF]" />
                  </div>
                </div>
              </div>

              {/* Code Simulation Pane (8 cols) */}
              <div className="lg:col-span-8 bg-[#07080C] p-6 flex flex-col font-mono text-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5 text-slate-500">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#00F0FF]" />
                    <span>wal_compactor.rs — Rust 2024 Runtime</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">Zero telemetry latency</span>
                </div>

                <div className="flex-1 text-slate-300 leading-relaxed select-none overflow-x-auto space-y-0.5">
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">01</span>
                    <span>
                      <span className="text-[#5DFFD2]">pub struct</span>{' '}
                      <span className="text-[#00F0FF]">SegmentCompactor</span> &#123;
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">02</span>
                    <span>&nbsp;&nbsp;active_log: <span className="text-[#5DFFD2]">Arc</span>&lt;Mutex&lt;FileHandle&gt;&gt;,</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">03</span>
                    <span>&nbsp;&nbsp;max_segment_size: <span className="text-[#5DFFD2]">u64</span>,</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">04</span>
                    <span>&nbsp;&nbsp;sync_policy: SyncDurability,</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">05</span>
                    <span>&#125;</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">06</span>
                    <span></span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">07</span>
                    <span>
                      <span className="text-[#5DFFD2]">impl</span>{' '}
                      <span className="text-[#00F0FF]">SegmentCompactor</span> &#123;
                    </span>
                  </div>
                  <div className="flex gap-4 bg-[#00F0FF]/10 px-1 rounded">
                    <span className="text-[#00F0FF] select-none">08</span>
                    <span>
                      &nbsp;&nbsp;<span className="text-[#5DFFD2]">pub fn</span>{' '}
                      <span className="text-[#00F0FF]">compact_tombstones</span>(&amp;
                      <span className="text-[#5DFFD2]">mut self</span>) -&gt; Result&lt;CompactionReport, StorageError&gt; &#123;
                    </span>
                  </div>
                  <div className="flex gap-4 bg-[#00F0FF]/10 px-1 rounded">
                    <span className="text-[#00F0FF] select-none">09</span>
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-slate-500">// Verification test checks memory map atomicity</span></span>
                  </div>
                  <div className="flex gap-4 bg-[#00F0FF]/10 px-1 rounded">
                    <span className="text-[#00F0FF] select-none">10</span>
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#5DFFD2]">let</span> pruned = <span className="text-[#5DFFD2]">self</span>.drain_expired_keys(Instant::now())?;</span>
                  </div>
                  <div className="flex gap-4 bg-[#00F0FF]/10 px-1 rounded">
                    <span className="text-[#00F0FF] select-none">11</span>
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;Ok(CompactionReport &#123; reclaimed_bytes: pruned.len() as <span className="text-[#5DFFD2]">u64</span> &#125;)</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">12</span>
                    <span>&nbsp;&nbsp;&#125;</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-slate-600 select-none">13</span>
                    <span>&#125;</span>
                  </div>
                </div>

                {/* Bottom Output Terminal */}
                <div className="bg-[#13131B] p-3 rounded-lg mt-4 flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#5DFFD2] font-bold">PASS</span>
                    <span className="text-white">test::test_tombstone_pruning ... ok (14ms)</span>
                  </div>
                  <div className="text-[#00F0FF] flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-[#00F0FF]" />
                    <span>GitHub Git Data API sync pending...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ENGINEERING ARCHITECTURE (3-COLUMN SPEC CARDS)                           */}
        {/* ========================================================================= */}
        <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-12">
          <div className="mb-10 text-left">
            <span className="font-mono text-xs uppercase tracking-widest text-[#00F0FF]">
              ENGINEERING ARCHITECTURE
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1.5">
              From prompt to authenticated production repository.
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl font-sans">
              Ascent eliminates passive tutorial rot. You do not watch videos; you engineer verified systems verified against real compiler ASTs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Card 1: Intake */}
            <div className="bg-[#13131B] border border-white/10 p-6 rounded-2xl flex flex-col justify-between hover:border-[#00F0FF]/40 transition-all duration-300 group shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs text-[#00F0FF] font-bold tracking-wider">
                    01 // INTAKE
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Spec &amp; Scope</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans mb-6">
                  Prompt any microservice, distributed storage, or complex client app. The Ascent AI engine synthesizes a modular linear syllabus with explicit unit tests and test fixtures.
                </p>
              </div>
              <div className="bg-[#07080C] p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-white/5 space-y-1">
                <div>&gt; ascent init &quot;raft-consensus-engine&quot;</div>
                <div className="text-[#5DFFD2]">&gt; 12 modules generated. Target: ASCENT-raft</div>
              </div>
            </div>

            {/* Card 2: Runtime */}
            <div className="bg-[#13131B] border border-white/10 p-6 rounded-2xl flex flex-col justify-between hover:border-[#5DFFD2]/40 transition-all duration-300 group shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs text-[#5DFFD2] font-bold tracking-wider">
                    02 // RUNTIME
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#5DFFD2]/10 border border-[#5DFFD2]/30 flex items-center justify-center text-[#5DFFD2]">
                    <Cpu className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Real IDE &amp; Container</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans mb-6">
                  Write real code in a full-featured browser IDE with live HMR, compiler diagnostics, and AST verification. Every file operates within an isolated secure sandbox.
                </p>
              </div>
              <div className="bg-[#07080C] p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-white/5 space-y-1">
                <div>&gt; v8 isolate booted in 18ms</div>
                <div className="text-[#00F0FF]">&gt; zero artificial mocks; native posix syscalls</div>
              </div>
            </div>

            {/* Card 3: Proof */}
            <div className="bg-[#13131B] border border-white/10 p-6 rounded-2xl flex flex-col justify-between hover:border-[#7DF4FF]/40 transition-all duration-300 group shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs text-[#7DF4FF] font-bold tracking-wider">
                    03 // PROOF
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#7DF4FF]/10 border border-[#7DF4FF]/30 flex items-center justify-center text-[#7DF4FF]">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Automated Git Portfolio</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans mb-6">
                  Every module verified writes clean, atomic commits directly to your private GitHub repo. README checklists update dynamically for public or employer proof of work.
                </p>
              </div>
              <div className="bg-[#07080C] p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-white/5 space-y-1">
                <div>&gt; git commit -m &quot;feat(wal): compact tombstones&quot;</div>
                <div className="text-[#5DFFD2]">&gt; push origin main: 200 OK</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECURITY & PRIVACY SHOWCASE TRIGGER STRIP                                */}
        {/* ========================================================================= */}
        <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 w-full pb-16">
          <div className="bg-[#13131B] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="text-left">
              <span className="font-mono text-xs uppercase tracking-wider text-[#5DFFD2] font-semibold">
                SECURITY &amp; PRIVACY ARCHITECTURE
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Review Least-Privilege GitHub Sync</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mt-1.5 leading-relaxed font-sans">
                Ascent provisions isolated private repositories with zero access to your other repositories or personal data. Tokens are encrypted with AES-256-GCM authenticated cipher.
              </p>
            </div>
            <button
              onClick={() => {
                setConfigError(null)
                setShowConsentModal(true)
              }}
              className="flex items-center gap-2.5 bg-[#1F1F27] hover:bg-[#292932] text-[#00F0FF] font-mono text-xs font-bold px-6 py-3 rounded-xl border border-[#00F0FF]/30 hover:border-[#00F0FF] transition-all whitespace-nowrap cursor-pointer shadow-md"
            >
              <ShieldCheck className="w-4 h-4 text-[#00F0FF]" />
              <span>Inspect GitHub OAuth Scope</span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#07080C] py-8 border-t border-white/5 font-mono text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-sm">ASCENT</span>
            <span className="text-slate-600">·</span>
            <span>Advanced Code Engine &amp; Academy</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="/terms-privacy" className="hover:text-slate-300 transition">
              Terms &amp; Privacy
            </a>
            <span className="text-slate-400">© 2026 ASCENT ARCHITECTURE. ALL RUNTIMES SECURED.</span>
          </div>
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
