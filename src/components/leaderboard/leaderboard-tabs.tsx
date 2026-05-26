'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LeaderboardRow } from '@/features/scoring/queries'
import { CategoryBreakdownTable } from './category-breakdown-table'
import { RankingTable } from './ranking-table'

type Category = { id: string; name: string; key: string; points: number }

type Props = {
  leaderboard: LeaderboardRow[]
  categories: Category[]
  currentUserId: string
}

export function LeaderboardTabs({ leaderboard, categories, currentUserId }: Props) {
  const [tab, setTab] = useState('ranking')
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="ranking">Ranking general</TabsTrigger>
        <TabsTrigger value="breakdown">Detalle por categoría</TabsTrigger>
      </TabsList>
      <TabsContent value="ranking">
        <RankingTable rows={leaderboard} currentUserId={currentUserId} />
      </TabsContent>
      <TabsContent value="breakdown">
        <CategoryBreakdownTable
          rows={leaderboard}
          categories={categories}
          currentUserId={currentUserId}
        />
      </TabsContent>
    </Tabs>
  )
}
