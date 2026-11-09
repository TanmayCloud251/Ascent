import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ArrowLeft, ArrowRight, Check, Sliders, Shield, Database, Key, GitBranch, Info } from 'lucide-react'
import { CalibrationTier } from '../types'

const CALIBRATION_OPTIONS = [
  {
    tier: 'tier_1' as CalibrationTier,
    title: 'New to this domain',
    badge: 'TIER 1',
    description: 'Provide guided step-by-step architectural hints and syntax scaffolds.'
  },
  {
    tier: 'tier_2' as CalibrationTier,
    title: 'Some experience',
    badge: 'RECOMMENDED',
    description: 'High-level architectural pointers; only show syntax if I ask.'
  },
  {
    tier: 'tier_3' as CalibrationTier,
    title: 'Fully autonomous',
    badge: 'TIER 3',
    description: 'Zero unsolicited hints; evaluate my implementation via CI tests only.'
  },
  {
    tier: 'external' as CalibrationTier,
    title: 'Just review my code',
    badge: 'EXTERNAL IDE',
    description: "I'll write everything locally; just lint, test, and provide code review."
  }
]

export const Screen3Calibration: React.FC = () => {
  const { learnerProfile, setCalibrationTier, setScreen } = useApp()
  const [selectedTier, setSelectedTier] = useState<CalibrationTier>(learnerProfile.calibrationTier || 'tier_2')

  const handleConfirm = () => {
    setCalibrationTier(selectedTier)
    setScreen(4)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
      <div className="w-full max-w-3xl space-y-8">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <button
            onClick={() => setScreen(2)}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to project scope
          </button>

          <div className="flex items-center gap-4">
            <span>CALIBRATION // HINT ENGINE</span>
            <span className="text-slate-600">|</span>
            <span>QUESTION <strong className="text-[#00F0FF]">02 OF 03</strong></span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-mono">
            <Sliders className="w-3.5 h-3.5" /> AI TUTOR CALIBRATION
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
            Quick check before we start
          </h2>
          <p className="text-slate-400 text-sm font-sans">
            Calibrating AI hint granularity and autonomous scaffolding to match your experience.
          </p>
        </div>

        {/* Question Card Header */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-300">
          <span className="font-semibold text-white">
            How comfortable are you building async state and database mutations from scratch?
          </span>
          <span className="text-slate-500 uppercase">SELECT ONE</span>
        </div>

        {/* Calibration Options Cards List */}
        <div className="space-y-3">
          {CALIBRATION_OPTIONS.map((opt) => (
            <button
              key={opt.tier}
              onClick={() => setSelectedTier(opt.tier)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                selectedTier === opt.tier
                  ? 'bg-[#141424] border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10'
                  : 'bg-[#101018] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedTier === opt.tier ? 'border-[#00F0FF] bg-[#00F0FF]' : 'border-slate-600'
                }`}>
                  {selectedTier === opt.tier && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold text-white">{opt.title}</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-sans">{opt.description}</p>
                </div>
              </div>

              <span className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                opt.badge === 'RECOMMENDED'
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                {opt.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Action Button & Note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            onClick={handleConfirm}
            className="cyber-btn-primary px-8 py-3.5 text-base w-full sm:w-auto"
          >
            <span>CONFIRM & ENTER WORKSPACE</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
            <Info className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>You can adjust hint frequency anytime inside IDE workspace settings.</span>
          </div>
        </div>

        {/* Quiet Preview Section */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              QUIET PREVIEW: FUTURE RUNTIME REQUIREMENTS
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30">
              ZERO BLOCKING FRICTION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="cyber-card p-3.5 bg-[#0D0D14] border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> PostgreSQL
                </span>
                <span className="text-slate-500">MOD 03</span>
              </div>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                You'll connect or provision a local database in Module 03. No action needed now.
              </p>
            </div>

            <div className="cyber-card p-3.5 bg-[#0D0D14] border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Stripe Test Keys
                </span>
                <span className="text-slate-500">SANDBOX</span>
              </div>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                Mock sandbox credentials provided automatically; production keys optional later.
              </p>
            </div>

            <div className="cyber-card p-3.5 bg-[#0D0D14] border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> GitHub Auth
                </span>
                <span className="text-slate-500">AUTO-LINK</span>
              </div>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                We'll link your local Git remote when you push your first verified commit.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
