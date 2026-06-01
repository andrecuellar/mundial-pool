'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type Pick = {
  categoryKey: string
  categoryName: string
  earnedPoints: number
}

type Props = {
  groupId: string
  /** ISO of the latest resolved result we know about server-side. */
  latestResolvedAt: string | null
  /** Recently-resolved picks the user got right (computed on the server). */
  recentWins: Pick[]
}

const STORAGE_KEY = (groupId: string) => `mp:last-seen-results:${groupId}`

export function ResultCelebration({ groupId, latestResolvedAt, recentWins }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (typeof window === 'undefined') return
    if (!latestResolvedAt || recentWins.length === 0) return

    const lastSeen = window.localStorage.getItem(STORAGE_KEY(groupId))
    const lastSeenTs = lastSeen ? Date.parse(lastSeen) : 0
    const latestTs = Date.parse(latestResolvedAt)
    if (!Number.isFinite(latestTs) || latestTs <= lastSeenTs) return

    firedRef.current = true

    // Update storage immediately so a reload doesn't re-fire.
    window.localStorage.setItem(STORAGE_KEY(groupId), latestResolvedAt)

    const totalPoints = recentWins.reduce((a, w) => a + w.earnedPoints, 0)

    // Honour reduced-motion. Confetti still loads but skips animation.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!reduce) {
      void (async () => {
        const confetti = (await import('canvas-confetti')).default
        const end = Date.now() + 1500
        const colors = ['#5b7fdb', '#74c69d', '#f4a261']

        ;(function frame() {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors,
          })
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors,
          })
          if (Date.now() < end) {
            requestAnimationFrame(frame)
          }
        })()
      })()
    }

    const summary =
      recentWins.length === 1
        ? `Acertaste ${recentWins[0].categoryName}`
        : `Acertaste ${recentWins.length} categorías`
    toast.success(`🏆 ${summary} · +${totalPoints} pts`, { duration: 5000 })
  }, [groupId, latestResolvedAt, recentWins])

  return null
}
