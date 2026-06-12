'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { players, teams } from '@/db/schema'
import { requireSuperAdmin } from '@/lib/admin'

export type AdminPlayerActionResult = { ok: true } | { ok: false; error: string }

const updateAssistsSchema = z.object({
  playerId: z.uuid(),
  assists: z.number().int().min(0).max(99),
})

export async function updatePlayerAssists(input: unknown): Promise<AdminPlayerActionResult> {
  await requireSuperAdmin()
  const parsed = updateAssistsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  const updated = await db
    .update(players)
    .set({ assists: parsed.data.assists, lastSyncedAt: new Date() })
    .where(eq(players.id, parsed.data.playerId))
    .returning({ id: players.id })

  if (updated.length === 0) return { ok: false, error: 'Jugador no encontrado.' }

  revalidateTag('players', 'hours')
  revalidatePath('/admin/jugadores')
  revalidatePath('/torneo/jugadores')
  return { ok: true }
}

const addPlayerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  teamId: z.uuid(),
  assists: z.number().int().min(0).max(99).default(0),
  goals: z.number().int().min(0).max(99).default(0),
})

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function addPlayer(input: unknown): Promise<AdminPlayerActionResult> {
  await requireSuperAdmin()
  const parsed = addPlayerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, parsed.data.teamId),
    columns: { id: true, name: true, fifaCode: true },
  })
  if (!team) return { ok: false, error: 'Selección no encontrada.' }

  const nameSlug = slugify(parsed.data.fullName)
  const teamSlug = slugify(team.fifaCode ?? team.name)
  // Prefijo "admin-" para distinguir de jugadores agregados por el cron de
  // worldcup26.ir (prefijo "wc26ir-"). Si ya existe ese externalId (admin
  // editó dos veces a la misma persona), bumpeamos con sufijo numérico.
  let externalId = `admin-${nameSlug}-${teamSlug}`
  const existing = await db.query.players.findFirst({
    where: eq(players.externalId, externalId),
    columns: { id: true },
  })
  if (existing) {
    externalId = `admin-${nameSlug}-${teamSlug}-${Date.now()}`
  }

  await db.insert(players).values({
    externalId,
    fullName: parsed.data.fullName,
    teamId: team.id,
    goals: parsed.data.goals,
    assists: parsed.data.assists,
    minutesPlayed: 0,
    lastSyncedAt: new Date(),
  })

  revalidateTag('players', 'hours')
  revalidatePath('/admin/jugadores')
  revalidatePath('/torneo/jugadores')
  return { ok: true }
}

const updateGoalsSchema = z.object({
  playerId: z.uuid(),
  goals: z.number().int().min(0).max(99),
})

export async function updatePlayerGoals(input: unknown): Promise<AdminPlayerActionResult> {
  await requireSuperAdmin()
  const parsed = updateGoalsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  const updated = await db
    .update(players)
    .set({ goals: parsed.data.goals, lastSyncedAt: new Date() })
    .where(eq(players.id, parsed.data.playerId))
    .returning({ id: players.id })

  if (updated.length === 0) return { ok: false, error: 'Jugador no encontrado.' }

  revalidateTag('players', 'hours')
  revalidatePath('/admin/jugadores')
  revalidatePath('/torneo/jugadores')
  return { ok: true }
}

const deletePlayerSchema = z.object({ playerId: z.uuid() })

export async function deletePlayer(input: unknown): Promise<AdminPlayerActionResult> {
  await requireSuperAdmin()
  const parsed = deletePlayerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  // Solo permitir borrar jugadores agregados manualmente. Los del cron
  // (prefijo "wc26ir-") no se deben borrar — el próximo sync los re-crea.
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, parsed.data.playerId)),
    columns: { id: true, externalId: true },
  })
  if (!player) return { ok: false, error: 'Jugador no encontrado.' }
  if (player.externalId && !player.externalId.startsWith('admin-')) {
    return { ok: false, error: 'Solo se pueden borrar jugadores agregados manualmente.' }
  }

  await db.delete(players).where(eq(players.id, parsed.data.playerId))

  revalidateTag('players', 'hours')
  revalidatePath('/admin/jugadores')
  revalidatePath('/torneo/jugadores')
  return { ok: true }
}
