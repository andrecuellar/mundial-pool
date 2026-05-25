import { sql } from 'drizzle-orm'
import { db } from '@/db'

export type LeaderboardRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  totalPoints: number
  breakdown: Record<string, number>
}

export async function getLeaderboard(groupId: string): Promise<LeaderboardRow[]> {
  const rows = await db.execute<{
    user_id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    breakdown: Record<string, number>
  }>(sql`
    SELECT
      p.id AS user_id,
      p.display_name,
      p.avatar_url,
      COALESCE(v.total_points, 0)::int AS total_points,
      COALESCE(v.breakdown, '{}'::jsonb) AS breakdown
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    LEFT JOIN v_user_scores v ON v.group_id = gm.group_id AND v.user_id = gm.user_id
    WHERE gm.group_id = ${groupId}::uuid
    ORDER BY total_points DESC, p.display_name ASC
  `)
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    totalPoints: r.total_points,
    breakdown: r.breakdown,
  }))
}
