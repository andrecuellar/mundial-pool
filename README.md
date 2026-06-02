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

**Partial credit** en team_set: en Finalistas y Top 5 cada equipo acertado suma puntos por su cuenta (acertar uno de dos finalistas = 6 pts, acertar ambos = 12 pts; acertar 3 de 5 del top = 6 pts, todos = 10 pts). La view SQL `v_user_scores` hace `points * count(intersection)` siempre.

Los **puntos son editables por grupo al crear el grupo**. Defaults sirven como sugerencia + placeholder. El owner expande la sección "Personalizar puntos por categoría" en el form de creación y override de uno o varios. Los inválidos o fuera de rango `[0, 100]` se ignoran (mejor UX que tirar error).

## Principios de diseño

1. **Resultados automáticos donde se pueda.** El cron diario consulta a la API de fútbol y rellena las categorías derivables. Premios subjetivos (Balón de Oro, Guante de Oro, Mejor Joven) se resuelven manualmente con fuente FIFA declarada en la UI.
2. **Multi-tenant.** Cualquiera crea un grupo. Aislamiento total entre grupos. Un usuario puede pertenecer a varios.
3. **Criterios objetivos y explicados.** Cada categoría con criterio no-trivial tiene un info icon (i) con tooltip + modal que muestra exactamente cómo se decide.
4. **Free tier first.** El stack completo cabe en Vercel Hobby + Supabase Free para decenas de grupos.
5. **No es una casa de apuestas.** Disclaimers prominentes en cada touchpoint del pozo (home, creación de grupo, admin del pozo, vista del QR) explican que el dinero se mueve fuera de la app y que mundial-pool no se hace responsable por pérdidas. Páginas `/privacy` y `/terms` con el mismo lenguaje legal.

## Stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts` en lugar de `middleware.ts`)
- **React 19.2** Server Components + client islands con `useTransition` / `useLinkStatus`
- **Tailwind v4** con `@theme inline` y tokens en **OK-LCh** (preserva luminancia perceptual entre dark / light)
- **shadcn/ui** (preset Nova) + Radix primitives
- **Supabase**: Postgres, Auth (Google OAuth + magic link), Storage para los QR del pozo, ban via `auth.admin.updateUserById`
- **Drizzle ORM** + **drizzle-kit** (migraciones SQL versionadas)
- **postgres-js** vía Supabase transaction pooler (`max: 10`, `prepare: false`, `idle_timeout: 20`)
- **Web Push** (`web-push` + VAPID keys) con service worker en `public/sw.js`
- **canvas-confetti** para celebración al acertar resultados
- **html-to-image** para exportar el comprobante como imagen
- **Zod** validaciones, **Biome** lint/format, **pnpm**, **TypeScript** estricto
- **Vercel** deploy con auto-deploy en cada push a `main`. Cron jobs diarios para resolución y recordatorio de lock.
- **next-themes** para el toggle dark / light / system

## Modelo de datos (resumen)

- `profiles` — perfil del usuario (1:1 con `auth.users` de Supabase). Incluye `onboarded_at`, `banned_at`, `banned_reason`, `banned_by_user_id`.
- `groups` — cada pool tiene nombre, slug, código de invitación, fecha de bloqueo, currency del pozo, **buy-in fijo** (`pool_buy_in_amount`), payout rule, URL del QR.
- `group_members` — pertenencia usuario-grupo con rol (`owner` / `admin` / `member`)
- `group_categories` — qué categorías habilita cada grupo y cuántos puntos da. Se inicializa con los defaults de `categories` al crear el grupo y el owner puede editar los puntos.
- `teams` — 48 selecciones del Mundial, con ranking FIFA, código FIFA, bandera, expected round
- `players` — jugadores (~1200 sembrados desde Wikipedia para el autocomplete)
- `categories` — catálogo global de tipos de predicción + estrategia de resolución
- `predictions` — predicción de un usuario en un grupo (única por user + grupo + categoría)
- `results` — resultado real por categoría (global, llenado por el cron o manual)
- `resolution_runs` — auditoría de cada ejecución del cron de resolución
- `prediction_reactions` — reacciones emoji a las picks de otros, post-lock (🔥😂💀👀🤡🤌)
- `pool_transactions` — ledger del pozo, una fila por aporte registrado
- `push_subscriptions` — endpoints Web Push del usuario por device (uno por device/browser)
- `app_state` — key/value global. Primer caso de uso: deadline del rate-limit del magic link

