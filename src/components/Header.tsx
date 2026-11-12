import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Terminal,
  Cpu,
  Flame,
  Sparkles,
  ChevronDown,
  Check
} from 'lucide-react'
import { UserTier } from '../types/ascent'
import { getUserInitials } from '../utils/learnerStats'

export const Header: React.FC = () => {
  const {
    currentScreen,
    setScreen,
    currentUser,
    updateCurrentUser,
    streakMetrics,
    loadPresetProject
  } = useApp()

  const [isPresetsOpen, setIsPresetsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const initials = getUserInitials(currentUser)

  const tiers: { id: UserTier; label: string; desc: string }[] = [
    { id: 'tier1', label: 'Tier 1: Guided', desc: 'Step-by-step hints & syntax scaffolding' },
    { id: 'tier2', label: 'Tier 2: Architectural (Recommended)', desc: 'High-level conceptual pointers' },
    { id: 'tier3', label: 'Tier 3: Autonomous', desc: 'Zero unsolicited hints, CI tests only' }
  ]

  return (
    <header className="h-14 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-white/10 px-4 md:px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Brand Logo & Runtime Stats */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => setScreen(1)}
          className="flex items-center gap-2 group cursor-pointer focus:outline-none"
        >
          <div className="w-6 h-6 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/40 flex items-center justify-center group-hover:border-[#00F0FF] transition-colors">
            <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight flex items-center gap-1">
            Ascent<span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] inline-block animate-pulse" />
          </span>
        </button>

        <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-500 pl-4 border-l border-white/10">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
            GEMINI SPEC ENGINE
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-emerald-400">PERSISTENCE: LOCALSTORAGE</span>
        </div>
      </div>

      {/* Center Screen Navigation */}
      <nav className="flex items-center gap-1 text-xs md:text-sm font-medium">
        <button
          onClick={() => setScreen(1)}
          className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
            currentScreen === 1 ? 'text-[#00F0FF] bg-[#00F0FF]/10 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          1. Prompt
        </button>
        <button
          onClick={() => setScreen(2)}
          className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
            currentScreen === 2 ? 'text-[#00F0FF] bg-[#00F0FF]/10 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          2. Spec Review
        </button>
        <button
          onClick={() => setScreen(3)}
          className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
            currentScreen === 3 ? 'text-[#00F0FF] bg-[#00F0FF]/10 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          3. Project Overview
        </button>
        <button
          onClick={() => setScreen(4)}
          className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
            currentScreen === 4 ? 'text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/30 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          4. Workspace
        </button>
        <button
          onClick={() => setScreen(5)}
          className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
            currentScreen === 5 ? 'text-[#00F0FF] bg-[#00F0FF]/10 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          5. Projects
        </button>
        <button
          onClick={() => setScreen(6)}
          className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
            currentScreen === 6 ? 'text-[#00F0FF] bg-[#00F0FF]/10 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          6. Roadmap
        </button>
      </nav>

      {/* Right User Actions & Profile Session */}
      <div className="flex items-center gap-3">
        {/* Preset Ideas Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsPresetsOpen(!isPresetsOpen)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-[#00F0FF]/40 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>Preset Ideas</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {isPresetsOpen && (
            <div className="absolute right-0 mt-2 w-72 cyber-card p-2 bg-[#10101C] border-[#00F0FF]/40 rounded-xl shadow-2xl z-50 font-mono text-xs space-y-1">
              <div className="px-2 py-1 text-[10px] text-slate-500 uppercase tracking-wider">
                QUICK BLUEPRINTS
              </div>
              <button
                onClick={() => {
                  loadPresetProject('ecommerce')
                  setIsPresetsOpen(false)
                }}
                className="w-full text-left p-2 rounded hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                1. Axolotl Care & Feeding Tracker
              </button>
              <button
                onClick={() => {
                  loadPresetProject('dashboard')
                  setIsPresetsOpen(false)
                }}
                className="w-full text-left p-2 rounded hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                2. HTML/JS: Telemetry Dashboard
              </button>
              <button
                onClick={() => {
                  loadPresetProject('taskmanager')
                  setIsPresetsOpen(false)
                }}
                className="w-full text-left p-2 rounded hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                3. HTML/JS: Kanban Sprint Planner
              </button>
              <button
                onClick={() => {
                  loadPresetProject('portfolio')
                  setIsPresetsOpen(false)
                }}
                className="w-full text-left p-2 rounded hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] transition-colors cursor-pointer"
              >
                4. Plain CSS: Developer Terminal
              </button>
            </div>
          )}
        </div>

        {/* Computed Local-Calendar Current Streak Badge */}
        <button
          onClick={() => setScreen(6)}
          title={streakMetrics.statusLabel}
          data-testid="navbar-streak-badge"
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors cursor-pointer ${
            streakMetrics.currentStreak > 0
              ? 'bg-amber-500/10 border-amber-500/35 text-amber-300 hover:border-amber-400'
              : 'bg-[#12121A] border-white/10 text-slate-400 hover:border-[#00F0FF]/40'
          }`}
        >
          <Flame
            className={`w-3.5 h-3.5 ${
              streakMetrics.currentStreak > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
            }`}
          />
          <span>{streakMetrics.currentStreak}d streak</span>
        </button>

        {/* User Profile Session Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            data-testid="navbar-profile-trigger"
            className="flex items-center gap-2 bg-[#12121A] hover:bg-[#161622] border border-white/10 hover:border-[#00F0FF]/40 pl-2 pr-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer"
          >
            <div
              data-testid="navbar-avatar-initials"
              className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 border border-white/20 flex items-center justify-center text-white text-[10px] font-bold"
            >
              {initials}
            </div>
            <div className="text-left hidden md:block">
              <span className="text-white font-medium block leading-none">{currentUser.name}</span>
              <span className="text-slate-500 text-[10px] block leading-none mt-0.5">{currentUser.handle}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 cyber-card p-3 bg-[#10101C] border-[#00F0FF]/40 rounded-xl shadow-2xl z-50 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  ACTIVE PROFILE SESSION
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/30">
                  PERSISTED
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-slate-400 text-[11px] block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={currentUser.name}
                    onChange={(e) => updateCurrentUser({ name: e.target.value })}
                    className="cyber-input w-full text-xs py-1 px-2"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Initials</label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder={initials}
                    value={currentUser.avatarInitials || ''}
                    onChange={(e) =>
                      updateCurrentUser({ avatarInitials: e.target.value.toUpperCase().slice(0, 3) })
                    }
                    className="cyber-input w-full text-xs py-1 px-2 uppercase text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Handle / GitHub</label>
                <input
                  type="text"
                  value={currentUser.handle}
                  onChange={(e) => updateCurrentUser({ handle: e.target.value })}
                  className="cyber-input w-full text-xs py-1 px-2"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Pedagogical Tier</label>
                <div className="space-y-1">
                  {tiers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => updateCurrentUser({ tier: t.id })}
                      className={`w-full text-left p-1.5 rounded flex items-center justify-between transition-colors ${
                        currentUser.tier === t.id
                          ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] truncate">{t.label}</span>
                      {currentUser.tier === t.id && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="cyber-btn-primary text-xs py-1 px-3"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
