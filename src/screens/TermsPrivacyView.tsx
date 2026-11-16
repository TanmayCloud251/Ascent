import React from 'react'
import { ShieldCheck, Lock, KeyRound, ArrowLeft, Trash2, FileText, Sparkles } from 'lucide-react'

export const TermsPrivacyView: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 p-6 sm:p-12 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Background Subtle Matrix */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-cyan-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto space-y-8 font-sans">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ascent Academy</span>
        </a>

        <div className="border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy & Security Architecture</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Terms of Service & Privacy Policy</h1>
          <p className="text-xs font-mono text-slate-400 mt-1">Effective Date: November 2026 • Version 2.0</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
            <Lock className="w-5 h-5 text-cyan-400" />
            <span>1. GitHub OAuth & Permissions</span>
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Ascent uses GitHub OAuth as its single authentication provider. To synchronize your coursework into private repositories, Ascent requests the classic OAuth App scopes <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">repo</code>, <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">read:user</code>, and <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">user:email</code>.
          </p>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div>
              <strong className="text-slate-200">Least-Privilege Purpose:</strong> The <code className="text-cyan-300 font-mono">repo</code> scope is required by the GitHub REST API to allow creating private repositories directly under personal user profiles (<code className="text-cyan-300 font-mono">POST /user/repos</code>) and committing code files using the Git Data API.
            </div>
            <div>
              <strong className="text-slate-200">Encryption at Rest:</strong> GitHub OAuth access tokens are encrypted using AES-256-GCM prior to storage in MongoDB. Tokens are decrypted only transiently in memory to perform Git operations, are never returned to the browser client, and are never logged.
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span>2. Bring Your Own Key (BYOK) Data Handling</span>
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Ascent empowers learners to bring their own Gemini API keys for generative curriculum synthesis and Socratic code mentorship.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1.5 leading-relaxed">
            <li>Your Gemini API key is stored exclusively in your local browser storage (IndexedDB/localStorage).</li>
            <li>The key is transmitted solely over encrypted HTTPS per request in the <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">x-user-api-key</code> request header.</li>
            <li>Ascent servers do not store your API key in MongoDB, do not cache your key, and redact all API keys from telemetry, trace logs, and error responses.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <span>3. Account Deletion & Data Retention</span>
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            You retain absolute ownership over your account and learning data. You can disconnect your GitHub grant or permanently delete your account at any time from your Profile settings.
          </p>
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
            <strong>Account Deletion Effect:</strong> Choosing &quot;Delete my account&quot; immediately deletes your user profile, course progress, project state, and active sessions from MongoDB. All repositories created on your GitHub account remain completely untouched and remain your private property forever.
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>4. Cookie Policy</span>
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Ascent uses strictly necessary HTTP-only, SameSite cookies (<code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">ascent_session</code> and <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">ascent_oauth_state</code>) for authenticated session maintenance and OAuth CSRF protection. No third-party tracking or advertising cookies are utilized.
          </p>
        </section>
      </div>
    </div>
  )
}

