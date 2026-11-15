import React, { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import {
  X,
  Flame,
  CheckCircle2,
  FolderGit2,
  Share2,
  Download,
  Copy,
  Check,
  Globe,
  Sparkles
} from 'lucide-react'

interface ShareCardModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    username: string
    displayName?: string
    avatarUrl?: string
  }
  stats: {
    streakDays: number
    completedModules: number
    totalProjects: number
  }
  initialIsPublic?: boolean
  initialTheme?: 'cyan' | 'green' | 'magenta'
  onSettingsUpdated?: (settings: { isPublic: boolean; theme: 'cyan' | 'green' | 'magenta' }) => void
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  user,
  stats,
  initialIsPublic = false,
  initialTheme = 'cyan',
  onSettingsUpdated
}) => {
  const [theme, setTheme] = useState<'cyan' | 'green' | 'magenta'>(initialTheme)
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [isExporting, setIsExporting] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const handleTogglePublic = async (nextPublic: boolean) => {
    setIsPublic(nextPublic)
    try {
      const resp = await fetch('/api/share/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublic: nextPublic, theme })
      })
      if (resp.ok) {
        onSettingsUpdated?.({ isPublic: nextPublic, theme })
      }
    } catch (e) {
      console.warn('Failed to save share settings:', e)
    }
  }

  const handleThemeChange = async (nextTheme: 'cyan' | 'green' | 'magenta') => {
    setTheme(nextTheme)
    try {
      await fetch('/api/share/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublic, theme: nextTheme })
      })
      onSettingsUpdated?.({ isPublic, theme: nextTheme })
    } catch {
      // ignore
    }
  }

  const publicUrl = `${window.location.origin}/u/${user.username}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownloadPNG = async () => {
    if (!cardRef.current) return
    setIsExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true
      })
      const link = document.createElement('a')
      link.download = `ascent-progress-${user.username}-${theme}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export card image:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleNativeShare = async () => {
    if (!cardRef.current) return
    setIsExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true
      })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `ascent-${user.username}.png`, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${user.displayName || user.username}'s Ascent Progress`,
          text: `I'm on a ${stats.streakDays}-day streak learning real front-end engineering on Ascent!`,
          url: isPublic ? publicUrl : window.location.origin,
          files: [file]
        })
      } else if (navigator.share) {
        await navigator.share({
          title: `${user.displayName || user.username}'s Ascent Progress`,
          text: `I'm on a ${stats.streakDays}-day streak learning real front-end engineering on Ascent!`,
          url: isPublic ? publicUrl : window.location.origin
        })
      } else {
        handleCopyLink()
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleDownloadPNG()
      }
    } finally {
      setIsExporting(false)
    }
  }

  // Proxied avatar URL avoids CORS taint in html-to-image export
  const proxiedAvatarUrl = user.avatarUrl
    ? `/api/auth/proxy-avatar?url=${encodeURIComponent(user.avatarUrl)}`
    : ''

  // Theme palettes
  const themeStyles = {
    cyan: {
      border: 'border-cyan-500/40',
      bgGlow: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      textAccent: 'text-cyan-400',
      flameBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      btnActive: 'bg-cyan-500 text-slate-950 font-bold',
      gradientCard: 'from-[#0B1522] via-[#0A0D18] to-[#05060A]'
    },
    green: {
      border: 'border-emerald-500/40',
      bgGlow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      textAccent: 'text-emerald-400',
      flameBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      btnActive: 'bg-emerald-500 text-slate-950 font-bold',
      gradientCard: 'from-[#091D17] via-[#091211] to-[#040907]'
    },
    magenta: {
      border: 'border-fuchsia-500/40',
      bgGlow: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',
      textAccent: 'text-fuchsia-400',
      flameBg: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
      btnActive: 'bg-fuchsia-500 text-slate-950 font-bold',
      gradientCard: 'from-[#1C0E22] via-[#100A16] to-[#08040C]'
    }
  }[theme]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0F111A] border border-slate-800 rounded-2xl p-6 shadow-2xl text-white my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Share Your Engineering Journey</h2>
            <p className="text-xs text-slate-400">Export high-resolution 9:16 story card</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* 9:16 Preview Card */}
          <div className="flex flex-col items-center">
            <div
              ref={cardRef}
              className={`relative w-[280px] h-[497px] rounded-3xl p-6 flex flex-col justify-between overflow-hidden border ${themeStyles.border} bg-gradient-to-b ${themeStyles.gradientCard} shadow-2xl`}
            >
              <div
                className={`absolute -top-24 -left-24 w-56 h-56 rounded-full bg-gradient-to-br ${themeStyles.bgGlow} blur-3xl pointer-events-none`}
              />
              <div
                className={`absolute -bottom-24 -right-24 w-56 h-56 rounded-full bg-gradient-to-tl ${themeStyles.bgGlow} blur-3xl pointer-events-none`}
              />

              {/* Card Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-slate-200">ASCENT</span>
                </div>
                <div className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${themeStyles.flameBg}`}>
                  AI ACADEMY
                </div>
              </div>

              {/* Card Center Info */}
              <div className="relative z-10 flex flex-col items-center text-center my-auto">
                <div className="relative mb-3">
                  {proxiedAvatarUrl ? (
                    <img
                      src={proxiedAvatarUrl}
                      alt={user.username}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-2xl font-black text-white border-2 border-white/20 shadow-xl">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                    <Flame className="w-4 h-4 fill-amber-400" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white tracking-tight">{user.displayName || user.username}</h3>
                <p className="text-xs text-slate-400 mb-4">@{user.username}</p>

                {/* Flame Streak Motif */}
                <div className={`w-full p-3 rounded-2xl border ${themeStyles.flameBg} mb-4 flex items-center justify-center gap-2 shadow-inner`}>
                  <Flame className="w-6 h-6 fill-current animate-pulse" />
                  <div className="text-left">
                    <div className="text-xl font-black leading-tight tracking-tight">{stats.streakDays} DAYS</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">ACTIVE STREAK</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 w-full text-left">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Modules</span>
                    </div>
                    <div className="text-base font-extrabold text-white">{stats.completedModules}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Projects</span>
                    </div>
                    <div className="text-base font-extrabold text-white">{stats.totalProjects}</div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10 text-[10px] text-slate-400">
                <span>ascent.dev/u/{user.username}</span>
                <span className="font-semibold text-white/70">Vanilla JS Mastery</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 mt-2">1080x1920 HD Ready (9:16)</span>
          </div>

          {/* Controls & Options */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">Select Card Theme</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('cyan')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    theme === 'cyan'
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Cyan
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('green')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    theme === 'green'
                      ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Emerald
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('magenta')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    theme === 'magenta'
                      ? 'border-fuchsia-400 bg-fuchsia-950/60 text-fuchsia-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Magenta
                </button>
              </div>
            </div>

            {/* Public Profile Toggle */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-semibold text-white">Public Profile Page</span>
                    <p className="text-[11px] text-slate-400">Share your accomplishments at /u/{user.username}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => handleTogglePublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {isPublic && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-slate-800 text-xs font-mono text-cyan-300 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white transition shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleNativeShare}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Card (Social / Story)</span>
              </button>

              <button
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition"
              >
                <Download className="w-4 h-4" />
                <span>Download High-Res PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
