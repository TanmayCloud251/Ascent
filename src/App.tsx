import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-100 p-8 flex flex-col items-center justify-center">
      <div className="cyber-card-glow p-8 max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">
          Ascent <span className="text-[#00F0FF]">AI Academy</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Project-based developer education engine initialized successfully.
        </p>
        <div className="inline-flex gap-2">
          <span className="badge-cyan">Vite 6</span>
          <span className="badge-pass">React 19</span>
          <span className="badge-active">Cyberfunk UI</span>
        </div>
      </div>
    </div>
  )
}
