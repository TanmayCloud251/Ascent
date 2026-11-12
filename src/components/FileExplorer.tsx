import React, { useMemo, useRef, useState } from 'react'
import { ProjectFile } from '../schemas/course'
import {
  MAX_TOTAL_PROJECT_BYTES,
  computeTotalProjectBytes,
  formatBytes,
  isAudioMime,
  isFontMime,
  isImageMime
} from '../services/fileUtils'
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Music,
  Pencil,
  RotateCcw,
  Trash2,
  Type as FontIcon,
  Upload,
  X,
  Check
} from 'lucide-react'

interface TreeFolderNode {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

interface TreeFileNode {
  kind: 'file'
  name: string
  path: string
  file: ProjectFile
}

type TreeNode = TreeFolderNode | TreeFileNode

interface FileExplorerProps {
  projectFiles: ProjectFile[]
  projectFolders: string[]
  activeFile: string
  onSelectFile: (path: string) => void
  isReadOnly?: boolean
  assetError: string | null
  onClearError: () => void
  hasMissingProvidedAssets: boolean
  onRestoreProvidedAssets: () => Promise<void>
  onCreateFile: (path: string) => boolean
  onCreateFolder: (path: string) => boolean
  onUploadFiles: (
    items: FileList | File[] | Array<{ file: File; targetFolder?: string }>
  ) => Promise<{ added: string[]; errors: string[] }>
  onRenameEntry: (oldPath: string, newPath: string, isFolder?: boolean) => Promise<boolean>
  onDeleteEntry: (path: string, isFolder?: boolean) => Promise<void>
}

function buildTree(files: ProjectFile[], explicitFolders: string[]): TreeNode[] {
  const rootMap = new Map<string, TreeFolderNode>()

  const getOrCreateFolder = (folderPath: string): TreeFolderNode => {
    const existing = rootMap.get(folderPath)
    if (existing) return existing
    const parts = folderPath.split('/')
    const name = parts[parts.length - 1]
    const node: TreeFolderNode = {
      kind: 'folder',
      name,
      path: folderPath,
      children: []
    }
    rootMap.set(folderPath, node)
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = getOrCreateFolder(parentPath)
      if (!parent.children.some(c => c.kind === 'folder' && c.path === folderPath)) {
        parent.children.push(node)
      }
    }
    return node
  }

  for (const dir of explicitFolders) {
    if (dir) getOrCreateFolder(dir)
  }

  const topNodes: TreeNode[] = []
  for (const file of files) {
    const parts = file.path.split('/')
    const fileName = parts[parts.length - 1]
    const fileNode: TreeFileNode = {
      kind: 'file',
      name: fileName,
      path: file.path,
      file
    }
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = getOrCreateFolder(parentPath)
      parent.children.push(fileNode)
    } else {
      topNodes.push(fileNode)
    }
  }

  // Attach top-level folders (those without '/') to topNodes
  for (const [folderPath, folderNode] of rootMap.entries()) {
    if (!folderPath.includes('/')) {
      topNodes.push(folderNode)
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.kind === 'folder') {
        sortNodes(node.children)
      }
    }
    return nodes
  }

  return sortNodes(topNodes)
}

