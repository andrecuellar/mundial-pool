# mundial-pool

Pool del Mundial 2026 enfocado en **premios y resultados globales** del torneo, no en predicciones partido-por-partido. Multi-tenant: cualquier persona crea su grupo, invita amigos con un código de 6 caracteres y arma su propia liga.

Producción: [`mundial-pool.vercel.app`](https://mundial-pool.vercel.app). Hay también una versión **Android nativa (TWA)** descargable en [`/instalar`](https://mundial-pool.vercel.app/instalar).

## Por qué

Los pools tradicionales obligan a predecir 100+ partidos del Mundial 2026 (formato de 48 equipos). La mayoría son partidos de baja convocatoria — predecir "Congo vs Uzbekistán" no es divertido.

Esta app reemplaza eso por **14 predicciones fijas de torneo completo** que se llenan una sola vez antes del partido inaugural. Después de la fecha de cierre del grupo, todo es solo lectura y los puntos se calculan automáticamente.

### Las 14 categorías

| # | Categoría | Tipo | Default points |
|---|---|---|---|
| 01 | Selección campeona | Equipo | 15 |
| 02 | Subcampeón | Equipo | 7 |
| 03 | Tercer lugar | Equipo | 5 |
| 04 | Finalistas (set de 2) | Equipos · partial credit | 6 por acierto |
| 05 | Top 5 selecciones | Equipos · auto + manual · partial credit | 2 por acierto |
| 06 | Selección revelación | Equipo | 8 |
| 07 | Selección decepción | Equipo | 8 |
| 08 | Selección más goleadora | Equipo | 5 |
| 09 | Selección más goleada | Equipo | 3 |
| 10 | Bota de Oro (goleador) | Jugador | 10 |
| 11 | Máximo Asistente | Jugador | 7 |
| 12 | Balón de Oro | Jugador | 7 |
| 13 | Guante de Oro | Jugador | 5 |
| 14 | Mejor jugador joven | Jugador | 5 |

**Partial credit** en team_set: en Finalistas y Top 5 cada equipo acertado suma puntos por su cuenta. La view SQL `v_user_scores` hace `points * count(intersection)` siempre.

Los **puntos son editables por grupo al crear el grupo**. El owner expande la sección "Personalizar puntos por categoría" en el form de creación.

## Principios de diseño

1. **Resultados automáticos donde se pueda.** El cron diario consulta a la API de fútbol y rellena las categorías derivables.
2. **Multi-tenant.** Cualquiera crea un grupo (con gating de superadmin opcional). Aislamiento total entre grupos.
3. **Criterios objetivos y explicados.** Cada categoría con criterio no-trivial tiene un info icon (i) con tooltip + modal.
4. **Free tier first.** El stack completo cabe en Vercel Hobby + Supabase Free para decenas de grupos.
5. **No es una casa de apuestas.** Disclaimers prominentes en cada touchpoint del pozo.
6. **Hora boliviana siempre.** Todo display y todo input (incluso los `<input type="datetime-local">`) trabaja en `America/La_Paz` (UTC-4) sin importar la TZ del browser o del Node runtime.

## Stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts` en lugar de `middleware.ts`)
- **React 19.2** Server Components + client islands con `useTransition` / `useLinkStatus`
- **Tailwind v4** con `@theme inline` y tokens en OK-LCh
- **shadcn/ui** (preset Nova) + Radix primitives
- **Supabase**: Postgres, Auth (Google OAuth + magic link), Storage para los QR del pozo, ban via `auth.admin.updateUserById`
- **Drizzle ORM** + **drizzle-kit** (migraciones SQL versionadas)
- **postgres-js** vía Supabase transaction pooler (`max: 15`, `prepare: false`)
- **Web Push** (`web-push` + VAPID) con service worker en `public/sw.js`
- **Sentry** (`@sentry/nextjs`) en client / server / edge para errores server-side, con replay 100% on-error
- **canvas-confetti** para celebración al acertar resultados
- **html-to-image** para exportar el comprobante como imagen
- **Zod** validaciones, **Biome** lint/format, **pnpm**, **TypeScript** estricto
- **Vercel** deploy con auto-deploy en `main`. Cron jobs diarios.
- **next-themes** para el toggle dark / light / system
- **TWA / PWABuilder** para empaquetar la PWA como APK Android (`app.andrecuellar.mundialpool.twa`)

## Modelo de datos

20 tablas. Núcleo del torneo:

- `profiles` — perfil del usuario (1:1 con `auth.users` de Supabase). `onboarded_at`, `banned_at`, `banned_reason`, `banned_by_user_id`, `can_create_groups`.
- `groups` — pool con slug, código de invitación, fecha de bloqueo, currency, buy-in fijo, QR, payout rule.
- `group_members` — pertenencia + rol (`owner` / `admin` / `member`).
- `group_categories` — qué categorías habilita cada grupo y cuántos puntos.
- `categories` — catálogo global de tipos de predicción + estrategia de resolución.
- `teams` — 48 selecciones del Mundial.
- `players` — ~1200 jugadores sembrados desde Wikipedia.
- `matches` — fixtures (sync desde TheSportsDB).
- `predictions` — predicción de un usuario en un grupo.
- `results` — resultado real por categoría.
- `resolution_runs` — auditoría de cada cron de resolución.
- `prediction_reactions` — reacciones emoji a picks post-lock.
- `pool_transactions` — ledger del pozo.

Engagement / admin / observability:

- `group_creation_requests` — solicitudes de permiso para crear grupos (status: pending/approved/rejected, reason, reviewer).
- `admin_broadcasts` — audit log de cada push manual enviado por el superadmin (filter JSON + audience count + delivered count + ignoreOptOut).
- `client_errors` — errores capturados del browser (console.error/warn + window.onerror + unhandledrejection) con fingerprint para dedupe.
- `notification_preferences` — opt-outs por tipo de notificación, per-user.
- `push_subscriptions` — endpoints Web Push del user por device.
- `app_state` — key/value global (ej. deadline del rate-limit del magic link).

Vista SQL `v_user_scores` recalcula puntos por usuario por grupo (alimenta el leaderboard).

## Resolución automática

`src/integrations/football/` define una interfaz `FootballProvider` con un método `fetchTournamentSnapshot()`. Adapters: `mock` (dev), `thesportsdb` (free tier).

`src/server/resolution.ts` toma el snapshot y, por cada categoría, mapea su `resolution_strategy` a un outcome (`team` / `team_set` / `player` / `skip`) y lo escribe en `results`. Vercel Cron pega contra `/api/cron/resolve` diariamente. Después de escribir cada resultado, dispara push notifications a quienes acertaron.

**Estrategias auto**: `final_winner`, `final_loser`, `third_place`, `finalists`, `top_scoring_team`, `most_conceded_team`.

**Algoritmo revelación/decepción**: implementado en `src/features/scoring/tournament-rank.ts`. El criterio se documenta en la app vía dialogs `RevelationCriteriaDialog`.

**Manual con fuente FIFA declarada**: `fifa_golden_ball`, `fifa_golden_glove`, `fifa_young_player`.

## Comprobante de predicciones

Al guardar, el usuario aterriza en `/groups/[slug]/comprobante` — un resumen tipo recibo con wordmark + nombre del grupo + jugador + lista de las 14 categorías + botón **"Compartir como imagen"** (captura con `html-to-image`, dynamic import, Web Share API en móvil con fallback a descarga).

Antes del comprobante el form muestra un overlay full-screen celebratorio (trofeo con anillos pulsando) que se mantiene hasta el transition. Mismo overlay para crear grupo, registrar pago, enviar broadcast admin, etc. (componente compartido `SavingOverlay`).

## Pozo de apuestas privado (opt-in por grupo)

Cada grupo activa un pozo manejado offline (Yape, transferencia, QR). **La app no procesa pagos**, solo lleva el ledger.

- `groups.pool_enabled`, `pool_currency`, `pool_buy_in_amount`, `pool_qr_url`, `pool_payout_rule`.
- Reglas: `winner_takes_all`, `top_3_split` (60/30/10), `manual`.
- **Buy-in fijo por grupo** + lock retroactivo al primer aporte.
- **QR upload** al crear el grupo o desde Configurar pozo, con cleanup automático del archivo anterior.
- **Reveal del creador en el QR**: el dialog muestra nombre + email del owner.
- **Confirmación al registrar pago** con AlertDialog explícito.
- **Payment status en el leaderboard**: badge `Aportó` / `Pendiente`.
- `computePayout(groupId)` cruza el leaderboard actual con el monto acumulado y devuelve cuánto le tocaría a cada rank.

## Notificaciones Web Push

VAPID keys via env. Service worker en `public/sw.js` con pre-cache de assets críticos para mejorar Lighthouse score (señal positiva para Chrome Quieter UI).

### Tipos registrados (12)

`result_winner`, `lock_reminder`, `lock_closed`, `payment_reminder`, `admin_broadcast`, `member_joined`, `pool_deposit_confirmed`, `rank_dethroned`, `rank_reached_top`, `group_creation_requested`, `group_creation_approved`, `group_creation_rejected`.

Definidos en `src/server/notifications/types.ts`. El sender filtra por `notification_preferences` para respetar opt-outs.

### Crons de engagement (`vercel.json`)

- `/api/cron/resolve` — 08:00 UTC. Resuelve categorías + dispara `result_winner`.
- `/api/cron/lock-reminder` — 14:00 UTC (10am BOT). Recordatorio a no-predictores en grupos con lock en D-3, D-1 y just-locked.
- `/api/cron/payment-reminder` — 16:00 UTC (12pm BOT). Recordatorio a no-pagadores en grupos con pool activo (D-7, D-3, D-1).

### Permission UX

Diseñada para sobrevivir el **Chrome Quieter UI** que auto-bloquea prompts en sitios nuevos:

- **Welcome splash** (full-screen, 1 vez/día BOT): si el user toca "Iniciar" y está en TWA o PWA instalada (high-intent context), se dispara `Notification.requestPermission()` directamente. En browser regular NO se dispara — se reserva para el banner.
- **Banner `PushOptIn`** en home + dashboard de grupo: double-permission pattern con UI propia explicando los avisos antes de mostrar el prompt nativo.
- **Detección de silent_block**: si `Notification.requestPermission()` resuelve con `'default'` (= Chrome lo silenció), mostramos copy específico explicando cómo activar manualmente desde el candado de la URL.
- **Detección de revoke silencioso**: si `Notification.permission === 'default'` pero el flag local `mp:push-granted-locally` está seteado, chequeamos `pushManager.getSubscription()` antes de asumir granted — si no hay sub real, limpiamos el flag stale y volvemos a mostrar el banner.
- **Deep-link Android settings** (`intent://`) en el estado `denied` cuando estamos en TWA, para abrir directamente Settings → mundial-pool → Notifications.
- **Dismiss per-día BOT**: cerrar el banner lo oculta solo hasta el siguiente día calendario.

### Panel admin de broadcasts (`/admin/notificar`)

El superadmin manda push a audiencias segmentadas:

- `all` — todos los users (no baneados).
- `group` — miembros de un grupo específico.
- `non_payers` — pendientes de pago en un grupo X (o en cualquier grupo con pozo).
- `non_predictors` — pendientes de predicción (umbral configurable).
- `non_payers_and_non_predictors` — intersección.

Helpers en `src/features/notifications/audience.ts` y `broadcast.ts`. Audit log en `admin_broadcasts`. Toggle "mensaje crítico" para ignorar opt-outs cuando es urgente.

## Welcome splash

Overlay full-screen al cold start de la app/PWA/TWA, una vez por día calendario BOT (`localStorage` con `bolivianCalendarDate()`). Muestra 5 "match cards" estilo Google match preview con los partidos más "aburridos" del Mundial 2026 (Haití vs Escocia, Irán vs NZ, etc.) + el copy "¿quién quiere predecir esto? 🤌🏽".

- Contador 10s arriba a la derecha + botón "Iniciar" abajo al centro.
- Datos reales sincronizados desde `matches` table (TheSportsDB); fallback hardcoded verificado contra fuentes oficiales por si la DB no tiene aún.
- Versión `WelcomeSplashInline` en la columna derecha de `/login` (solo `lg:`).
- En contexto TWA/PWA instalada, tocar "Iniciar" también dispara el prompt de notificaciones (user gesture).

## Landing `/instalar`

Página pública sin login para distribuir el APK Android sin Play Store. El APK (~1 MB) vive en `public/downloads/mundial-pool.apk` con `Content-Type: application/vnd.android.package-archive` + `X-Robots-Tag: noindex`.

- **Detección de platform**: Android → botón gigante de descarga; iOS → "usá la web"; desktop → "abrí esto desde tu Android" + botón compartir link.
- Pasos numerados con instrucciones per-vendor (Samsung One UI, Xiaomi/MIUI, otros) para "fuentes desconocidas" + cómo bypassear Play Protect.
- FAQ corta (¿es seguro? ¿por qué no Play Store? ¿iPhone? ¿web?).
- `assetlinks.json` en `public/.well-known/` con el SHA256 del cert que firma el APK — sin esto el TWA mostraría URL bar de Chrome.

## TWA / PWA

`PWABuilder.com` genera el `.apk` / `.aab` a partir del `manifest.ts` con:
- `id: '/'`, `scope: '/'`, `display: standalone` + `display_override: [standalone, minimal-ui]`
- Icons en 4 variantes: 192/512 × any/maskable (route handlers en `src/app/icon*/route.tsx`)
- Screenshots narrow + wide (en `public/screenshots/`) para listing futuro
- Categories: `sports`, `entertainment`, `social`

Notification Delegation activada — los push llegan como notificaciones nativas Android.

## Group creation gating (opcional)

Para evitar que cualquier usuario cree pozos sin que el superadmin lo sepa:

- Default: `profiles.can_create_groups = false`.
- En home, el botón "Crear grupo" varía según estado: habilitado / "Pedir permiso" / "Pendiente de revisión" / "Rechazada — pedir de nuevo".
- `RequestPermissionDialog`: form con mensaje opcional → server action `requestGroupCreation` inserta en `group_creation_requests` + push al superadmin.
- `/admin/solicitudes`: tabla con pending → "Aprobar" / "Rechazar" (con motivo opcional). Aprobación setea `can_create_groups = true` + push al user.
- Superadmins (`SUPER_ADMIN_EMAILS` en `src/lib/admin.ts`) bypasean el gate.

## Engagement features (cards + chips)

- **`GroupCardChips`** en home: por grupo, chips inline "Te faltan N predicciones" / "Aporte pendiente" (con `mp-pulse-soft` cuando lock ≤ 7d).
- **`DualPendingBanner`** en home: banner urgente arriba del listado cuando el user tiene 0 predicciones + 0 pago en algún grupo con lock ≤ 3d.
- **Card "Aporta al pozo"** en `/groups/[slug]`: paralela al CTA de predicciones, con `mp-glow-border` cuando hay pago pendiente. Estado `Pagado` con check verde cuando confirmó el admin.
- **Splash en login**: versión inline de welcome con drift sutil infinito.

## Copy predictions entre grupos

Para users en múltiples grupos: dialog que permite copiar las predicciones del user de un grupo fuente a múltiples grupos destino (hasta 10).

- Server action `copyPredictions` valida membresía + lock + categorías habilitadas en cada destino.
- Si algún destino ya tenía predicciones, devuelve `code: 'needs_confirmation'` con la lista de grupos y conteos → UI pide overwrite explícito.
- Aplica con bulk UPSERT por destino (un solo statement con `excluded.*`).
- Resultado: vista de "comprobante de copia" con stagger fade-up + link al comprobante real de cada destino.
- Trigger en home (botón con `mp-pulse-soft`) cuando el user tiene ≥2 grupos y al menos uno tiene predicciones.

## Client error capture

Sistema propio para detectar errores del browser que Sentry no muestra fácilmente desde móvil:

- `src/lib/client-error-reporter.ts`: instala interceptores de `console.error`, `console.warn`, `window.onerror` y `unhandledrejection`.
- Rate limit local 30/60s + batch debounce 1s + max 20 por POST + `keepalive: true`.
- POST a `/api/client-errors` (sin auth requerida; rate limit per-IP in-memory). Inserta a `client_errors` con fingerprint `sha256(message + primera línea de stack)` para dedupe.
- Mount-once via `<ClientErrorReporter />` en el root layout.
- Visible en `/admin/errores`: vista agrupada por fingerprint con count + último visto + usuarios afectados, vista cruda con stack expandible.

## Global error boundary

`src/app/global-error.tsx` (client component) reemplaza el blanco genérico de Next.js cuando algo trona en producción. Renderea `<html>` + `<body>` propios con copy en español tuteo, botones "Intentar de nuevo" + "Ir al inicio", muestra el `digest` para correlar con logs, y captura el error a Sentry vía `Sentry.captureException`.

## Hora boliviana garantizada

`src/lib/format.ts` exporta:

- `formatDayShort`, `formatDayTime`, `formatTimeOnly`, `formatDateEs` — formatters que setean `timeZone: 'America/La_Paz'` explícito.
- `parseBolivianDateTimeLocal(s)` — parsea `"YYYY-MM-DDTHH:mm"` (formato de `<input type="datetime-local">`) como BOT y devuelve un Date UTC. Reemplaza `new Date(string)` device-local.
- `formatBolivianDateTimeLocal(d)` — formatea un Date como `"YYYY-MM-DDTHH:mm"` en BOT para asignar como `value` de un datetime-local.
- `bolivianCalendarDate(d?)` — devuelve `"YYYY-MM-DD"` en BOT (para localStorage flags como el welcome splash).

El form de crear grupo muestra `(hora boliviana)` debajo del campo de lockAt para que el admin que viaje al extranjero entienda la convención.

El parser de TheSportsDB (`src/integrations/football/thesportsdb.ts`) fuerza sufijo `Z` antes de `new Date()` — TheSportsDB devuelve UTC sin `Z`, lo que en Node con TZ no-UTC se interpretaba como hora local (4h de drift).

## Validaciones de consistencia en el formulario

- **Bloqueo duro**: Campeón / Subcampeón / Tercer lugar no admiten el mismo equipo. Los comboboxes filtran las selecciones ya tomadas.
- **Top 5 gated**: la card está deshabilitada hasta que el podio esté completo.
- **Warnings** (no bloquean, solo flag): revelación con favorito FIFA top 5, decepción con underdog FIFA bottom 5, mismo equipo en revelación/decepción, decepción coincidente con podio.

## Reacciones a picks (post-lock)

6 emojis fijos (🔥 😂 💀 👀 🤡 🤌) en cada predicción visible post-lock. Server action requiere membership + lock pasado. `UNIQUE(prediction_id, user_id, emoji)`.

## Tema dark / light / system

`globals.css` declara los tokens vía CSS variables. `next-themes` para el toggle en el header. Los tokens viven en `:root` / `:root.light`.

## Auth

- Google OAuth + magic link vía Supabase `@supabase/ssr`. Sesión en cookies HTTP-only, refresh en `src/proxy.ts`.
- Deep link `/join/[code]` redirige a `/login?next=…` si no hay sesión.
- Magic link con template HTML personalizado + detección global del rate-limit SMTP (persistido en `app_state`).
- **Ban check en el callback** (`src/app/auth/callback/route.ts`): después de `exchangeCodeForSession`, lee `profiles.banned_at` → si está banneado redirige a `/banned`.

## Performance

- `getLeaderboard` y `getPoolSummary` envueltas en `React cache()` para deduplicar dentro del mismo render.
- Postgres pool a `max: 15` para Vercel Fluid Compute.
- `/predict` colapsa 3 queries en 1 con LEFT JOIN para listar "mis predicciones en otros grupos" + counts.
- Welcome splash con `unstable_cache` (1h) para los boring matches.
- Imágenes QR con cache `3600s` + cleanup automático.

## Panel `/admin/*`

Sidebar único con auth gate vía `requireSuperAdmin()` en `src/app/admin/layout.tsx`. Páginas:

| Ruta | Qué hace |
|---|---|
| `/admin` | Dashboard con KPIs + últimos eventos. |
| `/admin/solicitudes` | Pending / decididas de creación de grupo. Acciones aprobar/rechazar inline. |
| `/admin/usuarios` | Tabla de profiles con auth + grupos + predictions. |
| `/admin/usuarios/[id]` | Detalle + ban/unban. |
| `/admin/grupos` | Grid de todos los grupos. |
| `/admin/grupos/[slug]` | Miembros, predicciones, pozo, QR. |
| `/admin/predicciones` | Todas las predictions con filtros. |
| `/admin/pozos` | Transacciones de pool + totales por moneda. |
| `/admin/datos` | Categorías + equipos + jugadores + resultados. |
| `/admin/notificar` | Form de broadcast push + audiencias + historial. |
| `/admin/errores` | Errores del browser (client_errors) con fingerprint + filtros. |
| `/admin/sistema` | Estado de crons + resolution_runs + app_state + config API. |

## Privacy y Terms

Páginas estáticas en `/privacy` y `/terms` adaptadas a una quiniela privada entre amigos. Footer global en el layout.

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Llenar:
#   DATABASE_URL (transaction pooler, port 6543)
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   RESOLUTION_CRON_SECRET (o CRON_SECRET)
#   VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_SUBJECT
#     (generar con: npx web-push generate-vapid-keys)
#   NEXT_PUBLIC_SENTRY_DSN (opcional)
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

Scripts one-off útiles (en `scripts/`):

- `cleanup-test-data.ts` — wipe de grupos + aportes + QR bucket. Profiles preservados.
- `cleanup-orphan-qrs.ts` — limpia archivos del bucket `pool-qr` no referenciados.
- `unjoin-user.ts` — saca a un user de todos sus grupos sin banearlo (dry-run por defecto; `--apply` para ejecutar).

## Deploy

Auto-deploy en push a `main` vía la integración Vercel/GitHub. Para deploys manuales:

```bash
vercel --prod
```

Crons en `vercel.json` (todos UTC):

- `/api/cron/resolve` — daily 08:00 UTC.
- `/api/cron/lock-reminder` — daily 14:00 UTC (10am BOT).
- `/api/cron/payment-reminder` — daily 16:00 UTC (12pm BOT).

## TWA — empaquetar como APK Android

1. `https://www.pwabuilder.com/` → pegar `https://mundial-pool.vercel.app`.
2. "Package for Store" → Android. Package ID `app.andrecuellar.mundialpool.twa`. Notifications **ON**.
3. Descargar el zip. Guardar `signing.keystore` + password fuera del repo.
4. Copiar el SHA256 fingerprint del `assetlinks.json` del zip al `public/.well-known/assetlinks.json` del repo.
5. Subir el `.apk` resultante a `public/downloads/mundial-pool.apk`.
6. (Opcional) Subir el `.aab` al Play Store.

El TWA carga `mundial-pool.vercel.app` adentro de un wrapper Chrome — **cualquier cambio web aplica al APK ya distribuido sin re-generarlo**. Solo se requiere re-generar si cambia el manifest, el SW, o el `assetlinks.json`.

## Configurar Google OAuth + verificación

1. Google Cloud Console → crear proyecto. OAuth consent screen → External.
2. Credentials → Create OAuth client ID → Web. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Providers → Google → pegar Client ID + Secret.
4. Supabase Dashboard → Authentication → URL Configuration → Site URL + Redirect URLs.
5. Branding + verificación: OAuth consent screen → app name, support email, logo (≥120×120), homepage `https://mundial-pool.vercel.app`, privacy `…/privacy`, terms `…/terms`. Search Console: agregar property + verificar via HTML file. Publish + Submit for verification (2–3 días hábiles).

## Roadmap

- [x] Schema + integraciones base + seed 48 selecciones + ~1200 jugadores
- [x] Auth Google + magic link, deep-link `/join/[code]`
- [x] CRUD de grupos, código de invitación, Web Share API
- [x] Formulario con autocomplete + cascada Top 5 + validaciones
- [x] Algoritmo de ranking del torneo + desempates
- [x] Leaderboard con competition ranking + reparto proporcional
- [x] Pozo opt-in con QR upload + buy-in fijo + lock retroactivo
- [x] Tema dark / light / system
- [x] PWA: icons + manifest + iOS add-to-home-screen + install prompt
- [x] Hora boliviana en todos los displays + helpers de parse/format BOT
- [x] Comprobante post-save + "Compartir como imagen" + overlay celebratorio
- [x] Apuestas públicas del grupo después del lock
- [x] Web Push: VAPID + service worker + 12 tipos + opt-outs + recordatorios
- [x] Onboarding modal + countdown banner
- [x] Reacciones emoji a picks post-lock
- [x] Stats personales + búsqueda en la matriz
- [x] Result celebration con confetti
- [x] Ban system (superadmin) con kill de sesión Supabase
- [x] Privacy + Terms + footer + Google OAuth verification submit
- [x] Editor de puntos por categoría al crear grupo + partial credit
- [x] NavigationProgress + loading.tsx + SavingOverlay (en 7 flujos pesados)
- [x] Group creation gating + /admin/solicitudes
- [x] Engagement: cards CTA + chips pulsantes + DualPendingBanner
- [x] Copy predictions entre grupos + vista de comprobante de copia
- [x] /admin/notificar — broadcast push con audiencias segmentadas + historial
- [x] /admin/errores — client error capture con dedupe por fingerprint
- [x] /api/cron/payment-reminder + lock-reminder con D-3 y D-1
- [x] global-error.tsx + Sentry en client/server/edge
- [x] Welcome splash con match cards "aburridas" + permission prompt opportunistic
- [x] TWA Android (APK firmado) + landing `/instalar`
- [x] Manifest expandido para PWABuilder (id, scope, maskable, screenshots, categories)
- [ ] Cron de resolución conectado a provider real (sync de fixtures completo)
- [ ] Admin panel para overrides de los premios FIFA subjetivos
- [ ] Email transaccional como fallback de push (Resend)
- [ ] Custom domain (resuelve la última fricción del consent screen de Google)
