import React from 'react'
import { useApp } from '../context/AppContext'
import { Terminal, Shield, Cpu, Activity, User, BookOpen, Layers } from 'lucide-react'

export const Header: React.FC = () => {
  const { currentScreen, setScreen, learnerProfile, activeProject } = useApp()

  return (
    <header className="h-14 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Brand Logo & Latency Stats */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setScreen(1)}
          className="flex items-center gap-2 group cursor-pointer focus:outline-none"
        >
          <div className="w-6 h-6 rounded bg-[#00F0FF]/10 border border-[#00F0FF]/40 flex items-center justify-center group-hover:border-[#00F0FF] transition-colors">
            <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight flex items-center gap-1">
            Ascent<span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] inline-block animate-pulse"></span>
          </span>
        </button>

        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-500 pl-4 border-l border-white/10">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            LATENCY: <span className="text-emerald-400">14ms</span>
          </span>
          <span className="text-slate-700">|</span>
          <span>RUNTIME: NODE_V22.4_V8</span>
        </div>
      </div>

      {/* Center Screen Navigation */}
      <nav className="flex items-center gap-1 text-sm font-medium">
        <button
          onClick={() => setScreen(1)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            currentScreen === 1 ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Prompt Engine
        </button>
        <button
          onClick={() => setScreen(2)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            currentScreen === 2 ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Scope
        </button>
        <button
          onClick={() => setScreen(3)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            currentScreen === 3 ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Calibration
        </button>
        <button
          onClick={() => setScreen(4)}
          className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
            currentScreen === 4 ? 'text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          IDE Workspace
        </button>
        <button
          onClick={() => setScreen(5)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            currentScreen === 5 ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Projects
        </button>
        <button
          onClick={() => setScreen(6)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            currentScreen === 6 ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Roadmap
        </button>
      </nav>

      {/* Right User Actions & Profile Avatar */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-[#12121A] border border-white/10 px-3 py-1 rounded-full text-xs font-mono">
          <Activity className="w-3 h-3 text-[#00F0FF]" />
          <span className="text-slate-400">{learnerProfile.streakDays}d streak</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 border border-white/20 flex items-center justify-center text-white text-xs font-bold shadow-lg">
          {learnerProfile.name.substring(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
