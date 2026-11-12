import { ProjectFile } from '../schemas/course'

export const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_TOTAL_PROJECT_BYTES = 10 * 1024 * 1024 // 10 MB

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
}

const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.txt', '.md'])

export function getExtension(filePath: string): string {
  const clean = filePath.split('?')[0].split('#')[0]
  const lastDot = clean.lastIndexOf('.')
  const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  if (lastDot <= lastSlash) return ''
  return clean.slice(lastDot).toLowerCase()
}

export function inferMimeType(filePath: string): string {
  const ext = getExtension(filePath)
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

export function isTextCodePath(filePath: string): boolean {
  const ext = getExtension(filePath)
  return TEXT_EXTENSIONS.has(ext)
}

export function isImageMime(mimeType: string, path?: string): boolean {
  if (mimeType.startsWith('image/')) return true
  const ext = path ? getExtension(path) : ''
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif'].includes(ext)
}

export function isAudioMime(mimeType: string, path?: string): boolean {
  if (mimeType.startsWith('audio/')) return true
  const ext = path ? getExtension(path) : ''
  return ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)
}

export function isFontMime(mimeType: string, path?: string): boolean {
  if (mimeType.startsWith('font/')) return true
  const ext = path ? getExtension(path) : ''
  return ['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)
}

/**
 * Normalizes a relative project path and rejects path traversal (`..`),
 * drive prefixes, control characters, and empty paths.
 */
export function sanitizeProjectPath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null
  const trimmed = rawPath.trim().replace(/\\/g, '/')
  if (!trimmed || trimmed.includes('\0')) return null
  if (/^[a-zA-Z]:/.test(trimmed)) return null

  const cleaned = trimmed.replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '')
  if (!cleaned) return null

  const segments = cleaned.split('/')
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return null
  }
  return cleaned
}

export function getTextByteSize(content: string): number {
  return new Blob([content]).size
}

export function computeTotalProjectBytes(files: ProjectFile[]): number {
  return files.reduce((sum, f) => {
    if (f.kind === 'text') {
      return sum + (typeof f.size === 'number' ? f.size : getTextByteSize(f.content || ''))
    }
    return sum + (f.size || 0)
  }, 0)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function textMapToProjectFiles(
  textMap: Record<string, string>,
  existingBinaryFiles: ProjectFile[] = []
): ProjectFile[] {
  const result: ProjectFile[] = []
  const seen = new Set<string>()

  for (const [rawPath, content] of Object.entries(textMap)) {
    const clean = sanitizeProjectPath(rawPath) || rawPath
    seen.add(clean)
    result.push({
      path: clean,
      kind: 'text',
      content,
      mimeType: inferMimeType(clean),
      size: getTextByteSize(content)
    })
  }

  for (const bf of existingBinaryFiles) {
    if (bf.kind === 'binary' && !seen.has(bf.path)) {
      result.push(bf)
      seen.add(bf.path)
    }
  }

  return result
}

export function projectFilesToTextMap(files: ProjectFile[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of files) {
    if (f.kind === 'text') {
      map[f.path] = f.content || ''
    }
  }
  return map
}

