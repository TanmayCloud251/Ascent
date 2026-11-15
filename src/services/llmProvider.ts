import { GoogleGenAI, Type } from '@google/genai'

export interface StructuredGenerationOptions {
  systemInstruction?: string
  temperature?: number
  timeoutMs?: number
}

export interface KeyValidationResult {
  valid: boolean
  error?: string
  errorCode?: 'INVALID_KEY' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'UNKNOWN'
}

export interface LLMProvider {
  name: string
  validateKey(apiKey: string): Promise<KeyValidationResult>
  generateStructured<T>(
    apiKey: string,
    schema: any,
    prompt: string,
    options?: StructuredGenerationOptions
  ): Promise<{ data: T; usageTokens?: number }>
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini'
  model = 'gemini-3.8-flash'

  /**
   * Validates a user-provided Gemini API key with a minimal structured test call.
   * Maps 400/403 to invalid key, and 429 to quota exceeded.
   */
  async validateKey(apiKey: string): Promise<KeyValidationResult> {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return { valid: false, error: 'Please enter a valid Gemini API key.', errorCode: 'INVALID_KEY' }
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Ping',
        config: {
          maxOutputTokens: 5,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING }
            },
            required: ['status']
          }
        }
      })

      if (response && response.text) {
        return { valid: true }
      }
      return { valid: true }
    } catch (err: any) {
      const msg = String(err?.message || err || '')
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('INVALID_ARGUMENT') || msg.includes('400') || msg.includes('403')) {
        return {
          valid: false,
          errorCode: 'INVALID_KEY',
          error: 'Gemini API key is invalid or not recognized by Google AI Studio. Please verify the key.'
        }
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('quota')) {
        return {
          valid: false,
          errorCode: 'QUOTA_EXCEEDED',
          error: 'Your API key hit its quota or rate limit on Google AI Studio.'
        }
      }
      return {
        valid: false,
        errorCode: 'NETWORK_ERROR',
        error: `Could not validate key: ${msg.slice(0, 150)}`
      }
    }
  }

  async generateStructured<T>(
    apiKey: string,
    schema: any,
    prompt: string,
    options?: StructuredGenerationOptions
  ): Promise<{ data: T; usageTokens?: number }> {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
    const response = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: options?.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    })

    const raw = response.text || '{}'
    const parsed = JSON.parse(raw) as T
    const usageTokens = response.usageMetadata?.totalTokenCount || undefined
    return { data: parsed, usageTokens }
  }
}

export const geminiProvider = new GeminiProvider()

/**
 * Key Source Resolver:
 * Determines the provider and key source (currently user BYOK only).
 */
export function resolveKeySource(userApiKey?: string | null): { provider: string; keySource: 'user' | 'platform'; apiKey: string | null } {
  if (userApiKey && userApiKey.trim().length > 0) {
    return {
      provider: 'gemini',
      keySource: 'user',
      apiKey: userApiKey.trim()
    }
  }

  return {
    provider: 'gemini',
    keySource: 'user',
    apiKey: null
  }
}

