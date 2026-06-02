import { AdminDataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  listAdminCategories,
  listAdminPlayers,
  listAdminResults,
  listAdminTeams,
} from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminDataPage() {
  const [cats, teams, players, results] = await Promise.all([
    listAdminCategories(),
    listAdminTeams(),
    listAdminPlayers(),
    listAdminResults(),
  ])

  const internalRanks = new Map<string, number>()
  teams
    .filter((t) => typeof t.fifaRanking === 'number')
    .forEach((t, i) => internalRanks.set(t.id, i + 1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Datos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogos seeded del sistema: categorías, equipos, jugadores y resultados ya resueltos.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorías ({cats.length})</TabsTrigger>
          <TabsTrigger value="teams">Equipos ({teams.length})</TabsTrigger>
          <TabsTrigger value="players">Jugadores ({players.length})</TabsTrigger>
          <TabsTrigger value="results">Resultados ({results.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <AdminDataTable empty={cats.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Llave</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estrategia</TableHead>
                  <TableHead className="text-right">Pts por defecto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="font-mono text-xs">{c.key}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.valueKind}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.resolutionStrategy}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {c.defaultPoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="teams">
          <AdminDataTable empty={teams.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">M</TableHead>
                  <TableHead className="text-right">FIFA</TableHead>
                  <TableHead>Selección</TableHead>
                  <TableHead>Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-right font-mono tabular-nums">
                      {internalRanks.get(t.id) ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      #{t.fifaRanking ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
                        <span className="font-medium">{t.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.fifaCode ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="players">
          <AdminDataTable
            empty={players.length === 0}
            description="1204 jugadores seeded desde Wikipedia. Esta tabla muestra los primeros 500."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Selección</TableHead>
                  <TableHead className="hidden sm:table-cell">Pos</TableHead>
                  <TableHead className="hidden text-right md:table-cell">DoB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.slice(0, 500).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.fullName}</TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
                        {p.teamName ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-[10px]">
                        {p.position ?? '?'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs text-muted-foreground md:table-cell">
                      {p.dateOfBirth ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="results">
          <AdminDataTable
            empty={results.length === 0}
            emptyText="Aún no se han registrado resultados oficiales."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">Resuelto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.categoryKey}>
                    <TableCell className="font-medium">{r.categoryName}</TableCell>
                    <TableCell className="text-sm">
                      {r.teamName ??
                        r.playerText ??
                        (Array.isArray(r.teamSet) && r.teamSet.length > 0
                          ? `${r.teamSet.length} equipos`
                          : '—')}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.source}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatDayTime(r.resolvedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </TabsContent>
      </Tabs>
    </div>
  )
}
