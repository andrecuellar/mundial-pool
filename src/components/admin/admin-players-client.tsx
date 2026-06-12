'use client'

import { Check, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
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

const PAGE_SIZE = 25
const ALL_TEAMS = '__all__'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

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
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return players.filter((p) => {
      if (teamFilter !== ALL_TEAMS && p.teamId !== teamFilter) return false
      if (q && !normalize(p.fullName).includes(q)) return false
      return true
    })
  }, [players, search, teamFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  function resetPageAnd<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      <AddPlayerForm teams={teams} />
      <FiltersBar
        teams={teams}
        search={search}
        onSearchChange={resetPageAnd(setSearch)}
        teamFilter={teamFilter}
        onTeamFilterChange={resetPageAnd(setTeamFilter)}
        filteredCount={filtered.length}
        totalCount={players.length}
      />
      <PlayersTable players={pageRows} />
      {filtered.length > PAGE_SIZE && (
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}

function FiltersBar({
  teams,
  search,
  onSearchChange,
  teamFilter,
  onTeamFilterChange,
  filteredCount,
  totalCount,
}: {
  teams: AdminTeamRow[]
  search: string
  onSearchChange: (v: string) => void
  teamFilter: string
  onTeamFilterChange: (v: string) => void
  filteredCount: number
  totalCount: number
}) {
  const isFiltered = filteredCount !== totalCount
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="players-search" className="text-xs">
          Buscar
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="players-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nombre del jugador"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="w-full space-y-1.5 sm:w-64">
        <Label htmlFor="players-team-filter" className="text-xs">
          Selección
        </Label>
        <Select value={teamFilter} onValueChange={onTeamFilterChange}>
          <SelectTrigger id="players-team-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TEAMS}>Todas las selecciones</SelectItem>
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
      <div className="sm:pb-2 text-xs text-muted-foreground tabular-nums">
        {isFiltered ? `${filteredCount} de ${totalCount}` : `${totalCount} jugadores`}
      </div>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        Página <span className="font-medium text-foreground">{page}</span> de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </Button>
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
        Para jugadores que ESPN no detecta. El cron diario es la fuente principal; esto es para
        casos excepcionales.
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
    <AdminDataTable empty={players.length === 0} emptyText="Sin resultados.">
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
