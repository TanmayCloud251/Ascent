import React, { useState, useEffect } from 'react'
import {
  LLMTraceEvent,
  subscribeToLLMTraces,
  getLatestLLMTrace
} from '../services/llmService'
import {
  Activity,
  ChevronUp,
  ChevronDown,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Server,
  Zap,
  Clock
} from 'lucide-react'

export const LLMTracePanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [trace, setTrace] = useState<LLMTraceEvent | null>(() => getLatestLLMTrace())
  const [activeTab, setActiveTab] = useState<'response' | 'request' | 'parsed'>('response')
  const [copied, setCopied] = useState(false)
  const [serverModelStatus, setServerModelStatus] = useState<{
    model: string
    verified: boolean
    error: string | null
    tested: boolean
  } | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToLLMTraces((newTrace) => {
      setTrace(newTrace)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    // Poll server model verification status on mount
    fetch('/api/llm/status')
      .then(res => res.json())
      .then(data => setServerModelStatus(data))
      .catch(() => {})
  }, [])

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-6xl mx-auto px-4 pointer-events-auto">
        {/* Toggle Bar */}
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`px-3 py-1.5 rounded-t-lg border border-b-0 font-mono text-xs flex items-center gap-2 shadow-2xl transition-all cursor-pointer ${
              trace?.isCached
                ? 'bg-[#18140B] border-amber-500/40 text-amber-300 hover:bg-[#221c0f]'
                : trace
                ? 'bg-[#0B151A] border-[#00F0FF]/40 text-[#00F0FF] hover:bg-[#0f1f26]'
                : 'bg-[#101018] border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="font-bold">LLM TRACE DEBUG</span>

            {trace ? (
              <>
                <span className="text-slate-600">|</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider ${
                    trace.isCached
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      : trace.error
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                  }`}
                >
                  {trace.isCached ? 'CACHED' : trace.error ? 'ERROR' : 'LIVE'}
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  {trace.latencyMs}ms
                </span>
                <span className="text-slate-500 text-[10px] hidden md:inline">
                  {trace.model}
                </span>
              </>
            ) : (
              <span className="text-slate-500 text-[10px]">Awaiting call...</span>
            )}

            {isOpen ? <ChevronDown className="w-3.5 h-3.5 ml-1" /> : <ChevronUp className="w-3.5 h-3.5 ml-1" />}
          </button>
        </div>

        {/* Expanded Panel */}
        {isOpen && (
          <div className="bg-[#0A0A12] border border-white/20 rounded-t-xl shadow-2xl p-4 text-xs font-mono max-h-[60vh] overflow-y-auto space-y-4">
            {/* Header Telemetry Metrics */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#00F0FF]" />
                  <span className="text-white font-bold text-sm">LLM Execution Inspector</span>
                </div>

                {trace?.isCached ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px] flex items-center gap-1">
                    <Zap className="w-3 h-3" /> CACHED RESPONSE (0 TOKENS)
                  </span>
                ) : trace && !trace.error ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> LIVE GEMINI API CALL
                  </span>
                ) : trace?.error ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> CALL FAILED
                  </span>
                ) : null}
              </div>

              {serverModelStatus && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  <span>STARTUP STATUS:</span>
                  <span className={serverModelStatus.verified ? 'text-emerald-400' : 'text-rose-400'}>
                    {serverModelStatus.verified ? 'VERIFIED' : 'FAILED / UNCONFIGURED'}
                  </span>
                </div>
              )}
            </div>

            {/* Metrics Ribbon */}
            {trace ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded bg-black/50 border border-white/5 space-y-0.5">
                  <span className="text-slate-500 block text-[10px]">ENDPOINT</span>
                  <span className="text-cyan-300 font-semibold truncate block">{trace.endpoint}</span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-white/5 space-y-0.5">
                  <span className="text-slate-500 block text-[10px]">MODEL NAME</span>
                  <span className="text-white font-semibold truncate block">{trace.model}</span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-white/5 space-y-0.5">
                  <span className="text-slate-500 block text-[10px]">LATENCY</span>
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {trace.latencyMs} ms
                  </span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-white/5 space-y-0.5">
                  <span className="text-slate-500 block text-[10px]">ZOD VALIDATION</span>
                  <span className={trace.validationSuccess ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {trace.validationSuccess ? 'VALIDATED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded bg-black/40 border border-white/5 text-center text-slate-500 text-xs">
                No LLM calls recorded in this session yet. Submit a prompt or click a preset to see real execution telemetry.
              </div>
            )}

            {/* Error Banner if Trace has error */}
            {trace?.error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-rose-100">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Real Error Surface:</span>
                </div>
                <p className="font-mono text-[11px] leading-relaxed pl-6">{trace.error}</p>
              </div>
            )}

            {/* Tabbed Inspector */}
            {trace && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('response')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        activeTab === 'response' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-semibold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Raw Response Text
                    </button>
                    <button
                      onClick={() => setActiveTab('request')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        activeTab === 'request' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-semibold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Request Payload
                    </button>
                    <button
                      onClick={() => setActiveTab('parsed')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        activeTab === 'parsed' ? 'bg-[#00F0FF]/15 text-[#00F0FF] font-semibold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Parsed Object
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const content =
                        activeTab === 'response'
                          ? trace.rawResponseText
                          : activeTab === 'request'
                          ? JSON.stringify(trace.requestPayload, null, 2)
                          : JSON.stringify(trace.parsedResult, null, 2)
                      copyText(content)
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Content'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-black/80 border border-white/10 overflow-x-auto max-h-56 text-[11px] text-slate-300 font-mono leading-relaxed">
                  <pre>
                    {activeTab === 'response'
                      ? trace.rawResponseText
                      : activeTab === 'request'
                      ? JSON.stringify(trace.requestPayload, null, 2)
                      : JSON.stringify(trace.parsedResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
