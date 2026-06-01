'use client'

import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toggleReaction } from '@/features/reactions/actions'
import {
  ALLOWED_REACTION_EMOJIS,
  type ReactionBucket,
  type ReactionEmoji,
} from '@/features/reactions/types'

type Props = {
  predictionId: string
  initialBuckets: ReactionBucket[]
}

export function ReactionBar({ predictionId, initialBuckets }: Props) {
  const [buckets, setBuckets] = useState<ReactionBucket[]>(initialBuckets)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function applyOptimistic(emoji: ReactionEmoji, nowReacted: boolean) {
    setBuckets((prev) => {
      const next = [...prev]
      const i = next.findIndex((b) => b.emoji === emoji)
      if (nowReacted) {
        if (i === -1) {
          next.push({ emoji, count: 1, reactedByMe: true, reactors: ['Tú'] })
        } else {
          next[i] = { ...next[i], count: next[i].count + 1, reactedByMe: true }
        }
      } else if (i !== -1) {
        const count = Math.max(0, next[i].count - 1)
        if (count === 0) next.splice(i, 1)
        else next[i] = { ...next[i], count, reactedByMe: false }
      }
      return next
    })
  }

  function handleToggle(emoji: ReactionEmoji) {
    if (pending) return
    const existing = buckets.find((b) => b.emoji === emoji)
    const willReact = !existing?.reactedByMe
    applyOptimistic(emoji, willReact)
    setOpen(false)
    startTransition(async () => {
      const r = await toggleReaction(predictionId, emoji)
      if (!r.ok) {
        // Rollback
        applyOptimistic(emoji, !willReact)
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {buckets.map((b) => (
        <button
          key={b.emoji}
          type="button"
          onClick={() => handleToggle(b.emoji as ReactionEmoji)}
          title={b.reactors.join(', ')}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
            b.reactedByMe
              ? 'border-primary/30 bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-sm leading-none">{b.emoji}</span>
          <span className="font-mono text-[10px] tabular-nums">{b.count}</span>
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Reaccionar"
            className="grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="flex w-auto gap-1 p-1.5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {ALLOWED_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleToggle(emoji)}
              className="grid h-8 w-8 place-items-center rounded-md text-lg hover:bg-muted"
              aria-label={`Reaccionar con ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
