'use client'

import { useEffect, useState } from 'react'

type Piece = {
  left: string
  top: string
  w: number
  h: number
  round: boolean
  color: string
  dur: string
  delay: string
  opacity: string
}

const COLORS = [
  'var(--mpe-gold-1)',
  'var(--mpe-gold-2)',
  'var(--mpe-emerald)',
  'var(--mpe-red)',
  'var(--mpe-blue)',
  'var(--mpe-silver-1)',
]

// Confeti del flyer de fin de Mundial. Se genera solo en el cliente (Math.random)
// para no romper la hidratación; en SSR el contenedor va vacío. Puramente
// decorativo (aria-hidden) y respeta prefers-reduced-motion vía CSS.
export function Confetti({ count = 80 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    const out: Piece[] = []
    for (let i = 0; i < count; i++) {
      const w = 5 + Math.random() * 9
      const h = 7 + Math.random() * 13
      const round = Math.random() > 0.6
      out.push({
        left: `${(Math.random() * 100).toFixed(2)}%`,
        top: `${(-5 + Math.random() * 105).toFixed(2)}%`,
        w,
        h: round ? w : h,
        round,
        color: COLORS[i % COLORS.length],
        dur: `${(6 + Math.random() * 7).toFixed(2)}s`,
        delay: `${(-Math.random() * 13).toFixed(2)}s`,
        opacity: (0.5 + Math.random() * 0.45).toFixed(2),
      })
    }
    setPieces(out)
  }, [count])

  return (
    <div className="mpe-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative list
          key={i}
          className="mpe-cf"
          style={{
            left: p.left,
            top: p.top,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            opacity: p.opacity,
            animation: `mpe-fall ${p.dur} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  )
}
