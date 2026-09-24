import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  FolderTree,
  FileCode,
  HelpCircle,
  Terminal,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Maximize2,
  ChevronRight,
  Sparkles,
  BookOpen,
  Code2,
  Copy,
  ArrowRight,
  ExternalLink,
  Layers,
  Cpu
} from 'lucide-react'

export const Screen4Workspace: React.FC = () => {
  const {
    activeProject,
    activeModule,
    activeFile,
    setActiveFile,
    codeFiles,
    updateFileCode,
    runTestCases,
    isTestRunning,
    testStatus,
    unlockHint,
    setScreen
  } = useApp()

  const [activeRailTab, setActiveRailTab] = useState<'modules' | 'files' | 'hints'>('modules')
  const [activeMainTab, setActiveMainTab] = useState<'editor' | 'preview' | 'terminal'>('editor')
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  const filesList = Object.keys(codeFiles)
  const currentCode = codeFiles[activeFile] || ''

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(`const total = useCartStore((state) => state.items.length);`)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col bg-[#08080E] text-slate-200 overflow-hidden select-none">
      
      {/* Top Workspace Header Bar */}
      <div className="h-10 bg-[#0C0C14] border-b border-white/10 px-4 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="text-[#00F0FF] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> apps / storefront / {activeFile}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-[10px]">
            MOD 02 • IN PROGRESS
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            HMR: Active
          </span>
          <span>Port :3000</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">main*</span>
          <span className="text-emerald-400">0 errors</span>
          <span className="text-amber-400">0 warnings</span>
          <span>TypeScript 5.6.2</span>
        </div>
      </div>

      {/* Main 3-Column IDE Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Far-Left Activity Rail (VS Code Style) */}
        <div className="w-12 bg-[#090910] border-r border-white/10 flex flex-col items-center justify-between py-3 shrink-0">
          <div className="space-y-4">
            <button
              onClick={() => setActiveRailTab('modules')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'modules' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Build Objectives & Modules"
            >
              <Layers className="w-5 h-5" />
              {activeRailTab === 'modules' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>

            <button
              onClick={() => setActiveRailTab('files')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'files' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="File Explorer Tree"
            >
              <FolderTree className="w-5 h-5" />
              {activeRailTab === 'files' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>

            <button
              onClick={() => setActiveRailTab('hints')}
              className={`p-2 rounded-lg transition-colors relative ${
                activeRailTab === 'hints' ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="AI Architectural Hints"
            >
              <HelpCircle className="w-5 h-5" />
              {activeRailTab === 'hints' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#00F0FF] rounded-r"></span>
              )}
            </button>
          </div>

          <button
            onClick={() => setScreen(6)}
            className="p-2 text-slate-500 hover:text-[#00F0FF] transition-colors"
            title="View Full Roadmap"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Panel (Driven by Rail Selection) */}
        <div className="w-72 bg-[#0C0C14] border-r border-white/10 flex flex-col justify-between shrink-0 overflow-y-auto">
          {activeRailTab === 'modules' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-2">
                <span className="text-white font-bold tracking-wider">STOREFRONT // WEB</span>
                <span className="text-[#00F0FF]">1/4 DONE</span>
              </div>

              {/* Tasks List */}
              <div className="space-y-3">
                {activeModule.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border text-xs font-mono space-y-2 transition-all ${
                      task.status === 'passed'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : task.status === 'active'
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40 shadow-lg shadow-[#00F0FF]/5'
                        : 'bg-white/5 border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        {task.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {task.status === 'active' && <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>}
                        {task.status === 'locked' && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                        {task.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        task.status === 'passed' ? 'badge-pass' : task.status === 'active' ? 'badge-cyan' : 'text-slate-500'
                      }`}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Subtasks Bullet List */}
                    {task.subtasks.length > 0 && (
                      <div className="pl-4 space-y-1 text-[11px]">
                        {task.subtasks.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 text-slate-400">
                            <span className={sub.completed ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                              {sub.completed ? '✓' : '•'}
                            </span>
                            <span className={sub.completed ? 'line-through text-slate-500' : 'text-slate-300'}>
                              {sub.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeRailTab === 'files' && (
            <div className="p-4 space-y-3 font-mono text-xs">
              <div className="text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10 font-bold">
                EXPLORER // CODEBASE
              </div>
              <div className="space-y-1">
                {filesList.map((file) => (
                  <button
                    key={file}
                    onClick={() => setActiveFile(file)}
                    className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 transition-colors ${
                      activeFile === file ? 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <FileCode className="w-4 h-4 shrink-0" />
                    <span className="truncate">{file}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeRailTab === 'hints' && (
            <div className="p-4 space-y-3 text-xs font-mono">
              <div className="text-slate-400 uppercase tracking-wider pb-2 border-b border-white/10 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> AI HINTS ENGINE
              </div>
              <div className="space-y-3">
                {activeModule.hints.map((hint) => (
                  <div key={hint.id} className="p-3 rounded bg-[#101018] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Hint #{hint.hintOrder}</span>
                      <span className="text-[#00F0FF]">{hint.pointCost === 0 ? 'FREE' : `-${hint.pointCost} pts`}</span>
                    </div>
                    {hint.unlocked ? (
                      <p className="text-slate-200 font-sans leading-relaxed">{hint.content}</p>
                    ) : (
                      <button
                        onClick={() => unlockHint(hint.id)}
                        className="cyber-btn-secondary text-xs w-full py-1.5 justify-center"
                      >
                        Unlock Hint ({hint.pointCost} pts)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Sidebar Action Link */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setScreen(6)}
              className="text-xs font-mono text-slate-400 hover:text-[#00F0FF] flex items-center gap-1.5 transition-colors"
            >
              <span>View full roadmap & syllabus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Theory & Lesson Drawer Column */}
        <div className="w-96 bg-[#0E0E18] border-r border-white/10 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-5 space-y-6">
            
            {/* Lesson Title Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#00F0FF] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> LESSON // STATE ARCHITECTURE
                </span>
                <span className="text-slate-500">2 of 5</span>
              </div>
              <h3 className="text-xl font-display font-bold text-white tracking-tight">
                {activeModule.title}
              </h3>
            </div>

            {/* Markdown Lesson Content */}
            <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-3">
              <p>
                In high-frequency e-commerce UI (like cart drawer increments), Context triggers full subtree re-renders whenever <code className="bg-slate-800 text-cyan-400 px-1 py-0.5 rounded font-mono">items[]</code> updates. Zustand allows selective subscription via atom slices.
              </p>
            </div>

            {/* Code Snippet Reference Box */}
            <div className="cyber-card bg-[#07070D] border border-white/10 rounded-lg overflow-hidden font-mono text-xs">
              <div className="px-3 py-1.5 bg-black/40 border-b border-white/10 flex items-center justify-between text-slate-400">
                <span>src/store/useCartStore.ts</span>
                <button
                  onClick={handleCopySnippet}
                  className="text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSnippet ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-cyan-300 overflow-x-auto">
{`const total = useCartStore(
  (state) => state.items.length
);`}
              </pre>
            </div>

            {/* Core Interfaces in Scope */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                CORE INTERFACES IN SCOPE
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {activeModule.coreInterfaces.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-cyan-400 font-bold">{item.name}</span>
                    <span className="text-slate-500 text-[10px]">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Architectural Hint Card */}
            <div className="cyber-card p-4 bg-[#0A121A] border-[#00F0FF]/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#00F0FF] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Architectural Hint
                </span>
                <span className="text-slate-500">0 pts</span>
              </div>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Make sure to apply <code className="bg-black/50 text-cyan-300 px-1 py-0.5 rounded font-mono">aria-expanded</code> and <code className="bg-black/50 text-cyan-300 px-1 py-0.5 rounded font-mono">role="dialog"</code> on your overlay wrapper. The test runner checks accessibility tags before snapshot matching!
              </p>
            </div>

          </div>

          {/* Bottom Target Time Info */}
          <div className="p-4 border-t border-white/10 text-xs font-mono text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
            <span>Target completion time for Module 2: ~15 mins</span>
          </div>
        </div>

        {/* Main Code Editor & Live Preview Panel */}
        <div className="flex-1 flex flex-col bg-[#07070C] overflow-hidden">
          
          {/* Main Tab Switcher Bar */}
          <div className="h-10 bg-[#090910] border-b border-white/10 px-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveMainTab('editor')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'editor'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{activeFile}</span>
              </button>
              <button
                onClick={() => setActiveMainTab('preview')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'preview'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Web Application Preview</span>
              </button>
              <button
                onClick={() => setActiveMainTab('terminal')}
                className={`px-3 py-1.5 rounded-t-md border-t border-x transition-colors flex items-center gap-1.5 ${
                  activeMainTab === 'terminal'
                    ? 'bg-[#07070C] border-white/10 text-[#00F0FF]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Runner Terminal</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-500">
              <button onClick={() => updateFileCode(activeFile, currentCode)} title="Reload Code">
                <RotateCcw className="w-3.5 h-3.5 hover:text-white" />
              </button>
            </div>
          </div>

          {/* Main Content Render Area */}
          <div className="flex-1 relative overflow-hidden flex">
            
            {/* Tab 1: Code Editor Pane */}
            {activeMainTab === 'editor' && (
              <div className="w-full h-full flex flex-col font-mono text-xs">
                <textarea
                  value={currentCode}
                  onChange={(e) => updateFileCode(activeFile, e.target.value)}
                  className="w-full h-full bg-[#06060B] text-slate-100 p-4 font-mono outline-none border-none resize-none leading-relaxed selection:bg-[#00F0FF]/20"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Tab 2: Live App Web Preview Iframe Mock */}
            {activeMainTab === 'preview' && (
              <div className="w-full h-full p-6 bg-[#0B0B14] flex flex-col items-center justify-center">
                <div className="w-full max-w-lg cyber-card p-6 bg-[#10101C] border-[#00F0FF]/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h4 className="text-base font-bold text-white font-display">Storefront Shopping Cart</h4>
                    <span className="badge-cyan">Live Preview :3000</span>
                  </div>
                  <div className="p-4 rounded bg-[#07070E] border border-cyan-500/20 text-center space-y-2">
                    <p className="text-sm font-semibold text-white">Cart Drawer Overlay Component</p>
                    <p className="text-xs text-[#00F0FF] font-mono">
                      Items in cart: {currentCode.includes('totalItems = 0') ? '0' : '3'}
                    </p>
                    <button className="cyber-btn-primary text-xs py-1.5 px-4 mx-auto">
                      + Add Sample SKU
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Terminal Console Output */}
            {activeMainTab === 'terminal' && (
              <div className="w-full h-full p-4 bg-[#05050A] font-mono text-xs text-slate-300 space-y-2 overflow-y-auto">
                <div className="text-slate-500">$ vitest run src/components/cart/CartDrawer.test.tsx</div>
                <div className="text-emerald-400">✓ CartDrawer renders optimistic count badge correctly (12ms)</div>
                <div className={testStatus === 'pass' ? 'text-emerald-400' : 'text-amber-400'}>
                  {testStatus === 'pass' ? '✓ Zustand store updates items array without full subtree re-render (18ms)' : '❯ [RUNNING TEST ASSERTIONS]'}
                </div>
                {testStatus === 'pass' && (
                  <div className="text-emerald-400 font-bold pt-2">
                    Test Files  1 passed (1)<br />
                    Tests       2 passed (2)<br />
                    Start at    07:58:12 AM
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Verification Test Runner Bar */}
          <div className="h-14 bg-[#0A0A12] border-t border-white/10 px-6 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 uppercase font-bold">TEST VERIFICATION:</span>
              {testStatus === 'not_run' && (
                <span className="text-slate-500">Not run yet</span>
              )}
              {testStatus === 'running' && (
                <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> RUNNING ASSERTIONS...
                </span>
              )}
              {testStatus === 'pass' && (
                <span className="badge-pass flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ALL TESTS PASSED
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="text-rose-400 font-bold">1 TEST FAILED</span>
              )}
            </div>

            <button
              onClick={runTestCases}
              disabled={isTestRunning}
              className="cyber-btn-primary px-6 py-2 text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isTestRunning ? 'RUNNING...' : 'RUN VERIFICATION TESTS'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