Vista SQL `v_user_scores` que recalcula puntos por usuario por grupo (alimenta el leaderboard). Hace `points * count(intersection)` para team_set, exact match para team / player.

## Resolución automática

`src/integrations/football/` define una interfaz `FootballProvider` con un único método `fetchTournamentSnapshot()` que devuelve un snapshot tipado. Adapters: `mock` (para dev), `thesportsdb` (free tier).

`src/server/resolution.ts` toma el snapshot y, por cada categoría, mapea su `resolution_strategy` a un outcome (`team` / `team_set` / `player` / `skip`) y lo escribe en `results`. Vercel Cron pega contra `/api/cron/resolve` diariamente. Después de escribir cada resultado, dispara push notifications a quienes acertaron vía `src/server/push.ts`.

**Estrategias implementadas** (auto): `final_winner`, `final_loser`, `third_place`, `finalists`, `top_scoring_team`, `most_conceded_team`.

**Pendientes de wiring del provider**: `top_n_teams`, `revelation`, `disappointment`, `top_scorer_player`, `top_assists_player`. El algoritmo de revelación/decepción ya está en `src/features/scoring/tournament-rank.ts`, solo falta que el provider de fixtures llene la entrada (resultados de partidos + tarjetas + grupo stats).

**Manual con fuente declarada**: `fifa_golden_ball`, `fifa_golden_glove`, `fifa_young_player`. La UI lo deja explícito vía el icono (i) en cada categoría.

### Criterios de Revelación / Decepción

El criterio fue diseñado a mano y está documentado en la app (ver el dialog del icono (i) al lado de cada categoría). Resumen:

1. **Ranking FIFA normalizado** a 1→48 entre las 48 selecciones del Mundial (1 = la mejor rankeada del torneo, 48 = la peor).
2. **Ranking del torneo** 1→48 al cierre del campeonato, distribuido en brackets:
   - 1: campeón · 2: subcampeón · 3: tercero · 4: cuarto
   - 5–8: perdedores de cuartos
   - 9–16: perdedores de octavos
   - 17–32: perdedores de dieciseisavos (R32)
   - 33–48: eliminados en fase de grupos
3. **Desempate dentro de cada bracket de eliminación directa**:
   - Perdedores por penales primero → más goles en el partido → fair play
   - Luego perdedores por derrota → mejor diferencia de goles del partido → más goles a favor → fair play
   - Fase de grupos: puntos → DG → GF → fair play (criterio FIFA estándar)
4. **Delta** = `rank_FIFA_interno - rank_torneo`. Revelación = mayor delta positivo. Decepción = mayor delta negativo.

## Validaciones de consistencia en el formulario

- **Bloqueo duro**: Campeón / Subcampeón / Tercer lugar no admiten el mismo equipo. Los comboboxes filtran las selecciones ya tomadas.
- **Top 5 gated**: la card está deshabilitada hasta que el podio esté completo. Esto evita 5 picks manuales saltándose el auto-anclaje del podio.
- **Warnings** (no bloquean, solo flag): revelación marcada con un favorito FIFA top 5, decepción con un underdog FIFA bottom 5, mismo equipo en revelación/decepción, decepción coincidente con podio o top 5.
- Las apuestas se mantienen privadas hasta el lock. Después se revelan todas en `/groups/[slug]/predictions`.

## Comprobante de predicciones

Al guardar, el usuario aterriza en `/groups/[slug]/comprobante` — un resumen tipo recibo con:
- Wordmark + nombre del grupo + nombre del jugador
- Última edición + fecha de cierre del grupo (todo en hora Bolivia)
- Lista numerada de las 14 categorías con su pick resuelto
- Botón **"Compartir como imagen"**: captura el card con `html-to-image` (dynamic import), usa Web Share API en móvil, fallback a descarga en desktop.

Antes del comprobante el form muestra un **overlay full-screen celebratorio** (trofeo con anillos pulsando + "Guardando tus predicciones") que se mantiene hasta que la transición a `/comprobante` se completa. Mismo overlay para crear grupo (icono Sparkles + "Creando tu grupo").

## Pozo de apuestas privado (opt-in por grupo)

Cada grupo activa un pozo manejado offline (Yape, transferencia, QR de Tigo Money / banco). **La app no procesa pagos**, solo lleva el ledger.

