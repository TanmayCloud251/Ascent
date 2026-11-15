import crypto from 'node:crypto'
import { getEncryptionKey } from '../config/env.js'

/**
 * Encrypts a sensitive string (e.g., GitHub OAuth token) using AES-256-GCM.
 * Output format: `ivHex:authTagHex:encryptedHex`
 */
export function encryptToken(token: string): string {
  if (!token) return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * Validates authentication tag to ensure data integrity and authenticity.
 */
export function decryptToken(encryptedEnvelope: string): string {
  if (!encryptedEnvelope) return ''
  const parts = encryptedEnvelope.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format.')
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generates a cryptographically secure random hex token (e.g. for CSRF state or session id).
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}
