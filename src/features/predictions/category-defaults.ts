// Single source of truth for the 14 prediction categories and their
// suggested point values. Mirrors the seed in scripts/seed-categories.ts —
// the seed remains the canonical DB seed for first install, this constant
// is what the create-group form shows as placeholders and what the server
// action validates against when applying per-group overrides.

export type CategoryKey =
  | 'champion'
  | 'runner_up'
  | 'third_place'
  | 'finalists'
  | 'top_5'
  | 'revelation'
  | 'disappointment'
  | 'top_scoring_team'
  | 'most_conceded_team'
  | 'top_scorer_player'
  | 'top_assists_player'
  | 'golden_ball'
  | 'golden_glove'
  | 'young_player'

export type CategoryUnit = 'flat' | 'per_team'

export type CategoryDefault = {
  key: CategoryKey
  name: string
  group: 'podium' | 'team' | 'player'
  /** flat = puntos fijos por acertar. per_team = puntos por cada item acertado dentro del set. */
  unit: CategoryUnit
  /** Sugerencia inicial. El owner puede overridear al crear el grupo. */
  defaultPoints: number
  /** Texto corto para mostrar al lado del input. */
  hint?: string
}

export const CATEGORY_DEFAULTS: readonly CategoryDefault[] = [
  // Podio + brackets de eliminación directa
  { key: 'champion', name: 'Selección campeona', group: 'podium', unit: 'flat', defaultPoints: 15 },
  { key: 'runner_up', name: 'Subcampeón', group: 'podium', unit: 'flat', defaultPoints: 7 },
  { key: 'third_place', name: 'Tercer lugar', group: 'podium', unit: 'flat', defaultPoints: 5 },
  {
    key: 'finalists',
    name: 'Finalistas',
    group: 'podium',
    unit: 'per_team',
    defaultPoints: 6,
    hint: 'por cada finalista acertado',
  },
  {
    key: 'top_5',
    name: 'Top 5 selecciones',
    group: 'podium',
    unit: 'per_team',
    defaultPoints: 2,
    hint: 'por cada selección del top 5 acertada',
  },
  // Distinciones de equipo
  {
    key: 'revelation',
    name: 'Selección revelación',
    group: 'team',
    unit: 'flat',
    defaultPoints: 8,
  },
  {
    key: 'disappointment',
    name: 'Selección decepción',
    group: 'team',
    unit: 'flat',
    defaultPoints: 8,
  },
  {
    key: 'top_scoring_team',
    name: 'Selección más goleadora',
    group: 'team',
    unit: 'flat',
    defaultPoints: 5,
  },
  {
    key: 'most_conceded_team',
    name: 'Selección más goleada',
    group: 'team',
    unit: 'flat',
    defaultPoints: 3,
  },
  // Jugadores
  {
    key: 'top_scorer_player',
    name: 'Bota de Oro (goleador)',
    group: 'player',
    unit: 'flat',
    defaultPoints: 10,
  },
  {
    key: 'top_assists_player',
    name: 'Máximo Asistente',
    group: 'player',
    unit: 'flat',
    defaultPoints: 7,
  },
  { key: 'golden_ball', name: 'Balón de Oro', group: 'player', unit: 'flat', defaultPoints: 7 },
  { key: 'golden_glove', name: 'Guante de Oro', group: 'player', unit: 'flat', defaultPoints: 5 },
  {
    key: 'young_player',
    name: 'Mejor jugador joven',
    group: 'player',
    unit: 'flat',
    defaultPoints: 5,
  },
] as const

export const CATEGORY_KEYS: ReadonlySet<CategoryKey> = new Set(CATEGORY_DEFAULTS.map((c) => c.key))

export function defaultPointsRecord(): Record<CategoryKey, number> {
  const out = {} as Record<CategoryKey, number>
  for (const c of CATEGORY_DEFAULTS) out[c.key] = c.defaultPoints
  return out
}

export const CATEGORY_GROUPS: { id: 'podium' | 'team' | 'player'; label: string }[] = [
  { id: 'podium', label: 'Podio y eliminación directa' },
  { id: 'team', label: 'Distinciones de equipo' },
  { id: 'player', label: 'Jugadores destacados' },
]