- `groups.pool_enabled`, `pool_currency`, `pool_buy_in_amount`, `pool_qr_url`, `pool_payout_rule`.
- Reglas: `winner_takes_all`, `top_3_split` (60/30/10), `manual`.
- **Buy-in fijo por grupo**: el owner define un monto al activar el pool y todos aportan exactamente ese monto. Antes cada uno podía poner cualquier cantidad, lo que hacía que ganar dependiera más de cuánto pusiste que del ranking.
- **Lock retroactivo**: una vez registrado el primer aporte, el monto y la moneda quedan bloqueados (el form los deshabilita; el server lo valida también). Para cambiarlos hay que eliminar los aportes primero.
- **QR upload al crear el grupo** (opcional) o después desde Configurar pozo. El upload reemplaza limpia: borra el archivo anterior del bucket Supabase Storage tras cada reemplazo exitoso.
- **Reveal del creador en el QR**: cuando un miembro abre el dialog del QR ve el nombre + email Google del owner ("Le estás mandando dinero a…") como anclaje de confianza.
- **Confirmación al registrar pago**: el form de "Registrar un pago recibido" abre un AlertDialog explícito ("¿X te pagó N y confirmaste que el dinero te llegó?") antes de escribir la transacción.
- **Payment status en el leaderboard**: cada miembro aparece con badge `Aportó` o `Pendiente`. Helper text avisa que los pendientes pueden ser removidos por el admin antes del cierre.
- `computePayout(groupId)` cruza el leaderboard actual con el monto acumulado y devuelve cuánto le tocaría a cada rank si el torneo terminara hoy. Maneja empates con división proporcional.

## Notificaciones Web Push

VAPID keys configuradas como env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Service worker en `public/sw.js` maneja `push` (renderiza notification con title/body/icon) y `notificationclick` (abre la URL guardada en `data.url`).

- **Opt-in**: card `PushOptIn` en home y en cada dashboard de grupo. Llama a `Notification.requestPermission()` → `pushManager.subscribe()` → POST a `/api/push/subscribe`.
- **Estados**: `granted` (oculto), `denied` (card warning con instrucciones para resetear permiso del navegador), `prompt` (oferta de activar), `dismissed` (oculto por localStorage).
- **Triggers**:
  1. **Resolución de categoría**: `notifyWinners()` en `src/server/resolution.ts` busca quienes acertaron y manda "🏆 Acertaste {categoría}! +{puntos} pts".
  2. **Lock reminder**: cron daily `/api/cron/lock-reminder` busca grupos cuyo `predictions_lock_at` cae en las próximas 24h (recordatorio "te faltan N categorías") y los que acaban de lockear (cierre "tus predicciones quedaron bloqueadas").
- **Cleanup de subs expiradas**: si el endpoint responde 404/410, se borra de la DB automáticamente.

## Onboarding + countdown + PWA

- **OnboardingModal**: 3 cards la primera vez que un usuario entra a `/`. Marca `profiles.onboarded_at` al cerrar.
- **CountdownBanner**: muestra tiempo hasta `predictionsLockAt` con escalado visual según urgencia (chip > 7d, card 1-7d, banner warning < 24h con ticker cada minuto, banner crítico < 1h con ticker cada segundo).
- **PWA install prompt**: snackbar en el home después de 30s de uso. Captura `beforeinstallprompt` en Chrome/Edge; en iOS muestra modal con pasos manuales (Share → Add to Home Screen).
- **Service worker** registrado en el layout para habilitar push + standalone display.

## Reacciones a picks (post-lock)

Cada predicción tiene barra de reacciones con 6 emojis fijos (🔥 😂 💀 👀 🤡 🤌). Server action `toggleReaction` requiere membership en el grupo + lock pasado. Tabla `prediction_reactions` con `UNIQUE(prediction_id, user_id, emoji)` evita duplicados. Cada pill muestra count + tooltip con quién reaccionó.

## Stats personales + búsqueda en la matriz

- **`PersonalStatsCard`** en el dashboard de grupo: puntos totales, posición, accuracy, mejor categoría, histograma de 14 dots (verde acierto / ámbar parcial / rojo error / gris pendiente).
- **Búsqueda + filtros en `/groups/[slug]/predictions`**: filtra miembros por nombre, filtra picks por categoría. Cuando hay categoría activa, cambia a vista compacta con qué eligió cada uno.

## Tema dark / light

