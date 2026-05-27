const CURRENCY_PREFIX: Record<string, string> = {
  BOB: 'Bs.',
  USDT: 'USDT',
}

// All date/time formatting in the UI is anchored to Bolivian time because
// (a) the audience is Bolivian, and (b) the predictions cutoff has to be
// communicated as a wall-clock time the user can act on. Without a fixed
// timeZone, Node-side rendering on Vercel falls back to UTC and the display
// drifts 4 hours ahead of Bolivia.
export const APP_TIME_ZONE = 'America/La_Paz'

export function formatMoney(amount: number, currency = 'BOB'): string {
  const n = (amount || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${CURRENCY_PREFIX[currency] ?? currency} ${n}`
}

/** Day + short month, Bolivian time. e.g. "11 jun". */
export function formatDayShort(d: Date): string {
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    timeZone: APP_TIME_ZONE,
  })
}

/** Day + short month + 24h time, Bolivian time. e.g. "11 jun, 21:00". */
export function formatDayTime(d: Date): string {
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

/** Wall-clock time only, Bolivian time. e.g. "17:26". */
export function formatTimeOnly(d: Date): string {
  return d.toLocaleString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

const PAYOUT_LABELS: Record<string, string> = {
  winner_takes_all: 'El ganador se lleva todo',
  top_3_split: 'Top 3 · 60 / 30 / 10',
  manual: 'Reparto manual',
}

export function payoutRuleLabel(rule: string): string {
  return PAYOUT_LABELS[rule] ?? rule
}

export function formatDateEs(d: Date): string {
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(d)
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const ms = target.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
