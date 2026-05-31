# mundial-pool

Pool del Mundial 2026 enfocado en **premios y resultados globales** del torneo, no en predicciones partido-por-partido. Multi-tenant: cualquier persona crea su grupo, invita amigos con un código de 6 caracteres y arma su propia liga.

Producción: [`mundial-pool.vercel.app`](https://mundial-pool.vercel.app).

## Por qué

Los pools tradicionales obligan a predecir 100+ partidos del Mundial 2026 (formato de 48 equipos). La mayoría son partidos de baja convocatoria — predecir "Congo vs Uzbekistán" no es divertido.

Esta app reemplaza eso por **14 predicciones fijas de torneo completo** que se llenan una sola vez antes del partido inaugural. Después de la fecha de cierre del grupo, todo es solo lectura y los puntos se calculan automáticamente.

### Las 14 categorías

| # | Categoría | Tipo | Default points |
|---|---|---|---|
| 01 | Selección campeona | Equipo | 15 |
| 02 | Subcampeón | Equipo | 7 |
| 03 | Tercer lugar | Equipo | 5 |
| 04 | Finalistas (set de 2) | Equipos · auto | 6 |
| 05 | Top 5 selecciones | Equipos · auto + manual | 2 / acierto |
| 06 | Selección revelación | Equipo | 8 |
| 07 | Selección decepción | Equipo | 8 |
| 08 | Selección más goleadora | Equipo | 5 |
| 09 | Selección más goleada | Equipo | 3 |
| 10 | Bota de Oro (goleador) | Jugador | 10 |
| 11 | Máximo Asistente | Jugador | 7 |
| 12 | Balón de Oro | Jugador | 7 |
| 13 | Guante de Oro | Jugador | 5 |
| 14 | Mejor jugador joven | Jugador | 5 |

Cada grupo puede ajustar puntos por categoría desde el admin del owner.

## Principios de diseño

1. **Resultados automáticos donde se pueda.** El cron diario consulta a la API de fútbol y rellena las categorías derivables (campeón, subcampeón, etc.). Premios subjetivos (Balón de Oro, Guante de Oro, Mejor Joven) y datos de asistencias se resuelven manualmente con fuente FIFA declarada en la UI.
2. **Multi-tenant.** Cualquiera crea un grupo. Aislamiento total entre grupos. Un usuario puede pertenecer a varios.
3. **Criterios objetivos y explicados.** Cada categoría con criterio no-trivial tiene un info icon (i) con tooltip + modal que muestra exactamente cómo se decide.
4. **Free tier first.** El stack completo cabe en Vercel Hobby + Supabase Free para decenas de grupos.

## Stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts` en lugar de `middleware.ts`)
- **React 19.2** Server Components + client islands
- **Tailwind v4** con `@theme inline` y tokens en **OK-LCh** (preserva luminancia perceptual entre dark / light)
- **shadcn/ui** (preset Nova) + Radix primitives
- **Supabase**: Postgres, Auth (Google OAuth + magic link), Storage para los QR del pozo
- **Drizzle ORM** + **drizzle-kit** (migraciones SQL versionadas)
- **postgres-js** vía Supabase transaction pooler (`max: 5`, `prepare: false`)
- **Zod** validaciones, **Biome** lint/format, **pnpm**, **TypeScript** estricto
- **Vercel** deploy con auto-deploy en cada push a `main`. Cron Job diario para resolución.
- **next-themes** para el toggle dark / light / system

## Modelo de datos (resumen)

- `profiles` — perfil del usuario (1:1 con `auth.users` de Supabase)
- `groups` — cada pool tiene nombre, slug, código de invitación, fecha de bloqueo, currency del pozo, payout rule
- `group_members` — pertenencia usuario-grupo con rol (owner / admin / member)
- `teams` — 48 selecciones del Mundial, con ranking FIFA, código FIFA, bandera, expected round
- `players` — jugadores (~1200 sembrados desde Wikipedia para el autocomplete)
- `categories` — catálogo global de tipos de predicción + estrategia de resolución
- `group_categories` — qué categorías habilita cada grupo y cuántos puntos da
- `predictions` — predicción de un usuario en un grupo (única por user + grupo + categoría)
- `results` — resultado real por categoría (global, llenado por el cron o manual)
- `resolution_runs` — auditoría de cada ejecución del cron de resolución
- `pool_transactions` — ledger del pozo opcional
- `app_state` — key/value global. Primer caso de uso: deadline del rate-limit del magic link

Plus una vista SQL `v_user_scores` que recalcula puntos por usuario por grupo (alimenta el leaderboard).

## Resolución automática

`src/integrations/football/` define una interfaz `FootballProvider` con un único método `fetchTournamentSnapshot()` que devuelve un snapshot tipado. Adapters: `mock` (para dev), `thesportsdb` (free tier).

`src/server/resolution.ts` toma el snapshot y, por cada categoría, mapea su `resolution_strategy` a un outcome (`team` / `team_set` / `player` / `skip`) y lo escribe en `results`. Vercel Cron pega contra `/api/cron/resolve` diariamente.

**Estrategias implementadas** (auto): `final_winner`, `final_loser`, `third_place`, `finalists`, `top_scoring_team`, `most_conceded_team`.

**Pendientes de wiring del provider**: `top_n_teams`, `revelation`, `disappointment`, `top_scorer_player`, `top_assists_player`. El algoritmo de revelación/decepción ya está en `src/features/scoring/tournament-rank.ts`, solo falta que el provider de fixtures llene la entrada (resultados de partidos + tarjetas + grupo stats).

**Manual con fuente declarada**: `fifa_golden_ball`, `fifa_golden_glove`, `fifa_young_player`. La UI lo deja explícito vía el icono (i) en cada categoría.

### Criterios de Revelación / Decepción

El criterio fue diseñado a mano y está documentado en la app (ver el dialog del icono (i) al lado de cada categoría). Resumen:

1. **Ranking FIFA normalizado** a 1→48 entre las 48 selecciones del Mundial (1 = la mejor rankeada del torneo, 48 = la peor). Usar el ranking FIFA global crudo no funciona: Nueva Zelanda en #85 global y terminando última del torneo daría un falso +37 de "revelación".
2. **Ranking del torneo** 1→48 al cierre del campeonato, distribuido en brackets:
   - 1: campeón · 2: subcampeón · 3: tercero · 4: cuarto
   - 5–8: perdedores de cuartos
   - 9–16: perdedores de octavos
   - 17–32: perdedores de dieciseisavos (R32)
   - 33–48: eliminados en fase de grupos
3. **Desempate dentro de cada bracket de eliminación directa**:
   - **Perdedores por penales primero** (empataron en 90 + ET, perdieron en shootout) → más goles en el partido → fair play (menos amarillas + rojas en el torneo)
   - Luego **perdedores por derrota** → mejor diferencia de goles del partido → más goles a favor → fair play
   - Para la fase de grupos: puntos → DG → GF → fair play (criterio FIFA estándar)
4. **Delta** = `rank_FIFA_interno - rank_torneo`. Revelación = mayor delta positivo. Decepción = mayor delta negativo.

En el selector de equipos para estas dos categorías la UI muestra ambos rankings (`FIFA #15 · M #8`) para que el jugador entienda qué número manda.

## Validaciones de consistencia en el formulario

- **Bloqueo duro**: Campeón / Subcampeón / Tercer lugar no admiten el mismo equipo. Los comboboxes filtran las selecciones ya tomadas en las otras dos categorías.
- **Top 5 gated**: la card está deshabilitada hasta que el podio (campeón + subcampeón + tercer lugar) esté completo. Esto evita que un usuario elija 5 equipos manualmente saltándose la regla de auto-anclar las 3 del podio.
- **Warnings** (no bloquean, solo flag):
  - Revelación marcada con un favorito FIFA top 5 → "no es revelación, es favorita…"
  - Decepción marcada con un underdog FIFA bottom 5 → "no es decepción, es de las menos favoritas…"
  - Mismo equipo en revelación y decepción
  - Decepción coincide con campeón / subcampeón / tercer lugar / top 5
- Las apuestas se mantienen privadas hasta el lock. Después se revelan todas en `/groups/[slug]/predictions`.

## Comprobante de predicciones

Al guardar, el usuario aterriza en `/groups/[slug]/comprobante` — un resumen tipo recibo con:
- Wordmark + nombre del grupo + nombre del jugador
- Última edición + fecha de cierre del grupo (todo en hora Bolivia)
- Lista numerada de las 14 categorías con su pick resuelto
- Botón **"Compartir como imagen"**: captura el card con `html-to-image` (dynamic import) y usa Web Share API con archivos en móvil, fallback a descarga en desktop. La captura respeta el tema activo (dark o light).

## Tema dark / light

`globals.css` declara los tokens vía CSS variables. Hay tres modos: `dark` (default), `light`, y `system` (sigue `prefers-color-scheme`). El toggle vive en el header (componente `ThemeToggle` con `next-themes`). Los tokens viven en `:root` / `:root.light` y se consumen vía clases Tailwind (`bg-background`, `text-foreground`, etc.) gracias al `@theme inline` block.

## Hora local

Todo display de fecha/hora pasa por `formatDayShort`, `formatDayTime`, `formatTimeOnly` en `src/lib/format.ts`, que fijan `timeZone: 'America/La_Paz'`. Sin esto, los Server Components corren con el TZ del runtime (UTC en Vercel) y los horarios de cierre del pool quedan corridos 4 horas — crítico para los lock cutoffs.

## Empates honestos

El ranking del leaderboard usa **competition ranking**: empates comparten posición (`T-3`, `T-3`, `5`), y el pozo se reparte por igual entre los empatados en cada slot del payout rule. Hay un helptext debajo de la tabla y en la card del pozo que lo explica cuando aplica.

## Auth

- **Google OAuth** y **magic link**, ambos vía Supabase Auth (`@supabase/ssr`). Sin passwords. Sesión en cookies HTTP-only, refresh en cada request vía `src/proxy.ts`.
- Deep link `/join/[code]` redirige a `/login?next=…` si el usuario no tiene sesión y vuelve a la invitación al loggearse.
- **Magic link** usa un template HTML personalizado (`email-templates/auth-magic-link.html`) con el branding de mundial-pool. Hay que pegarlo en Supabase Dashboard → Authentication → Email Templates → Magic Link (también funciona en "Confirm signup" e "Invite user").
- **Rate-limit del SMTP gratis de Supabase**: detectado server-side, persistido en `app_state.magic_link_blocked_until` para que sea **global entre dispositivos**. El form muestra un warning naranja "Servicio de correo saturado" con countdown vivo y deshabilita el botón hasta que se libere el cap (1 hora por defecto). Empuja al usuario hacia "Continuar con Google" mientras tanto.

### Configurar Google OAuth

Una vez por proyecto. Pasos:

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
   - Crear proyecto. APIs & Services → OAuth consent screen → External.
   - Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase Dashboard** → Authentication → Providers → Google → pegar Client ID + Secret → Enable.
3. **Supabase Dashboard** → Authentication → URL Configuration → Site URL + Redirect URLs whitelist (`http://localhost:3000/auth/callback` en dev, dominio prod).

## Pozo de apuestas privado (opt-in por grupo)

Cada grupo activa un pozo manejado offline (Yape, transferencia, QR de Tigo Money / banco). **La app no procesa pagos**, solo lleva el ledger.

- `groups.pool_enabled`, `pool_currency`, `pool_qr_url`, `pool_payout_rule`.
- Reglas: `winner_takes_all`, `top_3_split` (60/30/10), `manual`.
- `computePayout(groupId)` cruza el leaderboard actual con el monto acumulado y devuelve cuánto le tocaría a cada rank si el torneo terminara hoy. Maneja empates con división proporcional.
- Solo el `owner` del grupo puede activar/desactivar, subir QR a Supabase Storage, registrar/eliminar transacciones. Todos los miembros ven el monto y el QR.

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Llenar DATABASE_URL (transaction pooler, port 6543), NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESOLUTION_CRON_SECRET.
pnpm db:generate && pnpm db:migrate
pnpm db:seed:categories
pnpm db:seed:teams
pnpm tsx scripts/seed-players.ts        # ~1200 jugadores desde Wikipedia
pnpm tsx scripts/seed-fifa-ranking.ts   # ranking FIFA pre-Mundial
pnpm dev
```

Para correr el cron de resolución manualmente:

```bash
pnpm db:resolve
```

## Deploy

Auto-deploy en push a `main` vía la integración Vercel/GitHub. Para deploys manuales:

```bash
vercel --prod
```

## Roadmap

- [x] Schema + integraciones base + seed 48 selecciones + ~1200 jugadores
- [x] Auth Google + magic link, deep-link `/join/[code]` con redirect post-auth
- [x] Magic link con template HTML custom + detección de rate-limit global
- [x] CRUD de grupos, código de invitación, Web Share API
- [x] Formulario con autocomplete de jugadores, cascada Top 5, validaciones
- [x] Info dialogs por categoría (revelación/decepción + 5 categorías de jugador)
- [x] Algoritmo de ranking del torneo (campeón…48) con desempates por tipo de derrota
- [x] Leaderboard con competition ranking + reparto proporcional del pozo
- [x] Pozo opt-in con QR upload a Supabase Storage
- [x] Tema dark / light / system con toggle en el header
- [x] PWA: icons + manifest + iOS add-to-home-screen
- [x] Hora local Bolivia en todos los displays
- [x] Comprobante post-save + "Compartir como imagen"
- [x] Apuestas públicas del grupo después del lock
- [ ] Cron de resolución conectado a provider real (TheSportsDB + manual)
- [ ] Admin panel para overrides de los premios FIFA subjetivos
- [ ] Email transaccional para digest diario de resultados (requiere dominio + Resend)
- [ ] Sentry / observability mínima
