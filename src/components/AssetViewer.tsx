import React, { useState } from 'react'
import { ProjectFile } from '../schemas/course'
import { formatBytes, isAudioMime, isFontMime, isImageMime } from '../services/fileUtils'
import { Copy, Check, Image as ImageIcon, Music, Type as FontIcon, File } from 'lucide-react'

interface AssetViewerProps {
  file: ProjectFile
  dataUrl?: string
}

export const AssetViewer: React.FC<AssetViewerProps> = ({ file, dataUrl }) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const isImg = isImageMime(file.mimeType, file.path)
  const isAud = isAudioMime(file.mimeType, file.path)
  const isFont = isFontMime(file.mimeType, file.path)

  const handleCopyPath = () => {
    try {
      void navigator.clipboard?.writeText(file.path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#0B0B11] overflow-y-auto">
      {/* Header Metadata Bar */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-[#0D0D15] flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isImg ? (
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : isAud ? (
            <Music className="w-4 h-4 text-purple-400 shrink-0" />
          ) : isFont ? (
            <FontIcon className="w-4 h-4 text-cyan-300 shrink-0" />
          ) : (
            <File className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="text-white font-semibold truncate">{file.path}</span>
          {file.isProvided && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px]">
              provided
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 text-[10px]">
            Read-Only Asset
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>{file.mimeType}</span>
          <span>•</span>
          <span>{formatBytes(file.size || 0)}</span>
          {dimensions && (
            <>
              <span>•</span>
              <span className="text-emerald-300">
                {dimensions.width} × {dimensions.height} px
              </span>
            </>
          )}
          <button
            type="button"
            onClick={handleCopyPath}
            className="ml-2 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy Path'}</span>
          </button>
        </div>
      </div>

      {/* Asset Preview Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
        {!dataUrl ? (
          <div className="p-6 rounded-xl border border-white/10 bg-[#12121C] text-xs font-mono text-slate-400">
            Loading asset preview from IndexedDB...
          </div>
        ) : isImg ? (
          <div className="max-w-full max-h-[65vh] p-4 rounded-xl border border-white/10 bg-[repeating-conic-gradient(#14141f_0%_25%,#1b1b29_0%_50%)] bg-[length:20px_20px] flex items-center justify-center shadow-lg">
            <img
              src={dataUrl}
              alt={file.path}
              onLoad={e =>
                setDimensions({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight
                })
              }
              className="max-w-full max-h-[55vh] object-contain rounded"
            />
          </div>
        ) : isAud ? (
          <div className="w-full max-w-md p-6 rounded-xl border border-purple-500/30 bg-[#12101B] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Music className="w-5 h-5 text-purple-300" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{file.path}</div>
                <div className="text-[11px] font-mono text-slate-400">
                  {file.mimeType} • {formatBytes(file.size || 0)}
                </div>
              </div>
            </div>
            <audio controls src={dataUrl} className="w-full" />
            <div className="p-2.5 rounded bg-black/50 border border-white/5 text-[11px] font-mono text-slate-300">
              &lt;audio controls src=&quot;{file.path}&quot;&gt;&lt;/audio&gt;
            </div>
          </div>
        ) : isFont ? (
          <div className="w-full max-w-lg p-6 rounded-xl border border-cyan-500/30 bg-[#0E131A] space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <FontIcon className="w-4 h-4" />
              <span>Font Asset ({formatBytes(file.size || 0)})</span>
            </div>
            <p className="text-slate-300 font-sans text-xs">
              Reference this font in CSS using a relative url():
            </p>
            <pre className="p-3 rounded bg-black/60 border border-white/10 text-emerald-300 overflow-x-auto">
{`@font-face {
  font-family: 'CustomFont';
  src: url('${file.path}');
}`}
            </pre>
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-white/10 bg-[#12121C] text-xs font-mono text-slate-300 space-y-2">
            <div>Binary Asset: {file.path}</div>
            <div>Type: {file.mimeType}</div>
            <div>Size: {formatBytes(file.size || 0)}</div>
          </div>
        )}

        {isImg && (
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
            Usage in HTML: <span className="text-[#00F0FF]">&lt;img src=&quot;{file.path}&quot; alt=&quot;&quot; /&gt;</span>
          </div>
        )}
      </div>
    </div>
  )
}

