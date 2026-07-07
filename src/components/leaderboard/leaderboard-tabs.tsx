'use client'

import { useState } from 'react'
import { ShareComprobanteButton } from '@/components/predictions/share-comprobante-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { RankedLeaderboardRow } from '@/features/scoring/queries'
import { formatDayShort } from '@/lib/format'
import { CategoryBreakdownTable } from './category-breakdown-table'
import type { PaidAt } from './ranking-table'
import { RankingTable } from './ranking-table'
import { ShareLeaderboardStoryCard } from './share-leaderboard-story-card'

type Category = { id: string; name: string; key: string; points: number }

type Props = {
  leaderboard: RankedLeaderboardRow[]
  categories: Category[]
  /** Categorías con resultado oficial — sus celdas ya son definitivas. */
  resolvedCategoryIds: string[]
  /** userId → categorías sin resolver cuyo pick ya no puede sumar (0 asegurado). */
  lostByUser: Record<string, string[]>
  currentUserId: string
  poolEnabled: boolean
  paidAt: PaidAt[]
  lockAt: string
  groupSlug: string
  groupName: string
  isAdmin: boolean
}

export function LeaderboardTabs({
  leaderboard,
  categories,
  resolvedCategoryIds,
  lostByUser,
  currentUserId,
  poolEnabled,
  paidAt,
  lockAt,
  groupSlug,
  groupName,
  isAdmin,
}: Props) {
  const [tab, setTab] = useState('ranking')
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="ranking">Ranking general</TabsTrigger>
        <TabsTrigger value="breakdown">Detalle por categoría</TabsTrigger>
      </TabsList>
      <TabsContent value="ranking">
        {/* Wrapper capturable por html-to-image. El header con el branding +
            nombre del grupo + fecha quedan dentro de la imagen compartida
            para que tenga contexto fuera del sitio. */}
        <div
          id="leaderboard-card"
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              mundial-pool · Tabla de líderes
            </p>
            <p className="mt-0.5 text-sm font-semibold tracking-tight">
              {groupName} · {formatDayShort(new Date())}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <RankingTable
              rows={leaderboard}
              currentUserId={currentUserId}
              poolEnabled={poolEnabled}
              paidAt={paidAt}
              lockAt={lockAt}
              groupSlug={groupSlug}
              isAdmin={isAdmin}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ShareComprobanteButton
            targetId="leaderboard-card"
            fileName={`mundial-pool-tabla-${groupSlug}`}
            shareTitle={`Tabla · ${groupName}`}
            shareText={`Ranking actual del pool ${groupName} en mundial-pool 🏆`}
            label="Compartir tabla"
          />
          <ShareComprobanteButton
            targetId="leaderboard-story-card"
            fileName={`mundial-pool-story-${groupSlug}`}
            shareTitle={`Tabla · ${groupName}`}
            shareText={`Así va el pool ${groupName} en mundial-pool 🏆 — aciertos, fallos y selecciones eliminadas de cada uno.`}
            label="Compartir para historias"
            autoShare={false}
          />
        </div>
        <ShareLeaderboardStoryCard
          id="leaderboard-story-card"
          groupName={groupName}
          rows={leaderboard}
          currentUserId={currentUserId}
          dateLabel={formatDayShort(new Date())}
        />
      </TabsContent>
      <TabsContent value="breakdown">
        <CategoryBreakdownTable
          rows={leaderboard}
          categories={categories}
          resolvedCategoryIds={resolvedCategoryIds}
          lostByUser={lostByUser}
          currentUserId={currentUserId}
        />
      </TabsContent>
    </Tabs>
  )
}
