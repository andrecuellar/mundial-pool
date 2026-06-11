'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ReactionBar } from '@/components/predictions/reaction-bar'
import { renderPick } from '@/components/predictions/render-pick'
import { ShareCardIconButton } from '@/components/predictions/share-card-icon-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AllPredictionsPick } from '@/features/predictions/queries'
import type { ReactionBucket } from '@/features/reactions/types'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  )
}

export type MemberPicksRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export type CategoryRow = {
  id: string
  key: string
  name: string
}

export type ViewData = {
  members: MemberPicksRow[]
  categories: CategoryRow[]
  /** Flat array of picks indexed via members×categories; missing entries = no pick. */
  picksByMemberCategory: Record<string, Record<string, AllPredictionsPick | undefined>>
  /** Optional prediction ids per (userId, categoryId). Required for reactions. */
  predictionIdsByMemberCategory?: Record<string, Record<string, string | undefined>>
  /** Optional reaction buckets keyed "userId-categoryId". */
  reactionsByKey?: Record<string, ReactionBucket[] | undefined>
}

type Props = {
  view: ViewData
  currentUserId: string
  /** When true and reactions are wired in `view`, shows the reaction bar. */
  enableReactions?: boolean
  /** Group name + slug — used to build the share-as-image filename and copy. */
  groupName: string
  groupSlug: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'jugador'
  )
}

export function AllPredictionsView({
  view,
  currentUserId,
  enableReactions = false,
  groupName,
  groupSlug,
}: Props) {
  const { members, categories } = view
  const [query, setQuery] = useState('')
  const [categoryKey, setCategoryKey] = useState<string>('all')

  function reactionBarFor(memberId: string, categoryId: string) {
    if (!enableReactions) return null
    const predictionId = view.predictionIdsByMemberCategory?.[memberId]?.[categoryId]
    if (!predictionId) return null
    const buckets = view.reactionsByKey?.[`${memberId}-${categoryId}`] ?? []
    return <ReactionBar predictionId={predictionId} initialBuckets={buckets} />
  }

  const filteredMembers = useMemo(() => {
    const q = normalize(query)
    if (!q) return members
    return members.filter((m) => normalize(m.displayName).includes(q))
  }, [members, query])

  const focusedCategory =
    categoryKey === 'all' ? null : (categories.find((c) => c.key === categoryKey) ?? null)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar miembro…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring sm:w-56"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {filteredMembers.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Sin miembros que coincidan con "{query}".
        </Card>
      )}

      {focusedCategory ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {focusedCategory.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Lo que eligió cada miembro en esta categoría.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {filteredMembers.map((m) => {
              const p = view.picksByMemberCategory[m.userId]?.[focusedCategory.id]
              const isMe = m.userId === currentUserId
              return (
                <li key={m.userId} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.displayName} />}
                        <AvatarFallback className="text-xs">
                          {initials(m.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-medium">{m.displayName}</span>
                      {isMe && (
                        <Badge
                          variant="secondary"
                          className="border-primary/20 bg-primary/10 text-primary"
                        >
                          Tú
                        </Badge>
                      )}
                    </div>
                    <div className="text-right text-sm">{renderPick(p)}</div>
                  </div>
                  {!isMe && reactionBarFor(m.userId, focusedCategory.id)}
                </li>
              )
            })}
          </ul>
        </Card>
      ) : (
        filteredMembers.map((m) => {
          const isMe = m.userId === currentUserId
          const memberPicks = view.picksByMemberCategory[m.userId] ?? {}
          const cardId = `member-share-${m.userId}`
          const nameSlug = slugifyName(m.displayName)
          return (
            <Card
              key={m.userId}
              id={cardId}
              className={`overflow-hidden p-0 ${isMe ? 'border-primary/40' : ''}`}
            >
              <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
                <Avatar className="h-9 w-9">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.displayName} />}
                  <AvatarFallback className="text-xs">{initials(m.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{m.displayName}</span>
                  {isMe && (
                    <Badge
                      variant="secondary"
                      className="border-primary/20 bg-primary/10 text-primary"
                    >
                      Tú
                    </Badge>
                  )}
                </div>
                <ShareCardIconButton
                  targetId={cardId}
                  fileName={`mundial-pool-${groupSlug}-${nameSlug}`}
                  shareTitle={`Apuestas de ${m.displayName} · ${groupName}`}
                  shareText={`Mira la apuesta de ${m.displayName} en ${groupName} para el Mundial 2026 en mundial•pool.`}
                  ariaLabel={`Compartir apuesta de ${m.displayName} como imagen`}
                />
              </div>
              <ul className="divide-y divide-border">
                {categories.map((cat) => (
                  <li key={cat.id} className="px-5 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-muted-foreground">{cat.name}</span>
                      <span className="text-right text-foreground">
                        {renderPick(memberPicks[cat.id])}
                      </span>
                    </div>
                    {!isMe && reactionBarFor(m.userId, cat.id)}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border bg-muted/20 px-5 py-2 text-center text-[11px] text-muted-foreground">
                mundial•pool · {groupName} · Mundial 2026
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
