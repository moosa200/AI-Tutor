'use client'

import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'

interface MathProps {
  children: string
  block?: boolean
}

export function Math({ children, block = false }: MathProps) {
  try {
    return block ? (
      <BlockMath math={children} />
    ) : (
      <InlineMath math={children} />
    )
  } catch (error) {
    console.error('Math rendering error:', error)
    return <span className="text-red-500" title={String(error)}>Invalid math: {children}</span>
  }
}

/**
 * Parse text containing LaTeX math expressions
 * Supports: $inline math$ and $$block math$$
 */
export function parseMathText(text: string) {
  if (!text) return null

  // Split by $$...$$  (block math) and $...$ (inline math)
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g)

  return parts.map((part, i) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      // Block math
      return <Math key={i} block>{part.slice(2, -2)}</Math>
    } else if (part.startsWith('$') && part.endsWith('$')) {
      // Inline math
      return <Math key={i}>{part.slice(1, -1)}</Math>
    }
    // Regular text - preserve newlines
    return <span key={i} className="whitespace-pre-wrap">{part}</span>
  })
}
