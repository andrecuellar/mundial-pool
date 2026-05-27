import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { categories } from '../src/db/schema'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client, { schema: { categories } })

type SeedRow = typeof categories.$inferInsert

const CATEGORIES: SeedRow[] = [
  {
    key: 'champion',
    name: 'Selección campeona',
    description: 'Equipo que gana la final del Mundial 2026',
    valueKind: 'team',
    resolutionStrategy: 'final_winner',
    defaultPoints: 15,
  },
  {
    key: 'runner_up',
    name: 'Subcampeón',
    description: 'Equipo que pierde la final',
    valueKind: 'team',
    resolutionStrategy: 'final_loser',
    defaultPoints: 7,
  },
  {
    key: 'third_place',
    name: 'Tercer lugar',
    description: 'Ganador del partido por el tercer puesto',
    valueKind: 'team',
    resolutionStrategy: 'third_place',
    defaultPoints: 5,
  },
  {
    key: 'finalists',
    name: 'Finalistas',
    description: 'Los dos equipos que llegan a la final (all-or-nothing)',
    valueKind: 'team_set',
    resolutionStrategy: 'finalists',
    defaultPoints: 6,
  },
  {
    key: 'top_5',
    name: 'Top 5 selecciones',
    description: 'Cinco mejores selecciones por desempeño (puntos por cada acierto, sin orden)',
    valueKind: 'team_set',
    resolutionStrategy: 'top_n_teams',
    defaultPoints: 2,
    metadata: { n: 5, scoring: 'per_match' },
  },
  {
    key: 'revelation',
    name: 'Selección revelación',
    description:
      'Equipo que terminó mucho mejor de lo que su ranking FIFA pre-torneo predecía (mayor salto positivo)',
    valueKind: 'team',
    resolutionStrategy: 'revelation',
    defaultPoints: 8,
  },
  {
    key: 'disappointment',
    name: 'Selección decepción',
    description:
      'Equipo que terminó mucho peor de lo que su ranking FIFA pre-torneo predecía (mayor caída)',
    valueKind: 'team',
    resolutionStrategy: 'disappointment',
    defaultPoints: 8,
  },
  {
    key: 'top_scoring_team',
    name: 'Selección más goleadora',
    description: 'Equipo con más goles a favor en todo el torneo',
    valueKind: 'team',
    resolutionStrategy: 'top_scoring_team',
    defaultPoints: 5,
  },
  {
    key: 'most_conceded_team',
    name: 'Selección más goleada',
    description: 'Equipo con más goles en contra en todo el torneo',
    valueKind: 'team',
    resolutionStrategy: 'most_conceded_team',
    defaultPoints: 3,
  },
  {
    key: 'top_scorer_player',
    name: 'Bota de Oro',
    description: 'Goleador del torneo',
    valueKind: 'player',
    resolutionStrategy: 'top_scorer_player',
    defaultPoints: 10,
  },
  {
    key: 'top_assists_player',
    name: 'Máximo Asistente',
    description: 'Jugador con más asistencias en todo el torneo',
    valueKind: 'player',
    resolutionStrategy: 'top_assists_player',
    defaultPoints: 7,
  },
  {
    key: 'golden_ball',
    name: 'Balón de Oro',
    description: 'Mejor jugador del torneo (premio FIFA)',
    valueKind: 'player',
    resolutionStrategy: 'fifa_golden_ball',
    defaultPoints: 7,
  },
  {
    key: 'golden_glove',
    name: 'Guante de Oro',
    description: 'Mejor arquero del torneo (premio FIFA)',
    valueKind: 'player',
    resolutionStrategy: 'fifa_golden_glove',
    defaultPoints: 5,
  },
  {
    key: 'young_player',
    name: 'Mejor jugador joven',
    description: 'Mejor jugador sub-21 del torneo (premio FIFA)',
    valueKind: 'player',
    resolutionStrategy: 'fifa_young_player',
    defaultPoints: 5,
  },
]

async function main() {
  console.info(`Seeding ${CATEGORIES.length} categories...`)
  for (const row of CATEGORIES) {
    await db
      .insert(categories)
      .values(row)
      .onConflictDoUpdate({
        target: categories.key,
        set: {
          name: row.name,
          description: row.description,
          valueKind: row.valueKind,
          resolutionStrategy: row.resolutionStrategy,
          defaultPoints: row.defaultPoints ?? 1,
          metadata: row.metadata ?? null,
        },
      })
  }
  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM categories`,
  )
  console.info(`Done. Total categories in db: ${count}`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
