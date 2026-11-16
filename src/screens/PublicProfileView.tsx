import React, { useState, useEffect } from 'react'
import {
  Flame,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Terminal,
  ShieldCheck,
  Code2
} from 'lucide-react'

interface PublicProfileData {
  user: {
    username: string
    displayName?: string
    avatarUrl?: string
    createdAt: string
  }
  shareSettings: {
    isPublic: boolean
    theme: 'cyan' | 'green' | 'magenta'
  }
  stats: {
    totalProjects: number
    completedModules: number
    hintsUsed: number
  }
  projects: Array<{
    name: string
    prompt: string
    source: string
    status: string
    repoUrl?: string
  }>
}

interface PublicProfileViewProps {
  username: string
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({ username }) => {
  const [data, setData] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setNotFound(false)
      try {
        const resp = await fetch(`/api/u/${encodeURIComponent(username)}`)
        if (resp.status === 404 || !resp.ok) {
          setNotFound(true)
          return
        }
        const json = await resp.json()
        setData(json)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [username])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080C] text-white flex items-center justify-center font-mono">
        <div className="flex items-center gap-3 text-cyan-400">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Loading engineer profile...</span>
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#07080C] text-white flex flex-col items-center justify-center p-6 text-center font-mono">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_20px_-3px_rgba(244,63,94,0.3)]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black mb-2 text-white">Profile Not Found or Private</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6 font-sans">
          The user @{username} either does not exist or has chosen to keep their engineering portfolio private.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-slate-700 hover:border-cyan-400 text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Ascent Academy</span>
        </a>
      </div>
    )
  }

  const { user, stats, projects } = data
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    : '2026'

  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      {/* Background Ambience */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 max-w-5xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="text-sm font-black tracking-wider text-white font-mono">ASCENT</span>
        </a>

        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Launch Ascent</span>
        </a>
      </header>

      {/* Profile Main Body */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-10 flex-1">
        {/* Engineer Hero Card */}
        <div className="p-6 md:p-8 rounded-2xl bg-[#0D101A]/90 border border-cyan-500/25 shadow-2xl mb-8 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-2xl md:text-3xl font-black text-white border-2 border-cyan-500/40 shadow-xl font-mono">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    {user.displayName || user.username}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    <span>VERIFIED</span>
                  </span>
                </div>
                <p className="text-sm font-mono text-cyan-400 mb-2">@{user.username}</p>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                  <span>Joined {joinDate}</span>
                  <span>•</span>
                  <span>Track: Vanilla JS</span>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <div className="px-4 py-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center gap-3 font-mono">
                <Flame className="w-6 h-6 text-amber-400 fill-amber-400" />
                <div>
                  <div className="text-lg font-black text-white leading-none">ACTIVE</div>
                  <div className="text-[10px] uppercase text-cyan-300 font-bold tracking-wider">LEARNER</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* High-Impact Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 font-mono">
          <div className="p-5 rounded-2xl bg-[#0D101A]/80 border border-slate-800 backdrop-blur-sm shadow-md">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Modules Mastered</span>
            </div>
            <div className="text-3xl font-black text-white">{stats.completedModules}</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D101A]/80 border border-slate-800 backdrop-blur-sm shadow-md">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <FolderGit2 className="w-4 h-4 text-cyan-400" />
              <span>Projects Shipped</span>
            </div>
            <div className="text-3xl font-black text-white">{stats.totalProjects}</div>
          </div>

          <div className="col-span-2 md:col-span-1 p-5 rounded-2xl bg-[#0D101A]/80 border border-slate-800 backdrop-blur-sm shadow-md">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Hints Consulted</span>
            </div>
            <div className="text-3xl font-black text-white">{stats.hintsUsed}</div>
          </div>
        </div>

        {/* Shipped Projects Showcase */}
        <div>
          <div className="flex items-center justify-between mb-4 font-mono">
            <h2 className="text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-cyan-400" />
              <span>Shipped Projects Portfolio</span>
            </h2>
            <span className="text-xs text-slate-500">{projects.length} Repositories</span>
          </div>

          {projects.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center font-mono text-xs text-slate-500">
              No public projects published yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#0D101A]/90 border border-slate-800 hover:border-cyan-500/40 transition shadow-lg group space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                      {proj.source === 'curated' ? 'Curated Track' : 'Custom AI Spec'}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{proj.status === 'completed' ? 'Completed' : 'Active'}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                      {proj.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 font-sans">{proj.prompt}</p>
                  </div>

                  {proj.repoUrl && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-cyan-400" />
                        <span>Private Repo</span>
                      </span>
                      <a
                        href={proj.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Public Footer */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs font-mono text-slate-500">
        Verified by Ascent AI Coding Academy • Pure Vanilla JS Engineering
      </footer>
    </div>
  )
}