`globals.css` declara los tokens vía CSS variables. Tres modos: `dark` (default), `light`, y `system` (sigue `prefers-color-scheme`). El toggle vive en el header (componente `ThemeToggle` con `next-themes`). Los tokens viven en `:root` / `:root.light` y se consumen vía clases Tailwind (`bg-background`, `text-foreground`, etc.) gracias al `@theme inline` block.

## Hora local

Todo display de fecha/hora pasa por `formatDayShort`, `formatDayTime`, `formatTimeOnly` en `src/lib/format.ts`, que fijan `timeZone: 'America/La_Paz'`. Sin esto, los Server Components corren con el TZ del runtime (UTC en Vercel) y los horarios de cierre del pool quedan corridos 4 horas — crítico para los lock cutoffs.

## Empates honestos

El ranking del leaderboard usa **competition ranking**: empates comparten posición (`T-3`, `T-3`, `5`), y el pozo se reparte por igual entre los empatados en cada slot del payout rule. Hay un helptext debajo de la tabla y en la card del pozo que lo explica cuando aplica.

## Feedback visual de navegación

Para que la app no se sienta lenta entre clicks y page renders:

- **`<NavigationProgress />`** global en el layout: barra fina arriba del viewport que aparece en cada cambio de ruta. Click delegado detecta navegación a Link interno, `usePathname + useSearchParams` cierra la barra cuando la nueva ruta hidrata. Respeta `prefers-reduced-motion`.
- **`loading.tsx`** en las 4 rutas pesadas (`/groups/[slug]`, `/predict`, `/leaderboard`, `/predictions`) con skeletons que respetan el shape del page real para evitar layout shift.
- **`<NavButton>`** wrapper `Button asChild + Link + useLinkStatus`: muestra spinner mientras la ruta nueva monta y bloquea el segundo click con `preventDefault`.
- **Fix de `<Button asChild>` con `disabled`**: cuando `asChild=true`, el HTML `disabled` se omite (un `<a>` lo ignora) y en su lugar se interceptan los clicks + se setea `aria-disabled` + `tabIndex=-1`.
- **`<SavingOverlay>`** full-screen con backdrop blur al guardar predicciones o crear un grupo: trofeo (o sparkles) con anillos concéntricos pulsando, ellipsis animado, hold de 900ms en estado `success` con check verde antes de redirigir.

## Auth

- **Google OAuth** y **magic link**, ambos vía Supabase Auth (`@supabase/ssr`). Sin passwords. Sesión en cookies HTTP-only, refresh en cada request vía `src/proxy.ts`.
- Deep link `/join/[code]` redirige a `/login?next=…` si el usuario no tiene sesión y vuelve a la invitación al loggearse.
- **Magic link** usa un template HTML personalizado (`email-templates/auth-magic-link.html`) con branding propio. Pegarlo en Supabase Dashboard → Authentication → Email Templates → Magic Link.
- **Rate-limit del SMTP gratis de Supabase**: detectado server-side, persistido en `app_state.magic_link_blocked_until` para que sea **global entre dispositivos**. El form muestra un warning naranja "Servicio de correo saturado" con countdown vivo.
- **Ban check en el callback** (`src/app/auth/callback/route.ts`): después de `exchangeCodeForSession`, lee `profiles.banned_at`. Si está banneado, redirige a `/banned` sin completar el login. Una query por login (evento raro) en vez de chequear en `proxy.ts` por cada request (insostenible).

## Seguridad: baneo de usuarios (superadmin)

Para evitar que cualquier usuario desconocido cree pozos sin que el operador sepa, el superadmin (`SUPER_ADMIN_EMAILS` en `src/lib/admin.ts`) puede banear usuarios desde `/admin/usuarios/[id]`:

- Server action `banUser({ userId, reason })` escribe `profiles.banned_at`, `banned_reason`, `banned_by_user_id`.
- Llama a `supabase.auth.admin.updateUserById(userId, { ban_duration: '8760h' })` para invalidar los refresh tokens del user inmediatamente. La próxima request de Supabase devuelve user=null → pasan por `/login` → callback los bloquea a `/banned`.
- Página `/banned` muestra mensaje + motivo + botón sign-out. Si el user no está baneado, redirige a `/`.
- No elimina data (predicciones, membresías, aportes) — solo bloquea el acceso. Si se desbanea, vuelve a entrar normal.
- Superadmins no se pueden banear a sí mismos ni entre ellos (defense in depth en el server action).

## Performance

