import React, { useState, useEffect } from 'react'
import { Key, Shield, CheckCircle2, AlertCircle, Trash2, X, Eye, EyeOff, ExternalLink } from 'lucide-react'
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
      setValidationResult({ valid: false, error: 'Please enter a Gemini API key.' })
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
    setValidationResult({ valid: false, error: 'API key removed from your browser.' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F111A] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Add Your Gemini API Key</h2>
            <p className="text-xs text-slate-400">Bring Your Own Key (BYOK) for custom AI courses</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Strict Browser-Only Storage:</strong>
                <p className="text-slate-400 mt-0.5">
                  Your key is stored strictly inside your browser (IndexedDB) and sent over HTTPS per request in a header. Ascent servers <em>never</em> persist, store in MongoDB, or log your key.
                </p>
              </div>
            </div>
            <p className="text-slate-400">
              Curated projects never require an API key. A key is only needed to generate custom project curriculums and Socratic mentorship.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Gemini API Key</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <span>Get free key at Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-sm font-mono text-white placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {validationResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                validationResult.valid
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {validationResult.valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold">Key Verified Successfully!</span>
                    <p className="text-emerald-400/80 mt-0.5">Your key is ready for custom project generation.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-semibold">Verification Notice</span>
                    <p className="text-rose-300/90 mt-0.5">{validationResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            {hasExistingKey && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-950/30 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove key</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleValidateAndSave}
              disabled={isValidating || !apiKey.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <span>Test & Save Key</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
