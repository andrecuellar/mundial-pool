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
pnpm db:generate && pnpm db:migrate
pnpm db:seed:categories
pnpm db:seed:teams
pnpm dev
```

## Autenticación

Google OAuth + Email magic link, ambos vía Supabase Auth (`@supabase/ssr`). Sin
passwords. La sesión se mantiene en cookies HTTP-only y se refresca en cada
request vía `src/proxy.ts` (en Next 16, `middleware` se llama `proxy`).

### Configurar Google OAuth

Una vez por proyecto. El magic link funciona out-of-the-box; Google requiere
estos pasos:

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
   - Crear proyecto (o reusar uno).
   - APIs & Services → OAuth consent screen → External → completar app name,
     soporte email, logo (opcional). Dominios autorizados: el de tu Supabase
     project (`xxx.supabase.co`).
   - Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Copiar el Client ID y Client Secret.

2. **Supabase Dashboard** → Authentication → Providers → Google
   - Pegar Client ID y Client Secret.
   - Enable. Save.

3. **Supabase Dashboard** → Authentication → URL Configuration
   - Site URL: `http://localhost:3000` (en dev) o tu dominio en prod.
   - Redirect URLs (whitelist): `http://localhost:3000/auth/callback` y
     el equivalente de producción.

### Email magic link

Por defecto Supabase manda los emails con su SMTP compartido (límite ~3
emails/hora). Para producción, configurar SMTP propio en Authentication →
Email Templates → SMTP Settings. Gratis: Resend, SendGrid free tier.

## Pozo de apuestas privado (opt-in por grupo)

Cada grupo puede activar un pozo monetario manejado offline (Yape, transferencia bancaria, QR de Tigo Money, etc.). La app **no procesa pagos**, solo lleva el ledger.

Schema relevante:
- `groups.pool_enabled`, `pool_currency`, `pool_qr_url`, `pool_payout_rule`.
- Tabla `pool_transactions` (id, group_id, contributor_user_id, contributor_label, amount, currency, note, created_by_user_id, created_at).

Reglas de payout disponibles: `winner_takes_all`, `top_3_split` (60/30/10), `manual`. La función `computePayout(groupId)` cruza el leaderboard actual con el monto acumulado y devuelve cuánto le tocaría a cada rank si el torneo terminara ahora.

Solo el `owner` del grupo puede:
- Activar/desactivar el pozo (`updatePoolConfig`).
- Subir el QR (URL externa por ahora; subida via Supabase Storage queda como TODO del admin panel).
- Registrar y eliminar transacciones (`recordPoolTransaction`, `deletePoolTransaction`).

Todos los miembros del grupo pueden ver el monto acumulado, el QR para aportar, y la lista de transacciones (para transparencia).

## Tema (dark / light)

`globals.css` declara el sistema de tokens con CSS variables. **Dark es el default**; si el dispositivo prefiere light (`prefers-color-scheme: light`), se hace override automáticamente. No hay toggle manual por ahora.

Los tokens están en `:root` y se consumen vía clases Tailwind (`bg-background`, `text-foreground`, `border-border`, etc.) gracias al `@theme inline` block. La paleta vive en OK-LCh para preservar luminancia perceptual entre dark y light.

## Roadmap

- [x] Schema + integraciones base
- [x] Seed de categorías + 48 selecciones del Mundial 2026
- [x] Provider TheSportsDB + endpoint cron de resolución
- [x] Auth Google + magic link, deep-link `/join/[code]` con redirect post-auth
- [x] CRUD de grupos + invitación por código + Share API
- [x] Formulario de predicciones con autocomplete de jugadores + cascada Top 5
- [x] Leaderboard con cálculo de puntaje server-side y desglose por categoría
- [x] Pozo de apuestas opt-in con QR upload a Supabase Storage
- [x] Tema dark / light / sistema con toggle en el header
- [x] PWA: icons + manifest + iOS add-to-home-screen
- [x] Seed de FIFA ranking para revelación / decepción
- [ ] Cron de resolución conectado a un proveedor real (Wikipedia + TheSportsDB)
- [ ] Admin panel: overrides manuales para los premios FIFA subjetivos
- [ ] Notificaciones por email cuando se actualice el leaderboard
