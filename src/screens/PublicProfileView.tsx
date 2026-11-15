import React, { useState, useEffect } from 'react'
import {
  Flame,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  Sparkles
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
        if (resp.status === 404) {
          setNotFound(true)
          return
        }
        if (!resp.ok) {
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
      <div className="min-h-screen bg-[#07080C] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Loading engineer profile...</span>
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#07080C] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black mb-2">Profile Not Found or Private</h1>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          The user @{username} either does not exist or has set their engineering profile to private.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-slate-700 hover:border-cyan-400 text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Ascent Academy</span>
        </a>
      </div>
    )
  }

  const { user, stats, projects, shareSettings } = data
  const theme = shareSettings.theme || 'cyan'

  const themeGlow = {
    cyan: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    green: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    magenta: 'from-fuchsia-500/20 via-purple-500/10 to-transparent'
  }[theme]

  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 p-6 sm:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ascent Academy</span>
          </a>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Public Engineering Card</span>
          </div>
        </header>

        {/* Hero Card */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm overflow-hidden shadow-2xl">
          <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl ${themeGlow} blur-3xl pointer-events-none`} />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-cyan-600 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-white">{user.displayName || user.username}</h1>
                <p className="text-xs text-slate-400">@{user.username}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-[11px] font-semibold text-cyan-300">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Vanilla JavaScript Engineer</span>
                </div>
              </div>
            </div>

            {/* Stats Badges */}
            <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800 text-center min-w-[100px]">
                <div className="text-xl font-black text-white">{stats.completedModules}</div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Modules Passed</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800 text-center min-w-[100px]">
                <div className="text-xl font-black text-cyan-400">{stats.totalProjects}</div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Projects Built</div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Showcase */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-cyan-400" />
            <span>Verified Coursework & Repositories</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((proj, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-cyan-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">{proj.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {proj.source === 'curated' ? 'Curated Track' : 'Custom Project'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">{proj.prompt || 'Vanilla web application built on Ascent.'}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>

                  {proj.repoUrl && (
                    <a
                      href={proj.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold text-[11px]"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>View GitHub Repo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
