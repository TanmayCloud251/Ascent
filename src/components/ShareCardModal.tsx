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
  Sparkles,
  Terminal,
  ShieldCheck
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
      flameBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]',
      btnActive: 'bg-cyan-500 text-slate-950 font-bold',
      gradientCard: 'from-[#0B1522] via-[#0A0D18] to-[#05060A]',
      accentDot: 'bg-cyan-400'
    },
    green: {
      border: 'border-emerald-500/40',
      bgGlow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      textAccent: 'text-emerald-400',
      flameBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 shadow-[0_0_20px_-3px_rgba(16,185,129,0.3)]',
      btnActive: 'bg-emerald-500 text-slate-950 font-bold',
      gradientCard: 'from-[#091D17] via-[#091211] to-[#040907]',
      accentDot: 'bg-emerald-400'
    },
    magenta: {
      border: 'border-fuchsia-500/40',
      bgGlow: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',
      textAccent: 'text-fuchsia-400',
      flameBg: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/35 shadow-[0_0_20px_-3px_rgba(217,70,239,0.3)]',
      btnActive: 'bg-fuchsia-500 text-slate-950 font-bold',
      gradientCard: 'from-[#1C0E22] via-[#100A16] to-[#08040C]',
      accentDot: 'bg-fuchsia-400'
    }
  }[theme]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0C0F17] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl text-white my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Engineering Milestone Card</h2>
            <p className="text-xs font-mono text-cyan-400/90">9:16 Social Story Format • High Resolution</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* 9:16 Preview Card */}
          <div className="flex flex-col items-center">
            <div
              ref={cardRef}
              className={`relative w-[280px] h-[497px] rounded-3xl p-6 flex flex-col justify-between overflow-hidden border ${themeStyles.border} bg-gradient-to-b ${themeStyles.gradientCard} shadow-2xl`}
            >
              {/* Card Background Pattern */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              />
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
                    <Terminal className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black tracking-wider uppercase text-slate-200 font-mono">ASCENT</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] font-mono tracking-wider text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  <span>VERIFIED</span>
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

                <h3 className="text-base font-bold text-white tracking-tight">{user.displayName || user.username}</h3>
                <p className="text-xs text-slate-400 mb-4 font-mono">@{user.username}</p>

                {/* Flame Streak Motif */}
                <div className={`w-full p-3 rounded-2xl border ${themeStyles.flameBg} mb-4 flex items-center justify-center gap-2.5 backdrop-blur-sm`}>
                  <Flame className="w-6 h-6 fill-current" />
                  <div className="text-left font-mono">
                    <div className="text-xl font-black leading-tight tracking-tight">{stats.streakDays} DAYS</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-90">ACTIVE STREAK</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 w-full text-left font-mono">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Modules</span>
                    </div>
                    <div className="text-base font-black text-white">{stats.completedModules}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Projects</span>
                    </div>
                    <div className="text-base font-black text-white">{stats.totalProjects}</div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10 text-[10px] font-mono text-slate-400">
                <span>ascent.dev/u/{user.username}</span>
                <span className="font-semibold text-cyan-400">Vanilla JS Mastery</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 mt-2 font-mono">1080×1920 HD Ready (9:16)</span>
          </div>

          {/* Controls & Options */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-mono font-semibold text-slate-300 mb-2.5 block uppercase tracking-wider">
                Select Card Palette
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('cyan')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold border transition cursor-pointer ${
                    theme === 'cyan'
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-950'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Cyan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('green')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold border transition cursor-pointer ${
                    theme === 'green'
                      ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-sm shadow-emerald-950'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Emerald</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('magenta')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold border transition cursor-pointer ${
                    theme === 'magenta'
                      ? 'border-fuchsia-400 bg-fuchsia-950/60 text-fuchsia-300 shadow-sm shadow-fuchsia-950'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                  <span>Magenta</span>
                </button>
              </div>
            </div>

            {/* Public Profile Toggle */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block">Public Profile Page</span>
                    <p className="text-[11px] text-slate-400 font-mono">/u/{user.username}</p>
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
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white transition shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleNativeShare}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs font-mono uppercase tracking-wider bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Card (Social / Story)</span>
              </button>

              <button
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition cursor-pointer"
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