function renderFileIcon(file: ProjectFile) {
  const p = file.path.toLowerCase()
  if (isImageMime(file.mimeType, file.path)) {
    return <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
  }
  if (isAudioMime(file.mimeType, file.path)) {
    return <Music className="w-3.5 h-3.5 shrink-0 text-purple-400" />
  }
  if (isFontMime(file.mimeType, file.path)) {
    return <FontIcon className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
  }
  if (p.endsWith('.html') || p.endsWith('.htm')) {
    return <FileCode className="w-3.5 h-3.5 shrink-0 text-orange-400" />
  }
  if (p.endsWith('.css')) {
    return <FileCode className="w-3.5 h-3.5 shrink-0 text-sky-400" />
  }
  if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.json')) {
    return <FileCode className="w-3.5 h-3.5 shrink-0 text-amber-300" />
  }
  return <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  projectFiles,
  projectFolders,
  activeFile,
  onSelectFile,
  isReadOnly = false,
  assetError,
  onClearError,
  hasMissingProvidedAssets,
  onRestoreProvidedAssets,
  onCreateFile,
  onCreateFolder,
  onUploadFiles,
  onRenameEntry,
  onDeleteEntry
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [creatingMode, setCreatingMode] = useState<'file' | 'folder' | null>(null)
  const [createValue, setCreateValue] = useState<string>('')
  const [renamingTarget, setRenamingTarget] = useState<{ path: string; isFolder: boolean } | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState<{ path: string; isFolder: boolean } | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [isRestoringProvided, setIsRestoringProvided] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetFolderRef = useRef<string | undefined>(undefined)

  const tree = useMemo(() => buildTree(projectFiles, projectFolders), [projectFiles, projectFolders])
  const totalBytes = useMemo(() => computeTotalProjectBytes(projectFiles), [projectFiles])

  const isFolderExpanded = (folderPath: string) => {
    if (expandedFolders[folderPath] !== undefined) return expandedFolders[folderPath]
    // Auto-expand folders containing active file or top-level defaults
    return activeFile.startsWith(`${folderPath}/`) || !folderPath.includes('/')
  }

  const toggleFolder = (folderPath: string) => {
    setSelectedFolder(folderPath)
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !isFolderExpanded(folderPath)
    }))
  }

  const startCreate = (mode: 'file' | 'folder') => {
    if (isReadOnly) return
    onClearError()
    setCreatingMode(mode)
    setCreateValue(selectedFolder ? `${selectedFolder}/` : '')
  }

  const submitCreate = () => {
    if (!creatingMode || !createValue.trim()) {
      setCreatingMode(null)
      return
    }
    const ok =
      creatingMode === 'file'
        ? onCreateFile(createValue.trim())
        : onCreateFolder(createValue.trim())
    if (ok) {
      setCreatingMode(null)
      setCreateValue('')
    }
  }

  const submitRename = async () => {
    if (!renamingTarget || !renameValue.trim()) {
      setRenamingTarget(null)
      return
    }
    const ok = await onRenameEntry(renamingTarget.path, renameValue.trim(), renamingTarget.isFolder)
    if (ok) {
      setRenamingTarget(null)
      setRenameValue('')
    }
  }

  const triggerUploadPicker = (targetFolder?: string) => {
    if (isReadOnly) return
    onClearError()
    uploadTargetFolderRef.current = targetFolder
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const targetFolder = uploadTargetFolderRef.current
    const items: Array<{ file: File; targetFolder?: string }> = []
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)
      if (f) items.push({ file: f, targetFolder })
    }
    const res = await onUploadFiles(items)
    if (targetFolder && res.added.length > 0) {
      setExpandedFolders(prev => ({ ...prev, [targetFolder]: true }))
    }
  }

  const handleDropOnTarget = async (e: React.DragEvent, targetFolder?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(null)
    if (isReadOnly) return
    const dropped = e.dataTransfer?.files
    if (!dropped || dropped.length === 0) return
    const items: Array<{ file: File; targetFolder?: string }> = []
    for (let i = 0; i < dropped.length; i++) {
      const f = dropped.item(i)
      if (f) items.push({ file: f, targetFolder })
    }
    const res = await onUploadFiles(items)
    if (targetFolder && res.added.length > 0) {
      setExpandedFolders(prev => ({ ...prev, [targetFolder]: true }))
    }
  }

  const renderNodes = (nodes: TreeNode[], depth = 0): React.ReactNode => {
    return nodes.map(node => {
      const paddingLeft = 8 + depth * 12

      if (node.kind === 'folder') {
        const expanded = isFolderExpanded(node.path)
        const isRenamingThis = renamingTarget?.isFolder && renamingTarget.path === node.path
        const isConfirmingDelete = confirmDelete?.isFolder && confirmDelete.path === node.path
        const isDragOver = dragOverTarget === node.path

        return (
          <div key={`dir:${node.path}`} className="space-y-0.5">
            {isRenamingThis ? (
              <div
                style={{ paddingLeft }}
                className="flex items-center gap-1 py-1 pr-1 bg-white/5 rounded"
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void submitRename()
                    if (e.key === 'Escape') setRenamingTarget(null)
                  }}
                  className="flex-1 min-w-0 bg-black/60 border border-[#00F0FF]/50 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void submitRename()}
                  className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  aria-label="Confirm rename"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingTarget(null)}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Cancel rename"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                style={{ paddingLeft }}
                onDragOver={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isReadOnly) setDragOverTarget(node.path)
                }}
                onDragLeave={e => {
                  e.stopPropagation()
                  if (dragOverTarget === node.path) setDragOverTarget(null)
                }}
                onDrop={e => void handleDropOnTarget(e, node.path)}
                className={`group flex items-center justify-between gap-1 py-1 pr-1.5 rounded text-xs font-mono transition-colors ${
                  isDragOver
                    ? 'bg-[#00F0FF]/20 border border-[#00F0FF]/60 text-white'
                    : selectedFolder === node.path
                    ? 'bg-white/5 text-slate-200'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFolder(node.path)}
                  className="flex-1 min-w-0 flex items-center gap-1 text-left cursor-pointer"
                  title={node.path}
                >
                  {expanded ? (
                    <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                  )}
                  {expanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-[#00F0FF]/80 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-[#00F0FF]/70 shrink-0" />
                  )}
                  <span className="truncate">{node.name}</span>
                </button>

                {!isReadOnly && (
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => triggerUploadPicker(node.path)}
                      title={`Upload to ${node.path}`}
                      aria-label={`Upload into ${node.path}`}
                      className="p-0.5 text-slate-400 hover:text-[#00F0FF] cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingTarget({ path: node.path, isFolder: true })
                        setRenameValue(node.path)
                      }}
                      title={`Rename ${node.name}`}
                      aria-label={`Rename folder ${node.name}`}
                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ path: node.path, isFolder: true })}
                      title={`Delete ${node.name}`}
                      aria-label={`Delete folder ${node.name}`}
                      className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {isConfirmingDelete && (
              <div
                style={{ marginLeft: paddingLeft }}
                className="p-1.5 mr-1 rounded bg-rose-950/60 border border-rose-500/40 text-[10px] space-y-1.5"
              >
                <p className="text-rose-200 truncate">Delete folder &quot;{node.name}&quot;?</p>
                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      void onDeleteEntry(node.path, true)
                      setConfirmDelete(null)
                    }}
                    className="flex-1 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {expanded && node.children.length > 0 && (
              <div className="space-y-0.5">{renderNodes(node.children, depth + 1)}</div>
            )}
          </div>
        )
      }

      // File Node
      const isSelected = activeFile === node.path
      const isRenamingThis = !renamingTarget?.isFolder && renamingTarget?.path === node.path
      const isConfirmingDelete = !confirmDelete?.isFolder && confirmDelete?.path === node.path

      return (
        <div key={`file:${node.path}`} className="space-y-0.5">
          {isRenamingThis ? (
            <div
              style={{ paddingLeft }}
              className="flex items-center gap-1 py-1 pr-1 bg-white/5 rounded"
            >
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void submitRename()
                  if (e.key === 'Escape') setRenamingTarget(null)
                }}
                className="flex-1 min-w-0 bg-black/60 border border-[#00F0FF]/50 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void submitRename()}
                className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                aria-label="Confirm rename"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setRenamingTarget(null)}
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cancel rename"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              style={{ paddingLeft }}
              className={`group flex items-center justify-between gap-1 py-1 pr-1.5 rounded text-xs font-mono transition-colors ${
                isSelected
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40 font-semibold'
                  : 'text-slate-300 hover:bg-white/5 border border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const slashIdx = node.path.lastIndexOf('/')
                  setSelectedFolder(slashIdx >= 0 ? node.path.slice(0, slashIdx) : '')
                  onSelectFile(node.path)
                }}
                title={node.path}
                className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
              >
                {renderFileIcon(node.file)}
                <span className="truncate">{node.name}</span>
                {node.file.isProvided && (
                  <span className="shrink-0 px-1 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] text-cyan-300 uppercase">
                    provided
                  </span>
                )}
              </button>

              {!isReadOnly && (
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingTarget({ path: node.path, isFolder: false })
                      setRenameValue(node.path)
                    }}
                    title={`Rename ${node.name}`}
                    aria-label={`Rename file ${node.name}`}
                    className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ path: node.path, isFolder: false })}
                    title={`Delete ${node.name}`}
                    aria-label={`Delete file ${node.name}`}
                    className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {isConfirmingDelete && (
            <div
              style={{ marginLeft: paddingLeft }}
              className="p-1.5 mr-1 rounded bg-rose-950/60 border border-rose-500/40 text-[10px] space-y-1.5"
            >
              <p className="text-rose-200 truncate">Delete &quot;{node.name}&quot;?</p>
              <div className="flex items-center gap-1.5 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    void onDeleteEntry(node.path, false)
                    setConfirmDelete(null)
                  }}
                  className="flex-1 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 overflow-hidden transition-colors ${
        dragOverTarget === '__root__' ? 'bg-[#00F0FF]/10 ring-1 ring-inset ring-[#00F0FF]/50' : ''
      }`}
      onDragOver={e => {
        e.preventDefault()
        if (!isReadOnly) setDragOverTarget('__root__')
      }}
      onDragLeave={() => {
        if (dragOverTarget === '__root__') setDragOverTarget(null)
      }}
      onDrop={e => void handleDropOnTarget(e, undefined)}
    >
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.svg,audio/*,.woff,.woff2,.ttf,.otf,.eot,.html,.htm,.css,.js,.mjs,.json,.md,.txt"
        onChange={e => void handleFileInputChange(e)}
        className="hidden"
      />

      {/* Explorer Header + Action Toolbar */}
      <div className="px-3 pt-2.5 pb-1.5 border-b border-white/10 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
          <span>Explorer ({projectFiles.length})</span>
          <span className="text-slate-500" title="Total project storage usage">
            {formatBytes(totalBytes)} / 10 MB
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => startCreate('file')}
            title="New File"
            aria-label="New File"
            className="flex-1 py-1 px-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-[10px] font-mono cursor-pointer"
          >
            <FilePlus className="w-3 h-3 text-[#00F0FF]" />
            <span>File</span>
          </button>
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => startCreate('folder')}
            title="New Folder"
            aria-label="New Folder"
            className="flex-1 py-1 px-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-[10px] font-mono cursor-pointer"
          >
            <FolderPlus className="w-3 h-3 text-amber-300" />
            <span>Folder</span>
          </button>
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => triggerUploadPicker(selectedFolder || undefined)}
            title="Upload files or assets"
            aria-label="Upload files"
            className="flex-1 py-1 px-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-[10px] font-mono cursor-pointer"
          >
            <Upload className="w-3 h-3 text-emerald-400" />
            <span>Upload</span>
          </button>
        </div>

        {creatingMode && (
          <div className="p-1.5 rounded bg-[#141420] border border-[#00F0FF]/40 space-y-1.5">
            <div className="text-[10px] font-mono text-[#00F0FF]">
              {creatingMode === 'file' ? 'New file path (e.g. css/style.css):' : 'New folder path (e.g. images):'}
            </div>
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={createValue}
                onChange={e => setCreateValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitCreate()
                  if (e.key === 'Escape') {
                    setCreatingMode(null)
                    setCreateValue('')
                  }
                }}
                placeholder={creatingMode === 'file' ? 'js/helper.js' : 'images'}
                className="flex-1 min-w-0 bg-black/60 border border-white/15 rounded px-1.5 py-1 text-[11px] font-mono text-white focus:border-[#00F0FF] focus:outline-none"
              />
              <button
                type="button"
                onClick={submitCreate}
                className="p-1 rounded bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/30 cursor-pointer"
                aria-label="Create"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingMode(null)
                  setCreateValue('')
                }}
                className="p-1 rounded bg-white/5 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cancel create"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {hasMissingProvidedAssets && (
          <button
            type="button"
            disabled={isRestoringProvided || isReadOnly}
            onClick={async () => {
              setIsRestoringProvided(true)
              await onRestoreProvidedAssets()
              setIsRestoringProvided(false)
            }}
            className="w-full py-1 px-2 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isRestoringProvided ? 'Restoring...' : 'Restore provided assets'}</span>
          </button>
        )}

        {assetError && (
          <div className="p-2 rounded bg-rose-950/60 border border-rose-500/40 text-[10px] font-mono text-rose-200 flex items-start justify-between gap-1.5">
            <span className="leading-snug break-words">{assetError}</span>
            <button
              type="button"
              onClick={onClearError}
              className="text-rose-300 hover:text-white shrink-0 cursor-pointer"
              aria-label="Dismiss file error"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree.length === 0 ? (
          <div className="p-3 text-center text-[11px] font-mono text-slate-500">
            Drop files here or use + File / Upload
          </div>
        ) : (
          renderNodes(tree)
        )}
      </div>

      <div className="px-3 py-1 border-t border-white/5 text-[9px] font-mono text-slate-500 shrink-0">
        Drag &amp; drop files onto folders (5 MB max/file)
      </div>
    </div>
  )
}

