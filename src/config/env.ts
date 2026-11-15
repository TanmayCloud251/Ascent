import crypto from 'node:crypto'

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  APP_URL: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ascent',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'ascent_default_session_secret_dev_32b!',
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.ASCENT_API_KEY || ''
} as const

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
