import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/app-shell/wordmark'
import { getMagicLinkBlockedUntil } from '@/features/auth/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

const WORLD_CUP_START = new Date('2026-06-11T22:00:00Z')

function daysUntilOpener(): number {
  const ms = WORLD_CUP_START.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

type Props = { searchParams: Promise<{ next?: string }> }

// Only allow relative paths so an attacker can't push an open redirect via
// ?next=https://evil.example/. Single leading slash; no double-slash; not
// the auth callback itself.
function safeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (raw.startsWith('/login') || raw.startsWith('/auth/')) return undefined
  return raw
}

export default async function LoginPage({ searchParams }: Props) {
  const { next: nextRaw } = await searchParams
  const next = safeNext(nextRaw)

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(next ?? '/')

  const blockedUntil = await getMagicLinkBlockedUntil()
  const days = daysUntilOpener()

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-20">
        <Wordmark size="md" />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Mundial 2026 · 11 jun → 19 jul
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance leading-[1.05]">
            El pool
            <br />
            del Mundial,
            <br />
            <span className="text-muted-foreground">para tu grupo.</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-sm leading-relaxed">
            Son <span className="font-medium text-foreground">104 partidos</span> en el Mundial
            2026. Da flojera adivinar Congo vs Uzbekistán o Haití vs Escocia{' '}
            <span className="animate-chef-kiss" aria-label="chef's kiss">
              🤌🏽
            </span>
            . Aquí predice solo las cosas que importan.
          </p>

          <div className="mt-8">
            <LoginForm
              next={next}
              magicLinkBlockedUntil={blockedUntil ? blockedUntil.toISOString() : null}
            />
          </div>
        </div>
      </div>

      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary p-14 text-primary-foreground">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at top right, black, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">Inicio</p>
          <p className="mt-1 text-lg font-medium tracking-tight">
            Jueves 11 de junio · Estadio Azteca
          </p>
          <p className="mt-3 text-base font-medium">
            🇲🇽 México <span className="opacity-50 font-mono text-sm mx-1">vs</span> 🇿🇦 Sudáfrica
          </p>
        </div>

        <div className="relative z-10 -ml-2">
          <div
            className="text-[180px] xl:text-[220px] font-bold leading-[0.85] tracking-tighter tabular-nums"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            {days}
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">
            días para cerrar predicciones
          </p>
        </div>

        <div className="relative z-10 flex justify-between font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">
          <span>48 selecciones</span>
          <span>104 partidos</span>
          <span>14 predicciones</span>
        </div>
      </aside>
    </main>
  )
}
