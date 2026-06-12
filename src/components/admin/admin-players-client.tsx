'use client'

import { Check, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AdminDataTable } from '@/components/admin/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  addPlayer,
  deletePlayer,
  updatePlayerAssists,
  updatePlayerGoals,
} from '@/features/admin/player-actions'

export type AdminPlayerRow = {
  id: string
  externalId: string | null
  fullName: string
  teamId: string | null
  goals: number
  assists: number
  lastSyncedAt: Date | null
  teamName: string | null
  teamFlag: string | null
}

export type AdminTeamRow = {
  id: string
  name: string
  flagEmoji: string | null
}

type Props = {
  players: AdminPlayerRow[]
  teams: AdminTeamRow[]
}

export function AdminPlayersClient({ players, teams }: Props) {
  return (
    <div className="space-y-6">
      <AddPlayerForm teams={teams} />
      <PlayersTable players={players} />
    </div>
  )
}

function AddPlayerForm({ teams }: { teams: AdminTeamRow[] }) {
  const [pending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [teamId, setTeamId] = useState<string>('')
  const [assists, setAssists] = useState<string>('1')
  const [goals, setGoals] = useState<string>('0')

  function handleSubmit() {
    if (!fullName.trim() || !teamId) {
      toast.error('Nombre y selección son obligatorios.')
      return
    }
    const a = Number.parseInt(assists, 10)
    const g = Number.parseInt(goals, 10)
    if (!Number.isFinite(a) || a < 0 || a > 99 || !Number.isFinite(g) || g < 0 || g > 99) {
      toast.error('Goles y asistencias deben ser entre 0 y 99.')
      return
    }
    startTransition(async () => {
      const r = await addPlayer({ fullName: fullName.trim(), teamId, assists: a, goals: g })
      if (r.ok) {
        toast.success(`${fullName.trim()} agregado`)
        setFullName('')
        setTeamId('')
        setAssists('1')
        setGoals('0')
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Agregar jugador
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Para jugadores que aún no aparecen porque no metieron gol (típicamente: asistentes).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="np-name" className="text-xs">
            Jugador
          </Label>
          <Input
            id="np-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: L. Messi"
            maxLength={120}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-team" className="text-xs">
            Selección
          </Label>
          <Select value={teamId} onValueChange={setTeamId} disabled={pending}>
            <SelectTrigger id="np-team">
              <SelectValue placeholder="Elegir…" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{t.flagEmoji ?? '🏳️'}</span>
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-goals" className="text-xs">
            Goles
          </Label>
          <Input
            id="np-goals"
            type="number"
            min={0}
            max={99}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-assists" className="text-xs">
            Asistencias
          </Label>
          <Input
            id="np-assists"
            type="number"
            min={0}
            max={99}
            value={assists}
            onChange={(e) => setAssists(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSubmit} disabled={pending} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {pending ? 'Agregando…' : 'Agregar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PlayersTable({ players }: { players: AdminPlayerRow[] }) {
  return (
    <AdminDataTable title={`${players.length} jugadores`} empty={players.length === 0}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jugador</TableHead>
            <TableHead className="hidden sm:table-cell">Selección</TableHead>
            <TableHead className="text-right">Goles</TableHead>
            <TableHead className="text-right">Asist.</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Origen</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => (
            <PlayerRowEditor key={p.id} player={p} />
          ))}
        </TableBody>
      </Table>
    </AdminDataTable>
  )
}

function PlayerRowEditor({ player }: { player: AdminPlayerRow }) {
  const [pending, startTransition] = useTransition()
  const [goals, setGoals] = useState(String(player.goals))
  const [assists, setAssists] = useState(String(player.assists))
  const isAdminCreated = player.externalId?.startsWith('admin-') ?? false

  function saveAssists() {
    const a = Number.parseInt(assists, 10)
    if (!Number.isFinite(a) || a < 0 || a > 99) {
      toast.error('Asistencias entre 0 y 99.')
      return
    }
    if (a === player.assists) return
    startTransition(async () => {
      const r = await updatePlayerAssists({ playerId: player.id, assists: a })
      if (r.ok) toast.success(`${player.fullName}: ${a} asistencias`)
      else toast.error(r.error)
    })
  }

  function saveGoals() {
    const g = Number.parseInt(goals, 10)
    if (!Number.isFinite(g) || g < 0 || g > 99) {
      toast.error('Goles entre 0 y 99.')
      return
    }
    if (g === player.goals) return
    startTransition(async () => {
      const r = await updatePlayerGoals({ playerId: player.id, goals: g })
      if (r.ok) toast.success(`${player.fullName}: ${g} goles`)
      else toast.error(r.error)
    })
  }

  function handleDelete() {
    if (!confirm(`¿Borrar a ${player.fullName}?`)) return
    startTransition(async () => {
      const r = await deletePlayer({ playerId: player.id })
      if (r.ok) toast.success(`${player.fullName} borrado`)
      else toast.error(r.error)
    })
  }

  const goalsDirty = String(player.goals) !== goals
  const assistsDirty = String(player.assists) !== assists

  return (
    <TableRow>
      <TableCell className="font-medium">{player.fullName}</TableCell>
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-base leading-none">{player.teamFlag ?? '🏳️'}</span>
          {player.teamName ?? '—'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={99}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            disabled={pending}
            className="h-8 w-16 text-right tabular-nums"
          />
          {goalsDirty && (
            <Button
              size="icon"
              variant="ghost"
              onClick={saveGoals}
              disabled={pending}
              aria-label="Guardar goles"
              className="h-8 w-8"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={99}
            value={assists}
            onChange={(e) => setAssists(e.target.value)}
            disabled={pending}
            className="h-8 w-16 text-right tabular-nums"
          />
          {assistsDirty && (
            <Button
              size="icon"
              variant="ghost"
              onClick={saveAssists}
              disabled={pending}
              aria-label="Guardar asistencias"
              className="h-8 w-8"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-right text-[11px] text-muted-foreground">
        {isAdminCreated ? 'manual' : 'cron'}
      </TableCell>
      <TableCell className="text-right">
        {isAdminCreated && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={pending}
            aria-label="Borrar jugador"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
