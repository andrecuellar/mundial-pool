import type { Metadata } from 'next'
import { Trophy, Users, Sparkles } from 'lucide-react'
import { Wordmark } from '@/components/app-shell/wordmark'
import { ShareComprobanteButton } from '@/components/predictions/share-comprobante-button'

export const metadata: Metadata = {
  title: 'Qué se predice',
  description:
    '14 predicciones del Mundial 2026 · hasta 107 puntos en juego. Gana el que más acierta.',
  alternates: { canonical: '/faq' },
}

type Item = {
  name: string
  hint?: string
  points: string
}

type Section = {
  id: string
  label: string
  icon: typeof Trophy
  accent: string
  items: Item[]
  subtotal: number
}

const SECTIONS: Section[] = [
  {
    id: 'podium',
    label: 'Podio y final',
    icon: Trophy,
    accent: 'gold',
    items: [
      { name: 'Selección campeona', points: '15' },
      { name: 'Subcampeón', points: '7' },
      { name: 'Tercer lugar', points: '5' },
      { name: 'Finalistas', hint: 'por cada uno acertado · 2 equipos', points: '6 c/u' },
      {
        name: 'Top 5 selecciones',
        hint: 'por cada una acertada · 5 equipos',
        points: '2 c/u',
      },
    ],
    subtotal: 15 + 7 + 5 + 6 * 2 + 2 * 5,
  },
  {
    id: 'team',
    label: 'Distinciones de equipo',
    icon: Users,
    accent: 'primary',
    items: [
      { name: 'Selección revelación', hint: 'la que sorprende y llega lejos', points: '8' },
      { name: 'Selección decepción', hint: 'la favorita que se cae', points: '8' },
      { name: 'Más goleadora', points: '5' },
      { name: 'Más goleada', points: '3' },
    ],
    subtotal: 8 + 8 + 5 + 3,
  },
  {
    id: 'player',
    label: 'Jugadores destacados',
    icon: Sparkles,
    accent: 'accent',
    items: [
      { name: 'Bota de Oro', hint: 'goleador del torneo', points: '10' },
      { name: 'Máximo asistente', points: '7' },
      { name: 'Balón de Oro', hint: 'mejor jugador', points: '7' },
      { name: 'Guante de Oro', hint: 'mejor arquero', points: '5' },
      { name: 'Mejor jugador joven', points: '5' },
    ],
    subtotal: 10 + 7 + 7 + 5 + 5,
  },
]

const TOTAL_MAX = SECTIONS.reduce((s, sec) => s + sec.subtotal, 0)

function accentClasses(accent: string) {
  if (accent === 'gold') {
    return {
      ring: 'ring-1 ring-[color:var(--gold)]/30',
      icon: 'bg-[color:var(--gold)]/15 text-[color:var(--gold)]',
      chip: 'border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]',
      label: 'text-[color:var(--gold)]',
    }
  }
  if (accent === 'accent') {
    return {
      ring: 'ring-1 ring-accent/30',
      icon: 'bg-accent/15 text-accent',
      chip: 'border-accent/40 bg-accent/10 text-accent',
      label: 'text-accent',
    }
  }
  return {
    ring: 'ring-1 ring-primary/30',
    icon: 'bg-primary/15 text-primary',
    chip: 'border-primary/40 bg-primary/10 text-primary',
    label: 'text-primary',
  }
}

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10 sm:px-8 sm:py-14">
      <div id="faq-card">
      <header className="flex flex-col items-center gap-2 text-center">
        <Wordmark size="lg" />
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          El pool del Mundial 2026
        </p>
      </header>

      <section className="mt-10 text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight leading-[1.1] sm:text-4xl">
          Qué se predice
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          14 predicciones por jugador. El que más acierta se lleva todo el pozo del grupo.
        </p>

        <div className="mt-6 inline-flex items-baseline gap-1.5 rounded-full border border-border bg-card px-4 py-1.5">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            hasta
          </span>
          <span className="text-base font-semibold tabular-nums">{TOTAL_MAX}</span>
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            puntos
          </span>
        </div>
      </section>

      <div className="mt-8 space-y-5">
        {SECTIONS.map((sec) => {
          const a = accentClasses(sec.accent)
          const Icon = sec.icon
          return (
            <article
              key={sec.id}
              className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ${a.ring}`}
            >
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${a.icon}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-foreground">
                    {sec.label}
                  </h2>
                </div>
                <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${a.label}`}>
                  {sec.subtotal} pts
                </span>
              </header>

              <ul className="mt-4 divide-y divide-border/70">
                {sec.items.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{it.name}</p>
                      {it.hint && (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {it.hint}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${a.chip}`}
                    >
                      {it.points}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Cómo se juega
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">
          Las predicciones se cierran antes del partido inaugural. Después del Mundial, el que más
          puntos hizo se lleva todo.
        </p>
      </section>

      <footer className="mt-10 flex flex-col items-center gap-1 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Entra a
        </p>
        <p className="text-lg font-semibold tracking-tight">mundial-pool.vercel.app</p>
      </footer>
      </div>

      <div className="mt-8 flex justify-center">
        <ShareComprobanteButton
          targetId="faq-card"
          fileName="mundial-pool-faq"
          shareTitle="mundial-pool · qué se predice"
          shareText="El pool del Mundial 2026 entre amigos. mundial-pool.vercel.app"
        />
      </div>
    </main>
  )
}
