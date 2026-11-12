import React from 'react'

interface SimpleMarkdownProps {
  content: string
  className?: string
}

/**
 * Lightweight, safe Markdown renderer for module lessons and tasks
 * supporting headings, lists, paragraphs, inline code, bold, and fenced code blocks.
 */
export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content, className = '' }) => {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n')
  const elements: React.ReactNode[] = []

  let i = 0
  let keyCounter = 0

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = []
    const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = tokenRe.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      const token = match[0]
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={`c-${keyCounter++}`}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-white/10 text-[#00F0FF] font-mono text-[11px]"
          >
            {token.slice(1, -1)}
          </code>
        )
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`b-${keyCounter++}`} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        )
      }
      lastIndex = tokenRe.lastIndex
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    return parts
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      elements.push(
        <div key={`code-${keyCounter++}`} className="my-2.5 rounded-lg border border-white/10 bg-[#050509] overflow-hidden">
          {lang && (
            <div className="px-3 py-1 bg-white/5 border-b border-white/5 text-[10px] font-mono uppercase text-slate-400">
              {lang}
            </div>
          )}
          <pre className="p-3 overflow-x-auto text-[11px] font-mono text-cyan-200 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${keyCounter++}`} className="text-xs font-bold uppercase tracking-wider text-[#00F0FF] mt-3 mb-1 font-mono">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${keyCounter++}`} className="text-sm font-bold text-white mt-3 mb-1.5 font-display">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${keyCounter++}`} className="text-base font-bold text-white mt-1 mb-2 font-display">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    // Unordered or ordered list items
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${keyCounter++}`} className="list-disc pl-5 space-y-1 my-1.5 text-slate-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Blank line
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    elements.push(
      <p key={`p-${keyCounter++}`} className="text-slate-300 leading-relaxed my-1.5">
        {renderInline(paraLines.join(' '))}
      </p>
    )
  }

  return <div className={`text-xs font-sans space-y-1 ${className}`}>{elements}</div>
}