- `getLeaderboard` y `getPoolSummary` envueltas en `React cache()` para deduplicar dentro del mismo render (la page del grupo las llamaba en `Promise.all` y `computePayout` las llamaba otra vez por dentro).
- Postgres pool a `max: 10` para soportar Vercel Fluid Compute (un Lambda atiende varios requests concurrentes; con `max: 5` el pool se saturaba y colgaba al cron de ban check vía proxy).
- Imágenes QR en bucket público con cache `3600s` + cleanup automático del QR previo al reemplazar.

## Privacy y Terms

Páginas estáticas en `/privacy` y `/terms` adaptadas a una quiniela privada entre amigos:
- **Privacy**: qué datos recolectamos (correo, nombre, predicciones, aportes manuales), cómo los usamos, terceros (Supabase, Vercel, Google, API-Football), derechos del usuario.
- **Terms**: disclaimer prominente "no es casa de apuestas", flujo del pozo (offline, responsabilidad del owner), exenciones de responsabilidad. Incluye sección "Avisos que la aplicación muestra" con los textos exactos de los `PoolDisclaimer` para consistencia.
- Footer global en el layout root con links visibles a ambos. Requerido para verificación de Google OAuth.

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Llenar:
#   DATABASE_URL (transaction pooler, port 6543)
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   RESOLUTION_CRON_SECRET
#   VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_SUBJECT
#     (generar con: npx web-push generate-vapid-keys)
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
- `cleanup-orphan-qrs.ts` — limpia archivos del bucket `pool-qr` que no están referenciados desde `groups.pool_qr_url`.

## Deploy

Auto-deploy en push a `main` vía la integración Vercel/GitHub. Para deploys manuales:

```bash
vercel --prod
```

Configuración del cron en `vercel.json`:
- `/api/cron/resolve` — daily 08:00 UTC, resuelve resultados.
- `/api/cron/lock-reminder` — daily 10:00 UTC, push notification de recordatorio a quienes no completaron + cierre confirmado.

## Configurar Google OAuth + verificación

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com) — crear proyecto. APIs & Services → OAuth consent screen → External.
2. Credentials → Create credentials → OAuth client ID → Web application. Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Supabase Dashboard** → Authentication → Providers → Google → pegar Client ID + Secret → Enable.
4. **Supabase Dashboard** → Authentication → URL Configuration → Site URL + Redirect URLs whitelist (`http://localhost:3000/auth/callback` en dev, dominio prod).
5. **Branding + verificación** (para eliminar el warning "app no verificada"):
   - OAuth consent screen → completar app name, support email, logo (PNG ≥120×120 — usar `/icon-512` del deploy), homepage `https://mundial-pool.vercel.app`, privacy `…/privacy`, terms `…/terms`, authorized domain raíz, developer contact.
   - **Search Console**: agregar property URL-prefix `https://mundial-pool.vercel.app/` → método HTML file → subir `public/google{token}.html` al repo → deploy → verificar.
   - Publish App + Submit for verification. La revisión de Google tarda 2–3 días hábiles.

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
- [x] Buy-in fijo por grupo + lock retroactivo + payment status en leaderboard
- [x] Tema dark / light / system con toggle en el header
- [x] PWA: icons + manifest + iOS add-to-home-screen + install prompt
- [x] Hora local Bolivia en todos los displays
- [x] Comprobante post-save + "Compartir como imagen" + overlay celebratorio
- [x] Apuestas públicas del grupo después del lock
- [x] Web Push notifications con VAPID + service worker + lock-reminder cron
- [x] Onboarding modal + countdown banner escalado por urgencia
- [x] Reacciones emoji a picks post-lock
- [x] Stats personales + búsqueda/filtros en la matriz de predicciones
- [x] Result celebration con confetti respetando `prefers-reduced-motion`
- [x] Ban system (superadmin) con kill de sesión Supabase
- [x] Privacy + Terms + footer + Google OAuth verification submit
- [x] Editor de puntos por categoría al crear grupo + fix de partial credit
- [x] NavigationProgress + loading.tsx + SavingOverlay
- [ ] Cron de resolución conectado a provider real (TheSportsDB + manual)
- [ ] Admin panel para overrides de los premios FIFA subjetivos
- [ ] Email transaccional para digest diario de resultados (requiere dominio + Resend)
- [ ] Sentry / observability mínima
- [ ] Custom domain (resuelve la última fricción del consent screen de Google)
