import type { BoringMatchView } from '@/features/welcome/boring-matches'

type Props = BoringMatchView & {
  className?: string
}

// Replica el layout de la "match card" estilo Google match preview: header
// con el nombre del torneo + grupo, body con dos filas equipo (bandera +
// nombre) a la izquierda y fecha/hora a la derecha. Se usa dentro del
// WelcomeSplash y del WelcomeSplashInline.
export function MatchCard({ home, away, group, dateLabel, timeLabel, className }: Props) {
  return (
    <div
      className={`rounded-xl border border-border/70 bg-card/85 px-4 py-3 text-left shadow-sm backdrop-blur ${className ?? ''}`}
    >
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Copa Mundial de Fútbol · Grupo {group}
      </p>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 space-y-1.5">
          <TeamRow name={home.name} flag={home.flagEmoji} code={home.fifaCode} />
          <TeamRow name={away.name} flag={away.flagEmoji} code={away.fifaCode} />
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{dateLabel}</p>
          <p className="mt-1">{timeLabel}</p>
        </div>
      </div>
    </div>
  )
}

function TeamRow({ name, flag, code }: { name: string; flag: string | null; code: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="text-base leading-none">
        {flag ?? code}
      </span>
      <span className="truncate text-sm font-medium text-foreground">{name}</span>
    </div>
  )
}
