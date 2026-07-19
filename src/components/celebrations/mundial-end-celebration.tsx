import { Confetti } from './confetti'

// Fila ya rankeada (con desempate de competición) y SOLO de pagadores: los
// no-pagadores no entran a esta vista de ganadores.
export type CelebrationRow = {
  userId: string
  displayName: string
  totalPoints: number
  rank: number
  tied: boolean
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const TONE: Record<number, string> = { 1: 'mpe-gold', 2: 'mpe-silver', 3: 'mpe-bronze' }

function ordinal(n: number): string {
  return `${n}°`
}

// Réplica del flyer "Sofistic Campeón" (claude.ai/design), pero data-driven por
// grupo: campeón = líder pagador, podio con empates y tabla del resto. Estilo
// azul-noche + oro, con confeti. Todo el CSS va scopeado bajo `.mpe`.
export function MundialEndCelebration({
  groupName,
  championTeam,
  rows,
  nonPayers = [],
}: {
  groupName: string
  championTeam: string | null
  rows: CelebrationRow[]
  // Jugadores que NO aportaron al pozo: se muestran aparte (fuera de premios)
  // con sus puntos, solo por transparencia.
  nonPayers?: { userId: string; displayName: string; totalPoints: number }[]
}) {
  if (rows.length === 0) return null
  const champion = rows[0]
  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)
  // Orden visual del podio: [2° a la izquierda, 1° al centro (más alto), 3° a la
  // derecha]. Si hay menos de 3 pagadores, se muestran las columnas que haya.
  const left = podium[1] ?? null
  const center = podium[0] ?? null
  const right = podium[2] ?? null
  const podiumCols = [left, center, right].filter(Boolean) as CelebrationRow[]

  return (
    <section className="mpe">
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: hoja de estilo scopeada estática */}
      <style dangerouslySetInnerHTML={{ __html: MPE_CSS }} />
      <Confetti />

      <div className="mpe-stage">
        <div className="mpe-head">
          <span className="mpe-eyebrow">
            <span className="mpe-eyedot" />
            Mundial 2026{championTeam ? ` · ${championTeam} campeón` : ' · ¡Terminó!'}
          </span>
          <h2 className="mpe-h1">
            ¡TERMINÓ EL
            <br />
            MUNDIAL 2026!
          </h2>
          <p className="mpe-subtitle">
            Grupo <b>{groupName}</b> · ¡Tenemos campeón!
          </p>
        </div>

        <div className="mpe-champ">
          <div className="mpe-halo" />
          <div className="mpe-trophy">
            <span className="mpe-crown">
              {/* corona */}
              <svg viewBox="0 0 64 44" fill="none" aria-hidden="true">
                <path
                  d="M6 40h52l-4-26-13 10L32 8 19 24 6 14z"
                  fill="url(#mpe-gcr)"
                  stroke="oklch(0.62 0.13 70)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="6" cy="12" r="4" fill="var(--mpe-gold-1)" />
                <circle cx="58" cy="12" r="4" fill="var(--mpe-gold-1)" />
                <circle cx="32" cy="6" r="4.5" fill="var(--mpe-gold-1)" />
                <defs>
                  <linearGradient id="mpe-gcr" x1="0" y1="8" x2="0" y2="40">
                    <stop stopColor="oklch(0.90 0.11 92)" />
                    <stop offset="1" stopColor="oklch(0.66 0.13 72)" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            {/* trofeo */}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 9a6 6 0 0 0 12 0V3H6z"
                fill="url(#mpe-gtr)"
                stroke="oklch(0.60 0.12 70)"
                strokeWidth="1.1"
              />
              <path
                d="M6 5a3 3 0 0 1-3 3M18 5a3 3 0 0 0 3 3"
                stroke="oklch(0.80 0.14 84)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M10 21h4M12 15v6"
                stroke="oklch(0.66 0.13 72)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M8 21h8"
                stroke="oklch(0.80 0.14 84)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="mpe-gtr" x1="12" y1="3" x2="12" y2="15">
                  <stop stopColor="oklch(0.92 0.10 92)" />
                  <stop offset="1" stopColor="oklch(0.68 0.13 74)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="mpe-kicker">🥇 Campeón del pozo</div>
          <div className="mpe-name">{champion.displayName}</div>
          <div className="mpe-pts">
            <span className="mpe-pts-big mpe-num">{champion.totalPoints}</span>
            <span className="mpe-pts-lbl">puntos</span>
          </div>
        </div>

        {podiumCols.length >= 2 && (
          <div className="mpe-podium" data-cols={podiumCols.length}>
            {[left, center, right].map((entry, i) => {
              if (!entry) return null
              const tone = TONE[entry.rank] ?? 'mpe-bronze'
              const isCenter = i === 1
              return (
                <div key={entry.userId} className={`mpe-col ${tone}`}>
                  <div className="mpe-pcard">
                    {entry.tied && <span className="mpe-tie">Empate {ordinal(entry.rank)}</span>}
                    <div className="mpe-medal">{MEDAL[entry.rank] ?? '🏅'}</div>
                    <div className="mpe-pname">{entry.displayName}</div>
                    <div className="mpe-pscore mpe-num">{entry.totalPoints}</div>
                    <div className="mpe-plabel">pts</div>
                  </div>
                  <div className={`mpe-step ${isCenter ? 'mpe-step-1' : `mpe-step-${entry.rank}`}`}>
                    {entry.rank}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mpe-tbl">
            <div className="mpe-th">
              <span className="mpe-rk">Pos</span>
              <span className="mpe-nm">Jugador</span>
              <span className="mpe-sc">Pts</span>
            </div>
            {rest.map((r) => (
              <div key={r.userId} className={`mpe-row ${r.tied ? 'mpe-tied' : ''}`}>
                <span className="mpe-rk mpe-num">{ordinal(r.rank)}</span>
                <span className="mpe-nm">
                  {r.displayName}
                  {r.tied && <span className="mpe-badge">Empate</span>}
                </span>
                <span className="mpe-sc mpe-num">{r.totalPoints}</span>
              </div>
            ))}
          </div>
        )}

        {nonPayers.length > 0 && (
          <div className="mpe-aside">
            <div className="mpe-aside-head">
              <span className="mpe-aside-title">Aparte · Fuera de premios</span>
              <span className="mpe-aside-sub">
                Sumaron estos puntos pero no aportaron al pozo, así que no entran al premio.
              </span>
            </div>
            {nonPayers.map((r) => (
              <div key={r.userId} className="mpe-arow">
                <span className="mpe-anm">
                  {r.displayName}
                  <span className="mpe-nopay">No pagó</span>
                </span>
                <span className="mpe-asc mpe-num">{r.totalPoints}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mpe-foot">
          <div className="mpe-cheer">¡Felicitaciones a todos los que jugaron! 🎉</div>
          <div className="mpe-brand">
            mundial
            <span className="mpe-bdot" />
            pool · Mundial 2026
          </div>
        </div>
      </div>
    </section>
  )
}

const MPE_CSS = `
.mpe{
  --mpe-ink:oklch(0.97 0.006 90);--mpe-soft:oklch(0.74 0.02 260);--mpe-dim:oklch(0.58 0.02 260);
  --mpe-line:oklch(0.34 0.03 262);--mpe-card:oklch(0.20 0.03 262);--mpe-card2:oklch(0.24 0.032 262);
  --mpe-blue:oklch(0.66 0.15 258);
  --mpe-gold-1:oklch(0.90 0.11 92);--mpe-gold-2:oklch(0.80 0.14 84);--mpe-gold-3:oklch(0.66 0.13 72);
  --mpe-silver-1:oklch(0.90 0.012 260);--mpe-silver-2:oklch(0.78 0.015 260);--mpe-silver-3:oklch(0.64 0.02 260);
  --mpe-bronze-1:oklch(0.78 0.09 58);--mpe-bronze-2:oklch(0.66 0.10 50);--mpe-bronze-3:oklch(0.52 0.09 46);
  --mpe-emerald:oklch(0.74 0.16 156);--mpe-red:oklch(0.64 0.21 26);
  position:relative;overflow:hidden;border-radius:1.5rem;color:var(--mpe-ink);isolation:isolate;
  background:
    radial-gradient(120% 55% at 50% -8%, oklch(0.30 0.09 262) 0%, transparent 55%),
    radial-gradient(90% 40% at 50% 30%, color-mix(in oklab,var(--mpe-gold-2) 16%, transparent) 0%, transparent 42%),
    linear-gradient(180deg, oklch(0.22 0.055 262) 0%, oklch(0.15 0.04 262) 46%, oklch(0.09 0.025 262) 100%);
  box-shadow:0 30px 70px -40px oklch(0.05 0.02 262);
}
.mpe *{box-sizing:border-box}
.mpe .mpe-num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.mpe::before{content:"";position:absolute;inset:0;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);
  background-size:44px 44px;
  mask-image:radial-gradient(120% 90% at 50% 24%,#000 0%,transparent 72%);pointer-events:none}

.mpe-stage{position:relative;z-index:2;display:flex;flex-direction:column;gap:clamp(20px,4.5vw,34px);
  padding:clamp(28px,6vw,60px) clamp(18px,4.5vw,50px) clamp(24px,5vw,50px)}

.mpe-head{display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.4vw,16px)}
.mpe-eyebrow{display:inline-flex;align-items:center;gap:9px;padding:7px 15px;border-radius:999px;
  background:color-mix(in oklab,var(--mpe-gold-2) 12%, transparent);border:1px solid color-mix(in oklab,var(--mpe-gold-2) 34%, transparent);
  font-size:clamp(10px,2.4vw,14px);font-weight:700;letter-spacing:2px;color:var(--mpe-gold-1);text-transform:uppercase;text-align:center}
.mpe-eyedot{width:8px;height:8px;border-radius:50%;background:var(--mpe-gold-1);box-shadow:0 0 12px 2px color-mix(in oklab,var(--mpe-gold-1) 70%,transparent);flex:none}
.mpe-h1{text-align:center;font-size:clamp(1.9rem,7.5vw,3.4rem);line-height:.94;font-weight:900;letter-spacing:-1.5px;
  background:linear-gradient(180deg,#fff 0%, oklch(0.86 0.02 250) 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.mpe-subtitle{text-align:center;font-size:clamp(.95rem,3.2vw,1.3rem);font-weight:600;color:var(--mpe-soft)}
.mpe-subtitle b{color:var(--mpe-ink);font-weight:800}

.mpe-champ{position:relative;border-radius:24px;padding:clamp(24px,5vw,44px) clamp(20px,4vw,44px) clamp(28px,5vw,46px);text-align:center;
  background:linear-gradient(180deg, color-mix(in oklab,var(--mpe-gold-2) 15%, var(--mpe-card)) 0%, var(--mpe-card) 60%);
  border:1.5px solid color-mix(in oklab,var(--mpe-gold-2) 45%, var(--mpe-line));
  box-shadow:0 30px 60px -40px oklch(0.05 0.02 262), inset 0 1px 0 color-mix(in oklab,var(--mpe-gold-1) 30%,transparent), 0 0 0 6px color-mix(in oklab,var(--mpe-gold-2) 6%, transparent)}
.mpe-halo{position:absolute;inset:0;border-radius:24px;pointer-events:none;
  background:radial-gradient(80% 60% at 50% 0%, color-mix(in oklab,var(--mpe-gold-1) 22%, transparent) 0%, transparent 60%)}
.mpe-trophy{position:relative;width:clamp(72px,16vw,110px);height:clamp(72px,16vw,110px);margin:0 auto}
.mpe-trophy>svg{width:100%;height:100%;filter:drop-shadow(0 8px 20px color-mix(in oklab,var(--mpe-gold-2) 55%,transparent))}
.mpe-crown{position:absolute;top:clamp(-22px,-5vw,-16px);left:50%;transform:translateX(-50%) rotate(-2deg);line-height:0}
.mpe-crown svg{width:clamp(40px,9vw,60px);height:auto;filter:drop-shadow(0 4px 10px color-mix(in oklab,var(--mpe-gold-2) 60%,transparent))}
.mpe-kicker{position:relative;margin-top:12px;font-size:clamp(13px,3vw,20px);font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--mpe-gold-1)}
.mpe-name{position:relative;margin-top:10px;font-size:clamp(1.75rem,7vw,3rem);line-height:.98;font-weight:900;letter-spacing:-1px;text-wrap:balance;
  background:linear-gradient(180deg,var(--mpe-gold-1) 0%,var(--mpe-gold-2) 52%,var(--mpe-gold-3) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 2px 1px oklch(0.35 0.09 60 / .5))}
.mpe-pts{position:relative;margin-top:16px;display:inline-flex;align-items:baseline;gap:10px;padding:8px 22px;border-radius:14px;
  background:color-mix(in oklab,var(--mpe-gold-2) 14%, oklch(0.12 0.02 262));border:1px solid color-mix(in oklab,var(--mpe-gold-2) 38%,transparent)}
.mpe-pts-big{font-size:clamp(1.6rem,6vw,2.5rem);font-weight:700;letter-spacing:-1px;color:var(--mpe-gold-1)}
.mpe-pts-lbl{font-size:clamp(1rem,2.6vw,1.4rem);font-weight:600;color:var(--mpe-soft)}

.mpe-podium{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:end;gap:clamp(8px,2vw,18px)}
.mpe-col{display:flex;flex-direction:column;align-items:center;min-width:0}
.mpe-pcard{width:100%;border-radius:16px 16px 0 0;padding:clamp(12px,2.6vw,20px) clamp(6px,1.6vw,14px);text-align:center;position:relative;min-width:0;
  background:linear-gradient(180deg,var(--mpe-card2),var(--mpe-card));border:1px solid var(--mpe-line);border-bottom:none}
.mpe-medal{font-size:clamp(1.5rem,5.5vw,2.4rem);line-height:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}
.mpe-pname{margin-top:8px;font-size:clamp(.8rem,2.5vw,1.2rem);font-weight:800;letter-spacing:-.3px;text-wrap:balance;line-height:1.1;
  overflow-wrap:anywhere}
.mpe-pscore{margin-top:6px;font-size:clamp(1.15rem,3.6vw,1.7rem);font-weight:700}
.mpe-plabel{font-size:clamp(.7rem,1.8vw,1rem);font-weight:600;color:var(--mpe-dim);letter-spacing:.3px}
.mpe-step{width:100%;height:var(--mpe-h);border-radius:0 0 5px 5px;display:flex;align-items:center;justify-content:center;
  font-weight:700;font-variant-numeric:tabular-nums;font-size:clamp(1.4rem,5vw,3rem);color:oklch(0.20 0.02 262 / .55)}
.mpe-step-1{--mpe-h:clamp(64px,13vw,120px)}
.mpe-step-2{--mpe-h:clamp(46px,9vw,84px)}
.mpe-step-3{--mpe-h:clamp(34px,7vw,64px)}
.mpe-gold .mpe-pcard{border-color:color-mix(in oklab,var(--mpe-gold-2) 55%,var(--mpe-line));background:linear-gradient(180deg,color-mix(in oklab,var(--mpe-gold-2) 20%,var(--mpe-card2)),var(--mpe-card))}
.mpe-gold .mpe-step{background:linear-gradient(180deg,var(--mpe-gold-1),var(--mpe-gold-3))}
.mpe-gold .mpe-pscore,.mpe-gold .mpe-pname{color:var(--mpe-gold-1)}
.mpe-silver .mpe-step{background:linear-gradient(180deg,var(--mpe-silver-1),var(--mpe-silver-3))}
.mpe-silver .mpe-pcard{border-color:color-mix(in oklab,var(--mpe-silver-2) 45%,var(--mpe-line))}
.mpe-silver .mpe-pscore{color:var(--mpe-silver-1)}
.mpe-bronze .mpe-step{background:linear-gradient(180deg,var(--mpe-bronze-1),var(--mpe-bronze-3))}
.mpe-bronze .mpe-pcard{border-color:color-mix(in oklab,var(--mpe-bronze-2) 45%,var(--mpe-line))}
.mpe-bronze .mpe-pscore{color:var(--mpe-bronze-1)}
.mpe-tie{position:absolute;top:10px;right:10px;font-size:clamp(9px,1.8vw,13px);font-weight:700;color:var(--mpe-dim);
  background:oklch(0.15 0.02 262 / .6);padding:2px 7px;border-radius:6px;border:1px solid var(--mpe-line)}

.mpe-tbl{border-radius:18px;background:oklch(0.16 0.025 262 / .72);border:1px solid var(--mpe-line);overflow:hidden}
.mpe-th{display:flex;align-items:center;padding:12px clamp(16px,3vw,28px);font-size:clamp(10px,2vw,14px);font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mpe-dim);
  background:oklch(0.20 0.03 262 / .6);border-bottom:1px solid var(--mpe-line)}
.mpe-row{display:flex;align-items:center;padding:0 clamp(16px,3vw,28px);height:clamp(48px,8vw,66px);border-bottom:1px solid color-mix(in oklab,var(--mpe-line) 55%,transparent)}
.mpe-row:last-child{border-bottom:none}
.mpe-rk{width:clamp(44px,10vw,66px);font-weight:700;font-size:clamp(1rem,3vw,1.6rem);color:var(--mpe-soft);flex:none}
.mpe-nm{flex:1;min-width:0;font-size:clamp(1rem,3vw,1.5rem);font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:10px;overflow-wrap:anywhere}
.mpe-sc{font-weight:700;font-size:clamp(1.05rem,3.2vw,1.6rem);color:var(--mpe-ink)}
.mpe-th .mpe-sc{font-weight:700}
.mpe-row.mpe-tied{background:color-mix(in oklab,var(--mpe-blue) 6%, transparent)}
.mpe-badge{font-size:clamp(9px,1.8vw,13px);font-weight:700;color:var(--mpe-blue);background:color-mix(in oklab,var(--mpe-blue) 14%,transparent);
  border:1px solid color-mix(in oklab,var(--mpe-blue) 30%,transparent);padding:2px 8px;border-radius:6px;letter-spacing:.3px;flex:none}

.mpe-aside{border-radius:16px;overflow:hidden;border:1px dashed color-mix(in oklab,var(--mpe-red) 30%, var(--mpe-line));background:oklch(0.14 0.02 262 / .5)}
.mpe-aside-head{padding:12px clamp(16px,3vw,26px);border-bottom:1px solid color-mix(in oklab,var(--mpe-line) 60%,transparent);display:flex;flex-direction:column;gap:3px}
.mpe-aside-title{font-size:clamp(10px,2.1vw,14px);font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--mpe-soft)}
.mpe-aside-sub{font-size:clamp(10px,1.9vw,13px);color:var(--mpe-dim);font-weight:500;text-wrap:balance}
.mpe-arow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 clamp(16px,3vw,26px);height:clamp(44px,7vw,58px);border-bottom:1px solid color-mix(in oklab,var(--mpe-line) 40%,transparent)}
.mpe-arow:last-child{border-bottom:none}
.mpe-anm{display:flex;align-items:center;gap:10px;min-width:0;font-size:clamp(.95rem,2.8vw,1.3rem);font-weight:700;color:var(--mpe-soft);overflow-wrap:anywhere}
.mpe-nopay{flex:none;font-size:clamp(9px,1.8vw,12px);font-weight:700;letter-spacing:.3px;color:var(--mpe-red);
  background:color-mix(in oklab,var(--mpe-red) 14%,transparent);border:1px solid color-mix(in oklab,var(--mpe-red) 32%,transparent);padding:2px 8px;border-radius:6px}
.mpe-asc{font-weight:700;font-size:clamp(1rem,3vw,1.4rem);color:var(--mpe-dim)}

.mpe-foot{text-align:center;display:flex;flex-direction:column;gap:10px;padding-top:6px}
.mpe-cheer{font-size:clamp(1rem,3vw,1.5rem);font-weight:800;letter-spacing:-.3px;color:var(--mpe-ink);text-wrap:balance}
.mpe-brand{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:clamp(.85rem,2.2vw,1.2rem);font-weight:700;color:var(--mpe-soft)}
.mpe-bdot{width:9px;height:9px;border-radius:50%;background:var(--mpe-blue);box-shadow:0 0 10px 1px color-mix(in oklab,var(--mpe-blue) 60%,transparent)}

.mpe-confetti{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.mpe-cf{position:absolute;top:-40px;will-change:transform}
@keyframes mpe-fall{0%{transform:translateY(-40px) rotate(0deg)}100%{transform:translateY(1600px) rotate(720deg)}}
@media (prefers-reduced-motion:reduce){.mpe-cf{animation:none!important}}
`
