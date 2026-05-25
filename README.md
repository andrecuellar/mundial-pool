# mundial-pool

Quiniela del Mundial 2026 enfocada en **premios y resultados globales** del torneo, no en predicciones partido-por-partido. Multi-tenant: cualquier persona puede crear su grupo, invitar amigos y armar su propia liga.

## Objetivo

Las quinielas tradicionales obligan a predecir 100+ partidos del Mundial 2026 (formato de 48 equipos). La mayoría son partidos de baja convocatoria — predecir "Congo vs Uzbekistán" no es divertido.

Esta app reemplaza eso por **un set fijo de predicciones de torneo completo** que los jugadores llenan una sola vez antes del partido inaugural:

- Selección campeona
- Subcampeón
- Tercer lugar
- Finalistas (set de 2)
- Top 5 selecciones
- Selección revelación
- Selección decepción
- Selección más goleadora
- Selección más goleada
- Goleador del torneo (bota de oro)
- Mejor jugador (balón de oro)
- Mejor arquero (guante de oro)
- Mejor jugador joven

Cada grupo elige qué categorías habilita y cuántos puntos vale cada una.

## Principios de diseño

1. **Resultados automáticos.** Una vez termine cada fase del torneo, el sistema consulta una API de fútbol y actualiza los resultados sin intervención manual.
2. **Multi-tenant desde el inicio.** Cualquier persona crea un grupo con código de invitación. Los grupos están aislados entre sí.
3. **Criterios objetivos.** Categorías subjetivas como "revelación" y "decepción" se resuelven con reglas explícitas basadas en odds pre-torneo + ronda alcanzada (publicadas antes del torneo).
4. **Free tier first.** El stack completo cabe en planes gratuitos de Vercel + Supabase para decenas de grupos.

### Criterios para revelación / decepción

Se asigna a cada equipo una **ronda esperada** basada en odds de campeonato pre-torneo:

| Odds pre-torneo | Ronda esperada |
| --- | --- |
| Top 5 favoritos | Semifinales |
| Top 6–12 | Cuartos |
| Top 13–20 | Octavos |
| Resto | Fase de grupos |

- **Revelación**: equipo con mayor brecha positiva (ronda alcanzada > ronda esperada).
- **Decepción**: equipo con mayor brecha negativa.
- **Desempates**: diferencia de gol del torneo → ranking FIFA al inicio.

## Stack

- **Next.js 16** (App Router) + **TypeScript** estricto
- **Supabase** (Postgres + Auth con magic link)
- **Drizzle ORM** + **drizzle-kit** (schema type-safe, migraciones SQL)
- **Tailwind v4** (UI por hacer)
- **Zod** validaciones, **Biome** lint/format, **pnpm**
- **Vercel** deploy (Cron Jobs para resolución automática)

## Modelo de datos (resumen)

- `profiles` — perfil del usuario (1:1 con `auth.users` de Supabase)
- `groups` — cada quiniela tiene nombre, slug, código de invitación, fecha de bloqueo
- `group_members` — pertenencia usuario-grupo con rol (owner/admin/member)
- `teams` — selecciones del Mundial (con odds y ronda esperada)
- `players` — jugadores (para categorías de tipo jugador)
- `categories` — catálogo global de tipos de predicción + estrategia de resolución
- `group_categories` — qué categorías habilita cada grupo y cuántos puntos da
- `predictions` — predicción de un usuario en un grupo (única por user+grupo+categoría)
- `results` — resultado real por categoría (global, llenado por el job de resolución)
- `resolution_runs` — auditoría de cada ejecución del job de resolución

## Resolución automática de resultados

`src/integrations/football/` define una interfaz `FootballProvider` con un único método `fetchTournamentSnapshot()` que devuelve un snapshot tipado del estado del torneo. Los adapters concretos (api-football, football-data, mock) implementan esa interfaz.

`src/server/resolution.ts` toma el snapshot y, según el `resolution_strategy` declarado en cada categoría, calcula el ganador y lo escribe en `results`. La idea es que un endpoint protegido (`/api/cron/resolve`) sea invocado por **Vercel Cron** después de cada fase del torneo.

Estrategias de resolución implementadas: campeón, subcampeón, tercero, finalistas, goleador del torneo, selección más goleadora, selección más goleada, balón de oro, guante de oro, mejor joven.

Por implementar: revelación, decepción, top-N equipos (necesitan datos pre-torneo seeded en la tabla `teams`).

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Llenar DATABASE_URL y claves de Supabase
pnpm db:push           # crea las tablas en Supabase
pnpm dev
```

## Roadmap

- [x] Schema + integraciones base
- [ ] Migraciones iniciales y seed de categorías + selecciones del Mundial 2026
- [ ] Auth con magic link
- [ ] CRUD de grupos + invitación por código
- [ ] Formulario de predicciones (bloqueable por fecha)
- [ ] Leaderboard con cálculo de puntaje server-side
- [ ] Adapter real de API de fútbol + endpoint cron
- [ ] Vista admin para overrides manuales
- [ ] Diseño UI (Tailwind + shadcn/ui)
