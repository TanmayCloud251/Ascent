import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export function loadEnvFile(override: boolean = false): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx <= 0) continue
      const key = line.slice(0, eqIdx).trim().replace(/^export\s+/, '')
      let value = line.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).trim()
      }
      if (override || process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore error reading .env
  }
}

// Initial load on import
loadEnvFile(false)

export function reloadEnv(): void {
  loadEnvFile(true)
}

const PLACEHOLDER_GITHUB_IDS = new Set([
  '',
  'undefined',
  'null',
  'your_github_oauth_client_id',
  'your_github_oauth_client_secret'
])

export function isGitHubConfigured(): boolean {
  reloadEnv()
  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim()
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim()
  return (
    clientId.length > 0 &&
    !PLACEHOLDER_GITHUB_IDS.has(clientId) &&
    clientSecret.length > 0 &&
    !PLACEHOLDER_GITHUB_IDS.has(clientSecret)
  )
}

export const ENV = {
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development'
  },
  get PORT(): number {
    return Number(process.env.PORT || 3000)
  },
  get APP_URL(): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  },
  get MONGODB_URI(): string {
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ascent'
  },
  get GITHUB_CLIENT_ID(): string {
    return process.env.GITHUB_CLIENT_ID || ''
  },
  get GITHUB_CLIENT_SECRET(): string {
    return process.env.GITHUB_CLIENT_SECRET || ''
  },
  get SESSION_SECRET(): string {
    return process.env.SESSION_SECRET || 'ascent_default_session_secret_dev_32b!'
  },
  get TOKEN_ENCRYPTION_KEY(): string {
    return process.env.TOKEN_ENCRYPTION_KEY || ''
  },
  get GEMINI_API_KEY(): string {
    return process.env.GEMINI_API_KEY || process.env.ASCENT_API_KEY || ''
  }
}

// Derive 32-byte AES-256 key from TOKEN_ENCRYPTION_KEY or SESSION_SECRET
export function getEncryptionKey(): Buffer {
  const rawKey = ENV.TOKEN_ENCRYPTION_KEY || ENV.SESSION_SECRET
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  // Scrypt derivation for consistent 32-byte key
  return crypto.scryptSync(rawKey, 'ascent_token_salt_v1', 32)
}

/**
 * Redacts any API keys, tokens, or sensitive strings from logs and error messages.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return ''

  return text
    // Redact GitHub OAuth / Personal access tokens (ghp_, gho_, ghu_, ghs_, ghr_)
    .replace(/gh[pousr]_[A-Za-z0-9_]{30,255}/g, '[REDACTED_GITHUB_TOKEN]')
    // Redact Google / Gemini API keys (AIza..., AQ...)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/AQ\.[A-Za-z0-9_-]{30,255}/g, '[REDACTED_API_KEY]')
    // Redact Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    // Redact MongoDB connection strings with credentials
    .replace(/mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g, 'mongodb$1://[REDACTED_USER_PASSWORD]@')
}

