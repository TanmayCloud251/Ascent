import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Lock,
  Cpu
} from 'lucide-react'
import { clientApiKeyService } from '../services/clientApiKeyService'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
    errorCode?: string
  } | null>(null)
  const [hasExistingKey, setHasExistingKey] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const existing = clientApiKeyService.getUserApiKey()
      if (existing) {
        setApiKey(existing)
        setHasExistingKey(true)
      } else {
        setApiKey('')
        setHasExistingKey(false)
      }
      setValidationResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, error: 'Please enter your Gemini API key.' })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      const resp = await fetch('/api/llm/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      })

      const data = await resp.json()
      if (data.valid) {
        clientApiKeyService.setUserApiKey(apiKey.trim())
        setHasExistingKey(true)
        setValidationResult({ valid: true })
        setTimeout(() => {
          if (onSuccess) onSuccess()
          onClose()
        }, 1200)
      } else {
        setValidationResult({
          valid: false,
          error: data.error || 'API key validation failed. Please check your key.',
          errorCode: data.errorCode
        })
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        error: err?.message || 'Network error while validating key.'
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemoveKey = () => {
    clientApiKeyService.removeUserApiKey()
    setApiKey('')
    setHasExistingKey(false)
    setValidationResult({ valid: false, error: 'API key successfully removed from browser storage.' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0C0F17] border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)] text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Bring Your Own Key (BYOK)</h2>
            <p className="text-xs font-mono text-cyan-400/90">Client-Side Only • Zero Server Storage</p>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="flex items-center gap-2 mb-5 p-1 bg-black/40 rounded-xl border border-white/5">
          <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-xs font-mono text-cyan-300 font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google Gemini</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1 inline-block animate-pulse" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-mono text-slate-500 opacity-60 cursor-not-allowed">
            <Cpu className="w-3.5 h-3.5" />
            <span>Anthropic (Soon)</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-mono text-slate-500 opacity-60 cursor-not-allowed">
            <Cpu className="w-3.5 h-3.5" />
            <span>OpenAI (Soon)</span>
          </div>
        </div>

        {/* Description & Privacy Notice */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mb-5 space-y-1.5 leading-relaxed font-sans">
          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5" />
            <span>ZERO PERSISTENCE SECURITY MODEL</span>
          </div>
          <p className="text-slate-400 text-xs">
            Your key stays exclusively inside your browser's IndexedDB. It is sent per-request via HTTPS header (<code className="text-cyan-300 font-mono">x-user-api-key</code>), is never written to MongoDB, and is scrubbed from all server logs.
          </p>
        </div>

        {/* Input Field */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-200">Gemini API Key</label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline font-mono text-[11px]"
            >
              <span>Get Free Gemini Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AQ.Ab8RN6... or AIzaSy..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-slate-700/80 focus:border-cyan-400 focus:outline-none text-white font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Validation Result Feedback */}
        {validationResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono mb-5 flex items-start gap-2.5 ${
              validationResult.valid
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {validationResult.valid ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Key Verified Successfully</span>
                  <span className="text-[11px] text-emerald-400/80 font-sans">Active test call succeeded. Key ready for custom tracks.</span>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Key Validation Failed</span>
                  <span className="text-[11px] text-rose-300/80 font-sans">{validationResult.error}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div>
            {hasExistingKey && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="flex items-center gap-1.5 text-xs font-mono text-rose-400/90 hover:text-rose-300 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Key</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleValidateAndSave}
              disabled={isValidating || !apiKey.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
              <span>{isValidating ? 'Validating...' : 'Verify & Save Key'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
