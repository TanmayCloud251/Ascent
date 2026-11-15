const API_KEY_STORAGE_KEY = 'ascent_user_byok_api_key'

/**
 * Client-Side BYOK (Bring Your Own Key) Storage:
 * Stored strictly inside the learner's browser (localStorage / IndexedDB).
 * NEVER sent to MongoDB or saved permanently on the server.
 */
export const clientApiKeyService = {
  getUserApiKey(): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(API_KEY_STORAGE_KEY)
        return val ? val.trim() : null
      }
    } catch {
      // ignore
    }
    return null
  },

  setUserApiKey(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
      }
    } catch (e) {
      console.warn('Failed to save API key to local browser storage:', e)
    }
  },

  removeUserApiKey(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(API_KEY_STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to remove API key from local browser storage:', e)
    }
  },

  hasUserApiKey(): boolean {
    const key = this.getUserApiKey()
    return Boolean(key && key.length > 5)
  }
}
