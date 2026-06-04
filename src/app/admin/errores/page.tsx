import { and, desc, eq, gte, sql } from 'drizzle-orm'
import Link from 'next/link'
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
import { db } from '@/db'
import { clientErrors, profiles } from '@/db/schema'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Errores',
  description: 'Errores capturados en el navegador de los usuarios.',
}

type SearchParams = {
  view?: string
  since?: string
  level?: string
}

const SINCE_OPTIONS = [
  { key: '1h', label: 'Última hora', ms: 60 * 60 * 1000 },
  { key: '24h', label: 'Últimas 24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: 'Últimos 7 días', ms: 7 * 24 * 60 * 60 * 1000 },
] as const

const LEVELS = ['error', 'warn', 'uncaught', 'unhandledrejection'] as const

function formatRelative(when: Date): string {
  const diffMs = Date.now() - when.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'hace menos de 1 min'
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} ${hr === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hr / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

function LevelBadge({ level }: { level: string }) {
  if (level === 'error' || level === 'uncaught' || level === 'unhandledrejection') {
    return (
      <Badge variant="secondary" className="border-destructive/30 bg-destructive/10 text-destructive">
        {level}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="border-warning/30 bg-warning/10 text-warning">
      {level}
    </Badge>
  )
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { view, since, level } = await searchParams
  const sinceOpt = SINCE_OPTIONS.find((o) => o.key === since) ?? SINCE_OPTIONS[0]
  const levelFilter = LEVELS.includes(level as (typeof LEVELS)[number])
    ? (level as (typeof LEVELS)[number])
    : null
  const isRawView = view === 'raw'
  const sinceDate = new Date(Date.now() - sinceOpt.ms)

  const baseWhere = and(
    gte(clientErrors.createdAt, sinceDate),
    levelFilter ? eq(clientErrors.level, levelFilter) : undefined,
  )

  if (isRawView) {
    const rows = await db
      .select({
        id: clientErrors.id,
        level: clientErrors.level,
        message: clientErrors.message,
        stack: clientErrors.stack,
        url: clientErrors.url,
        userAgent: clientErrors.userAgent,
        createdAt: clientErrors.createdAt,
        userId: clientErrors.userId,
        displayName: profiles.displayName,
        email: profiles.email,
      })
      .from(clientErrors)
      .leftJoin(profiles, eq(profiles.id, clientErrors.userId))
      .where(baseWhere)
      .orderBy(desc(clientErrors.createdAt))
      .limit(100)

    return (
      <div className="space-y-6">
        <Header sinceKey={sinceOpt.key} levelFilter={levelFilter} view="raw" />
        <AdminDataTable
          title={`Eventos crudos · últimos ${rows.length}`}
          empty={rows.length === 0}
          emptyText="No hay errores en este rango. ¡Bien!"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Cuándo</TableHead>
                <TableHead className="w-[110px]">Nivel</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead className="hidden lg:table-cell">Usuario</TableHead>
                <TableHead className="hidden xl:table-cell">URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelative(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <LevelBadge level={r.level} />
                  </TableCell>
                  <TableCell className="max-w-[40rem]">
                    <details className="group">
                      <summary className="cursor-pointer font-mono text-xs leading-relaxed">
                        {r.message}
                      </summary>
                      {r.stack && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/50 p-2 text-[11px] text-muted-foreground">
                          {r.stack}
                        </pre>
                      )}
                      {r.userAgent && (
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          UA: {r.userAgent}
                        </p>
                      )}
                    </details>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">
                    {r.userId ? (
                      <Link
                        href={`/admin/usuarios/${r.userId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {r.displayName ?? '—'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">(anónimo)</span>
                    )}
                    {r.email && <p className="text-[10px] text-muted-foreground">{r.email}</p>}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell max-w-[20rem] truncate text-[11px] text-muted-foreground">
                    {r.url ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </div>
    )
  }

  // Default view: grouped by fingerprint.
  const grouped = await db
    .select({
      fingerprint: clientErrors.fingerprint,
      level: sql<string>`MAX(${clientErrors.level})`,
      message: sql<string>`MAX(${clientErrors.message})`,
      count: sql<number>`COUNT(*)::int`,
      lastSeen: sql<Date>`MAX(${clientErrors.createdAt})`,
      usersAffected: sql<number>`COUNT(DISTINCT ${clientErrors.userId})::int`,
    })
    .from(clientErrors)
    .where(baseWhere)
    .groupBy(clientErrors.fingerprint)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(50)

  return (
    <div className="space-y-6">
      <Header sinceKey={sinceOpt.key} levelFilter={levelFilter} view="grouped" />
      <AdminDataTable
        title={`Agrupados por error · ${grouped.length} distintos`}
        description="Cuenta ocurrencias del mismo error (mismo mensaje + primera línea del stack). Toca un mensaje para ver el detalle."
        empty={grouped.length === 0}
        emptyText="No hay errores en este rango. ¡Bien!"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mensaje</TableHead>
              <TableHead className="w-[110px]">Nivel</TableHead>
              <TableHead className="w-[80px] text-right">Veces</TableHead>
              <TableHead className="hidden md:table-cell w-[110px] text-right">Usuarios</TableHead>
              <TableHead className="hidden sm:table-cell w-[130px] text-right">Último</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((g) => (
              <TableRow key={g.fingerprint}>
                <TableCell className="max-w-[36rem]">
                  <p className="font-mono text-xs leading-relaxed line-clamp-2">{g.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    fp: {g.fingerprint.slice(0, 12)}
                  </p>
                </TableCell>
                <TableCell>
                  <LevelBadge level={g.level} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">
                  {g.count}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right font-mono tabular-nums text-sm">
                  {g.usersAffected}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                  {formatRelative(new Date(g.lastSeen))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}

function Header({
  sinceKey,
  levelFilter,
  view,
}: {
  sinceKey: string
  levelFilter: string | null
  view: 'grouped' | 'raw'
}) {
  const baseParams = new URLSearchParams()
  if (sinceKey !== '1h') baseParams.set('since', sinceKey)
  if (levelFilter) baseParams.set('level', levelFilter)

  function link(overrides: Record<string, string | null>): string {
    const p = new URLSearchParams(baseParams)
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const qs = p.toString()
    return qs ? `/admin/errores?${qs}` : '/admin/errores'
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Errores del cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capturados desde el navegador de los usuarios: console.error, console.warn, excepciones
          no atrapadas y promises rechazadas. El servidor además tiene Sentry con sourcemaps si
          necesitas más detalle.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">Rango:</span>
        {SINCE_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={link({ since: o.key === '1h' ? null : o.key })}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              o.key === sinceKey
                ? 'border-foreground/30 bg-muted text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {o.label}
          </Link>
        ))}

        <span className="ml-3 font-medium text-muted-foreground">Nivel:</span>
        <Link
          href={link({ level: null })}
          className={`rounded-md border px-2.5 py-1 transition-colors ${
            !levelFilter
              ? 'border-foreground/30 bg-muted text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Todos
        </Link>
        {LEVELS.map((l) => (
          <Link
            key={l}
            href={link({ level: l })}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              l === levelFilter
                ? 'border-foreground/30 bg-muted text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {l}
          </Link>
        ))}

        <span className="ml-3 font-medium text-muted-foreground">Vista:</span>
        <Link
          href={link({ view: null })}
          className={`rounded-md border px-2.5 py-1 transition-colors ${
            view === 'grouped'
              ? 'border-foreground/30 bg-muted text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Agrupada
        </Link>
        <Link
          href={link({ view: 'raw' })}
          className={`rounded-md border px-2.5 py-1 transition-colors ${
            view === 'raw'
              ? 'border-foreground/30 bg-muted text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Cruda
        </Link>
      </div>
    </div>
  )
}
